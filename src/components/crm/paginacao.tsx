import Link from 'next/link'

import type { Fatia } from '@/lib/crm/paginacao'
import { cn } from '@/lib/ui/cn'

/**
 * O rodapé de paginação.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A CONTAGEM APARECE SEMPRE. AS SETAS, SÓ QUANDO HÁ PARA ONDE IR
 * ────────────────────────────────────────────────────────────────────────────
 * "13 de 13" numa tela sem setas parece redundante e não é: é a frase que
 * garante que nada ficou de fora. O defeito que este componente existe para
 * matar não é a falta de navegação, é o TETO MUDO — a tela que corta em 100 e
 * não conta.
 *
 * Links, e não botões: a página vive na URL, então o histórico funciona, o
 * link é compartilhável e a tela se comporta igual antes e depois da
 * hidratação. Zero JavaScript.
 */
export function Paginacao({
  fatia,
  href,
  itens,
}: {
  fatia: Fatia
  /** Monta o endereço de uma página preservando o resto da query. */
  href: (pagina: number) => string
  /**
   * O nome no PLURAL: "saídas", "peças", "mensagens".
   *
   * Plural e não singular por causa de gênero. A primeira versão montava
   * "Nenhum ${singular}" e imprimia "Nenhum mensagem" e "Nenhum peça" — o tipo
   * de erro que passa em revisão de código porque quem revisa lê o template,
   * não a frase montada. Com "0 mensagens" e "0 peças" não existe concordância
   * para errar.
   */
  itens: string
}) {
  return (
    <nav
      aria-label={`Páginas de ${itens}`}
      className="border-caqui-rule flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5"
    >
      <p className="text-caqui-ink-500 text-micro font-mono uppercase">
        {fatia.total === 0 ? `0 ${itens}` : `${fatia.primeiro} a ${fatia.ultimo} de ${fatia.total}`}
      </p>

      {fatia.paginas > 1 && (
        <div className="flex items-center gap-2">
          <Salto
            href={href(fatia.pagina - 1)}
            ativo={fatia.temAnterior}
            rotulo={`Página anterior de ${itens}`}
            sentido="anterior"
          />
          <span className="text-caqui-ink-700 text-micro font-mono">
            {fatia.pagina} / {fatia.paginas}
          </span>
          <Salto
            href={href(fatia.pagina + 1)}
            ativo={fatia.temSeguinte}
            rotulo={`Próxima página de ${itens}`}
            sentido="seguinte"
          />
        </div>
      )}
    </nav>
  )
}

/**
 * Na ponta da lista o controle vira `<span>`, e não um link desabilitado.
 *
 * `<a>` sem `href` não é focável e não é anunciado como controle; um link que
 * aponta para a página atual manda a pessoa para lugar nenhum. Um `<span>` com
 * `aria-hidden` some da navegação por teclado, que é o comportamento honesto
 * para algo que não faz nada.
 */
function Salto({
  href,
  ativo,
  rotulo,
  sentido,
}: {
  href: string
  ativo: boolean
  rotulo: string
  sentido: 'anterior' | 'seguinte'
}) {
  const desenho = (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d={sentido === 'anterior' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} strokeLinecap="square" />
    </svg>
  )

  const forma = 'inline-flex size-11 items-center justify-center border'

  if (!ativo) {
    return (
      <span
        aria-hidden="true"
        className={cn(forma, 'border-caqui-rule text-caqui-ink-500 opacity-30')}
      >
        {desenho}
      </span>
    )
  }

  return (
    <Link
      href={href}
      rel={sentido === 'anterior' ? 'prev' : 'next'}
      aria-label={rotulo}
      className={cn(
        forma,
        'border-caqui-rule text-caqui-ink-700 hover:bg-caqui-ink-900 transition-colors hover:text-white',
        'focus-visible:ring-caqui-ink-900 focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      {desenho}
    </Link>
  )
}
