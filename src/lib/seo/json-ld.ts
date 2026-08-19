import { dataCurta } from '@/lib/datetime'
import { centavosParaDecimal } from '@/lib/money'
import type {
  ProdutoDetalheDTO,
  SaidaDTO,
  TripDetalheDTO,
  TripResumoDTO,
} from '@/server/dto/public-dto'
import type { SettingsDTO } from '@/server/services/institucional-service'

/**
 * Os dados estruturados, como função pura.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO NÃO MORA DENTRO DAS PÁGINAS
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo é escrever o objeto JSON-LD inline em cada `page.tsx`. Aí a mesma
 * pergunta — "esgotado vira qual availability do schema.org?" — passa a ter
 * três respostas em três arquivos, e a divergência é invisível: nada quebra,
 * o Google só passa a mostrar a saída errada como disponível.
 *
 * É o mesmo defeito que o `docs/00-analise-dalia.md` registrou no projeto de
 * referência com "chamado em atraso" definido em três lugares. Aqui a regra
 * mora numa função sem framework, sem banco e sem `next/*`: recebe DTO,
 * devolve objeto. Roda no teste sem subir nada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A BASE ENTRA POR PARÂMETRO
 * ────────────────────────────────────────────────────────────────────────────
 * Nenhuma função aqui lê `process.env`. Quem sabe a URL do site é
 * `@/lib/seo/site`, que é o único acoplado ao ambiente. Isso é o que permite
 * testar a saída inteira com `https://exemplo.test` e comparar string por
 * string.
 */

export type JsonLd = Record<string, unknown>

/** Âncoras estáveis. O `@id` é o que permite um nó referenciar o outro. */
export const ANCORA = {
  negocio: '#negocio',
  site: '#site',
  guiaParticular: '/guia-particular#servico',
} as const

// ─── Serialização ────────────────────────────────────────────────────────────

/**
 * JSON-LD dentro de `<script>` é injeção de HTML esperando acontecer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NASCEU DE UM CENÁRIO CONCRETO, NÃO DE PARANOIA GENÉRICA
 * ────────────────────────────────────────────────────────────────────────────
 * A descrição do roteiro é escrita no CRM e sai daqui para dentro de uma tag
 * `<script>`. O navegador fecha o script no primeiro `</script>` textual que
 * encontrar — ele não sabe nem liga que aquilo está dentro de uma string JSON.
 * Uma descrição contendo
 *
 *     ...vista do Alto Tietê</script><img src=x onerror=alert(1)>
 *
 * fecha a tag e o resto vira HTML executável em TODA visita à página. E o
 * `dangerouslySetInnerHTML` é obrigatório aqui: o React escaparia o conteúdo
 * como texto, o que quebraria o JSON-LD em vez de protegê-lo.
 *
 * `<` vira `<`, que é JSON válido, é lido igual por qualquer parser, e
 * não existe mais sequência que o navegador reconheça como fim de tag.
 * `U+2028` e `U+2029` entram junto porque `JSON.stringify` os deixa crus e
 * eles são quebra de linha para o parser de JavaScript.
 */
const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

export function serializarJsonLd(dados: JsonLd | JsonLd[]): string {
  return JSON.stringify(dados).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c] ?? c)
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function url(base: string, caminho = ''): string {
  return `${base}${caminho}`
}

/**
 * Remove chave de valor nulo, recursivamente.
 *
 * Campo ausente é melhor que campo vazio: `"description": null` no JSON-LD faz
 * o validador do Google reclamar, e `"image": []` chega a suprimir o resultado
 * rico inteiro. Como a Caqui ainda não entregou foto nenhuma, quase todo
 * roteiro cai nesse caso — então isto não é polimento, é o caminho principal.
 */
function limpar<T extends JsonLd>(objeto: T): T {
  const saida: JsonLd = {}

  for (const [chave, valor] of Object.entries(objeto)) {
    if (valor === null || valor === undefined) continue
    if (Array.isArray(valor) && valor.length === 0) continue
    if (typeof valor === 'string' && valor.trim() === '') continue
    saida[chave] = valor
  }

  return saida as T
}

/**
 * Texto de descrição, cortado sem partir palavra.
 *
 * O limite não é regra do schema.org — é que descrição longa demais é truncada
 * pelo buscador num ponto que ele escolhe, e no meio de uma palavra fica pior
 * do que se a gente cortar no espaço.
 */
