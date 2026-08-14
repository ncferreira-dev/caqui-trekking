import { Carregando, Esqueleto } from '@/components/ui/esqueleto'

/**
 * O esqueleto do detalhe reserva o SELETOR DE SAÍDA.
 *
 * É o ponto de conversão da página, e é o único bloco que precisa de dado do
 * servidor para existir. Se o esqueleto desenhasse só o texto à esquerda, a
 * coluna da direita nasceria depois e empurraria o layout — justamente no
 * elemento que a pessoa está indo clicar.
 */
export default function CarregandoRoteiro() {
  return (
    <Carregando descricao="Carregando a expedição" className="flex flex-col">
      <div className="secao-areia px-5 pt-12 pb-16 sm:px-8 sm:pt-16">
        <div className="mx-auto w-full max-w-7xl">
          <Esqueleto className="h-3 w-48" />
          <Esqueleto className="mt-4 h-10 w-full max-w-lg sm:h-12" />
          <Esqueleto className="mt-5 h-4 w-full max-w-md" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Esqueleto className="aspect-[4/3] w-full sm:aspect-[3/2]" />
          <div className="hidden grid-rows-2 gap-3 sm:grid">
            <Esqueleto />
            <Esqueleto />
          </div>
        </div>

        <Esqueleto className="mt-8 h-20 w-full" />

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div className="flex flex-col gap-4">
            <Esqueleto className="h-4 w-full" />
            <Esqueleto className="h-4 w-11/12" />
            <Esqueleto className="h-4 w-4/5" />
            <Esqueleto className="mt-6 h-4 w-full" />
            <Esqueleto className="h-4 w-10/12" />
          </div>

          <Esqueleto className="h-96 w-full" />
        </div>
      </div>
    </Carregando>
  )
}
