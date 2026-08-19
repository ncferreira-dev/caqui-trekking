import { FUSO_BRASIL, instanteLocal } from '@/lib/datetime'

/**
 * A grade do calendário.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DUAS ARITMÉTICAS DIFERENTES, E CONFUNDI-LAS É O DEFEITO
 * ────────────────────────────────────────────────────────────────────────────
 * Este arquivo faz duas contas que parecem a mesma e não são:
 *
 *  1. **A grade** (`diasDaGradeDoMes`) é calendário CIVIL. "Que dia da semana
 *     cai 1º de agosto de 2026" tem a mesma resposta em Mogi, em Lisboa e em
 *     Auckland. Fuso não entra, e por isso a conta aqui é aritmética de
 *     inteiros em UTC, sem `Intl` e sem `new Date(ano, mes, dia)` — este
 *     último usa o fuso da MÁQUINA e devolveria o dia 31 do mês anterior em
 *     qualquer servidor a leste de Greenwich.
 *
 *  2. **A localização de um instante na grade** (`chaveDia`) é fuso puro. Uma
 *     saída gravada como `2026-08-16T02:00:00Z` acontece no dia 15 em Mogi, e
 *     é na célula do dia 15 que ela precisa aparecer. Aqui `Intl` com
 *     `timeZone` explícito é obrigatório.
 *
 * Misturar as duas produz o erro mais barato de escrever e mais caro deste
 * projeto: a saída no dia errado do calendário. Ver `src/lib/datetime.ts`,
 * que carrega o mesmo cuidado para a lista.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE 42 CÉLULAS SEMPRE, E NÃO "AS SEMANAS QUE PRECISAR"
 * ────────────────────────────────────────────────────────────────────────────
 * Um mês ocupa 4, 5 ou 6 semanas conforme o dia da semana em que começa.
 * Gerando só as semanas necessárias, a grade muda de altura ao trocar de mês,
 * e tudo o que está abaixo dela pula. Seis semanas fixas custam alguns dias
 * apagados do mês vizinho e compram uma página que não se move.
 */

/** Seis semanas. A grade nunca tem outro tamanho. */
export const DIAS_NA_GRADE = 42

/** Domingo primeiro: é como o calendário brasileiro abre a semana. */
export const NOMES_DAS_COLUNAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export type DiaDaGrade = {
  /** "2026-08-15". Ordenável como string, agrupável sem passar por fuso. */
  chave: string
  /** O numeral que aparece na célula: 1 a 31. */
  dia: number
  /** `false` nos dias do mês vizinho que completam a primeira e a última semana. */
  doMes: boolean
}

/** "2026-08-15" → "2026-08". */
export function mesDaChaveDia(chave: string): string {
  return chave.slice(0, 7)
}

/** Aritmética civil: `Date.UTC` e nada mais. Ver o cabeçalho. */
function chaveDeUtc(instante: Date): string {
  const ano = String(instante.getUTCFullYear()).padStart(4, '0')
  const mes = String(instante.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(instante.getUTCDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Os 42 dias da grade de um mês, começando no domingo anterior ou igual ao 1º.
 *
 * `chave` é "2026-08".
 */
export function diasDaGradeDoMes(chave: string): DiaDaGrade[] {
  const ano = Number(chave.slice(0, 4))
  const mes = Number(chave.slice(5, 7))

  const primeiro = new Date(Date.UTC(ano, mes - 1, 1))
  // Quantos dias recuar para chegar no domingo. `getUTCDay` é 0 no domingo,
  // então o próprio 1º já abre a grade quando cai em domingo.
  const recuo = primeiro.getUTCDay()

  return Array.from({ length: DIAS_NA_GRADE }, (_, i) => {
    const dia = new Date(Date.UTC(ano, mes - 1, 1 - recuo + i))
    return {
      chave: chaveDeUtc(dia),
      dia: dia.getUTCDate(),
      doMes: dia.getUTCMonth() === mes - 1 && dia.getUTCFullYear() === ano,
    }
  })
}

/**
 * O dia civil, em São Paulo, em que um instante cai. "2026-08-15".
 *
 * `en-CA` porque esse locale já escreve a data em ordem ISO; as partes são
 * remontadas à mão mesmo assim, para nenhuma mudança de formatação do ICU
 * conseguir trocar a ordem em silêncio.
 */
export function chaveDia(instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASIL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante)

  const p = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((x) => x.type === tipo)?.value ?? '00'

  return `${p('year')}-${p('month')}-${p('day')}`
}

/**
 * Agrupa por dia preservando a ordem de chegada.
 *
 * `Map` e não objeto, pela mesma razão do agrupamento por mês da agenda: as
 * chaves parecem numéricas o bastante para um objeto reordená-las, e a ordem
 * de inserção É a cronologia quando a consulta já veio ordenada.
 */
export function agruparPorDia<T>(
  itens: readonly T[],
  chaveDe: (item: T) => string,
): Map<string, T[]> {
  const porDia = new Map<string, T[]>()
  for (const item of itens) {
    const chave = chaveDe(item)
    const lista = porDia.get(chave)
    if (lista) lista.push(item)
    else porDia.set(chave, [item])
  }
  return porDia
}

/**
 * "2026-08-15" → "sábado, 15 de agosto de 2026".
 *
 * Formata a partir do MEIO-DIA local, e não da meia-noite: o meio do dia está
 * a doze horas de qualquer borda de fuso, então nenhum ajuste de offset pode
 * empurrar a data para a véspera. É o mesmo cuidado que `mesPorExtenso` toma
 * ao formatar o dia 15.
 */
export function diaPorExtenso(chave: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instanteLocal(`${chave}T12:00:00`))
}

/** "2026-08-15" → "15/08". O que cabe numa célula estreita. */
export function diaEMesCurto(chave: string): string {
  return `${chave.slice(8, 10)}/${chave.slice(5, 7)}`
}

/**
 * A mensagem que abre no WhatsApp quando a pessoa toca num dia SEM saída.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PEDIDO DO CLIENTE, E POR QUE ELE É UM FORMULÁRIO E NÃO UMA FRASE
 * ────────────────────────────────────────────────────────────────────────────
 * "Clicando num dia sem saída, dispara uma mensagem de WhatsApp já preenchida
 * com aquele dia" (18/08/2026). A tentação é mandar só "Tem saída no dia 15?",
 * e a resposta a isso é sempre outra pergunta.
 *
 * A Caqui atende no celular, entre uma trilha e outra. A diferença entre
 * receber "tem no dia 15?" e receber dia, número de pessoas e região é a
 * diferença entre dez mensagens e um orçamento. A estrutura é a mesma de
 * `/guia-particular`, de propósito: quem responde já conhece o formato.
 *
 * Sem travessão, como todo texto que o cliente lê neste projeto.
 */
export function mensagemDeDiaLivre(chave: string): string {
  return (
    'Olá! Vim pela agenda do site.\n\n' +
    `Dia que eu queria: ${diaPorExtenso(chave)}\n` +
    'Quantas pessoas: \n' +
    'Trilha ou região: '
  )
}
