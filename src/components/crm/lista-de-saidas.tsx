'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Confirmar } from '@/components/crm/confirmar'
import { EditorDeSaida } from '@/components/crm/editor-de-saida'
import { Rotulo, Vazio } from '@/components/crm/pecas'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { dataCurta, diaEMes, horaLocal } from '@/lib/datetime'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'

/**
 * A lista de saídas — a tela mais usada do CRM.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DISPONIBILIDADE EM UM TOQUE, SEM ABRIR FORMULÁRIO
 * ────────────────────────────────────────────────────────────────────────────
 * É o campo mais mexido do sistema inteiro. O fluxo real: a Caqui está no meio
 * de uma conversa no WhatsApp, alguém fecha a última vaga, e ela precisa
 * marcar "esgotado" antes da próxima pessoa reservar. Abrir a saída, achar o
 * campo, salvar, voltar são quatro toques e uma navegação — tempo suficiente
 * para chegar um segundo pedido da vaga que não existe mais.
 *
 * Três botões na própria linha. Um toque. `PATCH` dedicado
 * (`/departures/:id/availability`), que grava histórico em
 * `DepartureAvailabilityChange` e auditoria na mesma transação.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ATUALIZAÇÃO OTIMISTA, COM VOLTA ATRÁS
 * ────────────────────────────────────────────────────────────────────────────
 * O botão pinta na hora e a requisição vai atrás. Esperar a resposta para
 * pintar faz a pessoa tocar de novo achando que não pegou — e aí são dois
 * PATCH e duas linhas no histórico.
 *
 * Se falhar, o estado VOLTA para o anterior e um aviso explica. O pior
 * resultado possível aqui é a tela dizer "esgotado" e o site continuar
 * vendendo: um otimismo que não desfaz é pior que nenhum otimismo.
 */

export type SaidaDoPainel = {
  id: number
  inicioIso: string
  /** Parede local para o `<input type="datetime-local">`: "2026-08-15T06:00". */
  inicioParede: string
  precoCentavos: number
  compareAtPriceCents: number | null
  disponibilidade: 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
  encerrada: boolean
  meetingPoint: string | null
  meetingTimeLocal: string | null
  meetingLat: number | null
  meetingLng: number | null
  trip: { id: number; slug: string; titulo: string }
}

const ESTADOS = [
  { valor: 'AVAILABLE', curto: 'Abertas', classe: 'bg-caqui-forest-300 text-caqui-ink-900' },
  { valor: 'LAST_SPOTS', curto: 'Últimas', classe: 'bg-caqui-orange-500 text-caqui-ink-900' },
  { valor: 'SOLD_OUT', curto: 'Esgotado', classe: 'bg-caqui-danger text-white' },
] as const

