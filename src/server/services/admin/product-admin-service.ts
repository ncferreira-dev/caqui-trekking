import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { slugUnico } from '@/lib/slug'
import { registrarAuditoria } from '@/server/services/audit-service'

/**
 * Cadastro e edição de produto da Caqui Wear.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PRODUTO É CRIADO COM SUAS VARIANTES, NUMA TRANSAÇÃO
 * ────────────────────────────────────────────────────────────────────────────
 * Uma peça sem variante não é comprável — o site não mostra botão de comprar
 * para ela. Então criar o produto e depois criar as variantes em duas
 * requisições deixaria, entre uma e outra, um produto publicado e inerte na
 * loja. Aqui as duas coisas caem na mesma transação: ou nasce vendável, ou não
 * nasce.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FOTO NÃO ENTRA AQUI
 * ────────────────────────────────────────────────────────────────────────────
 * A galeria (várias fotos por peça) é gerenciada pelo endpoint de mídia, que
 * depende do Cloudinary. Enquanto a credencial não existe, o produto é criado
 * sem imagem e a loja mostra o placeholder — melhor um catálogo navegável sem
 * foto do que um cadastro que trava esperando upload que não funciona.
 */

type Contexto = { userId: number; ip: string | null }

type Categoria = 'CAMISETA' | 'REGATA' | 'MOCHILA' | 'BONE' | 'ACESSORIO'
type Tamanho = 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'UNICO'

export type VarianteEntrada = {
  size: Tamanho
  colorName: string
  colorHex?: string | null
  /** `null` = usa o preço do produto. */
  priceCents?: number | null
  available?: boolean
}

export type CamposProduto = {
  name: string
  description?: string | null
  category: Categoria
  priceCents: number
  status?: 'DRAFT' | 'PUBLISHED'
  featured?: boolean
  variantes: VarianteEntrada[]
}

/**
 * Recusa variantes duplicadas ANTES da escrita.
 *
 * Duas linhas "M · Preto" estourariam o unique `(productId, size, colorName)`
 * do banco no meio da transação, e o erro cru de constraint vazaria. Aqui vira
 * uma mensagem que diz qual combinação repetiu. A comparação é sobre o par
 * normalizado, porque "Preto" e "preto " são a mesma cor para o comprador.
 */
