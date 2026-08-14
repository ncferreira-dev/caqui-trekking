'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialogo'
import { cn } from '@/lib/ui/cn'

/**
 * A zona de upload de fotos, com moldura de enquadramento.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ISTO É UM PROTÓTIPO — AINDA NÃO ENVIA NADA
 * ════════════════════════════════════════════════════════════════════════════
 * O envio de verdade liga com o Cloudinary (`POST /api/admin/media`, hoje 503).
 * Enquanto a credencial não chega, esta área existe para a Caqui ver e aprovar
 * o fluxo: escolher os arquivos, enquadrar cada um, reordenar. As fotos vivem
 * só no navegador (object URLs) e somem ao sair da página. O aviso na tela diz
 * isso com todas as letras — protótipo que se disfarça de pronto é pior que
 * protótipo nenhum.
 *
 * Quando o Cloudinary entrar, o que muda é uma coisa só: em vez de guardar o
 * arquivo local, `aoEscolher` faz o upload e o `enquadramento` vai junto como
 * transformação (`a_${angulo},c_crop`…). A moldura abaixo já produz os números
 * exatos que o Cloudinary consome.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O ENQUADRAMENTO É EM FRAÇÃO, NÃO EM PIXEL — POR ISSO A MINIATURA BATE
 * ════════════════════════════════════════════════════════════════════════════
 * `x` e `y` vão de -1 a 1, fração da metade do quadro, e não pixels. Assim a
 * mesma transformação vale para a moldura grande (onde a pessoa arrasta) e para
 * a miniatura de 80px, sem recalcular: `translate(${x*50}%, ${y*50}%)` se
 * adapta ao tamanho de quem renderiza. Guardar pixel amarraria o enquadramento
 * ao tamanho da tela em que foi feito.
 */

type Enquadramento = {
  /** Graus, -180 a 180. */
  angulo: number
  /** Escala, 1 a 3. Abaixo de 1 apareceria borda vazia dentro do quadro. */
  zoom: number
  /** Deslocamento horizontal, fração de -1 a 1. */
  x: number
  /** Deslocamento vertical, fração de -1 a 1. */
  y: number
}

const PADRAO: Enquadramento = { angulo: 0, zoom: 1, x: 0, y: 0 }

type FotoLocal = { id: string; url: string; nome: string; enquad: Enquadramento }

function transformDe(e: Enquadramento): string {
  return `translate(${e.x * 50}%, ${e.y * 50}%) rotate(${e.angulo}deg) scale(${e.zoom})`
}

