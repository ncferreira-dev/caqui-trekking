import { cn } from '@/lib/ui/cn'

/**
 * Os dois selos do sistema — e eles são deliberadamente de FORMAS diferentes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO SÃO O MESMO COMPONENTE COM CORES DIFERENTES
 * ────────────────────────────────────────────────────────────────────────────
 * Dificuldade e disponibilidade aparecem lado a lado no mesmo card. Se fossem
 * dois retângulos arredondados iguais mudando só de cor, o olho teria que ler
 * os dois para saber qual é qual — e quem não distingue verde de vermelho não
 * saberia nunca.
 *
 * Então: dificuldade é um HEXÁGONO (a forma do brasão da Caqui) com um medidor
 * de 4 traços; disponibilidade é uma FLÂMULA com entalhe e um glifo. Formas
 * diferentes, silhuetas diferentes, legíveis em preto e branco, legíveis de
 * relance.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A COR NÃO CARREGA A INFORMAÇÃO — ELA SÓ REFORÇA
 * ────────────────────────────────────────────────────────────────────────────
 * A rampa de dificuldade que o briefing pede (verde → vermelho) NÃO é
 * monotônica em luminância: medindo, `#2D6A4F` dá 0,114 e `#C1121F` dá 0,119.
 * São indistinguíveis em escala de cinza — a diferença é de 4%. Ou seja, para
 * quem tem protanopia, "Moderado" e "Difícil" são a mesma coisa.
 *
 * Por isso cada nível carrega TRÊS sinais independentes: a contagem de traços
 * preenchidos (1 a 4), o rótulo escrito por extenso, e a cor. Tire a cor e o
 * componente continua funcionando. É o teste que um chip de status colorido
 * nunca passa.
 *
 * Os glifos são desenhados em SVG, não em Unicode: `◐` e `✕` faltam em muitas
 * fontes e o navegador troca de família no meio da string, quebrando o
 * alinhamento e o espacejamento.
 */

// ─── Dificuldade ─────────────────────────────────────────────────────────────

export type Dificuldade = 'FACIL' | 'MODERADO' | 'DIFICIL' | 'EXTREMO'

const DIFICULDADE: Record<Dificuldade, { rotulo: string; traços: number; classe: string }> = {
  // ink-900 sobre forest-300 = 11,51:1
  FACIL: { rotulo: 'Fácil', traços: 1, classe: 'bg-caqui-forest-300 text-caqui-ink-900' },
  // branco sobre forest-600 = 6,39:1
  MODERADO: { rotulo: 'Moderado', traços: 2, classe: 'bg-caqui-forest-600 text-white' },
  // branco sobre danger = 6,22:1
  DIFICIL: { rotulo: 'Difícil', traços: 3, classe: 'bg-caqui-danger text-white' },
  // branco sobre ink-900 = 19,44:1
  EXTREMO: { rotulo: 'Extremo', traços: 4, classe: 'bg-caqui-ink-900 text-white' },
}

/**
 * Hexágono deitado, citando o brasão.
 *
 * O `padding` lateral de 14px não é estético: o `clip-path` corta os 10px de
 * bico de cada lado, e sem folga o primeiro traço do medidor sumiria.
 */
const HEXAGONO =
  '[clip-path:polygon(10px_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,10px_100%,0_50%)]'

export function BadgeDificuldade({ nivel, className }: { nivel: Dificuldade; className?: string }) {
  const { rotulo, traços, classe } = DIFICULDADE[nivel]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 py-1.5 pr-3.5 pl-3.5',
        'text-micro font-mono uppercase',
        HEXAGONO,
        classe,
        className,
      )}
    >
      <Medidor preenchidos={traços} />
      {rotulo}
    </span>
  )
}

/**
 * Medidor de 4 posições.
 *
 * Os vazios são CONTORNADOS em `currentColor`, não pintados de cinza claro.
 * Cinza claro sobre fundo colorido cai para 1,4:1 e some — e aí "2 de 4" vira
 * "duas marcas soltas", que é justamente a informação que o medidor existe
 * para dar.
 */
