import sharp from 'sharp'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { DELETE as midiaDelete, PATCH as midiaPatch } from '@/app/api/admin/media/[id]/route'
import { PATCH as reordenarRota } from '@/app/api/admin/media/reorder/route'
import { GET as listarMidiaRota, POST as uploadRota } from '@/app/api/admin/media/route'
import { DELETE as tagDelete, PATCH as tagPatch } from '@/app/api/admin/tags/[id]/route'
import { GET as listarTagsRota, POST as criarTagRota } from '@/app/api/admin/tags/route'
import { POST as loginRota } from '@/app/api/auth/login/route'
import { GET as tripPublicaRota } from '@/app/api/trips/[slug]/route'
import { _resetRateLimit } from '@/lib/api/rate-limit'
import { detectarFormato } from '@/lib/media/mime'
import { LARGURAS, srcsetDe, urlVariante } from '@/lib/media/urls'
import { gerarHash } from '@/lib/auth/password'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { dimensoesDeExibicao, processarImagem } from '@/server/media/processar'
import { procurarOrfaos } from '@/server/services/admin/media-admin-service'
import { exigirCredenciais } from '@/server/media/cloudinary'
import { storageDeMemoria } from '@/server/media/memoria'
import { criarFixtures, limparBanco, post, type Fixtures } from '@/test/fixtures'

const SENHA = 'senha-de-teste-owner'

let f: Fixtures

beforeEach(async () => {
  await limparBanco()
  storageDeMemoria.limpar()
  // O login tem limite por IP. Sem zerar entre casos, o 6º `logar()` levaria
  // 429 e o teste falharia por um motivo que não é o dele.
  _resetRateLimit()
  f = await criarFixtures()

  await prisma.user.create({
    data: {
      name: 'Dono da Caqui',
      email: 'owner@caqui.test',
      passwordHash: await gerarHash(SENHA),
      role: 'OWNER',
    },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logar(): Promise<string> {
  const res = await loginRota(
    post('/api/auth/login', { email: 'owner@caqui.test', senha: SENHA }) as never,
  )
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error(`login falhou: ${res.status}`)
  return setCookie.split(';')[0] ?? ''
}

function ctx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}

function json(url: string, cookie: string, corpo: unknown, metodo = 'PATCH'): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(corpo),
  })
}

/** JPEG de verdade, gerado na hora — sem binário versionado no repositório. */
async function jpeg(largura = 1200, altura = 900): Promise<Buffer> {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 210, g: 120, b: 40 } },
  })
    .jpeg()
    .toBuffer()
}

async function png(largura = 1000, altura = 1000): Promise<Buffer> {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 10, g: 90, b: 40 } },
  })
    .png()
    .toBuffer()
}

type Arquivo = { bytes: Buffer; nome: string; alt: string }

function upload(
  cookie: string,
  campos: Record<string, string>,
  arquivos: Arquivo[],
  alts?: string[],
): Request {
  const form = new FormData()
  for (const [chave, valor] of Object.entries(campos)) form.append(chave, valor)

  for (const arquivo of arquivos) {
    form.append('arquivos', new File([new Uint8Array(arquivo.bytes)], arquivo.nome))
  }

  for (const alt of alts ?? arquivos.map((a) => a.alt)) form.append('alt', alt)

  return new Request('http://localhost:3000/api/admin/media', {
    method: 'POST',
    headers: { cookie },
    body: form,
  })
}

type Corpo<T> = { data: T } | { error: { code: string; message: string } }

async function corpoDe<T>(res: Response): Promise<Corpo<T>> {
  return (await res.json()) as Corpo<T>
}

type MidiaResposta = {
  id: number
  url: string
  alt: string
  ordem: number
  principal: boolean
  publicId: string
  blurDataUrl: string | null
  largura: number
  altura: number
}

async function subirDuas(cookie: string): Promise<MidiaResposta[]> {
  const res = await uploadRota(
    upload(cookie, { productId: String(f.produto.id) }, [
      { bytes: await jpeg(), nome: 'frente.jpg', alt: 'Camiseta de frente' },
      { bytes: await png(), nome: 'costas.png', alt: 'Camiseta de costas' },
    ]),
  )

  const corpo = await corpoDe<MidiaResposta[]>(res)
  if (!('data' in corpo)) throw new Error(`upload falhou: ${JSON.stringify(corpo)}`)
  return corpo.data
}

