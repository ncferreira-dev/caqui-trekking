import { randomBytes } from 'node:crypto'

import { AppError, ErrorCode } from '@/lib/api/errors'
import { normalizarCor } from '@/lib/media/cor-da-foto'
import { prisma } from '@/lib/prisma'
import { type ImagemProcessada, processarImagem } from '@/server/media/processar'
import { obterStorage, PASTA_RAIZ } from '@/server/media/storage'
import { registrarAuditoria } from '@/server/services/audit-service'

/**
 * Ciclo de vida das imagens.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A REGRA QUE ORGANIZA O ARQUIVO INTEIRO: NENHUM ÓRFÃO, DOS DOIS LADOS
 * ────────────────────────────────────────────────────────────────────────────
 * Órfão tem duas direções, e elas têm gravidades diferentes:
 *
 *  - **Arquivo sem registro** (o vazamento do projeto de referência): silencioso,
 *    cobrado para sempre em cota de storage. Ninguém percebe.
 *  - **Registro sem arquivo**: imagem quebrada na página, visível para o
 *    cliente na hora.
 *
 * Daí a ordem de cada operação:
 *
 *  - **Upload**: sobe primeiro, grava depois. Se a gravação falhar, o que subiu
 *    é removido no `catch`. Uma falha aqui não deixa registro apontando para o
 *    nada.
 *  - **Delete**: a remoção no storage acontece DENTRO da transação. Se o
 *    provedor recusar, a transação faz rollback e o registro CONTINUA no banco.
 *    Preferimos "o delete falhou, tente de novo" a "sumiu da lista e o arquivo
 *    ficou lá para sempre" — que é exatamente o que acontecia lá, com o
 *    agravante de o código dar a impressão contrária.
 *
 * A rede de segurança final é `procurarOrfaos()`, que compara os dois lados.
 */

export type TipoDeDono = 'trip' | 'product' | 'guide'
export type Dono = { tipo: TipoDeDono; id: number }

export type ArquivoRecebido = {
  bytes: Buffer
  nomeOriginal: string
  /** Obrigatório. String vazia = decorativa, e precisa ser explícita. */
  alt: string
  /** Só a importação em lote define: torna o script idempotente. */
  publicId?: string
}

export type MidiaDTO = {
  id: number
  url: string
  alt: string
  largura: number
  altura: number
  blurDataUrl: string | null
  ordem: number
  /**
   * Derivado de `ordem === 0`. Devolvido MATERIALIZADO, e não deixado para o
   * front derivar — o projeto de referência tinha um significado posicional
   * (`imagesGoldCount`) que não estava declarado em lugar nenhum, e apagar uma
   * foto no meio fazia o seletor de material mostrar a cor errada, sem erro e
   * sem log (docs/00-analise-dalia.md, seção 7.8). Posição pode carregar
   * significado; o que não pode é o significado ser secreto.
   */
  principal: boolean
  /** Só no CRM. Nunca sai em rota pública. */
  publicId: string
}

type Contexto = { userId: number; ip: string | null }

const CAMPOS = {
  id: true,
  url: true,
  alt: true,
  width: true,
  height: true,
  blurDataUrl: true,
  sortOrder: true,
  publicId: true,
} as const

type Linha = {
  id: number
  url: string
  alt: string
  width: number
  height: number
  blurDataUrl: string | null
  sortOrder: number
  publicId: string
}

function paraDTO(m: Linha): MidiaDTO {
  return {
    id: m.id,
    url: m.url,
    alt: m.alt,
    largura: m.width,
    altura: m.height,
    blurDataUrl: m.blurDataUrl,
    ordem: m.sortOrder,
    // Derivado do próprio `sortOrder`, não da posição no array que veio da
    // consulta. Uma lista filtrada teria índice 0 sem ter a principal dentro.
    principal: m.sortOrder === 0,
    publicId: m.publicId,
  }
}

