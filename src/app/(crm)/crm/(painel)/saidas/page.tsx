import type { Metadata } from 'next'
import Link from 'next/link'

import { CalendarioDeSaidas } from '@/components/crm/calendario-de-saidas'
import { ListaDeSaidas, type SaidaDoPainel } from '@/components/crm/lista-de-saidas'
import { NovaSaida } from '@/components/crm/nova-saida'
import { CabecalhoDeSecao, Painel, Rotulo } from '@/components/crm/pecas'
import { chaveMesSchema } from '@/lib/api/schemas'
import { fatiar } from '@/lib/crm/paginacao'
import { chaveDia } from '@/lib/calendario'
import {
  chaveMes,
  deslocarMes,
  intervaloDoMes,
  isoComOffsetLocal,
  jaEncerrada,
  mesPorExtenso,
} from '@/lib/datetime'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'
import { estadoDeVagas } from '@/lib/vagas'

export const metadata: Metadata = { title: 'Saídas', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * A agenda administrativa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * GRADE EM CIMA, LISTA EMBAIXO. UMA TELA SÓ, SEM SELETOR
 * ────────────────────────────────────────────────────────────────────────────
 * Esta tela nasceu só com a lista, e o argumento estava escrito aqui: uma
 * grade de 42 células para 6 marcações é 36 quadrados vazios, e numa célula
 * não cabem os três botões de 44px que esta tela existe para oferecer em um
 * toque. O argumento continua VÁLIDO — e é por isso que a lista não foi
 * embora: é nela que se muda vaga, selo, preço e data.
 *
 * O calendário entrou em 18/08/2026, por outro pedido: "aperta na agenda no
 * dia que não tem evento e põe criar evento". Marcar data nova é a única
 * tarefa que se faz olhando para os BURACOS do mês, e buraco é o que uma
 * lista não sabe mostrar: ela lista o que existe. As 36 células vazias, que
 * eram o defeito da grade, são o conteúdo daquela tarefa.
 *
 * Por um tempo as duas viveram atrás de um seletor "Lista | Calendário".
 * Ele saiu em 20/08/2026, a pedido do cliente, e a razão é boa: as duas
 * respondem perguntas DIFERENTES sobre o mesmo mês. A grade responde "como
 * está o mês"; a lista responde "o que eu faço com cada data". Escolher entre
 * elas obrigava a trocar de aba e voltar, e os controles só existem numa das
 * duas.
 *
 * Agora aparecem juntas, sempre, recortadas no mesmo mês. Sem estado para
 * escolher, não há estado para errar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ANDAR NO TEMPO É A SETA DO MÊS, E SÓ ELA
 * ────────────────────────────────────────────────────────────────────────────
 * A paginação e o "ver o histórico completo" (`?tudo=1`) eram conceitos da
 * lista solta e saíram junto com o seletor. Não é perda de acesso: `?mes=`
 * chega a qualquer mês, para trás ou para frente.
 *
 * Paginar não podia sobreviver: a grade desenha o mês inteiro, e uma fatia
 * dentro dele produziria dias vazios por acidente — exatamente a mentira que
 * uma grade não pode contar. Por isso a busca traz o mês fechado.
 */
/**
 * Teto de segurança da consulta do mês, não paginação.
 *
 * Nenhum mês real da Caqui chega perto disso. Existe para o dia em que um
 * `?mes=` esquisito ou um seed maluco tente puxar a tabela inteira para dentro
 * de uma grade de 42 células.
 */
const TETO_DO_MES = 500

export default async function PaginaSaidas({ searchParams }: PageProps<'/crm/saidas'>) {
  const sessao = await exigirSessaoDaPagina()
  // Excluir saída é destrutivo e só do OWNER. A barreira real é o backend
  // (a rota é SO_OWNER); aqui só escondemos a lixeira de quem não pode, por
  // cortesia — mostrar um botão que sempre dá 403 seria hostil.
  const ehOwner = sessao.role === 'OWNER'

  const params = await searchParams
  const texto = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor)

  // `?mes=abc` não pode chegar em `intervaloDoMes` e derrubar o render com um
  // RangeError do Intl — o mesmo cuidado da agenda pública.
  const mesPedido = chaveMesSchema.safeParse(texto(params['mes'])).data

  // `?trilha=<id>` vem do "publicar uma data" da tela de Roteiros: o formulário
  // já abre com aquela trilha escolhida. Só aceita inteiro positivo — um id
  // esquisito não pode virar `NaN` no seletor.
  const trilhaPedida = Number(texto(params['trilha']))
  const abrirCom = Number.isInteger(trilhaPedida) && trilhaPedida > 0 ? trilhaPedida : undefined

  const agora = new Date()

  // ──────────────────────────────────────────────────────────────────────────
  // UMA VISTA SÓ: O CALENDÁRIO EM CIMA, A LISTA EMBAIXO
  // ──────────────────────────────────────────────────────────────────────────
  // Até 20/08/2026 havia um seletor "Lista | Calendário" no topo, e a vista
  // vivia em `?vista=`. Duas vistas do mesmo mês obrigavam a escolher entre
  // ver a forma do mês e ver os controles de cada saída — e os controles só
  // existem na lista. Quem queria as duas coisas trocava de aba e voltava.
  //
  // Agora as duas aparecem juntas, sempre: a grade responde "como está o mês",
  // a lista logo abaixo responde "o que eu faço com cada data". Não há estado
  // para escolher, então não há estado para errar.
  //
  // O PREÇO, dito claramente: andar no tempo passou a ser SÓ a seta do mês.
  // A paginação e o "ver o histórico completo" eram conceitos da lista solta e
  // saíram junto — paginar dentro de um mês desenharia uma grade com metade
  // dos dias vazios por acidente, que é exatamente a mentira que uma grade não
  // pode contar.
  const mesDoCalendario = mesPedido ?? chaveMes(agora)
  const janelaDoCalendario = intervaloDoMes(mesDoCalendario)

  const ondeBuscar = {
    startAt: { gte: janelaDoCalendario.de, lte: janelaDoCalendario.ate },
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AS DUAS QUE NÃO DEPENDEM UMA DA OUTRA VÃO JUNTAS
  // ──────────────────────────────────────────────────────────────────────────
  // A lista de roteiros alimenta o seletor de "nova saída" e não olha para as
  // saídas em nenhum momento; a contagem não olha para os roteiros. Em fila,
  // eram duas travessias de rede; aqui é uma.
  //
  // Localmente a diferença some no ruído, porque o Postgres está na mesma
  // máquina. Em produção o banco é o Neon e a aplicação é a Vercel, e cada
  // consulta em fila é uma ida e volta que ninguém vê no relatório de consulta
  // lenta — porque nenhuma delas é lenta.
  //
  // A `findMany` das saídas continua depois: ela precisa da fatia, que precisa
  // do total. Essa dependência é real.
  const [totalDeSaidas, roteiros] = await Promise.all([
    prisma.departure.count({ where: ondeBuscar }),

    // Só roteiros publicados ou em rascunho podem receber saída nova —
    // arquivado não. Ordenados por título, que é como a Caqui procura na hora
    // de criar.
    prisma.trip.findMany({
      where: { deletedAt: null, status: { in: ['PUBLISHED', 'DRAFT'] } },
      select: {
        id: true,
        title: true,
        departures: { select: { priceCents: true }, take: 1, orderBy: { startAt: 'desc' } },
      },
      orderBy: { title: 'asc' },
    }),
  ])

  const fatia = fatiar(params['pagina'], totalDeSaidas, TETO_DO_MES)

  const linhas = await prisma.departure.findMany({
    // Sem filtro de `status`: o painel mostra rascunho e cancelada, que é
    // exatamente o que a rota pública esconde. Sem isso não há como publicar
    // um rascunho — ele seria invisível no único lugar que pode publicá-lo.
    where: ondeBuscar,
    select: {
      id: true,
      startAt: true,
      priceCents: true,
      compareAtPriceCents: true,
      // A CONTA DE VAGAS, os quatro juntos: `estadoDeVagas` precisa dos quatro
      // para responder, e trazer três produz um selo errado em silêncio.
      capacity: true,
      seatsTaken: true,
      lastSpotsAt: true,
      availabilityOverride: true,
      status: true,
      // O fechamento: `closedAt` é o que tira a saída da fila "por fechar".
      closedAt: true,
      attendeeCount: true,
      revenueCents: true,
      costCents: true,
      closingNotes: true,
      meetingPoint: true,
      meetingTimeLocal: true,
      meetingLat: true,
      meetingLng: true,
      // Rota autenticada, tela autenticada. Este campo é o único do modelo que
      // a API pública nunca devolve; aqui ele PRECISA aparecer, senão não há
      // como editá-lo.
      internalNotes: true,
      // ────────────────────────────────────────────────────────────────────
      // O HISTÓRICO DO SELO, QUE ERA GRAVADO E NUNCA LIDO
      // ────────────────────────────────────────────────────────────────────
      // `DepartureAvailabilityChange` recebe uma linha a cada mudança de selo
      // desde o primeiro dia, com quem mudou e por quê. Nenhuma tela mostrava:
      // a resposta para "por que essa saída ficou esgotada no dia 3?" existia e
      // estava trancada no banco.
      //
      // Vem junto na MESMA consulta, e não por uma rota sob demanda, porque a
      // Caqui tem unidades de saída e cinco linhas de histórico por saída são
      // dezenas de linhas no total. Com `?tudo=1` e centenas de saídas isso
      // cresce; se um dia crescer, o certo é uma rota própria, não aumentar o
      // `take`.
      availabilityChanges: {
        select: {
          id: true,
          from: true,
          to: true,
          reason: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      trip: { select: { id: true, slug: true, title: true } },
    },
    orderBy: { startAt: 'asc' },
    take: fatia.tamanho,
    skip: fatia.offset,
  })

  const saidas: SaidaDoPainel[] = linhas.map((d) => ({
    id: d.id,
    inicioIso: d.startAt.toISOString(),
    // Parede local pronta para o `<input type="datetime-local">`: os 16
    // primeiros caracteres de "2026-08-15T06:00:00-03:00".
    inicioParede: isoComOffsetLocal(d.startAt).slice(0, 16),
    precoCentavos: d.priceCents,
    compareAtPriceCents: d.compareAtPriceCents,
    // O selo é CONTA, não campo digitado. Ver `src/lib/vagas.ts`.
    ...(() => {
      const v = estadoDeVagas({
        capacity: d.capacity,
        seatsTaken: d.seatsTaken,
        lastSpotsAt: d.lastSpotsAt,
        availabilityOverride: d.availabilityOverride,
      })
      return {
        disponibilidade: v.disponibilidade,
        vagasRestantes: v.restantes,
        excedenteDeVagas: v.excedente,
        disponibilidadePorExcecao: v.porExcecao,
      }
    })(),
    capacidade: d.capacity,
    vagasFechadas: d.seatsTaken,
    fechadaEm: d.closedAt?.toISOString() ?? null,
    pessoas: d.attendeeCount,
    receitaCentavos: d.revenueCents,
    custoCentavos: d.costCents,
    observacoesDoFechamento: d.closingNotes,
    status: d.status,
    encerrada: jaEncerrada(d.startAt, agora),
    meetingPoint: d.meetingPoint,
    meetingTimeLocal: d.meetingTimeLocal,
    meetingLat: d.meetingLat ? Number(d.meetingLat) : null,
    meetingLng: d.meetingLng ? Number(d.meetingLng) : null,
    internalNotes: d.internalNotes,
    historicoDoSelo: d.availabilityChanges.map((h) => ({
      id: h.id,
      de: h.from,
      para: h.to,
      motivo: h.reason,
      quandoIso: h.createdAt.toISOString(),
      quem: h.user?.name ?? null,
    })),
    trip: { id: d.trip.id, slug: d.trip.slug, titulo: d.trip.title },
  }))

  // `roteiros` foi buscado lá em cima, junto com a contagem. Aqui só vira a
  // forma que o seletor consome.
  const roteirosOpcao = roteiros.map((r) => ({
    id: r.id,
    titulo: r.title,
    precoSugeridoCentavos: r.departures[0]?.priceCents ?? 0,
  }))

  const meses = agruparPorMes(saidas)
  const futuras = saidas.filter((s) => !s.encerrada && s.status !== 'CANCELLED').length

  return (
    <>
      <CabecalhoDeSecao
        titulo="Saídas"
        descricao="Mude a disponibilidade em um toque. Duplique para o mês seguinte em um clique."
        acao={<Rotulo>{futuras} data(s) ativa(s)</Rotulo>}
      />

      <div className="mb-4">
        <NovaSaida roteiros={roteirosOpcao} {...(abrirCom !== undefined ? { abrirCom } : {})} />
      </div>

      <div className="flex flex-col gap-4">
        <Painel
          titulo={mesPorExtenso(mesDoCalendario)}
          acao={
            <span className="flex items-center gap-1">
              <SetaDeMes
                href={linkDeSaidas({ mes: deslocarMes(mesDoCalendario, -1) })}
                sentido="anterior"
                rotulo={mesPorExtenso(deslocarMes(mesDoCalendario, -1))}
              />
              <SetaDeMes
                href={linkDeSaidas({ mes: deslocarMes(mesDoCalendario, 1) })}
                sentido="seguinte"
                rotulo={mesPorExtenso(deslocarMes(mesDoCalendario, 1))}
              />
            </span>
          }
        >
          <div className="p-2">
            <CalendarioDeSaidas
              mes={mesDoCalendario}
              saidas={saidas}
              roteiros={roteirosOpcao}
              // Calculado no SERVIDOR: o relógio do navegador de quem opera
              // pode estar em outro fuso, e "hoje" mudando entre o HTML e a
              // hidratação marcaria o dia errado.
              hoje={chaveDia(agora)}
            />
          </div>
        </Painel>

        {meses.length === 0 ? (
          <Painel>
            <ListaDeSaidas saidas={[]} podeExcluir={ehOwner} />
          </Painel>
        ) : (
          meses.map((mes) => (
            <Painel
              key={mes.chave}
              titulo={mesPorExtenso(mes.chave)}
              acao={<Rotulo>{mes.saidas.length} saída(s)</Rotulo>}
            >
              <ListaDeSaidas saidas={mes.saidas} podeExcluir={ehOwner} />
            </Painel>
          ))
        )}
      </div>
    </>
  )
}

/** `Map` preserva a ordem de inserção; o Prisma já devolveu por `startAt`. */
function agruparPorMes(saidas: SaidaDoPainel[]) {
  const porMes = new Map<string, SaidaDoPainel[]>()

  for (const saida of saidas) {
    const chave = chaveMes(new Date(saida.inicioIso))
    const lista = porMes.get(chave)
    if (lista) lista.push(saida)
    else porMes.set(chave, [saida])
  }

  return [...porMes.entries()].map(([chave, lista]) => ({ chave, saidas: lista }))
}

/**
 * O endereço desta tela com uma peça trocada.
 *
 * Escrito à mão em cada link, o primeiro esquecimento de um parâmetro joga a
 * pessoa de volta ao mês corrente sem explicação. Ver o mesmo helper da agenda
 * pública, em `filtros-agenda.tsx`.
 */
function linkDeSaidas(estado: { mes: string }): string {
  return `/crm/saidas?mes=${estado.mes}`
}

function SetaDeMes({
  href,
  sentido,
  rotulo,
}: {
  href: string
  sentido: 'anterior' | 'seguinte'
  rotulo: string
}) {
  return (
    <Link
      href={href}
      rel={sentido === 'anterior' ? 'prev' : 'next'}
      aria-label={`Ver ${rotulo}`}
      className="border-caqui-rule text-caqui-ink-900 hover:bg-caqui-ink-900 focus-visible:ring-caqui-ink-900 inline-flex size-11 items-center justify-center border transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          d={sentido === 'anterior' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          strokeLinecap="square"
        />
      </svg>
    </Link>
  )
}
