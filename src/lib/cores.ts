/**
 * Nome de cor para código hexadecimal.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * O cadastro de variante pedia o nome da cor E o código hexadecimal, em campos
 * separados e independentes. Quem cadastra sabe dizer "azul marinho" de cabeça;
 * ninguém sabe dizer "#1B2A4A". O resultado era a amostra ficar preta em quase
 * toda variante, porque `#000000` é o padrão do seletor e ninguém ia caçar o
 * tom na roda de cor.
 *
 * Aqui o nome digitado sugere o tom, e a pessoa corrige depois se quiser. A
 * sugestão é um palpite de partida, não uma regra: a estamparia manda o código
 * exato quando importa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FUNÇÃO PURA, FORA DO COMPONENTE
 * ────────────────────────────────────────────────────────────────────────────
 * Sem React, sem banco. Recebe texto, devolve texto. É o que permite testar a
 * tabela inteira sem montar formulário nenhum, e é o que faz a mesma sugestão
 * valer se um dia isso for usado na importação em massa ou no seed.
 */

/**
 * A tabela. Nomes em português, como a Caqui escreve no cadastro.
 *
 * Os tons são de vestuário, não de tela: "vermelho" de camiseta é um vermelho
 * fechado, não `#FF0000`, que na malha não existe.
 */
const TABELA: Readonly<Record<string, string>> = {
  // Neutros
  preto: '#1A1A1A',
  branco: '#FFFFFF',
  'off white': '#F4F1EA',
  cru: '#EFE7D8',
  creme: '#F2E8D5',
  bege: '#E0CFB4',
  areia: '#D9C7A7',
  nude: '#E0BC9C',
  cinza: '#8A8A8A',
  'cinza claro': '#C9C9C9',
  'cinza escuro': '#4A4A4A',
  'cinza mescla': '#B0AEA9',
  mescla: '#B0AEA9',
  'cinza prata': '#C0C0C0',
  prata: '#C0C0C0',
  grafite: '#3A3A3A',
  chumbo: '#4C5359',

  // Azuis
  azul: '#1F5FA8',
  'azul marinho': '#1B2A4A',
  marinho: '#1B2A4A',
  'azul claro': '#7FB6DC',
  'azul bebe': '#A8D4E8',
  'azul royal': '#2B4FA0',
  'azul petroleo': '#1F4E5A',
  petroleo: '#1F4E5A',
  turquesa: '#3FBFB0',
  ciano: '#2BB8C4',

  // Verdes
  verde: '#2E7D4F',
  'verde musgo': '#4A5D33',
  musgo: '#4A5D33',
  'verde militar': '#4B5320',
  militar: '#4B5320',
  'verde oliva': '#6B6B3A',
  oliva: '#6B6B3A',
  'verde bandeira': '#0B7A39',
  'verde agua': '#8CCFB8',
  'verde limao': '#A6C82E',
  menta: '#9ED8C0',

  // Quentes
  amarelo: '#E8B923',
  mostarda: '#C9971F',
  dourado: '#C9A227',
  laranja: '#E2661F',
  coral: '#E8735A',
  terracota: '#B85F42',
  ferrugem: '#9C4A2A',
  vermelho: '#B62D2D',
  vinho: '#6E1B24',
  bordo: '#6E1B24',

  // Rosas e roxos
  rosa: '#E8879C',
  'rosa claro': '#F2B8C6',
  pink: '#D6246E',
  fucsia: '#C2185B',
  roxo: '#6B3FA0',
  lilas: '#B9A0D6',
  violeta: '#7B4BC4',

  // Terrosos
  marrom: '#6B4A2F',
  caramelo: '#A9713F',
  chocolate: '#4E3222',
  caqui: '#A89A6B',
  tabaco: '#7A5230',
}

/** Sem acento, sem caixa, sem espaço sobrando. "Azul-Marinho " → "azul marinho". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Os nomes da tabela, do mais longo para o mais curto.
 *
 * A ordem NÃO é decoração: "azul" é pedaço de "azul marinho". Procurando do
 * mais curto, "Azul Marinho" casaria com "azul" e sugeriria o azul errado.
 */
const NOMES_POR_TAMANHO = Object.keys(TABELA).sort((a, b) => b.length - a.length)

/**
 * O tom sugerido para um nome de cor, ou `null` quando não há palpite.
 *
 * Casa o nome inteiro primeiro. Não casando, procura o nome de cor mais longo
 * que apareça dentro do texto — assim "Azul Marinho Escuro" e "Verde Musgo
 * Claro" ainda sugerem alguma coisa, em vez de devolver nada.
 */
export function corSugerida(nome: string): string | null {
  const limpo = normalizar(nome)
  if (limpo === '') return null

  const exata = TABELA[limpo]
  if (exata !== undefined) return exata

  for (const candidato of NOMES_POR_TAMANHO) {
    // Fronteira de palavra dos dois lados: "verdejante" não é "verde", e
    // "azulado" não é "azul".
    const padrao = new RegExp(`(^|\\s)${candidato}($|\\s)`)
    if (padrao.test(limpo)) return TABELA[candidato] ?? null
  }

  return null
}

/** Só para o teste e para quem quiser listar as opções. */
export const NOMES_DE_COR = Object.keys(TABELA)