export function ZonaDeUpload({ max = 6 }: { max?: number }) {
  const [fotos, setFotos] = useState<FotoLocal[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Object URL vaza memória se não for revogado. A limpeza acontece no
  // desmonte, lendo a lista mais recente por ref (mutar ref em efeito é
  // permitido; o que o React Compiler recusa é setState em efeito).
  const fotosRef = useRef(fotos)
  useEffect(() => {
    fotosRef.current = fotos
  })
  useEffect(() => {
    return () => {
      for (const f of fotosRef.current) URL.revokeObjectURL(f.url)
    }
  }, [])

  const editando = fotos.find((f) => f.id === editandoId) ?? null

  function aoEscolher(lista: FileList | null) {
    if (!lista) return
    const espaco = max - fotos.length
    const novas: FotoLocal[] = []
    for (const arquivo of Array.from(lista).slice(0, espaco)) {
      if (!arquivo.type.startsWith('image/')) continue
      novas.push({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(arquivo),
        nome: arquivo.name,
        enquad: PADRAO,
      })
    }
    if (novas.length > 0) setFotos((atual) => [...atual, ...novas])
    // Zera o input para o mesmo arquivo poder ser reescolhido depois de removido.
    if (inputRef.current) inputRef.current.value = ''
  }

  function remover(id: string) {
    setFotos((atual) => {
      const alvo = atual.find((f) => f.id === id)
      if (alvo) URL.revokeObjectURL(alvo.url)
      return atual.filter((f) => f.id !== id)
    })
  }

  function salvarEnquadramento(id: string, enquad: Enquadramento) {
    setFotos((atual) => atual.map((f) => (f.id === id ? { ...f, enquad } : f)))
    setEditandoId(null)
  }

  const cheio = fotos.length >= max

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caqui-ink-900 text-rotulo font-mono uppercase">
          Fotos da peça <span className="text-caqui-ink-500">(máx. {max})</span>
        </span>
        <span className="text-caqui-ink-500 text-micro font-mono uppercase">
          {fotos.length} de {max}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((foto, i) => (
          <figure
            key={foto.id}
            className="border-caqui-ink-900 group relative aspect-square overflow-hidden border bg-white"
          >
            <img
              src={foto.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: transformDe(foto.enquad), transformOrigin: 'center' }}
            />

            {/* A primeira é a capa: é ela que vira o card da loja e o Open
                Graph. Dizer isso na miniatura evita a dúvida "qual aparece?". */}
            {i === 0 && (
              <figcaption className="bg-caqui-ink-900 text-micro absolute top-0 left-0 px-1.5 py-0.5 font-mono text-white uppercase">
                Capa
              </figcaption>
            )}

            <div className="absolute inset-x-0 bottom-0 flex divide-x divide-white/30 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => setEditandoId(foto.id)}
                className="text-micro flex-1 py-1.5 font-mono text-white uppercase hover:bg-white/15"
              >
                Ângulo
              </button>
              <button
                type="button"
                onClick={() => remover(foto.id)}
                className="text-micro flex-1 py-1.5 font-mono text-white uppercase hover:bg-white/15"
              >
                Tirar
              </button>
            </div>
          </figure>
        ))}

        {/* O box tracejado de adicionar, no padrão que a Caqui já conhece do
            outro sistema: some quando o limite é atingido. */}
        {!cheio && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-caqui-rule-forte text-caqui-ink-500 flex aspect-square flex-col items-center justify-center gap-1 border border-dashed',
              'hover:border-caqui-ink-900 hover:text-caqui-ink-900 hover:bg-caqui-sand-100 transition-colors',
            )}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              +
            </span>
            <span className="text-micro font-mono uppercase">Adicionar</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => aoEscolher(e.target.files)}
        className="sr-only"
      />

      <p className="text-caqui-ink-500 text-micro font-mono uppercase">
        JPG, PNG ou WEBP. Máx. 5 MB por imagem. Arraste dentro da moldura para enquadrar.
      </p>

      {/* O aviso que impede o protótipo de mentir. */}
      <div className="border-caqui-orange-500 bg-caqui-sand-100 text-corpo-sm border-l-4 px-3 py-2">
        <strong className="text-caqui-ink-900">Prévia, ainda não salva.</strong> O envio das fotos
        liga com a configuração do Cloudinary. Por enquanto dá para testar o enquadramento; as
        imagens não ficam guardadas ao sair.
      </div>

      {editando && (
        <MolduraDeAngulo
          key={editando.id}
          foto={editando}
          aoSalvar={(enquad) => salvarEnquadramento(editando.id, enquad)}
          aoFechar={() => setEditandoId(null)}
        />
      )}
    </div>
  )
}

/**
 * A moldura de enquadramento.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUADRO É A VERDADE — O QUE FICA DENTRO É O QUE A LOJA MOSTRA
 * ────────────────────────────────────────────────────────────────────────────
 * A loja recorta toda foto em quadrado (`object-cover`). Sem esta moldura, a
 * Caqui subiria uma foto retangular e descobriria o corte só depois, na loja,
 * com a cabeça do modelo fora. Aqui ela vê o quadrado final e ajusta: gira,
 * aproxima, arrasta até enquadrar. O que está dentro da borda é exatamente o
 * que sai.
 *
 * Arrastar mexe em `x`/`y`; a roda de rotação e os dois controles deslizantes
 * fazem o resto. Nada aqui depende de biblioteca: é `transform` de CSS, o mesmo
 * que a miniatura e a loja usam.
 */
