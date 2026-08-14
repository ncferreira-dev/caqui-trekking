import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { BadgeDificuldade, BadgeDisponibilidade, Etiqueta } from '@/components/ui/badge'
import { Acordeao, AcordeaoItem } from '@/components/ui/acordeao'
import { Ficha } from '@/components/ui/card'
import { AppError } from '@/lib/api/errors'
import { diaEMes } from '@/lib/datetime'
import { formatarDuracao, rotuloDificuldade } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { buscarTripPorSlug } from '@/server/services/trip-service'

export async function generateMetadata({
  params,
}: PageProps<'/trekking/[slug]'>): Promise<Metadata> {
  const { slug } = await params

  try {
    const trip = await buscarTripPorSlug(slug)
    return {
      title: trip.titulo,
      description: trip.subtitulo ?? trip.descricao.slice(0, 160),
    }
  } catch {
    // Metadado de página inexistente não deve derrubar o render — o próprio
    // componente devolve 404 logo em seguida, e ali a mensagem é melhor.
    return { title: 'Expedição não encontrada' }
  }
}

/**
 * Detalhe do roteiro.
 *
 * O PROMPT 08 traz aqui a galeria com lightbox, o mapa do ponto de encontro,
 * os guias com foto e credencial, a barra fixa de compra no mobile e — o mais
 * importante — o SELETOR DE SAÍDA, que é o ponto de conversão da página.
 * O que existe agora é o conteúdo real, na estrutura que o 08 vai vestir.
 */
export default async function PaginaDoRoteiro({ params }: PageProps<'/trekking/[slug]'>) {
  const { slug } = await params

  let trip
  try {
    trip = await buscarTripPorSlug(slug)
  } catch (erro) {
    if (erro instanceof AppError) notFound()
    throw erro
  }

  const futuras = trip.saidas.filter((s) => !s.encerrada)

  return (
    <>
      <CabecalhoDePagina
        sobretitulo={`${trip.cidade} · ${trip.estado}${trip.regiao ? ` · ${trip.regiao}` : ''}`}
        titulo={trip.titulo}
        {...(trip.subtitulo ? { descricao: trip.subtitulo } : {})}
      />

      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex flex-wrap gap-2">
          <BadgeDificuldade
            nivel={trip.dificuldade as 'FACIL' | 'MODERADO' | 'DIFICIL' | 'EXTREMO'}
          />
          {trip.tags.map((tag) => (
            <Etiqueta key={tag.slug}>{tag.label}</Etiqueta>
          ))}
        </div>

        <Ficha
          className="mt-8"
          itens={[
            { rotulo: 'Distância', valor: trip.distanciaKm?.toString() ?? '—', unidade: 'km' },
            {
              rotulo: 'Ganho',
              valor: trip.ganhoElevacaoM ? `+${trip.ganhoElevacaoM}` : '—',
              unidade: 'm',
            },
            {
              rotulo: 'Duração',
              valor: trip.duracaoMinutos ? formatarDuracao(trip.duracaoMinutos) : '—',
            },
            {
              rotulo: 'Altitude máx.',
              valor: trip.altitudeMaximaM?.toString() ?? '—',
              unidade: 'm',
            },
            { rotulo: 'Dificuldade', valor: rotuloDificuldade(trip.dificuldade) },
            {
              rotulo: 'Idade mínima',
              valor: trip.idadeMinima ? `${trip.idadeMinima}` : 'Livre',
              ...(trip.idadeMinima ? { unidade: 'anos' } : {}),
            },
          ]}
        />

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-10">
            <div className="text-corpo max-w-2xl whitespace-pre-line">{trip.descricao}</div>

            {trip.destaques.length > 0 && (
              <section>
                <h2 className="text-display-s uppercase">Destaques</h2>
                <ul className="mt-4 flex flex-col gap-2">
                  {trip.destaques.map((item) => (
                    <li key={item} className="border-caqui-rule text-corpo border-b pb-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Acordeao>
              <AcordeaoItem grupo="roteiro" titulo="O que está incluso" abertoPorPadrao>
                <ListaSimples itens={trip.incluso} vazio="A definir." />
              </AcordeaoItem>
              <AcordeaoItem grupo="roteiro" titulo="Não está incluso">
                <ListaSimples itens={trip.naoIncluso} vazio="Nada a declarar." />
              </AcordeaoItem>
              <AcordeaoItem grupo="roteiro" titulo="O que levar">
                <ListaSimples itens={trip.oQueLevar} vazio="A definir." />
              </AcordeaoItem>
              {trip.politicaCancelamento && (
                <AcordeaoItem grupo="roteiro" titulo="Política de cancelamento">
                  <p className="whitespace-pre-line">{trip.politicaCancelamento}</p>
                </AcordeaoItem>
              )}
            </Acordeao>
          </div>

          {/* Seletor de saída — a versão do PROMPT 08 traz quantidade de vagas,
              adicionar à mochila e barra fixa no mobile. */}
          <aside className="border-caqui-ink-900 h-fit border p-5 lg:sticky lg:top-24">
            <h2 className="text-display-s uppercase">Próximas datas</h2>

            {futuras.length === 0 ? (
              <p className="text-caqui-ink-700 text-corpo-sm mt-4">
                Sem data marcada para este roteiro. Chame no WhatsApp — a Caqui monta saída fechada
                para grupo.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col">
                {futuras.map((saida) => (
                  <li
                    key={saida.id}
                    className="border-caqui-rule flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
                  >
                    <div>
                      <p className="text-corpo-sm font-mono uppercase">
                        {diaEMes(new Date(saida.inicioUtc))}
                      </p>
                      {saida.horarioEncontro && (
                        <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                          {saida.horarioEncontro} · {saida.pontoEncontro ?? 'ponto a confirmar'}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-display text-corpo">{formatarBRL(saida.precoCentavos)}</p>
                      <BadgeDisponibilidade estado={saida.disponibilidade} className="mt-1" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}

function ListaSimples({ itens, vazio }: { itens: string[]; vazio: string }) {
  if (itens.length === 0) return <p>{vazio}</p>
  return (
    <ul className="list-inside list-disc space-y-1">
      {itens.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
