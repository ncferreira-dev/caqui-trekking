'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Rotulo } from '@/components/crm/pecas'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { montarMensagem } from '@/lib/carrinho/mensagem'
import { api, ErroDaApi } from '@/lib/crm/api'
import { linkWhatsApp } from '@/lib/formato'
import { cn } from '@/lib/ui/cn'
import type { ItemValidado, ResultadoValidacao } from '@/server/services/cart-service'

/**
 * O editor do template da mensagem do WhatsApp.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PREVIEW USA `montarMensagem`, A MESMA FUNÇÃO DA LOJA
 * ────────────────────────────────────────────────────────────────────────────
 * Este é o ponto todo. Se o preview reimplementasse a interpolação, ele
 * mostraria uma coisa e o cliente receberia outra — e a divergência apareceria
 * na conversa, sem ninguém saber por quê.
 *
 * `montarMensagem` é função pura, sem framework e sem banco: recebe template e
 * itens, devolve texto. É por isso que ela pode rodar aqui e lá com a garantia
 * de resultado idêntico. Ver `src/lib/carrinho/mensagem.ts`.
 *
 * O pedido de exemplo é fixo — uma expedição e uma peça, os dois tipos que
 * existem — para a Caqui ver como ficam os dois formatos de linha.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PLACEHOLDER ERRADO É BARRADO NO SERVIDOR, E AVISADO AQUI
 * ────────────────────────────────────────────────────────────────────────────
 * `{{iten}}` com erro de digitação sairia literal na conversa com o cliente. O
 * servidor recusa com a lista do que existe; a tela mostra a mesma lista antes
 * de alguém tentar, e o preview deixa o erro visível na hora — o marcador
 * errado simplesmente aparece cru no texto de exemplo.
 */

/** Um pedido de exemplo, com os dois tipos de linha. Não toca no banco. */
function pedidoDeExemplo(): ResultadoValidacao {
  const itens: ItemValidado[] = [
    {
      lineId: 'exemplo-d',
      tipo: 'DEPARTURE',
      ok: true,
      motivo: null,
      precoCentavos: 42_500,
      precoDecimal: '425.00',
      precoAnteriorCentavos: null,
      quantidade: 2,
      subtotalCentavos: 85_000,
      descricao: 'Escalavrado — Teresópolis',
      detalhe: 'sábado, 29 de agosto, 05:00',
    },
    {
      lineId: 'exemplo-w',
      tipo: 'WEAR',
      ok: true,
      motivo: null,
      precoCentavos: 5_000,
      precoDecimal: '50.00',
      precoAnteriorCentavos: null,
      quantidade: 1,
      subtotalCentavos: 5_000,
      descricao: 'Camiseta Dry Fit Caqui',
      detalhe: 'Tam M · Preto',
    },
  ]

  return {
    itens,
    totalCentavos: 90_000,
    totalFormatado: 'R$ 900,00',
    temDivergencia: false,
    podeFinalizar: true,
  }
}

export function EditorDeTemplate({
  templateInicial,
  numero,
  placeholders,
}: {
  templateInicial: string
  numero: string
  placeholders: readonly string[]
}) {
  const router = useRouter()
  const { mostrar } = useToast()

  const [template, setTemplate] = useState(templateInicial)
  const [salvando, setSalvando] = useState(false)

  const exemplo = pedidoDeExemplo()
  const previa = montarMensagem(template, exemplo)
  const mudou = template !== templateInicial

  // Marcador escrito errado. O servidor recusa; aqui a pessoa vê antes de
  // tentar salvar, com o nome exato do que digitou errado.
  const usados = template.match(/\{\{[^}]*\}\}/g) ?? []
  const invalidos = [...new Set(usados.filter((p) => !placeholders.includes(p)))]

  async function salvar() {
    if (salvando || !mudou) return
    setSalvando(true)

    try {
      await api.put('/api/admin/settings', { whatsappMessageTemplate: template })
      mostrar({
        tom: 'sucesso',
        titulo: 'Template salvo',
        descricao: 'Vale no próximo pedido finalizado no site.',
      })
      router.refresh()
    } catch (causa) {
      mostrar({
        tom: 'erro',
        titulo: 'Não salvou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'Tente de novo.',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="template" className="text-caqui-ink-900 text-rotulo font-mono uppercase">
          Template
        </label>

        <textarea
          id="template"
          value={template}
          onChange={(e) => setTemplate(e.currentTarget.value)}
          rows={12}
          spellCheck={false}
          className={cn(
            'border-caqui-ink-900 text-corpo-sm w-full rounded-xs border bg-white p-3 font-mono',
            invalidos.length > 0 && 'border-caqui-danger border-2',
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Rotulo>marcadores:</Rotulo>
          {placeholders.map((p) => (
            <button
              key={p}
              type="button"
              // Inserir com um clique em vez de digitar: `{{itens}}` digitado
              // à mão é onde nasce o `{{iten}}` que o servidor recusa.
              onClick={() => setTemplate((t) => `${t}${t.endsWith('\n') ? '' : '\n'}${p}`)}
              className="border-caqui-rule hover:border-caqui-ink-900 text-micro rounded-xs border bg-white px-2 py-1 font-mono"
            >
              {p}
            </button>
          ))}
        </div>

        {invalidos.length > 0 && (
          <p role="alert" className="text-caqui-danger text-corpo-sm">
            Marcador desconhecido: <span className="font-mono">{invalidos.join(', ')}</span>. Ele
            sairia escrito assim mesmo na conversa com o cliente.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={salvar} disabled={!mudou || invalidos.length > 0} carregando={salvando}>
            Salvar template
          </Button>
          {mudou && (
            <button
              type="button"
              onClick={() => setTemplate(templateInicial)}
              className="text-caqui-ink-500 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase"
            >
              Desfazer
            </button>
          )}
        </div>
      </div>

      {/* ── Prévia ao vivo ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-caqui-ink-900 text-rotulo font-mono uppercase">
          Como o cliente vai mandar
        </p>

        <div className="border-caqui-forest-800 rounded-xs border bg-white p-3">
          <pre className="text-corpo-sm font-sans whitespace-pre-wrap">{previa}</pre>
        </div>

        <p className="text-caqui-ink-500 text-micro font-mono uppercase">
          Pedido de exemplo · 2 vagas + 1 camiseta
        </p>

        <a
          href={linkWhatsApp(numero, previa)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-caqui-forest-800 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
        >
          Testar no seu WhatsApp
        </a>
      </div>
    </div>
  )
}
