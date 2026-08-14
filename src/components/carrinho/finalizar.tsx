'use client'

import { classesDeBotao } from '@/components/ui/button'
import { eventoFinalizarNoWhatsApp } from '@/lib/analytics'
import { itensQueVaoNaMensagem, montarMensagem } from '@/lib/carrinho/mensagem'
import { linkWhatsApp } from '@/lib/formato'
import type { ResultadoValidacao } from '@/server/services/cart-service'

/**
 * O handoff para o WhatsApp — onde o projeto inteiro se resolve.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UM BOTÃO. A MENSAGEM NÃO APARECE NA TELA.
 * ────────────────────────────────────────────────────────────────────────────
 * A primeira versão mostrava a mensagem inteira num `<pre>`, com botão de
 * copiar e o número em texto, "caso o WhatsApp Web não abra". A intenção era
 * defensiva; o resultado era o contrário do que a tela precisa fazer.
 *
 * Três coisas quebravam:
 *
 *  1. **O pedido aparecia duas vezes.** A mochila logo acima já lista item,
 *     quantidade e total. Repetir tudo embaixo, formatado com asterisco e
 *     emoji, faz a pessoa reler para conferir se são o mesmo pedido.
 *  2. **"Copie o número e mande do celular" transfere o trabalho.** Quem
 *     chegou até aqui já decidiu comprar; pedir para copiar e colar à mão é
 *     onde a compra morre.
 *  3. **Dois caminhos competindo enfraquecem os dois.** Com um botão laranja e
 *     uma caixa branca de copiar embaixo, nenhum dos dois é "o" jeito de
 *     finalizar, e a tela deixa de ter uma ação óbvia.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `wa.me` RESOLVE OS DOIS CASOS SOZINHO
 * ────────────────────────────────────────────────────────────────────────────
 * Era o medo que justificava o plano B: `wa.me` no desktop cairia numa tela de
 * instalação. Não é o que acontece — o `wa.me` redireciona para o WhatsApp Web
 * quando há sessão, oferece abrir o aplicativo de desktop quando ele está
 * instalado, e no celular abre o app direto. Um endereço, os três casos, com o
 * texto do pedido já preenchido na conversa.
 *
 * Some com a detecção de ponteiro, com o `matchMedia` e com o estado de cópia:
 * não havia decisão a tomar no cliente, e cada uma dessas peças era uma chance
 * a mais de a tela sair diferente no servidor e no navegador.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O BOTÃO É UM `<a href>`, NÃO UM `onClick` COM `window.open`
 * ────────────────────────────────────────────────────────────────────────────
 * Um `onClick` que faz `await revalidar()` e só então chama `window.open` perde
 * o gesto do usuário no `await` — o navegador trata a abertura como pop-up e
 * bloqueia. Com um link de verdade, a navegação é do usuário, funciona com
 * clique do meio, e o endereço aparece na barra de status.
 *
 * O preço de manter o link pronto é que ele reflete a última validação; por
 * isso `useValidacao` revalida quando a aba volta a ficar visível.
 */
export function Finalizar({
  resultado,
  whatsapp,
  template,
}: {
  resultado: ResultadoValidacao
  whatsapp: string | null
  template: string | null
}) {
  if (!whatsapp) {
    return (
      <p role="status" className="border-caqui-danger text-corpo-sm border-l-4 px-4 py-3">
        O número de WhatsApp da Caqui ainda não está configurado, então não dá para finalizar por
        aqui agora. Chame pelo Instagram, ou tente de novo mais tarde.
      </p>
    )
  }

  if (!resultado.podeFinalizar) {
    return (
      <p
        role="status"
        className="border-caqui-danger bg-caqui-sand-100 text-corpo-sm border-l-4 px-4 py-3"
      >
        Ajuste os itens marcados acima antes de finalizar. Nada é enviado com dado desatualizado. É
        o que evita a Caqui ter que desdizer o site na conversa.
      </p>
    )
  }

  const itens = itensQueVaoNaMensagem(resultado)
  const totalCentavos = itens.reduce((soma, i) => soma + i.subtotalCentavos, 0)

  return (
    <div className="flex flex-col gap-3">
      <a
        href={linkWhatsApp(whatsapp, montarMensagem(template ?? '', resultado))}
        target="_blank"
        rel="noopener noreferrer"
        // O clique é o último passo do funil que o site consegue medir: o que
        // acontece depois é a conversa no WhatsApp, fora do alcance. `onClick`
        // dispara antes da navegação, então o evento sai mesmo com o link
        // levando a aba embora.
        onClick={() => eventoFinalizarNoWhatsApp({ itens: itens.length, totalCentavos })}
        className={classesDeBotao({ tamanho: 'lg', bloco: true })}
      >
        <span>Finalizar no WhatsApp</span>
      </a>

      <p className="text-caqui-ink-500 text-micro text-center font-mono uppercase">
        Nada é cobrado no site. O pagamento é combinado na conversa.
      </p>
    </div>
  )
}
