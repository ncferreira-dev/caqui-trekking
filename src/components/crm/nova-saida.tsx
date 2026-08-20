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
   * Trilha escolhida antes de chegar aqui, vinda de `?trilha=` na URL.
   *
   * É o "publicar uma data" da tela de Roteiros. O formulário JÁ ABRE, com a
   * trilha selecionada: até 20/08/2026 aquele link só trazia para esta tela, e
   * a pessoa tinha que reencontrar na lista a mesma trilha em que ela acabou
   * de clicar — no roteiro que o alerta acabou de dizer que está sem data.
   */
  abrirCom,
}: {
  roteiros: RoteiroOpcao[]
  abrirCom?: number | undefined
}) {
  const [aberto, setAberto] = useState(abrirCom !== undefined)

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
      <Button onClick={() => setAberto(true)}>+ Nova saída</Button>
      {aberto && (
        <EditorDeSaida
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          roteiros={roteiros}
          {...(abrirCom !== undefined ? { roteiroInicial: abrirCom } : {})}
        />
      )}
    </>
  )
}
