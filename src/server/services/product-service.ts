import { AppError, ErrorCode } from '@/lib/api/errors'
import { centavosParaDecimal, precoEfetivo } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import {
  paraMediaDTO,
  type ProdutoDetalheDTO,
  type ProdutoResumoDTO,
  type VarianteDTO,
} from '@/server/dto/public-dto'
import { SELECT_MEDIA } from '@/server/services/selects'

export type FiltrosProduto = {
  categoria?: string | undefined
  limit: number
  offset: number
}

export async function listarProdutos(
  filtros: FiltrosProduto,
): Promise<{ produtos: ProdutoResumoDTO[]; total: number }> {
  const where = {
    status: 'PUBLISHED' as const,
    deletedAt: null,
    ...(filtros.categoria ? { category: filtros.categoria as never } : {}),
  }

  const [linhas, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        slug: true,
        name: true,
        category: true,
        priceCents: true,
        images: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' }, take: 1 },
        variants: {
          select: { colorName: true, colorHex: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      take: filtros.limit,
      skip: filtros.offset,
    }),
    prisma.product.count({ where }),
  ])

  const produtos = linhas.map((p): ProdutoResumoDTO => {
    // Cores distintas, preservando a ordem de exibição definida no CRM.
    const vistas = new Set<string>()
    const cores: { nome: string; hex: string | null }[] = []
    for (const v of p.variants) {
      if (vistas.has(v.colorName)) continue
      vistas.add(v.colorName)
      cores.push({ nome: v.colorName, hex: v.colorHex })
    }

    return {
      slug: p.slug,
      nome: p.name,
      categoria: p.category,
      precoCentavos: p.priceCents,
      precoDecimal: centavosParaDecimal(p.priceCents),
      capa: p.images[0] ? paraMediaDTO(p.images[0]) : null,
      cores,
    }
  })

  return { produtos, total }
}

export async function buscarProdutoPorSlug(slug: string): Promise<ProdutoDetalheDTO> {
  const p = await prisma.product.findFirst({
    where: { slug, status: 'PUBLISHED', deletedAt: null },
    select: {
      slug: true,
      name: true,
      description: true,
      category: true,
      priceCents: true,
      images: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' } },
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
  })

  if (!p) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Produto não encontrado.', { status: 404 })
  }

  // TODAS as variantes saem, inclusive as indisponíveis, com o flag
  // `disponivel`. Combinação esgotada NÃO some da UI: ela aparece desabilitada,
  // porque a pessoa precisa saber que aquele tamanho e aquela cor existem.
  const variantes = p.variants.map((v): VarianteDTO => ({
    id: v.id,
    tamanho: v.size,
    cor: v.colorName,
    corHex: v.colorHex,
    precoCentavos: precoEfetivo(p.priceCents, v.priceCents),
    disponivel: v.available,
  }))

  const vistas = new Set<string>()
  const cores: { nome: string; hex: string | null }[] = []
  for (const v of p.variants) {
    if (vistas.has(v.colorName)) continue
    vistas.add(v.colorName)
    cores.push({ nome: v.colorName, hex: v.colorHex })
  }

  return {
    slug: p.slug,
    nome: p.name,
    descricao: p.description,
    categoria: p.category,
    precoCentavos: p.priceCents,
    precoDecimal: centavosParaDecimal(p.priceCents),
    capa: p.images[0] ? paraMediaDTO(p.images[0]) : null,
    imagens: p.images.map(paraMediaDTO),
    cores,
    variantes,
  }
}
