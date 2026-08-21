'use client'

import { useEffect, useRef, useState } from 'react'

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
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A RAJADA: SEIS TOQUES, UMA GRAVAÇÃO
 * ════════════════════════════════════════════════════════════════════════════
 * Achado A7 da auditoria de 20/08/2026. O botão TRAVAVA a cada toque até o
 * servidor responder: quem fechou seis vagas numa conversa tocava, esperava,
 * tocava, esperava — seis idas e voltas em fila, cada uma re-renderizando a
 * página inteira.
 *
 * Agora os toques se acumulam na tela e UMA gravação sai depois da pausa. Seis
 * toques viram uma requisição com o total final.
 *
 * O que torna isso seguro é o campo ser um TOTAL e não um delta: mandar "sete"
 * é idempotente, e uma rajada perdida no meio não soma errado. E o
 * `vagasFechadasAnteriores` continua sendo o último valor CONFIRMADO pelo
 * servidor, não o da tela — é ele que faz a trava otimista do A1 continuar
 * valendo mesmo com a gravação atrasada.
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
  const [salvando, setSalvando] = useState(false)

  /**
   * O último valor que o SERVIDOR confirmou.
   *
   * É o que vai como `vagasFechadasAnteriores`, e não o número da tela: durante
   * uma rajada a tela já está adiantada, e mandar o valor adiantado faria a
   * trava otimista comparar contra algo que o banco nunca teve.
   */
  const confirmado = useRef(vagasFechadas)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Um timer pendente num componente desmontado grava depois que a linha saiu
  // da tela, e o `aoMudar` cai num componente que não existe mais.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // O valor do servidor mandou, e o rascunho local está desatualizado: acontece
  // depois de `router.refresh()`. Ajuste durante o render, sem efeito.
  const [ultimoDoServidor, setUltimoDoServidor] = useState(vagasFechadas)
  if (vagasFechadas !== ultimoDoServidor) {
    setUltimoDoServidor(vagasFechadas)
    setValor(vagasFechadas)
    setRascunho(String(vagasFechadas))
    confirmado.current = vagasFechadas
  }

  const restantes = capacidade === null ? null : Math.max(0, capacidade - valor)
  const excedente = capacidade === null ? 0 : Math.max(0, valor - capacidade)

  /** Quanto esperar depois do último toque antes de gravar. */
  const PAUSA_MS = 700

  /** Toque no + ou no −: pinta na hora e agenda a gravação. Não trava. */
  function tocar(novoValor: number) {
    if (novoValor < 0) return
    setValor(novoValor)
    setRascunho(String(novoValor))
    agendar(novoValor)
  }

  function agendar(alvo: number) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void gravar(alvo), PAUSA_MS)
  }

  async function gravar(alvo: number) {
    const anterior = confirmado.current
    if (alvo === anterior) return

    setSalvando(true)
    try {
      // `vagasFechadasAnteriores` é o último valor CONFIRMADO pelo servidor. O
      // servidor só grava se a linha ainda estiver nele; caso contrário devolve
      // 409 e o lançamento de quem chegou primeiro fica de pé.
      //
      // Sem isso, dois guias lançando ao mesmo tempo — ou a mesma pessoa com
      // duas abas — perdiam uma venda em silêncio. Ver o achado A1 em
      // docs/20-auditoria-do-crm.md.
      await api.patch(`/api/admin/departures/${saidaId}/vagas`, {
        vagasFechadas: alvo,
        vagasFechadasAnteriores: anterior,
      })
      confirmado.current = alvo
      aoMudar()
    } catch (causa) {
      // Volta para o que o servidor tem, e não para o penúltimo toque: a rajada
      // inteira falhou, então o estado verdadeiro é o último confirmado.
      setValor(anterior)
      setRascunho(String(anterior))

      // O conflito não é "deu erro": é "o número mudou embaixo de você". A
      // mensagem do servidor já diz quanto é agora, e o refresh traz o valor
      // verdadeiro para a tela em vez de deixar a pessoa olhando o antigo.
      const conflito = causa instanceof ErroDaApi && causa.status === 409
      if (conflito) aoMudar()

      mostrar({
        tom: conflito ? 'aviso' : 'erro',
        titulo: conflito ? 'Alguém lançou antes' : 'Não gravou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'As vagas continuam como estavam.',
      })
    } finally {
      setSalvando(false)
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
          onClick={() => tocar(valor - 1)}
          disabled={valor === 0}
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
            if (timer.current) clearTimeout(timer.current)
            setValor(n)
            void gravar(n)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-label={`Vagas fechadas em ${titulo}`}
          className="numeral text-dado border-caqui-ink-900 w-12 border-x bg-white text-center outline-none"
        />

        <BotaoDePasso
          rotulo={`Uma vaga a mais em ${titulo}`}
          sinal="mais"
          onClick={() => tocar(valor + 1)}
        />
      </div>

      {/* Sem travar nada: só conta que a gravação está a caminho. Quem opera
          continua tocando enquanto isso, que é o ponto da mudança. */}
      <span aria-live="polite" className="text-caqui-ink-500 text-micro font-mono uppercase">
        {salvando ? 'salvando…' : ''}
      </span>

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
  disabled = false,
}: {
  rotulo: string
  sinal: 'mais' | 'menos'
  onClick: () => void
  disabled?: boolean
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
