import Link from 'next/link'

import { CardSaida } from '@/components/catalogo/card-saida'
import { Carrossel, ItemDoCarrossel } from '@/components/catalogo/carrossel'
import { FaixaDeCredibilidade } from '@/components/catalogo/faixa-credibilidade'
import { Montanhas, Nuvens } from '@/components/marca/grafismos'
import { Capa } from '@/components/midia/imagem'
import { CamadaHero, Hero } from '@/components/movimento/hero'
import { Revelar } from '@/components/movimento/revelar'
import { JsonLdScript } from '@/components/seo/json-ld'
import { LinkBotao } from '@/components/ui/button'
import { listaDaAgenda, negocioLocal, website } from '@/lib/seo/json-ld'
import { URL_BASE } from '@/lib/seo/site'
import { listarDepartures } from '@/server/services/departure-service'
import { buscarSettings } from '@/server/services/institucional-service'
import { listarProdutos } from '@/server/services/product-service'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DINÂMICA, E ISSO PRECISA SER DECLARADO
 * ────────────────────────────────────────────────────────────────────────────
 * Esta página não usa nenhuma API dinâmica do Next — só chama o serviço, que
 * fala direto com o Prisma. Sem `fetch` para o Next observar e sem `cookies()`
 * ou `searchParams`, ela é PRÉ-RENDERIZADA no build e servida do Full Route
 * Cache até o próximo deploy.
 *
 * Isso quebra a regra central do projeto: disponibilidade é editada à mão no
 * CRM, e `encerrada` é derivada de `new Date()` no momento do render. Estática,
 * a página serviria para sempre o estado do build — SOLD_OUT invisível, preço
 * reajustado que não chega, e saída já realizada listada como futura.
 *
 * É a mesma doutrina do carrinho, do outro lado: dado guardado envelhece.
 * As 30 rotas de `src/app/api/*` declaram o mesmo `force-dynamic` pelo mesmo
 * motivo.
 */
export const dynamic = 'force-dynamic'

/**
 * Home.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A HOME LEVA PARA A AGENDA. NÃO É UMA VITRINE DE ROTEIROS.
 * ────────────────────────────────────────────────────────────────────────────
 * A pergunta que fecha venda em operação de trilha guiada é "quando é a
 * próxima?". Um grid de roteiros bonitos responde "para onde dá para ir", que
 * é a segunda pergunta — e leva a uma página que ainda vai ter que perguntar a
 * data de novo.
 *
 * Por isso o carrossel logo abaixo do herói é de SAÍDAS com data, não de
 * roteiros: o primeiro elemento clicável depois do herói já mostra um dia, um
 * preço e uma vaga.
 */
