import 'dotenv/config'

import { gerarHash } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'

/**
 * O ÚLTIMO RECURSO: devolver o acesso a quem se trancou para fora.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE UM SCRIPT, E NÃO UM "ESQUECI MINHA SENHA" NA TELA
 * ════════════════════════════════════════════════════════════════════════════
 * O fluxo de manual é link por e-mail com token de validade. Ele exige e-mail
 * transacional, que este projeto não tem, e uma rota PÚBLICA que aceita um
 * e-mail e dispara ação — a superfície mais atacada de qualquer painel.
 *
 * Fingir esse fluxo com uma senha provisória seria pior: daria a impressão de
 * que existe expiração quando não existe.
 *
 * O caso normal já está resolvido DENTRO do painel: o dono troca a senha de
 * qualquer pessoa da equipe em `Configurações → Quem tem acesso`. Este script
 * existe para o caso que sobra, e só ele: **o único dono esqueceu a própria
 * senha**, e não há ninguém do outro lado para reabrir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AS CINCO TRAVAS, PORQUE ISTO ESCREVE CREDENCIAL EM PRODUÇÃO
 * ════════════════════════════════════════════════════════════════════════════
 *  1. **Ensaio por padrão.** Sem `--aplicar`, imprime o que faria e sai.
 *  2. **Destino conferido.** `--destino=<trecho>` é comparado com a string de
 *     conexão real. Não bate, não roda. Digitar o destino é o momento em que a
 *     pessoa LÊ para onde está apontando.
 *  3. **Autor obrigatório.** `--como=email` vai para a trilha de auditoria.
 *     Ninguém mexe em produção anonimamente.
 *  4. **Conferência antes de escrever.** O e-mail precisa existir e a conta
 *     precisa estar ativa; senha curta é recusada antes de qualquer escrita.
 *  5. **A senha NUNCA é impressa nem auditada.** Ela chega por variável de
 *     ambiente (`SENHA_NOVA`), e não por argumento: argumento fica no
 *     histórico do shell e aparece em `ps` para qualquer processo da máquina.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * COMO USAR
 * ════════════════════════════════════════════════════════════════════════════
 *     # 1. ensaio (não escreve nada)
 *     npx tsx scripts/resetar-senha.ts \
 *       --email=dono@empresa.com --como=voce@empresa.com --destino=caqui_trekking_dev
 *
 *     # 2. valendo
 *     SENHA_NOVA='...' npx tsx scripts/resetar-senha.ts \
 *       --email=dono@empresa.com --como=voce@empresa.com \
 *       --destino=caqui_trekking_dev --aplicar
 *
 * Trocar a senha encerra TODAS as sessões daquela pessoa (`tokenVersion`), e
 * zera o bloqueio por tentativas erradas — quem acabou de receber a senha nova
 * não deve continuar preso pelo erro de quem a estava adivinhando.
 */

const MINIMO_DA_SENHA = 12

function argumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`
  return process.argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length)
}

function abortar(mensagem: string): never {
  console.error(`\n✖ ${mensagem}\n`)
  process.exit(1)
}

async function main(): Promise<void> {
  const email = argumento('email')?.trim().toLowerCase()
  const autor = argumento('como')?.trim().toLowerCase()
  const destino = argumento('destino')?.trim()
  const aplicar = process.argv.includes('--aplicar')
  const senha = process.env['SENHA_NOVA']

  if (!email) abortar('Falta --email=<e-mail da conta>.')
  if (!autor) abortar('Falta --como=<seu e-mail>. A trilha de auditoria não aceita anônimo.')
  if (!destino) {
    abortar(
      'Falta --destino=<trecho da string de conexão>. É a trava que impede rodar isto no banco errado.',
    )
  }

  // ── Trava 2: o destino ──────────────────────────────────────────────────
  const url = process.env['DATABASE_URL']
  if (!url) abortar('DATABASE_URL não definida.')
  if (!url.includes(destino)) {
    abortar(
      `O destino informado ("${destino}") não aparece na DATABASE_URL carregada. ` +
        'Confira para onde este terminal está apontando antes de insistir.',
    )
  }

  // ── Trava 4: conferência ────────────────────────────────────────────────
  const alvo = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  if (!alvo) abortar(`Não existe conta com o e-mail ${email} neste banco.`)
  if (!alvo.active) {
    abortar(
      `A conta ${email} está DESATIVADA. Devolver senha a ela não devolve o acesso: ` +
        'reative pelo painel, ou decida conscientemente reativar antes de resetar.',
    )
  }

  console.log('\n── Alvo ──')
  console.log(`  ${alvo.name} <${alvo.email}> · ${alvo.role === 'OWNER' ? 'dono' : 'equipe'}`)
  console.log(`  banco: ...${url.slice(-40)}`)
  console.log(`  autor: ${autor}`)

  if (!aplicar) {
    console.log('\n── ENSAIO ──')
    console.log('  Nada foi escrito. O que aconteceria:')
    console.log('    • a senha desta conta seria substituída')
    console.log('    • todas as sessões dela seriam encerradas')
    console.log('    • o bloqueio por tentativas erradas seria zerado')
    console.log('    • uma linha entraria na trilha de auditoria (sem a senha)')
    console.log('\n  Para valer, repita com SENHA_NOVA=... e --aplicar\n')
    return
  }

  if (!senha) abortar('Falta a variável de ambiente SENHA_NOVA. Ela não entra por argumento.')
  if (senha.length < MINIMO_DA_SENHA) {
    abortar(`A senha precisa ter pelo menos ${MINIMO_DA_SENHA} caracteres.`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: alvo.id },
      data: {
        passwordHash: await gerarHash(senha),
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })

    await tx.auditLog.create({
      data: {
        // `userId` fica nulo: quem rodou o script é uma pessoa no terminal, e
        // ela pode não ter conta neste banco. O e-mail dela vai no `after`,
        // que é o campo livre, em vez de forjar uma chave estrangeira.
        userId: null,
        action: 'user.update',
        entityType: 'User',
        entityId: String(alvo.id),
        before: { ativo: alvo.active, role: alvo.role },
        // A SENHA NÃO ENTRA AQUI, nem o hash. O registro guarda o que
        // aconteceu, não a credencial.
        after: { senhaTrocada: true, por: autor, via: 'scripts/resetar-senha.ts' },
        ip: null,
      },
    })
  })

  console.log('\n✔ Senha trocada. Todas as sessões dessa conta foram encerradas.')
  console.log('  Entre em /crm com a senha nova e troque-a de novo pelo painel se quiser.\n')
}

main()
  .catch((erro: unknown) => {
    console.error('\n✖ Falhou:', erro)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