function resumir(texto: string, limite = 300): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= limite) return limpo

  const corte = limpo.slice(0, limite)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return `${(ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`
}

/**
 * A tradução de disponibilidade.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESTE MAPA É O MOTIVO DE O ARQUIVO EXISTIR
 * ────────────────────────────────────────────────────────────────────────────
 * `LAST_SPOTS` é o caso que se erra: o reflexo é mandar `InStock`, porque
 * "ainda tem vaga". Mas `LimitedAvailability` é exatamente o que o schema.org
 * tem para isso, e é o que faz o resultado rico do Google mostrar a urgência
 * que a Caqui já sinaliza no site. Traduzir para `InStock` joga fora a
 * informação; traduzir para `SoldOut` mente ao contrário.
 */
const DISPONIBILIDADE: Record<SaidaDTO['disponibilidade'], string> = {
  AVAILABLE: 'https://schema.org/InStock',
  LAST_SPOTS: 'https://schema.org/LimitedAvailability',
  SOLD_OUT: 'https://schema.org/SoldOut',
}

// ─── Nós ─────────────────────────────────────────────────────────────────────

/**
 * A empresa.
 *
 * Sai só na home. Repetir o mesmo `LocalBusiness` em toda página não melhora
 * nada e multiplica o peso do HTML; as outras páginas referenciam pelo `@id`.
 *
 * Nada aqui é inventado. Endereço de rua a Caqui não divulga — sai só
 * localidade, estado e país, que é o que o `areaServed` precisa. Cadastur e
 * PESM vêm do CRM: se a Caqui ainda não preencheu, a chave não aparece, em vez
 * de sair um número de mentira que ninguém confere.
 */
export function negocioLocal(base: string, settings: SettingsDTO | null): JsonLd {
  const perfis = [
    settings?.instagramTrekking ? `https://instagram.com/${settings.instagramTrekking}` : null,
    settings?.instagramWear ? `https://instagram.com/${settings.instagramWear}` : null,
    settings?.linktree,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0)

  return limpar({
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'TravelAgency'],
    '@id': url(base, ANCORA.negocio),
    name: 'Caqui Trekking',
    description:
      'Expedições e trilhas guiadas na Serra do Mar e no Alto Tietê, com guias cadastrados no Cadastur e monitores credenciados pelo Parque Estadual da Serra do Mar.',
    url: url(base, '/'),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Mogi das Cruzes',
      addressRegion: 'SP',
      addressCountry: 'BR',
    },
    areaServed: [
      { '@type': 'City', name: 'Mogi das Cruzes' },
      { '@type': 'AdministrativeArea', name: 'Alto Tietê' },
      { '@type': 'State', name: 'São Paulo' },
    ],
    knowsAbout: [
      'trekking',
      'trilha',
      'rapel',
      'ecoturismo',
      'montanhismo',
      'Serra do Mar',
      'Alto Tietê',
    ],
    // O WhatsApp é o canal real de atendimento. Declarar como `telephone` é
    // correto: é um número de telefone, e é por ele que se fecha a vaga.
    telephone: settings?.whatsappNumber ? `+${settings.whatsappNumber}` : null,
    email: settings?.email ?? null,
    sameAs: perfis,
    // Cadastur é registro no Ministério do Turismo, conferível no portal. É a
    // credencial que distingue operação regular de passeio informal, e é o que
    // o público que pesquisa segurança procura.
    identifier: settings?.cadastur
      ? { '@type': 'PropertyValue', name: 'Cadastur', value: settings.cadastur }
      : null,
  })
}

/** O site, para a caixa de busca e o nome curto nos resultados. */
export function website(base: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': url(base, ANCORA.site),
    name: 'Caqui Trekking',
    url: url(base, '/'),
    inLanguage: 'pt-BR',
    publisher: { '@id': url(base, ANCORA.negocio) },
  }
}

/**
 * Uma saída com data marcada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * É `Event`, E ISSO É UMA DECISÃO DE MODELAGEM, NÃO DE SEO
 * ────────────────────────────────────────────────────────────────────────────
 * O roteiro (`Trip`) não é evento: não tem data. Quem tem data, preço e ponto
 * de encontro é a saída (`Departure`). Marcar o roteiro como `Event` obrigaria
 * a escolher uma data entre várias, e o Google mostraria uma só — justamente a
 * que pode estar esgotada.
 *
 * A separação Trip/Departure decidida no PROMPT 02 é o que torna isto direto:
 * cada saída vira um `Event`, todas apontam para a mesma página do roteiro, e
 * o preço de cada uma é o dela (feriado custa mais que baixa temporada).
 */
