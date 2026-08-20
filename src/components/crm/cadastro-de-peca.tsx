'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api, ErroDaApi } from '@/lib/crm/api'
import { corSugerida } from '@/lib/cores'
import { rotuloDeTamanho } from '@/lib/formato'
import { reaisParaCentavos } from '@/lib/money'
import { cn } from '@/lib/ui/cn'

/**
 * CADASTRAR PEÇA — a página inteira, no molde do CreateProductForm do Dália.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O PEDIDO, EM 20/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * "Quero exatamente o mesmo, mesmas posições e etc, só respeitando as cores da
 * Caqui Trekking."
 *
 * Então a GEOMETRIA é a do Dália, campo por campo: página inteira em vez de
 * modal, badge de código no topo, campos de `px-4 py-3` com `rounded-lg`,
 * rótulo em `text-sm font-medium`, o mesmo ritmo de `space-y-6`, a mesma grade
 * de fotos quadradas com o cartão tracejado de adicionar, e o mesmo cartão de
 * seleção com borda grossa.
 *
 * O que muda é a PALETA. Onde o Dália usa `#967965` e `gray-200`, aqui entram
 * os tokens da Caqui.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUATRO CAMPOS DO DÁLIA NÃO EXISTEM AQUI, E ISSO NÃO É ESQUECIMENTO
 * ────────────────────────────────────────────────────────────────────────────
 * O formulário original tem CUSTO, MATERIAL, GÊNERO e ESTOQUE. Nenhum dos
 * quatro tem coluna no schema da Caqui, e o estoque é ausência DELIBERADA:
 * `schema.prisma` explica que a Caqui controla disponibilidade na conversa do
 * WhatsApp, e que a variante é um liga/desliga sem quantidade.
 *
 * Copiar os quatro exigiria inventar domínio, e um formulário que pede estoque
 * num sistema que não tem estoque produz um número que ninguém mantém — que é
 * pior que campo nenhum.
 *
 * A grade onde eles viviam (`sm:grid-cols-2 lg:grid-cols-4`) continua de pé,
 * com o que a Caqui de fato tem: categoria e a publicação.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O LARANJA NÃO PODE SER COR DE TEXTO
 * ────────────────────────────────────────────────────────────────────────────
 * `#F26522` sobre branco dá 3,15:1, e o AA exige 4,5:1. O ESLint do projeto
 * recusa `text-caqui-orange-*` por isso. Aqui ele aparece como FUNDO e como
 * BORDA — que é onde o Dália usa o marrom dele também.
 */

const CATEGORIAS = [
  { valor: 'CAMISETA', rotulo: 'Camiseta' },
  { valor: 'REGATA', rotulo: 'Regata' },
  { valor: 'MOCHILA', rotulo: 'Mochila' },
  { valor: 'BONE', rotulo: 'Boné' },
  { valor: 'ACESSORIO', rotulo: 'Acessório' },
]

const TAMANHOS = ['UNICO', 'PP', 'P', 'M', 'G', 'GG', 'XG']

type Variante = {
  size: string
  colorName: string
  colorHex: string
  available: boolean
  precoProprio: string
}

function varianteVazia(): Variante {
  return { size: 'UNICO', colorName: '', colorHex: '#000000', available: true, precoProprio: '' }
}

/** As classes do campo do Dália, com os tokens da Caqui no lugar do marrom. */
const CAMPO = cn(
  'w-full rounded-lg border border-caqui-sand-200 bg-white px-4 py-3',
  'transition-colors focus:border-caqui-orange-500 focus:outline-none',
)

const ROTULO = 'mb-2 block text-sm font-medium text-caqui-ink-700'

