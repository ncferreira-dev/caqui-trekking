/**
 * Detecção de tipo de imagem pelos BYTES do arquivo, nunca pela extensão.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO CONFIAR NA EXTENSÃO NEM NO `Content-Type`
 * ────────────────────────────────────────────────────────────────────────────
 * Os dois vêm do cliente. Renomear `payload.pdf` para `foto.jpg` e mandar
 * `Content-Type: image/jpeg` custa dois cliques. O projeto de referência não
 * checava nem um nem outro: o multer subia sem `fileFilter` e sem
 * `limits.fileSize`, e a única validação real era o `allowed_formats` DO
 * CLOUDINARY — quer dizer, o servidor bufferizava e transferia o arquivo
 * inteiro antes de a recusa acontecer do outro lado, pagando banda por um
 * arquivo que ia ser rejeitado (ver docs/00-analise-dalia.md, seção 7.3).
 *
 * Aqui a recusa acontece nos primeiros 16 bytes, antes de qualquer rede.
 *
 * Esta é a PRIMEIRA de duas camadas: ela dá o erro preciso e barata. A
 * segunda é o `sharp`, em `src/server/media/processar.ts`, que decodifica o
 * cabeçalho de verdade — um arquivo com os 3 bytes mágicos de JPEG seguidos de
 * lixo passa aqui e morre lá.
 */

export const FORMATOS_ACEITOS = ['jpeg', 'png', 'webp', 'avif', 'heic'] as const
export type FormatoAceito = (typeof FORMATOS_ACEITOS)[number]

export const MIME_POR_FORMATO: Record<FormatoAceito, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  // HEIC é o padrão da câmera do iPhone. NÃO é opcional aceitar: das 41 fotos
  // que a Caqui entregou, 2 vieram assim — e a operação é toda feita do
  // celular. Nenhum navegador exibe HEIC, mas o `f_auto` da entrega converte
  // na hora de servir, então quem sobe não precisa saber disso.
  heic: 'image/heic',
}

/** Marcas do container ISO-BMFF (`ftyp`) que nos interessam. */
const MARCAS_AVIF = new Set(['avif', 'avis'])
const MARCAS_HEIC = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])

function ehIgual(bytes: Uint8Array, offset: number, esperado: readonly number[]): boolean {
  if (bytes.length < offset + esperado.length) return false
  return esperado.every((b, i) => bytes[offset + i] === b)
}

function texto(bytes: Uint8Array, offset: number, tamanho: number): string {
  if (bytes.length < offset + tamanho) return ''
  return String.fromCharCode(...bytes.subarray(offset, offset + tamanho))
}

/**
 * Devolve o formato ou `null` se os bytes não forem de uma imagem aceita.
 *
 * Nunca lança: quem chama decide o código de erro.
 */
export function detectarFormato(bytes: Uint8Array): FormatoAceito | null {
  // JPEG: SOI (FF D8) seguido de um marcador.
  if (ehIgual(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpeg'

  // PNG: assinatura de 8 bytes.
  if (ehIgual(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'

  // WebP: container RIFF com o form type "WEBP" no offset 8.
  if (texto(bytes, 0, 4) === 'RIFF' && texto(bytes, 8, 4) === 'WEBP') return 'webp'

  // AVIF e HEIC compartilham o container ISO-BMFF: caixa `ftyp` no offset 4,
  // marca principal no 8 e as compatíveis na sequência. Um HEIC de iPhone
  // costuma trazer `heic` como principal, mas alguns trazem `mif1` — por isso
  // a varredura também olha as marcas compatíveis, em vez de só a primeira.
  if (texto(bytes, 4, 4) === 'ftyp') {
    const marcas: string[] = [texto(bytes, 8, 4)]

    // Tamanho da caixa `ftyp`, limitado ao que temos em mãos.
    const tamanhoCaixa = Math.min(
      ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0),
      bytes.length,
    )
    for (let offset = 16; offset + 4 <= tamanhoCaixa; offset += 4) {
      marcas.push(texto(bytes, offset, 4))
    }

    if (marcas.some((m) => MARCAS_AVIF.has(m))) return 'avif'
    if (marcas.some((m) => MARCAS_HEIC.has(m))) return 'heic'
  }

  return null
}
