import Link from 'next/link'

import {
  IconeAjustes,
  IconeCalendario,
  IconeCamiseta,
  IconeMensagem,
  IconePainel,
  IconeTrilha,
} from '@/components/crm/icones'
import { Navegacao, type ItemDeNavegacao } from '@/components/crm/navegacao'
import { BotaoSair } from '@/components/crm/sair'
import { Brasao } from '@/components/marca/grafismos'
import { ProvedorDeToast } from '@/components/ui/toast'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

/**
 * A casca do painel autenticado.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `(painel)` É GRUPO DE ROTA: NÃO VIRA SEGMENTO DE URL
 * ────────────────────────────────────────────────────────────────────────────
 * `/crm` continua sendo o login, com layout próprio (sem sidebar — pedir para
 * entrar dentro de um painel é absurdo). Tudo dentro de `(painel)` herda esta
 * casca: `/crm/painel`, `/crm/saidas`, `/crm/roteiros`, `/crm/produtos`,
 * `/crm/mensagens`, `/crm/config`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O GUARD AQUI É NAVEGAÇÃO, NÃO SEGURANÇA
 * ────────────────────────────────────────────────────────────────────────────
 * `exigirSessaoDaPagina()` manda para o login quando a sessão caiu, para a
 * pessoa não encarar um painel que vai levar 401 em toda requisição. Quem
 * protege DADO é o `exigirPapel` de cada rota `/api/admin/*`, com a tabela de
 * `src/server/autorizacao.ts` provando rota a rota. Ver o comentário de
 * `server/crm/sessao-da-pagina.ts`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DENSO, E COM O CELULAR COMO CENÁRIO PRINCIPAL
 * ────────────────────────────────────────────────────────────────────────────
 * Sem herói, sem respiro generoso, sem animação de entrada. Aqui a prioridade
 * é velocidade de operação: a Caqui abre isto entre duas conversas de
 * WhatsApp, com uma mão, para mudar uma disponibilidade. A navegação fica na
 * base da tela no celular — ver `components/crm/navegacao.tsx`.
 */
// `LayoutProps<'/crm'>` e não `<'/'>`: grupo de rota não vira segmento, então
// este layout vive em `/crm` — o `(painel)` só existe na árvore de arquivos.
// O layout de `(crm)` continua em `<'/'>` porque aquele está na raiz.
export default async function LayoutPainel({ children }: LayoutProps<'/crm'>) {
  const usuario = await exigirSessaoDaPagina()

  // O contador de não lidas fica no layout porque aparece na navegação, que é
  // do layout. Uma consulta por navegação de página — é um `COUNT` com índice.
  const naoLidas = await prisma.contactMessage.count({ where: { read: false } })

  const itens: ItemDeNavegacao[] = [
    { href: '/crm/painel', rotulo: 'Painel', curto: 'Painel', icone: <IconePainel /> },
    { href: '/crm/saidas', rotulo: 'Saídas', curto: 'Saídas', icone: <IconeCalendario /> },
    { href: '/crm/roteiros', rotulo: 'Roteiros', curto: 'Roteiros', icone: <IconeTrilha /> },
    { href: '/crm/produtos', rotulo: 'Produtos', curto: 'Wear', icone: <IconeCamiseta /> },
    {
      href: '/crm/mensagens',
      rotulo: 'Mensagens',
      curto: 'Caixa',
      icone: <IconeMensagem />,
      contador: naoLidas,
    },
    { href: '/crm/config', rotulo: 'Configurações', curto: 'Config', icone: <IconeAjustes /> },
  ]

  return (
    // O provedor de avisos envolve o painel inteiro: toda ação daqui — mudar
    // disponibilidade, duplicar, cancelar, salvar — devolve retorno por toast,
    // e a região viva precisa existir no DOM antes da primeira mensagem.
    <ProvedorDeToast>
      <div className="flex min-h-svh flex-col bg-white">
        {/* Cabeçalho e abas viajam JUNTOS no `sticky`. Separados, a barra de
            abas rolaria para fora e a pessoa perderia a troca de seção no meio
            de uma lista longa — que é exatamente onde ela quer trocar. */}
        <header className="border-caqui-ink-900 sticky top-0 z-30 border-b bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            {/* O BRASÃO É O CAMINHO DE VOLTA PARA O SITE.
                Pedido do cliente em 20/08/2026, e é a convenção que todo mundo
                já traz de fora: logo no canto leva para casa.
                Antes existia só um "Ver o site" no rodapé, e ele era
                `lg:block` — ou seja, quem estava no celular, que é o cenário
                principal deste painel, não tinha caminho de volta nenhum. */}
            <Link
              href="/"
              className="hover:bg-caqui-sand-100 -mx-1 flex items-center gap-2.5 rounded-xs px-1 py-0.5 transition-colors"
            >
              <Brasao className="w-8" titulo="" />
              <div className="leading-tight">
                <p className="font-display text-corpo-sm uppercase">Painel</p>
                <p className="text-caqui-ink-500 text-micro font-mono uppercase">Caqui Trekking</p>
              </div>
              {/* O texto visível diz onde a pessoa ESTÁ; o link leva para outro
                  lugar. Sem esta linha, quem navega por leitor de tela ouve
                  "Painel, Caqui Trekking, link" e não tem como saber que ele
                  sai do painel. */}
              <span className="sr-only">, ver o site</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-corpo-sm">{usuario.nome}</p>
                <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                  {usuario.role === 'OWNER' ? 'Dono' : 'Equipe'}
                </p>
              </div>
              <BotaoSair nome={usuario.nome} />
            </div>
          </div>

          {/* No desktop, as abas. No celular, este componente só monta a barra
              inferior `fixed`, que não ocupa espaço aqui. */}
          <Navegacao itens={itens} papel={usuario.role} />
        </header>

        {/* `pb-20` SÓ no celular: a barra inferior é `fixed` e cobriria a
          última linha da tabela, que é justamente onde ficam os botões de
          ação. De `sm` para cima a barra não existe mais — quem navega é o
          hambúrguer ou as abas — e reservar a faixa deixaria um rodapé vazio
          de 80px em toda página. */}
        <main className="min-w-0 flex-1 px-4 pt-4 pb-20 sm:pb-6 lg:px-6">{children}</main>

        {/* O "Ver o site" que ficava aqui saiu em 20/08/2026: o brasão do
            cabeçalho faz a mesma coisa, em todas as larguras, e dois caminhos
            para o mesmo lugar num painel deste tamanho é ruído. */}
      </div>
    </ProvedorDeToast>
  )
}
