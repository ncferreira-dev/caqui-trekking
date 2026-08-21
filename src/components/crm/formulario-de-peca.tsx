'use client'

import { useId, useState } from 'react'

import { api, ErroDaApi } from '@/lib/crm/api'
import { corSugerida } from '@/lib/cores'
import { rotuloDeTamanho } from '@/lib/formato'
import { centavosParaReais, reaisParaCentavos } from '@/lib/money'
import { cn } from '@/lib/ui/cn'

/**
 * O FORMULÁRIO DE PEÇA. Um só, para cadastrar e para editar.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ELE FOI EXTRAÍDO
 * ════════════════════════════════════════════════════════════════════════════
 * Em 20/08/2026 o cadastro virou página inteira, no molde do projeto de
 * referência, e a edição continuou no modal antigo. O resultado foi a MESMA
 * peça com duas caras: campos espaçosos e arredondados de um lado, densos e
 * com rótulo mono em caixa-alta do outro.
 *
 * Pior que a estética: eram 866 linhas em dois arquivos com a mesma validação,
 * a mesma montagem de variante e a mesma conversão de preço, escritas duas
 * vezes. O primeiro campo novo que alguém acrescentasse entraria em um e não
 * no outro — e o repositório já foi mordido por duplicação assim antes (ver o
 * comentário de `atualizarProduto` sobre reconciliação de variantes).
 *
 * Agora é UM formulário. Quem muda é só a casca: página quando se cadastra,
 * modal quando se edita — que é a mesma divisão do projeto de referência, onde
 * `CreateProductForm` tem rota própria e `EditProductModal` é modal.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUATRO CAMPOS DO DÁLIA NÃO EXISTEM AQUI, E ISSO NÃO É ESQUECIMENTO
 * ════════════════════════════════════════════════════════════════════════════
 * CUSTO, MATERIAL, GÊNERO e ESTOQUE não têm coluna no schema da Caqui, e o
 * estoque é ausência DELIBERADA: a disponibilidade é controlada na conversa do
 * WhatsApp, e a variante é um liga/desliga sem quantidade. Um formulário que
 * pede estoque num sistema sem estoque produz um número que ninguém mantém.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O LARANJA NÃO PODE SER COR DE TEXTO
 * ════════════════════════════════════════════════════════════════════════════
 * `#F26522` sobre branco dá 3,15:1 e reprova no AA. Ele aparece aqui como
 * fundo e como borda, nunca como texto — o ESLint do projeto recusa.
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

type Variante = VarianteForm

function varianteVazia(): Variante {
  return { size: 'UNICO', colorName: '', colorHex: '#000000', available: true, precoProprio: '' }
}

/** As classes do campo: geometria do Dália, tokens da Caqui. */
const CAMPO = cn(
  'w-full rounded-lg border border-caqui-sand-200 bg-white px-4 py-3',
  'transition-colors focus:border-caqui-orange-500 focus:outline-none',
)

const ROTULO = 'mb-2 block text-sm font-medium text-caqui-ink-700'