export function CadastroDePeca() {
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [preco, setPreco] = useState('')
  const [publicar, setPublicar] = useState(false)
  const [variantes, setVariantes] = useState<Variante[]>([varianteVazia()])

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  /**
   * As cores distintas que a peça tem AGORA, na ordem em que foram escritas.
   *
   * É o que liga a grade de fotos à grade de variantes: escreveu uma cor nova
   * lá embaixo, aparece um quadro de foto aqui em cima. A dedução é sem
   * distinção de caixa, para "Azul Marinho" e "azul marinho" não abrirem dois
   * quadros da mesma cor — e a grafia que vale é a primeira digitada.
   */
  const coresDaPeca = Array.from(
    new Map(
      variantes
        .map((v) => v.colorName.trim())
        .filter((c) => c !== '')
        .map((c) => [c.toLowerCase(), c] as const),
    ).values(),
  )

  function mudarVariante(indice: number, campo: Partial<Variante>) {
    setVariantes((atual) => atual.map((v, i) => (i === indice ? { ...v, ...campo } : v)))
  }

  /** Digitar "azul marinho" já pinta a amostra. Ver `lib/cores.ts`. */
  function mudarCor(indice: number, nomeDaCor: string) {
    const atual = variantes[indice]
    const sugerido = corSugerida(nomeDaCor)
    mudarVariante(indice, {
      colorName: nomeDaCor,
      // Só sugere enquanto a pessoa não escolheu um tom à mão.
      ...(sugerido && atual?.colorHex === '#000000' ? { colorHex: sugerido } : {}),
    })
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    setSucesso(null)

    const centavos = reaisParaCentavos(preco)
    if (!nome.trim()) return setErro('Dê um nome à peça.')
    if (!categoria) return setErro('Escolha a categoria.')
    if (centavos === null) return setErro('Preço inválido. Use o formato 50,00.')

    const limpas = variantes.filter((v) => v.colorName.trim() !== '')
    if (limpas.length === 0) {
      return setErro('Cadastre ao menos uma variante com cor. É o que torna a peça comprável.')
    }

    const preparadas: {
      size: string
      colorName: string
      colorHex: string | null
      available: boolean
      priceCents: number | null
    }[] = []

    for (const v of limpas) {
      let precoVariante: number | null = null
      if (v.precoProprio.trim() !== '') {
        precoVariante = reaisParaCentavos(v.precoProprio)
        if (precoVariante === null) {
          return setErro(`Preço próprio de "${v.colorName.trim()}" inválido. Use o formato 50,00.`)
        }
      }
      preparadas.push({
        size: v.size,
        colorName: v.colorName.trim(),
        colorHex: /^#[0-9a-fA-F]{6}$/.test(v.colorHex) ? v.colorHex : null,
        available: v.available,
        priceCents: precoVariante,
      })
    }

    setEnviando(true)
    try {
      await api.post('/api/admin/products', {
        name: nome.trim(),
        description: descricao.trim() || null,
        category: categoria,
        priceCents: centavos,
        status: publicar ? 'PUBLISHED' : 'DRAFT',
        variantes: preparadas,
      })

      setSucesso(
        publicar
          ? 'Peça cadastrada e publicada. Já está na loja.'
          : 'Peça cadastrada em rascunho. Publique quando quiser.',
      )
      router.push('/crm/produtos')
      router.refresh()
    } catch (causa) {
      setErro(
        causa instanceof ErroDaApi ? causa.message : 'Não foi possível salvar. Tente de novo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mx-auto w-full max-w-4xl">
      <div className="border-caqui-sand-200 rounded-lg border bg-white p-6 sm:p-8">
        <h1 className="font-display text-display-s mb-6 uppercase">Cadastrar peça</h1>

        {erro && (
          <div className="border-caqui-danger mb-6 rounded-lg border bg-white p-4" role="alert">
            <p className="text-caqui-danger text-sm">{erro}</p>
          </div>
        )}
        {sucesso && (
          <div className="border-caqui-forest-300 bg-caqui-sand-100 mb-6 rounded-lg border p-4">
            <p className="text-caqui-forest-800 text-sm">{sucesso}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Código, gerado ao salvar — o mesmo badge do Dália. Aqui o que é
              gerado é o SLUG, que vira o endereço da peça na loja. */}
          <div className="border-caqui-orange-500/25 bg-caqui-orange-500/8 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span className="text-caqui-ink-500 text-[11px] tracking-wider uppercase">
              Endereço
            </span>
            <span className="text-caqui-ink-500 font-mono">gerado automaticamente ao salvar</span>
          </div>

          {/* Nome + preços. No Dália a direita tem três: preço, custo e
              promocional. A Caqui tem um preço só por peça, e o preço por
              variante fica na grade lá embaixo, onde ele de fato varia. */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className={ROTULO} htmlFor="peca-nome">
                Nome da Peça *
              </label>
              <input
                id="peca-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={CAMPO}
                placeholder="Ex: Camiseta Dry Fit Caqui"
                required
              />
            </div>

            <div>
              <label className={ROTULO} htmlFor="peca-preco">
                Preço *
              </label>
              <input
                id="peca-preco"
                type="text"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className={CAMPO}
                placeholder="0,00"
                required
              />
              <p className="text-caqui-ink-500 mt-2 text-xs">
                Preço base, em reais. A variante pode ter o próprio.
              </p>
            </div>
          </div>

          <div>
            <label className={ROTULO} htmlFor="peca-descricao">
              Descrição
            </label>
            <textarea
              id="peca-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              className={cn(CAMPO, 'resize-y')}
              placeholder="Descreva a peça..."
            />
          </div>

          {/* A grade de quatro do Dália. Categoria e publicação são o que a
              Caqui tem; custo, material, gênero e estoque não existem aqui. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={ROTULO} htmlFor="peca-categoria">
                Categoria *
              </label>
              <select
                id="peca-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className={CAMPO}
                required
              >
                <option value="">Selecione</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors',
              publicar
                ? 'border-caqui-forest-600 bg-caqui-forest-300/15'
                : 'border-caqui-sand-200 hover:border-caqui-forest-600/50',
            )}
          >
            <input
              type="checkbox"
              checked={publicar}
              onChange={(e) => setPublicar(e.target.checked)}
              className="accent-caqui-forest-600 size-5"
            />
            <span className="text-sm">
              <strong>Publicar na loja.</strong> Desmarcado, a peça fica em rascunho: você vê no
              painel, o cliente não.
            </span>
          </label>

          {/* ── UM QUADRO DE FOTO POR COR ────────────────────────────────
              O Dália faz isso quando o material é "Ambas": ele parte a grade
              em "Imagens · Dourado" e "Imagens · Prata", na ordem fixa.

              Aqui a mesma ideia, mas dirigida pelas cores que a pessoa
              escreveu — escreveu uma cor nova lá embaixo, nasce um quadro aqui
              em cima. É o que o `colorName` de `MediaAsset` existe para
              guardar, a pedido registrado no schema: "a cor amarela pode ser
              imagem dois, a cor azul pode ser imagem um".

              A REGRA QUE DECIDE O RESTO, e ela está no schema: na dúvida, foto
              NEUTRA, nunca a cor errada. Foto genérica é informação faltando;
              foto da cor errada é informação falsa. Por isso o quadro neutro
              existe sempre, mesmo com cores cadastradas. */}
          <div>
            <label className={ROTULO}>Imagens da Peça</label>
            <p className="text-caqui-ink-500 mb-4 text-xs">
              Cada cor que você escrever em <strong>Tamanhos e Cores</strong> ganha o próprio quadro
              aqui. A foto de cada cor é a que o cliente vê ao escolher aquela cor na loja.
            </p>

            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {coresDaPeca.map((cor, i) => (
                <div key={cor.toLowerCase()} className="flex flex-col gap-2">
                  <div
                    className={cn(
                      'border-caqui-sand-200 flex aspect-square flex-col items-center justify-center gap-2',
                      'rounded-lg border-2 border-dashed p-3 text-center',
                    )}
                  >
                    <span aria-hidden="true" className="text-caqui-ink-500 text-2xl leading-none">
                      +
                    </span>
                    <span className="text-caqui-ink-500 text-xs">Foto {i + 1}</span>
                  </div>
                  <p className="text-caqui-ink-700 truncate text-center text-xs font-medium">
                    {cor}
                  </p>
                </div>
              ))}

              <div className="flex flex-col gap-2">
                <div
                  className={cn(
                    'border-caqui-sand-200 flex aspect-square flex-col items-center justify-center gap-2',
                    'rounded-lg border-2 border-dashed p-3 text-center',
                  )}
                >
                  <span aria-hidden="true" className="text-caqui-ink-500 text-2xl leading-none">
                    +
                  </span>
                  <span className="text-caqui-ink-500 text-xs">Foto neutra</span>
                </div>
                <p className="text-caqui-ink-500 text-center text-xs">serve para qualquer cor</p>
              </div>
            </div>

            {coresDaPeca.length === 0 && (
              <p className="border-caqui-sand-200 bg-caqui-sand-100 rounded-lg border px-3 py-2 text-xs">
                Escreva uma cor em <strong>Tamanhos e Cores</strong> e um quadro para a foto dela
                aparece aqui.
              </p>
            )}

            <p className="text-caqui-ink-500 mt-3 text-xs">
              JPG ou PNG. O envio liga quando o storage estiver configurado. Na dúvida entre uma
              foto genérica e a da cor errada, use a neutra: foto errada é informação falsa.
            </p>
          </div>

          {/* Tamanhos e cores: é aqui que a Caqui diverge de verdade do Dália,
              e por um acerto. Lá, variação de cor era PRODUTO SEPARADO unido
              por uma string livre; aqui a variante é entidade própria, com
              tamanho e cor de verdade. Ver o comentário de `ProductVariant`. */}
          <div>
            <label className={ROTULO}>Tamanhos e Cores *</label>
            <p className="text-caqui-ink-500 mb-4 text-xs">
              Cada combinação de tamanho e cor é uma variante. É ela que o cliente escolhe na loja.
            </p>

            <div className="space-y-3">
              {variantes.map((v, i) => (
                <div
                  key={i}
                  className="border-caqui-sand-200 grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-2">
                    <select
                      aria-label={`Tamanho da variante ${i + 1}`}
                      value={v.size}
                      onChange={(e) => mudarVariante(i, { size: e.target.value })}
                      className={CAMPO}
                    >
                      {TAMANHOS.map((t) => (
                        <option key={t} value={t}>
                          {rotuloDeTamanho(t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      aria-label={`Cor da variante ${i + 1}`}
                      value={v.colorName}
                      onChange={(e) => mudarCor(i, e.target.value)}
                      className={CAMPO}
                      placeholder="Cor (ex.: Azul Marinho)"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Preço próprio da variante ${i + 1}`}
                      value={v.precoProprio}
                      onChange={(e) => mudarVariante(i, { precoProprio: e.target.value })}
                      className={CAMPO}
                      placeholder="Preço próprio"
                    />
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-3">
                    <input
                      type="color"
                      aria-label={`Tom da variante ${i + 1}`}
                      value={v.colorHex}
                      onChange={(e) => mudarVariante(i, { colorHex: e.target.value })}
                      className="border-caqui-sand-200 size-11 shrink-0 rounded-lg border bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setVariantes((a) => a.filter((_, j) => j !== i))}
                      disabled={variantes.length === 1}
                      aria-label={`Remover variante ${i + 1}`}
                      className={cn(
                        'text-caqui-ink-500 hover:text-caqui-danger ml-auto size-11 rounded-lg',
                        'transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      )}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setVariantes((a) => [...a, varianteVazia()])}
              className={cn(
                'border-caqui-sand-200 hover:border-caqui-orange-400 mt-3 w-full rounded-lg border-2',
                'border-dashed px-4 py-3 text-sm transition-colors',
              )}
            >
              + Adicionar tamanho ou cor
            </button>
          </div>

          <div className="border-caqui-sand-200 flex flex-wrap justify-end gap-3 border-t pt-6">
            <button
              type="button"
              onClick={() => router.push('/crm/produtos')}
              disabled={enviando}
              className="border-caqui-sand-200 hover:bg-caqui-sand-100 rounded-lg border px-6 py-3 text-sm transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className={cn(
                'bg-caqui-orange-500 hover:bg-caqui-orange-600 rounded-lg px-6 py-3',
                'text-caqui-ink-900 text-sm font-medium transition-colors disabled:opacity-60',
              )}
            >
              {enviando ? 'Salvando…' : 'Cadastrar peça'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
