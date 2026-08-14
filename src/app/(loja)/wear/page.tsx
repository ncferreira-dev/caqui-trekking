import type { Metadata } from 'next'
import Link from 'next/link'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { Etiqueta } from '@/components/ui/badge'
import { Card, CardCorpo, CardMidia, CardRodape } from '@/components/ui/card'
import { formatarBRL } from '@/lib/money'
import { listarProdutos } from '@/server/services/product-service'

export const metadata: Metadata = {
  title: 'Caqui Wear',
  description: 'Camisetas, baby looks, canecas e acessórios da Caqui Trekking.',
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DINÂMICA, E ISSO PRECISA SER DECLARADO
 * ────────────────────────────────────────────────────────────────────────────
 * Esta página não usa nenhuma API dinâmica do Next — só chama o serviço, que
 * fala direto com o Prisma. Sem `fetch` para o Next observar e sem `cookies()`
 * ou `searchParams`, ela é PRÉ-RENDERIZADA no build e servida do Full Route
 * Cache até o próximo deploy.
 *
 * Isso quebra a regra central do projeto: disponibilidade é editada à mão no
 * CRM, e `encerrada` é derivada de `new Date()` no momento do render. Estática,
 * a página serviria para sempre o estado do build — SOLD_OUT invisível, preço
 * reajustado que não chega, e saída já realizada listada como futura.
 *
 * É a mesma doutrina do carrinho, do outro lado: dado guardado envelhece.
 * As 30 rotas de `src/app/api/*` declaram o mesmo `force-dynamic` pelo mesmo
 * motivo.
 */
export const dynamic = 'force-dynamic'

/** Seletor de cor e tamanho, e o carrinho, são o PROMPT 09. */
export default async function PaginaWear() {
  const { produtos, total } = await listarProdutos({ limit: 40, offset: 0 })

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="A marca fora da trilha"
        titulo="Caqui Wear"
        descricao="Peças da Caqui em dry fit e poliamida, feitas para usar na trilha e depois dela."
        cota={`${total} ${total === 1 ? 'peça' : 'peças'}`}
      />

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        {produtos.length === 0 ? (
          <p className="text-caqui-ink-700 text-corpo-lg">Nenhuma peça publicada ainda.</p>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {produtos.map((produto) => (
              <li key={produto.slug}>
                <Link href={`/wear/${produto.slug}`} className="block h-full rounded-xs">
                  <Card interativo className="h-full">
                    <CardMidia proporcao="quadrado">
                      {produto.capa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={produto.capa.url}
                          alt={produto.capa.alt}
                          width={produto.capa.width}
                          height={produto.capa.height}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="bg-caqui-sand-200 size-full" />
                      )}
                    </CardMidia>

                    <CardCorpo>
                      <h2 className="text-display-s uppercase">{produto.nome}</h2>
                      {produto.cores.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {produto.cores.map((cor) => (
                            <Etiqueta key={cor.nome}>{cor.nome}</Etiqueta>
                          ))}
                        </div>
                      )}
                    </CardCorpo>

                    <CardRodape>
                      <span className="preco">{formatarBRL(produto.precoCentavos)}</span>
                    </CardRodape>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
