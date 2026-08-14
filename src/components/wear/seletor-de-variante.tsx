'use client'

import Link from 'next/link'
import { useState } from 'react'

import { useMochila } from '@/components/carrinho/contexto'
import { TabelaDeMedidas } from '@/components/wear/tabela-de-medidas'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { lineIdDeVariante, useCarrinho } from '@/lib/carrinho/store'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'
import type { ProdutoDetalheDTO } from '@/server/dto/public-dto'

/**
 * Escolha de TAMANHO e COR.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMBINAÇÃO INDISPONÍVEL NÃO SOME — FICA DESABILITADA
 * ────────────────────────────────────────────────────────────────────────────
 * É requisito escrito do briefing, e o motivo é comercial antes de ser de
 * acessibilidade: some com o "G" e a pessoa conclui que a peça não é feita no
 * tamanho dela e vai embora. Deixe o "G" ali, riscado, e ela entende que
 * existe e acabou — e pergunta no WhatsApp quando volta.
 *
 * A indisponibilidade é sinalizada por TRÊS coisas independentes: o `disabled`
 * nativo (que o leitor de tela anuncia), a trama diagonal (que não depende de
 * cor) e um texto para leitor de tela. Tire a cor e continua funcionando.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A GRADE É CRUZADA, E É ISSO QUE COMPLICA
 * ────────────────────────────────────────────────────────────────────────────
 * "Preto" existe em P, M e G; "Cinza Chumbo" existe em P e M. Escolher a cor
 * muda quais tamanhos são possíveis, e vice-versa. Duas saídas ruins: recalcular
 * a lista escondendo opções (a pessoa vê o botão sumir debaixo do dedo), ou
 * deixar escolher uma combinação inexistente e falhar depois.
 *
 * Aqui a COR manda: escolher uma cor mantém todos os tamanhos visíveis e marca
 * como indisponíveis os que aquela cor não tem. Nada some, nada mente.
 */
