/**
 * PRÉ-VISUALIZAR AS LINHAS COM FOTO, NO BANCO LOCAL.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * Nenhum roteiro da Caqui tem capa no banco. `MiniaturaDaLinha` foi escrita
 * para o dia em que houver, e por isso ela devolve `null` em todas as linhas
 * hoje: o layout da agenda e do catálogo continua idêntico ao que sempre foi.
 *
 * O efeito colateral é que NÃO HÁ COMO OLHAR. Um componente que não renderiza
 * em lugar nenhum é um componente que ninguém sabe se funciona, e "parece
 * certo no código" não é verificação.
 *
 * Este script põe uma imagem de teste como capa de todos os roteiros
 * publicados, só no banco de desenvolvimento. A imagem é gerada aqui e apagada
 * junto: nada fica no repositório.
 *
 *   npx tsx --env-file=.env scripts/foto-temp.ts             põe
 *   npx tsx --env-file=.env scripts/foto-temp.ts --limpar    tira
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AS TRAVAS
 * ────────────────────────────────────────────────────────────────────────────
 * Ele escreve no banco, então segue as regras de operação destrutiva do
 * projeto, na medida do que faz sentido para um script de pré-visualização:
 *
 *  1. Recusa rodar se o banco conectado não tiver `dev` no nome. Um erro de
 *     `DATABASE_URL` não vai encher a produção de imagem de teste.
 *  2. Só apaga o que ELE criou, casando pela URL própria. `--limpar` nunca
 *     encosta numa foto de verdade.
 *  3. Sem `DATABASE_URL` no ambiente, para com uma mensagem dizendo o comando
 *     certo, em vez de cair no banco padrão do usuário do sistema.
 */
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import sharp from 'sharp'

import { PrismaClient } from '../src/generated/prisma/client'
import { createPgAdapter } from '../src/lib/db-adapter'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) {
  throw new Error('DATABASE_URL ausente. Rode com: npx tsx --env-file=.env scripts/foto-temp.ts')
}

const prisma = new PrismaClient({ adapter: createPgAdapter(connectionString) })

const limpar = process.argv.includes('--limpar')
/** A URL é a chave: é por ela que `--limpar` encontra só o que este script pôs. */
const URL_TEMP = '/temp-foto-de-teste.jpg'
const ARQUIVO = join(process.cwd(), 'public', 'temp-foto-de-teste.jpg')
const LARGURA = 1200
const ALTURA = 900

/**
 * A imagem. Faixas de cor sólidas, geradas por SVG.
 *
 * Deliberadamente NÃO parece uma foto de trilha: quem abrir a tela precisa
 * saber num relance que aquilo é andaime, e não conteúdo que alguém esqueceu.
 */
async function gerarImagem(arquivo: string = ARQUIVO, legenda = 'FOTO DE TESTE'): Promise<void> {
  const cores = ['#1b4332', '#2d6a4f', '#f26522', '#ff8a47', '#0b1114']
  const faixas = cores
    .map((cor, i) => {
      const w = LARGURA / cores.length
      return `<rect x="${i * w}" y="0" width="${w}" height="${ALTURA}" fill="${cor}"/>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
    ${faixas}
    <text x="${LARGURA / 2}" y="${ALTURA / 2}" font-family="monospace" font-size="64"
      fill="#ffffff" text-anchor="middle">${legenda}</text>
  </svg>`

  await writeFile(arquivo, await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer())
}

async function main() {
  const linhas = (await prisma.$queryRawUnsafe('SELECT current_database() AS banco')) as {
    banco: string
  }[]
  const banco = linhas[0]?.banco ?? '?'
  if (!banco.includes('dev')) {
    throw new Error(`Recusando: "${banco}" nao parece o banco de desenvolvimento.`)
  }
  console.log('banco:', banco)

  if (limpar) {
    // `startsWith` e não igualdade: as fotos por cor têm nome próprio
    // (`...-camiseta-0.jpg`), e a limpeza precisa alcançar todas.
    const alvos = await prisma.mediaAsset.findMany({
      where: { url: { startsWith: URL_TEMP.replace(/\.jpg$/, '') } },
      select: { url: true },
    })
    const { count } = await prisma.mediaAsset.deleteMany({
      where: { url: { startsWith: URL_TEMP.replace(/\.jpg$/, '') } },
    })
    for (const a of new Set(alvos.map((x) => join(process.cwd(), 'public', x.url.slice(1))))) {
      await unlink(a).catch(() => {})
    }
    console.log(`removidas ${count} imagens de teste, e os arquivos junto.`)
    return
  }

  await gerarImagem()

  const trips = await prisma.trip.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    select: { id: true, slug: true },
  })

  // Limpa antes de pôr, para rodar duas vezes não duplicar.
  await prisma.mediaAsset.deleteMany({
    where: { url: { startsWith: URL_TEMP.replace(/\.jpg$/, '') } },
  })

  for (const t of trips) {
    await prisma.mediaAsset.create({
      data: {
        url: URL_TEMP,
        publicId: `temp/${t.slug}`,
        alt: 'Imagem de teste, sem conteúdo real',
        width: LARGURA,
        height: ALTURA,
        sortOrder: 0,
        tripId: t.id,
      },
    })
  }

  console.log(`capa de teste em ${trips.length} roteiros. Veja /agenda e /trekking.`)

  // ──────────────────────────────────────────────────────────────────────────
  // UMA FOTO POR COR, NAS PEÇAS COM MAIS DE UMA COR
  // ──────────────────────────────────────────────────────────────────────────
  // Entrou em 19/08/2026 junto com `MediaAsset.colorName`: sem foto nenhuma no
  // banco não há como VER a galeria trocando com a cor, e um recurso que só
  // existe em teste é um recurso que ninguém conferiu na tela.
  //
  // Cada arquivo carrega o nome da cor escrito nele, para o acerto ou o erro
  // aparecerem de relance em vez de exigirem inspeção.
  const pecas = await prisma.product.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    select: { id: true, slug: true, variants: { select: { colorName: true } } },
  })

  let fotosDePeca = 0
  for (const peca of pecas) {
    const cores = [...new Set(peca.variants.map((v) => v.colorName))]
    if (cores.length < 2) continue

    for (const [i, cor] of cores.entries()) {
      const sufixo = `-${peca.slug}-${i}.jpg`
      const arquivo = ARQUIVO.replace(/\.jpg$/, sufixo)
      const url = URL_TEMP.replace(/\.jpg$/, sufixo)
      await gerarImagem(arquivo, cor.toUpperCase())

      await prisma.mediaAsset.create({
        data: {
          url,
          publicId: `temp/${peca.slug}/${i}`,
          alt: `Imagem de teste da cor ${cor}, sem conteúdo real`,
          width: LARGURA,
          height: ALTURA,
          sortOrder: i,
          productId: peca.id,
          colorName: cor,
        },
      })
      fotosDePeca += 1
    }
  }

  console.log(`${fotosDePeca} foto(s) de peça, uma por cor. Veja /wear e o CRM.`)
  console.log('para desfazer: npx tsx --env-file=.env scripts/foto-temp.ts --limpar')
}

main().finally(() => prisma.$disconnect())
