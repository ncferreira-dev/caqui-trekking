'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Imagem, MidiaVazia } from '@/components/midia/imagem'
import { LARGURAS_SRCSET, srcsetDe, urlVariante } from '@/lib/media/urls'
import { cn } from '@/lib/ui/cn'
import type { MediaDTO } from '@/server/dto/public-dto'

/**
 * Galeria com lightbox.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O `<dialog>` NATIVO OUTRA VEZ — E AQUI O GANHO É MAIOR
 * ────────────────────────────────────────────────────────────────────────────
 * Lightbox é o componente que mais some do teclado em site de turismo: abre
 * numa div com `position: fixed`, o foco fica na miniatura atrás, Tab passeia
 * pela página escondida e Escape não faz nada. `showModal()` resolve os quatro
 * de graça (ver `components/ui/dialogo.tsx`).
 *
 * O que sobra por nossa conta é a navegação por seta, que é específica daqui.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AS SETAS SÃO BOTÕES DE VERDADE, E A CONTAGEM É TEXTO
 * ────────────────────────────────────────────────────────────────────────────
 * "3 / 12" num canto é o que orienta quem entrou pela quinta miniatura. E ele
 * está num `aria-live="polite"`: quem não vê a imagem trocar precisa ouvir que
 * trocou, senão a seta parece não funcionar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A MOSAICO NÃO É UMA GRADE UNIFORME
 * ────────────────────────────────────────────────────────────────────────────
 * Doze quadrados iguais é contact sheet, não capa. A primeira foto ocupa dois
 * terços da largura e a altura inteira; as duas seguintes empilham ao lado. O
 * resto vira uma fita de miniaturas embaixo. Hierarquia visual com uma regra
 * de CSS grid, sem biblioteca de masonry e sem medir nada em JavaScript.
 */

export function Galeria({ imagens, titulo }: { imagens: MediaDTO[]; titulo: string }) {
  const [aberta, setAberta] = useState<number | null>(null)

  const principal = imagens[0]
  const secundarias = imagens.slice(1, 3)
  const restantes = imagens.slice(3)

  if (!principal) {
    return (
      <div className="border-caqui-ink-900 chanfro-md aspect-[3/2] overflow-hidden border">
        <MidiaVazia />
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <BotaoDeFoto
          midia={principal}
          indice={0}
          total={imagens.length}
          titulo={titulo}
          aoAbrir={setAberta}
          prioridade
          sizes="(min-width: 40rem) 60vw, 92vw"
          className="aspect-[4/3] sm:aspect-[3/2]"
        />

        {secundarias.length > 0 && (
          <div className="hidden grid-rows-2 gap-3 sm:grid">
            {secundarias.map((midia, i) => (
              <BotaoDeFoto
                key={midia.url}
                midia={midia}
                indice={i + 1}
                total={imagens.length}
                titulo={titulo}
                aoAbrir={setAberta}
                sizes="30vw"
                className="h-full"
              />
            ))}
          </div>
        )}
      </div>

      {restantes.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {restantes.map((midia, i) => (
            <li key={midia.url}>
              <BotaoDeFoto
                midia={midia}
                indice={i + 3}
                total={imagens.length}
                titulo={titulo}
                aoAbrir={setAberta}
                sizes="(min-width: 40rem) 15vw, 23vw"
                className="aspect-square"
              />
            </li>
          ))}
        </ul>
      )}

      <Lightbox
        imagens={imagens}
        indice={aberta}
        aoFechar={() => setAberta(null)}
        aoTrocar={setAberta}
      />
    </>
  )
}

