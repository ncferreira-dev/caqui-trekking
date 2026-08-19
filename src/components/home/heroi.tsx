import Link from 'next/link'

import { Serra } from '@/components/marca/serra'
import { VideoDeFundo } from '@/components/movimento/video-de-fundo'
import { LinkBotao } from '@/components/ui/button'
import { partesDaData } from '@/lib/datetime'
import { costurarSeparador } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import type { ItemAgendaDTO } from '@/server/services/departure-service'

/**
 * O herói da home.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DUAS ÁREAS, E A SEPARAÇÃO É ESTRUTURAL
 * ────────────────────────────────────────────────────────────────────────────
 *   ┌─────────────────────────────────┐
 *   │  ÁREA DO FILME   (flex-1)       │  vídeo + serra + tipografia
 *   │                                 │  tudo aqui é sobreposto
 *   ├─────────────────────────────────┤
 *   │  FAIXA DE DADOS  (altura fixa)  │  opaca, no fluxo, nada por baixo
 *   └─────────────────────────────────┘
 *
 * A primeira versão empilhou as duas no mesmo contêiner absoluto e o resultado
 * foi previsível em retrospecto: a serra atravessou os números, o botão de
 * pausa caiu em cima da data, e "SERRA DO MAR" saiu cortado. Sobreposição é
 * ótima para imagem e péssima para dado — dado precisa de linha de base, e
 * linha de base vem do fluxo normal.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A GRAVURA FICA SOBRE O VÍDEO, E É ISSO QUE FAZ O SITE SER DA CAQUI
 * ────────────────────────────────────────────────────────────────────────────
 * Vídeo bonito no fundo do herói é o que todo site de aventura tem. O que
 * nenhum tem é a serra da marca desenhada POR CIMA da imagem, em traço claro,
 * com a tipografia entre as duas.
 *
 * O traço é CLARO (`sand-200`) e não preto: o pé da cena é quase `noite-900`
 * por causa do véu, e tinta preta sobre preto não existe. É gravura de linha
 * branca — o registro do Thomas Bewick — e continua sendo gravura.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A FAIXA RESPONDE A PERGUNTA QUE FECHA VENDA
 * ────────────────────────────────────────────────────────────────────────────
 * Este projeto tem uma doutrina declarada na home: a pergunta que fecha venda
 * em trilha guiada é "quando é a próxima?". O herói antigo levava para a agenda
 * e deixava a resposta dois blocos abaixo.
 *
 * Aqui a data, o roteiro e o preço da próxima saída estão na primeira tela,
 * antes de qualquer rolagem, e a faixa inteira é um link.
 */
