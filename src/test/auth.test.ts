import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { PATCH as availabilityRota } from '@/app/api/admin/departures/[id]/availability/route'
import { POST as duplicarRota } from '@/app/api/admin/departures/[id]/duplicate/route'
import { GET as dashboardRota } from '@/app/api/admin/dashboard/route'
import { PUT as settingsPut } from '@/app/api/admin/settings/route'
import { DELETE as arquivarTripRota, PATCH as tripPatch } from '@/app/api/admin/trips/[id]/route'
import { GET as usuariosRota } from '@/app/api/admin/users/route'
import { POST as loginRota } from '@/app/api/auth/login/route'
import { POST as logoutRota } from '@/app/api/auth/logout/route'
import { GET as meRota } from '@/app/api/auth/me/route'
import { _resetRateLimit } from '@/lib/api/rate-limit'
import { gerarHash } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'
import { sugerirProximaData } from '@/server/services/admin/departure-admin-service'
import { criarFixtures, limparBanco, post, type Fixtures } from '@/test/fixtures'

const SENHA_OWNER = 'senha-de-teste-owner'
const SENHA_ADMIN = 'senha-de-teste-admin'

let f: Fixtures

beforeEach(async () => {
  await limparBanco()
  _resetRateLimit()
  f = await criarFixtures()

  await prisma.user.createMany({
    data: [
      {
        name: 'Dono da Caqui',
        email: 'owner@caqui.test',
        passwordHash: await gerarHash(SENHA_OWNER),
        role: 'OWNER',
      },
      {
        name: 'Guia Admin',
        email: 'admin@caqui.test',
        passwordHash: await gerarHash(SENHA_ADMIN),
        role: 'ADMIN',
      },
    ],
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Faz login e devolve o cookie de sessão para reusar nas requisições. */
async function logar(email: string, senha: string): Promise<string> {
  const res = await loginRota(post('/api/auth/login', { email, senha }) as never)
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error(`login falhou: ${res.status} ${await res.text()}`)
  return setCookie.split(';')[0] ?? ''
}

function comSessao(url: string, cookie: string, corpo?: unknown, metodo = 'POST'): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', cookie },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
}

function semSessao(url: string, corpo?: unknown, metodo = 'POST'): Request {
  // GET e HEAD não podem ter corpo — a spec do Fetch rejeita.
  const podeTerCorpo = metodo !== 'GET' && metodo !== 'HEAD'
  return new Request(`http://localhost:3000${url}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    ...(corpo !== undefined && podeTerCorpo ? { body: JSON.stringify(corpo) } : {}),
  })
}

function ctx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}

// =============================================================================
describe('Login', () => {
  it('rejeita senha errada com 401 INVALID_CREDENTIALS', async () => {
    const res = await loginRota(
      post('/api/auth/login', { email: 'owner@caqui.test', senha: 'errada' }) as never,
    )
    const corpo = (await res.json()) as { error: { code: string } }

    expect(res.status).toBe(401)
    expect(corpo.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('dá a MESMA resposta para e-mail inexistente — não revela se a conta existe', async () => {
    const inexistente = await loginRota(
      post('/api/auth/login', { email: 'ninguem@caqui.test', senha: 'x' }) as never,
    )
    const corpoInexistente = (await inexistente.json()) as {
      error: { code: string; message: string }
    }

    const senhaErrada = await loginRota(
      post('/api/auth/login', { email: 'owner@caqui.test', senha: 'errada' }) as never,
    )
    const corpoSenhaErrada = (await senhaErrada.json()) as {
      error: { code: string; message: string }
    }

    expect(inexistente.status).toBe(senhaErrada.status)
    expect(corpoInexistente.error.code).toBe(corpoSenhaErrada.error.code)
    expect(corpoInexistente.error.message).toBe(corpoSenhaErrada.error.message)
  })

  it('bloqueia a conta após 5 tentativas, no BANCO — não no navegador', async () => {
    for (let i = 0; i < 4; i++) {
      const r = await loginRota(
        post('/api/auth/login', { email: 'owner@caqui.test', senha: 'errada' }) as never,
      )
      expect(r.status).toBe(401)
    }

    const quinta = await loginRota(
      post('/api/auth/login', { email: 'owner@caqui.test', senha: 'errada' }) as never,
    )
    expect(quinta.status).toBe(423)
    expect(((await quinta.json()) as { error: { code: string } }).error.code).toBe('ACCOUNT_LOCKED')

    // O bloqueio persiste no banco: não adianta o cliente limpar nada.
    const usuario = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@caqui.test' } })
    expect(usuario.lockedUntil).toBeInstanceOf(Date)

    // E agora nem a senha CERTA passa, enquanto o bloqueio durar.
    const comSenhaCerta = await loginRota(
      post('/api/auth/login', { email: 'owner@caqui.test', senha: SENHA_OWNER }) as never,
    )
    expect(comSenhaCerta.status).toBe(423)
  })

  it('login bem-sucedido devolve cookie httpOnly, sem token no corpo', async () => {
    const res = await loginRota(
      post('/api/auth/login', { email: 'owner@caqui.test', senha: SENHA_OWNER }) as never,
    )
    const setCookie = res.headers.get('set-cookie') ?? ''
    const corpo = await res.text()

    expect(res.status).toBe(200)
    expect(setCookie).toContain('caqui_sessao=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=strict')
    // O token não pode aparecer no corpo: se aparecesse, o front seria tentado
    // a guardá-lo em localStorage — que é exatamente o vetor que evitamos.
    expect(corpo).not.toContain('eyJ')
  })

  it('zera o contador de falhas depois de um login válido', async () => {
    await loginRota(
      post('/api/auth/login', { email: 'owner@caqui.test', senha: 'errada' }) as never,
    )
    await loginRota(
      post('/api/auth/login', { email: 'owner@caqui.test', senha: SENHA_OWNER }) as never,
    )

    const usuario = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@caqui.test' } })
    expect(usuario.failedLoginAttempts).toBe(0)
    expect(usuario.lastLoginAt).toBeInstanceOf(Date)
  })
})

// =============================================================================
describe('Sessão', () => {
  it('GET /api/auth/me sem cookie devolve 401, não 403', async () => {
    const res = await meRota(semSessao('/api/auth/me', undefined, 'GET'))
    const corpo = (await res.json()) as { error: { code: string } }

    expect(res.status).toBe(401)
    expect(corpo.error.code).toBe('UNAUTHENTICATED')
  })

  it('logout invalida o token no SERVIDOR, não só no navegador', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)

    expect((await meRota(comSessao('/api/auth/me', cookie, undefined, 'GET'))).status).toBe(200)

    await logoutRota(comSessao('/api/auth/logout', cookie))

    // O MESMO cookie, ainda com assinatura válida, agora é recusado — porque o
    // tokenVersion mudou no banco. É a diferença entre sair de verdade e só
    // apagar o próprio localStorage.
    const depois = await meRota(comSessao('/api/auth/me', cookie, undefined, 'GET'))
    expect(depois.status).toBe(401)
  })

  it('sessão de usuário desativado para de valer na hora', async () => {
    const cookie = await logar('admin@caqui.test', SENHA_ADMIN)
    expect((await meRota(comSessao('/api/auth/me', cookie, undefined, 'GET'))).status).toBe(200)

    await prisma.user.update({ where: { email: 'admin@caqui.test' }, data: { active: false } })

    expect((await meRota(comSessao('/api/auth/me', cookie, undefined, 'GET'))).status).toBe(401)
  })

  it('token assinado com outro segredo é recusado', async () => {
    const falso =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwicm9sZSI6Ik9XTkVSIiwidHYiOjB9.assinatura-invalida'
    const res = await meRota(comSessao('/api/auth/me', `caqui_sessao=${falso}`, undefined, 'GET'))
    expect(res.status).toBe(401)
  })
})

// =============================================================================
describe('Matriz de permissões', () => {
  it('ADMIN não acessa a gestão de usuários — 403, não 401', async () => {
    const cookie = await logar('admin@caqui.test', SENHA_ADMIN)
    const res = await usuariosRota(comSessao('/api/admin/users', cookie, undefined, 'GET'))
    const corpo = (await res.json()) as { error: { code: string } }

    expect(res.status).toBe(403)
    expect(corpo.error.code).toBe('FORBIDDEN')
  })

  it('OWNER acessa a gestão de usuários', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)
    const res = await usuariosRota(comSessao('/api/admin/users', cookie, undefined, 'GET'))

    expect(res.status).toBe(200)
  })

  it('a listagem de usuários nunca devolve passwordHash', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)
    const res = await usuariosRota(comSessao('/api/admin/users', cookie, undefined, 'GET'))
    const texto = await res.text()

    expect(texto).not.toContain('passwordHash')
    expect(texto).not.toContain('$2b$')
  })

  it('ADMIN não arquiva roteiro (só OWNER)', async () => {
    const cookie = await logar('admin@caqui.test', SENHA_ADMIN)
    const res = await arquivarTripRota(
      comSessao(`/api/admin/trips/${f.trip.id}`, cookie, undefined, 'DELETE'),
      ctx({ id: String(f.trip.id) }),
    )

    expect(res.status).toBe(403)
  })

  it('ADMIN muda disponibilidade — é operação de rotina', async () => {
    const cookie = await logar('admin@caqui.test', SENHA_ADMIN)
    const res = await availabilityRota(
      comSessao(
        `/api/admin/departures/${f.saidaDisponivel.id}/availability`,
        cookie,
        { disponibilidade: 'LAST_SPOTS' },
        'PATCH',
      ),
      ctx({ id: String(f.saidaDisponivel.id) }),
    )

    expect(res.status).toBe(200)
  })
})

// =============================================================================
describe('TODA rota admin exige sessão — varredura do diretório', () => {
  /**
   * Percorre `src/app/api/admin` no disco e testa cada método exportado.
   *
   * É o teste que o projeto de referência não tinha: lá, uma rota nova nascia
   * pública por esquecimento e ninguém descobria até vazar. Aqui, esquecer o
   * guard em qualquer rota futura faz este teste falhar sozinho.
   */
  function encontrarRotas(dir: string, encontradas: string[] = []): string[] {
    for (const entrada of readdirSync(dir)) {
      const caminho = path.join(dir, entrada)
      if (statSync(caminho).isDirectory()) encontrarRotas(caminho, encontradas)
      else if (entrada === 'route.ts') encontradas.push(caminho)
    }
    return encontradas
  }

  const raiz = path.resolve(import.meta.dirname, '../app/api/admin')
  const arquivos = encontrarRotas(raiz)

  it('encontrou rotas admin para testar', () => {
    expect(arquivos.length).toBeGreaterThan(0)
  })

  for (const arquivo of arquivos) {
    const relativo = path.relative(raiz, arquivo).replace(/\/route\.ts$/, '')

    it(`/api/admin/${relativo} recusa acesso sem sessão`, async () => {
      const modulo = (await import(/* @vite-ignore */ arquivo)) as Record<
        string,
        ((req: Request, ctx?: unknown) => Promise<Response>) | undefined
      >

      const metodos = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
      let testados = 0

      for (const metodo of metodos) {
        const handler = modulo[metodo]
        if (typeof handler !== 'function') continue

        testados++
        const res = await handler(semSessao(`/api/admin/${relativo}`, {}, metodo), ctx({ id: '1' }))

        expect(
          res.status,
          `${metodo} /api/admin/${relativo} deveria recusar sem sessão, mas devolveu ${res.status}`,
        ).toBe(401)
      }

      expect(testados).toBeGreaterThan(0)
    })
  }
})

// =============================================================================
describe('Operações do CRM', () => {
  it('mudar disponibilidade grava histórico E auditoria, na mesma transação', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)

    await availabilityRota(
      comSessao(
        `/api/admin/departures/${f.saidaDisponivel.id}/availability`,
        cookie,
        { disponibilidade: 'SOLD_OUT', motivo: 'Lotou no WhatsApp' },
        'PATCH',
      ),
      ctx({ id: String(f.saidaDisponivel.id) }),
    )

    const historico = await prisma.departureAvailabilityChange.findFirstOrThrow({
      where: { departureId: f.saidaDisponivel.id },
    })
    expect(historico.from).toBe('AVAILABLE')
    expect(historico.to).toBe('SOLD_OUT')
    expect(historico.reason).toBe('Lotou no WhatsApp')

    const auditoria = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'Departure', action: 'departure.availability' },
    })
    expect(auditoria.userId).not.toBeNull()
    expect(auditoria.before).toEqual({ availability: 'AVAILABLE' })
  })

  it('duplicar saída sugere a data equivalente e nasce em DRAFT e AVAILABLE', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)

    // A saída de fixture está esgotada de propósito: a cópia NÃO pode herdar
    // isso, senão a agenda nova nasce anunciando esgotado.
    const res = await duplicarRota(
      comSessao(`/api/admin/departures/${f.saidaEsgotada.id}/duplicate`, cookie, {}),
      ctx({ id: String(f.saidaEsgotada.id) }),
    )
    const corpo = (await res.json()) as { data: { id: number } }

    expect(res.status).toBe(200)

    const nova = await prisma.departure.findUniqueOrThrow({ where: { id: corpo.data.id } })
    expect(nova.status).toBe('DRAFT')
    expect(nova.availability).toBe('AVAILABLE')
    expect(nova.priceCents).toBe(f.saidaEsgotada.priceCents)
    expect(nova.startAt.getTime()).toBeGreaterThan(f.saidaEsgotada.startAt.getTime())
  })

  it('duplicar duas vezes para a mesma data devolve 409, não erro de constraint', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)
    const req = (): Request =>
      comSessao(`/api/admin/departures/${f.saidaDisponivel.id}/duplicate`, cookie, {})

    expect((await duplicarRota(req(), ctx({ id: String(f.saidaDisponivel.id) }))).status).toBe(200)

    const segunda = await duplicarRota(req(), ctx({ id: String(f.saidaDisponivel.id) }))
    const corpo = (await segunda.json()) as { error: { code: string } }

    expect(segunda.status).toBe(409)
    expect(corpo.error.code).toBe('CONFLICT')
  })

  it('sugerirProximaData mantém o dia da semana e a posição no mês', () => {
    // 15/08/2026 é o 3º sábado de agosto. O equivalente em setembro é o
    // 3º sábado, dia 19 — não "+30 dias", que cairia numa segunda.
    const original = new Date('2026-08-15T06:00:00-03:00')
    const proxima = sugerirProximaData(original)

    const emSP = (d: Date): string =>
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)

    expect(emSP(proxima)).toContain('sábado')
    expect(emSP(proxima)).toContain('19/09')
    // O horário local é preservado: nascer do sol às 03:00 continua às 03:00.
    expect(emSP(proxima)).toContain('06:00')
  })

  it('settings recusa placeholder desconhecido no template do WhatsApp', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)
    const res = await settingsPut(
      comSessao(
        '/api/admin/settings',
        cookie,
        { whatsappMessageTemplate: 'Olá! {{iten}} custa {{total}}' },
        'PUT',
      ),
    )
    const corpo = (await res.json()) as { error: { code: string; message: string } }

    expect(res.status).toBe(400)
    expect(corpo.error.message).toContain('{{iten}}')
  })

  it('editar roteiro grava auditoria com before e after', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)

    await tripPatch(
      comSessao(`/api/admin/trips/${f.trip.id}`, cookie, { title: 'Título Novo' }, 'PATCH'),
      ctx({ id: String(f.trip.id) }),
    )

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'Trip', action: 'trip.update' },
    })
    expect(log.before).toMatchObject({ title: 'Trilha de Teste' })
    expect(log.after).toMatchObject({ title: 'Título Novo' })
  })

  it('dashboard alerta sobre saída próxima ainda aberta e roteiro sem agenda', async () => {
    const cookie = await logar('owner@caqui.test', SENHA_OWNER)

    // Saída daqui a 3 dias, publicada e ainda como "vagas abertas".
    await prisma.departure.create({
      data: {
        tripId: f.trip.id,
        startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        priceCents: 10_000,
        availability: 'AVAILABLE',
        status: 'PUBLISHED',
      },
    })

    const res = await dashboardRota(comSessao('/api/admin/dashboard', cookie, undefined, 'GET'))
    const corpo = (await res.json()) as {
      data: { alertas: { saidasProximasAindaAbertas: unknown[] } }
    }

    expect(res.status).toBe(200)
    expect(corpo.data.alertas.saidasProximasAindaAbertas).toHaveLength(1)
  })
})
