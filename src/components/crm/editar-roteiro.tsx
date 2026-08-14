'use client'

import { useState } from 'react'

import { EditorDeRoteiro, type RoteiroParaEditar } from '@/components/crm/editor-de-roteiro'

/**
 * O botão "Editar" de cada roteiro, e o modal que ele abre.
 *
 * Componente cliente fino: a página de roteiros continua sendo servidor, só
 * busca e desenha. O estado de aberto/fechado vive aqui, por linha.
 */
export function EditarRoteiro({ roteiro }: { roteiro: RoteiroParaEditar }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
      >
        Editar
      </button>
      {aberto && (
        <EditorDeRoteiro aberto={aberto} aoFechar={() => setAberto(false)} roteiro={roteiro} />
      )}
    </>
  )
}
