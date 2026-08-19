import { describe, expect, it } from 'vitest'

import { gerarHash, queimarTempoDeHash, verificarSenha } from '@/lib/auth/password'

/**
 * Arredonda para exibir numa mensagem de erro.
 *
 * Existe porque `toFixed` é proibido no projeto inteiro pelo ESLint: dinheiro
 * aqui é Int de centavos, e `toFixed` foi o atalho que no projeto de
 * referência reintroduziu float e errava sistematicamente acima de R$ 8.192.
 *
 * A regra não distingue dinheiro de razão de contraste ou de milissegundo, e
 * abrir exceção para arquivo de teste enfraqueceria a trava onde ela importa.
 * Sai mais barato ter esta função de três linhas.
 */
function arredondar(valor: number, casas: number): string {
  const fator = 10 ** casas
  return String(Math.round(valor * fator) / fator)
}

/**
 * O LOGIN LEVA O MESMO TEMPO PARA E-MAIL QUE EXISTE E PARA E-MAIL QUE NÃO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * NASCEU DE UM DEFEITO QUE ESTAVA NO AR, E QUE UM TESTE VERDE ESCONDIA
 * ════════════════════════════════════════════════════════════════════════════
 * `queimarTempoDeHash` existe para o login responder no mesmo tempo quando o
 * e-mail não tem conta. Até 18/08/2026 ela comparava contra um literal de
 * zeros com 59 caracteres. Hash bcrypt tem 60, e o `bcryptjs` confere o
 * comprimento antes de derivar qualquer coisa: a função voltava em 0,00 ms.
 *
 * Medido: caminho com usuário, 274 ms; caminho sem usuário, 0,00 ms. A função
 * que existia para fechar o oráculo ERA o oráculo, com cinco ordens de
 * grandeza de diferença, visível de qualquer lugar sem ferramenta nenhuma.
 *
 * O teste que já existia comparava `status`, `code` e `message` das duas
 * respostas e passava. Ele nunca olhou o relógio — e o relógio era o canal.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE A MARGEM É FROUXA
 * ════════════════════════════════════════════════════════════════════════════
 * Medir tempo em teste é instável por natureza: a máquina divide CPU, o GC
 * roda, a nuvem hospeda vizinhos. Uma margem apertada produziria falha
 * aleatória, e falha aleatória ensina o time a reexecutar o teste sem ler.
 *
 * O defeito que este arquivo persegue não é sutil: era 5 ordens de grandeza.
 * Exigir que os dois caminhos fiquem dentro do MESMO FATOR 3 pega isso com
 * folga e não pega ruído de agendamento.
 */
describe('o tempo do login não revela quais e-mails têm conta', () => {
  async function cronometrar(f: () => Promise<unknown>): Promise<number> {
    const antes = performance.now()
    await f()
    return performance.now() - antes
  }

  it('queimar tempo custa o mesmo que verificar uma senha de verdade', async () => {
    const hashReal = await gerarHash('uma-senha-qualquer-do-teste')

    // Uma passada de aquecimento em cada caminho: a primeira chamada carrega
    // código e infla a medição do que rodar primeiro.
    await verificarSenha('errada', hashReal)
    await queimarTempoDeHash()

    const comUsuario = await cronometrar(() => verificarSenha('errada', hashReal))
    const semUsuario = await cronometrar(() => queimarTempoDeHash())

    const razao = Math.max(comUsuario, semUsuario) / Math.max(1, Math.min(comUsuario, semUsuario))

    expect(
      razao,
      `O caminho com usuário levou ${arredondar(comUsuario, 1)}ms e o caminho sem usuário ` +
        `levou ${arredondar(semUsuario, 1)}ms (${arredondar(razao, 0)}x de diferença).\n\n` +
        'Isso é um oráculo de enumeração: dá para descobrir quais e-mails têm acesso ao CRM ' +
        'cronometrando duas requisições. O e-mail comercial da Caqui é público, no rodapé.\n\n' +
        'Causa provável: `HASH_FALSO` deixou de ser um hash bcrypt válido. Ele é DERIVADO em ' +
        '`src/lib/auth/password.ts` justamente para isso não poder acontecer; se alguém o ' +
        'trocou por um literal, o `bcryptjs` recusa pelo comprimento e volta em 0ms.',
    ).toBeLessThan(3)
  })

  it('e o caminho sem usuário custa de fato o preço de um hash', async () => {
    // Guarda contra a "correção" preguiçosa: alguém trocar o bcrypt por um
    // `setTimeout` fixo faria a razão passar e reintroduziria o problema em
    // máquina mais lenta, onde o hash real demora mais que o atraso fixo.
    const gasto = await cronometrar(() => queimarTempoDeHash())

    expect(
      gasto,
      `Queimar tempo levou ${arredondar(gasto, 2)}ms. Um bcrypt de custo 12 não roda em menos de ` +
        '10ms em máquina nenhuma. Se está rápido assim, ele não está derivando nada.',
    ).toBeGreaterThan(10)
  })
})
