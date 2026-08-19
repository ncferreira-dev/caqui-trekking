'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { LogoFantasma } from '@/components/shell/logo-fantasma'
import { useMochila } from '@/components/carrinho/contexto'
import { useCarrinho } from '@/lib/carrinho/store'
import { cn } from '@/lib/ui/cn'

/**
 * Header do site.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A LOJA INTEIRA ABRE ESCURO. ISSO É INVARIANTE, NÃO COINCIDÊNCIA.
 * ────────────────────────────────────────────────────────────────────────────
 * O header é transparente no topo e ganha fundo branco ao rolar. Para a tinta
 * dele estar certa, ele precisa saber a cor da PRIMEIRA seção da página, que é
 * propriedade da página e não dele.
 *
 * Até 18/08/2026 isso era uma lista de rotas (`ROTAS_COM_HEROI`), porque só a
 * home abria escuro. Quando `CabecalhoDePagina` virou palco noturno, a lista
 * cresceu para sete e depois para dez, ou seja, para TODAS as rotas da loja —
 * uma condição que é sempre verdadeira, escrita com passos extras.
 *
 * Então ela saiu. As dez rotas de `(loja)` abrem com `CabecalhoDePagina` ou com
 * uma seção `palco-noite` própria, e `not-found`/`error` moram no layout raiz,
 * que não renderiza este componente.
 *
 * ⚠️ A invariante é o que sustenta este arquivo, e ela NÃO se sustenta sozinha:
 * uma página nova que abrisse com fundo claro deixaria os links brancos
 * invisíveis. Por isso ela é provada por máquina, em
 * `src/test/abertura-da-loja.test.ts`, que varre `(loja)` e falha se alguma
 * página não abrir escuro. Não confie neste comentário; confie no teste.
 */
const LINKS = [
  { href: '/trekking', rotulo: 'Trekking' },
  { href: '/agenda', rotulo: 'Agenda' },
  { href: '/guia-particular', rotulo: 'Guia particular' },
  { href: '/wear', rotulo: 'Caqui Wear' },
  { href: '/sobre', rotulo: 'Sobre' },
  { href: '/contato', rotulo: 'Contato' },
] as const

const ALTURA = 'h-20'

