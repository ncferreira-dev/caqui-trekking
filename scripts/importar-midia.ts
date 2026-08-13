import 'dotenv/config'

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { detectarFormato } from '@/lib/media/mime'
import { prisma } from '@/lib/prisma'
import { PASTA_RAIZ } from '@/server/media/storage'
import { enviarMidias, type TipoDeDono } from '@/server/services/admin/media-admin-service'

/**
 * Importação em lote de imagens a partir de uma pasta local.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A CONVENÇÃO DE NOME DE ARQUIVO
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     <slug-do-item>__<NN>__<texto-alternativo-em-kebab>.<ext>
 *              │       │              │
 *              │       │              └─ vira o `alt`: hífens viram espaços
 *              │       │                 e a primeira letra é maiúscula
 *              │       └───────────────── ordem na galeria. `01` é a PRINCIPAL
 *              └───────────────────────── precisa bater com um slug existente
 *
 * Exemplo:
 *
 *     camiseta-poliamida-azul__01__camiseta-azul-de-poliamida-vista-de-frente.jpg
 *     camiseta-poliamida-azul__02__detalhe-do-bordado-no-peito.jpg
 *     caneca-caqui__01__caneca-branca-com-a-logo-da-caqui-trekking.jpg
 *
 * Separador é `__` (dois sublinhados) porque slug usa hífen simples: nenhum
 * slug válido contém `__`, então a divisão nunca é ambígua.
 *
 * ── Por que as três partes são obrigatórias ─────────────────────────────────
 *
 *  - **slug**: o script NÃO cria produtos. Nome de arquivo não diz categoria
 *    nem preço, e inventar um produto a partir de um palpite colocaria peça
 *    errada no catálogo. Slug desconhecido é relatado, não adivinhado.
 *  - **NN**: sem ordem explícita, a galeria fica na ordem que o sistema de
 *    arquivos devolver — que muda entre máquinas.
 *  - **alt**: é obrigatório no model. Deixar opcional aqui abriria a exceção
 *    justamente no caminho que sobe dezenas de imagens de uma vez.
 *
 * ── Idempotência ────────────────────────────────────────────────────────────
 *
 * O `publicId` é derivado do nome: `caqui/<tipo>/<slug>/<NN>`. Rodar duas
 * vezes não duplica nada — o que já existe é pulado. Mesma disciplina do seed.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * USO
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     npm run media:importar                      # confere e não escreve nada
 *     npm run media:importar -- --aplicar         # sobe de verdade
 *     npm run media:importar -- --destino=roteiro
 *     npm run media:importar -- --renomear        # propõe nomes p/ a pasta crua
 *
 * O padrão é NÃO escrever. Um script de importação que sobe no primeiro
 * comando é um script que sobe errado na primeira tentativa.
 */

const PASTAS: Record<TipoDeDono, string> = {
  product: 'assets/wear',
  trip: 'assets/roteiros',
  guide: 'assets/guias',
}

const APELIDOS: Record<string, TipoDeDono> = {
  produto: 'product',
  product: 'product',
  roteiro: 'trip',
  trip: 'trip',
  guia: 'guide',
  guide: 'guide',
}

const EXTENSOES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif'])

type Entrada = {
  arquivo: string
  slug: string
  ordem: number
  alt: string
}

// ─── Convenção ───────────────────────────────────────────────────────────────

const PADRAO = /^([a-z0-9]+(?:-[a-z0-9]+)*)__(\d{2})__(.+)$/

/** `camiseta-azul-de-frente` → `Camiseta azul de frente`. */
export function altDeKebab(kebab: string): string {
  const frase = kebab.replace(/-+/g, ' ').trim()
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}

export function interpretarNome(arquivo: string): Entrada | { erro: string } {
  const extensao = path.extname(arquivo).toLowerCase()
  if (!EXTENSOES.has(extensao)) return { erro: `extensão ${extensao || '(nenhuma)'} não suportada` }

  const base = path.basename(arquivo, path.extname(arquivo))
  const partes = PADRAO.exec(base)

  if (!partes) {
    return {
      erro: 'fora da convenção <slug>__<NN>__<alt-em-kebab>. Rode com --renomear para uma sugestão',
    }
  }

  const [, slug, ordem, alt] = partes as unknown as [string, string, string, string]
  return { arquivo, slug, ordem: Number(ordem), alt: altDeKebab(alt) }
}

// ─── Modo --renomear ─────────────────────────────────────────────────────────

const ACENTOS = /[̀-ͯ]/g

