import Link from 'next/link'

import { Montanhas } from '@/components/marca/grafismos'
import { CamadaHero, Hero } from '@/components/movimento/hero'
import { Revelar } from '@/components/movimento/revelar'
import { LinkBotao } from '@/components/ui/button'
import { Card, CardCorpo } from '@/components/ui/card'
import { buscarSettings } from '@/server/services/institucional-service'

/**
 * Home.
 *
 * O que existe aqui é a CASCA: herói com parallax, e os três caminhos do site.
 * A faixa de credibilidade, o carrossel de próximas saídas e a chamada da
 * Caqui Wear são o PROMPT 08 — a parte que vende. O herói construído aqui é o
 * mesmo que o 08 recebe pronto.
 */

const CAMINHOS = [
  {
    href: '/agenda',
    titulo: 'Agenda',
    texto: 'Todas as saídas com data marcada, mês a mês. É por aqui que se reserva vaga.',
  },
  {
    href: '/trekking',
    titulo: 'Expedições',
    texto: 'Os roteiros: distância, altimetria, dificuldade e o que esperar de cada um.',
  },
  {
    href: '/wear',
    titulo: 'Caqui Wear',
    texto: 'Camiseta, baby look, caneca e acessório. A marca fora da trilha.',
  },
] as const

export default async function PaginaInicial() {
  const settings = await buscarSettings()

  const titulo = settings?.heroTitulo ?? 'Venha viver novas experiências'
  const subtitulo =
    settings?.heroSubtitulo ??
    'Trilhas guiadas na Serra do Mar, saindo de Mogi das Cruzes. Guias com Cadastur e monitores credenciados pelo PESM.'

  return (
    <>
      <Hero
        className="flex min-h-[88svh] items-end"
        fundo={
          <>
            {/* Areia de base: a serra precisa de um céu, e branco puro deixaria
                o desenho boiando. */}
            <div className="from-caqui-sand-100 absolute inset-0 bg-gradient-to-b to-white" />

            {/* O sol. Camada mais distante, quase parada — é o que está no
                horizonte. */}
            {/* À direita e alto, longe da headline: na logo o sol nasce ATRÁS
                da serra, nunca no meio do texto. */}
            <CamadaHero profundidade={0.06} className="top-[10%] flex justify-end pr-[8%]">
              <div className="from-caqui-orange-400 to-caqui-orange-600 size-56 rounded-full bg-gradient-to-b opacity-90 sm:size-72" />
            </CamadaHero>

            {/* Serra distante. */}
            <CamadaHero profundidade={0.12} className="bottom-0 opacity-45">
              <Montanhas className="h-56 sm:h-72" />
            </CamadaHero>

            {/* Serra próxima: o teto de 0,18 do projeto. */}
            <CamadaHero profundidade={0.18} className="-bottom-6">
              <Montanhas className="h-64 sm:h-80" />
            </CamadaHero>
          </>
        }
      >
        <div className="mx-auto w-full max-w-7xl px-5 pt-32 pb-16 sm:px-8 sm:pb-24">
          <p className="text-caqui-ink-700 text-rotulo font-mono uppercase">
            Ecoturismo aventura · Mogi das Cruzes · SP
          </p>

          <h1 className="text-display-xl mt-4 max-w-4xl uppercase">{titulo}</h1>

          <p className="text-caqui-ink-700 text-corpo-lg mt-6 max-w-xl">{subtitulo}</p>

          <div className="mt-8 flex flex-wrap gap-4">
            <LinkBotao href="/agenda" tamanho="lg">
              Ver a agenda
            </LinkBotao>
            <LinkBotao href="/trekking" tamanho="lg" variante="secondary">
              Conhecer os roteiros
            </LinkBotao>
          </div>
        </div>
      </Hero>

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-8 md:grid-cols-3">
          {CAMINHOS.map((caminho, indice) => (
            <Revelar key={caminho.href} atraso={indice * 70}>
              <Link href={caminho.href} className="block h-full rounded-xs">
                <Card interativo className="h-full">
                  <CardCorpo>
                    <h2 className="text-display-m uppercase">{caminho.titulo}</h2>
                    <p className="text-caqui-ink-700 text-corpo">{caminho.texto}</p>
                  </CardCorpo>
                </Card>
              </Link>
            </Revelar>
          ))}
        </div>
      </section>
    </>
  )
}
