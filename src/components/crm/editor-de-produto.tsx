'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/campo'
import { ZonaDeUpload } from '@/components/crm/zona-de-upload'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { rotuloDeTamanho } from '@/lib/formato'
import { centavosParaReais, reaisParaCentavos } from '@/lib/money'
import { cn } from '@/lib/ui/cn'

/**
 * O cadastro de peça — criar e editar, com a grade de variantes embutida.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A PEÇA E SUAS VARIANTES SÃO UM FORMULÁRIO SÓ
 * ────────────────────────────────────────────────────────────────────────────
 * Uma peça sem variante não é comprável — o site não mostra botão de comprar
 * para ela. Se o cadastro salvasse a peça primeiro e as variantes depois, entre
 * um passo e outro existiria um produto publicado e inerte. Aqui as duas coisas
 * vão juntas: o botão de salvar só envia quando há ao menos uma variante.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FOTO NÃO ENTRA AQUI, E ISSO ESTÁ ESCRITO NA TELA
 * ────────────────────────────────────────────────────────────────────────────
 * A galeria (várias fotos por peça) depende do Cloudinary, que ainda não tem
 * credencial. Em vez de uma área de arrastar que sempre falha, o formulário diz
 * que a foto entra depois — a peça é cadastrada e navegável, e a loja mostra o
 * placeholder até a imagem chegar. Fingir um upload quebrado seria pior.
 */

const CATEGORIAS = [
  { valor: 'CAMISETA', rotulo: 'Camiseta' },
  { valor: 'REGATA', rotulo: 'Regata' },
  { valor: 'MOCHILA', rotulo: 'Mochila' },
  { valor: 'BONE', rotulo: 'Boné' },
  { valor: 'ACESSORIO', rotulo: 'Acessório' },
]

const TAMANHOS = ['UNICO', 'PP', 'P', 'M', 'G', 'GG', 'XG']

export type VarianteForm = {
  size: string
  colorName: string
  colorHex: string
  available: boolean
  /** Texto em reais, como o preço da peça. Vazio = usa o preço base. */
  precoProprio: string
}

export type ProdutoParaEditar = {
  id: number
  name: string
  description: string | null
  category: string
  priceCentavos: number
  status: 'DRAFT' | 'PUBLISHED'
  variantes: VarianteForm[]
}

function varianteVazia(): VarianteForm {
  return { size: 'UNICO', colorName: '', colorHex: '#000000', available: true, precoProprio: '' }
}

