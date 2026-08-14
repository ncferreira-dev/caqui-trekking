import type { Metadata } from 'next'

/**
 * Casca do CRM.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `noindex`, E NÃO UMA LINHA NO `robots.txt`
 * ────────────────────────────────────────────────────────────────────────────
 * O projeto de referência escondia o painel atrás de 5 cliques no copyright e
 * listava `/login`, `/dashboard`, `/clients` e `/admin/` no `robots.txt` —
 * um arquivo público, servido na raiz, que qualquer pessoa abre. O efeito
 * prático de "esconder" ali é o oposto: vira um índice do que existe.
 *
 * `noindex` mantém a página fora do buscador sem publicar o caminho.
 *
 * E vale o de sempre: nada disto é segurança. A barreira é o guard no
 * servidor, em toda rota, com teste que falha se alguma nascer sem ele.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE UM GRUPO DE ROTAS SEPARADO
 * ────────────────────────────────────────────────────────────────────────────
 * `(crm)` e `(loja)` têm layouts independentes, então o Next separa os chunks:
 * quem entra na loja não baixa o código do painel. No projeto de referência,
 * 61% do `src/` era CRM e ia no mesmo bundle de 811 KB que a visitante baixava
 * para ver um produto — e, num site cujo painel é revelado por um gesto
 * secreto, entregar o código dele a todo mundo anula o gesto.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// `LayoutProps<'/'>` e não `<'/crm'>`: grupo de rota não vira segmento de URL,
// então este layout vive na raiz — o `(crm)` só existe na árvore de arquivos.
export default function LayoutCrm({ children }: LayoutProps<'/'>) {
  return <div className="bg-caqui-sand-100 flex min-h-full flex-1 flex-col">{children}</div>
}
