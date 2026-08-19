import { describe, expect, it } from 'vitest'

import { classesDaLinha } from '@/components/catalogo/miniatura-da-linha'

/**
 * A MINIATURA NASCE DESLIGADA, E A LINHA SEM FOTO NÃO PODE MUDAR.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DEFEITO QUE ESTE TESTE IMPEDE
 * ────────────────────────────────────────────────────────────────────────────
 * Nenhum roteiro da Caqui tem capa no banco. A miniatura foi escrita em
 * 18/08/2026 para o dia em que houver, e a promessa feita ao cliente foi
 * explícita: enquanto não houver foto, a agenda e o catálogo continuam
 * EXATAMENTE como estão hoje.
 *
 * O jeito óbvio de escrever isso quebraria a promessa em silêncio: declarar a
 * coluna da foto sempre, e só não renderizar a imagem. Coluna vazia num grid
 * com `gap-x-5` não some — ela vira um vão de 20px na frente de todo título,
 * em todas as linhas, para sempre. Ninguém abriria um chamado por causa disso;
 * a lista só ficaria um pouco torta.
 *
 * Por isso a grade é escolhida pelo dado, e por isso este teste existe: ele
 * fixa as duas formas e prova que elas são diferentes.
 *
 * Verificado quebrando em 18/08/2026: fazendo `classesDaLinha` devolver sempre
 * a grade com foto, os dois primeiros casos falham.
 */
describe('grade da linha, com e sem foto', () => {
  const semFoto = classesDaLinha(false)
  const comFoto = classesDaLinha(true)

  it('SEM foto: a grade é a de duas colunas, sem coluna reservada', () => {
    expect(
      semFoto.grade,
      'a linha sem foto não pode declarar coluna para a miniatura: coluna vazia ' +
        'com `gap` vira um vão permanente na frente do título.',
    ).toBe('grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto]')

    expect(semFoto.grade).not.toContain('sm:grid-cols')
    expect(semFoto.conteudo).toBe('col-span-2 lg:col-span-1')
    expect(semFoto.dado).toBe('col-span-2 lg:col-span-1')
  })

  it('COM foto: entra uma coluna, e ela entra a partir de `sm`', () => {
    // A miniatura é `hidden sm:block`. Se a coluna aparecesse antes disso, o
    // celular ganharia uma coluna para um elemento que está `display: none`.
    expect(comFoto.grade).toContain('sm:grid-cols-[auto_auto_1fr]')
    expect(comFoto.grade).toContain('lg:grid-cols-[auto_auto_1fr_auto]')
    expect(comFoto.grade.startsWith('grid-cols-[auto_1fr]')).toBe(true)
  })

  it('as duas formas são de fato diferentes', () => {
    // Sem este caso, uma função que devolvesse sempre a mesma coisa passaria
    // nos dois de cima se alguém igualasse as constantes.
    expect(comFoto.grade).not.toBe(semFoto.grade)
    expect(comFoto.conteudo).not.toBe(semFoto.conteudo)
  })

  it('no celular as duas se comportam igual', () => {
    // A base (sem prefixo) precisa ser idêntica: é o que garante que ligar a
    // foto não mexe no layout de quem está no celular.
    const base = (classes: string) =>
      classes
        .split(' ')
        .filter((c) => !c.includes(':'))
        .join(' ')

    expect(base(comFoto.grade)).toBe(base(semFoto.grade))
    expect(base(comFoto.conteudo)).toBe(base(semFoto.conteudo))
    expect(base(comFoto.dado)).toBe(base(semFoto.dado))
  })
})