export function EditorDeProduto({
  aberto,
  aoFechar,
  produto,
}: {
  aberto: boolean
  aoFechar: () => void
  produto?: ProdutoParaEditar
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const idBase = useId()
  const editando = produto !== undefined

  const [nome, setNome] = useState(produto?.name ?? '')
  const [descricao, setDescricao] = useState(produto?.description ?? '')
  const [categoria, setCategoria] = useState(produto?.category ?? 'CAMISETA')
  const [preco, setPreco] = useState(produto ? centavosParaReais(produto.priceCentavos) : '')
  const [publicar, setPublicar] = useState(produto?.status === 'PUBLISHED')
  const [variantes, setVariantes] = useState<VarianteForm[]>(
    produto?.variantes.length ? produto.variantes : [varianteVazia()],
  )
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function mudarVariante(indice: number, campo: Partial<VarianteForm>) {
    setVariantes((atual) => atual.map((v, i) => (i === indice ? { ...v, ...campo } : v)))
  }

  function removerVariante(indice: number) {
    setVariantes((atual) => atual.filter((_, i) => i !== indice))
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    const centavos = reaisParaCentavos(preco)
    if (!nome.trim()) return setErro('Dê um nome à peça.')
    if (centavos === null) return setErro('Preço inválido. Use o formato 50,00.')

    const limpas = variantes.filter((v) => v.colorName.trim() !== '')
    if (limpas.length === 0) {
      return setErro('Cadastre ao menos uma variante com cor. É o que torna a peça comprável.')
    }

    // Preço próprio é opcional por variante: valida antes de montar o corpo
    // pra não gravar metade das variantes e falhar na última.
    const variantesPreparadas: {
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
      variantesPreparadas.push({
        size: v.size,
        colorName: v.colorName.trim(),
        colorHex: /^#[0-9a-fA-F]{6}$/.test(v.colorHex) ? v.colorHex : null,
        available: v.available,
        priceCents: precoVariante,
      })
    }

    const corpo = {
      name: nome.trim(),
      description: descricao.trim() || null,
      category: categoria,
      priceCents: centavos,
      status: publicar ? 'PUBLISHED' : 'DRAFT',
      variantes: variantesPreparadas,
    }

    setEnviando(true)
    try {
      if (editando) {
        await api.patch(`/api/admin/products/${produto.id}`, corpo)
        mostrar({ tom: 'sucesso', titulo: 'Peça salva' })
      } else {
        await api.post('/api/admin/products', corpo)
        mostrar({
          tom: 'sucesso',
          titulo: 'Peça cadastrada',
          descricao: publicar ? 'Já está na loja.' : 'Em rascunho. Publique quando quiser.',
        })
      }
      router.refresh()
      aoFechar()
    } catch (causa) {
      setErro(
        causa instanceof ErroDaApi ? causa.message : 'Não foi possível salvar. Tente de novo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? 'Editar peça' : 'Cadastrar peça'}
      className="w-[min(64rem,calc(100vw-2rem))]"
      rodape={
        <>
          <Button variante="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form={idBase} carregando={enviando}>
            {editando ? 'Salvar' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form id={idBase} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        {/* Identificação da peça numa linha só, como no formulário de
            referência: nome larga, categoria e preço ao lado. Empilha no
            celular, onde o CRM também é usado. */}
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <Input
            rotulo="Nome da peça"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Camiseta Dry Fit Caqui"
            obrigatorio
          />
          <Select
            rotulo="Categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            opcoes={CATEGORIAS}
          />
          <Input
            rotulo="Preço"
            inputMode="decimal"
            placeholder="50,00"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            dica="Preço base da peça, em reais."
            obrigatorio
          />
        </div>

        <Textarea
          rotulo="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Malha dry fit com a marca gravada. Feita para trilha e para o dia a dia."
          dica="Aparece na página da peça. Opcional."
          rows={3}
        />

        {/* ── Fotos: a zona de upload com moldura de enquadramento ─────────── */}
        <ZonaDeUpload max={6} />

        {/* ── Variantes ────────────────────────────────────────────────────── */}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-caqui-ink-900 text-rotulo mb-1 font-mono uppercase">
            Tamanhos e cores
          </legend>
          <p className="text-caqui-ink-500 text-corpo-sm -mt-2">
            Cada combinação de tamanho e cor é uma variante. Óculos e caneca são{' '}
            <strong>Único</strong>; camiseta tem P, M, G. É o que aparece para o cliente escolher.
            Preço próprio é opcional: em branco, a variante usa o preço base da peça.
          </p>

          <ul className="flex flex-col gap-2">
            {variantes.map((v, i) => (
              <li
                key={i}
                className="border-caqui-rule grid grid-cols-[5rem_1fr_6rem_6rem_auto_auto] items-center gap-2 border px-2 py-2"
              >
                <select
                  aria-label={`Tamanho da variante ${i + 1}`}
                  value={v.size}
                  onChange={(e) => mudarVariante(i, { size: e.target.value })}
                  className="border-caqui-ink-900 min-h-11 rounded-xs border bg-white px-2 font-mono text-sm uppercase"
                >
                  {TAMANHOS.map((t) => (
                    <option key={t} value={t}>
                      {rotuloDeTamanho(t)}
                    </option>
                  ))}
                </select>

                <input
                  aria-label={`Cor da variante ${i + 1}`}
                  value={v.colorName}
                  onChange={(e) => mudarVariante(i, { colorName: e.target.value })}
                  placeholder="Cor (ex.: Azul Marinho)"
                  className="border-caqui-ink-900 text-corpo-sm min-h-11 rounded-xs border bg-white px-3"
                />

                <input
                  aria-label={`Preço próprio da variante ${i + 1}`}
                  inputMode="decimal"
                  value={v.precoProprio}
                  onChange={(e) => mudarVariante(i, { precoProprio: e.target.value })}
                  placeholder="base"
                  className="border-caqui-ink-900 text-corpo-sm min-h-11 rounded-xs border bg-white px-2"
                />

                {/* O código da cor, digitável.
                    O seletor nativo do navegador abre um painel sem botão de
                    confirmar, e quem não quer caçar o tom na roda de cor fica
                    preso nele. Com o campo ao lado dá para colar o código que
                    veio da estamparia e ver a amostra mudar na hora. */}
                <input
                  aria-label={`Código da cor da variante ${i + 1}`}
                  value={v.colorHex}
                  onChange={(e) => {
                    const bruto = e.target.value.trim()
                    const texto = bruto.startsWith('#') ? bruto : `#${bruto}`
                    mudarVariante(i, { colorHex: texto.slice(0, 7) })
                  }}
                  placeholder="#000000"
                  spellCheck={false}
                  className="border-caqui-ink-900 min-h-11 rounded-xs border bg-white px-2 font-mono text-sm uppercase"
                />

                <input
                  type="color"
                  aria-label={`Amostra de cor da variante ${i + 1}`}
                  value={/^#[0-9a-fA-F]{6}$/.test(v.colorHex) ? v.colorHex : '#000000'}
                  onChange={(e) => mudarVariante(i, { colorHex: e.target.value })}
                  className="border-caqui-ink-900 size-11 shrink-0 rounded-xs border bg-white"
                />

                <button
                  type="button"
                  onClick={() => removerVariante(i)}
                  aria-label={`Remover variante ${i + 1}`}
                  disabled={variantes.length === 1}
                  className={cn(
                    'text-caqui-ink-500 hover:text-caqui-danger inline-flex size-11 items-center',
                    'justify-center rounded-xs disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                    <path
                      d="M2.5 2.5l11 11M13.5 2.5l-11 11"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variante="secondary"
            tamanho="sm"
            onClick={() => setVariantes((atual) => [...atual, varianteVazia()])}
            className="self-start"
          >
            + Adicionar variante
          </Button>
        </fieldset>

        <label className="border-caqui-ink-900 flex cursor-pointer items-start gap-3 border bg-white p-3">
          <input
            type="checkbox"
            checked={publicar}
            onChange={(e) => setPublicar(e.target.checked)}
            className="accent-caqui-orange-500 mt-0.5 size-5"
          />
          <span className="text-corpo-sm">
            <strong>Publicar na loja.</strong>
            <span className="text-caqui-ink-500 mt-0.5 block">
              Desmarcado, a peça fica em rascunho: você vê aqui, o cliente não.
            </span>
          </span>
        </label>

        {erro && (
          <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