export function Header() {
  const caminho = usePathname()

  /**
   * O fundo sólido é DERIVADO de ter rolado, e não um segundo estado a
   * sincronizar. Navegar entre páginas não depende de um efeito corrigir um
   * valor obsoleto: a sentinela remonta e o observer recalcula.
   */
  const [passouDoTopo, setPassouDoTopo] = useState(false)
  const solido = passouDoTopo

  // Sem fundo próprio, a tinta é clara — ver o bloco no topo do arquivo.
  const claro = !solido

  const [menuAberto, setMenuAberto] = useState(false)
  const sentinela = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const alvo = sentinela.current
    if (!alvo) return

    // `IntersectionObserver` e não um listener de scroll: o navegador avisa
    // quando o estado muda, em vez de o main thread perguntar a cada quadro.
    const observador = new IntersectionObserver(
      ([entrada]) => setPassouDoTopo(!entrada?.isIntersecting),
      { threshold: 0 },
    )

    observador.observe(alvo)
    return () => observador.disconnect()
    // Sem dependência de rota: a sentinela é remontada a cada navegação e o
    // observer volta a medir do zero.
  }, [])

  const fecharMenu = useCallback(() => setMenuAberto(false), [])

  /**
   * Fecha o menu ao trocar de página.
   *
   * Ajuste de estado DURANTE O RENDER, não num `useEffect`. É o padrão que o
   * próprio React documenta para "resetar estado quando uma prop muda": o
   * efeito faria o menu ser pintado uma vez sobre a página nova antes de
   * fechar, e ainda dispararia um render em cascata.
   *
   * Os links do menu já chamam `aoFechar` no clique; isto cobre o resto —
   * botão de voltar, link do rodapé dentro do menu, navegação programática.
   */
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho)
  if (caminho !== caminhoAnterior) {
    setCaminhoAnterior(caminho)
    setMenuAberto(false)
  }

  return (
    <>
      {/* Sentinela: 1px no topo do documento. Quando sai da tela, rolou. */}
      <div ref={sentinela} aria-hidden="true" className="h-px w-full" />

      <a
        href="#conteudo"
        className={cn(
          'sr-only focus:not-sr-only',
          'focus:bg-caqui-ink-900 focus:fixed focus:top-3 focus:left-3 focus:z-[60]',
          'focus:text-micro focus:px-4 focus:py-2 focus:font-mono focus:text-white focus:uppercase',
        )}
      >
        Pular para o conteúdo
      </a>

      <header
        className={cn(
          // `fixed` já é bloco de contenção para o fio de progresso lá
          // embaixo. Um `relative` junto NÃO seria redundante, seria um bug:
          // as duas utilitárias escrevem `position`, a ordem de quem vence é a
          // da folha gerada e não a da string, e `relative` vem depois de
          // `fixed` no Tailwind. O header descolaria do topo.
          'fixed inset-x-0 top-0 z-50',
          ALTURA,
          'transition-[background-color,border-color,box-shadow] duration-200',
          solido
            ? 'border-caqui-rule border-b bg-white/95 backdrop-blur-sm'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-5 sm:px-8">
          <LogoFantasma />

          <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 lg:flex">
            {LINKS.map((link) => {
              const ativo = caminho === link.href || caminho.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={cn(
                    'font-display text-corpo-sm relative px-3 py-2 uppercase',
                    'after:absolute after:inset-x-3 after:bottom-1 after:h-[3px] after:content-[""]',
                    'transition-colors',
                    // A barra do item ativo continua sendo laranja nos dois
                    // modos: ela é elemento de interface, e `orange-500` passa
                    // os 3:1 exigidos tanto sobre branco quanto sobre a noite.
                    ativo && 'after:bg-caqui-orange-500',
                    ativo && (claro ? 'text-white' : 'text-caqui-ink-900'),
                    !ativo &&
                      (claro
                        ? 'text-caqui-sand-200 after:bg-transparent hover:text-white hover:after:bg-white'
                        : 'text-caqui-ink-700 hover:text-caqui-ink-900 hover:after:bg-caqui-ink-900 after:bg-transparent'),
                  )}
                >
                  {link.rotulo}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-4">
            <BotaoCarrinho claro={claro} />

            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-xs transition-colors lg:hidden',
                claro
                  ? 'hover:bg-caqui-noite-700/60 text-white'
                  : 'text-caqui-ink-900 hover:bg-caqui-sand-100',
              )}
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
                <path
                  d="M2 5h16M2 10h16M2 15h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                />
              </svg>
            </button>
          </div>
        </div>

        <FioDeProgresso />
      </header>

      <MenuMobile aberto={menuAberto} aoFechar={fecharMenu} caminhoAtual={caminho} />
    </>
  )
}

/**
 * O fio de progresso de leitura.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ZERO JAVASCRIPT, E ISSO É O PONTO
 * ────────────────────────────────────────────────────────────────────────────
 * A implementação de reflexo seria um listener de rolagem calculando
 * `scrollY / (scrollHeight - innerHeight)` a cada evento. Isso lê `scrollHeight`
 * dentro do handler de scroll, que força cálculo de layout no momento mais caro
 * que existe, e é uma das receitas mais conhecidas de rolagem engasgada em
 * celular.
 *
 * `animation-timeline: scroll(root block)` faz a mesma conta no compositor, sem
 * passar pelo main thread. Ver o bloco `.fio-progresso` em globals.css.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELE NASCE VAZIO, NÃO CHEIO
 * ────────────────────────────────────────────────────────────────────────────
 * `scale-x-0` está aqui, na classe do elemento, e NÃO só dentro do `@supports`
 * do CSS. Sem suporte à linha do tempo de rolagem, o `transform` do keyframe
 * nunca é aplicado: sem esta classe o fio ficaria 100% preenchido e parado no
 * topo da página, dizendo a coisa errada. Com ela, ele fica invisível, que é a
 * degradação correta para um enfeite.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ELE NÃO É DESLIGADO EM `prefers-reduced-motion`
 * ────────────────────────────────────────────────────────────────────────────
 * O resto do site respeita `motion-safe:` à risca, e a diferença aqui é real:
 * as outras animações do projeto acontecem SOZINHAS, e é o movimento autônomo
 * que causa desconforto vestibular. Este fio não se move por conta própria em
 * momento nenhum. Ele acompanha a rolagem que a própria pessoa está fazendo,
 * na mesma direção e na mesma hora, como a barra de rolagem do navegador.
 * Desligá-lo tiraria uma informação de quem talvez mais se beneficie dela.
 *
 * `aria-hidden` porque ele não informa nada que o leitor de tela já não saiba:
 * a posição no documento é navegação, não conteúdo.
 */
function FioDeProgresso() {
  return (
    <div
      aria-hidden="true"
      className="fio-progresso bg-caqui-orange-500 pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0"
    />
  )
}

function BotaoCarrinho({ claro }: { claro: boolean }) {
  const { quantidadeTotal, pronto } = useCarrinho()
  const { abrir } = useMochila()

  return (
    <Link
      href="/carrinho"
      // CONTINUA sendo um link para `/carrinho`, e o clique é interceptado para
      // abrir o drawer. Não é firula: sem JavaScript, com o bundle ainda a
      // caminho, ou no clique do meio, ele leva à página de verdade. Um
      // `<button>` puro seria um ícone morto nos três casos — e a mochila é o
      // fim do funil.
      onClick={(evento) => {
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return
        evento.preventDefault()
        abrir()
      }}
      className={cn(
        'relative inline-flex size-11 items-center justify-center rounded-xs transition-colors',
        claro
          ? 'hover:bg-caqui-noite-700/60 text-white'
          : 'text-caqui-ink-900 hover:bg-caqui-sand-100',
      )}
      // O rótulo acessível carrega a quantidade: um leitor de tela que só
      // ouvisse "carrinho" perderia a única informação do ícone.
      aria-label={
        pronto && quantidadeTotal > 0
          ? `Sua mochila, ${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'}`
          : 'Sua mochila, vazia'
      }
    >
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true" fill="none">
        {/* Mochila, não sacola de supermercado: o vocabulário da Caqui é
            "sua mochila", e o ícone acompanha. */}
        <path
          d="M4 7.5h12v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M7 7.5V5a3 3 0 0 1 6 0v2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7.5 11.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
      </svg>

      {/* Só depois da hidratação: o servidor não tem localStorage, e renderizar
          um número aqui daria divergência entre o HTML e o cliente. */}
      {pronto && quantidadeTotal > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'bg-caqui-orange-500 text-caqui-ink-900 absolute top-1 right-0.5',
            'border-caqui-ink-900 min-w-5 border px-1 text-center',
            'font-mono text-[0.625rem] leading-4 font-medium',
          )}
        >
          {quantidadeTotal > 99 ? '99+' : quantidadeTotal}
        </span>
      )}
    </Link>
  )
}

