'use client'

import { useRouter } from 'next/navigation'
import { useId } from 'react'

import {
  FormularioDePeca,
  type ProdutoParaEditar,
  type VarianteForm,
} from '@/components/crm/formulario-de-peca'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'

/**
 * A CASCA de MODAL do formulário de peça — editar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO DEIXOU DE SER
 * ────────────────────────────────────────────────────────────────────────────
 * Até 20/08/2026 ele tinha 362 linhas com a própria validação, a própria
 * montagem de variante e a própria conversão de preço — as mesmas que a página
 * de cadastro tinha em outras 504. A mesma peça abria com duas caras, e o
 * primeiro campo novo entraria em um dos dois e não no outro.
 *
 * Agora ele é só a moldura. O formulário é `formulario-de-peca.tsx`, o mesmo
 * que a página usa.
 *
 * Modal e não página, como no projeto de referência: editar é ajuste pontual, e
 * tirar a pessoa da grade para mudar um preço seria pior.
 */

export type { ProdutoParaEditar, VarianteForm }

export function EditorDeProduto({
  aberto,
  aoFechar,
  produto,
}: {
  aberto: boolean
  aoFechar: () => void
  produto?: ProdutoParaEditar
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const idDoForm = useId()

  function terminar() {
    mostrar({ tom: 'sucesso', titulo: produto ? 'Peça salva' : 'Peça cadastrada' })
    router.refresh()
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={produto ? 'Editar peça' : 'Cadastrar peça'}
      className="w-[min(56rem,calc(100vw-2rem))]"
      rodape={
        <>
          <button
            type="button"
            onClick={aoFechar}
            className="border-caqui-sand-200 hover:bg-caqui-sand-100 rounded-lg border px-6 py-3 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={idDoForm}
            className="bg-caqui-orange-500 hover:bg-caqui-orange-600 text-caqui-ink-900 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
          >
            Salvar
          </button>
        </>
      }
    >
      <FormularioDePeca
        {...(produto ? { produto } : {})}
        aoTerminar={terminar}
        idDoForm={idDoForm}
      />
    </Modal>
  )
}
