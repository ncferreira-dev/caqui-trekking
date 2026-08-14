import type { Metadata } from 'next'
import Link from 'next/link'

import { CardSaida } from '@/components/catalogo/card-saida'
import { FiltrosAgenda, faixaDePreco } from '@/components/catalogo/filtros-agenda'
import { JsonLdScript } from '@/components/seo/json-ld'
import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { LinkBotao } from '@/components/ui/button'
import { listaDaAgenda } from '@/lib/seo/json-ld'
import { URL_BASE } from '@/lib/seo/site'
import { chaveMesSchema, dificuldadeSchema, slugSchema } from '@/lib/api/schemas'
import { chaveMes, deslocarMes, inicioDoMes, intervaloDoMes, mesPorExtenso } from '@/lib/datetime'
import { listarDepartures, opcoesDeAgenda } from '@/server/services/departure-service'
import type { ItemAgendaDTO } from '@/server/services/departure-service'
import { metadataDaPagina } from '@/lib/seo/metadata'

export const metadata: Metadata = metadataDaPagina({
  titulo: 'Agenda',
  descricao: 'Próximas saídas da Caqui Trekking, com data, dificuldade, duração e disponibilidade.',
  caminho: '/agenda',
})

/**
 * A agenda — a página central do site.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A JANELA COMEÇA NO 1º DO MÊS, NÃO EM "AGORA"
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing pede que a saída encerrada não suma: ela é prova social. Mas
 * "todas as saídas de todos os tempos" empurra as datas futuras para baixo da
 * dobra, e a página que existe para vender vaga passa a mostrar primeiro o que
 * não se pode comprar.
 *
 * A janela padrão é o MÊS CORRENTE em diante. Quem entra dia 20 continua vendo
 * as três saídas que já aconteceram no dia 5, no 12 e no 18 — o mês não fica
 * pela metade, e a prova social de quem chega no fim do mês é a mais forte que
 * existe: "isto aqui está rodando". O histórico completo fica atrás de um
 * link, `?passadas=1`, que estende a janela em 12 meses.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DENTRO DO MÊS, O QUE JÁ PASSOU VAI PARA O FIM
 * ────────────────────────────────────────────────────────────────────────────
 * A ordem cronológica pura colocaria os cards esmaecidos no topo do mês
 * corrente. Aqui cada mês é dividido em dois blocos — o que ainda vai
 * acontecer, e depois "já realizadas" — e a cronologia vale DENTRO de cada
 * bloco. É a única quebra de cronologia da página, e ela existe porque a
 * primeira coisa visível tem que ser uma data que ainda dá para comprar.
 */
