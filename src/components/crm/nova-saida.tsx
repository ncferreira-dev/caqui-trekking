'use client'

import { useState } from 'react'

import { EditorDeSaida, type RoteiroOpcao } from '@/components/crm/editor-de-saida'
import { Button } from '@/components/ui/button'
import { Vazio } from '@/components/crm/pecas'

/**
 * O botão "Nova saída" e o formulário que ele abre.
 *
 * Fica separado da lista porque a lista é agrupada por mês, e o botão de criar
 * é um só para a tela inteira — repeti-lo por grupo confundiria. Quando não há
 * roteiro publicado, ele explica por que não dá para criar, em vez de abrir um
 * formulário com o seletor de roteiro vazio.
 */
export function NovaSaida({
  roteiros,
  /**
   * Trilha já selecionada no seletor quando o formulário abrir.
   *
   * SOZINHO, NÃO ABRE NADA. Ver `comecarAberto` abaixo.
   */
  roteiroInicial,
  /**
   * Abre o formulário assim que a tela monta.
   *
   * ──────────────────────────────────────────────────────────────────────────
   * POR QUE ISTO É UM PARÂMETRO SEPARADO
   * ──────────────────────────────────────────────────────────────────────────
   * Era um só, `abrirCom`, e ele significava as duas coisas ao mesmo tempo:
   * "pré-selecione esta trilha" E "já abra". Servia bem ao caso que o criou —
   * o link "publicar uma data" da tela de Roteiros, que trazia para cá com a
   * trilha escolhida e o formulário aberto.
   *
   * Aí a tela de Trilhas passou a repetir o botão DENTRO de cada trilha, com
   * `abrirCom={t.id}` só para pré-selecionar. Cinco trilhas na tela viraram
   * CINCO MODAIS ABERTOS, empilhados, e quem abria a tela tinha que fechar um
   * por um antes de conseguir olhar qualquer coisa. Nenhum erro no console:
   * cada modal estava fazendo exatamente o que foi mandado.
   *
   * Dois parâmetros porque são duas perguntas diferentes, e juntá-las fez a
   * resposta de uma decidir a outra em silêncio.
   */
  comecarAberto = false,
  rotulo = '+ Nova saída',
  variante = 'primary',
}: {
  roteiros: RoteiroOpcao[]
  roteiroInicial?: number | undefined
  comecarAberto?: boolean
  /** Dentro do bloco de uma trilha o botão vira "+ Nova data". */
  rotulo?: string
  variante?: 'primary' | 'secondary'
}) {
  const [aberto, setAberto] = useState(comecarAberto)

  if (roteiros.length === 0) {
    return (
      <Vazio titulo="Sem roteiro para agendar">
        <p>
          Uma saída sai de um roteiro. Cadastre e publique um roteiro primeiro, depois volte aqui
          para marcar a data.
        </p>
      </Vazio>
    )
  }

  return (
    <>
      <Button variante={variante} tamanho="sm" onClick={() => setAberto(true)}>
        {rotulo}
      </Button>
      {aberto && (
        <EditorDeSaida
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          roteiros={roteiros}
          {...(roteiroInicial !== undefined ? { roteiroInicial } : {})}
        />
      )}
    </>
  )
}
