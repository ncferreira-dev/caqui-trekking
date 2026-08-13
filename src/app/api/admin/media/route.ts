import { AppError, ErrorCode } from '@/lib/api/errors'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { altSchema, donoDeMidiaSchema, queryParaObjeto } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { emMegabytes, TAMANHO_MAXIMO_BYTES } from '@/server/media/processar'
import { ipDaRequest } from '@/server/services/audit-service'
import {
  type ArquivoRecebido,
  enviarMidias,
  listarMidias,
} from '@/server/services/admin/media-admin-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Teto do corpo inteiro: 10 arquivos no limite individual, com folga. */
const TAMANHO_MAXIMO_DA_REQUISICAO = TAMANHO_MAXIMO_BYTES * 10
const MAXIMO_DE_ARQUIVOS = 10

/** GET /api/admin/media?tripId=1 — a galeria de um item, na ordem. */
export const GET = rota(async (request: Request) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const dono = validarOuFalhar(donoDeMidiaSchema.safeParse(queryParaObjeto(new URL(request.url))))

  return ok(await listarMidias(dono))
})

/**
 * POST /api/admin/media — envia uma ou mais imagens.
 *
 * `multipart/form-data`:
 *   - `arquivos`  — repetido, um por imagem
 *   - `alt`       — repetido, MESMA ordem e MESMA quantidade dos arquivos
 *   - `tripId` | `productId` | `guideId` — exatamente um
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A AUTENTICAÇÃO VEM ANTES DE LER O CORPO
 * ────────────────────────────────────────────────────────────────────────────
 * `exigirPapel` é a primeira linha, e só depois o `formData()` consome o
 * stream. É a única coisa que o projeto de referência acertou neste fluxo
 * (`authenticateToken` antes do multer, seção 5 da análise): uma requisição
 * anônima com 500 MB de anexo é recusada no cabeçalho, sem queimar banda.
 *
 * O teto por `Content-Length` vem logo em seguida, pelo mesmo motivo: recusar
 * antes de bufferizar.
 */
export const POST = rota(async (request: Request) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const declarado = Number(request.headers.get('content-length') ?? 0)
  if (declarado > TAMANHO_MAXIMO_DA_REQUISICAO) {
    throw new AppError(
      ErrorCode.MEDIA_TOO_LARGE,
      `O envio tem ${emMegabytes(declarado)} MB e o limite por requisição é ` +
        `${emMegabytes(TAMANHO_MAXIMO_DA_REQUISICAO)} MB. Mande menos arquivos por vez.`,
    )
  }

  const formulario = await request.formData().catch(() => {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Envio inválido. Esta rota espera multipart/form-data.',
    )
  })

  const dono = validarOuFalhar(
    donoDeMidiaSchema.safeParse({
      ...(formulario.get('tripId') ? { tripId: formulario.get('tripId') } : {}),
      ...(formulario.get('productId') ? { productId: formulario.get('productId') } : {}),
      ...(formulario.get('guideId') ? { guideId: formulario.get('guideId') } : {}),
    }),
  )

  const arquivos = formulario.getAll('arquivos').filter((v): v is File => v instanceof File)
  const alts = formulario.getAll('alt')

  if (arquivos.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, 'Nenhum arquivo no campo "arquivos".')
  }

  if (arquivos.length > MAXIMO_DE_ARQUIVOS) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      `Máximo de ${MAXIMO_DE_ARQUIVOS} arquivos por envio. Vieram ${arquivos.length}.`,
    )
  }

  // Um `alt` por arquivo, pareado por POSIÇÃO. Recusar o descasamento é o que
  // impede a foto A receber a descrição da foto B — erro que ninguém percebe
  // olhando a tela, só quem usa leitor de tela.
  if (alts.length !== arquivos.length) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      `São ${arquivos.length} arquivo(s) e ${alts.length} texto(s) alternativo(s). ` +
        `Cada imagem precisa do seu, na mesma ordem.`,
    )
  }

  const recebidos: ArquivoRecebido[] = []
  for (const [indice, arquivo] of arquivos.entries()) {
    recebidos.push({
      bytes: Buffer.from(await arquivo.arrayBuffer()),
      nomeOriginal: arquivo.name,
      alt: validarOuFalhar(altSchema.safeParse(String(alts[indice] ?? ''))),
    })
  }

  const criadas = await enviarMidias(dono, recebidos, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(criadas)
})