/**
 * Menu de tela cheia, sobre `<dialog>`.
 *
 * Mesma escolha do Drawer (ver `components/ui/dialogo.tsx`): armadilha de foco,
 * Escape e camada superior saem do nativo. O que fica por nossa conta é travar
 * a rolagem do corpo — que o briefing pede explicitamente — e devolver o foco
 * ao hambúrguer no fechamento.
 */
function MenuMobile({
  aberto,
  aoFechar,
  caminhoAtual,
}: {
  aberto: boolean
  aoFechar: () => void
  caminhoAtual: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const gatilho = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return

    if (aberto && !dialogo.open) {
      gatilho.current = document.activeElement as HTMLElement | null
      dialogo.showModal()
      document.body.style.overflow = 'hidden'
    }

    if (!aberto && dialogo.open) {
      dialogo.close()
      document.body.style.overflow = ''
      gatilho.current?.focus()
    }
  }, [aberto])

  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <dialog
      ref={ref}
      onCancel={(evento) => {
        evento.preventDefault()
        aoFechar()
      }}
      aria-label="Menu"
      className="m-0 h-full max-h-none w-full max-w-none bg-white p-0"
    >
      <div className="flex h-full flex-col">
        <div className={cn('flex items-center justify-end px-5 sm:px-8', ALTURA)}>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar menu"
            className="text-caqui-ink-900 hover:bg-caqui-sand-100 inline-flex size-11 items-center justify-center rounded-xs transition-colors"
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              <path
                d="M4 4l12 12M16 4L4 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
              />
            </svg>
          </button>
        </div>

        <nav aria-label="Principal" className="flex flex-1 flex-col justify-center px-5 sm:px-8">
          {LINKS.map((link, indice) => {
            const ativo = caminhoAtual === link.href || caminhoAtual.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={ativo ? 'page' : undefined}
                onClick={aoFechar}
                // Escalonamento. `motion-safe:` e não uma regra de
                // reduced-motion depois: sem animação nenhuma, o item nasce
                // visível, sem depender de `animation-fill-mode`.
                style={{ animationDelay: `${indice * 55}ms` }}
                className={cn(
                  'text-caqui-ink-900 flex items-baseline gap-4 border-b py-5',
                  'font-display text-display-l uppercase',
                  'motion-safe:animate-[caqui-entrada_320ms_var(--ease-saida)_both]',
                  // O item ativo é marcado pela BARRA, não pela cor do texto —
                  // igual ao desktop, e sem trocar ink-900 (19,44:1) por um
                  // laranja que só passaria por ser texto grande.
                  ativo ? 'border-caqui-orange-500 border-b-[3px]' : 'border-caqui-rule',
                )}
              >
                <span className="text-caqui-ink-500 text-micro font-mono">
                  {String(indice + 1).padStart(2, '0')}
                </span>
                {link.rotulo}
              </Link>
            )
          })}
        </nav>

        <p className="text-caqui-ink-500 text-micro px-5 pb-8 font-mono uppercase sm:px-8">
          Ecoturismo aventura · Mogi das Cruzes · SP
        </p>
      </div>
    </dialog>
  )
}
