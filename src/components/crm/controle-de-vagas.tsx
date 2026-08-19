'use client'

import { useState } from 'react'

import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { cn } from '@/lib/ui/cn'

/**
 * O LIVRO DE VAGAS, NA LINHA DA SAÍDA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ESTE CONTROLE SUBSTITUI O GESTO MAIS FREQUENTE DO CRM
 * ════════════════════════════════════════════════════════════════════════════
 * Até 18/08/2026 a linha tinha três botões de disponibilidade, e o comentário
 * do arquivo os descrevia como "o campo mais mexido do sistema inteiro". O
 * fluxo real era: a Caqui no meio de uma conversa no WhatsApp, alguém fecha a
 * última vaga, e ela precisa marcar "esgotado" antes da próxima pessoa pedir.
 *
 * O problema é que "esgotado" era uma CONCLUSÃO que ela tinha que tirar de
 * cabeça, contando quantos já fecharam. Entre fechar a última vaga e lembrar de
 * marcar existe uma janela em que o site anuncia vaga vendida — e a janela dura
 * o tempo de uma conversa.
 *
 * Aqui ela lança o NÚMERO, que é o que ela já sabia. O selo do site cai
 * sozinho, na mesma requisição.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O PASSO É +1 E O CAMPO ACEITA O TOTAL
 * ════════════════════════════════════════════════════════════════════════════
 * Os dois caminhos existem porque as duas coisas acontecem:
 *
 *   +1     fechou mais uma vaga agora, no meio da conversa. Um toque.
 *   campo  está conferindo a lista no fim do dia e quer digitar "sete".
 *
 * O que vai para a API é sempre o TOTAL, nunca um delta. Delta exige que o
 * servidor e a tela concordem sobre o valor anterior, e dois toques rápidos com
 * a rede lenta viram quatro vagas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * OTIMISTA, COM VOLTA ATRÁS
 * ════════════════════════════════════════════════════════════════════════════
 * O número pinta na hora. Esperar a resposta faz a pessoa tocar de novo achando
 * que não pegou. Se falhar, o valor VOLTA e um aviso explica: uma tela dizendo
 * "9 de 10" com o banco em 8 é pior que uma tela lenta.
 */
export function ControleDeVagas({
  saidaId,
  titulo,
  capacidade,
  vagasFechadas,
  aoMudar,
}: {
  saidaId: number
  titulo: string
  capacidade: number | null
  vagasFechadas: number
  /** Chamado depois de gravar, para a página recarregar os dados do servidor. */
  aoMudar: () => void
}) {
  const { mostrar } = useToast()
  const [valor, setValor] = useState(vagasFechadas)
  const [rascunho, setRascunho] = useState(String(vagasFechadas))
  const [ocupado, setOcupado] = useState(false)

  // O valor do servidor mandou, e o rascunho local está desatualizado: acontece
  // depois de `router.refresh()`. Ajuste durante o render, sem efeito.
  const [ultimoDoServidor, setUltimoDoServidor] = useState(vagasFechadas)
  if (vagasFechadas !== ultimoDoServidor) {
    setUltimoDoServidor(vagasFechadas)
    setValor(vagasFechadas)
    setRascunho(String(vagasFechadas))
  }

  const restantes = capacidade === null ? null : Math.max(0, capacidade - valor)
  const excedente = capacidade === null ? 0 : Math.max(0, valor - capacidade)

  async function gravar(novo: number) {
    if (ocupado || novo === valor || novo < 0) return

    const anterior = valor
    setValor(novo)
    setRascunho(String(novo))
    setOcupado(true)

    try {
      await api.patch(`/api/admin/departures/${saidaId}/vagas`, { vagasFechadas: novo })
      aoMudar()
    } catch (causa) {
      setValor(anterior)
      setRascunho(String(anterior))
      mostrar({
        tom: 'erro',
        titulo: 'Não gravou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'As vagas continuam como estavam.',
      })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={`Vagas fechadas em ${titulo}`}
        className="border-caqui-ink-900 flex items-center overflow-hidden rounded-xs border bg-white"
      >
        <BotaoDePasso
          rotulo={`Uma vaga a menos em ${titulo}`}
          sinal="menos"
          onClick={() => gravar(valor - 1)}
          disabled={ocupado || valor === 0}
        />

        {/* O campo aceita digitar o total. `inputMode="numeric"` abre o teclado
            numérico do celular, que é onde este CRM é usado. */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value.replace(/\D/g, ''))}
          onBlur={() => {
            const n = Number(rascunho)
            if (rascunho === '' || Number.isNaN(n)) {
              setRascunho(String(valor))
              return
            }
            void gravar(n)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-label={`Vagas fechadas em ${titulo}`}
          disabled={ocupado}
          className="numeral text-dado border-caqui-ink-900 w-12 border-x bg-white text-center outline-none disabled:opacity-60"
        />

        <BotaoDePasso
          rotulo={`Uma vaga a mais em ${titulo}`}
          sinal="mais"
          onClick={() => gravar(valor + 1)}
          disabled={ocupado}
        />
      </div>

      {/* A leitura em palavras, ao lado do número. É o que a pessoa confere
          antes de responder na conversa. */}
      <span
        className={cn(
          'text-micro font-mono uppercase',
          excedente > 0 ? 'text-caqui-danger' : 'text-caqui-ink-500',
        )}
      >
        {capacidade === null ? (
          'sem limite'
        ) : excedente > 0 ? (
          `${excedente} acima do limite de ${capacidade}`
        ) : (
          <>
            de {capacidade} · {restantes === 0 ? 'lotada' : `faltam ${restantes}`}
          </>
        )}
      </span>
    </div>
  )
}

/**
 * O passo de uma vaga.
 *
 * `min-h-11` e `min-w-11`: 44px é o alvo de toque recomendado, e este CRM é
 * operado do celular, com uma mão, às vezes no meio da trilha. Um botão de
 * 36px aqui erra o toque e cobra uma correção que passa por outro toque.
 */
function BotaoDePasso({
  rotulo,
  sinal,
  onClick,
  disabled,
}: {
  rotulo: string
  sinal: 'mais' | 'menos'
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      className="hover:bg-caqui-sand-100 inline-flex min-h-11 min-w-11 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
        <path
          d={sinal === 'mais' ? 'M10 4v12M4 10h12' : 'M4 10h12'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
        />
      </svg>
    </button>
  )
}
