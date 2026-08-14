import { Montanhas } from '@/components/marca/grafismos'
import { LinkBotao } from '@/components/ui/button'

/**
 * 404.
 *
 * Fica na RAIZ, fora dos grupos de rota: ele precisa valer também para uma URL
 * que não casa com grupo nenhum. Por isso não tem header nem rodapé da loja —
 * e por isso traz os próprios links de volta.
 */
export default function NaoEncontrado() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-24 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10">
        <Montanhas className="h-56 opacity-30" />
      </div>

      <p className="text-caqui-ink-500 text-rotulo font-mono uppercase">Erro 404</p>
      <h1 className="text-display-l mt-3 uppercase">Essa trilha não existe</h1>

      <p className="text-caqui-ink-700 text-corpo-lg mt-5 max-w-md">
        A página que você procurou saiu do mapa. Pode ser um link antigo, ou uma expedição que foi
        arquivada.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <LinkBotao href="/agenda">Ver a agenda</LinkBotao>
        <LinkBotao href="/" variante="secondary">
          Voltar para o início
        </LinkBotao>
      </div>
    </main>
  )
}
