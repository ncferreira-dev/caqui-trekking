import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * AS TRAVAS DO LINT PRECISAM ESTAR LIGADAS ONDE IMPORTA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO QUE ORIGINOU ESTE ARQUIVO
 * ════════════════════════════════════════════════════════════════════════════
 * Em 18/08/2026 entrou um bloco novo no `eslint.config.mjs` proibindo travessão
 * em texto do site, escopado a `src/app/**` e `src/components/**`.
 *
 * Em flat config, as opções de uma MESMA regra não se somam entre blocos: o
 * último bloco que casa com o arquivo SUBSTITUI a configuração inteira. O bloco
 * novo apagou, em silêncio, a trava contra `text-caqui-orange-*` dentro dessas
 * duas pastas — que são exatamente onde `className` existe. Em `lib/` e
 * `server/`, onde a regra sobreviveu, há 1 `className` contra 1.312 nas outras
 * duas.
 *
 * A trava continuou verde, continuou documentada em três lugares, e parou de
 * olhar qualquer coisa. É o pior estado possível para uma verificação: existir
 * e não ver nada.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE UM TESTE, E NÃO UM COMENTÁRIO
 * ════════════════════════════════════════════════════════════════════════════
 * O comentário no arquivo de config avisa. Aviso não sobrevive ao próximo bloco
 * que alguém acrescentar por um motivo legítimo, seis meses depois, sem ler os
 * 40 comentários de cima.
 *
 * Este teste lê a configuração RESOLVIDA pelo próprio ESLint — a mesma que ele
 * usa em runtime, não uma leitura do arquivo — e falha se algum seletor sumir
 * de alguma pasta onde ele precisa valer.
 */

const ESPERADOS = [
  {
    apelido: 'laranja como cor de texto',
    // ⚠️ MONTADO EM PEDAÇOS, e não escrito inteiro.
    //
    // A regra que este teste protege procura exatamente esta sequência dentro
    // de qualquer `Literal` em `src/**`. Escrita de uma vez, ela se
    // auto-reprova e o `npm run lint` quebra por causa do teste que existe
    // para garantir o lint. É a mesma armadilha que o comentário do próprio
    // `eslint.config.mjs` descreve para a mensagem da regra.
    trecho: ['text-caqui', 'orange-'].join('-'),
    porque:
      'laranja como cor de texto dá 3,15:1 sobre branco e reprova no AA. É a coisa mais natural ' +
      'do mundo de se escrever e o erro é invisível para quem enxerga bem.',
  },
  {
    apelido: 'travessão em texto do site',
    trecho: '—',
    porque: 'decisão de voz da marca pedida pelo cliente em 18/08/2026.',
  },
]

/** As pastas onde `className` de fato existe, e onde as travas precisam valer. */
const ARQUIVOS = [
  'src/components/ui/button.tsx',
  'src/components/catalogo/linha-de-saida.tsx',
  'src/app/(loja)/page.tsx',
  'src/app/(crm)/crm/(painel)/painel/page.tsx',
]

type Opcao = { selector?: string; message?: string }

async function seletoresDe(arquivo: string): Promise<string> {
  const eslint = new ESLint()
  const config = (await eslint.calculateConfigForFile(arquivo)) as {
    rules?: Record<string, unknown>
  }
  const regra = config.rules?.['no-restricted-syntax']
  if (!Array.isArray(regra)) return ''
  // O primeiro item é a severidade; o resto são as opções.
  return (regra.slice(1) as Opcao[]).map((o) => `${o.selector ?? ''} ${o.message ?? ''}`).join('\n')
}

describe('travas do eslint continuam ligadas onde há className', () => {
  for (const arquivo of ARQUIVOS) {
    for (const trava of ESPERADOS) {
      it(`${arquivo} · ${trava.apelido}`, async () => {
        const seletores = await seletoresDe(arquivo)

        expect(
          seletores.includes(trava.trecho),
          `A trava contra ${trava.apelido} não está ativa em ${arquivo}.\n\n` +
            `Motivo de ela existir: ${trava.porque}\n\n` +
            'Causa provável: alguém acrescentou um bloco novo em eslint.config.mjs com\n' +
            '`no-restricted-syntax` e escopo que casa com este arquivo. Em flat config o\n' +
            'último bloco SUBSTITUI a regra inteira, não soma. Repita todos os seletores\n' +
            'no bloco novo. Ver o comentário no topo do próprio eslint.config.mjs.',
        ).toBe(true)
      })
    }
  }

  it('a varredura olhou arquivos de verdade', async () => {
    // Uma varredura que não acha nada passa em todos os casos por vacuidade.
    const seletores = await seletoresDe(ARQUIVOS[0]!)
    expect(seletores.length).toBeGreaterThan(0)
  })
})