export function SeletorDeVariante({ produto }: { produto: ProdutoDetalheDTO }) {
  const cores = produto.cores
  const tamanhos = [...new Set(produto.variantes.map((v) => v.tamanho))]
  const soUmTamanho = tamanhos.length === 1 && tamanhos[0] === 'UNICO'

  const primeiraDisponivel = produto.variantes.find((v) => v.disponivel)

  const [cor, setCor] = useState<string | null>(primeiraDisponivel?.cor ?? cores[0]?.nome ?? null)
  const [tamanho, setTamanho] = useState<string | null>(
    primeiraDisponivel?.tamanho ?? tamanhos[0] ?? null,
  )
  const [quantidade, setQuantidade] = useState(1)
  const [adicionada, setAdicionada] = useState(false)
  const [medidasAbertas, setMedidasAbertas] = useState(false)

  const { adicionar } = useCarrinho()
  const { mostrar } = useToast()
  const { abrir } = useMochila()

  const selecionada = produto.variantes.find((v) => v.cor === cor && v.tamanho === tamanho) ?? null
  const preco = selecionada?.precoCentavos ?? produto.precoCentavos

  function escolherCor(nova: string) {
    setCor(nova)
    setAdicionada(false)

    // Se o tamanho atual não existe na cor nova, pula para o primeiro que
    // existe — em vez de deixar a pessoa parada numa combinação impossível.
    const aindaVale = produto.variantes.some(
      (v) => v.cor === nova && v.tamanho === tamanho && v.disponivel,
    )
    if (!aindaVale) {
      const alternativa = produto.variantes.find((v) => v.cor === nova && v.disponivel)
      if (alternativa) setTamanho(alternativa.tamanho)
    }
  }

  function aoAdicionar() {
    if (!selecionada?.disponivel) return

    adicionar({
      lineId: lineIdDeVariante(selecionada.id),
      tipo: 'WEAR',
      variantId: selecionada.id,
      quantidade,
    })

    setAdicionada(true)
    mostrar({
      tom: 'sucesso',
      titulo: 'Na mochila',
      descricao: `${produto.nome} — ${rotuloDoTamanho(selecionada.tamanho)} · ${selecionada.cor}, ${quantidade} un.`,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="preco">{formatarBRL(preco)}</p>
        <p className="text-caqui-ink-500 text-micro font-mono uppercase">
          Preço por peça. Sem frete: a entrega é combinada na conversa.
        </p>
      </div>

      {cores.length > 1 && (
        <fieldset>
          <legend className="text-caqui-forest-800 text-rotulo font-mono uppercase">
            Cor: <span className="text-caqui-ink-900">{cor}</span>
          </legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {cores.map((c) => {
              const temAlguma = produto.variantes.some((v) => v.cor === c.nome && v.disponivel)
              return (
                <button
                  key={c.nome}
                  type="button"
                  onClick={() => escolherCor(c.nome)}
                  aria-pressed={cor === c.nome}
                  className={cn(
                    'relative inline-flex items-center gap-2 rounded-xs border px-3 py-2',
                    'text-corpo-sm transition-colors',
                    cor === c.nome
                      ? 'border-caqui-ink-900 bg-white shadow-[var(--shadow-corte-1)]'
                      : 'border-caqui-rule-wear hover:border-caqui-ink-900 bg-white',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="border-caqui-ink-900 block size-4 rounded-xs border"
                    style={c.hex ? { backgroundColor: c.hex } : undefined}
                  />
                  {c.nome}
                  {!temAlguma && (
                    <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                      esgotada
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {!soUmTamanho && (
        <fieldset>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <legend className="text-caqui-forest-800 text-rotulo font-mono uppercase">
              Tamanho
            </legend>
            <button
              type="button"
              onClick={() => setMedidasAbertas(true)}
              className="text-caqui-ink-700 text-rotulo hover:text-caqui-ink-900 rounded-xs font-mono uppercase underline underline-offset-4"
            >
              Tabela de medidas
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {tamanhos.map((t) => {
              const variante = produto.variantes.find((v) => v.cor === cor && v.tamanho === t)
              const existe = variante !== undefined
              const disponivel = variante?.disponivel ?? false

              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTamanho(t)
                    setAdicionada(false)
                  }}
                  disabled={!disponivel}
                  aria-pressed={tamanho === t}
                  className={cn(
                    'relative min-w-12 rounded-xs border px-3 py-2 font-mono uppercase',
                    'text-corpo-sm transition-colors',
                    tamanho === t && disponivel
                      ? 'border-caqui-ink-900 bg-white shadow-[var(--shadow-corte-1)]'
                      : 'border-caqui-rule-wear bg-white',
                    disponivel
                      ? 'hover:border-caqui-ink-900'
                      : 'trama-indisponivel text-caqui-ink-500 cursor-not-allowed',
                  )}
                >
                  {rotuloDoTamanho(t)}
                  <span className="sr-only">
                    {!existe
                      ? ` — não feito em ${cor}`
                      : disponivel
                        ? ' — disponível'
                        : ' — esgotado'}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="flex items-end justify-between gap-4">
        <Quantidade valor={quantidade} aoMudar={setQuantidade} />
        <div className="text-right">
          <p className="text-caqui-ink-500 text-micro font-mono uppercase">
            {quantidade} × {formatarBRL(preco)}
          </p>
          <p className="text-dado-lg font-mono font-medium">{formatarBRL(preco * quantidade)}</p>
        </div>
      </div>

      <Button onClick={aoAdicionar} tamanho="lg" bloco disabled={!selecionada?.disponivel}>
        {selecionada?.disponivel ? 'Adicionar à mochila' : 'Combinação indisponível'}
      </Button>

      {adicionada && (
        <p
          role="status"
          className="border-caqui-forest-600 text-corpo-sm border-l-4 bg-white px-3 py-2"
        >
          Na mochila.{' '}
          <button
            type="button"
            onClick={abrir}
            className="rounded-xs font-medium underline underline-offset-4"
          >
            Ver a mochila
          </button>{' '}
          ou{' '}
          <Link href="/wear" className="rounded-xs font-medium underline underline-offset-4">
            continuar escolhendo
          </Link>
          .
        </p>
      )}

      <TabelaDeMedidas
        aberta={medidasAbertas}
        aoFechar={() => setMedidasAbertas(false)}
        categoria={produto.categoria}
      />
    </div>
  )
}

/** `UNICO` é o valor do enum; "Único" é o que a pessoa lê. */
function rotuloDoTamanho(tamanho: string): string {
  return tamanho === 'UNICO' ? 'Único' : tamanho
}

function Quantidade({ valor, aoMudar }: { valor: number; aoMudar: (n: number) => void }) {
  const limitar = (n: number) => Math.min(50, Math.max(1, n))

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caqui-forest-800 text-rotulo font-mono uppercase">Quantidade</span>
      <div className="border-caqui-ink-900 flex items-stretch border bg-white">
        <button
          type="button"
          onClick={() => aoMudar(limitar(valor - 1))}
          disabled={valor <= 1}
          aria-label="Diminuir quantidade"
          className="hover:bg-caqui-sand-100 inline-flex size-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">−</span>
        </button>
        <span className="text-dado inline-flex w-12 items-center justify-center font-mono font-medium">
          {valor}
        </span>
        <button
          type="button"
          onClick={() => aoMudar(limitar(valor + 1))}
          disabled={valor >= 50}
          aria-label="Aumentar quantidade"
          className="hover:bg-caqui-sand-100 inline-flex size-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  )
}