function filtroDoDono(
  dono: Dono,
): { tripId: number } | { productId: number } | { guideId: number } {
  if (dono.tipo === 'trip') return { tripId: dono.id }
  if (dono.tipo === 'product') return { productId: dono.id }
  return { guideId: dono.id }
}

/**
 * Confirma que o dono existe e não está arquivado.
 *
 * O banco já tem um CHECK garantindo exatamente UM dono por imagem, mas o
 * CHECK devolve erro de constraint, não uma mensagem. Isto aqui é para o erro
 * chegar ao CRM como 404 com nome, não como texto do Postgres vazando.
 */
async function exigirDono(dono: Dono): Promise<string> {
  if (dono.tipo === 'trip') {
    const trip = await prisma.trip.findFirst({
      where: { id: dono.id, deletedAt: null },
      select: { slug: true },
    })
    if (!trip) throw new AppError(ErrorCode.TRIP_NOT_FOUND, 'Roteiro não encontrado.')
    return trip.slug
  }

  if (dono.tipo === 'product') {
    const produto = await prisma.product.findFirst({
      where: { id: dono.id, deletedAt: null },
      select: { slug: true },
    })
    if (!produto) throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Produto não encontrado.')
    return produto.slug
  }

  const guia = await prisma.guide.findFirst({
    where: { id: dono.id, deletedAt: null },
    select: { id: true },
  })
  if (!guia) throw new AppError(ErrorCode.GUIDE_NOT_FOUND, 'Guia não encontrado.')
  return String(guia.id)
}

/** `Trip` | `Product` | `Guide`, para a trilha de auditoria. */
function entidadeDoDono(dono: Dono): 'Trip' | 'Product' | 'Guide' {
  if (dono.tipo === 'trip') return 'Trip'
  if (dono.tipo === 'product') return 'Product'
  return 'Guide'
}

export async function listarMidias(dono: Dono): Promise<MidiaDTO[]> {
  await exigirDono(dono)

  const linhas = await prisma.mediaAsset.findMany({
    where: filtroDoDono(dono),
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: CAMPOS,
  })

  return linhas.map(paraDTO)
}

/**
 * Sobe N arquivos e vincula ao dono.
 *
 * TODOS os arquivos são validados antes de QUALQUER envio. Se o terceiro de
 * cinco for um PDF renomeado, nenhum dos cinco sai da máquina — em vez de dois
 * ficarem no provedor e a operação falhar no meio.
 */
