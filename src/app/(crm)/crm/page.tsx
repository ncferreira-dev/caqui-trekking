import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Brasao } from '@/components/marca/grafismos'
import { sessaoDaPagina } from '@/server/crm/sessao-da-pagina'

import { FormularioDeLogin } from './login'

export const metadata: Metadata = {
  title: 'CRM',
  robots: { index: false, follow: false },
}

/**
 * Entrada do CRM.
 *
 * A porta: o formulário real, contra `POST /api/auth/login`, que tem bloqueio
 * de conta no banco, cookie `httpOnly` e resposta idêntica para e-mail
 * inexistente. O painel fica em `/crm/painel` e nas outras rotas de
 * `(painel)`, com casca própria.
 */
export const dynamic = 'force-dynamic'

export default async function PaginaCrm() {
  // Quem já tem sessão não vê o formulário de novo: `/crm` é o endereço que a
  // Caqui vai guardar, e cair no login estando logada é atrito puro.
  if (await sessaoDaPagina()) redirect('/crm/painel')

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4">
          <Brasao className="w-24" titulo="Caqui Trekking" />
          <h1 className="text-display-m uppercase">Painel</h1>
        </div>

        <div className="border-caqui-ink-900 chanfro-md mt-8 border bg-white p-6">
          <FormularioDeLogin />
        </div>

        <p className="text-caqui-ink-500 text-micro mt-6 text-center font-mono uppercase">
          Acesso restrito · Caqui Trekking
        </p>
      </div>
    </main>
  )
}
