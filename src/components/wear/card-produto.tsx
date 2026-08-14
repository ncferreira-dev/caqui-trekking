import Link from 'next/link'

import { Capa, Imagem } from '@/components/midia/imagem'
import { Card, CardCorpo, CardMidia, CardRodape } from '@/components/ui/card'
import { rotuloDeTamanho } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'
import type { ProdutoResumoDTO } from '@/server/dto/public-dto'

/**
 * O card da Caqui Wear.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A TROCA DE IMAGEM NO HOVER É CSS, NÃO ESTADO
 * ────────────────────────────────────────────────────────────────────────────
 * As duas fotos estão no DOM desde o começo, empilhadas, e o `group-hover`
 * troca a opacidade. Sem `useState`, sem `onMouseEnter`, sem `'use client'` —
 * o card inteiro continua sendo componente de servidor.
 *
 * A alternativa comum (trocar o `src` no `mouseenter`) tem um defeito que só
 * aparece em rede lenta: a segunda imagem começa a baixar QUANDO o ponteiro
 * chega, então ela aparece depois de o ponteiro já ter saído. Aqui ela já está
 * carregada — é `loading="lazy"` como a primeira, e entra junto.
 *
 * No celular não há hover, e é por isso que a segunda foto não pode carregar
 * informação nenhuma: ela é o mesmo produto de outro ângulo, nunca outra cor
 * nem outro modelo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AS BOLINHAS DE COR TÊM NOME
 * ────────────────────────────────────────────────────────────────────────────
 * Cor sozinha não é informação acessível: quem tem daltonismo, quem usa leitor
 * de tela e quem está no sol da rua não distingue "Cinza Chumbo" de "Preto"
 * por um círculo de 12px. O nome vai no `title` e num texto para leitor de
 * tela, e a página do produto lista as cores por extenso.
 */
export function CardProduto({
  produto,
  prioridade = false,
}: {
  produto: ProdutoResumoDTO
  prioridade?: boolean
}) {
  const sizes = '(min-width: 64rem) 18rem, (min-width: 40rem) 45vw, 92vw'

  return (
    <Card interativo className="h-full">
      <CardMidia proporcao="quadrado" className="group">
        <Capa midia={produto.capa} sizes={sizes} prioridade={prioridade} />

        {produto.capaAlternativa && (
          <span
            // `aria-hidden`: é a mesma peça de outro ângulo. Anunciar duas
            // imagens para um produto só é ruído para quem ouve a página.
            aria-hidden="true"
            className={cn(
              'absolute inset-0 opacity-0 transition-opacity duration-300 ease-[var(--ease-padrao)]',
              'motion-safe:group-hover:opacity-100',
            )}
          >
            <Imagem midia={produto.capaAlternativa} sizes={sizes} />
          </span>
        )}
      </CardMidia>

      <CardCorpo>
        <h2 className="text-display-s uppercase">
          <Link
            href={`/wear/${produto.slug}`}
            className="rounded-xs after:absolute after:inset-0 after:content-['']"
          >
            {produto.nome}
          </Link>
        </h2>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {produto.cores.length > 0 && (
            <ul className="flex flex-wrap items-center gap-1.5">
              {produto.cores.map((cor) => (
                <li key={cor.nome}>
                  <span
                    title={cor.nome}
                    className="border-caqui-ink-900 block size-4 rounded-xs border"
                    style={cor.hex ? { backgroundColor: cor.hex } : undefined}
                  />
                  <span className="sr-only">{cor.nome}</span>
                </li>
              ))}
            </ul>
          )}

          {/* A grade de tamanhos, se a peça tiver.
              Aqui NÃO se marca o que está esgotado. O card mostra o que a peça
              é; o que está disponível hoje depende da cor escolhida, e essa
              conta só fecha na página do produto. Riscar o G no card, quando
              ele existe em azul e acabou só no cinza, seria mentira. */}
          {produto.tamanhos.length > 0 && (
            <ul className="flex flex-wrap items-center gap-1">
              <li className="sr-only">Tamanhos:</li>
              {produto.tamanhos.map((t) => (
                <li
                  key={t}
                  className="border-caqui-rule-wear text-caqui-ink-700 text-micro min-w-6 rounded-xs border px-1 py-0.5 text-center font-mono uppercase"
                >
                  {rotuloDeTamanho(t)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardCorpo>

      <CardRodape className="border-caqui-rule-wear">
        <span className="text-caqui-ink-500 text-micro font-mono uppercase">
          {produto.cores.length > 1 ? `${produto.cores.length} cores` : 'Cor única'}
        </span>
        <span className="preco">{formatarBRL(produto.precoCentavos)}</span>
      </CardRodape>
    </Card>
  )
}
