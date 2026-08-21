import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FotosDaPeca, type FotoDaPeca } from '@/components/crm/fotos-da-peca'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = {
  title: 'Fotos da peça',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * As fotos da peça, em página própria — o segundo passo do cadastro.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE FOTO NÃO CABE NA TELA DE CADASTRAR
 * ════════════════════════════════════════════════════════════════════════════
 * O caminho do arquivo no provedor é `caqui/product/<id>/<aleatório>`. Antes de
 * salvar, a peça não tem id, e não existe "o id que ela vai ter": ele nasce no
 * `INSERT`.
 *
 * A alternativa seria subir para um lugar provisório e amarrar depois de
 * salvar. Foi recusada: toda desistência no meio do formulário deixaria
 * arquivo pago sem dono no Cloudinary, e o projeto de referência é a prova do
 * custo disso — as fotos de lá se chamam `product-0-1757796592563`, sem
 * vínculo recuperável com produto nenhum, e nenhuma pode ser apagada.
 *
 * Então a ordem é a natural: salva a peça, e a tela já abre aqui, com uma
 * gaveta por cor esperando foto. Ver `components/crm/fotos-da-peca.tsx`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A LISTA DE CORES VEM DAS VARIANTES, DEDUPLICADA
 * ════════════════════════════════════════════════════════════════════════════
 * Uma peça em P, M e G na cor Azul tem TRÊS variantes e UMA cor. Sem a
 * deduplicação, a tela mostraria a mesma gaveta três vezes, e a segunda foto
 * de Azul pareceria pertencer a outra coisa.
 */
export default async function PaginaFotosDaPeca({ params }: PageProps<'/crm/produtos/[id]/fotos'>) {
  await exigirSessaoDaPagina()

  const { id } = await params
  const produtoId = Number(id)
  if (!Number.isInteger(produtoId) || produtoId <= 0) notFound()

  const produto = await prisma.product.findFirst({
    // `deletedAt` no filtro, não só no `findUnique`: peça arquivada não deve
    // receber foto nova, e cair no 404 é a resposta certa.
    where: { id: produtoId, deletedAt: null },
    select: {
      id: true,
      name: true,
      images: {
        select: { id: true, url: true, alt: true, colorName: true },
        orderBy: { sortOrder: 'asc' },
      },
      variants: {
        select: { colorName: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!produto) notFound()

  const cores = Array.from(
    new Map(
      produto.variants
        .filter((v) => v.colorName.trim() !== '')
        .map((v) => [v.colorName.trim().toLocaleLowerCase('pt-BR'), v.colorName.trim()]),
    ).values(),
  )

  const fotos: FotoDaPeca[] = produto.images.map((i) => ({
    id: i.id,
    url: i.url,
    alt: i.alt,
    cor: i.colorName,
  }))

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-display-s uppercase">Fotos da peça</h1>
          <p className="text-caqui-ink-500 mt-1 text-sm">{produto.name}</p>
        </div>
        <Link
          href="/crm/produtos"
          className="border-caqui-sand-200 hover:bg-caqui-sand-100 rounded-lg border px-4 py-2 text-sm transition-colors"
        >
          Concluir
        </Link>
      </div>

      <FotosDaPeca produtoId={produto.id} fotos={fotos} cores={cores} nomeDaPeca={produto.name} />
    </div>
  )
}
