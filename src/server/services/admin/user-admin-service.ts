import { AppError, ErrorCode } from '@/lib/api/errors'
import { gerarHash } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/server/services/audit-service'

/**
 * Editar acesso ao painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CRM SABIA CRIAR ACESSO E NÃO SABIA TIRAR
 * ────────────────────────────────────────────────────────────────────────────
 * `User.active` existe desde o primeiro dia e o guard o consulta a cada
 * requisição. A tela de Configurações até imprime "Desativado" como estado
 * possível. Só que nada no sistema escrevia esse campo: o estado era
 * inalcançável, e cortar o acesso de quem saiu da equipe exigia escrever no
 * banco à mão.
 *
 * É a diferença entre ter controle de acesso e ter uma lista de quem entrou
 * uma vez.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DUAS TRAVAS, E ELAS PROTEGEM COISAS DIFERENTES
 * ────────────────────────────────────────────────────────────────────────────
 *  • **Não mexer em si mesmo** (desativar, rebaixar): é trancar-se para fora
 *    com um clique, no meio da sessão, sem ninguém do outro lado para reabrir.
 *  • **Sempre sobrar um dono ativo**: é a invariante do sistema, e ela mora
 *    DENTRO da transação, com a tabela travada. Pelo caminho normal ela nunca
 *    dispara — a trava acima já garante que quem pediu continua ativo. Ela
 *    existe para o que a lógica sozinha não cobre: dois pedidos simultâneos,
 *    cada um desativando o outro dono, os dois lendo "ainda há dois".
 *
 * As duas se sobrepõem de propósito, e por isso os testes atacam uma de cada
 * vez: o da trava de si-mesmo roda COM um segundo dono na mesa, para que só
 * ela possa produzir a recusa; o da invariante chama o serviço direto, com o
 * chamador já inativo, que é o estado que a corrida produziria.
 */

type Contexto = { userId: number; ip: string | null }

export type CamposDoUsuario = {
  nome?: string
  ativo?: boolean
  role?: 'OWNER' | 'ADMIN'
  /** Reset feito pelo dono. A senha nunca é lida de volta nem auditada. */
  senha?: string
}

export type UsuarioAdminDTO = {
  id: number
  nome: string
  email: string
  role: 'OWNER' | 'ADMIN'
  ativo: boolean
}

export async function atualizarUsuario(
  usuarioId: number,
  dados: CamposDoUsuario,
  ctx: Contexto,
): Promise<UsuarioAdminDTO> {
  const alvo = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  if (!alvo) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Usuário não encontrado.', { status: 404 })
  }

  const souEu = alvo.id === ctx.userId

  if (souEu && dados.ativo === false) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Você não pode desativar o próprio acesso. Peça a outro dono, ou desative depois de passar a chave.',
      { status: 400 },
    )
  }

  if (souEu && dados.role === 'ADMIN') {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Você não pode rebaixar o próprio acesso. Promova outra pessoa a dono primeiro.',
      { status: 400 },
    )
  }

  // Desativar, reativar e trocar senha MATAM as sessões abertas.
  //
  // Para o `ativo: false` o guard já barra sozinho a cada requisição — a conta
  // desativada cai na hora, sem esperar token expirar. O incremento aqui cobre
  // o outro lado: sem ele, REATIVAR devolveria validade a um cookie que passou
  // semanas fora do controle da empresa.
  const derrubarSessoes = dados.ativo !== undefined || dados.senha !== undefined

  const depois = await prisma.$transaction(async (tx) => {
    // ── A INVARIANTE, TRANCADA ────────────────────────────────────────────
    // O lock vem ANTES da escrita e a conferência DEPOIS, e as duas coisas
    // são necessárias por motivos diferentes.
    //
    // Pelo caminho normal desta rota, o sistema não consegue ficar sem dono:
    // só um dono chama, e ele não pode mexer em si mesmo, então quem pediu
    // continua ativo. A invariante existe para o caso que a lógica sozinha
    // não cobre — DOIS pedidos simultâneos, cada um desativando o outro dono.
    // Os dois leem "ainda há dois donos", os dois gravam, e o CRM fica sem
    // ninguém que possa reabrir a porta por dentro.
    //
    // `FOR UPDATE` sobre a tabela inteira de usuários serializa os dois: o
    // segundo espera, relê depois do commit do primeiro, conta zero e desfaz.
    // A tabela tem unidades, não milhares — o custo é nenhum.
    //
    // ⚠️ ESTE LOCK NÃO TEM TESTE, E ISSO É DECLARADO, NÃO ESQUECIMENTO.
    // Removê-lo não derruba nenhum caso da suíte: a corrida que ele impede não
    // é reproduzível de forma determinística num teste sequencial. O que os
    // testes provam é a CONFERÊNCIA (`donosAtivos === 0` desfaz a escrita); o
    // que eles não provam é que dois pedidos simultâneos não escapam pela
    // brecha do "lê, lê, grava, grava". Fica na conferência humana.
    await tx.$queryRaw`SELECT id FROM users FOR UPDATE`

    const salvo = await tx.user.update({
      where: { id: usuarioId },
      data: {
        ...(dados.nome !== undefined ? { name: dados.nome } : {}),
        ...(dados.ativo !== undefined ? { active: dados.ativo } : {}),
        ...(dados.role !== undefined ? { role: dados.role } : {}),
        ...(dados.senha !== undefined
          ? {
              passwordHash: await gerarHash(dados.senha),
              // Senha nova zera o bloqueio por tentativas: quem trocou a senha
              // não deve continuar preso pelo erro de quem a estava adivinhando.
              failedLoginAttempts: 0,
              lockedUntil: null,
            }
          : {}),
        ...(derrubarSessoes ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, name: true, email: true, role: true, active: true },
    })

    const donosAtivos = await tx.user.count({ where: { role: 'OWNER', active: true } })
    if (donosAtivos === 0) {
      // Lançar aqui DESFAZ a escrita: é a transação inteira que volta atrás.
      throw new AppError(
        ErrorCode.CONFLICT,
        'Este é o único dono ativo. Promova outra pessoa a dono antes de tirar este acesso.',
        { status: 400 },
      )
    }

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'user.update',
        entityType: 'User',
        entityId: usuarioId,
        // NEM A SENHA NEM O HASH entram aqui. O registro guarda o que
        // aconteceu, não a credencial — e `senhaTrocada` é o que aconteceu.
        before: { nome: alvo.name, role: alvo.role, ativo: alvo.active },
        after: {
          nome: salvo.name,
          role: salvo.role,
          ativo: salvo.active,
          ...(dados.senha !== undefined ? { senhaTrocada: true } : {}),
        },
        ip: ctx.ip,
      },
      tx,
    )

    return salvo
  })

  return {
    id: depois.id,
    nome: depois.name,
    email: depois.email,
    role: depois.role,
    ativo: depois.active,
  }
}
