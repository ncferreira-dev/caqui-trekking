/**
 * VAGAS: A CONTA QUE SUBSTITUIU UM CAMPO DIGITADO À MÃO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ESTE ARQUIVO CORRIGE
 * ════════════════════════════════════════════════════════════════════════════
 * Até 18/08/2026 a disponibilidade de uma saída era uma coluna que alguém
 * escolhia num select: disponível, últimas vagas, esgotado. O comentário do
 * próprio schema a descrevia como "o campo mais mexido do sistema".
 *
 * Campo mais mexido do sistema é a descrição de uma conta que alguém está
 * fazendo de cabeça, várias vezes por semana, sem rede. O modo de falhar é
 * óbvio em retrospecto: a Caqui fecha as vagas no WhatsApp, e entre fechar a
 * última e lembrar de abrir o CRM para marcar "esgotado" existe uma janela em
 * que o site anuncia vaga que já foi vendida.
 *
 * Aqui o selo passa a ser DERIVADO de dois números que o operador já ia anotar
 * de qualquer jeito: quantas cabem e quantas fecharam.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE A EXCEÇÃO CONTINUA EXISTINDO
 * ════════════════════════════════════════════════════════════════════════════
 * `override` não é um resquício do sistema antigo, é um caso real: fechar a
 * saída por chuva, por interdição do parque, por decisão do guia na véspera.
 * Nenhuma dessas razões aparece na conta de vagas, e forçá-las a caber ali
 * (marcando vagas fantasmas como vendidas) destruiria o número que o relatório
 * de lucro vai usar depois.
 *
 * Então: a conta manda, a exceção é declarada, e as duas ficam distinguíveis no
 * banco. Um `null` em `override` significa "vale a conta"; um valor significa
 * "alguém decidiu o contrário", e o histórico em `DepartureAvailabilityChange`
 * diz quem e por quê.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LÓGICA PURA, FORA DO FRAMEWORK
 * ════════════════════════════════════════════════════════════════════════════
 * Sem Prisma, sem React, sem fuso. Recebe número, devolve número. É o que faz
 * o selo do site, o selo do CRM e o relatório concordarem: os três chamam a
 * mesma função, em vez de cada um repetir a regra com uma diferença sutil.
 */

/** Os três estados que o site sabe mostrar. */
export type Disponibilidade = 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'

export type EstadoDeVagas = {
  /** O selo que o site mostra. */
  disponibilidade: Disponibilidade
  /**
   * Quantas vagas sobraram. `null` quando a saída não declara capacidade.
   *
   * Nunca negativo: com overbooking a resposta útil é "zero", e o excedente
   * vive em `excedente`, separado, porque são duas informações diferentes para
   * dois públicos diferentes.
   */
  restantes: number | null
  /** Quantas passaram da capacidade. Zero quando não há overbooking. */
  excedente: number
  /** `true` quando o selo veio de uma decisão humana, não da conta. */
  porExcecao: boolean
}

export type EntradaDeVagas = {
  /** Quantas pessoas cabem. `null` = não declarado. */
  capacity: number | null
  /** Quantas já fecharam, lançadas pelo operador. */
  seatsTaken: number
  /** A partir de quantas restantes o selo vira "últimas vagas". */
  lastSpotsAt: number
  /** A exceção declarada. `null` = vale a conta. */
  availabilityOverride: Disponibilidade | null
}

export function estadoDeVagas(entrada: EntradaDeVagas): EstadoDeVagas {
  const { capacity, seatsTaken, lastSpotsAt, availabilityOverride } = entrada

  // Sem capacidade declarada não há conta a fazer. A saída volta a depender do
  // campo manual, exatamente como antes — é isto que permite a migração não
  // quebrar nenhuma das saídas já cadastradas.
  if (capacity === null) {
    return {
      disponibilidade: availabilityOverride ?? 'AVAILABLE',
      restantes: null,
      excedente: 0,
      porExcecao: availabilityOverride !== null,
    }
  }

  const saldo = capacity - seatsTaken
  const restantes = Math.max(0, saldo)
  const excedente = Math.max(0, -saldo)

  // A exceção vence a conta, e é o único lugar onde isso acontece.
  if (availabilityOverride !== null) {
    return { disponibilidade: availabilityOverride, restantes, excedente, porExcecao: true }
  }

  const disponibilidade: Disponibilidade =
    restantes === 0 ? 'SOLD_OUT' : restantes <= lastSpotsAt ? 'LAST_SPOTS' : 'AVAILABLE'

  return { disponibilidade, restantes, excedente, porExcecao: false }
}

/**
 * O lucro de uma saída fechada.
 *
 * Devolve `null` enquanto os dois lados não estiverem lançados. Tratar ausência
 * como zero é o defeito clássico do relatório financeiro: uma saída sem custo
 * lançado apareceria como a mais lucrativa do mês, e a lista ordenada por lucro
 * colocaria o dado que falta no topo.
 */
export function lucroCentavos(entrada: {
  revenueCents: number | null
  costCents: number | null
}): number | null {
  if (entrada.revenueCents === null || entrada.costCents === null) return null
  return entrada.revenueCents - entrada.costCents
}

/**
 * A ocupação, de 0 a 1. `null` sem capacidade ou sem presença lançada.
 *
 * Usa `attendeeCount` (quem foi) e não `seatsTaken` (quem fechou): ocupação é
 * sobre o ônibus que saiu, não sobre a lista de espera.
 */
export function taxaDeOcupacao(entrada: {
  capacity: number | null
  attendeeCount: number | null
}): number | null {
  const { capacity, attendeeCount } = entrada
  if (capacity === null || attendeeCount === null || capacity <= 0) return null
  return attendeeCount / capacity
}
