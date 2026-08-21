import type { Metadata } from 'next'
import Link from 'next/link'

import { ArquivarItem } from '@/components/crm/arquivar-item'
import { CalendarioDeSaidas } from '@/components/crm/calendario-de-saidas'
import { EditarRoteiro } from '@/components/crm/editar-roteiro'
import { ListaDeSaidas, type SaidaDoPainel } from '@/components/crm/lista-de-saidas'
import { NovaSaida } from '@/components/crm/nova-saida'
import { NovoRoteiro } from '@/components/crm/novo-roteiro'
import { BotaoDestaque, BotoesDeOrdem } from '@/components/crm/ordem-e-destaque'
import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { GerenciarTags, type TagDoPainel } from '@/components/crm/gerenciar-tags'
import { BadgeDificuldade, type Dificuldade } from '@/components/ui/badge'
import { chaveMesSchema } from '@/lib/api/schemas'
import { chaveDia } from '@/lib/calendario'
import {
  chaveMes,
  deslocarMes,
  intervaloDoMes,
  isoComOffsetLocal,
  jaEncerrada,
  mesPorExtenso,
} from '@/lib/datetime'
import { formatarDuracao } from '@/lib/formato'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/ui/cn'
import { estadoDeVagas } from '@/lib/vagas'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = { title: 'Trilhas', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * TRILHAS — o roteiro e as datas dele, na mesma janela.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE AS DUAS TELAS VIRARAM UMA
 * ════════════════════════════════════════════════════════════════════════════
 * Pedido do cliente em 20/08/2026, e o argumento é dele:
 *
 *   "Os dois aparecem num lugar só dentro do site, na visão do cliente. Quando
 *    o cliente vê no site não aparece lá saídas, e não tem que apertar em outro
 *    para ver roteiros; então por que na hora de cadastrar é assim?"
 *
 * Ele está certo, e o site prova: `/trekking/[slug]` é a página da trilha, e as
 * datas aparecem DENTRO dela. `Departure` não tem página própria — está escrito
 * no `schema.prisma`, com o motivo (doze saídas do mesmo roteiro seriam doze
 * páginas quase idênticas se canibalizando no Google).
 *
 * Ou seja: a divisão "Roteiros" e "Saídas" no CRM era a divisão do BANCO
 * (`Trip` 1:N `Departure`) vazando para quem opera. O banco continua igual; a
 * tela deixou de repetir o formato dele.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A OBJEÇÃO QUE EU LEVANTEI, E POR QUE ELA CAIU
 * ────────────────────────────────────────────────────────────────────────────
 * Eu argumentei que saída se opera por TEMPO ("o que vem essa semana?") e
 * roteiro se edita por IDENTIDADE ("quero mexer no texto da Pedra Grande"), e
 * que agrupar por trilha perderia a visão cronológica.
 *
 * O calendário no topo resolve isso: ele é cruzado, mostra o mês inteiro de
 * todas as trilhas, e responde a pergunta do tempo antes de qualquer bloco. A
 * objeção valia para uma tela SEM calendário, e esta tem.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O MÊS FILTRA AS DATAS, NÃO AS TRILHAS
 * ────────────────────────────────────────────────────────────────────────────
 * Toda trilha aparece sempre, inclusive a que não tem data no mês — é
 * justamente ela que precisa ser vista, porque é a que está no ar sem nada para
 * vender. Filtrar trilha por mês esconderia o problema em vez de mostrá-lo.
 */

/** Teto de segurança da consulta do mês. Ver o mesmo em `saidas`. */
const TETO_DO_MES = 500

export default async function PaginaTrilhas({ searchParams }: PageProps<'/crm/trilhas'>) {
  const sessao = await exigirSessaoDaPagina()
  const ehOwner = sessao.role === 'OWNER'

  const params = await searchParams
  const texto = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor)

  const mesPedido = chaveMesSchema.safeParse(texto(params['mes'])).data
  const agora = new Date()
  const mes = mesPedido ?? chaveMes(agora)
  const janela = intervaloDoMes(mes)

  const [roteiros, saidasDoMes, linhasDeTags] = await Promise.all([
    prisma.trip.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        description: true,
        city: true,
        state: true,
        region: true,
        difficulty: true,
        distanceKm: true,
        elevationGainM: true,
        maxAltitudeM: true,
        durationMinutes: true,
        minAge: true,
        requiresExperience: true,
        highlights: true,
        included: true,
        notIncluded: true,
        whatToBring: true,
        cancellationPolicy: true,
        status: true,
        featured: true,
        activityTags: { select: { activityTagId: true } },
        _count: {
          select: { departures: { where: { status: 'PUBLISHED', startAt: { gte: agora } } } },
        },
      },
      // A lista É a ordem da vitrine, senão as setas mostrariam uma posição e
      // gravariam outra. Mesma razão da tela antiga de roteiros.
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    }),

    prisma.departure.findMany({
      // Sem filtro de `status`: o painel mostra rascunho e cancelada, que é
      // exatamente o que a rota pública esconde.
      where: { startAt: { gte: janela.de, lte: janela.ate } },
      select: {
        id: true,
        startAt: true,
        priceCents: true,
        compareAtPriceCents: true,
        capacity: true,
        seatsTaken: true,
        lastSpotsAt: true,
        availabilityOverride: true,
        status: true,
        closedAt: true,
        attendeeCount: true,
        revenueCents: true,
        costCents: true,
        closingNotes: true,
        meetingPoint: true,
        meetingTimeLocal: true,
        meetingLat: true,
        meetingLng: true,
        internalNotes: true,
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
      take: TETO_DO_MES,
    }),

    prisma.activityTag.findMany({
      select: {
        id: true,
        slug: true,
        label: true,
        icon: true,
        _count: { select: { trips: true } },
      },
      orderBy: { label: 'asc' },
    }),
  ])

  const saidas: SaidaDoPainel[] = saidasDoMes.map((d) => {
    const vagas = estadoDeVagas(d)
    return {
      id: d.id,
      inicioIso: d.startAt.toISOString(),
      inicioParede: isoComOffsetLocal(d.startAt),
      precoCentavos: d.priceCents,
      compareAtPriceCents: d.compareAtPriceCents,
      disponibilidade: vagas.disponibilidade,
      capacidade: d.capacity,
      vagasFechadas: d.seatsTaken,
      vagasRestantes: vagas.restantes,
      excedenteDeVagas: vagas.excedente,
      disponibilidadePorExcecao: d.availabilityOverride !== null,
      status: d.status,
      encerrada: jaEncerrada(d.startAt, agora),
      fechadaEm: d.closedAt?.toISOString() ?? null,
      pessoas: d.attendeeCount,
      receitaCentavos: d.revenueCents,
      custoCentavos: d.costCents,
      observacoesDoFechamento: d.closingNotes,
      meetingPoint: d.meetingPoint,
      meetingTimeLocal: d.meetingTimeLocal,
      meetingLat: d.meetingLat === null ? null : Number(d.meetingLat),
      meetingLng: d.meetingLng === null ? null : Number(d.meetingLng),
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
    }
  })

  // As datas do mês, agrupadas pela trilha a que pertencem. É o que faz o bloco
  // de cada trilha mostrar as SUAS datas, e não a agenda inteira.
  const porTrilha = new Map<number, SaidaDoPainel[]>()
  for (const s of saidas) {
    const lista = porTrilha.get(s.trip.id)
    if (lista) lista.push(s)
    else porTrilha.set(s.trip.id, [s])
  }

  const tags: TagDoPainel[] = linhasDeTags.map((t) => ({
    id: t.id,
    slug: t.slug,
    label: t.label,
    icone: t.icon,
    roteiros: t._count.trips,
  }))
  const opcoesDeTag = tags.map((t) => ({ id: t.id, label: t.label }))

  const ordemAtual = roteiros.map((t) => t.id)
  const roteirosOpcao = roteiros
    .filter((t) => t.status !== 'ARCHIVED')
    .map((t) => ({
      id: t.id,
      titulo: t.title,
      precoSugeridoCentavos: porTrilha.get(t.id)?.[0]?.precoCentavos ?? 0,
    }))

  const publicados = roteiros.filter((t) => t.status === 'PUBLISHED').length
  const semAgendaTotal = roteiros.filter(
    (t) => t.status === 'PUBLISHED' && t._count.departures === 0,
  ).length

  return (
    <>
      <CabecalhoDeSecao
        titulo="Trilhas"
        descricao="A trilha e as datas dela no mesmo lugar, como o cliente vê no site."
        acao={
          <span className="flex items-center gap-3">
            <Rotulo>{publicados} publicada(s)</Rotulo>
            <NovoRoteiro />
          </span>
        }
      />

      <div className="flex flex-col gap-4">
        {semAgendaTotal > 0 && (
          <p className="border-caqui-orange-500 text-corpo-sm border-l-4 px-3 py-2">
            <strong>{semAgendaTotal} trilha(s) no ar sem nenhuma data futura.</strong> Elas aparecem
            no site como “sob consulta”: o cliente vê, mas não escolhe data. Cada uma está marcada
            abaixo.
          </p>
        )}

        {/* ── O MÊS, CRUZADO ─────────────────────────────────────────────
            Antes de qualquer trilha, porque a primeira pergunta de quem abre
            é do tempo: "o que vem essa semana?". Tocar num dia vazio cria
            data nele. */}
        <Painel
          titulo={mesPorExtenso(mes)}
          acao={
            <span className="flex items-center gap-1">
              <SetaDeMes mes={deslocarMes(mes, -1)} sentido="anterior" />
              <SetaDeMes mes={deslocarMes(mes, 1)} sentido="seguinte" />
            </span>
          }
        >
          <div className="p-2">
            <CalendarioDeSaidas
              mes={mes}
              saidas={saidas}
              roteiros={roteirosOpcao}
              // No SERVIDOR: o relógio do navegador pode estar em outro fuso, e
              // "hoje" mudando entre o HTML e a hidratação marcaria o dia errado.
              hoje={chaveDia(agora)}
            />
          </div>
        </Painel>

        {roteiros.length === 0 ? (
          <Painel>
            <Vazio titulo="Nenhuma trilha cadastrada">
              <p>Sem trilha não há o que agendar, e a agenda do site fica vazia.</p>
            </Vazio>
          </Painel>
        ) : (
          roteiros.map((t) => {
            const datas = porTrilha.get(t.id) ?? []
            const semAgenda = t.status === 'PUBLISHED' && t._count.departures === 0

            return (
              <Painel
                key={t.id}
                className={cn(semAgenda && 'border-caqui-orange-500 border-l-4')}
                titulo={t.title}
                acao={
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <BadgeDificuldade nivel={t.difficulty as Dificuldade} />
                      <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                        {t.city} · {t.state}
                        {t.durationMinutes ? ` · ${formatarDuracao(t.durationMinutes)}` : ''}
                      </span>
                      {t.status === 'DRAFT' && (
                        <span className="border-caqui-ink-900 text-micro border px-1.5 py-0.5 font-mono uppercase">
                          Rascunho
                        </span>
                      )}
                      {t.status === 'ARCHIVED' && (
                        <span className="bg-caqui-ink-900 text-micro px-1.5 py-0.5 font-mono text-white uppercase">
                          Arquivada
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <BotoesDeOrdem colecao="trips" ids={ordemAtual} id={t.id} rotulo={t.title} />
                      <BotaoDestaque
                        colecao="trips"
                        id={t.id}
                        destacado={t.featured}
                        rotulo={t.title}
                        semDataFutura={t._count.departures === 0}
                      />
                      <EditarRoteiro
                        roteiro={{
                          id: t.id,
                          title: t.title,
                          subtitle: t.subtitle,
                          description: t.description,
                          city: t.city,
                          state: t.state,
                          region: t.region,
                          difficulty: t.difficulty,
                          distanceKm: t.distanceKm ? t.distanceKm.toString() : null,
                          elevationGainM: t.elevationGainM,
                          maxAltitudeM: t.maxAltitudeM,
                          durationMinutes: t.durationMinutes,
                          minAge: t.minAge,
                          requiresExperience: t.requiresExperience,
                          highlights: t.highlights,
                          included: t.included,
                          notIncluded: t.notIncluded,
                          whatToBring: t.whatToBring,
                          cancellationPolicy: t.cancellationPolicy,
                          status: t.status,
                          activityTagIds: t.activityTags.map((r) => r.activityTagId),
                        }}
                        tags={opcoesDeTag}
                      />
                      {ehOwner && t.status !== 'ARCHIVED' && (
                        <ArquivarItem
                          colecao="trips"
                          id={t.id}
                          nome={t.title}
                          consequencia="Ela sai do site e desta lista."
                        >
                          <p>
                            As {t._count.departures} data(s) futura(s) dela param de aparecer na
                            agenda. As saídas já realizadas continuam registradas: o histórico não
                            se reescreve.
                          </p>
                          <p className="mt-2">
                            Se for coisa temporária, ponha em <strong>rascunho</strong> pelo
                            “Editar”. Aquilo volta em um clique.
                          </p>
                        </ArquivarItem>
                      )}
                      <Link
                        href={`/trekking/${t.slug}`}
                        target="_blank"
                        className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
                      >
                        Ver no site
                      </Link>
                    </div>
                  </div>
                }
              >
                {/* AS DATAS DESTA TRILHA, no mês que o calendário mostra.
                    `mostrarRoteiro={false}`: o título do painel já diz o nome,
                    e repeti-lo em cada linha empurra data e preço para baixo. */}
                {datas.length > 0 ? (
                  <ListaDeSaidas saidas={datas} podeExcluir={ehOwner} mostrarRoteiro={false} />
                ) : (
                  <p className="text-caqui-ink-500 text-corpo-sm px-4 py-3">
                    Nenhuma data em {mesPorExtenso(mes).toLowerCase()}.
                    {t._count.departures > 0
                      ? ` Esta trilha tem ${t._count.departures} data(s) futura(s) em outros meses.`
                      : ' E nenhuma data futura em mês nenhum.'}
                  </p>
                )}

                <div className="border-caqui-rule flex flex-wrap items-center gap-3 border-t px-4 py-3">
                  <NovaSaida
                    roteiros={roteirosOpcao}
                    abrirCom={t.id}
                    rotulo="+ Nova data"
                    variante="secondary"
                  />
                  <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                    {t._count.departures} data(s) futura(s) no total
                  </span>
                </div>
              </Painel>
            )
          })
        )}

        {/* As atividades continuam aqui: elas pertencem à trilha, e a tela da
            trilha é esta. */}
        <GerenciarTags tags={tags} />
      </div>
    </>
  )
}

function SetaDeMes({ mes, sentido }: { mes: string; sentido: 'anterior' | 'seguinte' }) {
  return (
    <Link
      href={`/crm/trilhas?mes=${mes}`}
      aria-label={`Ver ${mesPorExtenso(mes)}`}
      className={cn(
        'border-caqui-ink-900 inline-flex min-h-11 min-w-11 items-center justify-center',
        'hover:bg-caqui-sand-100 rounded-xs border bg-white transition-colors',
      )}
    >
      <span aria-hidden="true">{sentido === 'anterior' ? '‹' : '›'}</span>
    </Link>
  )
}
