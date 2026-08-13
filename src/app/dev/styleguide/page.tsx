import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { env } from '@/lib/env'

import { Styleguide } from './styleguide'

/**
 * `/dev/styleguide` — a vitrine do design system.
 *
 * NÃO EXISTE EM PRODUÇÃO. A rota responde 404 quando `NODE_ENV=production`.
 *
 * Não é segredo — não há nada de sensível aqui —, é higiene: uma rota de
 * desenvolvimento publicada vira superfície indexável, aparece em sitemap por
 * engano e envelhece sem ninguém olhar. O projeto de referência mantinha
 * `server/uploads/` servindo arquivos de 2025 por uma rota que ninguém
 * revisava; o padrão é o mesmo.
 */
export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
}

export default function PaginaStyleguide() {
  if (env.NODE_ENV === 'production') notFound()
  return <Styleguide />
}