export function ListaDeSaidas({ saidas }: { saidas: SaidaDoPainel[] }) {
  const router = useRouter()
  const { mostrar } = useToast()

  // Sobrepõe o valor do servidor enquanto a requisição está no ar. Some no
  // `router.refresh()`, quando o servidor vira a fonte de verdade de novo.
  const [otimista, setOtimista] = useState<Record<number, SaidaDoPainel['disponibilidade']>>({})
  const [ocupadas, setOcupadas] = useState<Record<number, boolean>>({})
  const [cancelando, setCancelando] = useState<SaidaDoPainel | null>(null)
  const [editando, setEditando] = useState<SaidaDoPainel | null>(null)

  async function mudarDisponibilidade(
    saida: SaidaDoPainel,
    valor: SaidaDoPainel['disponibilidade'],
  ) {
    const anterior = otimista[saida.id] ?? saida.disponibilidade
    if (anterior === valor || ocupadas[saida.id]) return

    setOtimista((atual) => ({ ...atual, [saida.id]: valor }))
    setOcupadas((atual) => ({ ...atual, [saida.id]: true }))

    try {
      await api.patch(`/api/admin/departures/${saida.id}/availability`, { disponibilidade: valor })
      router.refresh()
    } catch (causa) {
      // Volta atrás. A tela NÃO pode ficar dizendo "esgotado" com o site
      // vendendo — é o cenário exato que este botão existe para evitar.
      setOtimista((atual) => ({ ...atual, [saida.id]: anterior }))
      mostrar({
        tom: 'erro',
        titulo: 'Não mudou',
        descricao:
          causa instanceof ErroDaApi ? causa.message : 'A disponibilidade continua como estava.',
      })
    } finally {
      setOcupadas((atual) => ({ ...atual, [saida.id]: false }))
    }
  }

  async function duplicar(saida: SaidaDoPainel) {
    if (ocupadas[saida.id]) return
    setOcupadas((atual) => ({ ...atual, [saida.id]: true }))

    try {
      const nova = await api.post<{ id: number; startAt: string }>(
        `/api/admin/departures/${saida.id}/duplicate`,
      )
      mostrar({
        tom: 'sucesso',
        titulo: 'Duplicada',
        descricao: `Nova saída em ${dataCurta(new Date(nova.startAt))}, em rascunho. Publique quando quiser.`,
      })
      router.refresh()
    } catch (causa) {
      mostrar({
        tom: 'erro',
        titulo: 'Não duplicou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'Tente de novo.',
      })
    } finally {
      setOcupadas((atual) => ({ ...atual, [saida.id]: false }))
    }
  }

  if (saidas.length === 0) {
    return (
      <Vazio titulo="Nenhuma saída aqui">
        <p>Publique uma data para o roteiro aparecer na agenda do site.</p>
      </Vazio>
    )
  }

  return (
    <>
      <ul className="divide-caqui-rule divide-y">
        {saidas.map((saida) => {
          const estado = otimista[saida.id] ?? saida.disponibilidade
          const ocupada = ocupadas[saida.id] ?? false
          const inicio = new Date(saida.inicioIso)
          const inativa = saida.status === 'CANCELLED' || saida.encerrada

          return (
            <li key={saida.id} className={cn('relative px-4 py-3', inativa && 'bg-caqui-sand-100')}>
              {inativa && (
                <span className="trama-indisponivel absolute inset-0" aria-hidden="true" />
              )}

              <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-corpo-sm uppercase">{diaEMes(inicio)}</span>
                    <Rotulo>{horaLocal(inicio)}</Rotulo>
                    <Rotulo>{formatarBRL(saida.precoCentavos)}</Rotulo>
                    {saida.status === 'DRAFT' && (
                      <span className="border-caqui-ink-900 text-micro border px-1.5 py-0.5 font-mono uppercase">
                        Rascunho
                      </span>
                    )}
                    {saida.status === 'CANCELLED' && (
                      <span className="bg-caqui-danger text-micro px-1.5 py-0.5 font-mono text-white uppercase">
                        Cancelada
                      </span>
                    )}
                    {saida.encerrada && saida.status !== 'CANCELLED' && (
                      <span className="bg-caqui-ink-900 text-micro px-1.5 py-0.5 font-mono text-white uppercase">
                        Já foi
                      </span>
                    )}
                  </div>
                  <p className="text-corpo-sm mt-0.5 truncate">{saida.trip.titulo}</p>
                </div>

                {/* Ações. Só para saída que ainda vai acontecer: mudar a
                    disponibilidade de uma data que já passou não muda nada no
                    site, e cancelar o que já aconteceu não faz sentido. */}
                {!inativa && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      role="group"
                      aria-label={`Disponibilidade de ${saida.trip.titulo} em ${diaEMes(inicio)}`}
                      className="border-caqui-ink-900 flex overflow-hidden rounded-xs border"
                    >
                      {ESTADOS.map((opcao) => {
                        const ativo = estado === opcao.valor
                        return (
                          <button
                            key={opcao.valor}
                            type="button"
                            onClick={() => mudarDisponibilidade(saida, opcao.valor)}
                            disabled={ocupada}
                            aria-pressed={ativo}
                            className={cn(
                              'text-micro min-h-11 px-3 font-mono uppercase transition-colors',
                              'disabled:cursor-not-allowed disabled:opacity-60',
                              ativo ? opcao.classe : 'hover:bg-caqui-sand-100 bg-white',
                            )}
                          >
                            {opcao.curto}
                          </button>
                        )
                      })}
                    </div>

                    <Button variante="secondary" tamanho="sm" onClick={() => setEditando(saida)}>
                      Editar
                    </Button>

                    <Button
                      variante="secondary"
                      tamanho="sm"
                      onClick={() => duplicar(saida)}
                      disabled={ocupada}
                    >
                      Duplicar
                    </Button>

                    <Button variante="ghost" tamanho="sm" onClick={() => setCancelando(saida)}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {cancelando && (
        <Confirmar
          aberto
          aoFechar={() => setCancelando(null)}
          titulo="Cancelar esta saída?"
          rotuloConfirmar="Cancelar a saída"
          consequencia={
            <>
              <strong>
                {cancelando.trip.titulo} · {diaEMes(new Date(cancelando.inicioIso))}
              </strong>
              <p className="mt-1">
                Ela some da agenda do site na hora, e ninguém mais consegue reservar. Quem já tem a
                vaga na mochila recebe um aviso de indisponível ao tentar finalizar, mas{' '}
                <strong>quem já fechou pelo WhatsApp precisa ser avisado por você.</strong>
              </p>
              <p className="mt-1">
                A saída não é apagada: fica no histórico, marcada como cancelada.
              </p>
            </>
          }
          aoConfirmar={async () => {
            await api.post(`/api/admin/departures/${cancelando.id}/cancel`, {})
            mostrar({ tom: 'sucesso', titulo: 'Saída cancelada' })
            router.refresh()
          }}
        />
      )}

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
            status: editando.status,
          }}
        />
      )}
    </>
  )
}
