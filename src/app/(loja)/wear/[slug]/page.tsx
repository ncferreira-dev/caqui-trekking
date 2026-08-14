import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { Etiqueta } from '@/components/ui/badge'
import { AppError } from '@/lib/api/errors'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'
import { buscarProdutoPorSlug } from '@/server/services/product-service'

export async function generateMetadata({ params }: PageProps<'/wear/[slug]'>): Promise<Metadata> {
  const { slug } = await params

  try {
    const produto = await buscarProdutoPorSlug(slug)
    return { title: produto.nome, description: produto.descricao ?? undefined }
  } catch {
    return { title: 'Peça não encontrada' }
  }
}

/** Seletor de tamanho/cor e "adicionar à mochila" são o PROMPT 09. */
export default async function PaginaDoProduto({ params }: PageProps<'/wear/[slug]'>) {
  const { slug } = await params

  let produto
  try {
    produto = await buscarProdutoPorSlug(slug)
  } catch (erro) {
    if (erro instanceof AppError) notFound()
    throw erro
  }

  return (
    <>
      <CabecalhoDePagina sobretitulo="Caqui Wear" titulo={produto.nome} />

      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {produto.imagens.length === 0 ? (
            <div className="bg-caqui-sand-200 border-caqui-ink-900 chanfro-md aspect-square border" />
          ) : (
            produto.imagens.map((imagem) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={imagem.url}
                src={imagem.url}
                alt={imagem.alt}
                width={imagem.width}
                height={imagem.height}
                // A primeira imagem é o LCP da página: carrega cedo e com
                // prioridade. As outras esperam a rolagem.
                loading={imagem.principal ? 'eager' : 'lazy'}
                fetchPriority={imagem.principal ? 'high' : 'auto'}
                decoding="async"
                className="border-caqui-ink-900 chanfro-md w-full border object-cover"
              />
            ))
          )}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:h-fit">
          <p className="preco">{formatarBRL(produto.precoCentavos)}</p>

          {produto.descricao && (
            <p className="text-corpo whitespace-pre-line">{produto.descricao}</p>
          )}

          {produto.cores.length > 0 && (
            <div>
              <h2 className="text-caqui-ink-500 text-rotulo font-mono uppercase">Cores</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {produto.cores.map((cor) => (
                  <Etiqueta key={cor.nome}>{cor.nome}</Etiqueta>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-caqui-ink-500 text-rotulo font-mono uppercase">Tamanhos</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {produto.variantes.map((variante) => (
                <li
                  key={variante.id}
                  className={cn(
                    'text-corpo-sm border px-3 py-1.5 font-mono uppercase',
                    variante.disponivel
                      ? 'border-caqui-ink-900 text-caqui-ink-900'
                      : 'border-caqui-rule text-caqui-ink-500 trama-indisponivel',
                  )}
                >
                  {variante.tamanho}
                  <span className="sr-only">
                    {variante.disponivel ? ' disponível' : ' indisponível'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="border-caqui-rule text-caqui-ink-700 text-corpo-sm border-l-2 pl-4">
            A escolha de tamanho e cor e o botão de adicionar à mochila entram no PROMPT 09, junto
            com o carrinho e o handoff para o WhatsApp.
          </p>
        </div>
      </div>
    </>
  )
}
