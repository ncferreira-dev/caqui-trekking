/**
 * Dinheiro, num lugar só.
 *
 * Todo valor monetário do sistema é `Int` de centavos. A conversão para reais
 * acontece AQUI e em nenhum outro lugar — nem em componente, nem em builder de
 * JSON-LD, nem em serviço.
 *
 * No projeto de referência, `formatBRL` existia num utilitário e foi reescrito
 * à mão em outros 9 lugares, sendo que a variante usada justamente no carrinho
 * não punha separador de milhar: uma expedição de R$ 5.400 apareceria como
 * "R$ 5400,00". O ESLint deste projeto bloqueia `toFixed` para forçar a
 * passagem por aqui.
 */

const formatador = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** 19990 → "R$ 199,90" */
export function formatarBRL(centavos: number): string {
  return formatador.format(centavos / 100)
}

/**
 * 19990 → "199.90"
 *
 * Formato exigido por schema.org e por feeds: ponto decimal, duas casas, sem
 * símbolo. A divisão por 100 acontece uma vez só, aqui.
 */
export function centavosParaDecimal(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const inteiro = Math.floor(abs / 100)
  const resto = abs % 100
  return `${sinal}${inteiro}.${String(resto).padStart(2, '0')}`
}

/** Soma em centavos. Existe para o cálculo ficar explicitamente inteiro. */
export function somarCentavos(valores: readonly number[]): number {
  return valores.reduce((total, v) => total + v, 0)
}

/** Preço da variante quando ela sobrescreve, senão o do produto. */
export function precoEfetivo(precoBase: number, precoVariante: number | null): number {
  return precoVariante ?? precoBase
}