// =============================================================================
describe('Detecção de formato pelos bytes', () => {
  it('reconhece JPEG e PNG reais', async () => {
    expect(detectarFormato(await jpeg(600, 600))).toBe('jpeg')
    expect(detectarFormato(await png(600, 600))).toBe('png')
  })

  it('reconhece WebP e AVIF reais', async () => {
    const base = {
      create: { width: 600, height: 600, channels: 3 as const, background: '#123456' },
    }
    expect(detectarFormato(await sharp(base).webp().toBuffer())).toBe('webp')
    expect(detectarFormato(await sharp(base).avif().toBuffer())).toBe('avif')
  })

  it('recusa PDF disfarçado de .jpg — a extensão não é consultada', () => {
    const pdf = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n')
    expect(detectarFormato(pdf)).toBeNull()
  })

  it('reconhece HEIC pela marca do container ISO-BMFF', () => {
    // `ftyp` no offset 4, marca `heic` no 8. É o cabeçalho que a câmera do
    // iPhone escreve — 2 das 41 fotos da Caqui vieram assim.
    const heic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypheic'),
      Buffer.from('\x00\x00\x00\x00mif1heic'),
    ])
    expect(detectarFormato(heic)).toBe('heic')
  })
})

// =============================================================================
describe('Validação da imagem', () => {
  it('aceita JPEG válido e extrai dimensões e blur', async () => {
    const processada = await processarImagem(await jpeg(1200, 900), 'foto.jpg')

    expect(processada.formato).toBe('jpeg')
    expect(processada.largura).toBe(1200)
    expect(processada.altura).toBe(900)
    expect(processada.blurDataUrl).toMatch(/^data:image\/webp;base64,/)
    // O LQIP viaja em toda resposta de catálogo: precisa ser minúsculo.
    expect(processada.blurDataUrl!.length).toBeLessThan(2000)
  })

  it('recusa arquivo acima de 12 MB', async () => {
    const grande = Buffer.alloc(13 * 1024 * 1024)
    Buffer.from([0xff, 0xd8, 0xff]).copy(grande)

    await expect(processarImagem(grande, 'enorme.jpg')).rejects.toMatchObject({
      code: 'MEDIA_TOO_LARGE',
      status: 413,
    })
  })

  it('recusa imagem com menor lado abaixo de 600px', async () => {
    await expect(processarImagem(await jpeg(1000, 400), 'baixa.jpg')).rejects.toMatchObject({
      code: 'MEDIA_TOO_SMALL',
      status: 422,
    })
  })

  it('recusa bytes mágicos de JPEG com conteúdo corrompido', async () => {
    // Passa na primeira camada (magic number) e morre na segunda (decodificação).
    const falso = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('nem de longe')])

    await expect(processarImagem(falso, 'mentira.jpg')).rejects.toMatchObject({
      code: 'MEDIA_INVALID_FILE',
      status: 415,
    })
  })

  it('recusa arquivo vazio', async () => {
    await expect(processarImagem(Buffer.alloc(0), 'vazio.jpg')).rejects.toMatchObject({
      code: 'MEDIA_INVALID_FILE',
    })
  })
})

// =============================================================================
describe('Orientação do EXIF', () => {
  it('troca os lados quando a foto está girada', () => {
    // Orientações 5 a 8 significam rotação de 90°: o arquivo guarda
    // 4032×3024 e a foto APARECE 3024×4032. Guardar o valor cru faria o
    // `width`/`height` do HTML reservar a proporção errada — CLS na hora em
    // que a imagem real chega.
    expect(dimensoesDeExibicao({ width: 4032, height: 3024, orientation: 6 })).toEqual({
      largura: 3024,
      altura: 4032,
    })
    expect(dimensoesDeExibicao({ width: 4032, height: 3024, orientation: 8 })).toEqual({
      largura: 3024,
      altura: 4032,
    })
  })

  it('mantém os lados quando não há rotação', () => {
    for (const orientation of [undefined, 1, 2, 3, 4]) {
      expect(dimensoesDeExibicao({ width: 1200, height: 900, orientation })).toEqual({
        largura: 1200,
        altura: 900,
      })
    }
  })
})