function conferirVariantes(variantes: VarianteEntrada[]): void {
  if (variantes.length === 0) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      'A peça precisa de ao menos uma variante (tamanho e cor) para ser vendável.',
      { status: 400 },
    )
  }

  const vistas = new Set<string>()
  for (const v of variantes) {
    const chave = `${v.size}|${v.colorName.trim().toLowerCase()}`
    if (vistas.has(chave)) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Variante repetida: ${v.size} · ${v.colorName}. Cada combinação de tamanho e cor entra uma vez.`,
        { status: 400 },
      )
    }
    vistas.add(chave)
  }
}

export async function criarProduto(
  campos: CamposProduto,
  ctx: Contexto,
): Promise<{ id: number; slug: string }> {
  conferirVariantes(campos.variantes)

  // Lê os slugs existentes para garantir unicidade sem depender do erro de
  // constraint. Inclui os arquivados: reaproveitar o slug de uma peça
  // descontinuada roubaria a URL que ela ainda pode ter em links antigos.
  const usados = await prisma.product.findMany({ select: { slug: true } })
  const slug = slugUnico(
    campos.name,
    usados.map((p) => p.slug),
  )

  return prisma.$transaction(async (tx) => {
    const produto = await tx.product.create({
      data: {
        slug,
        name: campos.name,
        description: campos.description ?? null,
        category: campos.category,
        priceCents: campos.priceCents,
        status: campos.status ?? 'DRAFT',
        featured: campos.featured ?? false,
        variants: {
          create: campos.variantes.map((v, indice) => ({
            size: v.size,
            colorName: v.colorName.trim(),
            colorHex: v.colorHex ?? null,
            priceCents: v.priceCents ?? null,
            available: v.available ?? true,
            sortOrder: indice,
          })),
        },
      },
      select: { id: true, slug: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'product.create',
        entityType: 'Product',
        entityId: produto.id,
        after: { slug, nome: campos.name, variantes: campos.variantes.length },
        ip: ctx.ip,
      },
      tx,
    )

    return produto
  })
}

/**
 * Edita os dados da peça e reconcilia as variantes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * RECONCILIAÇÃO POR CHAVE NATURAL, NÃO "APAGA TUDO E RECRIA"
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo é `deleteMany` + `createMany` a cada salvamento. É errado por dois
 * motivos concretos: cada variante recriada ganha um id novo, e o
 * `DepartureAvailabilityChange`… não — mas o carrinho de quem já adicionou
 * aquela variante guarda o id ANTIGO, e ele passaria a apontar para o nada. E a
 * auditoria perderia a linha do tempo da variante.
 *
 * Então a reconciliação é por `(size, colorName)`, a chave que o comprador
 * enxerga: o que existe é atualizado, o que sumiu do formulário é removido, o
 * que é novo é criado. Variante que o cliente tem no carrinho e continua no
 * catálogo mantém o id.
 */
export async function atualizarProduto(
  productId: number,
  campos: Partial<Omit<CamposProduto, 'variantes'>> & { variantes?: VarianteEntrada[] },
  ctx: Contexto,
): Promise<{ id: number }> {
  const atual = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      priceCents: true,
      variants: { select: { id: true, size: true, colorName: true } },
    },
  })

  if (!atual) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Produto não encontrado.', { status: 404 })
  }

  if (campos.variantes) conferirVariantes(campos.variantes)

  return prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        ...(campos.name !== undefined ? { name: campos.name } : {}),
        ...(campos.description !== undefined ? { description: campos.description } : {}),
        ...(campos.category !== undefined ? { category: campos.category } : {}),
        ...(campos.priceCents !== undefined ? { priceCents: campos.priceCents } : {}),
        ...(campos.status !== undefined ? { status: campos.status } : {}),
        ...(campos.featured !== undefined ? { featured: campos.featured } : {}),
      },
    })

    if (campos.variantes) {
      const chaveDe = (size: string, cor: string) => `${size}|${cor.trim().toLowerCase()}`
      const existentePorChave = new Map(
        atual.variants.map((v) => [chaveDe(v.size, v.colorName), v.id]),
      )
      const chavesNovas = new Set(campos.variantes.map((v) => chaveDe(v.size, v.colorName)))

      // Remove as que sumiram do formulário.
      const remover = atual.variants.filter((v) => !chavesNovas.has(chaveDe(v.size, v.colorName)))
      if (remover.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: remover.map((v) => v.id) } } })
      }

      // Cria ou atualiza, preservando o id de quem permanece.
      for (const [indice, v] of campos.variantes.entries()) {
        const existenteId = existentePorChave.get(chaveDe(v.size, v.colorName))
        const dados = {
          colorHex: v.colorHex ?? null,
          priceCents: v.priceCents ?? null,
          available: v.available ?? true,
          sortOrder: indice,
        }
        if (existenteId) {
          await tx.productVariant.update({ where: { id: existenteId }, data: dados })
        } else {
          await tx.productVariant.create({
            data: { productId, size: v.size, colorName: v.colorName.trim(), ...dados },
          })
        }
      }
    }

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'product.update',
        entityType: 'Product',
        entityId: productId,
        before: { nome: atual.name, status: atual.status, priceCents: atual.priceCents },
        after: {
          nome: campos.name ?? atual.name,
          status: campos.status ?? atual.status,
          priceCents: campos.priceCents ?? atual.priceCents,
          ...(campos.variantes ? { variantes: campos.variantes.length } : {}),
        },
        ip: ctx.ip,
      },
      tx,
    )

    return { id: productId }
  })
}

/**
 * Arquivar peça. Soft delete, nunca `delete`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NÃO EXISTIA NEM NA API
 * ────────────────────────────────────────────────────────────────────────────
 * `products/[id]` tinha só `PATCH`. `Product.deletedAt` existia no schema e
 * era respeitado em toda leitura pública, e nada no sistema conseguia
 * escrevê-lo: a peça descontinuada só podia virar rascunho, o que a esconde da
 * loja e a mantém para sempre no meio da tela de quem opera.
 *
 * Hard delete não entra pelo mesmo motivo do roteiro: as variantes penduram
 * nela, e o carrinho de quem já adicionou aponta para o id. Uma peça apagada
 * de verdade viraria "item não encontrado" na mochila de um cliente.
 */
export async function arquivarProduto(productId: number, ctx: Contexto): Promise<{ id: number }> {
  const antes = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, name: true, status: true },
  })

  if (!antes) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Peça não encontrada.', { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED', deletedAt: new Date(), featured: false },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'product.archive',
        entityType: 'Product',
        entityId: productId,
        before: antes,
        after: { status: 'ARCHIVED', arquivada: true },
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}
