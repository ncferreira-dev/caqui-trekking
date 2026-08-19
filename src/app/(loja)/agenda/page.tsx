import type { Metadata } from 'next'
import Link from 'next/link'

import { CalendarioDaAgenda } from '@/components/catalogo/calendario-da-agenda'
import { LinhaDeSaida } from '@/components/catalogo/linha-de-saida'
import { FiltrosAgenda, faixaDePreco, linkDaAgenda } from '@/components/catalogo/filtros-agenda'
import { JsonLdScript } from '@/components/seo/json-ld'
import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { LinkBotao } from '@/components/ui/button'
import { listaDaAgenda } from '@/lib/seo/json-ld'
import { URL_BASE } from '@/lib/seo/site'
import { chaveMesSchema, dificuldadeSchema, slugSchema } from '@/lib/api/schemas'
import { chaveDia } from '@/lib/calendario'
import { chaveMes, deslocarMes, inicioDoMes, intervaloDoMes, mesPorExtenso } from '@/lib/datetime'
import { buscarSettings } from '@/server/services/institucional-service'
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
  // Qualquer valor que não seja exatamente "calendario" cai na lista, que é a
  // vista padrão. Um `?vista=xyz` não pode produzir uma terceira coisa.
  const vista = texto(params['vista']) === 'calendario' ? 'calendario' : 'lista'

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

  // ──────────────────────────────────────────────────────────────────────────
  // O CALENDÁRIO OLHA UM MÊS DE CADA VEZ, E ISSO ESTREITA A CONSULTA
  // ──────────────────────────────────────────────────────────────────────────
  // Uma grade de calendário só sabe desenhar um mês. Sem `?mes=`, ela abre no
  // corrente. E como a janela passa a ser exatamente esse mês, a lista que
  // fica logo abaixo mostra as MESMAS saídas que a grade — que é o que faz o
  // link `#dia-2026-08-15` de cada célula ter para onde apontar.
  const mesDoCalendario = vista === 'calendario' ? (mes ?? chaveMes(agora)) : null

  // O filtro de mês é mais específico que a janela: escolher "março" quando a
  // janela começa em agosto tem que devolver março, não vazio.
  const janelaDoMes = mes
    ? intervaloDoMes(mes)
    : mesDoCalendario
      ? intervaloDoMes(mesDoCalendario)
      : null
  const faixa = faixaDePreco(preco)

  // ══════════════════════════════════════════════════════════════════════════
  // DUAS CONSULTAS QUANDO O HISTÓRICO ENTRA, E NÃO UMA COM O DOBRO DO TETO
  // ══════════════════════════════════════════════════════════════════════════
  // A consulta é ordenada por data CRESCENTE e cortada em 60. Com `?passadas=1`
  // a janela abre 12 meses para trás, e o histórico ocupa o começo da ordem:
  // passadas 61 saídas realizadas, o corte come exatamente o que a página
  // promete mostrar — as próximas. Não há paginação na tela para compensar.
  //
  // O defeito só aparece depois que a operação acumula histórico, ou seja,
  // meses depois de alguém ter conferido a página. Hoje a Caqui tem 6 saídas e
  // ele está adormecido.
  //
  // Separar as duas consultas resolve na origem: o futuro tem teto próprio e
  // nunca disputa espaço com o passado. O histórico continua truncado, que é a
  // parte descartável, e o `total` continua vindo do futuro, que é o que a cota
  // do cabeçalho conta.
  const filtrosComuns = {
    incluirEncerradas: true,
    dificuldade,
    tag: atividade,
    precoMinCentavos: faixa?.min,
    precoMaxCentavos: faixa?.max,
    offset: 0,
  }

  const buscarHistorico = passadas && !janelaDoMes

  const [futuras, historico, opcoes, settings] = await Promise.all([
    listarDepartures({
      ...filtrosComuns,
      de: janelaDoMes?.de ?? inicioDoMesAtual,
      ate: janelaDoMes?.ate,
      // O calendário desenha 42 células e precisa de todas as saídas do mês
      // dentro delas. Um teto de 60 caberia hoje, com 6 saídas por mês; um
      // teto que "cabe hoje" é o que produz a célula em branco no dia que tem
      // saída, meses depois de alguém ter conferido a tela.
      limit: vista === 'calendario' ? 200 : 60,
    }),
    buscarHistorico
      ? listarDepartures({
          ...filtrosComuns,
          de: inicioDaJanela,
          ate: inicioDoMesAtual,
          limit: 40,
        })
      : Promise.resolve({ saidas: [], total: 0 }),
    opcoesDeAgenda(inicioDaJanela),
    // Só o calendário precisa: é o número para onde vai o pedido do dia livre.
    vista === 'calendario' ? buscarSettings() : Promise.resolve(null),
  ])

  // O histórico vem antes: a lista é cronológica, e `agruparPorMes` preserva
  // a ordem que recebe.
  const saidas = [...historico.saidas, ...futuras.saidas]
  const total = futuras.total + historico.total

  const grupos = agruparPorMes(saidas)
  const futurasNaVista = saidas.filter((s) => !s.encerrada).length

  // A agenda como lista ordenada de saídas — só as futuras, que é o que a
  // página promete. O `Event` completo de cada uma vive na página do roteiro.
  const naoEncerradas = saidas.filter((s) => !s.encerrada)

  // ──────────────────────────────────────────────────────────────────────────
  // A ÂNCORA DE CADA DIA VAI NA PRIMEIRA SAÍDA DAQUELE DIA
  // ──────────────────────────────────────────────────────────────────────────
  // A célula do calendário aponta para `#dia-2026-08-15`. Se DUAS saídas do
  // mesmo dia carregassem o mesmo `id`, o documento ficaria com id duplicado —
  // HTML inválido, e o navegador salta para a primeira que encontrar, que pode
  // não ser a de cima. O mapa é montado uma vez, sobre a lista inteira e já
  // ordenada, então "a primeira" é sempre a mais cedo.
  const ancoras = new Map<number, string>()
  const diasJaMarcados = new Set<string>()
  for (const saida of saidas) {
    const dia = chaveDia(new Date(saida.inicioUtc))
    if (!diasJaMarcados.has(dia)) {
      diasJaMarcados.add(dia)
      ancoras.set(saida.id, `dia-${dia}`)
    }
  }

  return (
    <>
      {naoEncerradas.length > 0 && <JsonLdScript dados={listaDaAgenda(URL_BASE, naoEncerradas)} />}

      <CabecalhoDePagina
        sobretitulo="Próximas saídas"
        titulo="Agenda"
        descricao="Toda saída tem data, guia e ponto de encontro definidos. A vaga é confirmada na conversa do WhatsApp."
        cota={`${futurasNaVista} ${futurasNaVista === 1 ? 'data' : 'datas'}`}
      />

      <FiltrosAgenda
        opcoes={opcoes}
        valores={{ mes, dificuldade, atividade, preco, passadas, vista }}
        totalFiltrado={total}
      />

      {mesDoCalendario && (
        <section aria-label="Calendário do mês" className="pt-10 sm:pt-12">
          <CalendarioDaAgenda
            mes={mesDoCalendario}
            saidas={saidas}
            agora={agora}
            whatsapp={settings?.whatsappNumber ?? null}
            hrefDoMes={(chave) =>
              linkDaAgenda({ dificuldade, atividade, preco, passadas, vista }, { mes: chave })
            }
          />
        </section>
      )}

      {/* ── A LINHA DO TEMPO ──────────────────────────────────────────────
          Grid de cards saiu pelo mesmo motivo da home e do índice de roteiros:
          nenhuma saída tem foto no banco, e três colunas de retângulos cinzas
          leem como catálogo quebrado.

          O ganho aqui é maior que nas outras duas, porque agenda é uma coisa
          que se VARRE. Com o dia como numeral pesado na mesma abscissa em todas
          as linhas, dá para percorrer o mês inteiro com o olho sem ler nada —
          que é exatamente o que alguém faz procurando "o que tem no fim de
          semana do dia 15". Num grid, a data muda de lugar a cada card.

          O cabeçalho do mês é `sticky`: ao rolar por um mês longo, ele fica
          preso no topo e a pessoa nunca perde a referência de onde está. Ele é
          opaco e tem `z-10` — sem os dois, as linhas passariam por baixo
          borradas. */}
      <section className="pt-14 pb-16 sm:pt-16">
        {grupos.length === 0 ? (
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <AgendaVazia comFiltro={Boolean(mes ?? dificuldade ?? atividade ?? preco)} />
          </div>
        ) : (
          <div className="flex flex-col gap-14">
            {grupos.map((grupo) => (
              <section key={grupo.chave} aria-labelledby={`mes-${grupo.chave}`}>
                <div className="sticky top-20 z-10 bg-white/95 backdrop-blur-sm">
                  <div className="border-caqui-rule-forte mx-auto flex w-full max-w-7xl items-baseline justify-between gap-4 border-b px-5 pt-3 pb-2 sm:px-8">
                    <h2 id={`mes-${grupo.chave}`} className="text-display-m uppercase">
                      {mesPorExtenso(grupo.chave)}
                    </h2>
                    <span className="text-caqui-ink-500 text-rotulo font-mono uppercase">
                      {grupo.saidas.length} {grupo.saidas.length === 1 ? 'saída' : 'saídas'}
                    </span>
                  </div>
                </div>

                {grupo.futuras.length > 0 && (
                  <div data-cena-lista>
                    {grupo.futuras.map((saida) => (
                      <Ancorada key={saida.id} id={ancoras.get(saida.id)}>
                        <LinhaDeSaida saida={saida} />
                      </Ancorada>
                    ))}
                  </div>
                )}

                {grupo.encerradas.length > 0 && (
                  <>
                    <p className="text-caqui-ink-500 text-rotulo mx-auto mt-8 w-full max-w-7xl px-5 pb-2 font-mono uppercase sm:px-8">
                      Já realizadas
                    </p>
                    <div>
                      {grupo.encerradas.map((saida) => (
                        <Ancorada key={saida.id} id={ancoras.get(saida.id)}>
                          <LinhaDeSaida saida={saida} />
                        </Ancorada>
                      ))}
                    </div>
                  </>
                )}
              </section>
            ))}
          </div>
        )}

        <p className="border-caqui-rule mx-auto mt-14 w-full max-w-7xl border-t px-5 pt-6 sm:px-8">
          <Link
            href={linkDaAgenda(
              { mes, dificuldade, atividade, preco, vista },
              { passadas: !passadas },
            )}
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
 * O alvo do link do calendário.
 *
 * `scroll-mt-32` porque o cabeçalho do mês é `sticky top-20`: sem a margem de
 * rolagem, o salto para `#dia-2026-08-15` para com a linha exatamente ATRÁS
 * dele, e a pessoa clica no dia 15 e vê o dia 16.
 */
function Ancorada({ id, children }: { id?: string; children: React.ReactNode }) {
  if (!id) return <>{children}</>
  return (
    <div id={id} className="scroll-mt-32">
      {children}
    </div>
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
