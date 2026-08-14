import { z } from 'zod'

/**
 * O schema das variantes e do produto, num módulo só.
 *
 * Mora fora das rotas porque as duas — POST (criar) e PATCH (editar) — validam
 * a mesma forma de variante, e um schema duplicado é a origem clássica de
 * divergência: alguém aperta o limite de cor no criar e esquece no editar, e a
 * regra passa a valer só na metade dos caminhos.
 */

const HEX = /^#[0-9a-fA-F]{6}$/

export const varianteSchema = z.object({
  size: z.enum(['PP', 'P', 'M', 'G', 'GG', 'XG', 'UNICO']),
  colorName: z.string().trim().min(1, 'A cor precisa de um nome.').max(60),
  colorHex: z.string().regex(HEX, 'Cor em hex #RRGGBB.').nullable().optional(),
  // `null` = herda o preço do produto. Só sai do banco quando a variante
  // realmente foge do preço base.
  priceCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  available: z.boolean().optional(),
})

export const criarProdutoSchema = z.object({
  name: z.string().trim().min(2, 'O nome é obrigatório.').max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.enum(['CAMISETA', 'REGATA', 'MOCHILA', 'BONE', 'ACESSORIO']),
  priceCents: z.number().int().min(0).max(100_000_00),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  featured: z.boolean().optional(),
  variantes: z.array(varianteSchema).min(1, 'Cadastre ao menos uma variante.').max(50),
})

export const atualizarProdutoSchema = criarProdutoSchema.partial()