export function FormularioDePeca({
  produto,
  aoTerminar,
  /** O `<form>` fica aqui; o botão de salvar pode viver fora, no rodapé da casca. */
  idDoForm,
}: {
  /** Ausente = cadastrar. Presente = editar. */
  produto?: ProdutoParaEditar
  /**
   * Recebe o id da peça — o RECÉM-CRIADO no cadastro, o mesmo na edição.
   *
   * O parâmetro existe por causa das fotos: o caminho do arquivo no provedor
   * é `caqui/product/<id>/…`, então só depois do `INSERT` há para onde subir.
   * Quem chama decide o que fazer com ele (a página de cadastro segue para as
   * fotos; o modal de edição fecha).
   */
  aoTerminar: (produtoId: number) => void
  idDoForm: string
}) {
  const editando = produto !== undefined
  const idInterno = useId()
  const id = idDoForm || idInterno

  const [nome, setNome] = useState(produto?.name ?? '')
  const [descricao, setDescricao] = useState(produto?.description ?? '')
  const [categoria, setCategoria] = useState(produto?.category ?? '')
  const [preco, setPreco] = useState(produto ? centavosParaReais(produto.priceCentavos) : '')
  const [publicar, setPublicar] = useState(produto?.status === 'PUBLISHED')
  const [variantes, setVariantes] = useState<Variante[]>(
    produto?.variantes.length ? produto.variantes : [varianteVazia()],
  )

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  /**
   * As cores distintas que a peça tem AGORA, na ordem em que foram escritas.
   *
   * É o que liga a grade de fotos à grade de variantes: escreveu uma cor nova
   * lá embaixo, aparece um quadro de foto aqui em cima. A dedução ignora a
   * caixa, para "Azul Marinho" e "azul marinho" não abrirem dois quadros da
   * mesma cor — e a grafia que vale é a primeira digitada.
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

    const corpo = {
      name: nome.trim(),
      description: descricao.trim() || null,
      category: categoria,
      priceCents: centavos,
      status: publicar ? ('PUBLISHED' as const) : ('DRAFT' as const),
      variantes: preparadas,
    }

    setEnviando(true)
    try {
      let produtoId: number
      if (editando) {
        await api.patch(`/api/admin/products/${produto.id}`, corpo)
        produtoId = produto.id
      } else {
        const criado = await api.post<{ id: number }>('/api/admin/products', corpo)
        produtoId = criado.id
      }

      setSucesso(editando ? 'Peça salva.' : 'Peça cadastrada.')
      aoTerminar(produtoId)
    } catch (causa) {
      setErro(
        causa instanceof ErroDaApi ? causa.message : 'Não foi possível salvar. Tente de novo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form id={id} onSubmit={enviar} noValidate>
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
        {/* SÓ no cadastro: editando, o endereço já existe e NÃO muda ao
            renomear a peça. Mudar a URL canônica em silêncio quebraria o
            link já mandado no WhatsApp e zeraria o ranking de busca, então
            prometer "gerado ao salvar" numa peça que já tem endereço seria
            mentira. */}
        {!editando && (
          <div className="border-caqui-orange-500/25 bg-caqui-orange-500/8 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span className="text-caqui-ink-500 text-[11px] tracking-wider uppercase">
              Endereço
            </span>
            <span className="text-caqui-ink-500 font-mono">gerado automaticamente ao salvar</span>
          </div>
        )}

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
                <p className="text-caqui-ink-700 truncate text-center text-xs font-medium">{cor}</p>
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

          {/* OS QUADROS ACIMA SÃO PRÉVIA, E A TELA DIZ ISSO.
            Subir a foto exige o id da peça, que só existe depois do `INSERT`
            (ver o cabeçalho de `produtos/[id]/fotos/page.tsx`). Deixar um "+"
            clicável aqui, que falhasse ao salvar, seria protótipo disfarçado
            de pronto. */}
          {editando ? (
            <a
              href={`/crm/produtos/${produto.id}/fotos`}
              className="border-caqui-sand-200 hover:bg-caqui-sand-100 mt-3 inline-block rounded-lg border px-4 py-2 text-sm transition-colors"
            >
              Subir as fotos desta peça
            </a>
          ) : (
            <p className="text-caqui-ink-500 mt-3 text-xs">
              JPG ou PNG. Os quadros acima são a prévia: ao cadastrar, a próxima tela abre com uma
              gaveta por cor para você subir as fotos. Na dúvida entre uma foto genérica e a da cor
              errada, use a neutra: foto errada é informação falsa.
            </p>
          )}
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
      </div>

      {/* O botão de salvar mora na CASCA, não aqui: na página ele fecha o
          formulário, no modal ele vive no rodapé fixo. `form={id}` liga os
          dois sem duplicar o handler. */}
      <p className="sr-only" aria-live="polite">
        {enviando ? 'Salvando…' : ''}
      </p>
    </form>
  )
}