function Medidor({ preenchidos }: { preenchidos: number }) {
  return (
    <span className="flex gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((posicao) => (
        <span
          key={posicao}
          className={cn(
            'block h-2.5 w-[5px] border border-current',
            posicao <= preenchidos ? 'bg-current' : 'bg-transparent opacity-55',
          )}
        />
      ))}
    </span>
  )
}

// ─── Disponibilidade ─────────────────────────────────────────────────────────

export type Disponibilidade = 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'

const DISPONIBILIDADE: Record<
  Disponibilidade,
  { rotulo: string; classe: string; glifo: 'cheio' | 'meio' | 'x'; trama: boolean }
> = {
  AVAILABLE: {
    rotulo: 'Vagas abertas',
    classe: 'bg-caqui-forest-300 text-caqui-ink-900',
    glifo: 'cheio',
    trama: false,
  },
  LAST_SPOTS: {
    // ink-900 sobre orange-500 = 6,16:1. Branco daria 3,15:1 e reprovaria.
    rotulo: 'Últimas vagas',
    classe: 'bg-caqui-orange-500 text-caqui-ink-900',
    glifo: 'meio',
    trama: false,
  },
  SOLD_OUT: {
    rotulo: 'Esgotado',
    classe: 'bg-caqui-danger text-white',
    glifo: 'x',
    trama: true,
  },
}

/** Flâmula com entalhe à direita. Silhueta oposta à do hexágono. */
const FLAMULA = '[clip-path:polygon(0_0,100%_0,calc(100%-9px)_50%,100%_100%,0_100%)]'

export function BadgeDisponibilidade({
  estado,
  className,
}: {
  estado: Disponibilidade
  className?: string
}) {
  const { rotulo, classe, glifo, trama } = DISPONIBILIDADE[estado]

  return (
    <span
      className={cn(
        // 18px de respiro à direita: 9px de entalhe + 9px para o último glifo
        // não ser cortado pelo `clip-path`.
        'relative inline-flex items-center gap-2 py-1.5 pr-[18px] pl-3',
        'text-micro font-mono uppercase',
        FLAMULA,
        classe,
        className,
      )}
    >
      {trama && <span className="trama-indisponivel absolute inset-0" aria-hidden="true" />}
      <Glifo tipo={glifo} />
      <span className="relative">{rotulo}</span>
    </span>
  )
}

function Glifo({ tipo }: { tipo: 'cheio' | 'meio' | 'x' }) {
  return (
    <svg viewBox="0 0 10 10" className="relative size-2.5 shrink-0" aria-hidden="true">
      {tipo === 'cheio' && <circle cx="5" cy="5" r="4.25" fill="currentColor" />}
      {tipo === 'meio' && (
        <>
          <circle cx="5" cy="5" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 .75A4.25 4.25 0 0 1 5 9.25Z" fill="currentColor" />
        </>
      )}
      {tipo === 'x' && (
        <path
          d="M1.5 1.5l7 7M8.5 1.5l-7 7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="square"
        />
      )}
    </svg>
  )
}

// ─── Etiqueta neutra ─────────────────────────────────────────────────────────

/**
 * Rótulo sem semântica de estado: categoria, tag de atividade, região.
 * Retângulo simples, de propósito — se tivesse forma própria, competiria com
 * os dois selos que precisam ser reconhecidos de relance.
 */
export function Etiqueta({
  children,
  tom = 'neutro',
  className,
}: {
  children: React.ReactNode
  tom?: 'neutro' | 'mata'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-1',
        'text-micro font-mono uppercase',
        tom === 'mata'
          ? 'border-caqui-forest-800 text-caqui-forest-800 bg-white'
          : 'border-caqui-rule text-caqui-ink-700 bg-caqui-sand-100',
        className,
      )}
    >
      {children}
    </span>
  )
}
