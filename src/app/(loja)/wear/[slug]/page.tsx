import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { GaleriaDoProduto } from '@/components/wear/galeria-produto'
import { SeletorDeVariante } from '@/components/wear/seletor-de-variante'
import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { Acordeao, AcordeaoItem } from '@/components/ui/acordeao'
import { Etiqueta } from '@/components/ui/badge'
import { JsonLdScript } from '@/components/seo/json-ld'
import { Compartilhar } from '@/components/ui/compartilhar'
import { AppError } from '@/lib/api/errors'
import { migalhas, produtoJsonLd } from '@/lib/seo/json-ld'
import { metadataDaPagina } from '@/lib/seo/metadata'
import { URL_BASE } from '@/lib/seo/site'
import { buscarProdutoPorSlug, ROTULO_CATEGORIA } from '@/server/services/product-service'
import type { ProdutoDetalheDTO } from '@/server/dto/public-dto'

export async function generateMetadata({ params }: PageProps<'/wear/[slug]'>): Promise<Metadata> {
  const { slug } = await params

  try {
    const produto = await buscarProdutoPorSlug(slug)
    return metadataDaPagina({
      titulo: produto.nome,
      descricao:
        produto.descricao ??
        `${produto.nome} da Caqui Wear. Peça com a marca gravada, feita para a trilha e para o dia a dia.`,
      caminho: `/wear/${produto.slug}`,
    })
  } catch {
    return { title: 'Peça não encontrada' }
  }
}

/**
 * Detalhe da peça.
 *
 * A ordem responde ao que a pessoa pergunta comprando roupa online, nesta
 * ordem: "como é?" (galeria com zoom), "serve em mim?" (tamanho, cor e a
 * tabela de medidas), "do que é feito?" (composição e cuidados).
 *
 * A composição e os cuidados são derivados da CATEGORIA e do que o CRM
 * escreveu na descrição — não existe campo `composicao` no schema, e inventar
 * um texto fixo aqui criaria conteúdo que envelhece sem ninguém perceber. É a
 * mesma decisão da FAQ da expedição; ver docs/08-catalogo.md.
 */
export default async function PaginaDoProduto({ params }: PageProps<'/wear/[slug]'>) {
  const { slug } = await params

  let produto: ProdutoDetalheDTO
  try {
    produto = await buscarProdutoPorSlug(slug)
  } catch (erro) {
    if (erro instanceof AppError) notFound()
    throw erro
  }

  const disponiveis = produto.variantes.filter((v) => v.disponivel)

  const dadosEstruturados = [
    produtoJsonLd(URL_BASE, produto),
    migalhas(URL_BASE, [
      { nome: 'Início', caminho: '/' },
      { nome: 'Caqui Wear', caminho: '/wear' },
      { nome: produto.nome, caminho: `/wear/${produto.slug}` },
    ]),
  ]

  return (
    <div className="secao-wear flex flex-1 flex-col">
      <JsonLdScript dados={dadosEstruturados} />

      <CabecalhoDePagina
        sobretitulo={
          <>
            <Link href="/wear" className="rounded-xs underline underline-offset-4">
              Caqui Wear
            </Link>
            {` · ${ROTULO_CATEGORIA[produto.categoria] ?? produto.categoria}`}
          </>
        }
        titulo={produto.nome}
      />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:gap-14">
        <GaleriaDoProduto imagens={produto.imagens} nome={produto.nome} />

        <div className="flex flex-col gap-8 lg:sticky lg:top-24 lg:h-fit">
          {disponiveis.length === 0 && (
            <p
              role="status"
              className="border-caqui-danger text-corpo-sm border-l-4 bg-white px-4 py-3"
            >
              Todas as combinações desta peça estão esgotadas no momento. Chame no WhatsApp. A
              Caqui avisa quando repõe.
            </p>
          )}

          <SeletorDeVariante produto={produto} />

          {/* Logo abaixo do botão de comprar: é ali que a pessoa para quando
              gosta da peça mas quer perguntar o tamanho para alguém antes. */}
          <Compartilhar
            titulo={produto.nome}
            texto={`${produto.nome}, da Caqui Wear.`}
            className="self-start"
          />

          {produto.descricao && (
            <p className="text-corpo whitespace-pre-line">{produto.descricao}</p>
          )}

          <Acordeao>
            <AcordeaoItem grupo="peca" titulo="Composição e cuidados">
              <Cuidados categoria={produto.categoria} />
            </AcordeaoItem>
            <AcordeaoItem grupo="peca" titulo="Como recebo">
              <p>
                Nada é cobrado no site. Você monta o pedido na mochila e finaliza pelo WhatsApp; a
                entrega é combinada ali: retirada em Mogi das Cruzes, entrega numa saída da agenda,
                ou envio, conforme o caso.
              </p>
            </AcordeaoItem>
            <AcordeaoItem grupo="peca" titulo="Troca">
              <p>
                Deu errado no tamanho? Fale com a Caqui pelo mesmo WhatsApp do pedido. Peça sem uso
                e com etiqueta é trocada sem discussão. Por isso a tabela de medidas existe, para a
                troca ser rara.
              </p>
            </AcordeaoItem>
          </Acordeao>

          {produto.cores.length > 0 && (
            <div>
              <h2 className="text-caqui-forest-800 text-rotulo font-mono uppercase">
                Cores disponíveis
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {produto.cores.map((cor) => (
                  <Etiqueta key={cor.nome} tom="mata">
                    {cor.nome}
                  </Etiqueta>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Composição e cuidados, derivados da categoria.
 *
 * Não existe campo no schema, e um bloco de texto fixo por produto
 * envelheceria sem ninguém perceber — "100% poliéster" numa peça que a Caqui
 * trocou para poliamida é informação errada com cara de informação certa.
 *
 * Derivar da categoria mantém o texto verdadeiro para a classe inteira de
 * peças. Quando a Caqui quiser composição por produto, vira campo no CRM.
 */
function Cuidados({ categoria }: { categoria: string }) {
  if (categoria === 'CAMISETA' || categoria === 'REGATA') {
    return (
      <ul className="list-inside list-disc space-y-1">
        <li>Malha dry fit ou poliamida, conforme a peça. Confira na descrição acima.</li>
        <li>Lave à mão ou em máquina no ciclo delicado, com água fria.</li>
        <li>Não use alvejante e não passe sobre a estampa.</li>
        <li>Seque à sombra: sol direto desbota a serigrafia.</li>
      </ul>
    )
  }

  if (categoria === 'ACESSORIO') {
    return (
      <ul className="list-inside list-disc space-y-1">
        <li>Limpe com a flanela que acompanha o produto, quando houver.</li>
        <li>Evite deixar no painel do carro: calor deforma armação e cola.</li>
        <li>Guarde no estojo, que é o que preserva a lente.</li>
      </ul>
    )
  }

  return (
    <p>
      Cuidados específicos desta peça são combinados na conversa do WhatsApp. Pergunte antes de
      fechar se tiver dúvida.
    </p>
  )
}