function BotaoDeFoto({
  midia,
  indice,
  total,
  titulo,
  aoAbrir,
  sizes,
  prioridade = false,
  className,
}: {
  midia: MediaDTO
  indice: number
  total: number
  titulo: string
  aoAbrir: (indice: number) => void
  sizes: string
  prioridade?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(indice)}
      // O rótulo diz o que o clique FAZ e onde a pessoa está. "Foto 3 de 12" é
      // o mínimo para quem navega por lista de botões saber que a galeria não
      // acabou.
      aria-label={`Ampliar foto ${indice + 1} de ${total} — ${titulo}`}
      className={cn(
        'group border-caqui-ink-900 relative block w-full overflow-hidden border',
        'bg-caqui-sand-100 cursor-zoom-in',
        indice === 0 && 'chanfro-md',
        className,
      )}
    >
      <Imagem
        midia={midia}
        sizes={sizes}
        prioridade={prioridade}
        className="transition-transform duration-300 ease-[var(--ease-padrao)] motion-safe:group-hover:scale-[1.03]"
      />
    </button>
  )
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({
  imagens,
  indice,
  aoFechar,
  aoTrocar,
}: {
  imagens: MediaDTO[]
  indice: number | null
  aoFechar: () => void
  aoTrocar: (indice: number) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const gatilho = useRef<HTMLElement | null>(null)
  const aberta = indice !== null

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return

    if (aberta && !dialogo.open) {
      gatilho.current = document.activeElement as HTMLElement | null
      dialogo.showModal()

      // A trava de rolagem PRECISA compensar a barra: sem isto a barra some
      // junto com o `overflow`, o corpo ganha os ~15px dela de largura e a
      // página inteira salta para o lado no instante em que o lightbox abre —
      // e salta de volta ao fechar. É a mesma compensação de `dialogo.tsx`.
      const larguraBarra = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (larguraBarra > 0) document.body.style.paddingRight = `${larguraBarra}px`
    }
    if (!aberta && dialogo.open) dialogo.close()
  }, [aberta])

  useEffect(() => {
    if (aberta) return
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    gatilho.current?.focus()
  }, [aberta])

  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [])

  const ir = useCallback(
    (passo: number) => {
      if (indice === null || imagens.length === 0) return
      // Circular: da última para a primeira. Numa galeria de 4 fotos, travar
      // nas pontas faz a seta parecer quebrada.
      aoTrocar((indice + passo + imagens.length) % imagens.length)
    },
    [indice, imagens.length, aoTrocar],
  )

  const aoTeclar = useCallback(
    (evento: React.KeyboardEvent<HTMLDialogElement>) => {
      if (evento.key === 'ArrowRight') {
        evento.preventDefault()
        ir(1)
      }
      if (evento.key === 'ArrowLeft') {
        evento.preventDefault()
        ir(-1)
      }
    },
    [ir],
  )

  const atual = indice === null ? undefined : imagens[indice]

  return (
    <dialog
      ref={ref}
      onCancel={(evento) => {
        evento.preventDefault()
        aoFechar()
      }}
      onClick={(evento) => {
        if (evento.target === ref.current) aoFechar()
      }}
      onKeyDown={aoTeclar}
      aria-label="Galeria de fotos"
      className={cn(
        'm-auto max-h-none max-w-none bg-transparent p-0',
        'h-full w-full',
        'motion-safe:open:animate-[caqui-entrada_180ms_var(--ease-saida)]',
      )}
    >
      {atual && (
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            {/* Branco, não `sand-400`.
                Medido: o `<dialog>` é `bg-transparent`, então este texto fica
                sobre o `::backdrop` — `rgba(13,13,13,0.72)` composto sobre a
                página branca dá #515151. `sand-400` ali é 2,65:1 e reprova até
                o mínimo de 3:1 de elemento de interface. O token foi calibrado
                para 6,46:1 sobre `ink-900` SÓLIDO (globals.css), e a
                translucidez desfaz exatamente essa medição. Branco dá 7,97:1 —
                e continua passando se a página atrás for escura. */}
            <p aria-live="polite" className="text-rotulo font-mono text-white uppercase">
              {(indice ?? 0) + 1} / {imagens.length}
            </p>

            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar galeria"
              className="inline-flex size-11 items-center justify-center rounded-xs text-white hover:bg-white/15"
            >
              <svg viewBox="0 0 16 16" className="size-5" aria-hidden="true">
                <path
                  d="M2.5 2.5l11 11M13.5 2.5l-11 11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                />
              </svg>
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {imagens.length > 1 && <Seta direcao="anterior" aoClicar={() => ir(-1)} />}

            <img
              // `full` e não o `srcset` do card: o lightbox é o único lugar
              // onde a foto ocupa a tela toda, e é a única vez que faz sentido
              // pedir a variante grande.
              src={urlVariante(atual.url, LARGURAS_SRCSET[5])}
              srcSet={srcsetDe(atual.url, atual.width)}
              sizes="100vw"
              alt={atual.alt}
              width={atual.width}
              height={atual.height}
              decoding="async"
              className="max-h-full max-w-full object-contain"
            />

            {imagens.length > 1 && <Seta direcao="proxima" aoClicar={() => ir(1)} />}
          </div>

          {/* Mesma medição do contador acima: sobre o backdrop translúcido,
              só o branco passa. */}
          {atual.alt && (
            <p className="text-corpo-sm px-4 pb-4 text-center text-white">{atual.alt}</p>
          )}
        </div>
      )}
    </dialog>
  )
}

function Seta({ direcao, aoClicar }: { direcao: 'anterior' | 'proxima'; aoClicar: () => void }) {
  const anterior = direcao === 'anterior'

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={anterior ? 'Foto anterior' : 'Próxima foto'}
      className={cn(
        'absolute top-1/2 z-10 inline-flex size-12 -translate-y-1/2 items-center justify-center',
        'rounded-xs border border-white/30 bg-black/55 text-white',
        'hover:bg-black/80',
        anterior ? 'left-2' : 'right-2',
      )}
    >
      <svg viewBox="0 0 16 16" className="size-5" aria-hidden="true">
        <path
          d={anterior ? 'M10.5 1.5 3.5 8l7 6.5' : 'M5.5 1.5 12.5 8l-7 6.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </button>
  )
}