// =============================================================================
describe('URLs de variante', () => {
  const canonica = 'https://res.cloudinary.com/caqui/image/upload/v1730000000/caqui/trip/x/ab.jpg'

  it('injeta f_auto, q_auto e c_limit na largura pedida', () => {
    expect(urlVariante(canonica, 800)).toBe(
      'https://res.cloudinary.com/caqui/image/upload/f_auto,q_auto,c_limit,w_800/v1730000000/caqui/trip/x/ab.jpg',
    )
  })

  it('é idempotente — aplicar duas vezes substitui, não empilha', () => {
    const uma = urlVariante(canonica, 800)
    expect(urlVariante(uma, LARGURAS.thumb)).toBe(urlVariante(canonica, LARGURAS.thumb))
  })

  it('devolve URL de outro domínio intacta', () => {
    const estrangeira = 'https://exemplo.com/foto.jpg'
    expect(urlVariante(estrangeira, 800)).toBe(estrangeira)
  })

  it('não oferece no srcset largura maior que a imagem real', () => {
    // A menor foto real da marca tem 880px. Oferecer 1600w faria o navegador
    // escolher com base numa largura que não existe.
    const srcset = srcsetDe(canonica, 880)

    expect(srcset).toContain('320w')
    expect(srcset).toContain('640w')
    expect(srcset).toContain('880w')
    expect(srcset).not.toContain('960w')
    expect(srcset).not.toContain('1600w')
  })
})

