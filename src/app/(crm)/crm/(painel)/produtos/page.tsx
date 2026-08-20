import type { Metadata } from 'next'
import Link from 'next/link'

import { BotaoCadastrarProduto, BotaoEditarProduto } from '@/components/crm/acoes-de-produto'
import { ArquivarItem } from '@/components/crm/arquivar-item'
import { FiltroDeCategoria } from '@/components/crm/filtro-de-categoria'
import { BotaoDestaque, BotoesDeOrdem } from '@/components/crm/ordem-e-destaque'
import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { VALORES_DE_CATEGORIA } from '@/lib/crm/categorias'
import { centavosParaReais, formatarBRL } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/ui/cn'
import { ROTULO_CATEGORIA } from '@/server/services/product-service'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = { title: 'Produtos', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * A Caqui Wear no painel, em GRADE DE QUADRADOS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE DEIXOU DE SER UMA LISTA VERTICAL
 * ════════════════════════════════════════════════════════════════════════════
 * Pedido do cliente em 20/08/2026, olhando a tela: "assim tá muito feio, deixe
 * em quadrados".
 *
 * E o problema era medível, não só estético. A tela desenhava UMA LINHA POR
 * VARIANTE, com botão de 44px em cada. Treze peças com três tamanhos e três
 * cores dão 117 linhas — mais de dois mil pixels de rolagem para responder
 * "quais peças eu tenho?", que é a primeira pergunta de quem abre a tela.
 *
 * Agora cada PEÇA é um quadrado. A variante vira bolinha de cor e etiqueta de
 * tamanho dentro dele, e a grade inteira cabe numa tela.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE ISSO CUSTOU, DITO SEM MAQUIAGEM
 * ────────────────────────────────────────────────────────────────────────────
 * "Marcar esgotada" era um toque na própria linha. Agora é: abrir a peça,
 * marcar, fechar. Um toque virou três.
 *
 * A troca foi consciente e é do cliente: ver o catálogo inteiro passou a valer
 * mais que economizar dois toques numa operação semanal. O quadrado avisa
 * quando há variante esgotada, então a peça que PRECISA ser aberta se anuncia
 * — ninguém varre a grade procurando.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O FILTRO É POR ENDEREÇO
 * ────────────────────────────────────────────────────────────────────────────
 * `?categoria=` e não estado local: esta tela dá `router.refresh()` a cada
 * ação, e um filtro em memória sumiria junto. Ver `filtro-de-categoria.tsx`.
 */

export default async function PaginaProdutos({ searchParams }: PageProps<'/crm/produtos'>) {
  const sessao = await exigirSessaoDaPagina()
  const ehOwner = sessao.role === 'OWNER'

  const params = await searchParams
  const pedida = Array.isArray(params['categoria']) ? params['categoria'][0] : params['categoria']
  // Categoria desconhecida no endereço cai em "todas", em vez de devolver uma
  // grade vazia que parece catálogo apagado.
  const categoria = pedida && VALORES_DE_CATEGORIA.has(pedida) ? pedida : ''

  const onde = { deletedAt: null, ...(categoria ? { category: categoria as never } : {}) }

  const [porCategoria, produtos] = await Promise.all([
    // A contagem de TODAS as categorias, sempre — é ela que enche o seletor, e
    // ela não pode depender do filtro atual senão o número muda ao filtrar.
    prisma.product.groupBy({
      by: ['category'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),

    prisma.product.findMany({
      where: onde,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        priceCents: true,
        status: true,
        featured: true,
        images: {
          select: { id: true, url: true, alt: true, colorName: true },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
        variants: {
          select: {
            id: true,
            size: true,
            colorName: true,
            colorHex: true,
            priceCents: true,
            available: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      // A mesma ordem da vitrine, pelo mesmo motivo da tela de roteiros: as
      // setas de subir/descer não podem mostrar uma posição e gravar outra.
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  const contagem: Record<string, number> = {}
  for (const linha of porCategoria) contagem[linha.category] = linha._count._all

  const ordemAtual = produtos.map((p) => p.id)

  const totalVariantes = produtos.reduce((n, p) => n + p.variants.length, 0)
  const esgotadas = produtos.reduce((n, p) => n + p.variants.filter((v) => !v.available).length, 0)

  return (
    <>
      <CabecalhoDeSecao
        titulo="Produtos"
        descricao="Cada quadrado é uma peça. Abra para mexer em tamanho, cor e disponibilidade."
        acao={
          <Rotulo>
            {totalVariantes} variante(s) · {esgotadas} esgotada(s)
          </Rotulo>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <BotaoCadastrarProduto />
        <FiltroDeCategoria categoria={categoria} contagem={contagem} />
      </div>

      {produtos.length === 0 ? (
        <Painel>
          <Vazio titulo={categoria ? 'Nenhuma peça nesta categoria' : 'Nenhuma peça cadastrada'}>
            <p>
              {categoria
                ? 'Troque a categoria no seletor acima, ou cadastre uma peça nova.'
                : 'A página da Caqui Wear fica vazia até existir peça publicada.'}
            </p>
          </Vazio>
        </Painel>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {produtos.map((p) => {
            const produtoParaEditar = {
              id: p.id,
              name: p.name,
              description: p.description,
              category: p.category,
              priceCentavos: p.priceCents,
              status: p.status === 'PUBLISHED' ? ('PUBLISHED' as const) : ('DRAFT' as const),
              variantes: p.variants.map((v) => ({
                size: v.size,
                colorName: v.colorName,
                colorHex: v.colorHex ?? '#000000',
                available: v.available,
                precoProprio: v.priceCents !== null ? centavosParaReais(v.priceCents) : '',
              })),
            }

            // Cor aparece UMA vez no quadrado, não uma por tamanho: "P Laranja,
            // M Laranja, G Laranja" são três variantes e uma cor só.
            const cores = [
              ...new Map(p.variants.map((v) => [v.colorName.toLowerCase(), v] as const)).values(),
            ]
            const tamanhos = [...new Set(p.variants.map((v) => v.size))]
            const semEstoque = p.variants.filter((v) => !v.available).length
            const capa = p.images[0]

            return (
              <article
                key={p.id}
                className="border-caqui-ink-900 flex flex-col overflow-hidden rounded-xs border bg-white"
              >
                {/* A CAPA, quadrada. Sem foto, a moldura diz o que falta em vez
                    de mostrar um cinza mudo. */}
                <div className="bg-caqui-sand-100 border-caqui-rule relative aspect-square border-b">
                  {capa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={capa.url}
                      alt={capa.alt}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-caqui-ink-500 text-micro flex size-full items-center justify-center px-3 text-center font-mono uppercase">
                      sem foto
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {p.status === 'DRAFT' && (
                      <span className="border-caqui-ink-900 text-micro border bg-white px-1.5 py-0.5 font-mono uppercase">
                        Rascunho
                      </span>
                    )}
                    {semEstoque > 0 && (
                      <span className="bg-caqui-danger text-micro px-1.5 py-0.5 font-mono text-white uppercase">
                        {semEstoque} esgotada(s)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div>
                    <p className="font-display text-corpo-sm uppercase">{p.name}</p>
                    <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                      {ROTULO_CATEGORIA[p.category] ?? p.category} · {formatarBRL(p.priceCents)}
                    </p>
                  </div>

                  {/* As bolinhas de cor e as etiquetas de tamanho: é o resumo
                      da grade que ocupava dezenas de linhas antes. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cores.map((v) => (
                      <span
                        key={v.colorName.toLowerCase()}
                        title={v.colorName}
                        className={cn(
                          'border-caqui-ink-900 size-4 rounded-xs border',
                          !v.available && 'opacity-30',
                        )}
                        style={{ backgroundColor: v.colorHex ?? '#ffffff' }}
                      />
                    ))}
                    <span className="sr-only">
                      Cores: {cores.map((v) => v.colorName).join(', ')}
                    </span>
                    {tamanhos.length > 0 && (
                      <span className="text-caqui-ink-500 text-micro ml-1 font-mono uppercase">
                        {tamanhos.join(' · ')}
                      </span>
                    )}
                  </div>

                  <div className="border-caqui-rule mt-auto flex flex-wrap items-center gap-2 border-t pt-2">
                    <BotaoEditarProduto produto={produtoParaEditar} />

                    <Link
                      href={`/wear/${p.slug}`}
                      target="_blank"
                      className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
                    >
                      Ver
                    </Link>

                    {ehOwner && (
                      <ArquivarItem
                        colecao="products"
                        id={p.id}
                        nome={p.name}
                        consequencia="Ela sai da loja e desta grade."
                      >
                        <p>
                          As {p.variants.length} variante(s) somem junto. A mochila de quem já tinha
                          adicionado avisa que a peça saiu de linha, em vez de quebrar.
                        </p>
                        <p className="mt-2">
                          Se for falta de estoque, marque as variantes como esgotadas pelo “Editar”.
                          Aquilo volta em um toque.
                        </p>
                      </ArquivarItem>
                    )}

                    <span className="ml-auto flex items-center gap-1">
                      <BotoesDeOrdem
                        colecao="products"
                        ids={ordemAtual}
                        id={p.id}
                        rotulo={p.name}
                      />
                      <BotaoDestaque
                        colecao="products"
                        id={p.id}
                        destacado={p.featured}
                        rotulo={p.name}
                      />
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* A ordem manual só faz sentido sem filtro: com `?categoria=` a grade
          mostra um recorte, e subir uma peça dentro do recorte gravaria uma
          ordem que a loja não tem. Dito aqui em vez de escondido. */}
      {categoria !== '' && (
        <p className="text-caqui-ink-500 text-micro mt-3 font-mono uppercase">
          Filtrando por categoria. A ordem da loja é a da lista completa.
        </p>
      )}
    </>
  )
}
