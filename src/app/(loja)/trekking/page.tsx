import type { Metadata } from 'next'
import Link from 'next/link'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { BadgeDificuldade, Etiqueta } from '@/components/ui/badge'
import { Card, CardCorpo, Ficha } from '@/components/ui/card'
import { formatarDuracao, rotuloDificuldade } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { listarTrips } from '@/server/services/trip-service'

export const metadata: Metadata = {
  title: 'Expedições',
  description:
    'Roteiros guiados na Serra do Mar: distância, altimetria, dificuldade e duração de cada trilha.',
}

/** A galeria com lightbox, o seletor de saída e a barra fixa são o PROMPT 08. */
export default async function PaginaTrekking() {
  const { trips, total } = await listarTrips({ limit: 30, offset: 0 })

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Roteiros"
        titulo="Expedições"
        descricao="Cada roteiro é escrito uma vez e repetido em datas diferentes. Escolha o roteiro aqui; a data, na agenda."
        cota={`${total} ${total === 1 ? 'roteiro' : 'roteiros'}`}
      />

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        {trips.length === 0 ? (
          <p className="text-caqui-ink-700 text-corpo-lg">Nenhum roteiro publicado ainda.</p>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <li key={trip.slug}>
                <Link href={`/trekking/${trip.slug}`} className="block h-full rounded-xs">
                  <Card interativo className="h-full">
                    <CardCorpo>
                      <div className="flex flex-wrap gap-2">
                        <BadgeDificuldade
                          nivel={trip.dificuldade as 'FACIL' | 'MODERADO' | 'DIFICIL' | 'EXTREMO'}
                        />
                        {trip.tags.slice(0, 2).map((tag) => (
                          <Etiqueta key={tag.slug}>{tag.label}</Etiqueta>
                        ))}
                      </div>

                      <h2 className="text-display-s uppercase">{trip.titulo}</h2>
                      <p className="text-caqui-ink-700 text-corpo-sm">
                        {trip.cidade} · {trip.estado}
                        {trip.regiao ? ` · ${trip.regiao}` : ''}
                      </p>

                      {trip.duracaoMinutos !== null && (
                        <Ficha
                          className="-mx-4 sm:-mx-5"
                          itens={[
                            { rotulo: 'Duração', valor: formatarDuracao(trip.duracaoMinutos) },
                            { rotulo: 'Dificuldade', valor: rotuloDificuldade(trip.dificuldade) },
                            {
                              rotulo: 'A partir de',
                              valor: trip.proximaSaida
                                ? formatarBRL(trip.proximaSaida.precoCentavos)
                                : '—',
                            },
                          ]}
                        />
                      )}

                      {trip.proximaSaida === null && (
                        <p className="text-caqui-ink-500 text-micro mt-auto pt-2 font-mono uppercase">
                          Sem data marcada
                        </p>
                      )}
                    </CardCorpo>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
