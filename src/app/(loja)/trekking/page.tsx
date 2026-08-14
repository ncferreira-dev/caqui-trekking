import type { Metadata } from 'next'
import Link from 'next/link'

import { Capa } from '@/components/midia/imagem'
import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { LinkBotao } from '@/components/ui/button'
import { BadgeDificuldade, Etiqueta } from '@/components/ui/badge'
import { Card, CardCorpo, CardMidia, CardRodape, Ficha } from '@/components/ui/card'
import { diaEMes } from '@/lib/datetime'
import { formatarDuracao, rotuloDificuldade } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { listarTrips } from '@/server/services/trip-service'
import type { Dificuldade } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Expedições',
  description:
    'Roteiros guiados na Serra do Mar: distância, altimetria, dificuldade e duração de cada trilha.',
}

/**
 * A vitrine dos roteiros.
 *
 * A diferença entre esta página e a agenda é a pergunta que cada uma responde.
 * Aqui: "para onde dá para ir?" — e o card lidera com a FICHA TÉCNICA, porque
 * o que separa dois roteiros é distância, ganho de elevação e dificuldade. Na
 * agenda: "o que tem no dia 15?" — e lá o card lidera com a data.
 *
 * O mesmo dado, ordenado por duas perguntas diferentes. É por isso que são
 * dois componentes de card e não um com `variante`.
 */
export default async function PaginaTrekking() {
  const { trips, total } = await listarTrips({ limit: 30, offset: 0 })

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Roteiros"
        titulo="Expedições"
        descricao="Cada roteiro é escrito uma vez e repetido em datas diferentes. Escolha o roteiro aqui; a data, na agenda."
        cota={`${total} ${total === 1 ? 'roteiro' : 'roteiros'}`}
        acao={<LinkBotao href="/agenda">Ver por data</LinkBotao>}
      />

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        {trips.length === 0 ? (
          <p className="text-caqui-ink-700 text-corpo-lg">Nenhum roteiro publicado ainda.</p>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip, indice) => (
              <li key={trip.slug}>
                <Card interativo className="h-full">
                  <CardMidia>
                    <Capa
                      midia={trip.capa}
                      sizes="(min-width: 64rem) 22rem, (min-width: 40rem) 45vw, 92vw"
                      prioridade={indice < 3}
                    />
                  </CardMidia>

                  <CardCorpo>
                    <div className="flex flex-wrap gap-2">
                      <BadgeDificuldade nivel={trip.dificuldade as Dificuldade} />
                      {trip.tags.slice(0, 2).map((tag) => (
                        <Etiqueta key={tag.slug}>{tag.label}</Etiqueta>
                      ))}
                    </div>

                    <h2 className="text-display-s uppercase">
                      <Link
                        href={`/trekking/${trip.slug}`}
                        className="rounded-xs after:absolute after:inset-0 after:content-['']"
                      >
                        {trip.titulo}
                      </Link>
                    </h2>

                    <p className="text-caqui-ink-700 text-corpo-sm">
                      {trip.cidade} · {trip.estado}
                      {trip.regiao ? ` · ${trip.regiao}` : ''}
                    </p>

                    <Ficha
                      className="-mx-4 mt-auto sm:-mx-5"
                      itens={[
                        {
                          rotulo: 'Duração',
                          valor: trip.duracaoMinutos ? formatarDuracao(trip.duracaoMinutos) : '—',
                        },
                        { rotulo: 'Nível', valor: rotuloDificuldade(trip.dificuldade) },
                        {
                          rotulo: 'A partir de',
                          valor: trip.proximaSaida
                            ? formatarBRL(trip.proximaSaida.precoCentavos)
                            : '—',
                        },
                      ]}
                    />
                  </CardCorpo>

                  <CardRodape>
                    {trip.proximaSaida ? (
                      <>
                        <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                          Próxima data
                        </span>
                        <span className="text-caqui-ink-900 text-dado font-mono font-medium">
                          {diaEMes(new Date(trip.proximaSaida.inicioUtc))}
                        </span>
                      </>
                    ) : (
                      <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                        Sem data marcada
                      </span>
                    )}
                  </CardRodape>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
