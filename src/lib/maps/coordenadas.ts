/**
 * Extrai latitude/longitude de um link do Google Maps.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE UM LINK, E NÃO DOIS NÚMEROS
 * ────────────────────────────────────────────────────────────────────────────
 * Pedir "clique com o botão direito e copie os dois números" é pedir um gesto
 * que ninguém faz. O gesto natural é abrir o local no Google Maps e copiar o
 * link da barra de endereço — e esse link já carrega a coordenada, em um de
 * alguns formatos. Esta função lê todos eles e devolve o par, ou `null` quando
 * não há coordenada no texto.
 *
 * Tudo aqui é PURO: sem rede, sem navegador. Uma regex sobre a string. Isso a
 * torna barata de testar e igual no cliente e no servidor.
 *
 * O QUE ELA NÃO FAZ: resolver link curto (`maps.app.goo.gl`). Esse link é uma
 * redireção — não traz a coordenada dentro dele, só um código. Quem chama usa
 * `ehLinkCurtoDeMaps` para reconhecer o caso e orientar a pessoa a abrir o link
 * e colar o endereço completo, em vez de devolver um erro seco.
 */

export type Coordenada = { lat: number; lng: number }

/** Hosts de link ENCURTADO do Google Maps — não contêm a coordenada. */
const HOSTS_CURTOS = new Set(['maps.app.goo.gl', 'goo.gl'])

export function ehLinkCurtoDeMaps(texto: string): boolean {
  try {
    return HOSTS_CURTOS.has(new URL(texto.trim()).hostname)
  } catch {
    return false
  }
}

// A ordem importa: `!3d!4d` é o marcador EXATO do lugar, então vem primeiro;
// `@lat,lng` é o centro do mapa, que para um lugar selecionado é o próprio
// lugar; `q=`/`query=`/`ll=` cobrem os links de busca e de app; e o último
// aceita a pessoa colar só "lat,lng", que é o que o "copiar coordenadas" dá.
const PADROES: readonly RegExp[] = [
  /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
  /[?&](?:q|query|ll|sll|daddr)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,
]

function validar(lat: number, lng: number): Coordenada | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  // Fora da faixa é lixo (ou um par invertido). Melhor não gravar do que gravar
  // um pino no meio do oceano.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export function extrairCoordenadas(texto: string): Coordenada | null {
  const t = texto.trim()
  if (t === '') return null

  for (const padrao of PADROES) {
    const m = padrao.exec(t)
    if (m) {
      const coord = validar(Number(m[1]), Number(m[2]))
      if (coord) return coord
    }
  }
  return null
}
