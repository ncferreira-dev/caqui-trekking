import type { Metadata } from 'next'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { LinkBotao } from '@/components/ui/button'
import { linkWhatsApp, telefoneBR } from '@/lib/formato'
import { buscarSettings } from '@/server/services/institucional-service'

import { FormularioDeContato } from './formulario'

export const metadata: Metadata = {
  title: 'Contato',
  description: 'Fale com a Caqui Trekking por WhatsApp, e-mail ou pelo formulário.',
}

export default async function PaginaContato() {
  const settings = await buscarSettings()

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Fale com a gente"
        titulo="Contato"
        descricao="A resposta mais rápida é pelo WhatsApp — é lá que a Caqui confirma vaga, tira dúvida de trilha e fecha grupo fechado."
        acao={
          settings?.whatsappNumber ? (
            <LinkBotao
              href={linkWhatsApp(settings.whatsappNumber)}
              tamanho="lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              {telefoneBR(settings.whatsappNumber)}
            </LinkBotao>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
        <FormularioDeContato />
      </div>
    </>
  )
}
