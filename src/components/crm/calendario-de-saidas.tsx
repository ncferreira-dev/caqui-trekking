'use client'

import { useState } from 'react'

import { EditorDeSaida, type RoteiroOpcao } from '@/components/crm/editor-de-saida'
import type { SaidaDoPainel } from '@/components/crm/lista-de-saidas'
import {
  agruparPorDia,
  chaveDia,
  diaPorExtenso,
  diasDaGradeDoMes,
  NOMES_DAS_COLUNAS,
  type DiaDaGrade,
} from '@/lib/calendario'
import { horaLocal } from '@/lib/datetime'
import { cn } from '@/lib/ui/cn'

/**
 * O calendário do painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DIA VAZIO É UM BOTÃO, E ELE FICA ATRÁS DAS SAÍDAS
 * ────────────────────────────────────────────────────────────────────────────
 * O pedido do cliente (18/08/2026): "aperta na agenda no dia que não tem
 * evento e põe criar evento". A célula precisa então ser clicável E conter
 * saídas clicáveis.
 *
 * A forma óbvia, `<button>` na célula com `<button>` de saída dentro, é HTML
 * inválido: botão não pode conter botão. O navegador não avisa, ele
 * "conserta" — desmonta a árvore de um jeito que ninguém previu, e o clique
 * na saída passa a criar uma saída nova por cima dela.
 *
 * Aqui os dois são IRMÃOS. O botão de criar é uma camada absoluta cobrindo a
 * célula inteira; o conteúdo por cima dele é `pointer-events-none`, e só os
 * chips de saída reativam o ponteiro. O resultado: clicar em qualquer lugar
 * vazio da célula cria, clicar num chip abre aquela saída, e nenhum elemento
 * está dentro do outro.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELE NÃO SUBSTITUI A LISTA, PELA MESMA RAZÃO QUE ELA FOI ESCOLHIDA
 * ────────────────────────────────────────────────────────────────────────────
 * A lista continua sendo a tela de OPERAR: vagas, fechar, duplicar e cancelar
 * são alvos de 44px que não cabem numa célula de 48px, e espremê-los ali
 * transformaria um toque em quatro. O calendário responde a outra pergunta:
 * "que dias do mês estão livres?". Uma abre o mês, a outra trabalha nele, e
 * as duas convivem na mesma página.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DIA NO PASSADO CONTINUA CLICÁVEL
 * ────────────────────────────────────────────────────────────────────────────
 * Ao contrário do calendário do site. Lançar uma saída que já aconteceu é
 * exatamente o que o fechamento precisa: a Caqui guiou, não estava no sistema,
 * e quer o resultado no relatório do mês.
 */

/** O tom do chip. Cor reforça, o texto e a borda carregam. Ver ui/badge.tsx. */
const TOM_DA_SAIDA = {
  AVAILABLE: 'bg-caqui-forest-300 text-caqui-ink-900',
  LAST_SPOTS: 'bg-caqui-orange-500 text-caqui-ink-900',
  SOLD_OUT: 'bg-caqui-danger text-white',
} as const

/** Hora padrão de uma saída criada pelo calendário. */
const HORA_PADRAO = '06:00'

