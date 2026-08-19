import { Rotulo, Vazio } from '@/components/crm/pecas'
import { dataCurta, horaLocal } from '@/lib/datetime'

/**
 * O que mudou no sistema, e por quem.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A TRILHA EXISTIA DESDE O PRIMEIRO DIA E NUNCA FOI LIDA
 * ────────────────────────────────────────────────────────────────────────────
 * Toda escrita administrativa grava uma linha em `AuditLog` com autor, IP,
 * antes e depois, dentro da mesma transação da mudança. Vinte e seis ações
 * diferentes. Nenhuma tela mostrava nada disso.
 *
 * O resultado prático: "quem mudou o preço dessa saída?" e "por que essa peça
 * sumiu da loja?" tinham resposta gravada e inalcançável. Uma auditoria que
 * ninguém consegue ler é o mesmo custo de escrita com zero do benefício.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SERVIDOR PURO, SEM UM BYTE DE JAVASCRIPT
 * ────────────────────────────────────────────────────────────────────────────
 * É uma lista que não muda enquanto se olha para ela. O detalhe de cada linha
 * abre com `<details>`, que o navegador já sabe fazer. Nada aqui precisa
 * hidratar.
 */

/**
 * O que a ação FEZ, em português. A chave crua é o contrato, não o texto.
 *
 * Ação sem tradução aqui não some da tela: ela aparece com a chave crua, que é
 * pior de ler e infinitamente melhor que uma linha em branco. `travas-do-crm`
 * varre o servidor e falha quando alguém acrescenta uma ação e esquece daqui.
 *
 * Chaves de versões antigas (`departure.availability`, renomeada para
 * `departure.disponibilidade`) continuam no banco e continuam caindo no
 * fallback — histórico não se reescreve para agradar a uma tabela nova.
 */
export const ACOES: Record<string, string> = {
  'catalogo.reordenar': 'reordenou a vitrine',
  'departure.cancel': 'cancelou a saída',
  'departure.create': 'criou a saída',
  'departure.delete': 'excluiu a saída',
  'departure.disponibilidade': 'mudou o selo da saída',
  'departure.duplicate': 'duplicou a saída',
  'departure.fechar': 'fechou a saída',
  'departure.refechar': 'corrigiu o fechamento',
  'departure.update': 'editou a saída',
  'departure.vagas': 'lançou vagas',
  'guide.archive': 'arquivou o guia',
  'guide.create': 'cadastrou o guia',
  'guide.update': 'editou o guia',
  'media.alt': 'mudou o texto alternativo',
  'media.cor': 'ligou a foto a uma cor',
  'media.delete': 'apagou a imagem',
  'media.reorder': 'reordenou as imagens',
  'media.upload': 'subiu a imagem',
  'product.archive': 'arquivou a peça',
  'product.create': 'cadastrou a peça',
  'product.update': 'editou a peça',
  'settings.update': 'mudou as configurações',
  'tag.create': 'criou a atividade',
  'tag.delete': 'apagou a atividade',
  'tag.update': 'renomeou a atividade',
  'trip.archive': 'arquivou o roteiro',
  'trip.create': 'criou o roteiro',
  'trip.update': 'editou o roteiro',
  'user.update': 'mudou um acesso',
  'variant.toggle': 'mudou a disponibilidade da variante',
}

const ENTIDADES: Record<string, string> = {
  Trip: 'roteiro',
  Departure: 'saída',
  Product: 'peça',
  ProductVariant: 'variante',
  SiteSetting: 'configuração',
  Guide: 'guia',
  User: 'acesso',
  MediaAsset: 'imagem',
  ActivityTag: 'atividade',
}

export type LinhaDaTrilha = {
  id: number
  acao: string
  entidade: string
  entidadeId: string
  quem: string | null
  quandoIso: string
  antes: unknown
  depois: unknown
}

export function TrilhaDeAuditoria({ linhas }: { linhas: LinhaDaTrilha[] }) {
  if (linhas.length === 0) {
    return (
      <Vazio titulo="Nada registrado ainda">
        <p>Toda mudança feita pelo painel aparece aqui, com quem fez e quando.</p>
      </Vazio>
    )
  }

  return (
    <ul className="divide-caqui-rule divide-y">
      {linhas.map((l) => {
        const quando = new Date(l.quandoIso)
        // Ação desconhecida não vira linha vazia: mostra a chave crua, que é
        // pior de ler e melhor que sumir. Toda ação nova nasce assim até
        // alguém escrever a tradução em ACOES.
        const oQue = ACOES[l.acao] ?? l.acao
        const alvo = ENTIDADES[l.entidade] ?? l.entidade

        return (
          <li key={l.id} className="px-4 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-corpo-sm">
                <strong>{l.quem ?? 'Sistema'}</strong> {oQue}
              </span>
              <Rotulo>
                {alvo} #{l.entidadeId}
              </Rotulo>
              <span className="text-caqui-ink-500 text-micro ml-auto font-mono">
                {dataCurta(quando)} {horaLocal(quando)}
              </span>
            </div>

            {(l.antes !== null || l.depois !== null) && (
              <details className="text-micro mt-1 font-mono">
                <summary className="text-caqui-ink-500 hover:text-caqui-ink-900 inline-flex min-h-11 cursor-pointer items-center uppercase">
                  Ver o que mudou
                </summary>
                <div className="text-caqui-ink-700 mt-1 grid gap-2 sm:grid-cols-2">
                  <Lado titulo="Antes" valor={l.antes} />
                  <Lado titulo="Depois" valor={l.depois} />
                </div>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Lado({ titulo, valor }: { titulo: string; valor: unknown }) {
  return (
    <div>
      <p className="text-caqui-ink-500 uppercase">{titulo}</p>
      <pre className="border-caqui-rule bg-caqui-sand-100 overflow-x-auto border p-2 whitespace-pre-wrap">
        {valor === null || valor === undefined ? '(vazio)' : JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  )
}
