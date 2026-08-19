/**
 * O vídeo do herói: quais arquivos existem, e qual deles (se algum) tocar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É LÓGICA PURA, FORA DO COMPONENTE
 * ────────────────────────────────────────────────────────────────────────────
 * A regra aqui decide se alguém no 3G vai baixar 2 MB sem ter pedido. Isso é
 * regra de negócio, não detalhe de renderização — e regra que mora dentro de um
 * `useEffect` só pode ser testada subindo um navegador, o que na prática
 * significa que não é testada.
 *
 * Aqui ela recebe números e devolve uma decisão. O teste roda em milissegundos,
 * sem DOM, e cobre os aparelhos reais um por um.
 * Ver `src/test/video-heroi.test.ts`.
 */

/**
 * Os arquivos. Gerados a partir do master do cliente por ffmpeg — a receita
 * completa está em `public/videos/README.md`.
 *
 * Os quatro têm 12,84s: o master tem 13,44s e os últimos 0,6s se dissolvem na
 * abertura, para o loop não dar corte seco entre a vista aberta e o grupo no
 * cume. Nenhum tem faixa de áudio: vídeo de fundo é mudo por definição, e uma
 * trilha de áudio só pesa e ainda arrisca o autoplay ser bloqueado.
 */
export const VIDEO_HEROI = {
  /** Vertical nativo do celular (720×1162). Sem corte nenhum. */
  retrato: {
    webm: '/videos/hero-trekking-vertical.webm',
    mp4: '/videos/hero-trekking-vertical.mp4',
    poster: '/videos/hero-trekking-poster-vertical.jpg',
  },
  /** 16:9 (1920×1080), recortado da faixa alta do master vertical. */
  paisagem: {
    webm: '/videos/hero-trekking.webm',
    mp4: '/videos/hero-trekking.mp4',
    poster: '/videos/hero-trekking-poster.jpg',
  },
} as const

/** As proporções reais dos arquivos acima. */
export const ASPECTO = {
  retrato: 720 / 1162,
  paisagem: 1920 / 1080,
} as const

export type Orientacao = keyof typeof VIDEO_HEROI

export type MotivoDeNaoTocar = 'movimento-reduzido' | 'poupa-dados' | 'conexao-lenta'

export type Decisao =
  { tocar: false; motivo: MotivoDeNaoTocar } | { tocar: true; orientacao: Orientacao }

export type Condicoes = {
  larguraViewport: number
  alturaViewport: number
  /** `matchMedia('(prefers-reduced-motion: reduce)').matches` */
  movimentoReduzido: boolean
  /** `navigator.connection?.saveData` */
  poupaDados: boolean
  /** `navigator.connection?.effectiveType`. Ausente no Safari e no Firefox. */
  tipoDeConexao: string | undefined
}

/**
 * Conexões em que 2 MB de enfeite é falta de educação.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `3g` SAIU DESTA LISTA EM 18/08/2026, E O MOTIVO FOI MEDIDO
 * ────────────────────────────────────────────────────────────────────────────
 * A primeira versão incluía `3g`. No primeiro teste em máquina local, com o
 * vídeo servido de `localhost`, o atributo de diagnóstico saiu
 * `data-video="conexao-lenta"` — e uma consulta ao console no instante seguinte
 * reportava `4g`.
 *
 * A causa é o que `effectiveType` realmente é: uma estimativa derivada de
 * round-trip time recente, não de banda. Durante o carregamento inicial de uma
 * página com dezenas de requisições, o RTT sobe e o navegador rebaixa a
 * classificação — exatamente no momento em que esta decisão é tomada. O
 * resultado seria o vídeo nunca aparecer para uma parcela grande de gente com
 * conexão perfeitamente boa, e o defeito é invisível para quem testa depois do
 * carregamento.
 *
 * Ficam `slow-2g` e `2g`, onde 2 MB é dano real e a classificação é estável o
 * suficiente para confiar.
 *
 * O sinal em que se pode confiar de verdade é `saveData`: ele não é estimativa,
 * é escolha explícita da pessoa. Esse continua sendo obedecido sem discussão.
 *
 * `4g` e AUSENTE ficam de fora de propósito. `navigator.connection` não existe
 * no Safari nem no Firefox: tratar `undefined` como lenta desligaria o vídeo
 * para metade do tráfego real, o que é o oposto de degradar bem.
 */
