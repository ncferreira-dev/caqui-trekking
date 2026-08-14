'use client'

import { useState } from 'react'

import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/ui/cn'

/**
 * Compartilhar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESTE BLOCO É CANAL DE AQUISIÇÃO, NÃO CORTESIA
 * ────────────────────────────────────────────────────────────────────────────
 * Trilha guiada se vende em grupo. A pessoa não decide sozinha: ela manda o
 * link no grupo da família ou dos amigos e volta quando alguém topa. Hoje ela
 * faz isso copiando a URL da barra do navegador — o que no celular exige achar
 * a barra, tocar, selecionar tudo, copiar, e trocar de app. Boa parte desiste
 * no meio, e a saída que ela ia fechar com três pessoas não acontece.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TRÊS CAMINHOS: FOLHA NATIVA, WHATSAPP E INSTAGRAM
 * ────────────────────────────────────────────────────────────────────────────
 * - **Compartilhar** (folha nativa): no celular já traz o WhatsApp em primeiro
 *   lugar, com as conversas recentes — nada que eu desenhe chega perto. No
 *   desktop `navigator.share` quase não existe, então lá esse botão copia o
 *   link e diz que copiou.
 * - **WhatsApp**: atalho direto para `wa.me`, que abre o WhatsApp com o link já
 *   escrito e deixa a pessoa escolher a conversa. É o canal onde a Caqui fecha,
 *   então ganha um botão próprio, sem depender de a folha nativa aparecer.
 * - **Instagram**: aqui está a verdade técnica que o ícone não pode esconder —
 *   o Instagram NÃO aceita link por URL na web (não existe `instagram.com/
 *   share?url=`). O honesto é copiar o link e abrir o Instagram para a pessoa
 *   colar no story ou no direct. O toast diz exatamente isso; fingir um envio
 *   que a plataforma não oferece seria pior.
 *
 * A URL é lida NO CLIQUE (`window.location.href`), nunca no render: ler no
 * render produziria HTML diferente no servidor e no cliente — o erro de
 * hidratação clássico —, e guardar isso em estado dentro de um efeito é
 * exatamente o que o React Compiler recusa neste projeto.
 *
 * `AbortError` é ignorado de propósito: é o que o navegador lança quando a
 * pessoa fecha a folha de compartilhamento. Desistir não é falha.
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

  const mensagemCom = (url: string): string => (texto ? `${texto} ${url}` : url)

  async function copiarLink(url: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  }

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

    if (await copiarLink(url)) {
      setCopiado(true)
      mostrar({
        tom: 'sucesso',
        titulo: 'Link copiado',
        descricao: 'Agora é só colar na conversa.',
      })
    } else {
      mostrar({
        tom: 'erro',
        titulo: 'Não deu para copiar',
        descricao: 'O navegador bloqueou a área de transferência. Copie da barra de endereço.',
      })
    }
  }

  function noWhatsApp() {
    const url = window.location.href
    const alvo = `https://wa.me/?text=${encodeURIComponent(mensagemCom(url))}`
    window.open(alvo, '_blank', 'noopener,noreferrer')
  }

  async function noInstagram() {
    const url = window.location.href
    const copiou = await copiarLink(url)
    // O Instagram não recebe link por URL: o que dá para fazer é deixar o link
    // na área de transferência e abrir o app para a pessoa colar.
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
    mostrar(
      copiou
        ? {
            tom: 'sucesso',
            titulo: 'Link copiado',
            descricao: 'Cole no seu story ou no direct do Instagram.',
          }
        : {
            tom: 'erro',
            titulo: 'Não deu para copiar',
            descricao: 'Copie o link da barra de endereço para colar no Instagram.',
          },
    )
  }

  const botaoIcone = cn(
    'inline-flex size-11 shrink-0 items-center justify-center rounded-xs',
    'border-caqui-ink-900 border bg-white text-caqui-ink-900',
    'hover:bg-caqui-sand-100 transition-colors',
  )

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={compartilhar}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-xs px-3',
          'border-caqui-ink-900 border bg-white',
          'text-rotulo font-mono uppercase',
          'hover:bg-caqui-sand-100 transition-colors',
        )}
      >
        {copiado ? <IconeConfirmado /> : <IconeCompartilhar />}
        {copiado ? 'Link copiado' : rotulo}
      </button>

      <button
        type="button"
        onClick={noWhatsApp}
        aria-label="Compartilhar no WhatsApp"
        title="WhatsApp"
        className={botaoIcone}
      >
        <IconeWhatsApp />
      </button>

      <button
        type="button"
        onClick={noInstagram}
        aria-label="Compartilhar no Instagram"
        title="Instagram"
        className={botaoIcone}
      >
        <IconeInstagram />
      </button>
    </div>
  )
}

/**
 * O ícone da folha nativa.
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

/** A marca do WhatsApp — balão com o fone, monocromático para caber na paleta. */
function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.943 11.943 0 005.71 1.446h.006c6.585 0 11.946-5.359 11.949-11.893a11.821 11.821 0 00-3.48-8.454" />
    </svg>
  )
}

/** A marca do Instagram — quadrado arredondado, lente e ponto. */
function IconeInstagram() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
