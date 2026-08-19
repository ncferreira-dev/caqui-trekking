import { Neblina, Serra, type Profundidade } from '@/components/marca/serra'
import { LARGURAS, srcsetDe, urlVariante } from '@/lib/media/urls'
import type { MediaDTO } from '@/server/dto/public-dto'
import { cn } from '@/lib/ui/cn'

/**
 * A imagem do catálogo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO É `next/image`
 * ────────────────────────────────────────────────────────────────────────────
 * `next/image` existe para resolver três coisas: gerar variantes, negociar
 * formato e reservar espaço. As duas primeiras já estão resolvidas antes da
 * imagem chegar aqui — o Cloudinary entrega `f_auto,q_auto,c_limit` na borda,
 * escolhendo AVIF ou WebP pelo `Accept` do navegador (ver docs/05-midia.md).
 *
 * Passar por `/_next/image` em cima disso significaria:
 *
 *   1. Uma invocação de função serverless por imagem, por largura, no primeiro
 *      acesso — custo real na Vercel, e latência real no primeiro visitante de
 *      cada tamanho.
 *   2. Re-encodar um arquivo JÁ otimizado. Recomprimir um AVIF em WebP não
 *      melhora nada; degrada.
 *   3. Perder o `f_auto`: o formato passaria a ser decidido pelo otimizador do
 *      Next, e o CDN do Cloudinary viraria um armazenamento burro.
 *
 * O que sobra de `next/image` é `width`/`height` e `loading="lazy"` — dois
 * atributos nativos do HTML, que estão aqui embaixo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O BORRÃO É `background-image` DA PRÓPRIA `<img>`
 * ────────────────────────────────────────────────────────────────────────────
 * Sem elemento extra, sem estado, sem `onLoad`. O `blurDataUrl` (um data URI de
 * ~20×20px gravado no upload) pinta o fundo da própria imagem; quando os bytes
 * reais chegam, eles cobrem o fundo. Se o JavaScript não rodar, funciona
 * igual — e é isso que separa um placeholder de um placeholder que quebra.
 */

export type ImagemProps = {
  midia: MediaDTO
  /**
   * O atributo `sizes`. É OBRIGATÓRIO e não tem padrão: sem ele o navegador
   * assume `100vw` e baixa a imagem de 2000px para preencher um card de 380px.
   * Errar aqui é o defeito de performance mais caro e mais silencioso que
   * existe em catálogo — nada aparece quebrado, só pesado.
   */
  sizes: string
  /** `true` só na imagem acima da dobra. Mais de uma anula o efeito. */
  prioridade?: boolean
  className?: string
}

