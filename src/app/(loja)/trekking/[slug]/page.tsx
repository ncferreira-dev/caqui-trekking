import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BarraDeCompra } from '@/components/catalogo/barra-de-compra'
import { Galeria } from '@/components/catalogo/galeria'
import { Guias } from '@/components/catalogo/guias'
import { MapaEncontro } from '@/components/catalogo/mapa-encontro'
import { SeletorDeSaida } from '@/components/catalogo/seletor-de-saida'
import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { Acordeao, AcordeaoItem } from '@/components/ui/acordeao'
import { BadgeDificuldade, Etiqueta } from '@/components/ui/badge'
import { JsonLdScript } from '@/components/seo/json-ld'
import { Ficha } from '@/components/ui/card'
import { Compartilhar } from '@/components/ui/compartilhar'
import { AppError } from '@/lib/api/errors'
import { eventosDoRoteiro, migalhas } from '@/lib/seo/json-ld'
import { URL_BASE } from '@/lib/seo/site'
import { formatarDuracao, rotuloDificuldade } from '@/lib/formato'
import { buscarSettings } from '@/server/services/institucional-service'
import { buscarTripPorSlug } from '@/server/services/trip-service'
import type { Dificuldade } from '@/components/ui/badge'
import type { SaidaDTO, TripDetalheDTO } from '@/server/dto/public-dto'

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
 * ────────────────────────────────────────────────────────────────────────────
 * A PÁGINA É ORGANIZADA POR PERGUNTA, NÃO POR CAMPO DO BANCO
 * ────────────────────────────────────────────────────────────────────────────
 * A ordem responde, de cima para baixo, ao que a pessoa pergunta nessa ordem:
 *
 *   1. "Como é?"          → galeria
 *   2. "Dá para mim?"     → ficha técnica: distância, ganho, duração, nível
 *   3. "Quando e quanto?" → SELETOR DE SAÍDA, o ponto de conversão
 *   4. "O que preciso?"   → incluso, não incluso, o que levar
 *   5. "Onde encontro?"   → ponto de encontro com mapa
 *   6. "Com quem?"        → guias e credenciais
 *   7. "E se der ruim?"   → cancelamento e dúvidas
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A FICHA TÉCNICA VEM ANTES DA DESCRIÇÃO
 * ────────────────────────────────────────────────────────────────────────────
 * Distância e ganho de elevação são o que decide se a pessoa vai. Um parágrafo
 * bonito antes deles obriga a rolar para descobrir o que é objetivo, e quem
 * está avaliando três roteiros em três abas compara números, não prosa.
 */
