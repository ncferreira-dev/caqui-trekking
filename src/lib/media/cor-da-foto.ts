/**
 * Qual foto pertence a qual cor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A REGRA QUE DECIDE TUDO: NA DÚVIDA, NEUTRA, NUNCA A COR ERRADA
 * ────────────────────────────────────────────────────────────────────────────
 * Pedido do cliente em 18/08/2026: numa baby look com três cores, escolher a
 * cor precisa trocar a FOTO junto com o preço. Até então a variante sabia a cor
 * e a imagem sabia o produto, e nada ligava as duas.
 *
 * Foto genérica é uma informação FALTANDO. Foto da cor errada é uma informação
 * FALSA — e ela não vira alerta de sistema, vira reclamação de cliente que
 * recebeu a peça de outra cor. Por isso a função nunca "completa" a galeria
 * com o que sobrou: cor sem foto própria cai nas neutras, e sem neutras cai no
 * vazio, que a galeria já sabe desenhar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PURA, PORQUE TRÊS TELAS PRECISAM CONCORDAR
 * ────────────────────────────────────────────────────────────────────────────
 * A galeria da página da peça, a segunda foto do card no hover, e o aviso do
 * CRM sobre cor sem foto. Escrita três vezes, a regra divergiria na primeira
 * correção — e o card passaria a mostrar no hover a cor que a galeria recusa.
 */

/**
 * Só o que a regra precisa saber de uma foto.
 *
 * O campo se chama `cor`, e não `colorName`: este módulo é consumido pela LOJA,
 * e o vocabulário público deste projeto é português. Quem vem do banco
 * (`MediaAsset.colorName`) atravessa o DTO antes de chegar aqui, que é onde a
 * tradução já acontece para todo o resto.
 */
export type FotoComCor = { cor: string | null }

/**
 * A forma comparável de um nome de cor.
 *
 * Caixa e espaço são erro de digitação; acento é escolha. "Azul" e " azul "
 * são a mesma cor e precisam casar; "Rosê" e "Rose" são duas cores que a Caqui
 * cadastrou de propósito e não podem se fundir.
 *
 * O seletor do CRM lista as cores do produto, então em teoria não há
 * divergência. Na prática existe dado antigo e cópia de planilha, e a
 * associação falharia em silêncio — o pior modo de falhar deste recurso.
 */
export function normalizarCor(nome: string | null): string | null {
  if (nome === null) return null
  return nome.trim().toLocaleLowerCase('pt-BR')
}

/**
 * As fotos que valem para a cor escolhida, na ordem em que devem aparecer.
 *
 * `cor` nulo (ninguém escolheu ainda, ou a peça não tem variante) devolve tudo:
 * filtrar aí esconderia a peça inteira.
 */
export function fotosDaCor<T extends FotoComCor>(fotos: readonly T[], cor: string | null): T[] {
  if (cor === null) return [...fotos]

  const alvo = normalizarCor(cor)

  const daCor = fotos.filter((f) => f.cor !== null && normalizarCor(f.cor) === alvo)
  const neutras = fotos.filter((f) => f.cor === null)

  // `filter` preserva a ordem de entrada, e a consulta já vem por `sortOrder`.
  // Cor diz QUAL grupo; ordem diz a sequência dentro dele.
  return [...daCor, ...neutras]
}

/**
 * As cores do produto que ninguém fotografou ainda.
 *
 * É o aviso do CRM, e ele é AVISO e não erro: ficar sem foto é estado legítimo
 * (a foto ainda não chegou). O que não pode é quem cadastra descobrir isso pela
 * galeria vazia na loja, semanas depois.
 *
 * Foto neutra não conta: ela serve para todas as cores, e é exatamente por isso
 * que não resolve nenhuma — a peça continua sem foto própria daquela cor.
 */
export function coresSemFoto(fotos: readonly FotoComCor[], cores: readonly string[]): string[] {
  const fotografadas = new Set(
    fotos.map((f) => normalizarCor(f.cor)).filter((c): c is string => c !== null),
  )

  return cores.filter((cor) => {
    const chave = normalizarCor(cor)
    return chave !== null && !fotografadas.has(chave)
  })
}

/**
 * A capa do card e a foto que aparece no hover.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A PROMESSA DO CARD ERA UM COMENTÁRIO. AGORA É UMA CONTA
 * ────────────────────────────────────────────────────────────────────────────
 * `card-produto.tsx` diz, em comentário, que a segunda foto é "a mesma peça de
 * outro ângulo, nunca outra cor". Isso era combinado, não verificado: a
 * alternativa era simplesmente `imagens[1]`, e numa peça com três cores
 * fotografadas a segunda imagem é a de OUTRA cor. O card prometia ângulo e
 * entregava troca de cor no hover.
 *
 * Aqui a alternativa é a próxima foto do MESMO grupo de cor da capa. Sem par no
 * grupo, não há hover: uma foto a menos é uma informação faltando, e a foto de
 * outra cor é uma informação falsa.
 */
export function capaEAlternativa<T extends FotoComCor>(
  fotos: readonly T[],
): { capa: T | null; alternativa: T | null } {
  const capa = fotos[0] ?? null
  if (!capa) return { capa: null, alternativa: null }

  const grupo = normalizarCor(capa.cor)
  const alternativa = fotos.slice(1).find((f) => normalizarCor(f.cor) === grupo) ?? null

  return { capa, alternativa }
}
