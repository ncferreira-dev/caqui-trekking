'use client'

import { useState } from 'react'

import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/ui/cn'

/**
 * Compartilhar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESTE BOTÃO É CANAL DE AQUISIÇÃO, NÃO CORTESIA
 * ────────────────────────────────────────────────────────────────────────────
 * Trilha guiada se vende em grupo. A pessoa não decide sozinha: ela manda o
 * link no grupo da família ou dos amigos e volta quando alguém topa. Hoje ela
 * faz isso copiando a URL da barra do navegador — o que no celular exige achar
 * a barra, tocar, selecionar tudo, copiar, e trocar de app. Boa parte desiste
 * no meio, e a saída que ela ia fechar com três pessoas não acontece.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `navigator.share` PRIMEIRO, CÓPIA COMO PLANO B
 * ────────────────────────────────────────────────────────────────────────────
 * No celular, a folha nativa de compartilhamento já tem o WhatsApp no primeiro
 * lugar, com as conversas recentes. Nada que eu desenhe chega perto disso, e
 * uma lista própria de "compartilhar em X, Y, Z" ficaria desatualizada e não
 * saberia quais conversas são as recentes dela.
 *
 * No desktop `navigator.share` quase não existe, então lá o botão copia o link
 * e diz que copiou. É o mesmo gesto do ponto de vista de quem usa: um toque, e
 * o link está onde ela precisa.
 *
 * A detecção acontece NO CLIQUE, não no render. Ler `navigator.share` durante o
 * render produziria HTML diferente no servidor e no cliente — o erro de
 * hidratação clássico —, e guardar isso em estado dentro de um efeito é
 * exatamente o que o React Compiler recusa neste projeto.
 *
 * `AbortError` é ignorado de propósito: é o que o navegador lança quando a
 * pessoa fecha a folha de compartilhamento. Desistir não é falha, e mostrar
 * "não deu para compartilhar" nesse caso seria acusar quem mudou de ideia.
 */
export function Compartilhar({
  titulo,
  texto,
  className,
  rotulo = 'Compartilhar',
}: {
  /** Vira o título da folha nativa. Normalmente o nome do roteiro ou da peça. */
  titulo: string
  /** Uma linha de contexto. Aparece no corpo em alguns apps. */
  texto?: string
  className?: string
  rotulo?: string
}) {
  const { mostrar } = useToast()
  const [copiado, setCopiado] = useState(false)

  async function compartilhar() {
    // `window.location.href` e não uma URL montada com `NEXT_PUBLIC_SITE_URL`:
    // o que a pessoa quer mandar é exatamente a página em que ela está, com a
    // âncora e os parâmetros que ela usou para chegar até aqui.
    const url = window.location.href

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: titulo, ...(texto ? { text: texto } : {}), url })
        return
      } catch (causa) {
        if (causa instanceof Error && causa.name === 'AbortError') return
        // Qualquer outra falha cai na cópia, que funciona em todo lugar.
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      mostrar({
        tom: 'sucesso',
        titulo: 'Link copiado',
        descricao: 'Agora é só colar na conversa.',
      })
    } catch {
      mostrar({
        tom: 'erro',
        titulo: 'Não deu para copiar',
        descricao: 'O navegador bloqueou a área de transferência. Copie da barra de endereço.',
      })
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-xs px-3',
        'border-caqui-ink-900 border bg-white',
        'text-rotulo font-mono uppercase',
        'hover:bg-caqui-sand-100 transition-colors',
        className,
      )}
    >
      {copiado ? <IconeConfirmado /> : <IconeCompartilhar />}
      {copiado ? 'Link copiado' : rotulo}
    </button>
  )
}

/**
 * O ícone.
 *
 * Três nós ligados por duas linhas — o desenho que Android e boa parte da web
 * usam. A seta para cima do iOS é a alternativa, e perde: fora do iPhone ela
 * lê como "enviar arquivo" ou "exportar".
 */
function IconeCompartilhar() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="15" cy="4.5" r="2.5" />
        <circle cx="5" cy="10" r="2.5" />
        <circle cx="15" cy="15.5" r="2.5" />
        <path d="M12.8 5.7 7.2 8.8M7.2 11.2l5.6 3.1" />
      </g>
    </svg>
  )
}

function IconeConfirmado() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path
        d="M4 10.5 8 14.5 16 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