// =============================================================================
describe('Upload', () => {
  it('recusa sem sessão, antes de ler o corpo', async () => {
    const res = await uploadRota(
      new Request('http://localhost:3000/api/admin/media', {
        method: 'POST',
        body: new FormData(),
      }),
    )

    expect(res.status).toBe(401)
    expect(storageDeMemoria.envios).toHaveLength(0)
  })

  it('grava dimensões, blur, publicId e ordem sequencial', async () => {
    const midias = await subirDuas(await logar())

    expect(midias).toHaveLength(2)
    expect(midias[0]!.ordem).toBe(0)
    expect(midias[0]!.principal).toBe(true)
    expect(midias[1]!.ordem).toBe(1)
    expect(midias[1]!.principal).toBe(false)

    expect(midias[0]!.largura).toBe(1200)
    expect(midias[0]!.altura).toBe(900)
    expect(midias[0]!.blurDataUrl).toMatch(/^data:image\/webp;base64,/)

    // O publicId é o que torna o delete possível. No projeto de referência ele
    // era descartado na resposta do provedor, e por isso nada nunca foi apagado.
    expect(midias[0]!.publicId).toMatch(/^caqui\/product\/camiseta-de-teste\//)
    expect(storageDeMemoria.objetos.has(midias[0]!.publicId)).toBe(true)
  })

  it('lista a galeria do item na ordem, com a principal marcada', async () => {
    const cookie = await logar()
    await subirDuas(cookie)

    const res = await listarMidiaRota(
      new Request(`http://localhost:3000/api/admin/media?productId=${f.produto.id}`, {
        headers: { cookie },
      }),
    )

    const corpo = await corpoDe<MidiaResposta[]>(res)
    if (!('data' in corpo)) throw new Error('esperava sucesso')

    expect(corpo.data.map((m) => m.ordem)).toEqual([0, 1])
    expect(corpo.data.filter((m) => m.principal)).toHaveLength(1)
  })

  it('continua a numeração em vez de reiniciar do zero', async () => {
    const cookie = await logar()
    await subirDuas(cookie)
    const segundas = await subirDuas(cookie)

    expect(segundas.map((m) => m.ordem)).toEqual([2, 3])
    expect(segundas.every((m) => !m.principal)).toBe(true)
  })

  it('um arquivo inválido no meio do lote impede TODOS os envios', async () => {
    const cookie = await logar()

    const res = await uploadRota(
      upload(cookie, { productId: String(f.produto.id) }, [
        { bytes: await jpeg(), nome: 'boa.jpg', alt: 'Válida' },
        { bytes: Buffer.from('%PDF-1.7 nem de longe uma imagem'), nome: 'ruim.jpg', alt: 'Falsa' },
        { bytes: await jpeg(), nome: 'outra.jpg', alt: 'Também válida' },
      ]),
    )

    expect(res.status).toBe(415)

    // O ponto do teste: NADA subiu. A validação toda acontece antes do
    // primeiro byte sair da máquina.
    expect(storageDeMemoria.envios).toHaveLength(0)
    expect(await prisma.mediaAsset.count()).toBe(0)
  })

  it('exige exatamente um dono', async () => {
    const cookie = await logar()
    const arquivo = [{ bytes: await jpeg(), nome: 'a.jpg', alt: 'A' }]

    const doisDonos = await uploadRota(
      upload(cookie, { productId: String(f.produto.id), tripId: String(f.trip.id) }, arquivo),
    )
    expect(doisDonos.status).toBe(400)

    const nenhumDono = await uploadRota(upload(cookie, {}, arquivo))
    expect(nenhumDono.status).toBe(400)

    expect(storageDeMemoria.envios).toHaveLength(0)
  })

  it('exige um alt por arquivo, na mesma ordem', async () => {
    const cookie = await logar()

    const res = await uploadRota(
      upload(
        cookie,
        { productId: String(f.produto.id) },
        [
          { bytes: await jpeg(), nome: 'a.jpg', alt: '' },
          { bytes: await jpeg(), nome: 'b.jpg', alt: '' },
        ],
        ['Só um alt para dois arquivos'],
      ),
    )

    expect(res.status).toBe(400)
    expect(storageDeMemoria.envios).toHaveLength(0)
  })

  it('aceita alt vazio — a marcação correta de imagem decorativa', async () => {
    const cookie = await logar()

    const res = await uploadRota(
      upload(
        cookie,
        { productId: String(f.produto.id) },
        [{ bytes: await jpeg(), nome: 'textura.jpg', alt: '' }],
        [''],
      ),
    )

    expect(res.status).toBe(200)
    const corpo = await corpoDe<MidiaResposta[]>(res)
    expect('data' in corpo && corpo.data[0]!.alt).toBe('')
  })

  it('devolve 404 quando o dono não existe, sem enviar nada', async () => {
    const cookie = await logar()

    const res = await uploadRota(
      upload(cookie, { productId: '9999' }, [{ bytes: await jpeg(), nome: 'a.jpg', alt: 'Órfã' }]),
    )

    expect(res.status).toBe(404)
    expect(storageDeMemoria.envios).toHaveLength(0)
  })

  it('remove do storage o que já tinha subido quando a gravação falha', async () => {
    const cookie = await logar()

    // A segunda falha: a primeira já está no provedor e precisa voltar.
    storageDeMemoria.falharNoProximoEnvio = null
    const original = storageDeMemoria.enviar.bind(storageDeMemoria)
    let chamadas = 0
    storageDeMemoria.enviar = async (arquivo) => {
      chamadas++
      if (chamadas === 2) throw new Error('provedor caiu no meio do lote')
      return original(arquivo)
    }

    try {
      const res = await uploadRota(
        upload(cookie, { productId: String(f.produto.id) }, [
          { bytes: await jpeg(), nome: 'a.jpg', alt: 'Primeira' },
          { bytes: await jpeg(), nome: 'b.jpg', alt: 'Segunda' },
        ]),
      )

      expect(res.status).toBe(500)
    } finally {
      storageDeMemoria.enviar = original
    }

    // Nem registro no banco, nem arquivo pendurado no provedor.
    expect(await prisma.mediaAsset.count()).toBe(0)
    expect(storageDeMemoria.objetos.size).toBe(0)
    expect(storageDeMemoria.remocoes).toHaveLength(1)
  })
})

// =============================================================================
describe('Delete', () => {
  it('apaga do banco E do storage, com o publicId certo', async () => {
    const cookie = await logar()
    const [primeira] = await subirDuas(cookie)

    const res = await midiaDelete(
      json(`/api/admin/media/${primeira!.id}`, cookie, {}, 'DELETE'),
      ctx({ id: String(primeira!.id) }),
    )

    expect(res.status).toBe(200)
    expect(await prisma.mediaAsset.findUnique({ where: { id: primeira!.id } })).toBeNull()
    expect(storageDeMemoria.objetos.has(primeira!.publicId)).toBe(false)
    expect(storageDeMemoria.remocoes).toEqual([{ tipo: 'remover', publicId: primeira!.publicId }])
  })

  it('quando o storage recusa, o registro NÃO some do banco', async () => {
    const cookie = await logar()
    const [primeira] = await subirDuas(cookie)

    storageDeMemoria.falharAoRemover = new Error('provedor fora do ar')

    const res = await midiaDelete(
      json(`/api/admin/media/${primeira!.id}`, cookie, {}, 'DELETE'),
      ctx({ id: String(primeira!.id) }),
    )

    expect(res.status).toBe(500)

    // O inverso do projeto de referência: lá o registro sumia da lista e o
    // arquivo ficava sendo cobrado para sempre. Aqui o delete falha inteiro,
    // e a Caqui vê a imagem de volta em vez de um vazamento silencioso.
    const aindaExiste = await prisma.mediaAsset.findUnique({ where: { id: primeira!.id } })
    expect(aindaExiste).not.toBeNull()
  })

  it('apagar a principal promove a seguinte — a galeria nunca fica sem capa', async () => {
    const cookie = await logar()
    const [primeira, segunda] = await subirDuas(cookie)

    await midiaDelete(
      json(`/api/admin/media/${primeira!.id}`, cookie, {}, 'DELETE'),
      ctx({ id: String(primeira!.id) }),
    )

    const restantes = await prisma.mediaAsset.findMany({
      where: { productId: f.produto.id },
      orderBy: { sortOrder: 'asc' },
    })

    expect(restantes).toHaveLength(1)
    expect(restantes[0]!.id).toBe(segunda!.id)
    // Sem a renumeração, sobraria uma galeria cuja menor ordem é 1 — sem
    // principal, e a capa do produto sumiria do site sem ninguém pedir.
    expect(restantes[0]!.sortOrder).toBe(0)
  })
})

// =============================================================================
describe('Reordenação', () => {
  it('aplica a ordem enviada e move a principal', async () => {
    const cookie = await logar()
    const [primeira, segunda] = await subirDuas(cookie)

    const res = await reordenarRota(
      json('/api/admin/media/reorder', cookie, {
        productId: f.produto.id,
        ids: [segunda!.id, primeira!.id],
      }),
    )

    expect(res.status).toBe(200)
    const corpo = await corpoDe<MidiaResposta[]>(res)
    if (!('data' in corpo)) throw new Error('esperava sucesso')

    expect(corpo.data.map((m) => m.id)).toEqual([segunda!.id, primeira!.id])
    expect(corpo.data[0]!.principal).toBe(true)
    expect(corpo.data[1]!.principal).toBe(false)
  })

  it('recusa manifesto incompleto — não apaga a diferença em silêncio', async () => {
    const cookie = await logar()
    const [primeira, segunda] = await subirDuas(cookie)

    const res = await reordenarRota(
      json('/api/admin/media/reorder', cookie, {
        productId: f.produto.id,
        ids: [segunda!.id], // faltou a primeira
      }),
    )

    expect(res.status).toBe(409)
    const corpo = await corpoDe<never>(res)
    expect('error' in corpo && corpo.error.message).toContain(String(primeira!.id))

    // E nada mudou.
    const ordem = await prisma.mediaAsset.findMany({
      where: { productId: f.produto.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    })
    expect(ordem.map((m) => m.id)).toEqual([primeira!.id, segunda!.id])
  })

  it('recusa id que pertence a outro item', async () => {
    const cookie = await logar()
    const [primeira, segunda] = await subirDuas(cookie)

    const daTrip = await prisma.mediaAsset.create({
      data: {
        tripId: f.trip.id,
        url: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg',
        publicId: 'caqui/trip/x/a',
        alt: 'De outro dono',
        width: 1000,
        height: 1000,
      },
    })

    const res = await reordenarRota(
      json('/api/admin/media/reorder', cookie, {
        productId: f.produto.id,
        ids: [segunda!.id, primeira!.id, daTrip.id],
      }),
    )

    expect(res.status).toBe(409)
    expect(await prisma.mediaAsset.findUnique({ where: { id: daTrip.id } })).toMatchObject({
      tripId: f.trip.id,
      sortOrder: 0,
    })
  })

  it('recusa ids repetidos', async () => {
    const cookie = await logar()
    const [primeira] = await subirDuas(cookie)

    const res = await reordenarRota(
      json('/api/admin/media/reorder', cookie, {
        productId: f.produto.id,
        ids: [primeira!.id, primeira!.id],
      }),
    )

    expect(res.status).toBe(409)
  })
})

// =============================================================================
describe('Texto alternativo', () => {
  it('atualiza e registra auditoria com o antes e o depois', async () => {
    const cookie = await logar()
    const [primeira] = await subirDuas(cookie)

    const res = await midiaPatch(
      json(`/api/admin/media/${primeira!.id}`, cookie, {
        alt: 'Camiseta azul de poliamida vista de frente',
      }),
      ctx({ id: String(primeira!.id) }),
    )

    expect(res.status).toBe(200)

    const auditoria = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'MediaAsset', action: 'media.alt' },
    })
    expect(auditoria.before).toEqual({ alt: 'Camiseta de frente' })
    expect(auditoria.after).toEqual({ alt: 'Camiseta azul de poliamida vista de frente' })
  })
})

