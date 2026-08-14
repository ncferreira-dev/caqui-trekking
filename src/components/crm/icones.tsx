/**
 * Os ícones do painel.
 *
 * Desenhados aqui, com o mesmo traço gravado dos grafismos da marca: contorno
 * de 1,6px, terminação reta, sem preenchimento. Um pacote de ícones traria um
 * quarto estilo para dentro de um projeto que já tem três (brasão, montanhas,
 * curva de nível) — e 40 KB para usar seis desenhos.
 *
 * Todos `aria-hidden`: o rótulo em texto está sempre ao lado, e um ícone
 * anunciado junto do próprio nome é redundância que atrapalha quem ouve.
 */

const BASE = {
  className: 'size-5 shrink-0',
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  'aria-hidden': true,
} as const

export function IconePainel() {
  return (
    <svg {...BASE}>
      <path d="M3 10.5 10 4l7 6.5" strokeLinejoin="round" />
      <path d="M5 9.5V16h10V9.5" />
      <path d="M8.5 16v-4h3v4" />
    </svg>
  )
}

export function IconeCalendario() {
  return (
    <svg {...BASE}>
      <path d="M3.5 5.5h13V16h-13z" />
      <path d="M3.5 8.5h13" />
      <path d="M7 3.5v3M13 3.5v3" strokeLinecap="square" />
      <path d="M6.5 11.5h2M6.5 13.5h7" strokeLinecap="square" />
    </svg>
  )
}

export function IconeTrilha() {
  return (
    <svg {...BASE}>
      <path d="M2 16 8 5l3.5 6.5L13.5 8l4.5 8z" strokeLinejoin="round" />
      <path d="M6 11h4" strokeLinecap="square" />
    </svg>
  )
}

export function IconeCamiseta() {
  return (
    <svg {...BASE}>
      <path d="M7.5 3.5 4 5.5l1.5 3 1-.5V16h7V8l1 .5 1.5-3-3.5-2z" strokeLinejoin="round" />
      <path d="M7.5 3.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  )
}

export function IconeMensagem() {
  return (
    <svg {...BASE}>
      <path d="M3.5 4.5h13v9h-8l-3.5 3v-3h-1.5z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconeAjustes() {
  return (
    <svg {...BASE}>
      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="square" />
      <circle cx="7.5" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconeAlerta({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path d="M10 3 2.5 16.5h15z" strokeLinejoin="round" />
      <path d="M10 8v3.5" strokeLinecap="square" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconeSair() {
  return (
    <svg {...BASE} className="size-4 shrink-0">
      <path d="M8 3.5H4.5v13H8" />
      <path d="M11 6.5 14.5 10 11 13.5" strokeLinejoin="round" />
      <path d="M14.5 10h-8" strokeLinecap="square" />
    </svg>
  )
}
