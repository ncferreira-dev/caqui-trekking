import { env } from '@/lib/env'

/**
 * A URL base do site, num lugar só.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO NÃO É `process.env.NEXT_PUBLIC_SITE_URL` ESPALHADO
 * ────────────────────────────────────────────────────────────────────────────
 * A base entra em JSON-LD, no sitemap, nas canônicas e no Open Graph. Se cada
 * um lesse a env por conta própria, um esqueceria de tirar a barra final, outro
 * usaria `http` em produção, e o Google veria duas URLs canônicas diferentes
 * para a mesma página — que é como se divide o próprio ranking sem perceber.
 *
 * `env` já validou no boot que a variável existe, é uma URL completa e NÃO
 * termina em barra (ver `lib/env.ts`). Então aqui é só o ponto único de leitura,
 * e `absoluto('/agenda')` é o único jeito de montar um link absoluto no projeto.
 */

export const URL_BASE = env.NEXT_PUBLIC_SITE_URL

/**
 * Caminho relativo → URL absoluta.
 *
 * `absoluto('/')` devolve a base sem barra dupla; `absoluto('/agenda')` cola
 * direto. Um caminho sem a barra inicial é um erro de quem chamou, mas a função
 * o tolera para não gerar `caqui.com.braAgenda`.
 */
export function absoluto(caminho = ''): string {
  if (caminho === '' || caminho === '/') return `${URL_BASE}/`
  return `${URL_BASE}${caminho.startsWith('/') ? caminho : `/${caminho}`}`
}
