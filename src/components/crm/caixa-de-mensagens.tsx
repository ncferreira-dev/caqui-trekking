'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Rotulo, Vazio } from '@/components/crm/pecas'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { linkWhatsApp, telefoneBR } from '@/lib/formato'
import { cn } from '@/lib/ui/cn'

/**
 * A caixa de mensagens.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O TELEFONE VIRA LINK DE WHATSAPP, JÁ COM A CONVERSA COMEÇADA
 * ────────────────────────────────────────────────────────────────────────────
 * A resposta a uma mensagem do site nunca é por e-mail: é pelo WhatsApp, que é
 * onde essa operação inteira acontece. Um número em texto puro obriga a
 * selecionar, copiar, sair do painel, abrir o app, colar, e lembrar do que a
 * pessoa perguntou.
 *
 * O link já leva o nome de quem escreveu e o roteiro sobre o qual perguntou.
 * A Caqui abre e já está no meio da conversa certa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * "MARCAR COMO LIDA" NÃO ACONTECE SOZINHO AO ABRIR
 * ────────────────────────────────────────────────────────────────────────────
 * A tentação é marcar quando o texto expande. Só que expandir é como se LÊ, e
 * a pessoa expande várias para achar a certa — marcando todas como resolvidas
 * no caminho. Aqui "lida" significa "eu já respondi isso", e essa é uma
 * decisão, não um efeito colateral de rolar a tela.
 */

export type MensagemDoPainel = {
  id: number
  nome: string
  email: string | null
  telefone: string | null
  mensagem: string
  lida: boolean
  quando: string
  roteiro: string | null
}

export function CaixaDeMensagens({ mensagens }: { mensagens: MensagemDoPainel[] }) {
  const router = useRouter()
  const { mostrar } = useToast()

  const [abertas, setAbertas] = useState<Record<number, boolean>>({})
  const [otimista, setOtimista] = useState<Record<number, boolean>>({})
  const [ocupadas, setOcupadas] = useState<Record<number, boolean>>({})

  async function alternarLida(m: MensagemDoPainel) {
    const atual = otimista[m.id] ?? m.lida
    if (ocupadas[m.id]) return

    setOtimista((v) => ({ ...v, [m.id]: !atual }))
    setOcupadas((v) => ({ ...v, [m.id]: true }))

    try {
      await api.patch('/api/admin/messages', { id: m.id, lida: !atual })
      router.refresh()
    } catch (causa) {
      setOtimista((v) => ({ ...v, [m.id]: atual }))
      mostrar({
        tom: 'erro',
        titulo: 'Não marcou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'Tente de novo.',
      })
    } finally {
      setOcupadas((v) => ({ ...v, [m.id]: false }))
    }
  }

  if (mensagens.length === 0) {
    return (
      <Vazio titulo="Nenhuma mensagem">
        <p>O que chegar pelo formulário de contato aparece aqui.</p>
      </Vazio>
    )
  }

  return (
    <ul className="divide-caqui-rule divide-y">
      {mensagens.map((m) => {
        const lida = otimista[m.id] ?? m.lida
        const aberta = abertas[m.id] ?? false

        return (
          <li key={m.id} className={cn('px-4 py-3', !lida && 'border-caqui-orange-500 border-l-4')}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={cn('text-corpo-sm', !lida && 'font-medium')}>{m.nome}</span>
              <Rotulo>{m.quando}</Rotulo>
              {m.roteiro && <Rotulo>sobre {m.roteiro}</Rotulo>}
            </div>

            <p
              className={cn(
                'text-caqui-ink-700 text-corpo-sm mt-1',
                !aberta && 'line-clamp-2',
                aberta && 'whitespace-pre-line',
              )}
            >
              {m.mensagem}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => setAbertas((v) => ({ ...v, [m.id]: !aberta }))}
                className="text-caqui-ink-500 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase"
              >
                {aberta ? 'Recolher' : 'Ler tudo'}
              </button>

              {m.telefone && (
                <a
                  href={linkWhatsApp(
                    m.telefone,
                    `Olá, ${m.nome}! Aqui é da Caqui Trekking${m.roteiro ? `, sobre a ${m.roteiro}` : ''}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caqui-forest-800 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
                >
                  Responder — {telefoneBR(m.telefone)}
                </a>
              )}

              {m.email && (
                <a
                  href={`mailto:${m.email}`}
                  className="text-caqui-ink-700 text-micro rounded-xs font-mono underline underline-offset-4"
                >
                  {m.email}
                </a>
              )}

              <button
                type="button"
                onClick={() => alternarLida(m)}
                disabled={ocupadas[m.id]}
                className={cn(
                  'text-micro ml-auto min-h-9 rounded-xs border px-3 font-mono uppercase transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  lida
                    ? 'border-caqui-rule text-caqui-ink-500 hover:border-caqui-ink-900'
                    : 'border-caqui-ink-900 bg-caqui-ink-900 text-white',
                )}
              >
                {lida ? 'Marcar não lida' : 'Marcar lida'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