export default async function PaginaDoRoteiro({ params }: PageProps<'/trekking/[slug]'>) {
  const { slug } = await params

  let trip: TripDetalheDTO
  try {
    trip = await buscarTripPorSlug(slug)
  } catch (erro) {
    if (erro instanceof AppError) notFound()
    throw erro
  }

  const settings = await buscarSettings()

  const futuras = trip.saidas.filter((s) => !s.encerrada)
  const disponiveis = futuras.filter((s) => s.disponibilidade !== 'SOLD_OUT')

  // "A partir de" afirma um MÍNIMO, então tem que ser o menor preço — não o da
  // próxima data. O serviço devolve as saídas por `startAt` crescente, e cada
  // Departure tem preço próprio (feriado custa mais que baixa temporada), então
  // `disponiveis[0]` é a mais PRÓXIMA e frequentemente não é a mais barata.
  // Dizer "a partir de R$ 425" quando existe uma a R$ 279 é preço enganoso.
  const maisBarata =
    disponiveis.length > 0
      ? disponiveis.reduce((a, b) => (b.precoCentavos < a.precoCentavos ? b : a))
      : null

  // Sem data disponível, cai na primeira futura e o rótulo deixa de afirmar
  // piso — vira "Preço por pessoa".
  const referencia = maisBarata ?? futuras[0] ?? null
  const encontro = pontoDeEncontro(futuras)

  // Cada saída futura vira um `Event`; a migalha reconstrói a trilha de
  // navegação que o Google mostra no lugar da URL crua.
  const dadosEstruturados = [
    ...eventosDoRoteiro(URL_BASE, trip),
    migalhas(URL_BASE, [
      { nome: 'Início', caminho: '/' },
      { nome: 'Expedições', caminho: '/trekking' },
      { nome: trip.titulo, caminho: `/trekking/${trip.slug}` },
    ]),
  ]

  return (
    <>
      <JsonLdScript dados={dadosEstruturados} />

      <CabecalhoDePagina
        sobretitulo={`${trip.cidade} · ${trip.estado}${trip.regiao ? ` · ${trip.regiao}` : ''}`}
        titulo={trip.titulo}
        {...(trip.subtitulo ? { descricao: trip.subtitulo } : {})}
      />

      <div className="mx-auto w-full max-w-7xl px-5 pt-14 pb-16 sm:px-8">
        <Galeria imagens={trip.imagens} titulo={trip.titulo} />

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <BadgeDificuldade nivel={trip.dificuldade as Dificuldade} />
          {trip.tags.map((tag) => (
            <Etiqueta key={tag.slug}>{tag.label}</Etiqueta>
          ))}
          {trip.exigeExperiencia && <Etiqueta tom="mata">Exige experiência prévia</Etiqueta>}

          {/* Fica junto das etiquetas, e não no rodapé da página: quem decide
              chamar o grupo decide no começo, olhando a dificuldade e a data.
              Botão de compartilhar no fim só é encontrado por quem já leu tudo,
              que é justamente quem já decidiu sozinho. */}
          <Compartilhar
            className="ml-auto"
            titulo={trip.titulo}
            texto={`${trip.titulo}, com a Caqui Trekking em ${trip.cidade}/${trip.estado}.`}
          />
        </div>

        <Ficha
          className="mt-6"
          itens={[
            {
              rotulo: 'Distância',
              valor: trip.distanciaKm !== null ? distancia(trip.distanciaKm) : '—',
              ...(trip.distanciaKm !== null ? { unidade: 'km' } : {}),
            },
            {
              rotulo: 'Ganho',
              valor: trip.ganhoElevacaoM !== null ? `+${trip.ganhoElevacaoM}` : '—',
              ...(trip.ganhoElevacaoM !== null ? { unidade: 'm' } : {}),
            },
            {
              rotulo: 'Duração',
              valor: trip.duracaoMinutos !== null ? formatarDuracao(trip.duracaoMinutos) : '—',
            },
            {
              rotulo: 'Altitude máx.',
              valor: trip.altitudeMaximaM !== null ? String(trip.altitudeMaximaM) : '—',
              ...(trip.altitudeMaximaM !== null ? { unidade: 'm' } : {}),
            },
            { rotulo: 'Nível', valor: rotuloDificuldade(trip.dificuldade) },
            {
              rotulo: 'Idade mínima',
              valor: trip.idadeMinima !== null ? String(trip.idadeMinima) : 'Livre',
              ...(trip.idadeMinima !== null ? { unidade: 'anos' } : {}),
            },
          ]}
        />

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div className="flex min-w-0 flex-col gap-12">
            <div className="text-corpo-lg max-w-2xl whitespace-pre-line">{trip.descricao}</div>

            {trip.destaques.length > 0 && (
              <section aria-labelledby="destaques">
                <h2 id="destaques" className="text-display-s uppercase">
                  O que essa trilha tem
                </h2>
                <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                  {trip.destaques.map((item) => (
                    <li
                      key={item}
                      className="border-caqui-rule text-corpo flex gap-2.5 border-b py-2.5"
                    >
                      <Marca />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="preparo">
              <h2 id="preparo" className="text-display-s uppercase">
                Antes de sair
              </h2>
              <Acordeao className="mt-4">
                <AcordeaoItem grupo="preparo" titulo="O que está incluso" abertoPorPadrao>
                  <ListaSimples
                    itens={trip.incluso}
                    vazio="A combinar na conversa. Chame no WhatsApp."
                  />
                </AcordeaoItem>
                <AcordeaoItem grupo="preparo" titulo="Não está incluso">
                  <ListaSimples itens={trip.naoIncluso} vazio="Nada a declarar." />
                </AcordeaoItem>
                <AcordeaoItem grupo="preparo" titulo="O que levar">
                  <ListaSimples
                    itens={trip.oQueLevar}
                    vazio="A lista sai junto com a confirmação da vaga."
                  />
                </AcordeaoItem>
              </Acordeao>
            </section>

            {encontro && (
              <MapaEncontro
                ponto={encontro.pontoEncontro}
                horario={encontro.horarioEncontro}
                coordenadas={encontro.coordenadas}
              />
            )}

            <Guias guias={trip.guias} />

            <section aria-labelledby="duvidas">
              <h2 id="duvidas" className="text-display-s uppercase">
                Dúvidas frequentes
              </h2>
              <Acordeao className="mt-4">
                {perguntas(trip).map((p) => (
                  <AcordeaoItem key={p.pergunta} grupo="duvidas" titulo={p.pergunta}>
                    <p className="whitespace-pre-line">{p.resposta}</p>
                  </AcordeaoItem>
                ))}
              </Acordeao>
            </section>
          </div>

          {/* A coluna que vende. `sticky` a partir de `lg` — no mobile quem
              acompanha a rolagem é a BarraDeCompra, e duas âncoras fixas na
              mesma tela brigariam pelo mesmo espaço. */}
          <aside className="h-fit lg:sticky lg:top-24">
            <SeletorDeSaida
              saidas={trip.saidas}
              tituloDoRoteiro={trip.titulo}
              whatsapp={settings?.whatsappNumber ?? null}
            />
          </aside>
        </div>
      </div>

      {referencia && (
        <BarraDeCompra
          precoCentavos={referencia.precoCentavos}
          rotulo={disponiveis.length > 1 ? 'A partir de' : 'Preço por pessoa'}
          desabilitada={disponiveis.length === 0}
        />
      )}
    </>
  )
}

/**
 * O ponto de encontro exibido.
 *
 * O ponto pertence à SAÍDA, não ao roteiro — a mesma trilha pode partir da
 * portaria numa data e do centro de Mogi na outra, quando há van. A página
 * mostra o da PRÓXIMA saída, que é a informação certa para quem está
 * decidindo agora, e o seletor mostra o horário de cada data individualmente.
 */
function pontoDeEncontro(futuras: SaidaDTO[]): SaidaDTO | null {
  return futuras.find((s) => s.pontoEncontro !== null || s.coordenadas !== null) ?? null
}

/**
 * As perguntas frequentes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DERIVADAS DOS DADOS, NÃO ESCRITAS À MÃO NUM ARRAY DE STRINGS
 * ────────────────────────────────────────────────────────────────────────────
 * Não existe campo `faq` no schema, e inventar um bloco de texto fixo aqui
 * criaria a pior espécie de conteúdo: aquele que envelhece sem ninguém
 * perceber. Uma FAQ que diz "idade mínima 12 anos" enquanto o campo `minAge`
 * do banco diz 14 é pior que nenhuma FAQ.
 *
 * Então cada pergunta só existe quando o dado que a responde existe, e a
 * resposta é montada a partir dele. Trocar a idade mínima no CRM muda a FAQ
 * no mesmo instante, sem deploy e sem ninguém lembrar de nada.
 *
 * As duas perguntas invariáveis — como se reserva, e o que acontece com chuva
 * — descrevem a operação, que é a mesma para todo roteiro. Se um dia deixarem
 * de ser, viram campo no CRM.
 */
function perguntas(trip: TripDetalheDTO): { pergunta: string; resposta: string }[] {
  const lista: { pergunta: string; resposta: string }[] = [
    {
      pergunta: 'Como reservo a vaga?',
      resposta:
        'Escolha a data e a quantidade de vagas, adicione à mochila e finalize pelo WhatsApp. A conversa é onde a Caqui confirma a vaga e combina o pagamento. O site não cobra nada.',
    },
  ]

  if (trip.idadeMinima !== null) {
    lista.push({
      pergunta: `Crianças podem participar?`,
      resposta: `A idade mínima desta expedição é ${trip.idadeMinima} anos, sempre acompanhado de responsável. Abaixo disso, chame no WhatsApp: dependendo do grupo e da criança, dá para avaliar.`,
    })
  }

  if (trip.exigeExperiencia) {
    lista.push({
      pergunta: 'Preciso ter experiência?',
      resposta:
        'Sim. Esta expedição exige experiência prévia em trilha. Não é a primeira para quem está começando. Se estiver em dúvida sobre o seu preparo, conte no WhatsApp o que você já fez e a Caqui indica o roteiro certo.',
    })
  } else {
    lista.push({
      pergunta: 'Preciso ter experiência?',
      resposta: `Não. O nível é ${rotuloDificuldade(trip.dificuldade).toLowerCase()} e o grupo anda no ritmo do mais lento, que é assim que se chega inteiro. Se for a sua primeira trilha, avise: o guia fica de olho.`,
    })
  }

  lista.push({
    pergunta: 'E se chover?',
    resposta:
      'Chuva leve não cancela: trilha na Serra do Mar tem chuva. O que cancela é condição de risco: tempestade, raio, rio cheio para travessia. Nesse caso a Caqui avisa antes da saída e remarca ou devolve o valor.',
  })

  if (trip.politicaCancelamento) {
    lista.push({
      pergunta: 'E se eu precisar cancelar?',
      resposta: trip.politicaCancelamento,
    })
  }

  return lista
}

/** `8.5` → "8,5". Decimal com vírgula sem passar por `toFixed`. */
const FORMATO_DISTANCIA = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function distancia(km: number): string {
  return FORMATO_DISTANCIA.format(km)
}

function ListaSimples({ itens, vazio }: { itens: string[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-caqui-ink-500">{vazio}</p>

  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item) => (
        <li key={item} className="flex gap-2.5">
          <Marca />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * O marcador da lista.
 *
 * Um losango de 6px em vez do `list-disc` do navegador: a bolinha padrão é o
 * único elemento redondo de um sistema inteiro sem raio de pílula, e aparece
 * dezenas de vezes por página. Losango é a mesma geometria facetada do chanfro
 * e do hexágono do brasão.
 */
function Marca() {
  return (
    <span aria-hidden="true" className="bg-caqui-orange-500 mt-2 size-1.5 shrink-0 rotate-45" />
  )
}
