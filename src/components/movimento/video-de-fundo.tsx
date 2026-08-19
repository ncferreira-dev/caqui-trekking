'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  ASPECTO,
  decidirVideo,
  orientacaoIdeal,
  VIDEO_HEROI,
  type Decisao,
  type Orientacao,
} from '@/lib/media/video-heroi'
import { cn } from '@/lib/ui/cn'

/**
 * O vídeo de fundo do herói.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELE NÃO É "UM VÍDEO ATRÁS DO SITE". É UMA CAMADA DE UMA COMPOSIÇÃO.
 * ────────────────────────────────────────────────────────────────────────────
 * A ordem das camadas, de baixo para cima, e o que cada uma resolve:
 *
 *   1. pôster        o primeiro quadro do vídeo, como `background-image`
 *   2. vídeo         entra em fade por cima do pôster, quando puder tocar
 *   3. banho         `noite-900` a 18% — é a "correção de cor" do plano
 *   4. véu           gradiente de baixo para cima, o que torna o texto legível
 *   5. grão          textura de papel, o que separa "vídeo" de "impresso"
 *
 * Nenhuma usa `filter` na tag `<video>`. Saturação e contraste por CSS num
 * vídeo forçam repintura por quadro e derrubam celular fraco; o mesmo efeito
 * ótico sai de um banho de cor translúcido, que é composição pura.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PÔSTER É `background-image`, E NÃO UMA `<img>`
 * ────────────────────────────────────────────────────────────────────────────
 * Duas razões, e a segunda é a que importa. A primeira: o ESLint deste projeto
 * recusa `<img>` fora de dois arquivos nomeados, e abrir uma terceira exceção
 * para um fundo decorativo enfraqueceria a regra pelo motivo mais fraco
 * possível. A segunda: isto NÃO É CONTEÚDO. Não tem texto alternativo porque
 * não há informação aqui — o que a página diz está no `<h1>` ao lado. Uma
 * `<img alt="">` decorativa que ocupa a tela inteira é exatamente o tipo de nó
 * que leitor de tela e tradutor automático tropeçam.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CONTROLE DE PAUSA NÃO É OPCIONAL
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing pediu "sem controles", e ele está certo sobre o que quis dizer:
 * sem barra de player, sem botão de play gigante no meio da tela. Mas conteúdo
 * em movimento que roda sozinho por mais de 5 segundos precisa de um jeito de
 * parar — WCAG 2.2.2 (Pause, Stop, Hide), nível A. Não é preferência de
 * ninguém, é critério de conformidade, e um vídeo de 12,84s em `loop` infinito
 * cai direto nele.
 *
 * A solução é um alvo de 44px no canto inferior DIREITO — o lado vazio da
 * composição, já que o texto todo mora à esquerda.
 *
 * O botão flutuante do WhatsApp também vive no canto direito, mas em
 * `position: fixed` contra a JANELA, enquanto este é `absolute` contra a área
 * do filme, que termina acima da faixa de dados. Os dois não se sobrepõem — e
 * essa distinção é justamente o defeito que já apareceu neste projeto entre o
 * WhatsApp e a barra de compra, documentado em `globals.css`. Quem mexer aqui
 * precisa conferir os dois no celular, não só no desktop.
 */