// =============================================================================
describe('Exposição pública', () => {
  it('a rota pública devolve `principal` e NÃO devolve `publicId`', async () => {
    const cookie = await logar()

    const res = await uploadRota(
      upload(cookie, { tripId: String(f.trip.id) }, [
        { bytes: await jpeg(), nome: 'capa.jpg', alt: 'Vista do topo da Pedra Grande' },
        { bytes: await jpeg(), nome: 'trilha.jpg', alt: 'Trecho de mata fechada' },
      ]),
    )
    expect(res.status).toBe(200)

    const publica = await tripPublicaRota(
      new Request(`http://localhost:3000/api/trips/${f.trip.slug}`),
      ctx({ slug: f.trip.slug }),
    )

    const texto = await publica.text()
    expect(publica.status).toBe(200)

    // O CAMPO `publicId` não sai. Não é segredo — ele está embutido na própria
    // URL de entrega, por construção do provedor —, é ruído: um identificador
    // interno que o navegador não usa, viajando em toda listagem de catálogo.
    // A regra do projeto é lista de permissão, e ele não está nela.
    expect(texto).not.toContain('publicId')

    const corpo = JSON.parse(texto) as {
      data: { imagens: { alt: string; principal: boolean; blurDataUrl: string | null }[] }
    }

    expect(corpo.data.imagens).toHaveLength(2)
    expect(corpo.data.imagens[0]!.principal).toBe(true)
    expect(corpo.data.imagens[1]!.principal).toBe(false)
    expect(corpo.data.imagens[0]!.alt).toBe('Vista do topo da Pedra Grande')
  })
})

