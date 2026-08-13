import { cn } from '@/lib/ui/cn'

/**
 * Esqueleto de carregamento.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HACHURA QUE PULSA, NÃO BRILHO QUE VARRE
 * ────────────────────────────────────────────────────────────────────────────
 * O shimmer diagonal é o tique visual mais reconhecível de interface genérica
 * — e é caro: animar `background-position` repinta o elemento a cada frame, e
 * numa grade de 9 cards isso é repintura contínua por segundos em celular
 * modesto.
 *
 * Aqui a textura é uma hachura estática de 45°, e o que pulsa é `opacity`, que
 * o navegador compõe na GPU sem repintar nada. Além de mais barato, casa com o
 * traço gravado das montanhas da logo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SOB `prefers-reduced-motion`, O ESQUELETO PARA — E PRECISA DIZER ALGO
 * ────────────────────────────────────────────────────────────────────────────
 * Sem o pulso, um bloco cinza parado é indistinguível de conteúdo quebrado.
 * Por isso o contêiner leva `role="status"` e um texto só para leitor de tela.
 * O sinal de "carregando" não pode depender de movimento.
 */

export function Esqueleto({
  className,
  arredondado = false,
}: {
  className?: string
  arredondado?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-caqui-sand-100 block',
        arredondado && 'rounded-xs',
        'bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(13,13,13,0.13)_5px,rgba(13,13,13,0.13)_6px)]',
        'motion-safe:animate-[caqui-pulso_1.6s_ease-in-out_infinite]',
        className,
      )}
    />
  )
}

/**
 * Contêiner de uma região carregando.
 *
 * Envolve os esqueletos e anuncia o estado. `aria-busy` no elemento e um
 * `role="status"` invisível com o texto — leitor de tela fala "Carregando
 * expedições" uma vez, sem repetir a cada bloco.
 */
export function Carregando({
  children,
  descricao,
  className,
}: {
  children: React.ReactNode
  descricao: string
  className?: string
}) {
  return (
    <div aria-busy="true" className={className}>
      <span role="status" className="sr-only">
        {descricao}
      </span>
      {children}
    </div>
  )
}

/** Esqueleto com a forma exata do card real — não um retângulo genérico. */
export function EsqueletoCard() {
  return (
    <div className="border-caqui-rule chanfro-md flex flex-col border bg-white">
      <Esqueleto className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-3 p-5">
        <Esqueleto className="h-6 w-3/4" />
        <Esqueleto className="h-4 w-1/2" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Esqueleto className="h-10" />
          <Esqueleto className="h-10" />
          <Esqueleto className="h-10" />
        </div>
      </div>
    </div>
  )
}
