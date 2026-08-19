import type { Metadata } from 'next'

import { CardProduto } from '@/components/wear/card-produto'
import { FiltroDeCategoria } from '@/components/wear/filtro-categoria'
import { Vitrine } from '@/components/wear/vitrine'
import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { LinkBotao } from '@/components/ui/button'
import { categoriaProdutoSchema } from '@/lib/api/schemas'
import { metadataDaPagina } from '@/lib/seo/metadata'
import {
  categoriasDisponiveis,
  listarProdutos,
  ROTULO_CATEGORIA,
} from '@/server/services/product-service'

export const metadata: Metadata = metadataDaPagina({
  titulo: 'Caqui Wear · Loja oficial',
  descricao:
    'Caqui Wear: camiseta e baby look dry fit, regata, caneca e óculos da Caqui Trekking. A loja oficial da marca, para usar na trilha e fora dela.',
  caminho: '/wear',
})

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DINÂMICA, E ISSO PRECISA SER DECLARADO
 * ────────────────────────────────────────────────────────────────────────────
 * Preço e disponibilidade vêm do CRM. Pré-renderizada, a página serviria o
 * estado do build até o próximo deploy. Ver o mesmo bloco na home.
 */
export const dynamic = 'force-dynamic'

/**
 * A loja da marca.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A SUBMARCA É SUPERFÍCIE E ACENTO, NÃO OUTRA PALETA
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing pede "mesma família, identidade própria — sensação de trocar de
 * seção, não de empresa". O que muda aqui é o fundo (areia em vez de branco) e
 * o acento (verde da mata no rótulo e no filete). O preto do texto, a
 * tipografia, o chanfro do card e o laranja do botão continuam idênticos ao
 * resto do site.
 *
 * Os números estão medidos em `globals.css`, no utilitário `secao-wear`.
 */
export default async function PaginaWear({ searchParams }: PageProps<'/wear'>) {
  const params = await searchParams

  // Mesma disciplina da agenda: a query string é entrada não confiável, e
  // `categoria` vai para um filtro de enum que o Prisma valida em runtime.
  // Valor inválido degrada para "sem filtro", nunca para 500.
  const bruto = params['categoria']
  const categoria = categoriaProdutoSchema.safeParse(Array.isArray(bruto) ? bruto[0] : bruto).data

  const [{ produtos }, categorias] = await Promise.all([
    listarProdutos({ categoria, limit: 40, offset: 0 }),
    categoriasDisponiveis(),
  ])

  const totalGeral = categorias.reduce((n, c) => n + c.total, 0)

  return (
    <div className="secao-wear flex flex-1 flex-col">
      <CabecalhoDePagina
        sobretitulo="A marca fora da trilha"
        titulo="Caqui Wear"
        descricao="Peças em dry fit e poliamida, canecas e óculos com a marca gravada. Feito para usar na trilha e depois dela."
        cota={`${totalGeral} ${totalGeral === 1 ? 'peça' : 'peças'}`}
      />

      <FiltroDeCategoria categorias={categorias} atual={categoria} total={totalGeral} />

      <section className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        {produtos.length === 0 ? (
          <Vazia categoria={categoria} />
        ) : (
          <Vitrine>
            {produtos.map((produto, indice) => (
              <li
                key={produto.slug}
                // O NOME DA PEÇA NA TRANSIÇÃO.
                //
                // É o que permite ao navegador reconhecer que aquele card na
                // caixa antiga e este na caixa nova são a MESMA peça, e por
                // isso ele a move em vez de trocá-la. Sem isto, a troca de
                // densidade seria um `crossfade` da página inteira.
                //
                // Precisa ser único na página: dois elementos com o mesmo nome
                // cancelam a transição inteira, em silêncio. O slug é único por
                // definição no banco, e o prefixo garante que o nome nunca
                // comece com dígito, o que seria um identificador inválido.
                //
                // O escalonamento da entrada. `motion-safe:` e não uma regra de
                // reduced-motion depois: sem animação nenhuma, o item nasce
                // visível, sem depender de `animation-fill-mode`.
                //
                // O teto de 8 impede a última peça de um catálogo grande de
                // esperar meio segundo para aparecer.
                style={{
                  viewTransitionName: `peca-${produto.slug}`,
                  animationDelay: `${Math.min(indice, 8) * 45}ms`,
                }}
                className="motion-safe:animate-[caqui-entrada_420ms_var(--ease-saida)_both]"
              >
                <CardProduto produto={produto} prioridade={indice < 4} />
              </li>
            ))}
          </Vitrine>
        )}

        <p className="border-caqui-rule-wear text-caqui-ink-700 text-corpo-sm mt-14 border-t pt-6">
          O site não processa pagamento. Você monta o pedido na mochila e fecha na conversa do
          WhatsApp, com um guia, no mesmo fluxo das expedições.
        </p>
      </section>
    </div>
  )
}

function Vazia({ categoria }: { categoria: string | undefined }) {
  const rotulo = categoria ? (ROTULO_CATEGORIA[categoria] ?? categoria) : null

  return (
    <div className="border-caqui-rule-wear chanfro-md mx-auto max-w-xl border bg-white px-6 py-12 text-center">
      <p className="text-caqui-forest-800 text-rotulo font-mono uppercase">
        {rotulo ? `Nada em ${rotulo}` : 'Catálogo em montagem'}
      </p>
      <h2 className="text-display-s mt-3 uppercase">
        {rotulo ? 'Essa categoria está vazia' : 'Nenhuma peça publicada'}
      </h2>
      <p className="text-caqui-ink-700 text-corpo mt-4">
        {rotulo
          ? 'Ainda não há peça publicada nessa categoria. As outras continuam ali.'
          : 'As peças entram no catálogo assim que as fotos e os preços forem cadastrados.'}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <LinkBotao href="/wear">Ver tudo</LinkBotao>
        <LinkBotao href="/agenda" variante="secondary">
          Ver a agenda
        </LinkBotao>
      </div>
    </div>
  )
}
