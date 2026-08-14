'use client'

import { Modal } from '@/components/ui/dialogo'

/**
 * A tabela de medidas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELA É A DEFESA CONTRA A TROCA — E O SITE NÃO TEM LOGÍSTICA DE TROCA
 * ────────────────────────────────────────────────────────────────────────────
 * Numa loja com checkout, tamanho errado vira um pedido de troca e um custo de
 * frete. Aqui vira uma conversa constrangida no WhatsApp com alguém que já
 * pagou por Pix. Cinco linhas de tabela evitam a maior parte disso.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * OS NÚMEROS SÃO DA PEÇA, NÃO DO CORPO
 * ────────────────────────────────────────────────────────────────────────────
 * "Busto 96 cm" é ambíguo: é o meu busto ou o da camiseta? A tabela mede a
 * PEÇA ESTENDIDA, que é o que dá para conferir contra uma camiseta que a
 * pessoa já tem em casa — o método mais confiável que existe para comprar
 * roupa sem provar.
 *
 * ⚠️ VALORES DE REFERÊNCIA, NÃO MEDIDOS.
 * A Caqui ainda não passou a medição das peças reais. Estes são valores
 * padrão de malha dry fit brasileira, e estão marcados como aproximados na
 * própria tela. Quando as medidas reais chegarem, viram campo no CRM — hoje
 * elas não existem no schema. Ver docs/09-wear-carrinho.md.
 */

type Linha = { tamanho: string; largura: string; altura: string }

const CAMISETA: Linha[] = [
  { tamanho: 'PP', largura: '46', altura: '66' },
  { tamanho: 'P', largura: '49', altura: '69' },
  { tamanho: 'M', largura: '52', altura: '72' },
  { tamanho: 'G', largura: '55', altura: '74' },
  { tamanho: 'GG', largura: '58', altura: '76' },
  { tamanho: 'XG', largura: '61', altura: '78' },
]

export function TabelaDeMedidas({
  aberta,
  aoFechar,
  categoria,
}: {
  aberta: boolean
  aoFechar: () => void
  categoria: string
}) {
  // Caneca, óculos e acessório não têm grade de tamanho. Abrir uma tabela de
  // busto para um par de óculos seria pior que não ter tabela.
  const temGrade = categoria === 'CAMISETA' || categoria === 'REGATA'

  return (
    <Modal aberto={aberta} aoFechar={aoFechar} titulo="Tabela de medidas">
      {temGrade ? (
        <div className="flex flex-col gap-4">
          <p className="text-corpo-sm">
            As medidas são da <strong>peça estendida</strong>, não do corpo. O jeito mais seguro de
            acertar é medir uma camiseta que você já tem e comparar.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Medidas aproximadas da peça estendida, em centímetros
              </caption>
              <thead>
                <tr className="border-caqui-ink-900 border-b">
                  <th scope="col" className="text-rotulo py-2 pr-4 font-mono uppercase">
                    Tam
                  </th>
                  <th scope="col" className="text-rotulo py-2 pr-4 font-mono uppercase">
                    Largura
                  </th>
                  <th scope="col" className="text-rotulo py-2 font-mono uppercase">
                    Comprimento
                  </th>
                </tr>
              </thead>
              <tbody>
                {CAMISETA.map((linha) => (
                  <tr key={linha.tamanho} className="border-caqui-rule border-b last:border-b-0">
                    <th scope="row" className="text-dado py-2.5 pr-4 font-mono font-medium">
                      {linha.tamanho}
                    </th>
                    <td className="text-dado py-2.5 pr-4 font-mono">
                      {linha.largura}
                      <span className="text-caqui-ink-500 text-micro ml-0.5">cm</span>
                    </td>
                    <td className="text-dado py-2.5 font-mono">
                      {linha.altura}
                      <span className="text-caqui-ink-500 text-micro ml-0.5">cm</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-caqui-orange-500 text-corpo-sm bg-caqui-sand-100 border-l-4 px-3 py-2">
            <strong className="font-display text-corpo-sm uppercase">Aproximado.</strong> Variação
            de até 2 cm é normal em malha. Na dúvida entre dois tamanhos, chame no WhatsApp antes de
            fechar. É mais rápido que trocar depois.
          </p>
        </div>
      ) : (
        <p className="text-corpo">
          Esta peça é de tamanho único. Se tiver dúvida sobre dimensões ou capacidade, chame no
          WhatsApp. A Caqui mede e responde.
        </p>
      )}
    </Modal>
  )
}
