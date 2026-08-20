import type { Metadata } from 'next'

import { CadastroDePeca } from '@/components/crm/cadastro-de-peca'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = {
  title: 'Cadastrar peça',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * Cadastrar peça, em página inteira.
 *
 * Era um modal até 20/08/2026. Virou página a pedido do cliente, que queria o
 * mesmo formato do projeto de referência — lá `CreateProductForm` vive em
 * `/create-product`, numa página própria, e só a EDIÇÃO é modal
 * (`EditProductModal`). A divisão faz sentido e foi mantida: cadastrar é uma
 * sessão de trabalho com foto, variante e texto; editar é um ajuste pontual.
 *
 * `exigirSessaoDaPagina` aqui também, e não só no layout: layout do Next não é
 * barreira. Ver `server/crm/sessao-da-pagina.ts`.
 */
export default async function PaginaNovaPeca() {
  await exigirSessaoDaPagina()

  return <CadastroDePeca />
}