export function VideoDeFundo({
  primeiroPlano,
  className,
}: {
  /**
   * Camada desenhada SOBRE o vídeo e sobre os véus, abaixo apenas do controle
   * de pausa. É onde entra a serra em gravura do herói.
   *
   * Existe como slot em vez de a página empilhar a serra por fora porque a
   * ordem das camadas é a coisa que mais fácil se quebra aqui: com a serra
   * posicionada de fora, ela ficaria acima do botão de pausa e engoliria o
   * único controle acessível da cena. Concentrar o empilhamento num arquivo é
   * o que impede isso de acontecer na próxima página que usar o componente.
   */
  primeiroPlano?: ReactNode
  className?: string
}) {
  const [decisao, setDecisao] = useState<Decisao | null>(null)
  const [orientacao, setOrientacao] = useState<Orientacao | null>(null)
  const [pronto, setPronto] = useState(false)
  const [pausadoPorMim, setPausadoPorMim] = useState(false)

  const ref = useRef<HTMLVideoElement>(null)

  /**
   * Decide, e redecide só quando a decisão pode realmente mudar.
   *
   * Reagir a todo `resize` seria errado: trocar o `src` remonta o vídeo e
   * reinicia o download, então arrastar a borda da janela no desktop custaria
   * megabytes. As duas coisas que mudam a decisão são a preferência de
   * movimento e o lado em que o viewport cruza o limiar de proporção — e as
   * duas são consultas de mídia, que avisam quando mudam em vez de precisar
   * ser perguntadas.
   *
   * O limiar da consulta é DERIVADO de `ASPECTO`, a mesma fonte que
   * `orientacaoIdeal` usa. Trocar um arquivo de vídeo por outro de proporção
   * diferente move o limiar sozinho; não há número mágico para alguém esquecer
   * de atualizar em dois lugares.
   */
  useEffect(() => {
    const virada = Math.sqrt(ASPECTO.retrato * ASPECTO.paisagem)
    const consultas = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia(`(min-aspect-ratio: ${Math.round(virada * 1000)}/1000)`),
    ]

    const avaliar = () => {
      // `navigator.connection` não é padrão em todo navegador; ausente, os dois
      // campos saem `undefined` e a decisão trata isso como "sem informação",
      // que é diferente de "conexão ruim".
      const conexao = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string }
        }
      ).connection

      const condicoes = {
        larguraViewport: window.innerWidth,
        alturaViewport: window.innerHeight,
        movimentoReduzido: consultas[0]!.matches,
        poupaDados: conexao?.saveData === true,
        tipoDeConexao: conexao?.effectiveType,
      }

      setOrientacao(orientacaoIdeal(condicoes))
      setDecisao(decidirVideo(condicoes))
    }

    avaliar()
    for (const c of consultas) c.addEventListener('change', avaliar)

    // `navigator.connection` também emite `change` quando o navegador
    // reclassifica a rede. Isso importa porque a primeira leitura acontece
    // durante o carregamento, quando o RTT está inflado e a classificação sai
    // pessimista: sem ouvir a correção, uma recusa momentânea viraria
    // permanente até a próxima navegação.
    const conexao = (navigator as Navigator & { connection?: EventTarget }).connection
    conexao?.addEventListener('change', avaliar)

    return () => {
      for (const c of consultas) c.removeEventListener('change', avaliar)
      conexao?.removeEventListener('change', avaliar)
    }
  }, [])

  /**
   * Só começa a baixar depois que a página já pintou.
   *
   * O elemento nasce com `preload="none"` e o download é pedido à mão numa
   * janela ociosa. Sem isso, 2 MB de vídeo decorativo disputam banda com a
   * fonte e com o HTML, e o herói — que é o LCP desta página — chega depois.
   * `requestIdleCallback` não existe no Safari, daí o `setTimeout` de reserva.
   */
  useEffect(() => {
    if (decisao?.tocar !== true) return
    const video = ref.current
    if (!video) return

    let cancelado = false
    const comecar = () => {
      if (cancelado) return
      video.load()
    }

    const janela = window as Window & {
      requestIdleCallback?: (cb: () => void, opcoes?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (janela.requestIdleCallback) {
      const id = janela.requestIdleCallback(comecar, { timeout: 900 })
      return () => {
        cancelado = true
        janela.cancelIdleCallback?.(id)
      }
    }

    const id = window.setTimeout(comecar, 700)
    return () => {
      cancelado = true
      window.clearTimeout(id)
    }
  }, [decisao?.tocar])

  /**
   * Para de tocar quando ninguém está vendo.
   *
   * Decodificar quadro é o trabalho mais caro da página. Um vídeo que continua
   * rodando enquanto a pessoa lê a agenda três telas abaixo esquenta o aparelho
   * e come bateria sem entregar nada.
   *
   * `pausadoPorMim` é respeitado: se a pessoa pausou de propósito, voltar a
   * rolar para cima NÃO desfaz a escolha dela.
   */
  useEffect(() => {
    if (decisao?.tocar !== true) return
    const video = ref.current
    if (!video) return

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting && !pausadoPorMim) {
          // `play()` devolve promessa e pode ser recusada — política de
          // autoplay, aba em segundo plano, aparelho em modo de economia. É
          // recusa esperada, não erro: o pôster continua no lugar.
          void video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.05 },
    )

    observador.observe(video)
    return () => observador.disconnect()
  }, [decisao?.tocar, pausadoPorMim])

  const fontes = orientacao ? VIDEO_HEROI[orientacao] : null

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden', className)}
      // O diagnóstico de "por que o vídeo não tocou no celular do cliente".
      // Custa um atributo e economiza uma tarde.
      data-video={decisao ? (decisao.tocar ? orientacao : decisao.motivo) : 'decidindo'}
    >
      {/* 1. O pôster. É o primeiro quadro do próprio vídeo, então quando o
             vídeo entra não existe salto de imagem. */}
      {fontes && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${fontes.poster}")` }}
        />
      )}

      {/* 2. O vídeo. */}
      {decisao?.tocar === true && fontes && (
        <video
          ref={ref}
          // `aria-hidden` porque é decoração: a informação da cena está no
          // `<h1>`. Sem isto, leitor de tela anuncia um nó de mídia sem nome.
          aria-hidden="true"
          // `tabIndex={-1}`: sem controles nativos ele não deveria receber
          // foco, e em alguns navegadores recebe.
          tabIndex={-1}
          poster={fontes.poster}
          autoPlay
          // Silencioso E sem faixa de áudio no arquivo. `muted` é o que
          // permite o autoplay no iOS; a ausência da faixa é o que garante
          // que nunca haverá som mesmo se alguém remover o atributo.
          muted
          loop
          playsInline
          preload="none"
          // Fade de entrada. O estado inicial é `opacity-0` e só sai daqui
          // quando o navegador diz que tem quadro para mostrar — nunca antes,
          // senão aparece um retângulo preto sobre o pôster.
          onCanPlay={() => setPronto(true)}
          data-pronto={pronto ? 'sim' : 'nao'}
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            'opacity-0 transition-opacity duration-700 ease-[var(--ease-cena)]',
            'data-[pronto=sim]:opacity-100',
            'motion-reduce:transition-none',
          )}
        >
          {/* WebM primeiro: é o menor (2,2 MB contra 3,2 MB no desktop) e o
              navegador usa o primeiro que souber tocar. O MP4 existe para o
              Safari antigo, que não lê VP9 em WebM. */}
          <source src={fontes.webm} type="video/webm" />
          <source src={fontes.mp4} type="video/mp4" />
        </video>
      )}

      {/* 3. O banho de cor: a "correção" do plano, sem custar filtro. */}
      <div className="bg-caqui-noite-900/20 absolute inset-0" aria-hidden="true" />

      {/* 4. O véu de legibilidade — a metade VERTICAL do problema.
             Ele escurece de baixo para cima e resolve o pé da cena. O que ele
             deliberadamente NÃO faz é escurecer a tela toda: um véu forte o
             suficiente para o texto em qualquer altura apaga o vídeo, e aí não
             havia motivo para ter vídeo.
             A outra metade é uma PLACA LATERAL, posicionada por quem usa o
             componente do lado em que o texto fica. Assim o texto ganha fundo
             escuro e o lado oposto continua vívido — é a composição da
             referência 1, escuro à esquerda e paisagem à direita. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to top, var(--color-caqui-noite-900) 0%, color-mix(in srgb, var(--color-caqui-noite-900) 84%, transparent) 16%, color-mix(in srgb, var(--color-caqui-noite-900) 44%, transparent) 46%, color-mix(in srgb, var(--color-caqui-noite-900) 10%, transparent) 76%, transparent 100%)',
        }}
      />

      {/* Um véu no topo também, senão a navegação transparente pousa sobre céu
          claro e os links somem. Curto e fraco: só o suficiente para o header. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-40"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, color-mix(in srgb, var(--color-caqui-noite-900) 62%, transparent), transparent)',
        }}
      />

      {/* 5. O primeiro plano — a serra em gravura, por cima da imagem. */}
      {primeiroPlano}

      {/* 6. O grão, sempre por último: ele unifica vídeo e desenho numa
             superfície só, e é isso que faz a cena parecer impressa em vez de
             parecer um SVG colado sobre um vídeo. */}
      <div className="grao absolute inset-0" aria-hidden="true" />

      {/* O controle de pausa — WCAG 2.2.2. */}
      {decisao?.tocar === true && (
        <button
          type="button"
          onClick={() => {
            const video = ref.current
            if (!video) return
            if (video.paused) {
              void video.play().catch(() => {})
              setPausadoPorMim(false)
            } else {
              video.pause()
              setPausadoPorMim(true)
            }
          }}
          // O rótulo muda com o estado em vez de usar `aria-pressed`: "pausar"
          // e "retomar" são ações diferentes, não um interruptor ligado ou
          // desligado, e é assim que o leitor de tela anuncia o que vai
          // acontecer se a pessoa apertar.
          aria-label={pausadoPorMim ? 'Retomar o vídeo de fundo' : 'Pausar o vídeo de fundo'}
          className={cn(
            'absolute right-4 bottom-4 z-10 inline-flex size-11 items-center justify-center sm:right-6 sm:bottom-6',
            'border-caqui-rule-noite bg-caqui-noite-900/55 border text-white',
            'rounded-xs backdrop-blur-sm transition-colors',
            'hover:bg-caqui-noite-900/85 focus-visible:ring-2 focus-visible:ring-white',
          )}
        >
          {pausadoPorMim ? (
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="currentColor">
              <path d="M6 4l10 6-10 6z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="currentColor">
              <path d="M6 4h3v12H6zM11 4h3v12h-3z" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
