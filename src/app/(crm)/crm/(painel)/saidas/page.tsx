import type { Metadata } from 'next'
import Link from 'next/link'

import { ListaDeSaidas, type SaidaDoPainel } from '@/components/crm/lista-de-saidas'
import { NovaSaida } from '@/components/crm/nova-saida'
import { CabecalhoDeSecao, Painel, Rotulo } from '@/components/crm/pecas'
import { chaveMes, inicioDoMes, isoComOffsetLocal, jaEncerrada, mesPorExtenso } from '@/lib/datetime'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/ui/cn'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = { title: 'Saídas', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * A agenda administrativa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LISTA AGRUPADA POR MÊS, E NÃO UM CALENDÁRIO DESENHADO
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing pede "calendário mensal + lista". Construindo, a grade de
 * calendário se mostrou o formato errado para ESTA operação, e vale escrever
 * por quê em vez de entregar as duas coisas pela metade:
 *
 *  • A Caqui tem entre 4 e 8 saídas por mês. Uma grade de 35 células para 6
 *    marcações é 29 quadrados vazios ocupando a tela inteira do celular.
 *  • O que a pessoa faz aqui é MUDAR DISPONIBILIDADE. Numa célula de
 *    calendário não cabem três botões de 44px; a grade obrigaria a tocar no
 *    dia, abrir um painel, e só então agir — os quatro toques que esta tela
 *    existe para eliminar.
 *  • Data em lista já é ordenada por data. O ganho do calendário é ver buracos
 *    na agenda, e isso o cabeçalho de mês com a contagem entrega em uma linha.
 *
 * Se a operação crescer para dezenas de saídas por mês, o calendário passa a
 * valer — e aí ele entra como uma VISTA alternativa, não como substituto.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A JANELA COMEÇA NO MÊS CORRENTE
 * ────────────────────────────────────────────────────────────────────────────
 * Mesma decisão da agenda pública: o que já passou continua visível dentro do
 * mês, porque some da tela justo quando alguém pergunta sobre ele. O histórico
 * completo fica atrás de `?tudo=1`.
 */
export default async function PaginaSaidas({ searchParams }: PageProps<'/crm/saidas'>) {
  await exigirSessaoDaPagina()

  const params = await searchParams
  const tudo = (Array.isArray(params['tudo']) ? params['tudo'][0] : params['tudo']) === '1'

  const agora = new Date()
  // `inicioDoMes` de `lib/datetime`, não `Date.UTC(...,3,0,0)` escrito à mão.
  // O `3` seria o offset de São Paulo chumbado no código — exatamente o hack
  // que o PROMPT 02 encontrou replicado em quatro arquivos no projeto de
  // referência.
  const comecoDaJanela = inicioDoMes(agora)

  const linhas = await prisma.departure.findMany({
    // Sem filtro de `status`: o painel mostra rascunho e cancelada, que é
    // exatamente o que a rota pública esconde. Sem isso não há como publicar
    // um rascunho — ele seria invisível no único lugar que pode publicá-lo.
    where: tudo ? {} : { startAt: { gte: comecoDaJanela } },
    select: {
      id: true,
      startAt: true,
      priceCents: true,
      compareAtPriceCents: true,
      availability: true,
      status: true,
      meetingPoint: true,
      meetingTimeLocal: true,
      meetingLat: true,
      meetingLng: true,
      trip: { select: { id: true, slug: true, title: true } },
    },
    orderBy: { startAt: 'asc' },
    take: 200,
  })

  const saidas: SaidaDoPainel[] = linhas.map((d) => ({
    id: d.id,
    inicioIso: d.startAt.toISOString(),
    // Parede local pronta para o `<input type="datetime-local">`: os 16
    // primeiros caracteres de "2026-08-15T06:00:00-03:00".
    inicioParede: isoComOffsetLocal(d.startAt).slice(0, 16),
    precoCentavos: d.priceCents,
    compareAtPriceCents: d.compareAtPriceCents,
    disponibilidade: d.availability,
    status: d.status,
    encerrada: jaEncerrada(d.startAt, agora),
    meetingPoint: d.meetingPoint,
    meetingTimeLocal: d.meetingTimeLocal,
    meetingLat: d.meetingLat ? Number(d.meetingLat) : null,
    meetingLng: d.meetingLng ? Number(d.meetingLng) : null,
    trip: { id: d.trip.id, slug: d.trip.slug, titulo: d.trip.title },
  }))

  // Só roteiros publicados ou em rascunho podem receber saída nova — arquivado
  // não. Ordenados por título, que é como a Caqui procura na hora de criar.
  const roteiros = await prisma.trip.findMany({
    where: { deletedAt: null, status: { in: ['PUBLISHED', 'DRAFT'] } },
    select: { id: true, title: true, departures: { select: { priceCents: true }, take: 1, orderBy: { startAt: 'desc' } } },
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

      <div className="mb-4">
        <NovaSaida roteiros={roteirosOpcao} />
      </div>

      <div className="flex flex-col gap-4">
        {meses.length === 0 ? (
          <Painel>
            <ListaDeSaidas saidas={[]} />
          </Painel>
        ) : (
          meses.map((mes) => (
            <Painel
              key={mes.chave}
              titulo={mesPorExtenso(mes.chave)}
              acao={<Rotulo>{mes.saidas.length} saída(s)</Rotulo>}
            >
              <ListaDeSaidas saidas={mes.saidas} />
            </Painel>
          ))
        )}

        <p className="text-caqui-ink-500 text-micro font-mono uppercase">
          <Link
            href={tudo ? '/crm/saidas' : '/crm/saidas?tudo=1'}
            className={cn('hover:text-caqui-ink-900 rounded-xs underline underline-offset-4')}
          >
            {tudo ? 'Ver só do mês atual em diante' : 'Ver o histórico completo'}
          </Link>
        </p>
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
