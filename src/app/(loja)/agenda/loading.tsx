import { Carregando, Esqueleto, EsqueletoCard } from '@/components/ui/esqueleto'

/**
 * O que aparece enquanto a agenda é montada no servidor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESQUELETO COM A FORMA DA PÁGINA, NUNCA UM GIRADOR NO MEIO DA TELA
 * ────────────────────────────────────────────────────────────────────────────
 * Um spinner centralizado comunica uma coisa só — "espere" — e apaga a página
 * inteira para dizê-la. O esqueleto comunica duas: "espere" e "vai chegar uma
 * grade de cards com foto, título e ficha aqui". A segunda é o que faz a
 * espera parecer menor, e é de graça.
 *
 * A contagem é 6 porque é o que cabe acima da dobra em desktop. Mais que isso
 * seria desenhar carregamento para conteúdo que ninguém está esperando ver.
 */
export default function CarregandoAgenda() {
  return (
    <Carregando descricao="Carregando a agenda" className="flex flex-col">
      <div className="secao-areia px-5 pt-12 pb-16 sm:px-8 sm:pt-16">
        <div className="mx-auto w-full max-w-7xl">
          <Esqueleto className="h-3 w-40" />
          <Esqueleto className="mt-4 h-10 w-64 sm:h-12" />
          <Esqueleto className="mt-5 h-4 w-full max-w-xl" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        <Esqueleto className="h-8 w-52" />

        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i}>
              <EsqueletoCard />
            </li>
          ))}
        </ul>
      </div>
    </Carregando>
  )
}
