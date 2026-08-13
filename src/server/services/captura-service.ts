import { prisma } from '@/lib/prisma'

/**
 * Captura de contato e lead.
 *
 * As duas rotas de escrita pública da API. Ambas com rate limit no route
 * handler — o projeto de referência tinha um `POST /favorites` anônimo, sem
 * limite e sem verificar se o produto existia, que um loop de curl usava para
 * encher a cota do banco.
 */

export type NovaMensagem = {
  nome: string
  email?: string | undefined
  telefone?: string | undefined
  mensagem: string
  tripSlug?: string | undefined
}

export async function criarMensagemContato(dados: NovaMensagem): Promise<{ id: number }> {
  // Resolve o slug para id. Slug inexistente NÃO derruba a mensagem: a pessoa
  // escreveu, e perder o contato por causa de um vínculo opcional seria pior.
  let tripId: number | null = null
  if (dados.tripSlug) {
    const trip = await prisma.trip.findUnique({
      where: { slug: dados.tripSlug },
      select: { id: true },
    })
    tripId = trip?.id ?? null
  }

  const criada = await prisma.contactMessage.create({
    data: {
      name: dados.nome,
      email: dados.email ?? null,
      phone: dados.telefone ?? null,
      message: dados.mensagem,
      tripId,
    },
    select: { id: true },
  })

  return criada
}

export type NovoLead = {
  email?: string | undefined
  telefone?: string | undefined
  nome?: string | undefined
  origem: string
  /** Consentimento EXPLÍCITO. Sem `true`, o contato não pode virar campanha. */
  consentimento: boolean
}

export async function criarLead(dados: NovoLead): Promise<{ id: number }> {
  const criado = await prisma.lead.create({
    data: {
      email: dados.email ?? null,
      phone: dados.telefone ?? null,
      name: dados.nome ?? null,
      source: dados.origem,
      // LGPD: gravamos QUANDO a pessoa consentiu, não apenas que consentiu.
      // Sem consentimento o registro entra com `null`, e o CRM precisa
      // respeitar isso ao montar qualquer disparo.
      consentAt: dados.consentimento ? new Date() : null,
    },
    select: { id: true },
  })

  return criado
}
