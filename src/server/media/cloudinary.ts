import { v2 as cloudinary } from 'cloudinary'

import { AppError, ErrorCode } from '@/lib/api/errors'
import { env } from '@/lib/env'
import type { ArquivoParaEnvio, MediaStorage, ResultadoDeEnvio } from '@/server/media/storage'

/**
 * Driver de produção: Cloudinary, SDK v2, chamado direto.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE "CLOUDINARY CORRIGIDO" QUER DIZER
 * ────────────────────────────────────────────────────────────────────────────
 * O projeto de referência usava o mesmo provedor e acumulou cinco problemas
 * independentes (docs/00-analise-dalia.md, seções 7.2 a 7.6). Cada um tem um
 * contraponto aqui:
 *
 * | Lá                                          | Aqui                          |
 * | ------------------------------------------- | ----------------------------- |
 * | `multer-storage-cloudinary` prendia o SDK em | SDK v2 direto, sem ponte;     |
 * | 1.x, uma major atrasada                      | nada segura a versão          |
 * | `public_id` DESCARTADO na resposta           | persistido em `MediaAsset`    |
 * | `destroy` não aparecia em lugar nenhum       | `remover()` no delete e no    |
 * |                                              | rollback de upload            |
 * | Sem transformação: nem `f_auto`, nem `q_auto`| transformação na entrega      |
 * | Validação só via `allowed_formats` do provedor| bytes conferidos antes de sair |
 *
 * O `public_id` é o item central. Sem ele não há como apagar — nem depois,
 * manualmente: as fotos de lá se chamam `product-0-1757796592563`, sem vínculo
 * recuperável com o produto. Cada foto que subiu está lá para sempre, e isso é
 * aluguel eterno em cota de storage e banda.
 */

/**
 * Confere as credenciais e devolve as que faltam, NOMEADAS.
 *
 * "Erro ao enviar a imagem" é o que o projeto de referência mostrava para
 * qualquer falha de upload. Quem estiver com o CRM aberto às 22h precisa saber
 * que falta `CLOUDINARY_API_SECRET`, não que "deu erro".
 */
export function exigirCredenciais(): { cloudName: string; apiKey: string; apiSecret: string } {
  const faltando: string[] = []
  if (!env.CLOUDINARY_CLOUD_NAME) faltando.push('CLOUDINARY_CLOUD_NAME')
  if (!env.CLOUDINARY_API_KEY) faltando.push('CLOUDINARY_API_KEY')
  if (!env.CLOUDINARY_API_SECRET) faltando.push('CLOUDINARY_API_SECRET')

  if (faltando.length > 0) {
    throw new AppError(
      ErrorCode.MEDIA_STORAGE_UNCONFIGURED,
      `Storage de imagens não configurado. Faltando no ambiente: ${faltando.join(', ')}.`,
      { status: 503 },
    )
  }

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME as string,
    apiKey: env.CLOUDINARY_API_KEY as string,
    apiSecret: env.CLOUDINARY_API_SECRET as string,
  }
}

type RespostaUpload = { secure_url?: string; public_id?: string }

export function cloudinaryStorage(): MediaStorage {
  const { cloudName, apiKey, apiSecret } = exigirCredenciais()

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    // Nunca `http://`. Uma imagem em HTTP dentro de página HTTPS vira mixed
    // content e o navegador bloqueia.
    secure: true,
  })

  return {
    nome: 'cloudinary',

    async enviar(arquivo: ArquivoParaEnvio): Promise<ResultadoDeEnvio> {
      const resposta = await new Promise<RespostaUpload>((resolver, rejeitar) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: arquivo.publicId,
            resource_type: 'image',
            // NÓS mandamos o id. Sem sufixo aleatório, sem nome de arquivo do
            // cliente virando caminho no provedor.
            use_filename: false,
            unique_filename: false,
            // `false` de propósito: sobrescrever em silêncio é como se perde
            // a imagem anterior sem ninguém notar. Colisão vira erro, e o
            // serviço decide o que fazer.
            overwrite: false,
            // O provedor NÃO é a validação. A checagem de bytes já aconteceu
            // antes desta chamada; isto é a última rede de proteção.
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif'],
          },
          (erro, resultado) => {
            if (erro) rejeitar(erro)
            else resolver((resultado ?? {}) as RespostaUpload)
          },
        )
        stream.end(arquivo.bytes)
      }).catch((erro: unknown) => {
        throw new AppError(ErrorCode.MEDIA_STORAGE_FAILED, 'Falha ao enviar a imagem.', {
          status: 503,
          cause: erro,
        })
      })

      if (!resposta.secure_url || !resposta.public_id) {
        throw new AppError(
          ErrorCode.MEDIA_STORAGE_FAILED,
          'O provedor respondeu sem URL ou sem identificador.',
          { status: 503 },
        )
      }

      return { url: resposta.secure_url, publicId: resposta.public_id }
    },

    async remover(publicId: string): Promise<void> {
      const resultado = (await cloudinary.uploader
        .destroy(publicId, {
          resource_type: 'image',
          // Purga a CDN. Sem isso, a imagem apagada continua sendo servida
          // pelo cache de borda por horas — e "apaguei e ainda aparece" é
          // indistinguível de "o delete não funciona".
          invalidate: true,
        })
        .catch((erro: unknown) => {
          throw new AppError(ErrorCode.MEDIA_STORAGE_FAILED, 'Falha ao remover a imagem.', {
            status: 503,
            cause: erro,
          })
        })) as { result?: string }

      // `not found` é sucesso: o objetivo era "não existir mais", e ele não
      // existe. Tratar como erro travaria o delete do registro para sempre
      // sempre que alguém apagasse pelo painel do provedor.
      if (resultado.result !== 'ok' && resultado.result !== 'not found') {
        throw new AppError(
          ErrorCode.MEDIA_STORAGE_FAILED,
          `O provedor recusou a remoção: ${resultado.result ?? 'sem resposta'}.`,
          { status: 503 },
        )
      }
    },

    async listarPublicIds(prefixo: string): Promise<string[]> {
      const ids: string[] = []
      let cursor: string | undefined

      // Paginado de verdade. Uma listagem que para na primeira página faria o
      // caçador de órfãos "não encontrar nada" e dar falsa tranquilidade.
      do {
        const pagina = (await cloudinary.api.resources({
          type: 'upload',
          resource_type: 'image',
          prefix: prefixo,
          max_results: 500,
          ...(cursor ? { next_cursor: cursor } : {}),
        })) as { resources?: { public_id: string }[]; next_cursor?: string }

        for (const recurso of pagina.resources ?? []) ids.push(recurso.public_id)
        cursor = pagina.next_cursor
      } while (cursor)

      return ids
    },
  }
}