export function paraSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(ACENTOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extrai a descrição e o preço de nomes como
 * `Camiseta cinza chumbo poliamida r$60,00 cada(2).jpg`.
 *
 * O preço é RELATADO, nunca gravado: quem define preço é o cadastro do produto
 * no CRM. Aqui ele serve para a pessoa conferir se o arquivo foi para a peça
 * certa.
 */
export function analisarNomeCru(arquivo: string): {
  descricao: string
  precoCentavos: number | null
} {
  const base = path.basename(arquivo, path.extname(arquivo))
  const preco = /r\$\s*(\d+)(?:[.,](\d{2}))?/i.exec(base)

  const descricao = base
    .replace(/r\$\s*[\d.,]+/i, ' ')
    // `cada_*` e não `\bcada\b`: o material real tem
    // `Baby look fúcsia dry fit r$50,00 cada_.jpg`, com sublinhado colado. O
    // `\b` não fecha depois de `_` (sublinhado é caractere de palavra), então
    // a versão ingênua criava um grupo duplicado da mesma peça. O `_*` seguido
    // de `\b` fecha ali sem engolir palavras como "cadastro".
    .replace(/\bcada_*\b/gi, ' ')
    .replace(/\(\d+\)/g, ' ')
    .replace(/[_\-–]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const centavos = preco ? Number(preco[1]) * 100 + Number(preco[2] ?? 0) : null

  return { descricao, precoCentavos: centavos }
}

/**
 * Extensão a partir dos BYTES, não do nome.
 *
 * Duas das fotos da Caqui chegaram sem extensão nenhuma (`Canecas r$35,00
 * cada`) e uma com `._` no lugar dela. São HEIC de iPhone. Propor `.jpg` para
 * elas seria propagar uma mentira que o resto do sistema já sabe não acreditar
 * — a mesma disciplina do `detectarFormato`, aplicada na hora de renomear.
 */
function extensaoReal(caminho: string): string {
  const cabecalho = readFileSync(caminho).subarray(0, 32)
  const formato = detectarFormato(cabecalho)

  if (formato) return `.${formato === 'jpeg' ? 'jpg' : formato}`

  // Formato irreconhecível: mantém o que estava, e a importação recusa depois
  // com mensagem própria.
  return path.extname(caminho).toLowerCase() || '.desconhecido'
}

function sugerirRenomeacao(pasta: string): void {
  const arquivos = listarArquivos(pasta)
  const grupos = new Map<string, { arquivo: string; precoCentavos: number | null }[]>()

  for (const arquivo of arquivos) {
    const { descricao, precoCentavos } = analisarNomeCru(arquivo)
    const slug = paraSlug(descricao)
    const lista = grupos.get(slug) ?? []
    lista.push({ arquivo, precoCentavos })
    grupos.set(slug, lista)
  }

  const linhas: string[] = [
    '#!/bin/sh',
    '# Sugestão de renomeação — GERADA, NÃO EXECUTADA.',
    '#',
    '# Confira slug e texto alternativo antes de rodar. O `alt` sugerido vem do',
    '# nome do arquivo e quase sempre precisa de ajuste: ele é lido em voz alta',
    '# por leitor de tela e indexado pelo Google Imagens.',
    '#',
    `# Pasta: ${pasta}`,
    '',
  ]

  for (const [slug, itens] of [...grupos.entries()].sort()) {
    const preco = itens.find((i) => i.precoCentavos !== null)?.precoCentavos
    linhas.push(`# ── ${slug} ${preco ? `(preço no arquivo: R$ ${preco / 100})` : ''}`)

    itens.forEach((item, indice) => {
      const ordem = String(indice + 1).padStart(2, '0')
      const alt = slug.replace(/-/g, ' ')
      const extensao = extensaoReal(path.join(pasta, item.arquivo))
      const novo = `${slug}__${ordem}__${paraSlug(alt)}${extensao}`
      linhas.push(`mv -- ${aspas(item.arquivo)} ${aspas(novo)}`)
    })

    linhas.push('')
  }

  const destino = path.join(pasta, 'renomear.sh')
  writeFileSync(destino, linhas.join('\n'), 'utf8')

  console.log(`\n${arquivos.length} arquivo(s) analisado(s), ${grupos.size} grupo(s) detectado(s).`)
  console.log(`Sugestão escrita em ${destino}. Revise antes de executar.\n`)
}

function aspas(valor: string): string {
  return `'${valor.replace(/'/g, `'\\''`)}'`
}

// ─── Importação ──────────────────────────────────────────────────────────────

function listarArquivos(pasta: string): string[] {
  let entradas: string[]
  try {
    entradas = readdirSync(pasta)
  } catch {
    console.error(`\n✖ Pasta não encontrada: ${pasta}\n`)
    process.exit(1)
  }

  return entradas
    .filter((nome) => !nome.startsWith('.') && nome !== 'renomear.sh')
    .filter((nome) => statSync(path.join(pasta, nome)).isFile())
    .sort()
}

async function importar(tipo: TipoDeDono, pasta: string, aplicar: boolean): Promise<void> {
  const arquivos = listarArquivos(pasta)
  const validas: Entrada[] = []
  const recusadas: { arquivo: string; motivo: string }[] = []

  for (const arquivo of arquivos) {
    const resultado = interpretarNome(arquivo)
    if ('erro' in resultado) recusadas.push({ arquivo, motivo: resultado.erro })
    else validas.push(resultado)
  }

  // Agrupa por slug e ordena pelo NN.
  const porSlug = new Map<string, Entrada[]>()
  for (const entrada of validas) {
    const lista = porSlug.get(entrada.slug) ?? []
    lista.push(entrada)
    porSlug.set(entrada.slug, lista)
  }
  for (const lista of porSlug.values()) lista.sort((a, b) => a.ordem - b.ordem)

  console.log(`\n${arquivos.length} arquivo(s) em ${pasta}`)
  console.log(`  ${validas.length} dentro da convenção, em ${porSlug.size} item(ns)`)
  console.log(`  ${recusadas.length} fora da convenção`)

  if (recusadas.length > 0) {
    console.log('\n  Fora da convenção:')
    for (const r of recusadas) console.log(`    • ${r.arquivo} — ${r.motivo}`)
  }

  let enviadas = 0
  let puladas = 0
  const semDono: string[] = []

  for (const [slug, entradas] of [...porSlug.entries()].sort()) {
    const dono = await encontrarDono(tipo, slug)

    if (!dono) {
      semDono.push(slug)
      continue
    }

    const aSubir: { entrada: Entrada; publicId: string }[] = []

    for (const entrada of entradas) {
      const publicId = `${PASTA_RAIZ}/${tipo}/${slug}/${String(entrada.ordem).padStart(2, '0')}`
      const existente = await prisma.mediaAsset.findFirst({
        where: { publicId },
        select: { id: true },
      })

      if (existente) puladas++
      else aSubir.push({ entrada, publicId })
    }

    console.log(
      `\n  ${slug} (${tipo} #${dono}) — ${aSubir.length} a enviar, ` +
        `${entradas.length - aSubir.length} já importada(s)`,
    )
    for (const item of aSubir) {
      console.log(`      ${item.entrada.ordem === 1 ? '★' : ' '} ${item.entrada.arquivo}`)
      console.log(`        alt: "${item.entrada.alt}"`)
    }

    if (!aplicar || aSubir.length === 0) continue

    await enviarMidias(
      { tipo, id: dono },
      aSubir.map((item) => ({
        bytes: readFileSync(path.join(pasta, item.entrada.arquivo)),
        nomeOriginal: item.entrada.arquivo,
        alt: item.entrada.alt,
        publicId: item.publicId,
      })),
      // Importação é ato do sistema, não de uma pessoa. `userId: 1` é o OWNER
      // criado pelo seed — a auditoria precisa de um autor, e mentir dizendo
      // que foi alguém no CRM seria pior que registrar a origem correta.
      { userId: 1, ip: null },
    )

    enviadas += aSubir.length
  }

  if (semDono.length > 0) {
    console.log(`\n  ✖ Sem ${tipo} correspondente (cadastre antes, o script não cria):`)
    for (const slug of semDono) console.log(`    • ${slug}`)
  }

  console.log(
    aplicar
      ? `\n✔ ${enviadas} imagem(ns) enviada(s), ${puladas} já existia(m).\n`
      : `\n(conferência) Nada foi enviado. Rode com --aplicar para valer.\n`,
  )
}

async function encontrarDono(tipo: TipoDeDono, slug: string): Promise<number | null> {
  if (tipo === 'product') {
    const p = await prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    })
    return p?.id ?? null
  }

  if (tipo === 'trip') {
    const t = await prisma.trip.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    })
    return t?.id ?? null
  }

  // Guia não tem slug no schema: o "slug" do arquivo é o id.
  const id = Number(slug)
  if (!Number.isInteger(id)) return null

  const g = await prisma.guide.findFirst({ where: { id, deletedAt: null }, select: { id: true } })
  return g?.id ?? null
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const aplicar = args.includes('--aplicar')
  const renomear = args.includes('--renomear')

  const destinoArg = args.find((a) => a.startsWith('--destino='))?.split('=')[1] ?? 'produto'
  const tipo = APELIDOS[destinoArg]

  if (!tipo) {
    console.error(`\n✖ --destino inválido: "${destinoArg}". Use produto, roteiro ou guia.\n`)
    process.exit(1)
  }

  const pastaArg = args.find((a) => a.startsWith('--pasta='))?.split('=')[1]
  const pasta = path.resolve(pastaArg ?? PASTAS[tipo])

  if (renomear) {
    sugerirRenomeacao(pasta)
    return
  }

  await importar(tipo, pasta, aplicar)
}

// `import.meta.url` só bate com o argv quando o arquivo é executado direto —
// os testes importam as funções puras acima sem disparar nada.
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  main()
    .catch((erro: unknown) => {
      console.error('\n✖ Falhou:', erro)
      process.exit(1)
    })
    .finally(() => void prisma.$disconnect())
}
