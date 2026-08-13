'use client'

import { type ReactNode, useId, useRef, useState } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Abas.
 *
 * Implementa o padrão ARIA completo, porque não existe equivalente nativo:
 * `role="tablist"`, seta esquerda/direita circulando, Home e End, e **um único
 * ponto de parada de Tab** (roving tabindex) — a aba ativa é a única com
 * `tabIndex={0}`, então quem navega por teclado não precisa passar por todas
 * para chegar ao conteúdo.
 *
 * A aba ativa é marcada por SUBLINHADO GROSSO, não por preenchimento: a barra
 * de 3px é uma forma, sobrevive em preto e branco, e não exige que a aba tenha
 * fundo escuro — o que evitaria de saída o problema de anel de foco preto
 * sobre superfície preta.
 */

export type Aba = {
  id: string
  rotulo: string
  conteudo: ReactNode
  /** Contador ao lado do rótulo — quantidade de saídas, de itens etc. */
  contador?: number
}

export function Abas({
  abas,
  inicial,
  className,
}: {
  abas: Aba[]
  inicial?: string
  className?: string
}) {
  const prefixo = useId()
  const [ativa, setAtiva] = useState(inicial ?? abas[0]?.id ?? '')
  const listaRef = useRef<HTMLDivElement>(null)

  function aoTeclar(evento: React.KeyboardEvent<HTMLButtonElement>) {
    const indice = abas.findIndex((a) => a.id === ativa)
    if (indice === -1) return

    let alvo: number | null = null
    if (evento.key === 'ArrowRight') alvo = (indice + 1) % abas.length
    if (evento.key === 'ArrowLeft') alvo = (indice - 1 + abas.length) % abas.length
    if (evento.key === 'Home') alvo = 0
    if (evento.key === 'End') alvo = abas.length - 1
    if (alvo === null) return

    evento.preventDefault()
    const proxima = abas[alvo]
    if (!proxima) return

    setAtiva(proxima.id)
    // O foco acompanha a seleção — é o comportamento de "automatic activation"
    // do padrão ARIA, correto quando trocar de aba não custa uma requisição.
    listaRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${prefixo}-${proxima.id}`)}`)
      ?.focus()
  }

  return (
    <div className={className}>
      <div
        ref={listaRef}
        role="tablist"
        className="border-caqui-rule flex gap-1 overflow-x-auto border-b"
      >
        {abas.map((aba) => {
          const selecionada = aba.id === ativa
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`${prefixo}-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`${prefixo}-painel-${aba.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAtiva(aba.id)}
              onKeyDown={aoTeclar}
              className={cn(
                'relative shrink-0 px-4 py-3 whitespace-nowrap',
                'font-display text-display-s uppercase',
                'transition-colors duration-150',
                'after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:content-[""]',
                selecionada
                  ? 'text-caqui-ink-900 after:bg-caqui-orange-500'
                  : 'text-caqui-ink-500 hover:text-caqui-ink-900 after:bg-transparent',
              )}
            >
              {aba.rotulo}
              {aba.contador !== undefined && (
                // O contador é micro (11px), então laranja aqui reprovaria:
                // #E04E12 sobre branco dá 3,99:1 e o AA pede 4,5:1 em texto
                // normal. Quem sinaliza a aba ativa é a barra de 3px embaixo,
                // que é elemento de interface e passa com 3:1.
                <span
                  className={cn(
                    'text-micro ml-2 font-mono',
                    selecionada ? 'text-caqui-ink-900' : 'text-caqui-ink-500',
                  )}
                >
                  {aba.contador}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {abas.map((aba) => (
        <div
          key={aba.id}
          role="tabpanel"
          id={`${prefixo}-painel-${aba.id}`}
          aria-labelledby={`${prefixo}-${aba.id}`}
          hidden={aba.id !== ativa}
          // `tabIndex={0}` porque o painel pode ser só texto: sem isso, quem
          // navega por teclado sai da aba direto para o próximo controle e
          // pula o conteúdo.
          tabIndex={0}
          className="pt-5 focus-visible:outline-offset-4"
        >
          {aba.conteudo}
        </div>
      ))}
    </div>
  )
}
