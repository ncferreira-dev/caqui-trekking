import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { fecharSaida } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const corpoSchema = z
  .object({
    /** Quantas pessoas FORAM. Diferente de quantas fecharam: gente falta. */
    pessoas: z.number().int().min(0).max(999),
    /**
     * Receita e custo em CENTAVOS, e os dois são LANÇADOS.
     *
     * `preço x pessoas` está errado em quase toda saída real (desconto,
     * cortesia, criança, guia convidado, pagamento parcial) e calculado produz
     * um relatório de lucro bonito e falso, do tipo que alguém usa para decidir
     * preço.
     *
     * `null` é estado legítimo: "ainda não sei quanto custou". Diferente de
     * zero, e o relatório trata os dois de forma diferente.
     */
    receitaCentavos: z.number().int().min(0).nullable(),
    custoCentavos: z.number().int().min(0).nullable(),
    observacoes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()

/**
 * POST /api/admin/departures/:id/fechar
 *
 * O FECHAMENTO, depois de a saída acontecer.
 *
 * É o que tira a saída da fila "por fechar" do painel, e a fila é uma busca que
 * precisa voltar vazia, não um botão que alguém lembra de apertar.
 *
 * O serviço recusa fechar saída que ainda não aconteceu. O guard está lá e não
 * aqui porque a tela não é a única porta.
 *
 * ADMIN pode: quem guiou é quem sabe quantos foram.
 */
export const POST = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const departureId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const { pessoas, receitaCentavos, custoCentavos, observacoes } = validarOuFalhar(
    corpoSchema.safeParse(corpo),
  )

  const resultado = await fecharSaida(
    departureId,
    {
      attendeeCount: pessoas,
      revenueCents: receitaCentavos,
      costCents: custoCentavos,
      closingNotes: observacoes ?? null,
    },
    { userId: usuario.userId, ip: ipDaRequest(request) },
  )

  return ok(resultado)
})
