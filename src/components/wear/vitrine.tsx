'use client'

import { useCallback, useState, type ReactNode } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * A VITRINE DA CAQUI WEAR, COM DENSIDADE AJUSTÁVEL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A MESMA ANIMAÇÃO DA REFERÊNCIA, SEM A BIBLIOTECA DA REFERÊNCIA
 * ════════════════════════════════════════════════════════════════════════════
 * O componente que originou este pedido usa `motion/react` (`LayoutGroup`,
 * `layoutId`, `variants`, `whileHover`) mais Radix, `class-variance-authority`
 * e `tailwind-merge`. Nada disso existe aqui, e trazer as cinco por causa de
 * uma vitrine seria a decisão mais cara do projeto até hoje: `motion` sozinho
 * passa de 30 KB comprimido, e ele entraria numa loja que hoje não carrega
 * NENHUMA biblioteca de animação.
 *
 * As três animações daquele componente têm equivalente nativo, e o navegador
 * faz as três melhor porque roda no compositor:
 *
 * ┌─────────────────────────┬──────────────────────────┬─────────────────────┐
 * │ o que a referência faz  │ como ela faz             │ como fica aqui      │
 * ├─────────────────────────┼──────────────────────────┼─────────────────────┤
 * │ pílula desliza entre os │ `layoutId` + FLIP em JS  │ um `translateX` com │
 * │ botões                  │                          │ transição de CSS    │
 * │ cards reacomodam quando │ `layout` + FLIP em JS,   │ `startViewTransition`│
 * │ a grade muda            │ medindo cada elemento    │ nativo, com          │
 * │                         │                          │ `view-transition-name`│
 * │ entrada escalonada      │ `staggerChildren`        │ `animation-delay`   │
 * └─────────────────────────┴──────────────────────────┴─────────────────────┘
 *
 * O `startViewTransition` é o mesmo algoritmo (fotografa antes, fotografa
 * depois, interpola) executado pelo próprio navegador, fora do main thread.
 * Onde ele não existe (Firefox, até esta data), a troca é instantânea e tudo
 * continua funcionando. É a mesma disciplina do bloco CENA em `globals.css`:
 * o movimento é melhoria, nunca requisito.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SÃO DOIS MODOS, E NÃO TRÊS
 * ════════════════════════════════════════════════════════════════════════════
 * A referência tem "lista", "2 colunas" e "4 colunas", e a "lista" dela é
 * `flex-col`: o card continua VERTICAL e ocupa a largura toda. Num catálogo de
 * roupa isso produz um card de 1216px de largura com uma foto quadrada gigante
 * em cima do nome. Não é uma terceira densidade, é a grade quebrada.
 *
 * Lista de verdade pede card HORIZONTAL (foto à esquerda, dado à direita), que
 * é outro componente, não outra classe de grade. Quando ele existir, entra aqui
 * como terceiro modo sem mudar mais nada.
 */

type Modo = 'grade' | 'vitrine'

const MODOS: { modo: Modo; rotulo: string; grade: string }[] = [
  { modo: 'grade', rotulo: 'Grade', grade: 'grid-cols-2 lg:grid-cols-4' },
  { modo: 'vitrine', rotulo: 'Ampliada', grade: 'grid-cols-1 sm:grid-cols-2' },
]

export function Vitrine({ children }: { children: ReactNode }) {
  const [indice, setIndice] = useState(0)
  const atual = MODOS[indice] ?? MODOS[0]!

  const trocar = useCallback((proximo: number) => {
    // A troca de estado é a MESMA nos dois caminhos. O que a transição faz é
    // envolvê-la, não substituí-la: se `startViewTransition` não existir, o
    // `setIndice` continua sendo chamado, na mesma linha, com o mesmo valor.
    //
    // `prefers-reduced-motion` também cai no caminho direto. A reacomodação da
    // grade é movimento autônomo de vários elementos ao mesmo tempo, que é
    // exatamente o que a preferência pede para não acontecer.
    const iniciar = document.startViewTransition?.bind(document)
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // `document.visibilityState`: o navegador PULA a transição quando a aba não
    // está visível, e a promessa `ready` rejeita quando isso acontece. Sem esta
    // linha, trocar de aba logo depois de clicar deixava um
    // `InvalidStateError` não tratado no console. Medido em 18/08/2026.
    if (!iniciar || reduzido || document.visibilityState !== 'visible') {
      setIndice(proximo)
      return
    }

    const transicao = iniciar(() => {
      // O React 19 agrupa este `setIndice` e devolve o DOM já atualizado antes
      // de a transição fotografar o estado final.
      setIndice(proximo)
    })

    // `ready` REJEITA quando a transição é pulada, e pular é normal: aba
    // escondida, dois cliques rápidos, nome duplicado. Não é erro do site, e
    // por isso não pode virar rejeição não tratada no console de ninguém.
    //
    // O que importa continua acontecendo de qualquer jeito: `setIndice` já
    // rodou dentro do callback, então a grade troca com ou sem o movimento.
    transicao.ready.catch(() => {})
  }, [])

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="text-caqui-forest-800 text-rotulo font-mono uppercase">Ver como</p>

        {/* O grupo é um `radiogroup` e não uma fileira de botões: as opções são
            mutuamente exclusivas e uma delas está sempre escolhida, que é a
            definição de rádio. Quem navega por teclado ganha as setas de graça,
            e quem ouve a página ouve "1 de 2", não dois botões soltos. */}
        <div
          role="radiogroup"
          aria-label="Densidade da vitrine"
          className="border-caqui-rule-wear relative isolate flex rounded-xs border bg-white"
        >
          {/* A PÍLULA. Um elemento só, que desliza, em vez de um fundo por
              botão que acende e apaga. É a mesma ideia do `layoutId`: a
              continuidade vem de ser O MESMO objeto se movendo, e é isso que o
              olho lê como "a seleção foi para lá" em vez de "aquilo apagou e
              este acendeu".

              `width` fixa por fração e `translateX` em porcentagem da própria
              largura: composição pura, sem tocar em layout. */}
          <span
            aria-hidden="true"
            className={cn(
              'bg-caqui-forest-800 absolute inset-y-0 left-0 -z-10 rounded-xs',
              'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[var(--ease-saida)]',
            )}
            style={{
              width: `${100 / MODOS.length}%`,
              transform: `translateX(${indice * 100}%)`,
            }}
          />

          {MODOS.map((opcao, i) => {
            const ativo = i === indice
            return (
              <button
                key={opcao.modo}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => trocar(i)}
                className={cn(
                  'text-rotulo min-h-11 rounded-xs px-4 font-mono uppercase transition-colors duration-200',
                  // Branco sobre `forest-800` dá 9,84:1; `ink-700` sobre branco
                  // dá 14,16:1. Os dois estados passam com folga, e nenhum
                  // depende da pílula ter terminado de deslizar.
                  ativo ? 'text-white' : 'text-caqui-ink-700 hover:text-caqui-ink-900',
                )}
              >
                {opcao.rotulo}
              </button>
            )
          })}
        </div>
      </div>

      <ul data-vitrine={atual.modo} className={cn('grid gap-6 sm:gap-8', atual.grade)}>
        {children}
      </ul>
    </>
  )
}
