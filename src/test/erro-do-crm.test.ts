import { describe, expect, it } from 'vitest'

import { mensagemDeErro } from '@/lib/crm/api'

/**
 * A MENSAGEM DE ERRO DO PAINEL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * NASCEU FALHANDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * O cliente do CRM lia só `error.message` e descartava `error.details`. Toda
 * recusa de validação chegava na tela como "Dados inválidos.", sem o nome do
 * campo.
 *
 * Isso não é cosmético: foi o que manteve escondido um POST de saída que
 * recusava `meetingPoint: null` por um `.nullable()` faltando no schema. O
 * botão "+ Nova saída" não funcionava com os campos opcionais em branco, e a
 * tela não tinha como dizer isso.
 *
 * O schema foi consertado. Este teste guarda o MECANISMO: a próxima
 * divergência entre formulário e schema se anuncia sozinha, com o campo, na
 * tela de quem está tentando salvar.
 */
describe('mensagemDeErro', () => {
  it('nomeia o campo que o servidor recusou', () => {
    const texto = mensagemDeErro(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Dados inválidos.',
          details: [{ field: 'meetingPoint', message: 'Invalid input: expected string' }],
        },
      },
      400,
    )

    expect(texto).toContain('Dados inválidos.')
    expect(texto).toContain('meetingPoint')
    expect(texto).toContain('expected string')
  })

  it('junta vários campos numa linha só', () => {
    const texto = mensagemDeErro(
      {
        error: {
          message: 'Dados inválidos.',
          details: [
            { field: 'a', message: 'erro A' },
            { field: 'b', message: 'erro B' },
          ],
        },
      },
      400,
    )
    expect(texto).toBe('Dados inválidos. a: erro A · b: erro B')
  })

  it('resume quando passa de três campos, em vez de virar um muro', () => {
    const texto = mensagemDeErro(
      {
        error: {
          message: 'Dados inválidos.',
          details: ['a', 'b', 'c', 'd', 'e'].map((f) => ({ field: f, message: 'x' })),
        },
      },
      400,
    )
    expect(texto).toContain('e mais 2.')
    expect(texto).not.toContain('e: x')
  })

  it('não inventa nada quando o servidor não detalhou', () => {
    expect(mensagemDeErro({ error: { message: 'Já existe uma saída nesta data.' } }, 409)).toBe(
      'Já existe uma saída nesta data.',
    )
  })

  it('sobrevive a resposta sem corpo', () => {
    // Um 502 do proxy não devolve o envelope. A tela precisa dizer alguma
    // coisa, e essa coisa não pode ser "undefined".
    expect(mensagemDeErro(null, 502)).toBe('Falha inesperada (502).')
  })

  it('não repete "(raiz)" como se fosse nome de campo', () => {
    // O validador usa "(raiz)" para erro do objeto inteiro. Ecoar isso na tela
    // não diz nada a quem está preenchendo um formulário.
    const texto = mensagemDeErro(
      {
        error: {
          message: 'Dados inválidos.',
          details: [{ field: '(raiz)', message: 'Campo desconhecido: preco' }],
        },
      },
      400,
    )
    expect(texto).toBe('Dados inválidos. Campo desconhecido: preco')
  })
})
