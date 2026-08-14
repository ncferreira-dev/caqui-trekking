import { Footer } from '@/components/shell/footer'
import { Header } from '@/components/shell/header'
import { WhatsAppFlutuante } from '@/components/shell/whatsapp-flutuante'
import { buscarSettings } from '@/server/services/institucional-service'

/**
 * Casca da loja.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * OS DADOS VÊM DO SERVIÇO, NÃO DE UM `fetch` NA PRÓPRIA API
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing pede "consuma a API real, sem mock". Isto é a API real: o mesmo
 * `buscarSettings()` que `GET /api/settings` chama, sem o desvio de uma
 * requisição HTTP do servidor para ele mesmo — que custaria uma conexão, um
 * round-trip e um ponto a mais para falhar, entregando exatamente os mesmos
 * bytes.
 *
 * A rota HTTP continua existindo, e é ela que o cliente usa. Aqui, quem já
 * está dentro do servidor fala direto com a camada de serviço.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O SITE NÃO CAI SE AS CONFIGURAÇÕES SUMIREM
 * ────────────────────────────────────────────────────────────────────────────
 * `buscarSettings()` devolve `null` quando a linha não existe. O rodapé
 * renderiza o que tiver e omite o resto; o botão de WhatsApp simplesmente não
 * aparece. Catálogo e agenda continuam de pé.
 *
 * O projeto de referência fazia o oposto — degradava banco fora do ar em
 * "200 com lista vazia", que para o Google Merchant significa "o catálogo
 * acabou". Aqui a regra é: falha de dado ESSENCIAL é erro; falha de dado
 * acessório é ausência.
 */
export default async function LayoutLoja({ children }: LayoutProps<'/'>) {
  const settings = await buscarSettings()

  return (
    <>
      <Header />

      {/* O alvo do link "pular para o conteúdo" do header. */}
      <main id="conteudo" className="flex flex-1 flex-col">
        {children}
      </main>

      <Footer settings={settings} />

      {settings?.whatsappNumber && <WhatsAppFlutuante numero={settings.whatsappNumber} />}
    </>
  )
}
