import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { GET as getDeparture } from '@/app/api/departures/[id]/route'
import { GET as listarDeparturesRota } from '@/app/api/departures/route'
import { GET as listarGuiasRota } from '@/app/api/guides/route'
import { POST as criarLeadRota } from '@/app/api/leads/route'
import { GET as getProduto } from '@/app/api/products/[slug]/route'
import { GET as listarProdutosRota } from '@/app/api/products/route'
import { GET as getSettings } from '@/app/api/settings/route'
import { GET as getTrip } from '@/app/api/trips/[slug]/route'
import { GET as listarTripsRota } from '@/app/api/trips/route'
import { POST as validarCarrinhoRota } from '@/app/api/cart/validate/route'
import { POST as criarContatoRota } from '@/app/api/contact/route'
import { _resetRateLimit } from '@/lib/api/rate-limit'
import { chaveMes } from '@/lib/datetime'
import { prisma } from '@/lib/prisma'
import { opcoesDeAgenda } from '@/server/services/departure-service'
import { criarFixtures, get, limparBanco, post, type Fixtures } from '@/test/fixtures'

let f: Fixtures

beforeAll(async () => {
  await limparBanco()
})

beforeEach(async () => {
  await limparBanco()
  _resetRateLimit()
  f = await criarFixtures()
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Chama um handler de rota dinâmica com os params já resolvidos. */
function ctx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}

// =============================================================================
describe('GET /api/trips', () => {
  it('devolve roteiros publicados com a próxima saída', async () => {
    const res = await listarTripsRota(get('/api/trips') as never)
    const corpo = (await res.json()) as {
      data: { slug: string; proximaSaida: { precoCentavos: number } | null }[]
    }

    expect(res.status).toBe(200)
    expect(corpo.data).toHaveLength(1)
    expect(corpo.data[0]?.slug).toBe('trilha-de-teste')
    // A próxima é a de daqui a um mês (R$ 90), não a de dois meses nem a passada.
    expect(corpo.data[0]?.proximaSaida?.precoCentavos).toBe(9_000)
  })

  it('não devolve roteiro em rascunho', async () => {
    const res = await listarTripsRota(get('/api/trips') as never)
    const corpo = (await res.json()) as { data: { slug: string }[] }

    expect(corpo.data.map((t) => t.slug)).not.toContain('trilha-rascunho')
  })

  it('filtra por faixa de preço sobre as saídas', async () => {
    const semResultado = await listarTripsRota(get('/api/trips?precoMin=20000') as never)
    expect(((await semResultado.json()) as { data: unknown[] }).data).toHaveLength(0)

    const comResultado = await listarTripsRota(
      get('/api/trips?precoMin=8000&precoMax=10000') as never,
    )
    expect(((await comResultado.json()) as { data: unknown[] }).data).toHaveLength(1)
  })

  it('rejeita limit acima do teto com 400 e detalhe por campo', async () => {
    const res = await listarTripsRota(get('/api/trips?limit=9999') as never)
    const corpo = (await res.json()) as { error: { code: string; details?: { field: string }[] } }

    expect(res.status).toBe(400)
    expect(corpo.error.code).toBe('VALIDATION_FAILED')
    expect(corpo.error.details?.[0]?.field).toBe('limit')
  })
})

// =============================================================================
describe('GET /api/trips/:slug', () => {
  it('devolve o detalhe com saídas futuras e guias', async () => {
    const res = await getTrip(get('/api/trips/trilha-de-teste'), ctx({ slug: 'trilha-de-teste' }))
    const corpo = (await res.json()) as {
      data: { saidas: unknown[]; guias: unknown[]; oQueLevar: string[] }
    }

    expect(res.status).toBe(200)
    // Só as duas futuras. A passada não entra no detalhe.
    expect(corpo.data.saidas).toHaveLength(2)
    expect(corpo.data.guias).toHaveLength(1)
    expect(corpo.data.oQueLevar).toEqual(['Água'])
  })

  it('devolve 404 TRIP_NOT_FOUND para slug inexistente', async () => {
    const res = await getTrip(get('/api/trips/nao-existe'), ctx({ slug: 'nao-existe' }))
    const corpo = (await res.json()) as { error: { code: string } }

    expect(res.status).toBe(404)
    expect(corpo.error.code).toBe('TRIP_NOT_FOUND')
  })

  it('devolve 404 para roteiro em rascunho', async () => {
    const res = await getTrip(get('/api/trips/trilha-rascunho'), ctx({ slug: 'trilha-rascunho' }))
    expect(res.status).toBe(404)
  })
})

// =============================================================================
describe('GET /api/departures — a agenda', () => {
  it('por padrão devolve só as saídas futuras', async () => {
    const res = await listarDeparturesRota(get('/api/departures') as never)
    const corpo = (await res.json()) as { data: { encerrada: boolean }[] }

    expect(corpo.data).toHaveLength(2)
    expect(corpo.data.every((s) => !s.encerrada)).toBe(true)
  })

  it('com incluirEncerradas=true traz a passada marcada como encerrada', async () => {
    const res = await listarDeparturesRota(get('/api/departures?incluirEncerradas=true') as never)
    const corpo = (await res.json()) as { data: { encerrada: boolean }[] }

    expect(corpo.data).toHaveLength(3)
    expect(corpo.data.filter((s) => s.encerrada)).toHaveLength(1)
  })

  it('não devolve saída de roteiro em rascunho', async () => {
    const res = await listarDeparturesRota(get('/api/departures?incluirEncerradas=true') as never)
    const corpo = (await res.json()) as { data: { trip: { slug: string } }[] }

    expect(corpo.data.map((s) => s.trip.slug)).not.toContain('trilha-rascunho')
  })

  it('id malformado devolve 400, não 500', async () => {
    const res = await getDeparture(get('/api/departures/abc'), ctx({ id: 'abc' }))
    const corpo = (await res.json()) as { error: { code: string } }

    expect(res.status).toBe(400)
    expect(corpo.error.code).toBe('VALIDATION_FAILED')
  })
})

// =============================================================================
describe('GET /api/departures — filtros da agenda', () => {
  it('a faixa de preço filtra a SAÍDA, não o roteiro', async () => {
    // As duas saídas futuras são do MESMO roteiro, a R$ 90 e a R$ 120. Um
    // filtro que operasse sobre a Trip devolveria as duas (ou nenhuma), porque
    // Trip não tem preço. Este teste falha se alguém mover o filtro para lá.
    const res = await listarDeparturesRota(get('/api/departures?precoMin=10000') as never)
    const corpo = (await res.json()) as { data: { id: number; precoCentavos: number }[] }

    expect(corpo.data).toHaveLength(1)
    expect(corpo.data[0]?.id).toBe(f.saidaEsgotada.id)
  })

  it('precoMax exclui a saída acima do teto', async () => {
    const res = await listarDeparturesRota(get('/api/departures?precoMax=10000') as never)
    const corpo = (await res.json()) as { data: { id: number }[] }

    expect(corpo.data.map((s) => s.id)).toEqual([f.saidaDisponivel.id])
  })

  it('filtra por dificuldade do roteiro', async () => {
    const semNada = await listarDeparturesRota(get('/api/departures?dificuldade=EXTREMO') as never)
    expect(((await semNada.json()) as { data: unknown[] }).data).toHaveLength(0)

    const comTudo = await listarDeparturesRota(get('/api/departures?dificuldade=MODERADO') as never)
    expect(((await comTudo.json()) as { data: unknown[] }).data).toHaveLength(2)
  })

  it('filtra por tag de atividade', async () => {
    const res = await listarDeparturesRota(get('/api/departures?tag=rapel') as never)
    expect(((await res.json()) as { data: unknown[] }).data).toHaveLength(2)

    const vazio = await listarDeparturesRota(get('/api/departures?tag=camping') as never)
    expect(((await vazio.json()) as { data: unknown[] }).data).toHaveLength(0)
  })

  it('o filtro de mês recorta pela chave de São Paulo', async () => {
    const chave = chaveMes(f.saidaDisponivel.startAt)
    const res = await listarDeparturesRota(
      get(`/api/departures?incluirEncerradas=true&mes=${chave}`) as never,
    )
    const corpo = (await res.json()) as { data: { id: number; mes: string }[] }

    expect(corpo.data.length).toBeGreaterThan(0)
    // Toda saída devolvida pertence ao mês pedido — inclusive as encerradas,
    // que só somem por causa da janela, nunca por causa do recorte.
    expect(corpo.data.every((s) => s.mes === chave)).toBe(true)
    expect(corpo.data.map((s) => s.id)).toContain(f.saidaDisponivel.id)
  })

  it('mês malformado devolve 400, não 500', async () => {
    // Sem o `refine` do schema, `2026-99` viraria uma data inválida lá dentro
    // e a consulta explodiria com `NaN` — 500 no lugar de 400.
    //
    // `9999-12` é o caso que passou despercebido na primeira versão: forma
    // válida e mês válido, mas `intervaloDoMes` precisa montar "10000-01", e
    // ISO exige ano expandido com sinal acima de 9999. `new Date` devolve
    // Invalid Date e o `Intl` lança RangeError — o mesmo 500 pela porta dos
    // fundos. Daí o limite de ano no schema.
    for (const valor of ['2026-99', '2026-00', 'agosto', '2026-8', '9999-12', '0001-01']) {
      const res = await listarDeparturesRota(get(`/api/departures?mes=${valor}`) as never)
      expect(res.status, valor).toBe(400)
    }
  })

  it('mês válido dentro do intervalo permitido passa', async () => {
    for (const valor of ['2000-01', '2026-08', '2100-12']) {
      const res = await listarDeparturesRota(get(`/api/departures?mes=${valor}`) as never)
      expect(res.status, valor).toBe(200)
    }
  })

  it('filtros se combinam sem se anular', async () => {
    const res = await listarDeparturesRota(
      get('/api/departures?dificuldade=MODERADO&tag=rapel&precoMax=10000') as never,
    )
    const corpo = (await res.json()) as { data: { id: number }[] }

    expect(corpo.data.map((s) => s.id)).toEqual([f.saidaDisponivel.id])
  })
})

// =============================================================================
describe('opcoesDeAgenda — os filtros só oferecem o que existe', () => {
  it('não oferece dificuldade sem saída', async () => {
    const opcoes = await opcoesDeAgenda(new Date(0))

    // O roteiro FÁCIL do fixture está em RASCUNHO. Oferecer "Fácil" no filtro
    // levaria a pessoa a um resultado vazio — que ela leria como site
    // quebrado, não como "não tem data marcada".
    expect(opcoes.dificuldades).toEqual(['MODERADO'])
  })

  it('não oferece tag sem saída publicada', async () => {
    const opcoes = await opcoesDeAgenda(new Date(0))
    expect(opcoes.tags.map((t) => t.slug)).toEqual(['rapel'])
  })

  it('conta as saídas de cada mês', async () => {
    const opcoes = await opcoesDeAgenda(new Date(0))
    const soma = opcoes.meses.reduce((total, m) => total + m.total, 0)

    // 3 publicadas do roteiro publicado: a disponível, a esgotada e a passada.
    // A saída do roteiro em rascunho não entra.
    expect(soma).toBe(3)
    expect(opcoes.meses.every((m) => /^\d{4}-\d{2}$/.test(m.chave))).toBe(true)
  })
})

// =============================================================================
describe('GET /api/products', () => {
  it('devolve variantes indisponíveis também, com o flag', async () => {
    const res = await getProduto(
      get('/api/products/camiseta-de-teste'),
      ctx({ slug: 'camiseta-de-teste' }),
    )
    const corpo = (await res.json()) as {
      data: { variantes: { tamanho: string; disponivel: boolean }[] }
    }

    expect(res.status).toBe(200)
    // As três saem. A esgotada NÃO some: a UI precisa mostrá-la desabilitada.
    expect(corpo.data.variantes).toHaveLength(3)
    expect(corpo.data.variantes.find((v) => v.tamanho === 'G')?.disponivel).toBe(false)
  })

  it('aplica o preço próprio da variante quando existe', async () => {
    const res = await getProduto(
      get('/api/products/camiseta-de-teste'),
      ctx({ slug: 'camiseta-de-teste' }),
    )
    const corpo = (await res.json()) as {
      data: { variantes: { tamanho: string; precoCentavos: number }[] }
    }

    expect(corpo.data.variantes.find((v) => v.tamanho === 'M')?.precoCentavos).toBe(5_000)
    expect(corpo.data.variantes.find((v) => v.tamanho === 'GG')?.precoCentavos).toBe(6_000)
  })

  it('filtra por categoria', async () => {
    const vazio = await listarProdutosRota(get('/api/products?categoria=MOCHILA') as never)
    expect(((await vazio.json()) as { data: unknown[] }).data).toHaveLength(0)

    const cheio = await listarProdutosRota(get('/api/products?categoria=CAMISETA') as never)
    expect(((await cheio.json()) as { data: unknown[] }).data).toHaveLength(1)
  })
})

// =============================================================================
describe('POST /api/cart/validate — o fluxo que decide a venda', () => {
  it('devolve o preço do BANCO, ignorando o que o cliente mandou', async () => {
    const res = await validarCarrinhoRota(
      post('/api/cart/validate', {
        itens: [
          {
            lineId: 'l1',
            tipo: 'DEPARTURE',
            departureId: f.saidaDisponivel.id,
            quantidade: 2,
            // O cliente diz que o preço é R$ 1,00. É o ataque exato que o
            // projeto de referência permitia via localStorage.
            precoCentavosNoCarrinho: 100,
          },
        ],
      }) as never,
    )
    const corpo = (await res.json()) as {
      data: { itens: { precoCentavos: number; motivo: string | null }[]; totalCentavos: number }
    }

    expect(res.status).toBe(200)
    expect(corpo.data.itens[0]?.precoCentavos).toBe(9_000)
    expect(corpo.data.itens[0]?.motivo).toBe('PRICE_CHANGED')
    // 2 × R$ 90,00 = R$ 180,00 — calculado no servidor, não aceito do cliente.
    expect(corpo.data.totalCentavos).toBe(18_000)
  })

  it('marca saída esgotada com DEPARTURE_NOT_AVAILABLE e não soma no total', async () => {
    const res = await validarCarrinhoRota(
      post('/api/cart/validate', {
        itens: [
          { lineId: 'l1', tipo: 'DEPARTURE', departureId: f.saidaEsgotada.id, quantidade: 1 },
        ],
      }) as never,
    )
    const corpo = (await res.json()) as {
      data: {
        itens: { motivo: string; ok: boolean }[]
        totalCentavos: number
        podeFinalizar: boolean
      }
    }

    expect(corpo.data.itens[0]?.motivo).toBe('DEPARTURE_NOT_AVAILABLE')
    expect(corpo.data.itens[0]?.ok).toBe(false)
    expect(corpo.data.totalCentavos).toBe(0)
    expect(corpo.data.podeFinalizar).toBe(false)
  })

  it('marca saída que já passou com DEPARTURE_PAST', async () => {
    const res = await validarCarrinhoRota(
      post('/api/cart/validate', {
        itens: [{ lineId: 'l1', tipo: 'DEPARTURE', departureId: f.saidaPassada.id, quantidade: 1 }],
      }) as never,
    )
    const corpo = (await res.json()) as { data: { itens: { motivo: string }[] } }

    expect(corpo.data.itens[0]?.motivo).toBe('DEPARTURE_PAST')
  })

  it('marca variante indisponível com VARIANT_UNAVAILABLE', async () => {
    const res = await validarCarrinhoRota(
      post('/api/cart/validate', {
        itens: [
          { lineId: 'l1', tipo: 'WEAR', variantId: f.varianteIndisponivel.id, quantidade: 1 },
        ],
      }) as never,
    )
    const corpo = (await res.json()) as { data: { itens: { motivo: string }[] } }

    expect(corpo.data.itens[0]?.motivo).toBe('VARIANT_UNAVAILABLE')
  })

  it('não deixa finalizar saída de roteiro despublicado', async () => {
    const res = await validarCarrinhoRota(
      post('/api/cart/validate', {
        itens: [
          { lineId: 'l1', tipo: 'DEPARTURE', departureId: f.saidaRascunho.id, quantidade: 1 },
        ],
      }) as never,
    )
    const corpo = (await res.json()) as {
      data: { itens: { motivo: string }[]; podeFinalizar: boolean }
    }

    expect(corpo.data.itens[0]?.motivo).toBe('DEPARTURE_NOT_FOUND')
    expect(corpo.data.podeFinalizar).toBe(false)
  })

  it('carrinho misto e íntegro pode finalizar, com total somado em centavos', async () => {
    const res = await validarCarrinhoRota(
      post('/api/cart/validate', {
        itens: [
          { lineId: 'l1', tipo: 'DEPARTURE', departureId: f.saidaDisponivel.id, quantidade: 2 },
          { lineId: 'l2', tipo: 'WEAR', variantId: f.varianteComPrecoProprio.id, quantidade: 1 },
        ],
      }) as never,
    )
    const corpo = (await res.json()) as {
      data: {
        podeFinalizar: boolean
        totalCentavos: number
        totalFormatado: string
        temDivergencia: boolean
      }
    }

    expect(corpo.data.podeFinalizar).toBe(true)
    expect(corpo.data.temDivergencia).toBe(false)
    // 2 × 9000 + 1 × 6000 = 24000
    expect(corpo.data.totalCentavos).toBe(24_000)
    expect(corpo.data.totalFormatado).toContain('240,00')
  })

  it('rejeita corpo sem itens com 400', async () => {
    const res = await validarCarrinhoRota(post('/api/cart/validate', { itens: [] }) as never)
    expect(res.status).toBe(400)
  })
})

// =============================================================================
describe('internalNotes NUNCA vaza na API pública', () => {
  const SEGREDO = 'SEGREDO-INTERNO-NAO-PODE-VAZAR'

  it('não aparece em nenhuma resposta pública', async () => {
    const respostas = await Promise.all([
      listarTripsRota(get('/api/trips') as never),
      getTrip(get('/api/trips/trilha-de-teste'), ctx({ slug: 'trilha-de-teste' })),
      listarDeparturesRota(get('/api/departures?incluirEncerradas=true') as never),
      getDeparture(
        get(`/api/departures/${f.saidaDisponivel.id}`),
        ctx({ id: String(f.saidaDisponivel.id) }),
      ),
      validarCarrinhoRota(
        post('/api/cart/validate', {
          itens: [
            { lineId: 'l1', tipo: 'DEPARTURE', departureId: f.saidaDisponivel.id, quantidade: 1 },
          ],
        }) as never,
      ),
    ])

    for (const res of respostas) {
      const texto = await res.text()
      expect(texto).not.toContain(SEGREDO)
      expect(texto).not.toContain('internalNotes')
    }
  })

  it('confirma que o dado REALMENTE está no banco (senão o teste acima é vazio)', async () => {
    const saida = await prisma.departure.findUniqueOrThrow({
      where: { id: f.saidaDisponivel.id },
      select: { internalNotes: true },
    })
    expect(saida.internalNotes).toBe(SEGREDO)
  })
})

// =============================================================================
describe('Rotas institucionais e de captura', () => {
  it('GET /api/settings devolve o template da mensagem', async () => {
    const res = await getSettings()
    const corpo = (await res.json()) as { data: { whatsappMessageTemplate: string } }

    expect(res.status).toBe(200)
    expect(corpo.data.whatsappMessageTemplate).toContain('{{itens}}')
  })

  it('GET /api/guides devolve guias ativos', async () => {
    const res = await listarGuiasRota()
    const corpo = (await res.json()) as { data: { nome: string }[] }

    expect(corpo.data).toHaveLength(1)
    expect(corpo.data[0]?.nome).toBe('Guia de Teste')
  })

  it('POST /api/contact grava a mensagem e devolve 201', async () => {
    const res = await criarContatoRota(
      post('/api/contact', {
        nome: 'Fulano',
        email: 'fulano@example.com',
        mensagem: 'Gostaria de saber mais sobre a trilha.',
        tripSlug: 'trilha-de-teste',
      }) as never,
    )

    expect(res.status).toBe(201)
    expect(await prisma.contactMessage.count()).toBe(1)
  })

  it('POST /api/contact aplica rate limit depois de 5 tentativas', async () => {
    const enviar = (): Promise<Response> =>
      criarContatoRota(
        post(
          '/api/contact',
          { nome: 'Fulano', mensagem: 'Mensagem de teste com tamanho suficiente.' },
          { 'x-forwarded-for': '203.0.113.10' },
        ) as never,
      )

    for (let i = 0; i < 5; i++) expect((await enviar()).status).toBe(201)

    const bloqueada = await enviar()
    const corpo = (await bloqueada.json()) as { error: { code: string } }
    expect(bloqueada.status).toBe(429)
    expect(corpo.error.code).toBe('RATE_LIMITED')
  })

  it('POST /api/leads exige consentimento explícito', async () => {
    const semConsentimento = await criarLeadRota(
      post('/api/leads', {
        email: 'a@example.com',
        origem: 'avise-me',
        consentimento: false,
      }) as never,
    )
    expect(semConsentimento.status).toBe(400)
    expect(await prisma.lead.count()).toBe(0)

    const comConsentimento = await criarLeadRota(
      post('/api/leads', {
        email: 'a@example.com',
        origem: 'avise-me',
        consentimento: true,
      }) as never,
    )
    expect(comConsentimento.status).toBe(201)

    const lead = await prisma.lead.findFirstOrThrow()
    // Grava QUANDO consentiu, não só que sim.
    expect(lead.consentAt).toBeInstanceOf(Date)
  })

  it('POST /api/leads exige ao menos email ou telefone', async () => {
    const res = await criarLeadRota(
      post('/api/leads', { origem: 'newsletter', consentimento: true }) as never,
    )
    expect(res.status).toBe(400)
  })
})
