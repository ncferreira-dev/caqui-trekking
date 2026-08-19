import type { Metadata } from 'next'
import Link from 'next/link'

import { FaixaDeCredibilidade } from '@/components/catalogo/faixa-credibilidade'
import { LinhaDeSaida } from '@/components/catalogo/linha-de-saida'
import { HeroiDaHome } from '@/components/home/heroi'
import { Manifesto } from '@/components/home/manifesto'
import { Montanhas } from '@/components/marca/grafismos'
import { Capa } from '@/components/midia/imagem'
import { Revelar } from '@/components/movimento/revelar'
import { JsonLdScript } from '@/components/seo/json-ld'
import { LinkBotao } from '@/components/ui/button'
import { listaDaAgenda, negocioLocal, website } from '@/lib/seo/json-ld'
import { absoluto, URL_BASE } from '@/lib/seo/site'
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

// A home herda título e descrição do layout (o `title.default`, sem o sufixo do
// template). Aqui entra só a canônica e a `og:url` apontando para a raiz — sem
// passar pelo helper, para não reescrever o título com o template "%s · …".
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: absoluto('/') },
}

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

  const titulo = settings?.heroTitulo ?? 'A serra começa aqui'
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

      <HeroiDaHome titulo={titulo} subtitulo={subtitulo} proximaSaida={agenda.saidas[0] ?? null} />

      <Manifesto />

      {/* ── Próximas saídas ─────────────────────────────────────────────────
          Lista, não carrossel de cards. O motivo está inteiro no cabeçalho de
          `LinhaDeSaida`: sem uma única fotografia no banco, cada card renderiza
          o grafismo de vazio, e seis retângulos cinzas leem como defeito. A
          lista lidera pela data — que é o que a home existe para responder. */}
      <section aria-labelledby="proximas" className="pt-16 pb-20 sm:pt-20 sm:pb-24">
        <div className="mx-auto mb-10 flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-5 sm:px-8">
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
          /* `data-cena-lista` escalona a entrada das linhas pela rolagem, em
             CSS puro: cada uma cruza a borda da tela num momento diferente, e o
             stagger sai de graça — inclusive na ordem certa quando o layout
             reflui no celular. Ver o bloco CENA em globals.css. */
          <div className="border-caqui-rule border-t" data-cena-lista>
            {agenda.saidas.map((saida, indice) => (
              <LinhaDeSaida key={saida.id} saida={saida} indice={indice} />
            ))}
          </div>
        )}
      </section>

      {/* A faixa de credenciais desce para DEPOIS da oferta. No topo ela pedia
          confiança antes de existir desejo; aqui ela responde à objeção que
          nasce ao ver um preço — "e eu vou com quem?". */}
      <FaixaDeCredibilidade settings={settings} />

      {/* ── Caqui Wear ──────────────────────────────────────────────────────
          Fundo escuro: a troca de superfície é o que separa "a operação" de
          "a marca". Usa `palco-noite` (o mesmo do herói) e não mais
          `bg-caqui-ink-900` solto — duas seções escuras com pretos diferentes
          na mesma página leem como erro de impressão.
          Aqui o laranja pode ser texto: sobre `noite-900` ele dá 8,13:1, e é
          por isso que existe o token `realce-escuro`, com outro nome porque tem
          outra regra de uso. */}
      <section
        aria-labelledby="wear"
        className="palco-noite relative overflow-hidden py-16 sm:py-20"
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
              Camiseta e baby look dry fit, caneca e acessório. Feito para quem já subiu e para quem
              vai subir.
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
                    className="border-caqui-rule-noite block aspect-square overflow-hidden rounded-xs border"
                  >
                    {/* `semente` para as três miniaturas não saírem com a
                        MESMA gravura: nenhum produto tem foto no banco, e três
                        retângulos idênticos lado a lado leem como falha de
                        carregamento. Ver `MidiaVazia` em `midia/imagem.tsx`. */}
                    <Capa
                      midia={produto.capa}
                      semente={produto.slug}
                      sizes="(min-width: 64rem) 12rem, 30vw"
                    />
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
        <div className="border-caqui-rule grid gap-8 border-t pt-12 sm:grid-cols-2 lg:grid-cols-4">
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
    titulo: 'Trekking',
    texto: 'Os roteiros: distância, altimetria, dificuldade e o que esperar de cada um.',
    acao: 'Ver os roteiros',
  },
  {
    href: '/guia-particular',
    titulo: 'Guia particular',
    texto: 'Saída fechada só para o seu grupo, no destino e na data que você escolher.',
    acao: 'Pedir um orçamento',
  },
  {
    href: '/sobre',
    titulo: 'A Caqui',
    texto: 'Quem guia, com quais credenciais, e como a operação funciona na prática.',
    acao: 'Conhecer a equipe',
  },
] as const