const CONEXOES_LENTAS = new Set(['slow-2g', '2g'])

/**
 * O corte de largura usado quando a altura do viewport não é confiável.
 * É o breakpoint `lg` do design system (64rem), reaproveitado em vez de um
 * número novo — ver `--breakpoint-lg` em `globals.css`.
 */
const LARGURA_DE_CELULAR = 1024

/**
 * Decide o que fazer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ORDEM DAS RECUSAS IMPORTA
 * ────────────────────────────────────────────────────────────────────────────
 * Movimento reduzido vem primeiro porque é acessibilidade: é o único motivo que
 * não se resolve trocando de rede, e é o que precisa aparecer no diagnóstico
 * quando alguém pergunta por que o vídeo não tocou.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ORIENTAÇÃO É ESCOLHIDA PELO QUE MENOS SE PERDE, NÃO POR "PARECER" CERTO
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo é `altura > largura ? vertical : horizontal`. Ele acerta por acaso
 * na maioria dos casos e erra perto do quadrado.
 *
 * A conta certa vem de como `object-fit: cover` funciona: ele escala o vídeo
 * até cobrir e joga fora a diferença entre as duas proporções. A fração que
 * sobra visível é `min(a, p) / max(a, p)`, onde `a` é a proporção do viewport e
 * `p` a do vídeo. Então basta escolher o vídeo com a maior fração.
 *
 * O ponto de virada cai na média geométrica das duas proporções — ~1,05 com os
 * arquivos atuais. Ele NÃO está escrito como constante em lugar nenhum: sai da
 * conta. Trocar um arquivo por outro de proporção diferente move a virada
 * sozinho, sem ninguém precisar lembrar de atualizar um número.
 */
export function decidirVideo(c: Condicoes): Decisao {
  if (c.movimentoReduzido) return { tocar: false, motivo: 'movimento-reduzido' }
  if (c.poupaDados) return { tocar: false, motivo: 'poupa-dados' }
  if (c.tipoDeConexao && CONEXOES_LENTAS.has(c.tipoDeConexao)) {
    return { tocar: false, motivo: 'conexao-lenta' }
  }

  return { tocar: true, orientacao: orientacaoIdeal(c) }
}

/**
 * A orientação que melhor cabe no viewport, INDEPENDENTE de tocar ou não.
 *
 * Exportada separadamente porque o pôster também precisa dela: quando
 * `decidirVideo` recusa (movimento reduzido, Save-Data, 3G), a cena continua
 * mostrando a imagem estática — e ela tem que ser a do corte certo, senão
 * quem pediu menos movimento recebe de brinde um enquadramento pior.
 */
export function orientacaoIdeal({
  larguraViewport,
  alturaViewport,
}: Pick<Condicoes, 'larguraViewport' | 'alturaViewport'>): Orientacao {
  const aspecto = larguraViewport / alturaViewport

  // Alguns navegadores relatam altura 0 no primeiro quadro, antes do layout.
  // A divisão daria `Infinity` (ou `NaN` se a largura também for 0), e toda
  // comparação com `NaN` é falsa — a decisão cairia num galho não previsto.
  // Sem altura confiável, a largura é o único sinal que resta.
  if (!Number.isFinite(aspecto) || aspecto <= 0) {
    return larguraViewport < LARGURA_DE_CELULAR ? 'retrato' : 'paisagem'
  }

  const sobra = (proporcaoDoVideo: number) =>
    Math.min(aspecto, proporcaoDoVideo) / Math.max(aspecto, proporcaoDoVideo)

  return sobra(ASPECTO.retrato) > sobra(ASPECTO.paisagem) ? 'retrato' : 'paisagem'
}
