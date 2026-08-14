import type { Metadata } from 'next'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { LinkBotao } from '@/components/ui/button'
import { linkWhatsApp, telefoneBR } from '@/lib/formato'
import { buscarSettings } from '@/server/services/institucional-service'

import { FormularioDeContato } from './formulario'
import { metadataDaPagina } from '@/lib/seo/metadata'

export const metadata: Metadata = metadataDaPagina({
  titulo: 'Contato',
  descricao: 'Fale com a Caqui Trekking por WhatsApp, e-mail ou pelo formulário.',
  caminho: '/contato',
})

// Lê WhatsApp/Instagram do banco (editáveis no CRM sem deploy). Sem isto a
// página pré-renderiza no build e serve o número congelado até o próximo deploy
// — o mesmo opt-out que home, sobre, trekking e wear já declaram.
export const dynamic = 'force-dynamic'

export default async function PaginaContato() {
  const settings = await buscarSettings()

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Fale com a gente"
        titulo="Contato"
        descricao="A resposta mais rápida é pelo WhatsApp. É lá que a Caqui confirma vaga, tira dúvida de trilha e fecha grupo fechado."
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
