import 'dotenv/config'

import { prisma } from '@/lib/prisma'
import { procurarOrfaos } from '@/server/services/admin/media-admin-service'

/**
 * Compara o storage com o banco e relata o que não tem par.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE, SE O DELETE JÁ APAGA DOS DOIS LADOS
 * ────────────────────────────────────────────────────────────────────────────
 * Porque nenhuma disciplina de código cobre tudo, e o custo de um vazamento de
 * storage é permanente e silencioso — as duas piores propriedades juntas. O
 * projeto de referência não vazou por má-fé: vazou porque o `if` que apagava
 * lia um campo que não existia no schema, então nunca entrava. O código
 * PARECIA apagar. Ninguém tinha como saber.
 *
 * Duas brechas conhecidas que este script cobre:
 *  1. `onDelete: Cascade` — apagar um Trip de verdade leva junto as linhas de
 *     `media_assets`, e o provedor não fica sabendo.
 *  2. Falha de rede no `catch` do upload, quando o próprio desfazer falha.
 *
 * Este script NÃO apaga nada. Ele lista, e a decisão é de quem lê.
 *
 *     npm run media:orfaos
 */
async function main(): Promise<void> {
  const { semRegistro, semArquivo } = await procurarOrfaos()

  console.log('\n── Arquivos no storage sem registro no banco ──')
  if (semRegistro.length === 0) {
    console.log('  nenhum')
  } else {
    console.log(`  ${semRegistro.length} — cobrados todo mês sem servir a nada:`)
    for (const id of semRegistro) console.log(`    • ${id}`)
  }

  console.log('\n── Registros no banco sem arquivo no storage ──')
  if (semArquivo.length === 0) {
    console.log('  nenhum')
  } else {
    console.log(`  ${semArquivo.length} — estes viram imagem quebrada na página:`)
    for (const m of semArquivo) console.log(`    • #${m.id} → ${m.publicId}`)
  }

  console.log('')
}

main()
  .catch((erro: unknown) => {
    console.error('\n✖ Falhou:', erro)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