export async function enviarMidias(
  dono: Dono,
  arquivos: ArquivoRecebido[],
  ctx: Contexto,
): Promise<MidiaDTO[]> {
  if (arquivos.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, 'Nenhum arquivo recebido.')
  }

  const referencia = await exigirDono(dono)
  const storage = obterStorage()

  // ── 1. Validar tudo, sem tocar na rede ────────────────────────────────────
  const preparados: {
    arquivo: ArquivoRecebido
    processada: ImagemProcessada
    publicId: string
  }[] = []
  for (const arquivo of arquivos) {
    const processada = await processarImagem(arquivo.bytes, arquivo.nomeOriginal)
    preparados.push({
      arquivo,
      processada,
      publicId:
        arquivo.publicId ??
        `${PASTA_RAIZ}/${dono.tipo}/${referencia}/${randomBytes(8).toString('hex')}`,
    })
  }

  // ── 2. Enviar, guardando o que já subiu para poder desfazer ───────────────
  const enviados: { publicId: string; url: string }[] = []

  try {
    for (const item of preparados) {
      const resultado = await storage.enviar({
        bytes: item.arquivo.bytes,
        publicId: item.publicId,
        mime: item.processada.mime,
      })
      enviados.push(resultado)
    }

    // ── 3. Gravar, continuando a numeração existente ────────────────────────
    const ultima = await prisma.mediaAsset.findFirst({
      where: filtroDoDono(dono),
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    const base = (ultima?.sortOrder ?? -1) + 1

    const criadas = await prisma.$transaction(async (tx) => {
      const linhas: Linha[] = []

      for (const [indice, item] of preparados.entries()) {
        const enviado = enviados[indice]!
        const linha = await tx.mediaAsset.create({
          data: {
            url: enviado.url,
            publicId: enviado.publicId,
            alt: item.arquivo.alt,
            width: item.processada.largura,
            height: item.processada.altura,
            blurDataUrl: item.processada.blurDataUrl,
            sortOrder: base + indice,
            ...filtroDoDono(dono),
          },
          select: CAMPOS,
        })

        await registrarAuditoria(
          {
            userId: ctx.userId,
            action: 'media.upload',
            entityType: 'MediaAsset',
            entityId: linha.id,
            before: null,
            after: {
              dono: `${dono.tipo}:${dono.id}`,
              publicId: linha.publicId,
              alt: linha.alt,
              dimensoes: `${linha.width}x${linha.height}`,
              ordem: linha.sortOrder,
            },
            ip: ctx.ip,
          },
          tx,
        )

        linhas.push(linha)
      }

      return linhas
    })

    return criadas.map(paraDTO)
  } catch (erro) {
    // Desfaz o que subiu. `allSettled` porque uma remoção que falha não pode
    // esconder o erro original — mas ela é registrada alto, porque é
    // exatamente aqui que nasceria um arquivo órfão.
    const desfeitos = await Promise.allSettled(enviados.map((e) => storage.remover(e.publicId)))

    for (const [i, resultado] of desfeitos.entries()) {
      if (resultado.status === 'rejected') {
        console.error(
          `[media] ÓRFÃO POTENCIAL: falhou ao remover ${enviados[i]?.publicId} depois de um upload malsucedido.`,
          resultado.reason,
        )
      }
    }

    throw erro
  }
}

/**
 * Troca só o texto alternativo.
 *
 * Endpoint próprio porque `alt` é o campo que mais se corrige depois — e
 * porque no projeto de referência o campo simplesmente não existia: o nome do
 * produto fazia as vezes, e havia `<img>` sem atributo `alt` nenhum.
 */
export async function atualizarAlt(
  midiaId: number,
  alt: string,
  ctx: Contexto,
): Promise<{ id: number; alt: string }> {
  const antes = await prisma.mediaAsset.findUnique({
    where: { id: midiaId },
    select: { id: true, alt: true },
  })

  if (!antes) throw new AppError(ErrorCode.MEDIA_NOT_FOUND, 'Imagem não encontrada.')

  return prisma.$transaction(async (tx) => {
    const depois = await tx.mediaAsset.update({
      where: { id: midiaId },
      data: { alt },
      select: { id: true, alt: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'media.alt',
        entityType: 'MediaAsset',
        entityId: midiaId,
        before: { alt: antes.alt },
        after: { alt: depois.alt },
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}

/**
 * A cor que esta foto mostra.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A COR PRECISA EXISTIR NO PRODUTO, E QUEM CONFERE É O SERVIDOR
 * ────────────────────────────────────────────────────────────────────────────
 * A tela oferece um `<select>` com as cores que a peça já tem, e é o desenho
 * certo: campo de texto livre produziria "Azul", "azul" e "Azul Marinho " com
 * espaço no fim, e a associação falharia sem avisar.
 *
 * Mas `<select>` é cortesia, não barreira — o `fetch` continua chamável do
 * console, e um `colorName` que não bate com variante nenhuma é uma foto que
 * some da galeria para SEMPRE, em silêncio: ela não é da cor de ninguém e
 * também não é neutra. É o pior estado possível deste campo, e por isso a
 * conferência é aqui.
 *
 * A comparação passa por `normalizarCor`, a mesma que a loja usa para filtrar.
 * Se as duas divergissem, a foto gravaria "ok" e sumiria da vitrine.
 *
 * `null` é sempre aceito: significa "serve para qualquer cor", e é o padrão.
 */
export async function definirCorDaFoto(
  midiaId: number,
  cor: string | null,
  ctx: Contexto,
): Promise<{ id: number; cor: string | null }> {
  const antes = await prisma.mediaAsset.findUnique({
    where: { id: midiaId },
    select: {
      id: true,
      colorName: true,
      productId: true,
      product: { select: { variants: { select: { colorName: true } } } },
    },
  })

  if (!antes) throw new AppError(ErrorCode.MEDIA_NOT_FOUND, 'Imagem não encontrada.')

  if (cor !== null) {
    if (antes.productId === null) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'Só foto de peça tem cor. Foto de roteiro e de guia serve para qualquer contexto.',
        { status: 400 },
      )
    }

    const doProduto = new Set(
      (antes.product?.variants ?? [])
        .map((v) => normalizarCor(v.colorName))
        .filter((c): c is string => c !== null),
    )

    if (!doProduto.has(normalizarCor(cor) as string)) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Esta peça não tem a cor "${cor}". Cadastre a variante primeiro, ou deixe a foto sem cor.`,
        { status: 400 },
      )
    }
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.mediaAsset.update({
      where: { id: midiaId },
      data: { colorName: cor },
      select: { id: true, colorName: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'media.cor',
        entityType: 'MediaAsset',
        entityId: midiaId,
        before: { cor: antes.colorName },
        after: { cor: depois.colorName },
        ip: ctx.ip,
      },
      tx,
    )

    return { id: depois.id, cor: depois.colorName }
  })
}

/**
 * Apaga do banco E do storage, ou não apaga de lugar nenhum.
 *
 * A chamada ao storage fica dentro da transação de propósito: se o provedor
 * recusar, o rollback devolve o registro e a Caqui vê a imagem de volta na
 * lista, em vez de ver a imagem sumir e o arquivo continuar sendo cobrado.
 *
 * O `timeout` estendido existe porque há uma chamada de rede aqui dentro; o
 * padrão de 5s do Prisma é apertado para isso.
 */
export async function removerMidia(midiaId: number, ctx: Contexto): Promise<{ id: number }> {
  const midia = await prisma.mediaAsset.findUnique({
    where: { id: midiaId },
    select: { ...CAMPOS, tripId: true, productId: true, guideId: true },
  })

  if (!midia) throw new AppError(ErrorCode.MEDIA_NOT_FOUND, 'Imagem não encontrada.')

  const storage = obterStorage()

  // Exatamente um dos três é não-nulo — o CHECK `media_assets_exatamente_um_dono`
  // na migration garante isso. O `?? {}` é a saída defensiva para o caso
  // impossível, e faz a renumeração virar no-op em vez de renumerar o banco
  // inteiro.
  const filtro: { tripId: number } | { productId: number } | { guideId: number } | object =
    midia.tripId !== null
      ? { tripId: midia.tripId }
      : midia.productId !== null
        ? { productId: midia.productId }
        : midia.guideId !== null
          ? { guideId: midia.guideId }
          : { id: -1 }

  return prisma.$transaction(
    async (tx) => {
      await tx.mediaAsset.delete({ where: { id: midiaId } })

      // Renumera os irmãos. Sem isso, apagar a imagem de `sortOrder` 0 deixa a
      // galeria SEM principal — e a capa do roteiro some do site inteiro sem
      // que ninguém tenha pedido isso.
      const restantes = await tx.mediaAsset.findMany({
        where: filtro,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { id: true },
      })

      for (const [indice, irma] of restantes.entries()) {
        await tx.mediaAsset.update({ where: { id: irma.id }, data: { sortOrder: indice } })
      }

      await registrarAuditoria(
        {
          userId: ctx.userId,
          action: 'media.delete',
          entityType: 'MediaAsset',
          entityId: midiaId,
          before: { publicId: midia.publicId, alt: midia.alt, ordem: midia.sortOrder },
          after: null,
          ip: ctx.ip,
        },
        tx,
      )

      // Por último, e ainda dentro da transação: erro aqui desfaz tudo acima.
      await storage.remover(midia.publicId)

      return { id: midiaId }
    },
    { timeout: 15_000 },
  )
}

/**
 * Reordena a galeria. A primeira da lista é a principal.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O MANIFESTO PRECISA SER COMPLETO
 * ────────────────────────────────────────────────────────────────────────────
 * A melhor peça do projeto de referência era o manifesto de ordem com token
 * `"__NEW__"`, que reconciliava fotos existentes e novas preservando a ordem
 * escolhida (seção 7.7). O que faltava era esta checagem: lá, um manifesto
 * incompleto — um `map` sobre uma lista filtrada, um item perdido no estado do
 * React — apagava a diferença sem avisar.
 *
 * Aqui o conjunto enviado precisa bater EXATAMENTE com o que está no banco.
 * Faltou um id, sobrou um id, veio um id de outro dono: 409, nada muda, e a
 * resposta diz qual.
 */
export async function reordenarMidias(
  dono: Dono,
  ids: number[],
  ctx: Contexto,
): Promise<MidiaDTO[]> {
  await exigirDono(dono)

  const atuais = await prisma.mediaAsset.findMany({
    where: filtroDoDono(dono),
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })

  const noBanco = new Set(atuais.map((m) => m.id))
  const enviados = new Set(ids)

  if (enviados.size !== ids.length) {
    throw new AppError(ErrorCode.CONFLICT, 'A lista de ordem tem ids repetidos.', { status: 409 })
  }

  const faltando = [...noBanco].filter((id) => !enviados.has(id))
  const desconhecidos = ids.filter((id) => !noBanco.has(id))

  if (faltando.length > 0 || desconhecidos.length > 0) {
    const partes: string[] = []
    if (faltando.length > 0) partes.push(`faltando: ${faltando.join(', ')}`)
    if (desconhecidos.length > 0)
      partes.push(`não pertencem a este item: ${desconhecidos.join(', ')}`)

    throw new AppError(
      ErrorCode.CONFLICT,
      `A ordem precisa listar todas as imagens deste item, e só elas (${partes.join('; ')}).`,
      { status: 409 },
    )
  }

  await prisma.$transaction(async (tx) => {
    for (const [indice, id] of ids.entries()) {
      await tx.mediaAsset.update({ where: { id }, data: { sortOrder: indice } })
    }

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'media.reorder',
        entityType: entidadeDoDono(dono),
        entityId: dono.id,
        before: { ordem: atuais.map((m) => m.id) },
        after: { ordem: ids, principal: ids[0] },
        ip: ctx.ip,
      },
      tx,
    )
  })

  return listarMidias(dono)
}

/**
 * Compara os dois lados e devolve o que não tem par.
 *
 * Existe porque nenhuma disciplina de código cobre tudo: o `onDelete: Cascade`
 * do schema apaga as linhas de `media_assets` quando um Trip ou Product é
 * removido de verdade, e o arquivo no provedor não sabe disso. Enquanto o
 * projeto só arquivar (soft delete), isso não acontece — mas "enquanto" não é
 * garantia, e o custo de um vazamento é permanente.
 *
 * Roda como script: `npm run media:orfaos`.
 */
export async function procurarOrfaos(): Promise<{
  semRegistro: string[]
  semArquivo: { id: number; publicId: string }[]
}> {
  const storage = obterStorage()

  const [noStorage, noBanco] = await Promise.all([
    storage.listarPublicIds(`${PASTA_RAIZ}/`),
    prisma.mediaAsset.findMany({ select: { id: true, publicId: true } }),
  ])

  const registrados = new Set(noBanco.map((m) => m.publicId))
  const arquivos = new Set(noStorage)

  return {
    semRegistro: noStorage.filter((id) => !registrados.has(id)),
    semArquivo: noBanco.filter((m) => !arquivos.has(m.publicId)),
  }
}