export function eventoDeSaida(
  base: string,
  trip: Pick<TripResumoDTO, 'slug' | 'titulo' | 'subtitulo' | 'cidade' | 'estado'> & {
    descricao?: string
    imagens?: { url: string }[]
    guias?: { nome: string }[]
  },
  saida: SaidaDTO,
): JsonLd {
  const endereco = {
    '@type': 'PostalAddress',
    addressLocality: trip.cidade,
    addressRegion: trip.estado,
    addressCountry: 'BR',
  }

  return limpar({
    '@context': 'https://schema.org',
    '@type': 'Event',
    // O nome carrega a data porque cada saída é um evento distinto. Sem ela,
    // cinco eventos com o mesmo nome parecem duplicata para o rastreador.
    name: `${trip.titulo}, ${dataCurta(new Date(saida.inicioUtc))}`,
    // `inicioLocal` traz o offset de São Paulo (-03:00). Data sem fuso é lida
    // como UTC, e uma saída às 6h da manhã apareceria como 3h.
    startDate: saida.inicioLocal,
    endDate: saida.fimUtc,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: trip.subtitulo ?? (trip.descricao ? resumir(trip.descricao) : null),
    url: url(base, `/trekking/${trip.slug}`),
    image: trip.imagens?.map((i) => i.url) ?? [],
    location: limpar({
      '@type': 'Place',
      name: saida.pontoEncontro ?? `${trip.cidade} · ${trip.estado}`,
      address: endereco,
      geo: saida.coordenadas
        ? {
            '@type': 'GeoCoordinates',
            latitude: saida.coordenadas.lat,
            longitude: saida.coordenadas.lng,
          }
        : null,
    }),
    organizer: { '@id': url(base, ANCORA.negocio) },
    performer: trip.guias?.map((g) => ({ '@type': 'Person', name: g.nome })) ?? [],
    isAccessibleForFree: false,
    offers: {
      '@type': 'Offer',
      price: saida.precoDecimal,
      priceCurrency: 'BRL',
      availability: DISPONIBILIDADE[saida.disponibilidade],
      url: url(base, `/trekking/${trip.slug}`),
    },
  })
}

/** Todas as saídas futuras de um roteiro, para a página de detalhe. */
export function eventosDoRoteiro(base: string, trip: TripDetalheDTO): JsonLd[] {
  return trip.saidas.filter((s) => !s.encerrada).map((s) => eventoDeSaida(base, trip, s))
}

/**
 * Uma peça da Caqui Wear.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `Offer` OU `AggregateOffer`, DECIDIDO PELO DADO
 * ────────────────────────────────────────────────────────────────────────────
 * Quando todas as variantes custam igual — o caso da camiseta e dos óculos —
 * sai um `Offer` com o preço. Quando divergem, sai `AggregateOffer` com piso e
 * teto, porque anunciar um preço só seria escolher arbitrariamente qual das
 * variantes é "a" do produto.
 *
 * A disponibilidade agregada é OR, não AND: se qualquer variante está à venda,
 * o produto está à venda. Marcar `SoldOut` porque o P acabou esconderia o M
 * que tem em estoque.
 */
export function produtoJsonLd(base: string, produto: ProdutoDetalheDTO): JsonLd {
  const precos = produto.variantes.map((v) => v.precoCentavos)
  const menor = precos.length > 0 ? Math.min(...precos) : produto.precoCentavos
  const maior = precos.length > 0 ? Math.max(...precos) : produto.precoCentavos
  const algumaDisponivel = produto.variantes.some((v) => v.disponivel)

  const disponibilidade = algumaDisponivel
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock'

  const pagina = url(base, `/wear/${produto.slug}`)
  // `centavosParaDecimal`, e não divisão por 100: é a mesma função que produz
  // o `precoDecimal` do DTO da saída, e é o único lugar do projeto que sabe
  // transformar centavos em "89.90" sem passar por ponto flutuante.
  const emReais = centavosParaDecimal

  const oferta: JsonLd =
    menor === maior
      ? {
          '@type': 'Offer',
          price: emReais(menor),
          priceCurrency: 'BRL',
          availability: disponibilidade,
          url: pagina,
        }
      : {
          '@type': 'AggregateOffer',
          lowPrice: emReais(menor),
          highPrice: emReais(maior),
          priceCurrency: 'BRL',
          offerCount: produto.variantes.length,
          availability: disponibilidade,
          url: pagina,
        }

  return limpar({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produto.nome,
    description: produto.descricao ? resumir(produto.descricao) : null,
    image: produto.imagens.map((i) => i.url),
    sku: produto.slug,
    category: produto.categoria,
    brand: { '@type': 'Brand', name: 'Caqui Wear' },
    color: produto.cores.map((c) => c.nome),
    offers: oferta,
  })
}

