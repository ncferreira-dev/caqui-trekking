import sharp, { type Metadata } from 'sharp'

import { AppError, ErrorCode } from '@/lib/api/errors'
import { detectarFormato, type FormatoAceito, MIME_POR_FORMATO } from '@/lib/media/mime'

/**
 * Validação e derivação de metadados da imagem, ANTES de qualquer rede.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ORDEM DAS CHECAGENS É A FUNCIONALIDADE
 * ────────────────────────────────────────────────────────────────────────────
 * 1. tamanho em bytes  — não custa nada, corta o caso mais caro
 * 2. bytes mágicos     — 16 bytes, dá o erro preciso
 * 3. decodificação     — confirma que os bytes são mesmo uma imagem
 * 4. dimensão mínima   — o conteúdo serve para o site?
 *
 * Só depois de tudo isso é que algo sai da máquina. O projeto de referência
 * invertia: bufferizava o arquivo inteiro, transferia para o provedor e
 * deixava a recusa acontecer lá (docs/00-analise-dalia.md, seção 7.3). Um
 * arquivo de 500 MB era pago em banda antes de ser recusado.
 */

/**
 * 12 MB. Uma foto de celular moderno tem entre 2 e 6 MB; as 41 fotos que a
 * Caqui entregou vão de 133 KB a 2,8 MB. 12 MB deixa folga para uma câmera
 * melhor sem virar porta aberta.
 */
export const TAMANHO_MAXIMO_BYTES = 12 * 1024 * 1024

/**
 * Menor lado aceito. A menor foto real da marca tem 880 px de lado menor;
 * abaixo de 600 a imagem não sustenta nem o card em tela retina, e o resultado
 * é uma foto borrada que ninguém volta para trocar.
 */
export const LADO_MINIMO_PX = 600

/** Largura do placeholder embutido. 16 px viram ~150 bytes de WebP. */
const LARGURA_DO_BLUR = 16

export type ImagemProcessada = {
  formato: FormatoAceito
  mime: string
  /** Dimensões de EXIBIÇÃO — já com a rotação do EXIF aplicada. */
  largura: number
  altura: number
  blurDataUrl: string | null
  bytes: number
}

/**
 * Um JPEG de retrato costuma ser gravado em paisagem com `Orientation: 6`.
 * Guardar 4032×3024 para uma foto que aparece 3024×4032 produz CLS na hora em
 * que o navegador troca a proporção reservada pela real — e o `alt`, o
 * `width`/`height` e o `srcset` passam a mentir juntos.
 */
export function dimensoesDeExibicao(metadados: {
  width?: number | undefined
  height?: number | undefined
  orientation?: number | undefined
}): { largura: number; altura: number } {
  const largura = metadados.width ?? 0
  const altura = metadados.height ?? 0
  const girada = (metadados.orientation ?? 1) >= 5

  return girada ? { largura: altura, altura: largura } : { largura, altura }
}

/**
 * Bytes em megabytes, com uma casa e vírgula decimal (pt-BR).
 *
 * Feito com aritmética inteira em vez de `toFixed` porque o ESLint deste
 * projeto proíbe `toFixed` — a regra existe para dinheiro, e aqui é tamanho de
 * arquivo. Poderia levar um `eslint-disable`; não leva de propósito. Regra com
 * escapatória vira regra que se desliga sem pensar, e a próxima pessoa a
 * desligá-la vai estar formatando preço.
 */
export function emMegabytes(bytes: number): string {
  const decimos = Math.round(bytes / (1024 * 102.4))
  return `${Math.floor(decimos / 10)},${decimos % 10}`
}

