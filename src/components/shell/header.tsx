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
 * POR QUE A LISTA DE ROTAS COM HERÓI É EXPLÍCITA
 * ────────────────────────────────────────────────────────────────────────────
 * O header é transparente sobre o herói e ganha fundo ao rolar. Descobrir se a
 * página TEM herói só depois da hidratação — procurando um elemento no DOM —
 * produziria um quadro de header sólido sobre o herói antes de o efeito rodar.
 * Em conexão lenta, esse "quadro" dura o tempo do bundle.
 *
 * `usePathname()` é conhecido no servidor, então o HTML já sai com o modo
 * certo. O preço é esta constante precisar de uma linha quando uma página nova
 * ganhar herói — um acoplamento pequeno, explícito e revisável, em troca de
 * zero salto visual.
 */
const ROTAS_COM_HEROI = new Set(['/'])

const LINKS = [
  { href: '/trekking', rotulo: 'Trekking' },
  { href: '/agenda', rotulo: 'Agenda' },
  { href: '/wear', rotulo: 'Caqui Wear' },
  { href: '/sobre', rotulo: 'Sobre' },
  { href: '/contato', rotulo: 'Contato' },
] as const

const ALTURA = 'h-20'

export function Header() {
  const caminho = usePathname()
  const sobreHeroi = ROTAS_COM_HEROI.has(caminho)

  /**
   * `passouDoTopo` só tem sentido em página com herói. O fundo sólido é
   * DERIVADO, não um segundo estado a sincronizar — assim, navegar de `/` para
   * `/agenda` não depende de um efeito corrigir um valor obsoleto.
   */
  const [passouDoTopo, setPassouDoTopo] = useState(false)
  const solido = !sobreHeroi || passouDoTopo

  const [menuAberto, setMenuAberto] = useState(false)
  const sentinela = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sobreHeroi) return

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
  }, [sobreHeroi])

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
      {sobreHeroi && <div ref={sentinela} aria-hidden="true" className="h-px w-full" />}

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
                    ativo
                      ? 'text-caqui-ink-900 after:bg-caqui-orange-500'
                      : 'text-caqui-ink-700 hover:text-caqui-ink-900 hover:after:bg-caqui-ink-900 after:bg-transparent',
                  )}
                >
                  {link.rotulo}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-4">
            <BotaoCarrinho />

            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              className={cn(
                'text-caqui-ink-900 inline-flex size-11 items-center justify-center lg:hidden',
                'hover:bg-caqui-sand-100 rounded-xs transition-colors',
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
      </header>

      {/* Empurra o conteúdo nas páginas SEM herói. Com herói, o conteúdo passa
          por baixo do header transparente de propósito. */}
      {!sobreHeroi && <div aria-hidden="true" className={ALTURA} />}

      <MenuMobile aberto={menuAberto} aoFechar={fecharMenu} caminhoAtual={caminho} />
    </>
  )
}

function BotaoCarrinho() {
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
        'text-caqui-ink-900 relative inline-flex size-11 items-center justify-center',
        'hover:bg-caqui-sand-100 rounded-xs transition-colors',
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