/**
 * A trilha de navegação.
 *
 * Aparece no lugar da URL crua no resultado do Google. Vale mais no celular,
 * onde a URL é truncada e "caquitrekking.com.br › trekking › pedra-grande…"
 * some antes de dizer qualquer coisa.
 */
export function migalhas(base: string, itens: { nome: string; caminho: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((item, indice) => ({
      '@type': 'ListItem',
      position: indice + 1,
      name: item.nome,
      item: url(base, item.caminho),
    })),
  }
}

/**
 * A agenda como lista ordenada de saídas.
 *
 * `ItemList` aqui e `Event` completo na página do roteiro não é duplicata: a
 * lista diz "estas são as saídas, nesta ordem"; o evento diz o que cada uma é.
 * Repetir o `Event` inteiro na agenda deixaria dois nós descrevendo a mesma
 * saída, e quando um envelhecesse ninguém saberia qual o Google leu.
 */
export function listaDaAgenda(
  base: string,
  itens: { trip: { slug: string; titulo: string }; inicioUtc: string }[],
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Próximas saídas da Caqui Trekking',
    numberOfItems: itens.length,
    itemListElement: itens.map((item, indice) => ({
      '@type': 'ListItem',
      position: indice + 1,
      name: `${item.trip.titulo}, ${dataCurta(new Date(item.inicioUtc))}`,
      url: url(base, `/trekking/${item.trip.slug}`),
    })),
  }
}

/**
 * O guia particular como SERVIÇO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `Service` E NÃO `Product`, E A DIFERENÇA IMPORTA PARA O RESULTADO
 * ────────────────────────────────────────────────────────────────────────────
 * A tentação é declarar como `Product` porque tem preço em outras páginas do
 * site. Mas isto não tem preço fixo: é saída fechada, orçada caso a caso. Um
 * `Product` sem `offers` é um nó incompleto, e o Google trata nó de produto sem
 * preço como erro no Search Console — a página perde o enriquecimento inteiro.
 *
 * `Service` com `areaServed` e `provider` é o tipo certo para "alguém que
 * executa um trabalho numa região". Ele não pede preço, e é o que conecta a
 * busca por "guia particular trekking mogi das cruzes" a esta página.
 *
 * `serviceType` carrega os termos que a pessoa realmente digita. Não é
 * palavra-chave enfiada em texto invisível: é o campo que o vocabulário do
 * schema.org reserva para nomear o serviço, e o nome dele É esse.
 */
export function servicoDeGuia(base: string, settings: SettingsDTO | null): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': url(base, ANCORA.guiaParticular),
    name: 'Guia particular de trekking',
    serviceType: ['Guia particular', 'Trekking guiado', 'Saída fechada', 'Ecoturismo'],
    description:
      'Saída fechada com guia particular para o seu grupo: destino, data e ritmo definidos com você. Guias cadastrados no Cadastur e monitores credenciados pelo PESM.',
    provider: { '@id': url(base, ANCORA.negocio) },
    areaServed: [
      { '@type': 'City', name: 'Mogi das Cruzes' },
      { '@type': 'AdministrativeArea', name: 'Alto Tietê' },
      { '@type': 'State', name: 'São Paulo' },
    ],
    // Sem `offers`: o preço é orçado por grupo. Declarar um valor aqui seria
    // publicar preço que a Caqui teria que honrar.
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: url(base, '/guia-particular'),
      ...(settings?.whatsappNumber ? { servicePhone: `+${settings.whatsappNumber}` } : {}),
    },
  }
}
