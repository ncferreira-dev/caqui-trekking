import type { Metadata } from 'next'
import Link from 'next/link'

import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { TabelaDeVariantes, type VarianteDoPainel } from '@/components/crm/tabela-de-variantes'
import { formatarBRL } from '@/lib/money'
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
export default async function PaginaProdutos() {
  await exigirSessaoDaPagina()

  const produtos = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      priceCents: true,
      status: true,
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
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    take: 100,
  })

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

            return (
              <Painel
                key={p.id}
                titulo={p.name}
                acao={
                  <div className="flex items-center gap-3">
                    <Rotulo>
                      {ROTULO_CATEGORIA[p.category] ?? p.category} · {formatarBRL(p.priceCents)}
                    </Rotulo>
                    {p.status === 'DRAFT' && (
                      <span className="border-caqui-ink-900 text-micro border px-1.5 py-0.5 font-mono uppercase">
                        Rascunho
                      </span>
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
                <TabelaDeVariantes variantes={variantes} precoBaseCentavos={p.priceCents} />
              </Painel>
            )
          })}
        </div>
      )}
    </>
  )
}
