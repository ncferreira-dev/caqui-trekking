/**
 * Junta classes, descartando o que for falso.
 *
 * Não é `tailwind-merge`, e isso é deliberado. `tailwind-merge` existe para
 * resolver conflito entre classes utilitárias que disputam a mesma
 * propriedade — `px-2` chegando depois de `px-4`. Ele custa ~7 KB e resolve um
 * problema que só aparece quando a API do componente convida ao conflito.
 *
 * Aqui os componentes escolhem a variante por mapa (`VARIANTES[variante]`), e
 * `className` entra por último para quem precisa ajustar posicionamento — não
 * para reescrever a variante. Enquanto essa disciplina valer, não há conflito
 * para resolver.
 */
export function cn(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}
