import type { Metadata } from 'next'
import Link from 'next/link'

import { CalendarioDeSaidas } from '@/components/crm/calendario-de-saidas'
import { ListaDeSaidas, type SaidaDoPainel } from '@/components/crm/lista-de-saidas'
import { NovaSaida } from '@/components/crm/nova-saida'
import { Paginacao } from '@/components/crm/paginacao'
import { CabecalhoDeSecao, Painel, Rotulo } from '@/components/crm/pecas'
import { chaveMesSchema } from '@/lib/api/schemas'
import { fatiar } from '@/lib/crm/paginacao'
import { chaveDia } from '@/lib/calendario'
import {
  chaveMes,
  deslocarMes,
  inicioDoMes,
  intervaloDoMes,
  isoComOffsetLocal,
  jaEncerrada,
  mesPorExtenso,
} from '@/lib/datetime'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/ui/cn'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'
import { estadoDeVagas } from '@/lib/vagas'

export const metadata: Metadata = { title: 'Saídas', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * A agenda administrativa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A LISTA É O PADRÃO. O CALENDÁRIO ENTROU COMO SEGUNDA VISTA, E POR UM MOTIVO
 * ────────────────────────────────────────────────────────────────────────────
 * Esta tela nasceu só com a lista, e o argumento estava escrito aqui: uma
 * grade de 42 células para 6 marcações é 36 quadrados vazios, e numa célula
 * não cabem os três botões de 44px que esta tela existe para oferecer em um
 * toque. Aquele argumento continua VÁLIDO, e é por isso que a lista continua
 * sendo o padrão e continua sendo onde se opera.
 *
 * O que mudou foi o pedido do cliente, em 18/08/2026: "aperta na agenda no dia
 * que não tem evento e põe criar evento". Isso não é a mesma tarefa. Marcar
 * uma data nova é a única coisa que se faz olhando para os BURACOS do mês, e
 * buraco é justamente o que uma lista não sabe mostrar: ela lista o que
 * existe. As 36 células vazias, que eram o defeito da grade, são o conteúdo
 * desta tarefa.
 *
 * Então são duas vistas, `?vista=calendario` na URL, e nenhuma some. A grade
 * abre o mês e cria; a lista opera o que já existe. Na vista de calendário a
 * lista continua logo abaixo, recortada no mesmo mês.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A JANELA COMEÇA NO MÊS CORRENTE
 * ────────────────────────────────────────────────────────────────────────────
 * Mesma decisão da agenda pública: o que já passou continua visível dentro do
 * mês, porque some da tela justo quando alguém pergunta sobre ele. O histórico
 * completo fica atrás de `?tudo=1`.
 */
/**
 * 50 por página, e SÓ na vista de lista.
 *
 * O calendário é recortado por mês por definição: paginar dentro dele
 * mostraria uma grade com metade dos dias vazios por acidente, o que é
 * exatamente a mentira que uma grade não pode contar.
 */
const POR_PAGINA = 50

export default async function PaginaSaidas({ searchParams }: PageProps<'/crm/saidas'>) {
  const sessao = await exigirSessaoDaPagina()
  // Excluir saída é destrutivo e só do OWNER. A barreira real é o backend
  // (a rota é SO_OWNER); aqui só escondemos a lixeira de quem não pode, por
  // cortesia — mostrar um botão que sempre dá 403 seria hostil.
  const ehOwner = sessao.role === 'OWNER'

  const params = await searchParams
  const texto = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor)

  const tudo = texto(params['tudo']) === '1'
  // Qualquer outro valor cai na lista. `?vista=xyz` não pode inventar terceira
  // tela, e `?mes=abc` não pode chegar em `intervaloDoMes` e derrubar o render
  // com um RangeError do Intl — o mesmo cuidado da agenda pública.
  const vista = texto(params['vista']) === 'calendario' ? 'calendario' : 'lista'
  const mesPedido = chaveMesSchema.safeParse(texto(params['mes'])).data

  const agora = new Date()
  // `inicioDoMes` de `lib/datetime`, não `Date.UTC(...,3,0,0)` escrito à mão.
  // O `3` seria o offset de São Paulo chumbado no código — exatamente o hack
  // que o PROMPT 02 encontrou replicado em quatro arquivos no projeto de
  // referência.
  const comecoDaJanela = inicioDoMes(agora)

  // A grade só sabe desenhar um mês. Sem `?mes=`, ela abre no corrente.
  const mesDoCalendario = vista === 'calendario' ? (mesPedido ?? chaveMes(agora)) : null
  const janelaDoCalendario = mesDoCalendario ? intervaloDoMes(mesDoCalendario) : null

  const ondeBuscar = janelaDoCalendario
    ? { startAt: { gte: janelaDoCalendario.de, lte: janelaDoCalendario.ate } }
    : tudo
      ? {}
      : { startAt: { gte: comecoDaJanela } }

  // O calendário não pagina; a lista sim. `fatiar` sobre o total do calendário
  // devolveria uma fatia que a grade ignoraria, então ele recebe o mês inteiro.
  const totalDeSaidas = await prisma.departure.count({ where: ondeBuscar })
  const fatia = fatiar(params['pagina'], totalDeSaidas, mesDoCalendario ? 500 : POR_PAGINA)

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

  // Só roteiros publicados ou em rascunho podem receber saída nova — arquivado
  // não. Ordenados por título, que é como a Caqui procura na hora de criar.
  const roteiros = await prisma.trip.findMany({
    where: { deletedAt: null, status: { in: ['PUBLISHED', 'DRAFT'] } },
    select: {
      id: true,
      title: true,
      departures: { select: { priceCents: true }, take: 1, orderBy: { startAt: 'desc' } },
    },
    orderBy: { title: 'asc' },
  })
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <NovaSaida roteiros={roteirosOpcao} />

        {/* Dois LINKS, não dois botões: a vista fica no endereço, então ela
            sobrevive ao recarregar e ao voltar. Mesma decisão da agenda do
            site. */}
        <div
          role="group"
          aria-label="Como ver as saídas"
          className="border-caqui-rule-forte inline-flex border"
        >
          <AbaDeVista href={linkDeSaidas({ vista: 'lista', tudo })} ativo={vista === 'lista'}>
            Lista
          </AbaDeVista>
          <AbaDeVista
            href={linkDeSaidas({ vista: 'calendario', mes: mesDoCalendario ?? chaveMes(agora) })}
            ativo={vista === 'calendario'}
          >
            Calendário
          </AbaDeVista>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {mesDoCalendario && (
          <Painel
            titulo={mesPorExtenso(mesDoCalendario)}
            acao={
              <span className="flex items-center gap-1">
                <SetaDeMes
                  href={linkDeSaidas({
                    vista: 'calendario',
                    mes: deslocarMes(mesDoCalendario, -1),
                  })}
                  sentido="anterior"
                  rotulo={mesPorExtenso(deslocarMes(mesDoCalendario, -1))}
                />
                <SetaDeMes
                  href={linkDeSaidas({ vista: 'calendario', mes: deslocarMes(mesDoCalendario, 1) })}
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
        )}

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

        {vista === 'lista' && (
          <Painel>
            <Paginacao
              fatia={fatia}
              itens="saídas"
              href={(p) =>
                linkDeSaidas({ vista: 'lista', tudo }) +
                (p <= 1 ? '' : `${tudo ? '&' : '?'}pagina=${p}`)
              }
            />
          </Painel>
        )}

        {/* O histórico completo é um conceito da LISTA. No calendário, andar
            no tempo é a seta do mês, e oferecer as duas coisas ao mesmo tempo
            faria a grade discordar da lista logo abaixo dela. */}
        {vista === 'lista' && (
          <p className="text-caqui-ink-500 text-micro font-mono uppercase">
            <Link
              href={linkDeSaidas({ vista: 'lista', tudo: !tudo })}
              className={cn('hover:text-caqui-ink-900 rounded-xs underline underline-offset-4')}
            >
              {tudo ? 'Ver só do mês atual em diante' : 'Ver o histórico completo'}
            </Link>
          </p>
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
function linkDeSaidas(estado: {
  vista: 'lista' | 'calendario'
  mes?: string
  tudo?: boolean
}): string {
  const busca = new URLSearchParams()
  if (estado.vista === 'calendario') {
    busca.set('vista', 'calendario')
    if (estado.mes) busca.set('mes', estado.mes)
  } else if (estado.tudo) {
    busca.set('tudo', '1')
  }
  const query = busca.toString()
  return query ? `/crm/saidas?${query}` : '/crm/saidas'
}

function AbaDeVista({
  href,
  ativo,
  children,
}: {
  href: string
  ativo: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'true' : undefined}
      className={cn(
        'text-micro inline-flex min-h-11 items-center px-4 font-mono uppercase transition-colors',
        ativo
          ? 'bg-caqui-ink-900 text-white'
          : 'text-caqui-ink-700 hover:bg-caqui-sand-100 bg-white',
      )}
    >
      {children}
    </Link>
  )
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