export async function processarImagem(
  bytes: Buffer,
  nomeOriginal: string,
): Promise<ImagemProcessada> {
  const referencia = nomeOriginal || 'arquivo'

  if (bytes.byteLength === 0) {
    throw new AppError(ErrorCode.MEDIA_INVALID_FILE, `"${referencia}" está vazio.`)
  }

  if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new AppError(
      ErrorCode.MEDIA_TOO_LARGE,
      `"${referencia}" tem ${emMegabytes(bytes.byteLength)} MB e o limite é ` +
        `${emMegabytes(TAMANHO_MAXIMO_BYTES)} MB.`,
    )
  }

  const formato = detectarFormato(bytes)
  if (!formato) {
    throw new AppError(
      ErrorCode.MEDIA_INVALID_FILE,
      `"${referencia}" não é uma imagem em formato aceito (JPEG, PNG, WebP, AVIF ou HEIC). ` +
        `A extensão do arquivo não conta — o conteúdo é que foi verificado.`,
    )
  }

  // Segunda camada: os bytes mágicos dizem "sou JPEG", o decodificador diz se
  // é verdade. Um `.pdf` com os 3 bytes de SOI colados na frente passa na
  // primeira e morre aqui.
  let metadados: Metadata
  try {
    metadados = await sharp(bytes).metadata()
  } catch (erro) {
    throw new AppError(
      ErrorCode.MEDIA_INVALID_FILE,
      `"${referencia}" tem cabeçalho de ${formato.toUpperCase()} mas o conteúdo está corrompido.`,
      { cause: erro },
    )
  }

  const { largura, altura } = dimensoesDeExibicao(metadados)

  if (largura === 0 || altura === 0) {
    throw new AppError(
      ErrorCode.MEDIA_INVALID_FILE,
      `Não foi possível ler as dimensões de "${referencia}".`,
    )
  }

  const menorLado = Math.min(largura, altura)
  if (menorLado < LADO_MINIMO_PX) {
    throw new AppError(
      ErrorCode.MEDIA_TOO_SMALL,
      `"${referencia}" tem ${largura}×${altura}px. O menor lado precisa ter ao menos ` +
        `${LADO_MINIMO_PX}px, senão a foto sai borrada no card.`,
    )
  }

  return {
    formato,
    mime: MIME_POR_FORMATO[formato],
    largura,
    altura,
    blurDataUrl: await gerarBlur(bytes, formato, referencia),
    bytes: bytes.byteLength,
  }
}

/**
 * LQIP embutido: uma imagem de 16 px de largura em base64, ~150 bytes.
 *
 * Fica no banco e viaja junto com o DTO, então o placeholder aparece no
 * primeiro paint, sem uma segunda requisição. É o oposto do que o projeto de
 * referência fazia — lá, `Relatorios.jsx:550` baixava o JPEG INTEGRAL para
 * renderizar uma miniatura de 32 px.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HEIC: o blur pode vir `null`, e está tudo bem
 * ────────────────────────────────────────────────────────────────────────────
 * O binário distribuído do `sharp` lê o CABEÇALHO de um HEIC (dimensões,
 * orientação) mas não decodifica os pixels — falta o plugin de decode. Duas
 * das 41 fotos da Caqui são HEIC, tiradas de iPhone, e a operação inteira é
 * feita do celular: recusar o formato seria trocar um enfeite por uma barreira
 * real de uso.
 *
 * Então: HEIC entra, e entra sem blur. O `blurDataUrl` é nulável no schema
 * justamente para isso, e a UI cai no fundo sólido.
 *
 * Para os outros formatos, falha de decodificação NÃO é tolerada — ali ela
 * significa arquivo corrompido, e o `processarImagem` já teria recusado. Se
 * escapou até aqui, o erro sobe.
 */
async function gerarBlur(
  bytes: Buffer,
  formato: FormatoAceito,
  referencia: string,
): Promise<string | null> {
  try {
    const miniatura = await sharp(bytes)
      // `rotate()` sem argumento aplica a orientação do EXIF. Sem isso, o
      // placeholder aparece deitado e "gira" quando a foto real carrega.
      .rotate()
      .resize(LARGURA_DO_BLUR, null, { fit: 'inside' })
      .webp({ quality: 40 })
      .toBuffer()

    return `data:image/webp;base64,${miniatura.toString('base64')}`
  } catch (erro) {
    if (formato === 'heic') return null

    throw new AppError(
      ErrorCode.MEDIA_INVALID_FILE,
      `"${referencia}" não pôde ser decodificado. O arquivo provavelmente está corrompido.`,
      { cause: erro },
    )
  }
}
