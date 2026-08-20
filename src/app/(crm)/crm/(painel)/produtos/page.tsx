import type { Metadata } from 'next'
import Link from 'next/link'

import { BotaoCadastrarProduto, BotaoEditarProduto } from '@/components/crm/acoes-de-produto'
import { ArquivarItem } from '@/components/crm/arquivar-item'
import { FotosDaPeca, type FotoDaPeca } from '@/components/crm/fotos-da-peca'
import { BotaoDestaque, BotoesDeOrdem } from '@/components/crm/ordem-e-destaque'
import { Paginacao } from '@/components/crm/paginacao'
import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { TabelaDeVariantes, type VarianteDoPainel } from '@/components/crm/tabela-de-variantes'
import { centavosParaReais, formatarBRL } from '@/lib/money'
import { fatiar } from '@/lib/crm/paginacao'
import { prisma } from '@/lib/prisma'
import { ROTULO_CATEGORIA } from '@/server/services/product-service'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = { title: 'Produtos', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * A Caqui Wear no painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A TELA É A GRADE DE VARIANTES, NÃO A FICHA DO PRODUTO
 * ────────────────────────────────────────────────────────────────────────────
 * Nome, descrição e preço de uma camiseta mudam uma vez por temporada.
 * Disponibilidade por tamanho e cor muda toda semana — é ela que a Caqui vem
 * mexer aqui, e por isso ela é o conteúdo da tela, não um detalhe dentro de um
 * formulário de edição.
 *
 * Cada produto abre já com a grade aberta. Sem acordeão: com 13 produtos,
 * fechar tudo obrigaria a abrir um por um para achar a variante que acabou.
 *
 * O cadastro completo — criar peça, subir foto, editar descrição — depende de
 * upload funcionando, e o Cloudinary ainda não tem credencial neste projeto.
 * Ver o mesmo argumento em `roteiros/page.tsx` e em docs/10-crm.md.
 */
/** Mesma régua da tela de roteiros. Ver `lib/crm/paginacao.ts`. */
const POR_PAGINA = 50

export default async function PaginaProdutos({ searchParams }: PageProps<'/crm/produtos'>) {
  const sessao = await exigirSessaoDaPagina()
  const ehOwner = sessao.role === 'OWNER'

  const params = await searchParams
  const total = await prisma.product.count({ where: { deletedAt: null } })
  const fatia = fatiar(params['pagina'], total, POR_PAGINA)

  const produtos = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      priceCents: true,
      status: true,
      featured: true,
      // As fotos e a cor de cada uma. Ver `fotos-da-peca.tsx`.
      images: {
        select: { id: true, url: true, alt: true, colorName: true },
        orderBy: { sortOrder: 'asc' },
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
    take: fatia.tamanho,
    skip: fatia.offset,
  })

  const ordemAtual = produtos.map((p) => p.id)

  const totalVariantes = produtos.reduce((n, p) => n + p.variants.length, 0)
  const esgotadas = produtos.reduce((n, p) => n + p.variants.filter((v) => !v.available).length, 0)

  return (
    <>
      <CabecalhoDeSecao
        titulo="Produtos"
        descricao="Um toque para marcar uma variante como esgotada. Vale na loja na hora."
        acao={
          <Rotulo>
            {totalVariantes} variante(s) · {esgotadas} esgotada(s)
          </Rotulo>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <BotaoCadastrarProduto />
        {/* Mesma honestidade da tela de roteiros: as setas mandam na ordem
            manual, e o destaque passa na frente dela na loja. */}
        <p className="text-caqui-ink-700 text-corpo-sm">
          As setas definem a ordem da loja. Peça em destaque aparece antes de todas.
        </p>
      </div>

      {produtos.length === 0 ? (
        <Painel>
          <Vazio titulo="Nenhum produto cadastrado">
            <p>A página da Caqui Wear fica vazia até existir peça publicada.</p>
          </Vazio>
        </Painel>
      ) : (
        <div className="flex flex-col gap-3">
          {produtos.map((p) => {
            const variantes: VarianteDoPainel[] = p.variants.map((v) => ({
              id: v.id,
              tamanho: v.size,
              cor: v.colorName,
              corHex: v.colorHex,
              precoProprioCentavos: v.priceCents,
              disponivel: v.available,
            }))

            // Uma vez só: alimenta tanto o "Editar" do cabeçalho quanto o de
            // cada linha da grade — os dois abrem o mesmo formulário.
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

            return (
              <Painel
                key={p.id}
                titulo={p.name}
                acao={
                  <div className="flex flex-wrap items-center gap-3">
                    <BotoesDeOrdem colecao="products" ids={ordemAtual} id={p.id} rotulo={p.name} />

                    <BotaoDestaque
                      colecao="products"
                      id={p.id}
                      destacado={p.featured}
                      rotulo={p.name}
                    />

                    <Rotulo>
                      {ROTULO_CATEGORIA[p.category] ?? p.category} · {formatarBRL(p.priceCents)}
                    </Rotulo>
                    {p.status === 'DRAFT' && (
                      <span className="border-caqui-ink-900 text-micro border px-1.5 py-0.5 font-mono uppercase">
                        Rascunho
                      </span>
                    )}
                    <BotaoEditarProduto produto={produtoParaEditar} />
                    {ehOwner && (
                      <ArquivarItem
                        colecao="products"
                        id={p.id}
                        nome={p.name}
                        consequencia="Ela sai da loja e desta lista."
                      >
                        <p>
                          As {p.variants.length} variante(s) somem junto. A mochila de quem já tinha
                          adicionado avisa que a peça saiu de linha, em vez de quebrar.
                        </p>
                        <p className="mt-2">
                          Se for falta de estoque, marque as variantes como esgotadas em vez de
                          arquivar. Aquilo volta em um toque.
                        </p>
                      </ArquivarItem>
                    )}

                    <Link
                      href={`/wear/${p.slug}`}
                      target="_blank"
                      className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
                    >
                      Ver
                    </Link>
                  </div>
                }
              >
                <TabelaDeVariantes
                  variantes={variantes}
                  precoBaseCentavos={p.priceCents}
                  produto={produtoParaEditar}
                />

                {/* ── Qual foto é de qual cor ──────────────────────────────
                    Pedido do cliente em 18/08/2026. Fica junto das variantes
                    de propósito: a cor que o seletor oferece É a da tabela
                    acima, e ver as duas na mesma tela é o que impede alguém de
                    procurar uma cor que ainda não cadastrou. */}
                <div className="border-caqui-rule border-t">
                  <FotosDaPeca
                    fotos={fotosDaPeca(p.images)}
                    cores={[...new Set(p.variants.map((v) => v.colorName))]}
                    nomeDaPeca={p.name}
                  />
                </div>
              </Painel>
            )
          })}
        </div>
      )}

      {/* Fora do ramo vazio/cheio de propósito: a contagem precisa aparecer
          nos dois casos. "Nenhuma peça" é informação, não ausência dela. */}
      <Painel className="mt-3">
        <Paginacao
          fatia={fatia}
          itens="peças"
          href={(p) => (p <= 1 ? '/crm/produtos' : `/crm/produtos?pagina=${p}`)}
        />
      </Painel>
    </>
  )
}

/** Do banco para o que o seletor de cor precisa. */
function fotosDaPeca(
  imagens: { id: number; url: string; alt: string; colorName: string | null }[],
): FotoDaPeca[] {
  return imagens.map((m) => ({ id: m.id, url: m.url, alt: m.alt, cor: m.colorName }))
}