export function HeroiDaHome({
  titulo,
  subtitulo,
  proximaSaida,
}: {
  titulo: string
  subtitulo: string
  proximaSaida: ItemAgendaDTO | null
}) {
  return (
    <section
      className="palco-noite relative isolate flex min-h-svh flex-col"
      style={
        {
          // A massa das cristas é a cor da própria cena: elas OCULTAM o vídeo
          // sem pintar nada por cima, como área não gravada da matriz.
          '--serra-massa': 'var(--color-caqui-noite-900)',
          // Sobre fundo escuro a neblina precisa CLAREAR o que está atrás.
          '--neblina-mistura': 'screen',
        } as React.CSSProperties
      }
    >
      {/* ── ÁREA DO FILME ───────────────────────────────────────────────── */}
      {/* ── ÁREA DO FILME ─────────────────────────────────────────────────
          `justify-center` no celular e `justify-end` só a partir de `lg`.

          Medido em 400×875: com o conteúdo ancorado embaixo em toda largura,
          o texto começava a 45% da tela e a metade de cima ficava sendo vídeo
          vazio. A causa é geométrica — o bloco de texto encolhe muito menos
          que a viewport quando ela fica alta e estreita, então sobra folga, e
          `justify-end` empurra toda a folga para cima.

          No desktop a âncora embaixo continua sendo a composição certa: lá o
          `<h1>` em escala de cartaz ocupa a maior parte da altura e a folga é
          pequena. */}
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden lg:justify-end">
        <VideoDeFundo
          primeiroPlano={
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0">
              {/* Duas cristas, não cinco: aqui elas são PRIMEIRO PLANO, e
                  camada demais na frente do vídeo esconde o vídeo, que é
                  justamente o que se quer mostrar.
                  A de trás sobe mais alto e é mais fraca; a da frente é mais
                  baixa e mais forte. O contrário achataria as duas num plano. */}
              <div className="text-caqui-sand-200 relative opacity-35">
                <Serra profundidade={3} />
              </div>
              {/* Sobreposição percentual: a altura da serra vem da largura.
                  Ver o cabeçalho de `Serra`. */}
              <div className="text-caqui-sand-200 relative -mt-[7%] opacity-60">
                <Serra profundidade={5} />
              </div>
            </div>
          }
        />

        {/* A PLACA. É a metade horizontal da legibilidade — ver o comentário do
            véu em `video-de-fundo.tsx`.

            Medido, não estimado. Na altura da headline, a composição do véu
            vertical (~44%), desta placa (~72% à esquerda) e do banho de cor
            (20%) chega a ~87% de `noite-900` sobre o vídeo. Sobre rocha ao sol
            (o pior caso da cena, luminância ~0,55) isso dá luminância ~0,077 e
            branco em cima passa de 8:1.
            À direita a placa é transparente: lá o vídeo fica vívido. É o que
            permite ter imagem forte E texto legível na mesma tela. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, color-mix(in srgb, var(--color-caqui-noite-900) 80%, transparent) 0%, color-mix(in srgb, var(--color-caqui-noite-900) 62%, transparent) 34%, color-mix(in srgb, var(--color-caqui-noite-900) 18%, transparent) 62%, transparent 84%)',
          }}
        />

        {/* O conteúdo. `relative` sem z-index: vem depois no DOM, dentro do
            mesmo contexto de empilhamento, então já fica em cima. */}
        {/* O `pb-40` do celular não é respiro embaixo: é o que PUXA O TEXTO
            PARA CIMA. Em `justify-center`, o topo do conteúdo cai em
            `pt + (altura − pt − pb − conteúdo) / 2`, então aumentar só o
            padding de baixo desloca o bloco inteiro para cima sem mexer na
            centralização. Medido em 400×875: de 30% para 24% da tela.
            No desktop a âncora é embaixo (`lg:justify-end`) e o padding volta
            a ser respiro de verdade. */}
        <div className="relative mx-auto w-full max-w-7xl px-5 pt-28 pb-40 sm:px-8 lg:pt-32 lg:pb-20">
          {/* `sand-200` e não `sand-400`. Medido: sobre rocha ao sol — o ponto
              mais claro da cena — a composição de véu, placa e banho deixa a
              luminância de fundo em ~0,12, e `sand-400` em cima disso dá 2,0:1,
              que reprova em qualquer tamanho. `sand-200` dá ~4,7:1.
              O contraste de texto sobre VÍDEO não pode ser conferido pela
              tabela do `globals.css`: aquela tabela mede sobre cor chapada, e
              aqui o fundo é uma imagem em movimento. Vale o pior quadro. */}
          <p className="text-rotulo text-caqui-sand-200 font-mono uppercase">
            Ecoturismo aventura ·{' '}
            {/* A praça e o estado são uma unidade. Sem o `nowrap`, em 375px a
                linha quebrava depois de "CRUZES" e deixava "· SP" sozinho na
                segunda linha — órfão tipográfico, e ainda por cima num rótulo
                de três palavras. */}
            <span className="whitespace-nowrap">Mogi das Cruzes · SP</span>
          </p>

          {/* Sem `max-w`: a largura da coluna já é o `max-w-7xl` do pai, e a
              escala do tipo foi calculada contra a janela menos o respiro
              lateral — ver `--text-display-3xl` em globals.css. Um `max-w`
              menor aqui faria a conta mentir e a palavra longa voltaria a
              vazar. */}
          <h1 className="texto-cartaz text-display-3xl mt-5 text-white">
            {costurarSeparador(titulo)}
          </h1>

          <p className="text-corpo-lg text-caqui-sand-200 mt-7 max-w-lg">{subtitulo}</p>

          {/* No celular os dois empilham e ocupam a linha inteira: com largura
              automática eles saíam com 570px e 555px, e dois blocos quase do
              mesmo tamanho leem como desalinho, não como hierarquia. A partir
              de `sm` voltam a ter a largura do próprio rótulo. */}
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <LinkBotao href="/agenda" tamanho="lg" className="w-full sm:w-auto">
              Ver as próximas saídas
            </LinkBotao>
            <LinkBotao
              href="/trekking"
              tamanho="lg"
              variante="secondary"
              className="w-full sm:w-auto"
            >
              Conhecer os roteiros
            </LinkBotao>
          </div>
        </div>
      </div>

      {/* ── FAIXA DE DADOS, QUE TAMBEM E UM BOTAO ─────────────────────────
          Opaca e no fluxo: e a legenda tecnica da carta topografica, o mesmo
          registro em que este projeto ja escreve distancia, cota e Cadastur.

          ────────────────────────────────────────────────────────────────────
          ELA PRECISOU PARECER CLICAVEL, E NAO PARECIA
          ────────────────────────────────────────────────────────────────────
          A primeira versao era um `<Link>` sem nenhuma afordancia: data, nome e
          preco em texto, mais nada. Funcionava e ninguem sabia disso, que e o
          pior estado possivel para o elemento que leva ao produto.

          Agora sao tres sinais, e sao tres de proposito porque cada um cobre um
          jeito diferente de usar a pagina:

            1. um rotulo de ACAO visivel ("Ver e reservar"), para quem le
            2. a barra inteira muda de fundo no hover, para quem passa o mouse
            3. a seta desliza, dando retorno de direcao

          O alvo clicavel e a FAIXA INTEIRA, nao so o rotulo: no celular, uma
          area de toque da largura da tela e muito mais facil de acertar do que
          um chip de 120px no canto. */}
      <div className="border-caqui-rule-noite bg-caqui-noite-900 relative border-t">
        {proximaSaida ? (
          <Link
            href={`/trekking/${proximaSaida.trip.slug}`}
            className="group hover:bg-caqui-noite-800 block transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset"
          >
            {/* `pr-20` reservado a direita, e ele NAO e folga estetica.
                O botao flutuante do WhatsApp e `fixed right-4 bottom-4` com
                ~56px: ele ocupa o canto inferior direito da JANELA, exatamente
                onde esta faixa termina. Sem o respiro, o rotulo de acao ficava
                por baixo dele. A partir de `xl` o conteiner centralizado ja
                termina antes do botao. */}
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 pr-20 sm:px-8 sm:pr-24 xl:pr-8">
              <span className="flex shrink-0 items-baseline gap-3">
                <span className="text-rotulo text-caqui-sand-400 font-mono uppercase">
                  Próxima saída
                </span>
                <DataCurta instante={new Date(proximaSaida.inicioUtc)} />
              </span>

              <span className="flex min-w-0 items-baseline gap-3">
                {/* `min-w-0` no pai e `truncate` aqui: sem os dois, um titulo
                    longo empurra o preco para fora em vez de encurtar. */}
                <span className="text-corpo-sm min-w-0 truncate text-white">
                  {proximaSaida.trip.titulo}
                </span>
                <span className="numeral text-dado text-caqui-realce-escuro shrink-0">
                  {formatarBRL(proximaSaida.precoCentavos)}
                </span>
              </span>

              {/* O rotulo de acao. Inverte no hover: de contorno claro para
                  bloco branco solido. E o mesmo vocabulario do botao
                  `secondary` do site, em escala de faixa. */}
              <span className="border-caqui-rule-noite text-rotulo group-hover:bg-caqui-sand-100 group-hover:text-caqui-noite-900 ml-auto inline-flex shrink-0 items-center gap-2 rounded-xs border px-3 py-1.5 font-mono text-white uppercase transition-colors group-hover:border-transparent">
                Ver e reservar
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="size-4 transition-transform duration-150 group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="square" />
                </svg>
              </span>
            </div>
          </Link>
        ) : (
          <div className="mx-auto w-full max-w-7xl px-5 py-4 pr-20 sm:px-8 sm:pr-24 xl:pr-8">
            <p className="text-corpo-sm text-caqui-sand-400">
              Agenda do próximo mês em montagem.{' '}
              <Link href="/contato" className="rounded-xs text-white underline underline-offset-4">
                peça uma saída fechada
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * A data em dois tempos: o dia grande, o mês pequeno ao lado.
 *
 * `partesDaData` já resolve o fuso — formata em `America/Sao_Paulo`, e é o mesmo
 * helper que o card da agenda usa. Formatar à mão aqui produziria um dia de
 * diferença nas saídas de madrugada, que são exatamente as de nascer do sol.
 */
function DataCurta({ instante }: { instante: Date }) {
  const { dia, mes } = partesDaData(instante)

  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <span className="numeral text-dado-lg text-white">{dia}</span>
      <span className="text-rotulo text-caqui-sand-400 font-mono uppercase">{mes}</span>
    </span>
  )
}
