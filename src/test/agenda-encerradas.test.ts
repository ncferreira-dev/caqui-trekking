import { beforeEach, describe, expect, it } from 'vitest'

import { GET as agendaRota } from '@/app/api/departures/route'
import { montarMensagem } from '@/lib/carrinho/mensagem'
import {
  PLACEHOLDERS_VALIDOS,
  validarTemplate,
} from '@/server/services/admin/content-admin-service'
import { chaveMes } from '@/lib/datetime'
import { criarFixtures, get, limparBanco, type Fixtures } from './fixtures'

/**
 * DOIS DEFEITOS QUE MENTEM PARA QUEM CONSOME.
 *
 * Nasceram falhando em 18/08/2026.
 */
describe('GET /api/departures — o filtro de encerradas manda, sempre', () => {
  let f: Fixtures

  beforeEach(async () => {
    await limparBanco()
    f = await criarFixtures()
  })

  async function buscar(query: string) {
    const res = await agendaRota(get(`/api/departures${query}`) as never)
    const corpo = (await res.json()) as { data: { id: number; encerrada: boolean }[] }
    return corpo.data
  }

  it('com ?mes= no mês corrente, a saída que já passou NÃO volta', async () => {
    // ════════════════════════════════════════════════════════════════════
    // O DEFEITO
    // ════════════════════════════════════════════════════════════════════
    // O serviço decidia o limite inferior assim:
    //
    //   incluirEncerradas ? filtros.de : (filtros.de ?? agora)
    //
    // Ou seja: mandando `de`, o `agora` era descartado e `incluirEncerradas`
    // parava de significar qualquer coisa. E `?mes=` é açúcar que SEMPRE
    // produz `de`. Resultado: `/api/departures?mes=<mês corrente>` devolvia as
    // saídas que já aconteceram, contra o que a própria rota documenta.
    //
    // Quem consome a rota e confia no padrão publica data vencida.
    const mesDaSaidaPassada = chaveMes(f.saidaPassada.startAt)
    const saidas = await buscar(`?mes=${mesDaSaidaPassada}`)

    expect(saidas.map((s) => s.id)).not.toContain(f.saidaPassada.id)
    expect(saidas.every((s) => !s.encerrada)).toBe(true)
  })

  it('com ?incluirEncerradas=true ela volta, marcada', async () => {
    const mesDaSaidaPassada = chaveMes(f.saidaPassada.startAt)
    const saidas = await buscar(`?mes=${mesDaSaidaPassada}&incluirEncerradas=true`)

    const passada = saidas.find((s) => s.id === f.saidaPassada.id)
    expect(passada).toBeDefined()
    expect(passada?.encerrada).toBe(true)
  })

  it('um `de` no passado também não fura o padrão', async () => {
    // Mesma classe, pela outra porta: `?de=` explícito em vez de `?mes=`.
    const saidas = await buscar('?de=2020-01-01T00:00:00.000Z')
    expect(saidas.map((s) => s.id)).not.toContain(f.saidaPassada.id)
  })

  it('um `de` no FUTURO continua valendo, e não é rebaixado para agora', async () => {
    // O conserto não pode virar "ignore o `de`": quem pede a partir de daqui a
    // dois meses tem que receber a partir dali.
    const daquiADoisMeses = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
    const saidas = await buscar(`?de=${daquiADoisMeses}`)
    expect(saidas.map((s) => s.id)).not.toContain(f.saidaDisponivel.id)
    expect(saidas.map((s) => s.id)).toContain(f.saidaEsgotada.id)
  })
})

describe('template do WhatsApp — nenhum marcador chega ao cliente', () => {
  it('{{cliente}} não é mais um placeholder válido', () => {
    // ════════════════════════════════════════════════════════════════════
    // O DEFEITO
    // ════════════════════════════════════════════════════════════════════
    // `{{cliente}}` estava na lista de válidos, o editor do CRM o oferecia
    // como opção, e `montarMensagem` nunca o substituía — porque o nome do
    // cliente NÃO EXISTE em lugar nenhum deste fluxo: o site não pede nome, a
    // mochila não tem cadastro, e o primeiro contato É o WhatsApp.
    //
    // Consequência: bastava a Caqui aceitar o convite do próprio painel para
    // toda mensagem do site sair com "Olá {{cliente}}" literal.
    //
    // O conserto é tirar a promessa, não inventar o dado.
    expect(PLACEHOLDERS_VALIDOS).not.toContain('{{cliente}}')
    expect(validarTemplate('Olá {{cliente}}! {{itens}} {{total}}')).toEqual(['{{cliente}}'])
  })

  it('marcador desconhecido que sobreviva no template é apagado da mensagem', () => {
    // A trava do CRM impede salvar. Esta é a segunda rede, para o template que
    // já estava no banco antes da trava, ou que entrou por migração. O pior
    // resultado possível é o cliente receber `{{cliente}}` escrito.
    const texto = montarMensagem('Olá {{cliente}}! {{itens}}\n\n*Total: {{total}}*', {
      itens: [],
      totalCentavos: 0,
      temDivergencia: false,
    } as never)

    expect(texto).not.toContain('{{')
    expect(texto).not.toContain('}}')
    expect(texto).toContain('Olá')
  })
})
