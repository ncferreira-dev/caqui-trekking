'use client'

import { Finalizar } from '@/components/carrinho/finalizar'
import { ListaDaMochila } from '@/components/carrinho/lista'
import { useMochila } from '@/components/carrinho/contexto'
import { Button, LinkBotao } from '@/components/ui/button'
import { Carregando, Esqueleto } from '@/components/ui/esqueleto'
import { useCarrinho } from '@/lib/carrinho/store'
import { useValidacao } from '@/lib/carrinho/validacao'
import { formatarBRL } from '@/lib/money'

/**
 * O corpo da mochila, usado pelo drawer E pela página.
 *
 * Um componente só para os dois porque são a mesma coisa em dois tamanhos —
 * duplicar significaria manter duas versões da revalidação, do agrupamento e do
 * handoff, e a segunda sempre fica para trás.
 */
export function ConteudoDaMochila({ compacta = false }: { compacta?: boolean }) {
  const { itens, quantidadeTotal, pronto, limpar } = useCarrinho()
  const { whatsapp, template, fechar } = useMochila()

  // `pronto` é falso no HTML do servidor. Validar antes disso pediria a
  // conferência de um carrinho que ainda não foi lido.
  const { resultado, carregando, erro, revalidar } = useValidacao(itens, pronto)

  if (!pronto || (carregando && !resultado)) {
    return (
      <Carregando descricao="Conferindo sua mochila" className="flex flex-col gap-4">
        <Esqueleto className="h-5 w-40" />
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
      </Carregando>
    )
  }

  if (itens.length === 0) return <MochilaVazia aoFechar={compacta ? fechar : undefined} />

  if (erro) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="border-caqui-danger text-corpo border-l-4 px-4 py-3">
          {erro} Seus itens continuam guardados — é só a conferência de preço e disponibilidade que
          não respondeu.
        </p>
        <Button onClick={revalidar}>Tentar de novo</Button>
      </div>
    )
  }

  if (!resultado) return null

  return (
    <div className="flex flex-col gap-6">
      <ListaDaMochila itens={resultado.itens} compacta={compacta} />

      <div className="border-caqui-rule-forte flex items-baseline justify-between border-t pt-4">
        <span className="text-rotulo font-mono uppercase">
          Total · {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}
        </span>
        {/* O total é o do SERVIDOR. Somar aqui criaria um segundo número
            possível para a mesma pergunta. */}
        <span className="preco">{formatarBRL(resultado.totalCentavos)}</span>
      </div>

      <Finalizar resultado={resultado} whatsapp={whatsapp} template={template} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {compacta ? (
          <LinkBotao href="/carrinho" variante="ghost" tamanho="sm" onClick={fechar}>
            Ver a mochila inteira
          </LinkBotao>
        ) : (
          <LinkBotao href="/agenda" variante="ghost" tamanho="sm">
            Continuar escolhendo
          </LinkBotao>
        )}

        <button
          type="button"
          onClick={limpar}
          className="text-caqui-ink-500 hover:text-caqui-danger text-micro rounded-xs font-mono uppercase transition-colors"
        >
          Esvaziar mochila
        </button>
      </div>
    </div>
  )
}

function MochilaVazia({ aoFechar }: { aoFechar?: (() => void) | undefined }) {
  return (
    <div className="flex flex-col items-start gap-6">
      <p className="text-caqui-ink-700 text-corpo-lg">
        Sua mochila está vazia. Escolha uma data na agenda ou uma peça na Caqui Wear.
      </p>
      <div className="flex flex-wrap gap-4">
        <LinkBotao href="/agenda" {...(aoFechar ? { onClick: aoFechar } : {})}>
          Ver a agenda
        </LinkBotao>
        <LinkBotao href="/wear" variante="secondary" {...(aoFechar ? { onClick: aoFechar } : {})}>
          Ver a Caqui Wear
        </LinkBotao>
      </div>
    </div>
  )
}
