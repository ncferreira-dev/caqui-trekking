'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Confirmar } from '@/components/crm/confirmar'
import { ControleDeVagas } from '@/components/crm/controle-de-vagas'
import { FecharSaida } from '@/components/crm/fechar-saida'
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
  /** O selo que o SITE mostra. Derivado da conta de vagas, não digitado. */
  disponibilidade: 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'
  /** Quantas cabem. `null` = sem limite declarado, e aí o selo é manual. */
  capacidade: number | null
  /** Quantas já fecharam, lançadas por quem vendeu no WhatsApp. */
  vagasFechadas: number
  /** Quantas sobraram. `null` sem capacidade. Nunca negativo. */
  vagasRestantes: number | null
  /** Quantas passaram da capacidade. Zero quando não há overbooking. */
  excedenteDeVagas: number
  /** `true` quando o selo veio de uma decisão humana, e não da conta. */
  disponibilidadePorExcecao: boolean
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
  encerrada: boolean
  /** `null` = ainda não fechada. É o que a fila do painel procura. */
  fechadaEm: string | null
  /** Quantas pessoas FORAM. Diferente de `vagasFechadas`: gente falta. */
  pessoas: number | null
  receitaCentavos: number | null
  custoCentavos: number | null
  observacoesDoFechamento: string | null
  meetingPoint: string | null
  meetingTimeLocal: string | null
  meetingLat: number | null
  meetingLng: number | null
  /** O recado interno da saída. Só existe dentro do painel. */
  internalNotes: string | null
  /** As últimas mudanças de selo, da mais recente para a mais antiga. */
  historicoDoSelo: {
    id: number
    de: 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'
    para: 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'
    motivo: string | null
    quandoIso: string
    quem: string | null
  }[]
  trip: { id: number; slug: string; titulo: string }
}

const ESTADOS = [
  { valor: 'AVAILABLE', curto: 'Abertas', classe: 'bg-caqui-forest-300 text-caqui-ink-900' },
  { valor: 'LAST_SPOTS', curto: 'Últimas', classe: 'bg-caqui-orange-500 text-caqui-ink-900' },
  { valor: 'SOLD_OUT', curto: 'Esgotado', classe: 'bg-caqui-danger text-white' },
] as const