// =============================================================================
describe('Storage', () => {
  /**
   * O ambiente é ARRANJADO aqui, e isso é uma correção de 21/08/2026.
   *
   * Antes, este bloco dependia da máquina não ter Cloudinary configurado: o
   * teste passava porque o `.env` de quem rodava estava vazio. No dia em que a
   * credencial entrou, ele quebrou — e não por regressão nenhuma. Teste que
   * depende do ambiente prova o ambiente, não o código.
   *
   * `env` é o objeto devolvido pelo `safeParse` do Zod, sem `freeze`, então dá
   * para arranjar os dois cenários e devolver o estado no fim.
   */
  function comCredenciais<T>(
    valores: Partial<Record<Chave, string | undefined>>,
    corpo: () => T,
  ): T {
    const antes = { ...env }
    Object.assign(env, valores)
    try {
      return corpo()
    } finally {
      for (const chave of CHAVES) env[chave] = antes[chave]
    }
  }

  const CHAVES = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const
  type Chave = (typeof CHAVES)[number]

  it('sem credenciais, o erro NOMEIA as variáveis que faltam', () => {
    // "Erro ao enviar a imagem" não ajuda ninguém às 22h. O erro precisa dizer
    // QUAL variável falta.
    comCredenciais(
      {
        CLOUDINARY_CLOUD_NAME: undefined,
        CLOUDINARY_API_KEY: undefined,
        CLOUDINARY_API_SECRET: undefined,
      },
      () => {
        try {
          exigirCredenciais()
          throw new Error('deveria ter falhado')
        } catch (erro) {
          const e = erro as { code?: string; status?: number; message: string }
          expect(e.code).toBe('MEDIA_STORAGE_UNCONFIGURED')
          expect(e.status).toBe(503)
          expect(e.message).toContain('CLOUDINARY_CLOUD_NAME')
          expect(e.message).toContain('CLOUDINARY_API_KEY')
          expect(e.message).toContain('CLOUDINARY_API_SECRET')
        }
      },
    )
  })

  it('faltando UMA, o erro nomeia só ela', () => {
    // O cenário de configuração pela metade, que é o pior dos três: parece
    // pronta e só falha quando alguém tenta subir uma foto.
    comCredenciais(
      {
        CLOUDINARY_CLOUD_NAME: 'nuvem',
        CLOUDINARY_API_KEY: 'chave',
        CLOUDINARY_API_SECRET: undefined,
      },
      () => {
        try {
          exigirCredenciais()
          throw new Error('deveria ter falhado')
        } catch (erro) {
          const e = erro as { message: string }
          expect(e.message).toContain('CLOUDINARY_API_SECRET')
          expect(e.message).not.toContain('CLOUDINARY_CLOUD_NAME')
          expect(e.message).not.toContain('CLOUDINARY_API_KEY')
        }
      },
    )
  })

  it('com as três, devolve as credenciais e não levanta', () => {
    // O outro lado da moeda, que faltava: provar que o caminho feliz existe.
    // Sem ele, um `throw` incondicional passaria nos testes acima.
    const creds = comCredenciais(
      {
        CLOUDINARY_CLOUD_NAME: 'nuvem',
        CLOUDINARY_API_KEY: 'chave',
        CLOUDINARY_API_SECRET: 'segredo',
      },
      () => exigirCredenciais(),
    )

    expect(creds).toEqual({ cloudName: 'nuvem', apiKey: 'chave', apiSecret: 'segredo' })
  })

  it('o caçador de órfãos acha arquivo sem registro nos dois sentidos', async () => {
    const cookie = await logar()
    const [primeira] = await subirDuas(cookie)

    // Arquivo que ficou no provedor sem linha no banco — o vazamento que o
    // projeto de referência acumulou por dois anos.
    await storageDeMemoria.enviar({
      bytes: Buffer.from('x'),
      publicId: 'caqui/product/camiseta-de-teste/esquecida',
      mime: 'image/jpeg',
    })

    // E o contrário: linha apontando para arquivo que não existe mais.
    await prisma.mediaAsset.create({
      data: {
        productId: f.produto.id,
        url: 'https://res.cloudinary.com/x/image/upload/v1/sumida.jpg',
        publicId: 'caqui/product/camiseta-de-teste/sumida',
        alt: 'Arquivo apagado por fora',
        width: 1000,
        height: 1000,
        sortOrder: 9,
      },
    })

    const { semRegistro, semArquivo } = await procurarOrfaos()

    expect(semRegistro).toEqual(['caqui/product/camiseta-de-teste/esquecida'])
    expect(semArquivo).toEqual([
      expect.objectContaining({ publicId: 'caqui/product/camiseta-de-teste/sumida' }),
    ])
    expect(semRegistro).not.toContain(primeira!.publicId)
  })
})

