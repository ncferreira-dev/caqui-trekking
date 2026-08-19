import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PATCH as editarUsuario } from '@/app/api/admin/users/[id]/route'
import { POST as loginRota } from '@/app/api/auth/login/route'
import { GET as painelRota } from '@/app/api/admin/dashboard/route'
import { gerarHash } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'
import { atualizarUsuario } from '@/server/services/admin/user-admin-service'
import { limparBanco, post } from './fixtures'
import { criarUsuarios, EMAILS, prepararCookies, SENHAS } from './sessao'

/**
 * REVOGAR ACESSO AO PAINEL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O BURACO, MEDIDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * O CRM sabia CRIAR acesso e não sabia tirar. `User.active` existe no schema
 * desde o primeiro dia, o guard já o consulta a cada requisição, e a tela de
 * Configurações até imprime "Desativado" como estado possível.
 *
 * Só que NADA no sistema escrevia esse campo: não havia
 * `PATCH /api/admin/users/:id`. O estado era inalcançável, e a única forma de
 * cortar o acesso de alguém que saiu da equipe era escrever no banco à mão.
 *
 * É a diferença entre "temos controle de acesso" e "temos uma lista de quem
 * entrou uma vez".
 *
 * Nasceu falhando: a rota não existia.
 */
describe('PATCH /api/admin/users/:id', () => {
  let cookieOwner: string
  let cookieAdmin: string

  beforeAll(async () => {
    const cookies = await prepararCookies()
    cookieOwner = cookies.OWNER
    cookieAdmin = cookies.ADMIN
  })

  beforeEach(async () => {
    await limparBanco()
    await criarUsuarios()
  })

  const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) }) as never

  /**
   * Um segundo dono ATIVO na mesa.
   *
   * Existe para isolar a trava de si-mesmo da invariante do último dono: com
   * dois donos, desativar a si mesmo deixaria o sistema com um dono, então a
   * invariante NÃO tem motivo para recusar. Se a recusa vier, ela só pode ter
   * vindo da trava certa.
   */
  async function segundoDono(): Promise<number> {
    const u = await prisma.user.create({
      data: {
        name: 'Segunda Dona',
        email: 'dona2@caqui.test',
        passwordHash: await gerarHash('senha-de-teste-dona-dois'),
        role: 'OWNER',
      },
    })
    return u.id
  }

  /** Uma leitura autenticada qualquer, para medir se a sessão ainda vale. */
  async function tentarUsarSessao(cookie: string): Promise<number> {
    const req = new Request('http://localhost:3000/api/admin/dashboard', { headers: { cookie } })
    return (await painelRota(req as never)).status
  }

  async function idDe(papel: 'OWNER' | 'ADMIN'): Promise<number> {
    const u = await prisma.user.findUniqueOrThrow({ where: { email: EMAILS[papel] } })
    return u.id
  }

  async function editar(id: number, corpo: unknown, cookie = cookieOwner) {
    return editarUsuario(post(`/api/admin/users/${id}`, corpo, { cookie }) as never, ctx(id))
  }

  it('desativa o acesso de alguém da equipe', async () => {
    const alvo = await idDe('ADMIN')

    const res = await editar(alvo, { ativo: false })
    expect(res.status).toBe(200)

    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: alvo } })
    expect(salvo.active).toBe(false)
  })

  it('A SESSÃO ABERTA MORRE NA MESMA REQUISIÇÃO, não quando o token expirar', async () => {
    // É isto que faz "revogar" ser verdade. Um sistema que só recusa o PRÓXIMO
    // login deixa a pessoa demitida trabalhando até o token vencer — o defeito
    // que o mecanismo 7 da doutrina existe para impedir.
    const alvo = await idDe('ADMIN')

    // Antes: a sessão do ADMIN funciona.
    expect(await tentarUsarSessao(cookieAdmin)).not.toBe(401)

    await editar(alvo, { ativo: false })

    expect(await tentarUsarSessao(cookieAdmin)).toBe(401)
  })

  it('reativar não ressuscita o cookie antigo', async () => {
    // Desativar incrementa o `tokenVersion`. Sem isso, reativar devolveria
    // validade a um cookie que passou semanas fora do controle da empresa.
    const alvo = await idDe('ADMIN')
    await editar(alvo, { ativo: false })
    await editar(alvo, { ativo: true })

    expect(await tentarUsarSessao(cookieAdmin)).toBe(401)

    // E o caminho normal continua aberto: quem foi reativado entra de novo.
    const login = await loginRota(
      post('/api/auth/login', { email: EMAILS.ADMIN, senha: SENHAS.ADMIN }) as never,
    )
    expect(login.status).toBe(200)
  })

  it('o dono não desativa o próprio acesso, MESMO havendo outro dono', async () => {
    // Trancar-se para fora com um clique, no meio da sessão. O segundo dono
    // está aqui para a invariante não ter motivo de recusar: se der 400, foi
    // a trava de si-mesmo, e só ela.
    await segundoDono()
    const eu = await idDe('OWNER')

    const res = await editar(eu, { ativo: false })
    expect(res.status).toBe(400)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: eu } })).active).toBe(true)
  })

  it('o dono não rebaixa o próprio papel, MESMO havendo outro dono', async () => {
    await segundoDono()
    const eu = await idDe('OWNER')

    const res = await editar(eu, { role: 'ADMIN' })
    expect(res.status).toBe(400)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: eu } })).role).toBe('OWNER')
  })

  it('a invariante desfaz a escrita que deixaria o sistema sem dono', async () => {
    // ════════════════════════════════════════════════════════════════════
    // O CASO QUE A LÓGICA SOZINHA NÃO COBRE
    // ════════════════════════════════════════════════════════════════════
    // Pela rota, isto não acontece: só um dono chama, e ele não mexe em si
    // mesmo, então quem pediu continua ativo. O que produz o estado abaixo é
    // uma CORRIDA — dois pedidos simultâneos, cada um desativando o outro
    // dono, os dois lendo "ainda há dois donos".
    //
    // O serviço é chamado direto, com o chamador já inativo, porque esse é
    // exatamente o estado intermediário que a corrida produz. É a única forma
    // determinística de exercitar o ramo.
    const outro = await segundoDono()
    const eu = await idDe('OWNER')
    await prisma.user.update({ where: { id: eu }, data: { active: false } })

    await expect(
      atualizarUsuario(outro, { ativo: false }, { userId: eu, ip: null }),
    ).rejects.toThrow(/único dono ativo/)

    // E a escrita foi DESFEITA: a transação inteira voltou atrás.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: outro } })).active).toBe(true)
  })

  it('com dois donos, um pode desativar o outro', async () => {
    // A invariante não pode virar "ninguém mexe em ninguém": tirar o acesso de
    // um sócio que saiu é justamente o caso de uso desta tela.
    const outro = await segundoDono()

    expect((await editar(outro, { ativo: false })).status).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: outro } })).active).toBe(false)
  })

  it('ADMIN não mexe em acesso nenhum', async () => {
    // Quem pode criar acesso pode criar OWNER e se tornar irremovível. A porta
    // é a mais estreita do sistema, e vale para editar também.
    const alvo = await idDe('ADMIN')
    const res = await editar(alvo, { ativo: false }, cookieAdmin)
    expect(res.status).toBe(403)

    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: alvo } })
    expect(salvo.active).toBe(true)
  })

  it('sem sessão, 401 e nada muda', async () => {
    const alvo = await idDe('ADMIN')
    const res = await editarUsuario(
      post(`/api/admin/users/${alvo}`, { ativo: false }) as never,
      ctx(alvo),
    )
    expect(res.status).toBe(401)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alvo } })).active).toBe(true)
  })

  it('troca a senha de alguém da equipe, e derruba as sessões dela', async () => {
    const alvo = await idDe('ADMIN')
    const NOVA = 'senha-nova-de-doze-ou-mais'

    const res = await editar(alvo, { senha: NOVA })
    expect(res.status).toBe(200)

    // A antiga não entra mais.
    const velha = await loginRota(
      post('/api/auth/login', { email: EMAILS.ADMIN, senha: SENHAS.ADMIN }) as never,
    )
    expect(velha.status).toBe(401)

    // A nova entra.
    const nova = await loginRota(
      post('/api/auth/login', { email: EMAILS.ADMIN, senha: NOVA }) as never,
    )
    expect(nova.status).toBe(200)
  })

  it('trocar a PRÓPRIA senha também derruba a própria sessão', async () => {
    // Não é efeito colateral: é a regra. O `tokenVersion` sobe para todo mundo,
    // inclusive para quem pediu. A tela precisa saber disso e mandar a pessoa
    // ao login, senão ela fica numa página morta tomando 401 no clique
    // seguinte. Ver `gerenciar-acessos.tsx`.
    const eu = await idDe('OWNER')
    expect(await tentarUsarSessao(cookieOwner)).not.toBe(401)

    const res = await editar(eu, { senha: 'a-minha-senha-nova-de-doze' })
    expect(res.status).toBe(200)

    expect(await tentarUsarSessao(cookieOwner)).toBe(401)
  })

  it('a senha nunca vai para a auditoria', async () => {
    const alvo = await idDe('ADMIN')
    await editar(alvo, { senha: 'outra-senha-de-doze-ou-mais' })

    const registros = await prisma.auditLog.findMany({
      where: { entityType: 'User', entityId: String(alvo) },
    })
    expect(registros.length).toBeGreaterThan(0)

    const texto = JSON.stringify(registros)
    expect(texto).not.toContain('outra-senha')
    expect(texto).not.toContain('$2b$')
  })

  it('recusa campo desconhecido em vez de ignorar', async () => {
    const alvo = await idDe('ADMIN')
    const res = await editar(alvo, { active: false })
    expect(res.status).toBe(400)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alvo } })).active).toBe(true)
  })
})