export function ListaDeSaidas({
  saidas,
  podeExcluir = false,
  mostrarRoteiro = true,
}: {
  saidas: SaidaDoPainel[]
  /** OWNER pode excluir saída passada/cancelada. A rota é a barreira real. */
  podeExcluir?: boolean
  /**
   * Desligado quando a lista já vive DENTRO do bloco de uma trilha.
   *
   * Repetir "Pedra Grande de Quatinga" em cada data, embaixo do título que já
   * diz "Pedra Grande de Quatinga", é ruído que empurra data e preço para
   * baixo — e data e preço são o que se lê ali.
   */
  mostrarRoteiro?: boolean
}) {
  const router = useRouter()
  const { mostrar } = useToast()

  // Sobrepõe o valor do servidor enquanto a requisição está no ar. Some no
  // `router.refresh()`, quando o servidor vira a fonte de verdade de novo.
  const [otimista, setOtimista] = useState<Record<number, SaidaDoPainel['disponibilidade']>>({})
  const [ocupadas, setOcupadas] = useState<Record<number, boolean>>({})
  const [cancelando, setCancelando] = useState<SaidaDoPainel | null>(null)
  const [editando, setEditando] = useState<SaidaDoPainel | null>(null)
  const [excluindo, setExcluindo] = useState<SaidaDoPainel | null>(null)
  const [fechando, setFechando] = useState<SaidaDoPainel | null>(null)

  async function mudarDisponibilidade(
    saida: SaidaDoPainel,
    /** `null` devolve o selo para a contagem de vagas. */
    valor: SaidaDoPainel['disponibilidade'] | null,
  ) {
    const anterior = otimista[saida.id] ?? saida.disponibilidade
    if (anterior === valor || ocupadas[saida.id]) return

    // Com `null`, o selo passa a sair da conta e a tela só sabe qual é depois
    // do refresh. Mantém o valor atual até lá, em vez de piscar.
    if (valor !== null) setOtimista((atual) => ({ ...atual, [saida.id]: valor }))
    setOcupadas((atual) => ({ ...atual, [saida.id]: true }))

    try {
      await api.patch(`/api/admin/departures/${saida.id}/availability`, { disponibilidade: valor })
      router.refresh()
    } catch (causa) {
      // Volta atrás. A tela NÃO pode ficar dizendo "esgotado" com o site
      // vendendo — é o cenário exato que este botão existe para evitar.
      if (valor !== null) setOtimista((atual) => ({ ...atual, [saida.id]: anterior }))
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

              {/* `lg:items-start` e não `items-center`: desde que as ações
                  empilham (20/08/2026), o bloco da direita tem três faixas de
                  altura e o da esquerda tem duas linhas. Centralizado, a data
                  flutuava no meio do nada. Alinhados pelo topo, os dois começam
                  na mesma linha de leitura. */}
              <div className="relative flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                {/* O PISO DE LARGURA NAO E ENFEITE.
                    Ate 19/08/2026 esta coluna era so `min-w-0 flex-1`, ou
                    seja, base zero. O bloco de acoes ao lado nao declara
                    encolhimento, entao o conteudo dele reivindicava a linha
                    inteira e esta coluna ficava com LARGURA ZERO entre 1024px
                    e ~1400px: data, hora, preco e nome do roteiro eram
                    pintados por baixo dos botoes. A tela dizia "de 12, faltam
                    6" sem dizer de qual saida.
                    `min-w-0` continua valendo abaixo de lg, onde a linha
                    empilha e o `truncate` do titulo precisa dele. */}
                <div className="min-w-0 flex-1 lg:min-w-56">
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
                  {mostrarRoteiro && (
                    <p className="text-corpo-sm mt-0.5 truncate">{saida.trip.titulo}</p>
                  )}
                </div>

                {/* Ações. Só para saída que ainda vai acontecer: mudar a
                    disponibilidade de uma data que já passou não muda nada no
                    site, e cancelar o que já aconteceu não faz sentido. */}
                {!inativa && (
                  // ── AS AÇÕES EMPILHAM, UMA FAIXA POR ASSUNTO ──────────────
                  // Até 20/08/2026 isto era `flex flex-wrap`: o contador de
                  // vagas, os quatro botões de selo e os três de comando
                  // dividiam UMA linha. Dez alvos lado a lado, todos em
                  // caixa-alta e do mesmo tamanho, sem nada separando "quantas
                  // vagas fechei" de "cancelar a saída".
                  //
                  // O `flex-wrap` piorava em vez de salvar: dependendo da
                  // largura da janela, a quebra caía em lugar diferente e o
                  // agrupamento mudava de sentido a cada resize.
                  //
                  // Agora são três faixas, cada uma com um assunto: o livro de
                  // vagas, a exceção do selo, e os comandos da saída.
                  <div className="flex flex-col gap-2 lg:items-end">
                    {/* A faixa 1 e a 2 são estado; a 3 é ação. */}
                    {/* O LIVRO DE VAGAS vem PRIMEIRO, porque virou a operação
                        do dia a dia. Ver `controle-de-vagas.tsx`. */}
                    <ControleDeVagas
                      saidaId={saida.id}
                      titulo={saida.trip.titulo}
                      capacidade={saida.capacidade}
                      vagasFechadas={saida.vagasFechadas}
                      aoMudar={() => router.refresh()}
                    />

                    {/* A EXCEÇÃO, e ela agora se declara como tal.
                        Desde 18/08/2026 o selo do site é derivado da conta de
                        vagas. Estes botões forçam um valor CONTRA a conta:
                        fechar por chuva, por interdição do parque, por decisão
                        do guia. O quarto botão desfaz. */}
                    <div
                      role="group"
                      aria-label={`Disponibilidade de ${saida.trip.titulo} em ${diaEMes(inicio)}`}
                      className="border-caqui-ink-900 flex overflow-hidden rounded-xs border"
                    >
                      <button
                        type="button"
                        onClick={() => mudarDisponibilidade(saida, null)}
                        disabled={ocupada}
                        aria-pressed={!saida.disponibilidadePorExcecao}
                        title="O selo do site sai da contagem de vagas"
                        className={cn(
                          'text-micro min-h-11 px-3 font-mono uppercase transition-colors',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                          !saida.disponibilidadePorExcecao
                            ? 'bg-caqui-ink-900 text-white'
                            : 'hover:bg-caqui-sand-100 bg-white',
                        )}
                      >
                        Auto
                      </button>
                      {ESTADOS.map((opcao) => {
                        // Só fica aceso quando o selo veio de uma EXCEÇÃO.
                        // Sem esta condição, a saída que a conta declarou
                        // esgotada acenderia "Esgotado" ao lado de "Auto"
                        // aceso, e a tela diria que existem duas verdades.
                        const ativo = saida.disponibilidadePorExcecao && estado === opcao.valor
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

                    {/* FAIXA 3 — os comandos. Continuam lado a lado entre si:
                        são três, do mesmo peso, e empilhar cada um numa linha
                        própria transformaria a lista num menu vertical
                        gigante. O que precisava separar era comando de
                        estado, e isso já aconteceu. */}
                    <div className="flex items-center gap-2">
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
                  </div>
                )}

                {/* Saída inativa (já foi ou cancelada) não tem ação de rotina,
                    mas o dono pode LIMPAR a lista. A lixeira só aparece para o
                    OWNER; o servidor recusa o resto. */}
                {/* SAÍDA QUE JÁ ACONTECEU PEDE FECHAMENTO.
                    A fila do painel procura exatamente isto: publicada, no
                    passado, sem `fechadaEm`. O botão aparece na própria linha
                    para o caminho ser um toque, e não uma navegação.
                    Cancelada não entra: não houve viagem para contabilizar. */}
                {saida.encerrada && saida.status !== 'CANCELLED' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variante={saida.fechadaEm ? 'secondary' : 'primary'}
                      tamanho="sm"
                      onClick={() => setFechando(saida)}
                    >
                      {saida.fechadaEm ? 'Rever fechamento' : 'Fechar'}
                    </Button>

                    {saida.fechadaEm && saida.pessoas !== null && (
                      <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                        {saida.pessoas} {saida.pessoas === 1 ? 'pessoa' : 'pessoas'}
                        {saida.receitaCentavos !== null && saida.custoCentavos !== null && (
                          <> · {formatarBRL(saida.receitaCentavos - saida.custoCentavos)}</>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {saida.historicoDoSelo.length > 0 && <HistoricoDoSelo saida={saida} />}

                {inativa && podeExcluir && (
                  <div className="flex items-center lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setExcluindo(saida)}
                      aria-label={`Excluir ${saida.trip.titulo} de ${diaEMes(inicio)} do histórico`}
                      className="text-caqui-ink-500 hover:text-caqui-danger text-micro inline-flex min-h-11 items-center gap-1.5 rounded-xs px-2 font-mono uppercase transition-colors"
                    >
                      <IconeLixeira />
                      Excluir
                    </button>
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

      {fechando && (
        <FecharSaida
          aberto
          aoFechar={() => setFechando(null)}
          saida={{
            id: fechando.id,
            inicioIso: fechando.inicioIso,
            precoCentavos: fechando.precoCentavos,
            vagasFechadas: fechando.vagasFechadas,
            attendeeCount: fechando.pessoas,
            revenueCents: fechando.receitaCentavos,
            costCents: fechando.custoCentavos,
            closingNotes: fechando.observacoesDoFechamento,
            jaFechada: fechando.fechadaEm !== null,
            trip: { titulo: fechando.trip.titulo },
          }}
        />
      )}

      {excluindo && (
        <Confirmar
          aberto
          aoFechar={() => setExcluindo(null)}
          titulo="Excluir esta saída?"
          rotuloConfirmar="Excluir de vez"
          consequencia={
            <>
              <strong>
                {excluindo.trip.titulo} · {diaEMes(new Date(excluindo.inicioIso))}
              </strong>
              <p className="mt-1">
                Ela é apagada de vez e some da lista. Não muda nada no site, porque uma saída que já
                foi ou foi cancelada não aparece lá. Fica só um registro na auditoria de que você
                excluiu, com a data.
              </p>
            </>
          }
          aoConfirmar={async () => {
            await api.delete(`/api/admin/departures/${excluindo.id}`)
            mostrar({ tom: 'sucesso', titulo: 'Saída excluída' })
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
            internalNotes: editando.internalNotes,
            status: editando.status,
          }}
        />
      )}
    </>
  )
}

function IconeLixeira() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L12 4M6.5 7v4M9.5 7v4" />
    </svg>
  )
}

/**
 * O histórico do selo, que era gravado desde o dia 1 e não aparecia em lugar
 * nenhum.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `<details>` E NÃO UM ESTADO DE ABERTO/FECHADO
 * ────────────────────────────────────────────────────────────────────────────
 * A pergunta "por que essa saída ficou esgotada no dia 3?" aparece uma vez a
 * cada muitos meses, e a resposta ocupa quatro linhas. Aberto por padrão, o
 * histórico empurraria para baixo as ações que se usam todo dia.
 *
 * `<details>` resolve isso sem um `useState`, sem hidratação e sem risco: o
 * navegador já sabe abrir e fechar, o teclado já funciona, e o conteúdo está
 * no HTML para quem busca com Ctrl+F.
 *
 * A linha diz de → para, quem e quando. `from`/`to` guardam o que o SITE
 * mostrava, e não o valor cru da coluna: é a pergunta que alguém realmente faz.
 */
function HistoricoDoSelo({ saida }: { saida: SaidaDoPainel }) {
  const nome: Record<string, string> = {
    AVAILABLE: 'Vagas abertas',
    LAST_SPOTS: 'Últimas vagas',
    SOLD_OUT: 'Esgotado',
  }

  return (
    <details className="text-micro font-mono">
      <summary className="text-caqui-ink-500 hover:text-caqui-ink-900 inline-flex min-h-11 cursor-pointer items-center uppercase">
        Histórico do selo ({saida.historicoDoSelo.length})
      </summary>

      <ul className="border-caqui-rule mt-1 flex flex-col gap-1 border-l-2 pl-3">
        {saida.historicoDoSelo.map((h) => (
          <li key={h.id} className="text-caqui-ink-700">
            <span className="text-caqui-ink-900">
              {nome[h.de] ?? h.de} → {nome[h.para] ?? h.para}
            </span>{' '}
            · {dataCurta(new Date(h.quandoIso))} {horaLocal(new Date(h.quandoIso))}
            {h.quem && <> · {h.quem}</>}
            {h.motivo && <span className="text-caqui-ink-500"> · {h.motivo}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}