// =============================================================================
describe('Tags de atividade', () => {
  it('lista com a contagem de roteiros', async () => {
    const cookie = await logar()

    const res = await listarTagsRota(
      new Request('http://localhost:3000/api/admin/tags', { headers: { cookie } }),
    )

    const corpo = await corpoDe<{ slug: string; roteiros: number }[]>(res)
    expect('data' in corpo && corpo.data).toEqual([
      expect.objectContaining({ slug: 'rapel', roteiros: 1 }),
    ])
  })

  it('cria e recusa slug repetido com 409', async () => {
    const cookie = await logar()

    const criada = await criarTagRota(
      json('/api/admin/tags', cookie, { slug: 'cachoeira', label: 'Cachoeira' }, 'POST'),
    )
    expect(criada.status).toBe(200)

    const repetida = await criarTagRota(
      json('/api/admin/tags', cookie, { slug: 'cachoeira', label: 'Outra' }, 'POST'),
    )
    expect(repetida.status).toBe(409)
  })

  it('recusa apagar tag em uso, dizendo em quantos roteiros ela está', async () => {
    const cookie = await logar()

    const res = await tagDelete(
      json(`/api/admin/tags/${f.tag.id}`, cookie, {}, 'DELETE'),
      ctx({ id: String(f.tag.id) }),
    )

    expect(res.status).toBe(409)
    const corpo = await corpoDe<never>(res)
    expect('error' in corpo && corpo.error.message).toContain('1 roteiro')

    expect(await prisma.activityTag.findUnique({ where: { id: f.tag.id } })).not.toBeNull()
  })

  it('edita label sem deixar mexer no slug', async () => {
    const cookie = await logar()

    const res = await tagPatch(
      json(`/api/admin/tags/${f.tag.id}`, cookie, { label: 'Rapel guiado', slug: 'outro-slug' }),
      ctx({ id: String(f.tag.id) }),
    )

    expect(res.status).toBe(200)

    const tag = await prisma.activityTag.findUniqueOrThrow({ where: { id: f.tag.id } })
    expect(tag.label).toBe('Rapel guiado')
    // O slug vai para `/expedicoes?tag=rapel` e para filtros salvos: mudar em
    // silêncio quebraria o que já está indexado.
    expect(tag.slug).toBe('rapel')
  })
})