export default async function PaginaInicial() {
  const [settings, agenda, wear] = await Promise.all([
    buscarSettings(),
    listarDepartures({ incluirEncerradas: false, limit: 8, offset: 0 }),
    listarProdutos({ limit: 3, offset: 0 }),
  ])

  const titulo = settings?.heroTitulo ?? 'Venha viver novas experiências'
  const subtitulo =
    settings?.heroSubtitulo ??
    'Trilhas guiadas na Serra do Mar, saindo de Mogi das Cruzes. Guias com Cadastur e monitores credenciados pelo PESM.'

  // Os três nós da home: a empresa (LocalBusiness), o site (para a caixa de
  // busca), e a lista das próximas saídas. Os `Event` completos ficam na página
  // de cada roteiro — aqui a agenda é só o índice ordenado.
  const dadosEstruturados = [
    negocioLocal(URL_BASE, settings),
    website(URL_BASE),
    ...(agenda.saidas.length > 0 ? [listaDaAgenda(URL_BASE, agenda.saidas)] : []),
  ]

  return (
    <>
      <JsonLdScript dados={dadosEstruturados} />

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

            {/* O céu. Fica ENTRE o sol e a serra: nuvem passando na frente da
                montanha é o que a coloca no espaço certo, e nuvem por cima do
                sol tira dele o papel de ponto mais distante da cena. */}
            <Nuvens />

            {/* Serra distante. Respira mais devagar e desloca menos: o que está
                longe se move menos, a mesma regra que governa o parallax. */}
            <CamadaHero profundidade={0.12} className="bottom-0 opacity-45">
              <div className="serra-respirando [--duracao:64s]">
                <Montanhas className="h-56 sm:h-72" />
              </div>
            </CamadaHero>

            {/* Serra próxima: o teto de 0,18 do projeto. O atraso desencontra as
                duas cristas — em fase elas andariam como um bloco só, que é
                exatamente o que mata a sensação de profundidade. */}
            <CamadaHero profundidade={0.18} className="-bottom-6">
              <div className="serra-respirando [--atraso:-11s] [--duracao:44s]">
                <Montanhas className="h-64 sm:h-80" />
              </div>
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

      <FaixaDeCredibilidade settings={settings} />

      {/* ── Próximas saídas ─────────────────────────────────────────────────
          O carrossel sangra até a borda da tela de propósito: um card cortado
          na direita é o que avisa que a lista continua, sem precisar de
          bolinha de paginação nem de seta piscando no celular. */}
      <section aria-labelledby="proximas" className="py-16 sm:py-20">
        <div className="mx-auto mb-8 flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-5 sm:px-8">
          <div>
            <p className="text-caqui-ink-700 text-rotulo font-mono uppercase">Com data marcada</p>
            <h2 id="proximas" className="text-display-l mt-2 uppercase">
              Próximas saídas
            </h2>
          </div>
          <LinkBotao href="/agenda" variante="secondary">
            Ver a agenda inteira
          </LinkBotao>
        </div>

        {agenda.saidas.length === 0 ? (
          <p className="text-caqui-ink-700 text-corpo-lg mx-auto w-full max-w-7xl px-5 sm:px-8">
            A agenda do próximo mês ainda está sendo montada. Dá para pedir uma saída fechada para o
            seu grupo:{' '}
            <Link href="/contato" className="rounded-xs underline underline-offset-4">
              fale com a Caqui
            </Link>
            .
          </p>
        ) : (
          <Carrossel rotulo="Próximas saídas com data marcada">
            {agenda.saidas.map((saida, indice) => (
              <ItemDoCarrossel key={saida.id}>
                <CardSaida saida={saida} prioridade={indice === 0} />
              </ItemDoCarrossel>
            ))}
          </Carrossel>
        )}
      </section>

      {/* ── Caqui Wear ──────────────────────────────────────────────────────
          Fundo escuro: é a única seção da home que muda de superfície, e a
          troca é o que separa "a operação" de "a marca". Aqui o laranja pode
          ser texto — sobre `ink-900` ele dá 8,31:1 — e por isso existe o token
          `realce-escuro`, com outro nome porque tem outra regra de uso. */}
      <section
        aria-labelledby="wear"
        className="bg-caqui-ink-900 relative overflow-hidden py-16 text-white sm:py-20"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-15" aria-hidden>
          <Montanhas className="h-40 w-full" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="text-caqui-realce-escuro text-rotulo font-mono uppercase">Caqui Wear</p>
            <h2 id="wear" className="text-display-l mt-2 text-white uppercase">
              A marca fora da trilha
            </h2>
            <p className="text-caqui-sand-400 text-corpo-lg mt-5 max-w-md">
              Camiseta e baby look dry fit, caneca e acessório. Feito para quem já subiu e para
              quem vai subir.
            </p>

            <div className="mt-8">
              <LinkBotao href="/wear" tamanho="lg">
                Ver a Caqui Wear
              </LinkBotao>
            </div>
          </div>

          {wear.produtos.length > 0 && (
            <ul className="grid grid-cols-3 gap-3">
              {wear.produtos.map((produto) => (
                <li key={produto.slug}>
                  <Link
                    href={`/wear/${produto.slug}`}
                    className="border-caqui-rule-invertido block aspect-square overflow-hidden rounded-xs border"
                  >
                    <Capa midia={produto.capa} sizes="(min-width: 64rem) 12rem, 30vw" />
                    <span className="sr-only">{produto.nome}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Os três caminhos ────────────────────────────────────────────────
          Fica no FIM, e não no topo: quem chegou até aqui sem clicar em data
          nenhuma está explorando, e aí a navegação por tema ajuda. Colocada
          antes do carrossel, ela competiria com a única coisa que a home
          precisa entregar — uma data. */}
      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <div className="border-caqui-rule grid gap-8 border-t pt-12 md:grid-cols-3">
          {CAMINHOS.map((caminho, indice) => (
            <Revelar key={caminho.href} atraso={indice * 70}>
              <Link
                href={caminho.href}
                className="group block rounded-xs focus-visible:ring-2 focus-visible:ring-white"
              >
                <h3 className="text-display-m group-hover:text-caqui-ink-700 uppercase transition-colors">
                  {caminho.titulo}
                </h3>
                <p className="text-caqui-ink-700 text-corpo mt-2">{caminho.texto}</p>
                <span className="text-caqui-ink-900 text-rotulo mt-3 inline-block font-mono uppercase underline underline-offset-4">
                  {caminho.acao}
                </span>
              </Link>
            </Revelar>
          ))}
        </div>
      </section>
    </>
  )
}

const CAMINHOS = [
  {
    href: '/agenda',
    titulo: 'Agenda',
    texto: 'Todas as saídas com data marcada, mês a mês. É por aqui que se reserva vaga.',
    acao: 'Ver as datas',
  },
  {
    href: '/trekking',
    titulo: 'Expedições',
    texto: 'Os roteiros: distância, altimetria, dificuldade e o que esperar de cada um.',
    acao: 'Ver os roteiros',
  },
  {
    href: '/sobre',
    titulo: 'A Caqui',
    texto: 'Quem guia, com quais credenciais, e como a operação funciona na prática.',
    acao: 'Conhecer a equipe',
  },
] as const
