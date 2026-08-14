import { Carregando, Esqueleto, EsqueletoCard } from '@/components/ui/esqueleto'

export default function CarregandoTrekking() {
  return (
    <Carregando descricao="Carregando os roteiros" className="flex flex-col">
      <div className="secao-areia px-5 pt-12 pb-16 sm:px-8 sm:pt-16">
        <div className="mx-auto w-full max-w-7xl">
          <Esqueleto className="h-3 w-32" />
          <Esqueleto className="mt-4 h-10 w-72 sm:h-12" />
          <Esqueleto className="mt-5 h-4 w-full max-w-xl" />
        </div>
      </div>

      <ul className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i}>
            <EsqueletoCard />
          </li>
        ))}
      </ul>
    </Carregando>
  )
}
