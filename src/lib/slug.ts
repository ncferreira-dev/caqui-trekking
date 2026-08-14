/**
 * Slug a partir de um texto livre.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O SLUG É GERADO UMA VEZ E CONGELA
 * ────────────────────────────────────────────────────────────────────────────
 * Ele é a URL canônica do roteiro e da peça. Derivá-lo do título a cada render
 * — como o projeto de referência fazia — significa que renomear "Pedra Grande"
 * para "Pedra Grande de Quatinga" mudaria a URL em silêncio, quebrando todo
 * link já mandado no WhatsApp e zerando o ranking de busca. Por isso o slug é
 * calculado na CRIAÇÃO e depois só muda de propósito, com redirect.
 *
 * `NFD` + remoção de diacríticos transforma "São Sebastião" em "sao-sebastiao":
 * slug com acento vira percent-encoding feio na barra e quebra em cliente de
 * e-mail antigo. O resultado é sempre minúsculo, ASCII, com hífen entre
 * palavras e sem hífen nas pontas.
 */
export function gerarSlug(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      // Corta ANTES de aparar o hífen das pontas. A ordem importa: aparar e
      // depois cortar em 120 pode deixar um hífen final quando o corte cai em
      // cima de um separador — e o slug congela como URL canônica, não pode
      // nascer terminando em '-'.
      .slice(0, 120)
      .replace(/^-+|-+$/g, '')
  )
}

/**
 * Garante unicidade contra uma lista de slugs já usados.
 *
 * Duas peças "Camiseta Caqui" gerariam o mesmo slug e a segunda estouraria o
 * unique do banco. Em vez de deixar o erro de constraint vazar no submit, o
 * segundo vira `camiseta-caqui-2`. O `-2` é preferível a um sufixo aleatório:
 * continua legível e não polui a URL com ruído.
 */
export function slugUnico(base: string, usados: Iterable<string>): string {
  const conjunto = new Set(usados)
  const raiz = gerarSlug(base) || 'item'

  if (!conjunto.has(raiz)) return raiz

  let n = 2
  while (conjunto.has(`${raiz}-${n}`)) n++
  return `${raiz}-${n}`
}