function MolduraDeAngulo({
  foto,
  aoSalvar,
  aoFechar,
}: {
  foto: FotoLocal
  aoSalvar: (e: Enquadramento) => void
  aoFechar: () => void
}) {
  const [enquad, setEnquad] = useState<Enquadramento>(foto.enquad)
  const quadroRef = useRef<HTMLDivElement>(null)
  const arrasto = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  function limitar(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n))
  }

  function aoApontar(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    arrasto.current = { x: e.clientX, y: e.clientY, ox: enquad.x, oy: enquad.y }
  }

  function aoMover(e: React.PointerEvent) {
    const inicio = arrasto.current
    const quadro = quadroRef.current
    if (!inicio || !quadro) return
    const lado = quadro.getBoundingClientRect().width || 1
    // Delta em pixels vira fração da metade do quadro: mover meio quadro = 1.
    const dx = ((e.clientX - inicio.x) / lado) * 2
    const dy = ((e.clientY - inicio.y) / lado) * 2
    setEnquad((atual) => ({
      ...atual,
      x: limitar(inicio.ox + dx, -1, 1),
      y: limitar(inicio.oy + dy, -1, 1),
    }))
  }

  function aoSoltar(e: React.PointerEvent) {
    arrasto.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <Modal aberto titulo="Enquadrar foto" aoFechar={aoFechar}>
      <div className="flex flex-col gap-4">
        {/* O quadro. `touch-none` para o arrasto não brigar com a rolagem no
            celular — sem isso, mover a foto rolaria a página junto. */}
        <div
          ref={quadroRef}
          onPointerDown={aoApontar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          className="border-caqui-ink-900 relative mx-auto aspect-square w-full max-w-sm cursor-grab touch-none overflow-hidden border bg-white active:cursor-grabbing"
        >
          <img
            src={foto.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
            style={{ transform: transformDe(enquad), transformOrigin: 'center' }}
          />
          {/* A cruz central ajuda a alinhar o assunto no meio. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="absolute top-1/2 right-0 left-0 h-px bg-white/40" />
            <span className="absolute top-0 bottom-0 left-1/2 w-px bg-white/40" />
          </div>
        </div>

        <Controle
          rotulo="Girar"
          valor={enquad.angulo}
          min={-180}
          max={180}
          passo={1}
          sufixo="°"
          aoMudar={(angulo) => setEnquad((a) => ({ ...a, angulo }))}
        />
        <Controle
          rotulo="Zoom"
          valor={enquad.zoom}
          min={1}
          max={3}
          passo={0.01}
          sufixo="×"
          casas={2}
          aoMudar={(zoom) => setEnquad((a) => ({ ...a, zoom }))}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variante="secondary"
            tamanho="sm"
            onClick={() => setEnquad((a) => ({ ...a, angulo: girar90(a.angulo) }))}
          >
            Girar 90°
          </Button>
          <Button variante="secondary" tamanho="sm" onClick={() => setEnquad(PADRAO)}>
            Recomeçar
          </Button>
        </div>

        <div className="border-caqui-rule flex justify-end gap-2 border-t pt-4">
          <Button variante="secondary" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => aoSalvar(enquad)}>Aplicar enquadramento</Button>
        </div>
      </div>
    </Modal>
  )
}

/** Próximo múltiplo de 90 acima do ângulo atual, dobrando de volta em 180. */
function girar90(angulo: number): number {
  const proximo = Math.floor(angulo / 90) * 90 + 90
  return proximo > 180 ? proximo - 360 : proximo
}

/**
 * Formata o número do controle. `Intl` e não `toFixed`: o ESLint do projeto
 * bloqueia `toFixed` para forçar todo arredondamento a passar por um formatador
 * explícito. Aqui é rótulo de controle deslizante, então o locale pt-BR (vírgula
 * decimal) é o certo — "1,50×", "45°".
 */
function formatarValor(valor: number, casas: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor)
}

function Controle({
  rotulo,
  valor,
  min,
  max,
  passo,
  sufixo,
  casas = 0,
  aoMudar,
}: {
  rotulo: string
  valor: number
  min: number
  max: number
  passo: number
  sufixo: string
  casas?: number
  aoMudar: (n: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-caqui-ink-900 text-rotulo font-mono uppercase">{rotulo}</span>
        <span className="text-caqui-ink-700 text-micro font-mono">
          {formatarValor(valor, casas)}
          {sufixo}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))}
        className="accent-caqui-orange-500 w-full"
      />
    </label>
  )
}