export function CalendarioDeSaidas({
  mes,
  saidas,
  roteiros,
  hoje,
}: {
  /** "2026-08". */
  mes: string
  /** Só as saídas deste mês, já ordenadas por data. */
  saidas: SaidaDoPainel[]
  roteiros: RoteiroOpcao[]
  /** "2026-08-18", calculado no SERVIDOR: o relógio do navegador divergiria. */
  hoje: string
}) {
  const [criandoEm, setCriandoEm] = useState<string | null>(null)
  const [editando, setEditando] = useState<SaidaDoPainel | null>(null)

  const dias = diasDaGradeDoMes(mes)
  const porDia = agruparPorDia(saidas, (s) => chaveDia(new Date(s.inicioIso)))

  const semanas: DiaDaGrade[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))

  const podeCriar = roteiros.length > 0

  return (
    <>
      <table className="w-full table-fixed border-collapse">
        <caption className="text-caqui-ink-500 text-micro px-3 pt-2 pb-3 text-left font-mono uppercase">
          {podeCriar
            ? 'Toque num dia livre para criar uma saída nele. Toque numa saída para editar.'
            : 'Cadastre um roteiro antes: uma saída sai de um roteiro.'}
        </caption>
        <thead>
          <tr>
            {NOMES_DAS_COLUNAS.map((nome) => (
              <th
                key={nome}
                scope="col"
                className="text-caqui-ink-500 text-micro pb-1.5 font-mono font-normal uppercase"
              >
                {nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana[0]!.chave}>
              {semana.map((dia) => (
                <Celula
                  key={dia.chave}
                  dia={dia}
                  saidas={porDia.get(dia.chave) ?? []}
                  hoje={hoje}
                  podeCriar={podeCriar}
                  aoCriar={() => setCriandoEm(`${dia.chave}T${HORA_PADRAO}`)}
                  aoAbrir={setEditando}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {criandoEm && (
        <EditorDeSaida
          aberto
          aoFechar={() => setCriandoEm(null)}
          roteiros={roteiros}
          dataInicial={criandoEm}
        />
      )}

      {/* Saída cancelada não abre para edição — é o mesmo corte da lista. */}
      {editando && editando.status !== 'CANCELLED' && (
        <EditorDeSaida
          aberto
          aoFechar={() => setEditando(null)}
          saida={{
            id: editando.id,
            tripId: editando.trip.id,
            tituloRoteiro: editando.trip.titulo,
            inicioParede: editando.inicioParede,
            precoCentavos: editando.precoCentavos,
            compareAtPriceCents: editando.compareAtPriceCents,
            meetingPoint: editando.meetingPoint,
            meetingTimeLocal: editando.meetingTimeLocal,
            meetingLat: editando.meetingLat,
            meetingLng: editando.meetingLng,
            internalNotes: editando.internalNotes,
            status: editando.status,
          }}
        />
      )}
    </>
  )
}

function Celula({
  dia,
  saidas,
  hoje,
  podeCriar,
  aoCriar,
  aoAbrir,
}: {
  dia: DiaDaGrade
  saidas: SaidaDoPainel[]
  hoje: string
  podeCriar: boolean
  aoCriar: () => void
  aoAbrir: (saida: SaidaDoPainel) => void
}) {
  const ehHoje = dia.chave === hoje
  const passado = dia.chave < hoje

  const moldura = cn(
    'border-caqui-rule relative h-28 border p-0 align-top',
    !dia.doMes && 'bg-caqui-sand-100/60',
  )

  if (!dia.doMes) {
    return (
      <td className={moldura}>
        <span className="text-caqui-ink-500 block p-1.5 font-mono text-xs">{dia.dia}</span>
      </td>
    )
  }

  return (
    <td className={moldura}>
      {/* A camada de criar. Irmã dos chips, nunca mãe deles. */}
      {podeCriar && (
        <button
          type="button"
          onClick={aoCriar}
          aria-label={`Criar saída em ${diaPorExtenso(dia.chave)}`}
          className="group/dia hover:bg-caqui-sand-100 focus-visible:ring-caqui-ink-900 absolute inset-0 z-0 flex items-end justify-end p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
          <span
            aria-hidden="true"
            className="text-caqui-ink-500 group-hover/dia:text-caqui-ink-900 font-mono text-sm leading-none opacity-0 transition-opacity group-hover/dia:opacity-100 group-focus-visible/dia:opacity-100"
          >
            +
          </span>
        </button>
      )}

      <div className="pointer-events-none relative z-10 flex h-full flex-col gap-1 p-1.5">
        <span
          className={cn(
            'font-mono text-xs leading-none',
            ehHoje
              ? 'bg-caqui-ink-900 -mx-0.5 -my-0.5 self-start px-1 py-0.5 text-white'
              : passado
                ? 'text-caqui-ink-500'
                : 'text-caqui-ink-900',
          )}
        >
          {dia.dia}
          {ehHoje && <span className="sr-only"> (hoje)</span>}
        </span>

        <div className="flex min-h-0 flex-col gap-0.5">
          {saidas.slice(0, 3).map((saida) => (
            <Chip key={saida.id} saida={saida} passado={passado} aoAbrir={aoAbrir} />
          ))}
          {saidas.length > 3 && (
            <span className="text-caqui-ink-500 text-micro font-mono">
              mais {saidas.length - 3}
            </span>
          )}
        </div>
      </div>
    </td>
  )
}

function Chip({
  saida,
  passado,
  aoAbrir,
}: {
  saida: SaidaDoPainel
  passado: boolean
  aoAbrir: (saida: SaidaDoPainel) => void
}) {
  const hora = saida.meetingTimeLocal ?? horaLocal(new Date(saida.inicioIso))

  // Saída que já aconteceu e não foi fechada é a fila do painel, vista aqui no
  // dia dela. Uma tarja vermelha à esquerda, e o rótulo diz o motivo em voz
  // alta — cor sozinha não conta nada para quem não a distingue.
  const porFechar = passado && saida.fechadaEm === null && saida.status !== 'CANCELLED'

  const tom =
    saida.status === 'CANCELLED'
      ? 'bg-caqui-sand-200 text-caqui-ink-500 line-through'
      : saida.status === 'DRAFT'
        ? 'border-caqui-ink-500 text-caqui-ink-700 border border-dashed bg-white'
        : TOM_DA_SAIDA[saida.disponibilidade]

  return (
    <button
      type="button"
      onClick={() => aoAbrir(saida)}
      title={`${hora} · ${saida.trip.titulo}`}
      aria-label={[
        `${hora}, ${saida.trip.titulo}`,
        saida.status === 'DRAFT' ? 'rascunho' : null,
        saida.status === 'CANCELLED' ? 'cancelada' : null,
        porFechar ? 'por fechar' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      className={cn(
        'pointer-events-auto flex min-h-6 w-full items-center gap-1 px-1 text-left',
        'text-micro focus-visible:ring-caqui-ink-900 font-mono focus-visible:ring-2 focus-visible:outline-none',
        'hover:brightness-95',
        porFechar && 'border-caqui-danger border-l-4',
        tom,
      )}
    >
      <span className="shrink-0">{hora}</span>
      <span className="hidden truncate uppercase sm:inline">{saida.trip.titulo}</span>
    </button>
  )
}
