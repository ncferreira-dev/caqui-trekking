'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * A navegação do painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NO CELULAR ELA FICA EMBAIXO. NÃO É ADAPTAÇÃO — É O CENÁRIO PRINCIPAL.
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing é explícito: a Caqui vai mexer nisto do telefone, no meio do dia,
 * entre uma conversa e outra do WhatsApp. Menu hambúrguer no topo custa dois
 * toques e obriga a esticar o polegar até o canto mais distante da tela —
 * numa mão só, segurando o celular, geralmente em pé.
 *
 * Barra inferior fixa: um toque, na zona onde o polegar já está. É por isso
 * que todo aplicativo que se usa em movimento tem barra embaixo.
 *
 * Em `lg` ela vira coluna à esquerda, onde há espaço e o mouse não tem
 * preferência de altura.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SEIS ITENS É O TETO
 * ────────────────────────────────────────────────────────────────────────────
 * Numa tela de 375px, seis alvos deixam 62px cada — acima dos 44px mínimos.
 * O sétimo item ou espreme tudo ou vira "mais…", que é o mesmo hambúrguer com
 * outro nome. Se um dia precisar de um sétimo, ele entra dentro de uma seção,
 * não na barra.
 */

export type ItemDeNavegacao = {
  href: string
  rotulo: string
  /** Rótulo curto para a barra do celular, onde cabem ~9 caracteres. */
  curto: string
  icone: ReactNode
  /** Aparece só para OWNER. */
  soOwner?: boolean
  /** Número no canto — mensagens não lidas, por exemplo. */
  contador?: number
}

export function Navegacao({
  itens,
  papel,
}: {
  itens: ItemDeNavegacao[]
  papel: 'OWNER' | 'ADMIN'
}) {
  const caminho = usePathname()

  // Esconder item que a pessoa não pode usar é CORTESIA, não barreira: o
  // `fetch` continua chamável do console, e quem barra é o guard da API.
  // O valor aqui é não oferecer um caminho que termina em 403.
  const visiveis = itens.filter((i) => !i.soOwner || papel === 'OWNER')

  return (
    <>
      {/* ── Celular: barra inferior fixa ────────────────────────────────── */}
      <nav
        aria-label="Seções do painel"
        className={cn(
          'border-caqui-ink-900 fixed inset-x-0 bottom-0 z-40 border-t bg-white lg:hidden',
          // O indicador de home do iPhone come a faixa de baixo.
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <ul className="flex">
          {visiveis.map((item) => (
            <li key={item.href} className="flex-1">
              <Item item={item} caminho={caminho} compacto />
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Desktop: coluna à esquerda ──────────────────────────────────── */}
      <nav
        aria-label="Seções do painel"
        className="border-caqui-rule hidden w-56 shrink-0 border-r bg-white lg:block"
      >
        <ul className="sticky top-0 flex flex-col gap-0.5 p-3">
          {visiveis.map((item) => (
            <li key={item.href}>
              <Item item={item} caminho={caminho} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

function Item({
  item,
  caminho,
  compacto = false,
}: {
  item: ItemDeNavegacao
  caminho: string
  compacto?: boolean
}) {
  // `startsWith` para a seção continuar marcada dentro de uma subpágina —
  // `/crm/saidas/12` ainda é "Saídas". A comparação exata deixaria a barra sem
  // nenhum item aceso justo quando a pessoa está mais fundo na navegação.
  const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`)

  return (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'relative flex items-center transition-colors',
        compacto
          ? 'min-h-14 flex-col justify-center gap-0.5 px-1'
          : 'text-corpo-sm min-h-11 gap-2.5 rounded-xs px-3',
        ativo
          ? compacto
            ? 'text-caqui-ink-900'
            : 'bg-caqui-ink-900 text-white'
          : 'text-caqui-ink-500 hover:text-caqui-ink-900 hover:bg-caqui-sand-100',
      )}
    >
      {/* No celular o item ativo é marcado por uma barra laranja no topo, não
          por fundo preto: fundo cheio num alvo de 62px vira um bloco escuro
          brigando com o conteúdo logo acima. */}
      {compacto && ativo && (
        <span aria-hidden="true" className="bg-caqui-orange-500 absolute inset-x-2 top-0 h-0.5" />
      )}

      <span className="relative">
        {item.icone}
        {item.contador !== undefined && item.contador > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'bg-caqui-orange-500 text-caqui-ink-900 border-caqui-ink-900 absolute',
              '-top-1.5 -right-2 min-w-4 border px-0.5 text-center',
              'font-mono text-[0.5625rem] leading-[0.875rem] font-medium',
            )}
          >
            {item.contador > 99 ? '99+' : item.contador}
          </span>
        )}
      </span>

      <span className={cn(compacto ? 'font-mono text-[0.625rem] uppercase' : 'flex-1')}>
        {compacto ? item.curto : item.rotulo}
      </span>

      {/* O contador precisa chegar a quem ouve a página, não só a quem vê. */}
      {item.contador !== undefined && item.contador > 0 && (
        <span className="sr-only">, {item.contador} não lidas</span>
      )}
    </Link>
  )
}
