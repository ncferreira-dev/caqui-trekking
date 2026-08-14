import type { Metadata } from 'next'
import { Archivo_Black, DM_Mono, DM_Sans } from 'next/font/google'

import { URL_BASE } from '@/lib/seo/site'

import './globals.css'

/**
 * As três famílias, cada uma com um trabalho.
 *
 * `next/font` faz self-hosting: nenhuma requisição ao Google em runtime, e o
 * `size-adjust` calculado elimina o salto de layout na troca da fonte de
 * fallback pela real. É o motivo de as três declararem `display: 'swap'` sem
 * risco de CLS.
 *
 * Ver docs/06-design-system.md para a justificativa de cada escolha — em
 * especial por que Archivo Black e não Anton, que é onde este projeto
 * diverge do briefing escrito para bater com a logo real.
 */

const display = Archivo_Black({
  variable: '--fonte-display',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

const corpo = DM_Sans({
  variable: '--fonte-corpo',
  subsets: ['latin'],
  display: 'swap',
})

const dados = DM_Mono({
  variable: '--fonte-dados',
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  // `metadataBase` faz o Next resolver toda URL relativa (og:image, canônica)
  // contra o domínio real. Sem ele, o Open Graph sai com caminho relativo e o
  // WhatsApp não monta o card. Ponto único da base: `lib/seo/site`.
  metadataBase: new URL(URL_BASE),
  title: {
    default: 'Caqui Trekking · Ecoturismo e aventura em Mogi das Cruzes',
    template: '%s · Caqui Trekking',
  },
  description:
    'Expedições e trilhas guiadas na Serra do Mar, com guias cadastrados no Cadastur e monitores credenciados pelo PESM. Mogi das Cruzes, SP.',
  // O que é igual em toda página mora aqui e é herdado. O que muda — título,
  // descrição, canônica e og:url — entra por página via `metadataDaPagina`.
  openGraph: {
    type: 'website',
    siteName: 'Caqui Trekking',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${corpo.variable} ${dados.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white">{children}</body>
    </html>
  )
}