export default async function PaginaAgenda({ searchParams }: PageProps<'/agenda'>) {
  const params = await searchParams

  // ──────────────────────────────────────────────────────────────────────────
  // A QUERY STRING É ENTRADA NÃO CONFIÁVEL AQUI TAMBÉM
  // ──────────────────────────────────────────────────────────────────────────
  // `GET /api/departures` valida estes mesmos parâmetros com estes mesmos
  // schemas. Esta página consome o SERVIÇO direto, sem passar pela rota HTTP —
  // e por isso pulava a validação inteira.
  //
  // O custo era 500, não filtro errado: `?mes=abc` chega em `intervaloDoMes`,
  // vira `Invalid Date` e o `Intl` lança `RangeError` no meio do render do
  // Server Component; `?dificuldade=xyz` entra no `where` do Prisma, que
  // valida enum em runtime e recusa. Um link velho ou um crawler derrubava a
  // página central do site.
  //
  // `.data` sai `undefined` quando o parse falha — inclusive para `undefined`.
  // Então valor inválido degrada para "filtro ignorado", que é exatamente o
  // que o estado vazio desta página já sabe tratar.
  const mes = chaveMesSchema.safeParse(texto(params['mes'])).data
  const dificuldade = dificuldadeSchema.safeParse(texto(params['dificuldade'])).data
  const atividade = slugSchema.safeParse(texto(params['atividade'])).data
  const preco = texto(params['preco'])
  const passadas = texto(params['passadas']) === '1'

  const agora = new Date()
  const inicioDoMesAtual = inicioDoMes(agora)

  // 12 meses para trás é o histórico útil: cobre a temporada inteira e o
  // mesmo feriado do ano passado, sem virar arquivo morto.
  //
  // `deslocarMes` e não `- 365 * 24 * 60 * 60 * 1000`: "12 meses" e "365 dias"
  // são coisas diferentes em ano bissexto, e a janela começaria no meio de um
  // mês em vez de no dia 1º.
  const inicioDaJanela = passadas
    ? intervaloDoMes(deslocarMes(chaveMes(agora), -12)).de
    : inicioDoMesAtual

  // O filtro de mês é mais específico que a janela: escolher "março" quando a
  // janela começa em agosto tem que devolver março, não vazio.
  const janelaDoMes = mes ? intervaloDoMes(mes) : null
  const faixa = faixaDePreco(preco)

  const [{ saidas, total }, opcoes] = await Promise.all([
    listarDepartures({
      de: janelaDoMes?.de ?? inicioDaJanela,
      ate: janelaDoMes?.ate,
      incluirEncerradas: true,
      dificuldade,
      tag: atividade,
      precoMinCentavos: faixa?.min,
      precoMaxCentavos: faixa?.max,
      limit: 60,
      offset: 0,
    }),
    opcoesDeAgenda(inicioDaJanela),
  ])

  const grupos = agruparPorMes(saidas)
  const futurasNaVista = saidas.filter((s) => !s.encerrada).length

  // A agenda como lista ordenada de saídas — só as futuras, que é o que a
  // página promete. O `Event` completo de cada uma vive na página do roteiro.
  const naoEncerradas = saidas.filter((s) => !s.encerrada)

  return (
    <>
      {naoEncerradas.length > 0 && (
        <JsonLdScript dados={listaDaAgenda(URL_BASE, naoEncerradas)} />
      )}

      <CabecalhoDePagina
        sobretitulo="Próximas saídas"
        titulo="Agenda"
        descricao="Toda saída tem data, guia e ponto de encontro definidos. A vaga é confirmada na conversa do WhatsApp."
        cota={`${futurasNaVista} ${futurasNaVista === 1 ? 'data' : 'datas'}`}
      />

      <FiltrosAgenda
        opcoes={opcoes}
        valores={{ mes, dificuldade, atividade, preco, passadas }}
        totalFiltrado={total}
      />

      <section className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        {grupos.length === 0 ? (
          <AgendaVazia comFiltro={Boolean(mes ?? dificuldade ?? atividade ?? preco)} />
        ) : (
          <div className="flex flex-col gap-16">
            {grupos.map((grupo) => (
              <section key={grupo.chave} aria-labelledby={`mes-${grupo.chave}`}>
                <div className="border-caqui-rule-forte mb-6 flex items-baseline justify-between gap-4 border-b pb-2">
                  <h2 id={`mes-${grupo.chave}`} className="text-display-m uppercase">
                    {mesPorExtenso(grupo.chave)}
                  </h2>
                  <span className="text-caqui-ink-500 text-rotulo font-mono uppercase">
                    {grupo.saidas.length} {grupo.saidas.length === 1 ? 'saída' : 'saídas'}
                  </span>
                </div>

                {grupo.futuras.length > 0 && (
                  <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.futuras.map((saida, indice) => (
                      <li key={saida.id}>
                        <CardSaida saida={saida} prioridade={indice === 0} />
                      </li>
                    ))}
                  </ul>
                )}

                {grupo.encerradas.length > 0 && (
                  <>
                    <p className="border-caqui-rule text-caqui-ink-500 text-rotulo mt-10 border-t pt-4 font-mono uppercase">
                      Já realizadas
                    </p>
                    <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                      {grupo.encerradas.map((saida) => (
                        <li key={saida.id}>
                          <CardSaida saida={saida} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ))}
          </div>
        )}

        <p className="border-caqui-rule mt-16 border-t pt-6">
          <Link
            href={passadas ? '/agenda' : '/agenda?passadas=1'}
            className="text-caqui-ink-700 text-rotulo hover:text-caqui-ink-900 rounded-xs font-mono uppercase underline underline-offset-4"
          >
            {passadas ? 'Ver só a agenda atual' : 'Ver saídas dos últimos 12 meses'}
          </Link>
        </p>
      </section>
    </>
  )
}

/**
 * O estado vazio.
 *
 * Duas telas diferentes, porque são dois problemas diferentes. "Nenhum
 * resultado" com um filtro aplicado é culpa do filtro, e a saída é afrouxá-lo.
 * Sem filtro nenhum, é a agenda que está vazia, e aí a saída é o WhatsApp —
 * mandar a pessoa "limpar os filtros" que ela não pôs seria zombaria.
 */
function AgendaVazia({ comFiltro }: { comFiltro: boolean }) {
  return (
    <div className="border-caqui-rule chanfro-md mx-auto max-w-xl border bg-white px-6 py-12 text-center">
      <p className="text-caqui-ink-500 text-rotulo font-mono uppercase">
        {comFiltro ? 'Nada com esses filtros' : 'Agenda em montagem'}
      </p>

      <h2 className="text-display-s mt-3 uppercase">
        {comFiltro ? 'Nenhuma saída bate com a busca' : 'Nenhuma data publicada'}
      </h2>

      <p className="text-caqui-ink-700 text-corpo mt-4">
        {comFiltro
          ? 'Tente um mês diferente, ou tire a dificuldade e a atividade para ver a agenda inteira. As datas costumam sair na virada do mês.'
          : 'A agenda do mês costuma sair na virada. Enquanto isso, dá para montar saída fechada para o seu grupo. É só chamar.'}
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {comFiltro ? (
          <>
            <LinkBotao href="/agenda">Ver a agenda inteira</LinkBotao>
            <LinkBotao href="/trekking" variante="secondary">
              Ver os roteiros
            </LinkBotao>
          </>
        ) : (
          <>
            <LinkBotao href="/trekking">Ver os roteiros</LinkBotao>
            <LinkBotao href="/contato" variante="secondary">
              Falar com a Caqui
            </LinkBotao>
          </>
        )}
      </div>
    </div>
  )
}

type GrupoDeMes = {
  chave: string
  saidas: ItemAgendaDTO[]
  futuras: ItemAgendaDTO[]
  encerradas: ItemAgendaDTO[]
}

/**
 * Agrupa preservando a ordem de chegada.
 *
 * `Map` e não objeto: as chaves são "2026-08", que um objeto reordenaria como
 * string — e um `Object.keys` de chaves numéricas embaralharia a cronologia.
 * O serviço já devolve ordenado por `startAt`, então a ordem de inserção do
 * `Map` É a ordem certa.
 */
function agruparPorMes(saidas: ItemAgendaDTO[]): GrupoDeMes[] {
  const porMes = new Map<string, ItemAgendaDTO[]>()

  for (const saida of saidas) {
    const chave = saida.mes || chaveMes(new Date(saida.inicioUtc))
    const lista = porMes.get(chave)
    if (lista) lista.push(saida)
    else porMes.set(chave, [saida])
  }

  return [...porMes.entries()].map(([chave, lista]) => ({
    chave,
    saidas: lista,
    futuras: lista.filter((s) => !s.encerrada),
    encerradas: lista.filter((s) => s.encerrada),
  }))
}

/** Query string repetida (`?mes=a&mes=b`) chega como array. Vale a primeira. */
function texto(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0]
  return valor === '' ? undefined : valor
}
