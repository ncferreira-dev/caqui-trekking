'use client'

import { useState } from 'react'

import { Imagem, MidiaVazia } from '@/components/midia/imagem'
import { cn } from '@/lib/ui/cn'
import type { MediaDTO } from '@/server/dto/public-dto'

/**
 * A galeria do produto, com zoom.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O ZOOM É `background-position`, NÃO UM LIGHTBOX
 * ────────────────────────────────────────────────────────────────────────────
 * Roupa se compra olhando a textura da malha e a nitidez do bordado. Um
 * lightbox resolve "quero ver maior", mas exige abrir, olhar, fechar — três
 * ações para uma pergunta que dura um segundo.
 *
 * Aqui o ponteiro sobre a foto move uma cópia ampliada atrás dela: a resposta
 * chega no mesmo gesto de olhar. É a interação de e-commerce de roupa desde
 * sempre, e é uma propriedade de CSS.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NO CELULAR NÃO EXISTE ZOOM, E ISSO É DE PROPÓSITO
 * ────────────────────────────────────────────────────────────────────────────
 * Sem ponteiro, o zoom por hover vira zoom por toque — que rouba o gesto de
 * ROLAR a página em cima da maior área da tela. O celular já tem zoom nativo
 * por pinça, que funciona melhor e ninguém precisa aprender.
 *
 * A regra é `motion-safe` e `[@media(hover:hover)]`: só onde há ponteiro de
 * verdade e movimento é bem-vindo.
 */
export function GaleriaDoProduto({ imagens, nome }: { imagens: MediaDTO[]; nome: string }) {
  const [ativa, setAtiva] = useState(0)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)

  const principal = imagens[ativa] ?? imagens[0]

  if (!principal) {
    return (
      <div className="border-caqui-ink-900 chanfro-md aspect-square overflow-hidden border">
        <MidiaVazia />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onMouseMove={(evento) => {
          const caixa = evento.currentTarget.getBoundingClientRect()
          setZoom({
            x: ((evento.clientX - caixa.left) / caixa.width) * 100,
            y: ((evento.clientY - caixa.top) / caixa.height) * 100,
          })
        }}
        onMouseLeave={() => setZoom(null)}
        className={cn(
          'border-caqui-ink-900 chanfro-md relative aspect-square overflow-hidden border bg-white',
          '[@media(hover:hover)]:cursor-zoom-in',
        )}
      >
        <Imagem
          midia={principal}
          sizes="(min-width: 64rem) 40rem, 92vw"
          prioridade
          className={cn(
            'transition-opacity duration-150',
            zoom && 'motion-safe:[@media(hover:hover)]:opacity-0',
          )}
        />

        {/* A camada ampliada. Só existe no DOM quando o ponteiro está em cima —
            um `background-image` de 1600px sempre montado custaria o download
            da variante grande em toda visita, inclusive no celular, onde ela
            nunca é usada. */}
        {zoom && (
          <span
            aria-hidden="true"
            className="absolute inset-0 hidden bg-[length:200%] bg-no-repeat [@media(hover:hover)]:block"
            style={{
              backgroundImage: `url("${principal.url}")`,
              backgroundPosition: `${zoom.x}% ${zoom.y}%`,
            }}
          />
        )}
      </div>

      {imagens.length > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {imagens.map((imagem, indice) => (
            <li key={imagem.url}>
              <button
                type="button"
                onClick={() => setAtiva(indice)}
                aria-pressed={indice === ativa}
                aria-label={`Ver foto ${indice + 1} de ${imagens.length}: ${nome}`}
                className={cn(
                  'block aspect-square w-full overflow-hidden rounded-xs border transition-colors',
                  indice === ativa
                    ? 'border-caqui-ink-900 border-2'
                    : 'border-caqui-rule-wear hover:border-caqui-ink-900',
                )}
              >
                <Imagem midia={imagem} sizes="(min-width: 40rem) 8rem, 22vw" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
