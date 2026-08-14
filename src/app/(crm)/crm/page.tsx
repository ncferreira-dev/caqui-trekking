import type { Metadata } from 'next'

import { Brasao } from '@/components/marca/grafismos'

import { FormularioDeLogin } from './login'

export const metadata: Metadata = {
  title: 'CRM',
  robots: { index: false, follow: false },
}

/**
 * Entrada do CRM.
 *
 * O painel — dashboard, agenda, mensagens, mídia — é o PROMPT 10. O que existe
 * aqui é a porta: o formulário real, contra `POST /api/auth/login`, que já
 * tem bloqueio de conta no banco, cookie `httpOnly` e resposta idêntica para
 * e-mail inexistente.
 */
export default function PaginaCrm() {
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