// =============================================================================
describe('Importação em lote — convenção de nome', () => {
  it('interpreta nome dentro da convenção', async () => {
    const { interpretarNome } = await import('../../scripts/importar-midia')

    expect(
      interpretarNome('camiseta-poliamida-azul__01__camiseta-azul-vista-de-frente.jpg'),
    ).toEqual({
      arquivo: 'camiseta-poliamida-azul__01__camiseta-azul-vista-de-frente.jpg',
      slug: 'camiseta-poliamida-azul',
      ordem: 1,
      alt: 'Camiseta azul vista de frente',
    })
  })

  it('recusa nome fora da convenção e extensão não suportada', async () => {
    const { interpretarNome } = await import('../../scripts/importar-midia')

    // Os nomes reais que a Caqui entregou.
    expect(interpretarNome('IMG-20241102-WA0057.jpg')).toHaveProperty('erro')
    expect(interpretarNome('Camiseta Azul poliamida r$60,00 cada.jpg')).toHaveProperty('erro')
    expect(interpretarNome('camiseta-azul__01__frente.pdf')).toHaveProperty('erro')
    expect(interpretarNome('camiseta-azul__1__frente.jpg')).toHaveProperty('erro')
  })

  it('extrai descrição e preço dos nomes crus, para conferência', async () => {
    const { analisarNomeCru } = await import('../../scripts/importar-midia')

    expect(analisarNomeCru('Camiseta cinza chumbo poliamida r$60,00 cada(2).jpg')).toEqual({
      descricao: 'Camiseta cinza chumbo poliamida',
      precoCentavos: 6000,
    })

    expect(analisarNomeCru('Baby look fúcsia dry fit r$50,00 cada.jpg')).toEqual({
      descricao: 'Baby look fúcsia dry fit',
      precoCentavos: 5000,
    })
  })

  it('gera slug sem acento a partir da descrição', async () => {
    const { paraSlug } = await import('../../scripts/importar-midia')

    expect(paraSlug('Baby look fúcsia dry fit')).toBe('baby-look-fucsia-dry-fit')
    expect(paraSlug('Canecas — várias cores')).toBe('canecas-varias-cores')
  })
})
