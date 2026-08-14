/**
 * Datas, num lugar só.
 *
 * Banco em UTC, exibição em America/Sao_Paulo. Sempre com `timeZone`
 * explícito — nunca dependendo do fuso da máquina ou do navegador.
 *
 * No projeto de referência, `grep timeZone` no código inteiro retornava zero e
 * o hack `new Date(x + 'T12:00:00')` estava replicado em quatro arquivos. Lá
 * isso era cosmético. Aqui a data É o produto: errar o dia da saída faz o
 * grupo perder a trilha.
 */

export const FUSO_BRASIL = 'America/Sao_Paulo'

/** 2026-08-15T09:00Z → "sábado, 15 de agosto" */
export function dataPorExtenso(instante: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(instante)
}

/** 2026-08-15T09:00Z → "15/08/2026" */
export function dataCurta(instante: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(instante)
}

/**
 * 2026-08-15T09:00Z → "Sáb · 15 ago"
 *
 * O formato do card da agenda. O `Intl` em pt-BR devolve o dia da semana em
 * minúscula e com ponto ("sáb."); aqui ele sai capitalizado e sem ponto,
 * porque a linha inteira é caixa-alta no design e o ponto vira sujeira.
 */
export function diaEMes(instante: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).formatToParts(instante)

  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value.replace('.', '') ?? ''

  const semana = pegar('weekday')
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} · ${pegar('day')} ${pegar('month')}`
}

/**
 * 2026-08-15T09:00Z → { dia: "15", mes: "ago", semana: "Sáb" }
 *
 * O card da agenda mostra o dia em corpo grande e o mês embaixo, em peças
 * tipográficas separadas. Formatar a string inteira e depois fatiar seria
 * frágil — `Intl` muda a ordem e a pontuação conforme o locale.
 */
export function partesDaData(instante: Date): { dia: string; mes: string; semana: string } {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).formatToParts(instante)

  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value.replace('.', '') ?? ''

  const semana = pegar('weekday')
  return {
    dia: pegar('day'),
    mes: pegar('month'),
    semana: `${semana.charAt(0).toUpperCase()}${semana.slice(1)}`,
  }
}

/** 2026-08-15T09:00Z → "06:00" */
export function horaLocal(instante: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    hour: '2-digit',
    minute: '2-digit',
  }).format(instante)
}

/**
 * ISO com offset local explícito: "2026-08-15T06:00:00-03:00".
 *
 * É o formato que o JSON-LD de `Event` exige no `startDate`. Com `Z` ou com
 * data nua, o Google exibe o horário errado no rich result.
 */
export function isoComOffsetLocal(instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASIL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instante)

  const p = (tipo: string): string => partes.find((x) => x.type === tipo)?.value ?? '00'
  const offset = offsetLocal(instante)
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:${p('second')}${offset}`
}

/** Offset de São Paulo no instante dado, no formato "-03:00". */
function offsetLocal(instante: Date): string {
  const nome = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_BRASIL,
    timeZoneName: 'longOffset',
  })
    .formatToParts(instante)
    .find((x) => x.type === 'timeZoneName')?.value

  // "GMT-03:00" → "-03:00". O Brasil não tem horário de verão desde 2019, mas
  // derivar em vez de fixar mantém o helper correto se isso mudar.
  const match = nome?.match(/GMT([+-]\d{2}:\d{2})/)
  return match?.[1] ?? '-03:00'
}

/** Uma saída está encerrada quando já começou. Derivado, nunca gravado. */
export function jaEncerrada(startAt: Date, agora: Date = new Date()): boolean {
  return startAt.getTime() < agora.getTime()
}

/** O offset de São Paulo, em minutos, no instante dado. */
function offsetEmMinutos(instante: Date): number {
  const texto = offsetLocal(instante)
  const sinal = texto.startsWith('-') ? -1 : 1
  return sinal * (Number(texto.slice(1, 3)) * 60 + Number(texto.slice(4, 6)))
}

/**
 * O caminho INVERSO do resto deste arquivo: hora de parede de São Paulo → o
 * instante UTC correspondente.
 *
 * `instanteLocal('2026-08-01T00:00:00')` devolve o momento exato em que começa
 * agosto em Mogi das Cruzes. É o que a agenda precisa para recortar um mês: o
 * limite de um mês é um instante, e `new Date('2026-08-01')` devolve a
 * meia-noite em UTC — três horas ANTES, o que arrasta uma saída do dia 31 de
 * julho às 22h para dentro de agosto.
 *
 * As duas passadas existem para o caso de o limite cair perto de uma virada de
 * offset: o offset do palpite pode não ser o do instante real. O Brasil não
 * tem horário de verão desde 2019, mas a lei já mudou duas vezes e derivar
 * custa uma chamada a mais.
 */
export function instanteLocal(parede: string): Date {
  const palpite = new Date(`${parede}Z`)
  const aproximado = new Date(palpite.getTime() - offsetEmMinutos(palpite) * 60_000)
  return new Date(palpite.getTime() - offsetEmMinutos(aproximado) * 60_000)
}

/** "2026-08" → o instante do primeiro e do último milissegundo do mês. */
export function intervaloDoMes(chave: string): { de: Date; ate: Date } {
  const ano = Number(chave.slice(0, 4))
  const mes = Number(chave.slice(5, 7))
  const seguinte = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`

  return {
    de: instanteLocal(`${chave}-01T00:00:00`),
    ate: new Date(instanteLocal(`${seguinte}-01T00:00:00`).getTime() - 1),
  }
}

/** O instante em que começou o mês que contém `instante`, em São Paulo. */
export function inicioDoMes(instante: Date): Date {
  return intervaloDoMes(chaveMes(instante)).de
}

/**
 * "2026-08" → "agosto de 2026".
 *
 * Formata a partir do DIA 15 ao meio-dia, e não do dia 1º à meia-noite: o meio
 * do mês está a duas semanas de qualquer borda de fuso, então nenhum ajuste de
 * offset pode empurrá-lo para o mês vizinho.
 */
export function mesPorExtenso(chave: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    month: 'long',
    year: 'numeric',
  }).format(instanteLocal(`${chave}-15T12:00:00`))
}

/** Chave de agrupamento por mês em São Paulo: "2026-08". */
export function chaveMes(instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASIL,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instante)
  const ano = partes.find((x) => x.type === 'year')?.value ?? '0000'
  const mes = partes.find((x) => x.type === 'month')?.value ?? '00'
  return `${ano}-${mes}`
}