export function Imagem({ midia, sizes, prioridade = false, className }: ImagemProps) {
  return (
    <img
      src={urlVariante(midia.url, LARGURAS.card)}
      srcSet={srcsetDe(midia.url, midia.width)}
      sizes={sizes}
      alt={midia.alt}
      // Sempre presentes: é o que reserva a proporção antes do byte chegar e
      // impede o salto de layout. `MediaAsset` exige os dois no banco por isso.
      width={midia.width}
      height={midia.height}
      loading={prioridade ? 'eager' : 'lazy'}
      fetchPriority={prioridade ? 'high' : undefined}
      decoding="async"
      className={cn('block h-full w-full object-cover', className)}
      style={
        midia.blurDataUrl
          ? {
              backgroundImage: `url("${midia.blurDataUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    />
  )
}

/**
 * O lugar da imagem quando não existe imagem.
 *
 * Não é caso de borda: a Caqui publica roteiro antes de ter foto, e hoje NENHUM
 * roteiro e NENHUM produto tem capa no banco. Um `<img>` com `src` vazio
 * renderiza o ícone de imagem quebrada do navegador, que comunica "site com
 * defeito" em vez de "foto ainda não subiu".
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TRÊS VERSÕES, TODAS CORRIGIDAS OLHANDO A TELA
 * ════════════════════════════════════════════════════════════════════════════
 * 1ª  A MESMA serra em todos. Numa página com uma peça sem foto passa como
 *     grafismo da marca. Na Caqui Wear, com treze peças e nenhuma foto, viram
 *     treze retângulos idênticos, e retângulo idêntico repetido lê como erro de
 *     carregamento, não como decisão de design.
 *
 * 2ª  `semente` resolveu a repetição e revelou o problema seguinte: a `Serra` é
 *     uma faixa de 10:1, então num card quadrado ela sai com ~25px de altura.
 *     Um fio no rodapé de uma caixa vazia.
 *
 * 3ª  Ampliar e recortar resolveu a altura e produziu OUTRA coisa errada: uma
 *     linha cinza atravessando um vazio claro. Treze cards assim continuavam
 *     lendo como "faltou a foto", só que agora com treze linhas diferentes.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ESTAVA FALTANDO ERA CÉU
 * ════════════════════════════════════════════════════════════════════════════
 * A serra desenha a crista e preenche o que está ABAIXO dela com `--serra-massa`.
 * Enquanto essa massa teve a mesma cor da caixa, ela não ocultava nada: só
 * sobrava o traço, e traço sozinho não é paisagem, é gráfico.
 *
 * Aqui a caixa é o CÉU e a massa é a MONTANHA, e as duas têm cores diferentes:
 *
 *   céu       degradê da noite alta para o horizonte, mais claro embaixo
 *   luz       um calor laranja baixo, atrás das cristas
 *   montanha  `noite-900`, o mais escuro da paleta, recortado contra a luz
 *
 * A camada distante entra com a massa em opacidade menor (é o próprio
 * componente que faz isso, ver `massa` em `serra.tsx`), então ela sai
 * acinzentada pelo ar entre ela e quem olha. Isso é perspectiva atmosférica de
 * verdade, e é o que separa duas cristas empilhadas de uma paisagem.
 *
 * E o desenho não é arbitrário: é a logo da Caqui. Sol nascendo atrás da serra,
 * recortado por ela. A ausência de fotografia passou a mostrar exatamente a
 * cena que a marca já afirma.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ESCURA SEMPRE, INCLUSIVE NA PÁGINA CLARA
 * ════════════════════════════════════════════════════════════════════════════
 * Houve uma versão com dois tons, um claro para as páginas de areia. Ela durou
 * uma tela: sobre areia, uma chapa de areia não tem borda, não tem peso e não
 * parece conteúdo. Foto de verdade quase sempre é mais escura que a página, e é
 * por isso que a chapa escura ocupa o lugar dela sem o layout mudar de humor
 * quando as fotos chegarem.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O SORTEIO É DETERMINÍSTICO, E ISSO NÃO É DETALHE
 * ════════════════════════════════════════════════════════════════════════════
 * `Math.random()` aqui produziria marcação diferente no servidor e no cliente, e
 * o React acusaria divergência de hidratação. É um defeito que só aparece em
 * produção, porque em desenvolvimento o React remonta e esconde.
 *
 * `aria-hidden` porque não há informação: o nome do item está ao lado, e
 * anunciar "montanhas decorativas" treze vezes é ruído puro para quem ouve.
 */

/**
 * O DESLOCAMENTO DE CADA CAMADA, E A CONTA QUE ELE NÃO PODE FURAR.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DEFEITO QUE ISTO IMPEDE
 * ────────────────────────────────────────────────────────────────────────────
 * Cada crista é um SVG mais largo que a caixa, empurrado para a esquerda por
 * uma margem negativa. A massa dela (o preenchimento abaixo do traço) termina
 * onde o SVG termina — e se o desenho for empurrado demais, a borda direita
 * dele entra na caixa e aparece como um RETÂNGULO com canto vivo no meio da
 * paisagem.
 *
 * Aconteceu em 18/08/2026, na galeria do roteiro: a camada alta tinha 170% de
 * largura e podia ser deslocada até -149%, ou seja, terminava a 21% da caixa e
 * deixava 79% de borda à mostra. Não é sutil, e não aparece em toda semente:
 * depende do hash do slug, então dois roteiros parecem certos e o terceiro
 * mostra o retalho.
 *
 * A invariante é uma linha de aritmética:
 *
 *     largura + deslocamento >= 100
 *
 * Ela vive aqui, fora do componente, porque é a única parte disto que dá para
 * provar sem abrir um navegador. Ver `src/test/chapa-vazia.test.ts`.
 *
 * `folga` é sempre calculada sobre a MENOR largura que a camada assume: as
 * caixas grandes reduzem o zoom por `@container`, e a conta precisa valer no
 * pior caso, não no confortável.
 */
export type CamadaDaChapa = {
  /** A menor largura que a camada assume, em % da caixa. */
  larguraMinima: number
  /** Deslocamento mínimo, em % da caixa. Mantém a camada fora do canto. */
  minimo: number
}

export const CAMADAS_DA_CHAPA = {
  frente: { larguraMinima: 280, minimo: 0 },
  fundo: { larguraMinima: 210, minimo: 5 },
  alta: { larguraMinima: 170, minimo: 5 },
} as const satisfies Record<string, CamadaDaChapa>

export function deslocarCamada(semente: number, camada: CamadaDaChapa): number {
  // Quanto dá para empurrar sem descobrir a borda direita.
  const folga = camada.larguraMinima - 100 - camada.minimo
  return -(camada.minimo + (semente % folga))
}

/** Hash de string para inteiro. FNV-1a, curto e estável entre execuções. */
function semear(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return Math.abs(h)
}

/**
 * O céu antes do sol.
 *
 * Duas camadas: o calor baixo, atrás das cristas, e o degradê da noite alta
 * para o horizonte. A ordem importa, porque em `background-image` a primeira
 * fica por cima.
 *
 * `18%` de laranja é o teto medido: acima disso o horizonte compete com o preço
 * do produto, que é laranja e fica logo abaixo do card.
 */
const CEU = [
  'radial-gradient(112% 62% at 50% 92%, rgba(255, 138, 71, 0.18) 0%, transparent 62%)',
  'linear-gradient(to bottom, var(--color-caqui-noite-900) 0%, var(--color-caqui-noite-700) 100%)',
].join(', ')

export function MidiaVazia({ semente, className }: { semente?: string; className?: string }) {
  const n = semente ? semear(semente) : 0

  // Duas cristas, e a de trás NUNCA é a mesma da frente: as duas saem do MESMO
  // resto, separadas por uma distância fixa de dois degraus. Sortear as duas
  // independentemente daria colisão em um terço dos itens, e duas cristas iguais
  // sobrepostas leem como uma linha grossa, sem profundidade nenhuma.
  //
  //   n % 3 = 0  →  frente 3, fundo 1
  //   n % 3 = 1  →  frente 4, fundo 2
  //   n % 3 = 2  →  frente 5, fundo 3
  const degrau = n % 3
  const frente = (degrau + 3) as Profundidade
  const fundo = (degrau + 1) as Profundidade

  // O recorte, e por que ele muda com o tamanho da CAIXA.
  //
  // A `Serra` é uma faixa de 10:1, então a altura dela é sempre um décimo da
  // largura em que é renderizada. Num card quadrado de 155px, ampliar para 340%
  // dá uma crista de 58px: 37% da altura do card, uma paisagem.
  //
  // A MESMA conta na galeria do roteiro produz um vazio. Lá a caixa tem 1216
  // por 810, e duas cristas ancoradas na base ocupam a faixa de baixo e deixam
  // 600px de céu chapado em cima. Medido em 18/08/2026: um retângulo preto com
  // um traço no rodapé.
  //
  // Caixa alta não se resolve com mais zoom, se resolve com mais MONTANHA. A
  // partir de `@2xl` entra uma terceira crista, e as três se espalham pela
  // altura em vez de se empilharem na base. É a mesma composição do herói, na
  // escala de uma caixa.
  //
  // A decisão é por `@container` e não por `sm:`/`lg:` porque depende do PAI,
  // não da janela: o mesmo card de 155px existe num monitor de 1920px.
  //
  // As camadas andam em velocidades diferentes. É paralaxe congelada, e é o que
  // impede as três de parecerem um adesivo só.
  const deslocamentoFrente = deslocarCamada(n, CAMADAS_DA_CHAPA.frente)
  const deslocamentoFundo = deslocarCamada(n, CAMADAS_DA_CHAPA.fundo)
  const deslocamentoAlto = deslocarCamada(n, CAMADAS_DA_CHAPA.alta)
  // A terceira profundidade nunca repete as outras duas.
  const alta = (((degrau + 1) % 3) + 1) as Profundidade

  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-caqui-noite-900 @container relative flex h-full w-full items-end overflow-hidden',
        className,
      )}
      style={
        {
          backgroundImage: CEU,
          // A montanha é o ponto mais escuro da paleta, recortada contra o céu.
          '--serra-massa': 'var(--color-caqui-noite-900)',
          // Sobre fundo escuro a neblina CLAREIA o que está atrás. Ver `Neblina`.
          '--neblina-mistura': 'screen',
        } as React.CSSProperties
      }
    >
      {/* A CRISTA ALTA, só em caixa grande (`@2xl` = 672px de largura).
          Existe para preencher a altura de uma caixa como a galeria do roteiro,
          onde as outras duas ficariam amontoadas no rodapé. Em card ela não
          aparece: lá não há altura sobrando para preencher. */}
      <div
        className="text-caqui-sand-200 absolute inset-x-0 bottom-[44%] hidden w-[170%] shrink-0 @2xl:block"
        style={{ marginLeft: `${deslocamentoAlto}%` }}
      >
        <Serra profundidade={alta} className="opacity-[0.18]" />
      </div>

      {/* A crista distante. A massa dela entra com opacidade menor (é o próprio
          componente que decide, por profundidade), então sai acinzentada pelo
          ar. Fica ancorada acima da base para a da frente poder escondê-la. */}
      <div
        className="text-caqui-sand-200 absolute inset-x-0 bottom-[16%] w-[260%] shrink-0 @2xl:bottom-[26%] @2xl:w-[210%]"
        style={{ marginLeft: `${deslocamentoFundo}%` }}
      >
        <Serra profundidade={fundo} className="opacity-30" />
      </div>

      {/* A neblina no vale, entre as duas. */}
      <Neblina className="bottom-[12%] h-[24%]" intensidade={0.85} />

      {/* A crista próxima, sólida, fechando contra a base do card. */}
      <div
        className="text-caqui-sand-200 relative w-[340%] shrink-0 @2xl:w-[280%]"
        style={{ marginLeft: `${deslocamentoFrente}%` }}
      >
        <Serra profundidade={frente} className="opacity-55" />
      </div>

      {/* O grão por cima: é o que separa "SVG num degradê" de "impresso". */}
      <div className="grao pointer-events-none absolute inset-0" />
    </div>
  )
}

/** Imagem ou o vazio, decidido num lugar só. */
export function Capa({
  midia,
  sizes,
  prioridade,
  /** Slug do item. Escolhe qual gravura aparece quando não há foto. */
  semente,
  className,
}: {
  midia: MediaDTO | null
  sizes: string
  prioridade?: boolean
  semente?: string
  className?: string
}) {
  if (!midia)
    return <MidiaVazia {...(semente ? { semente } : {})} {...(className ? { className } : {})} />
  return (
    <Imagem
      midia={midia}
      sizes={sizes}
      {...(prioridade ? { prioridade } : {})}
      {...(className ? { className } : {})}
    />
  )
}
