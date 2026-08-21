'use client'

import { useRouter } from 'next/navigation'

import { FormularioDePeca } from '@/components/crm/formulario-de-peca'

/**
 * A CASCA de PÁGINA do formulário de peça — cadastrar.
 *
 * Só a moldura: título, o formulário e o rodapé. Os campos, a validação e o
 * envio vivem em `formulario-de-peca.tsx`, compartilhados com o modal de
 * edição. Ver o comentário de lá.
 *
 * Página e não modal, como no projeto de referência: cadastrar é uma sessão de
 * trabalho com nome, descrição, fotos e uma grade de variantes, e um modal
 * aperta isso numa caixa com rolagem própria.
 */

const ID_DO_FORM = 'form-cadastrar-peca'

export function CadastroDePeca() {
  const router = useRouter()

  /**
   * Cadastrou, vai para as FOTOS daquela peça — não para a lista.
   *
   * Decisão de 21/08/2026, com o Cloudinary já ligado: o upload precisa do id,
   * que só nasce no `INSERT`. Mandar para a lista faria a pessoa procurar a
   * peça que ela acabou de criar para poder fotografá-la. A lista continua a
   * um clique, no "Concluir" da tela de fotos.
   */
  function terminar(produtoId: number) {
    router.push(`/crm/produtos/${produtoId}/fotos`)
    router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="border-caqui-sand-200 rounded-lg border bg-white p-6 sm:p-8">
        <h1 className="font-display text-display-s mb-6 uppercase">Cadastrar peça</h1>

        <FormularioDePeca aoTerminar={terminar} idDoForm={ID_DO_FORM} />

        <div className="border-caqui-sand-200 mt-6 flex flex-wrap justify-end gap-3 border-t pt-6">
          <button
            type="button"
            onClick={() => router.push('/crm/produtos')}
            className="border-caqui-sand-200 hover:bg-caqui-sand-100 rounded-lg border px-6 py-3 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={ID_DO_FORM}
            className="bg-caqui-orange-500 hover:bg-caqui-orange-600 text-caqui-ink-900 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
          >
            Cadastrar peça
          </button>
        </div>
      </div>
    </div>
  )
}
