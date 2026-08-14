'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'

import { classesDeBotao } from '@/components/ui/button'
import { montarMensagem } from '@/lib/carrinho/mensagem'
import { linkWhatsApp, telefoneBR } from '@/lib/formato'
import { cn } from '@/lib/ui/cn'
import type { ResultadoValidacao } from '@/server/services/cart-service'

/**
 * O handoff para o WhatsApp — onde o projeto inteiro se resolve.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PLANO B NÃO É UM DETALHE DE POLIMENTO
 * ────────────────────────────────────────────────────────────────────────────
 * No desktop, sem WhatsApp Web logado, o link `wa.me` abre uma aba que fica em
 * branco ou numa tela de instalação. A pessoa que passou por agenda, seletor de
 * data e mochila desiste ali — achando que o site quebrou. E ninguém descobre
 * por quê: não há erro, não há log, não há requisição falhando. A conversão
 * simplesmente evapora.
 *
 * Por isso a mensagem montada aparece SEMPRE na tela, com botão de copiar e o
 * número em texto legível. Mesmo que todo o resto falhe, existe um caminho
 * manual óbvio: copiar, abrir o WhatsApp, colar.
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

/**
 * Toque ou mouse — capacidade, não user-agent.
 *
 * `(pointer: coarse)` pergunta ao navegador se o ponteiro primário é grosso
 * (dedo). É a pergunta certa: um Windows com tela sensível ao toque e um iPad
 * com teclado respondem pelo que são, não pela string que dizem ser. Sniffing
 * de `navigator.userAgent` erra nos dois.
 */
const CONSULTA = '(pointer: coarse)'

function assinarPonteiro(aoMudar: () => void): () => void {
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener('change', aoMudar)
  return () => mq.removeEventListener('change', aoMudar)
}

function ehToque(): boolean {
  return window.matchMedia(CONSULTA).matches
}

/** No servidor não há ponteiro. `false` faz o HTML sair com o plano B visível. */
function noServidor(): boolean {
  return false
}

export function Finalizar({
  resultado,
  whatsapp,
  template,
}: {
  resultado: ResultadoValidacao
  whatsapp: string | null
  template: string | null
}) {
  const toque = useSyncExternalStore(assinarPonteiro, ehToque, noServidor)
  const [copiado, setCopiado] = useState(false)
  const [falhouCopia, setFalhouCopia] = useState(false)

  const mensagem = montarMensagem(template ?? '', resultado)

  const copiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mensagem)
      setCopiado(true)
      setFalhouCopia(false)
      // Volta ao normal sozinho: um botão que fica "Copiado!" para sempre
      // impede a segunda cópia de dar retorno nenhum.
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      // `navigator.clipboard` exige contexto seguro e permissão. Falhou: a
      // pessoa seleciona o texto, que está logo acima, e copia à mão.
      setFalhouCopia(true)
    }
  }, [mensagem])

  if (!whatsapp) {
    return (
      <p role="status" className="border-caqui-danger text-corpo-sm border-l-4 px-4 py-3">
        O número de WhatsApp da Caqui não está configurado, então não dá para finalizar por aqui
        agora. Copie o pedido abaixo e mande pelo Instagram, ou tente de novo mais tarde.
      </p>
    )
  }

  if (!resultado.podeFinalizar) {
    return (
      <p
        role="status"
        className="border-caqui-danger bg-caqui-sand-100 text-corpo-sm border-l-4 px-4 py-3"
      >
        Ajuste os itens marcados acima antes de finalizar. Nada é enviado com dado desatualizado — é
        o que evita a Caqui ter que desdizer o site na conversa.
      </p>
    )
  }

  // `wa.me` no celular abre o app instalado. No desktop, o destino honesto é o
  // WhatsApp Web: `wa.me` ali passa por uma tela intermediária de instalação
  // que é justamente onde as pessoas desistem.
  const link = toque
    ? linkWhatsApp(whatsapp, mensagem)
    : `https://web.whatsapp.com/send?phone=${whatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(mensagem)}`

  return (
    <div className="flex flex-col gap-5">
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={classesDeBotao({ tamanho: 'lg', bloco: true })}
      >
        <span>{toque ? 'Finalizar pedido no WhatsApp' : 'Abrir no WhatsApp Web'}</span>
      </a>

      <div className="border-caqui-ink-900 border bg-white">
        <div className="border-caqui-rule flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-caqui-ink-500 text-micro font-mono uppercase">
              {toque ? 'Ou copie e mande você mesmo' : 'Sem WhatsApp Web? Copie e mande do celular'}
            </p>
            {/* O número em TEXTO, não só dentro do link. É o que salva quem
                não conseguiu abrir nada — dá para digitar no telefone. */}
            <p className="text-dado font-mono font-medium">{telefoneBR(whatsapp)}</p>
          </div>

          <button
            type="button"
            onClick={copiar}
            className={classesDeBotao({ variante: 'secondary', tamanho: 'sm' })}
          >
            <span>{copiado ? 'Copiado' : 'Copiar mensagem'}</span>
          </button>
        </div>

        {/* `<pre>` e não `<textarea>`: o texto tem emoji e quebra de linha e
            precisa aparecer exatamente como vai chegar na conversa. `select-all`
            faz um clique selecionar tudo, que é o caminho manual mais curto. */}
        <pre
          className={cn(
            'text-corpo-sm max-h-60 overflow-auto px-4 py-3 font-sans whitespace-pre-wrap',
            'selection:bg-caqui-orange-500 select-all',
          )}
        >
          {mensagem}
        </pre>

        {/* `role="status"` para o retorno da cópia chegar a quem não vê o
            rótulo do botão mudar. */}
        <p role="status" className="sr-only">
          {copiado ? 'Mensagem copiada.' : ''}
        </p>

        {falhouCopia && (
          <p role="alert" className="text-caqui-danger text-corpo-sm px-4 pb-3">
            O navegador bloqueou a cópia automática. Clique no texto acima para selecionar tudo e
            copie com Ctrl+C.
          </p>
        )}
      </div>

      <p className="text-caqui-ink-500 text-micro text-center font-mono uppercase">
        Nada é cobrado no site. O pagamento é combinado na conversa.
      </p>
    </div>
  )
}
