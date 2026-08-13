import { cn } from '@/lib/ui/cn'

/**
 * Grafismos da marca.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PARCIMÔNIA É REGRA, NÃO CONSELHO
 * ────────────────────────────────────────────────────────────────────────────
 * `<CurvaDeNivel>` no máximo 2 vezes por página, e nunca em seções vizinhas.
 * `<Montanhas>` uma vez por página, sempre no herói. Nenhum dos dois pode ser
 * usado como `background-image` repetido — repetir a silhueta transforma o
 * elemento da marca em papel de parede e mata justamente o que ele tem de
 * reconhecível.
 *
 * Todos são `aria-hidden`: são decoração, e um leitor de tela lendo "gráfico"
 * três vezes por página é ruído puro.
 */

/**
 * A curva de nível — o divisor de seção.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `slice`, NUNCA `none`
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo é `preserveAspectRatio="none"` para o desenho esticar até as
 * bordas. O efeito colateral é que a escala horizontal e a vertical se
 * separam: um viewBox de 1440 de largura renderizado em 390px comprime o eixo
 * X a 27% enquanto o Y fica em 100%. A ondulação suave desenhada para o
 * desktop vira zigue-zague no celular, que é onde está a maior parte do
 * tráfego.
 *
 * Com `slice` a proporção é preservada e o excesso é cortado nas laterais —
 * a curva continua sendo uma curva em qualquer largura. `non-scaling-stroke`
 * mantém o traço com a mesma espessura ótica em toda a faixa.
 */
export function CurvaDeNivel({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 64"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn('block h-16 w-full', className)}
    >
      <g fill="none" stroke="#0D0D0D" vectorEffect="non-scaling-stroke">
        <path
          d="M0 46C120 46 190 30 300 28s176 14 286 12 168-20 274-18 172 20 286 18 166-14 294-12"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <path
          d="M0 54C130 54 196 40 300 38s180 12 292 10 164-18 268-16 178 18 292 16 160-12 288-10"
          strokeWidth="1"
          strokeOpacity="0.22"
        />
        <path
          d="M0 38C110 38 186 20 296 18s170 16 280 14 174-22 280-20 168 22 282 20 172-16 300-14"
          strokeWidth="1"
          strokeOpacity="0.16"
        />
        <path
          d="M0 30C104 30 180 12 288 10s166 18 276 16 178-24 284-22 164 24 278 22 178-18 306-16"
          strokeWidth="1"
          strokeOpacity="0.1"
        />
      </g>
    </svg>
  )
}

/**
 * A cota que acompanha a curva.
 *
 * Fica FORA do SVG, como elemento HTML posicionado. Texto dentro de um SVG
 * esticado é deformado junto — `non-scaling-stroke` protege a espessura do
 * traço, não a geometria das letras. Aqui, além de não deformar, o número
 * continua selecionável, pesquisável pelo Ctrl+F e traduzível.
 */
export function Cota({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn('text-caqui-ink-500 text-micro bg-white px-1.5 font-mono uppercase', className)}
    >
      {children}
    </span>
  )
}

/**
 * Divisor completo: curva + cota, na proporção certa.
 * É o componente que as páginas usam; os dois de cima são as peças.
 */
export function Divisor({ cota, className }: { cota?: string; className?: string }) {
  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      <CurvaDeNivel />
      {cota && <Cota className="absolute top-5 right-6 sm:right-12">{cota}</Cota>}
    </div>
  )
}

/**
 * A serra, em gravura.
 *
 * As montanhas da logo real NÃO são silhueta preta chapada — são desenho de
 * linha com hachura, no registro de xilogravura de guia de trilha antigo. Este
 * componente segue esse desenho: massa clara com contorno e hachura, nunca
 * preenchimento sólido.
 *
 * Uma vez por página, no herói.
 */
export function Montanhas({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 220"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={cn('block w-full', className)}
    >
      {/* Crista distante: UMA linha contínua de ponta a ponta, mais leve.
          Profundidade vem do peso do traço, não da cor — como em gravura. */}
      <g fill="none" stroke="#0D0D0D" strokeWidth="1.4" strokeOpacity="0.32" strokeLinejoin="round">
        <path d="M0 168 L96 108 L152 142 L232 82 L296 130 L368 74 L438 128 L510 88 L580 132 L648 96 L724 138 L800 104 L800 172 L0 172 Z" />
      </g>

      {/* Crista principal, à frente e mais baixa: as duas nunca se cruzam. */}
      <g fill="none" stroke="#0D0D0D" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M0 196 L118 138 L186 172 L286 116 L372 176 L470 124 L556 178 L642 132 L724 174 L800 148" />

        {/* Hachura das faces sombreadas — sempre no flanco direito de cada
            cume, para a luz vir do mesmo lado em toda a peça. */}
        <g strokeWidth="1.2" strokeOpacity="0.5">
          <path d="M286 116 L306 146 M286 126 L322 160 M286 138 L338 172" />
          <path d="M470 124 L490 154 M470 134 L506 166 M470 146 L520 176" />
          <path d="M642 132 L660 158 M642 142 L676 170" />
          <path d="M118 138 L134 162 M118 148 L150 172" />
        </g>
      </g>

      {/* Linha d'água: na logo é ela que separa a serra do wordmark. */}
      <g stroke="#0D0D0D" strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round">
        <path d="M48 206 H286" />
        <path d="M320 212 H528" />
        <path d="M566 206 H752" />
      </g>
    </svg>
  )
}

/**
 * O brasão.
 *
 * ⚠️  RECONSTRUÇÃO, NÃO O ARQUIVO ORIGINAL.
 *
 * A Caqui tem uma logo pronta — eu a recuperei da marca d'água das fotos de
 * produto (`assets/_originais/`), que é a única cópia que existe neste
 * repositório. Este SVG reproduz a ESTRUTURA dela (hexágono, sol laranja atrás
 * da serra em gravura, trekkers, wordmark) em vetor limpo, para o site ter
 * marca enquanto o arquivo original não chega.
 *
 * **Peça o `.ai`/`.svg` original à Caqui e substitua este arquivo.** As letras
 * aqui são Archivo Black; as da logo real são um desenho próprio, e a diferença
 * aparece em tamanho grande.
 */
export function Brasao({
  className,
  titulo = 'Caqui Trekking',
}: {
  className?: string
  /** Vira o nome acessível. Passe string vazia quando houver texto ao lado. */
  titulo?: string
}) {
  return (
    <svg
      viewBox="0 0 200 232"
      className={cn('block', className)}
      role={titulo ? 'img' : 'presentation'}
      aria-label={titulo || undefined}
      aria-hidden={titulo ? undefined : true}
    >
      <defs>
        <linearGradient id="caqui-sol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF8A47" />
          <stop offset="55%" stopColor="#F26522" />
          <stop offset="100%" stopColor="#E04E12" />
        </linearGradient>
        {/* A serra recorta o sol, como na logo: ele NASCE atrás. */}
        <clipPath id="caqui-acima-da-serra">
          <path d="M18 0 H182 V150 H18 Z" />
        </clipPath>
      </defs>

      {/* Hexágono vertical: ponta em cima e embaixo, lados retos. */}
      <path
        d="M100 3 L195 58 V174 L100 229 L5 174 V58 Z"
        fill="#FFFFFF"
        stroke="#0D0D0D"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      <g clipPath="url(#caqui-acima-da-serra)">
        <circle cx="92" cy="72" r="32" fill="url(#caqui-sol)" />
      </g>

      {/* Serra em gravura — contorno e hachura, não massa sólida. */}
      <g fill="none" stroke="#0D0D0D" strokeLinejoin="round">
        <path d="M26 122 L58 96 L74 108 L96 78 L120 106 L140 88 L172 122" strokeWidth="3" />
        <g strokeWidth="1.3" strokeOpacity="0.6">
          <path d="M96 78 L106 96 M96 78 L86 98 M96 92 L110 110 M120 106 L128 118" />
          <path d="M58 96 L66 110 M58 96 L50 112" />
        </g>
        <g strokeWidth="1.6" strokeOpacity="0.5" strokeLinecap="round">
          <path d="M32 128 H84" />
          <path d="M96 132 H150" />
        </g>
      </g>

      {/* Dois trekkers na saliência à esquerda — silhueta sólida, como na logo. */}
      <g fill="#0D0D0D">
        <circle cx="40" cy="108" r="3" />
        <path d="M38 112 h4 l2 12 -3 0 -1 -6 -2 6 -3 0 Z" />
        <circle cx="53" cy="104" r="3.2" />
        <path d="M51 108 h4.5 l2.5 14 -3.2 0 -1.3 -7 -2.2 7 -3.3 0 Z" />
        <path d="M58.5 103 l0.9 0 l-0.9 20 -0.9 0 Z" />
      </g>

      <text
        x="100"
        y="160"
        textAnchor="middle"
        fill="#0D0D0D"
        style={{ font: '700 34px var(--font-display, sans-serif)', letterSpacing: '-0.02em' }}
      >
        CAQUI
      </text>
      <text
        x="100"
        y="186"
        textAnchor="middle"
        fill="#0D0D0D"
        style={{ font: '400 24px var(--font-sans, sans-serif)', letterSpacing: '0.06em' }}
      >
        trekking
      </text>
      <text
        x="100"
        y="202"
        textAnchor="middle"
        fill="#2B2B2B"
        style={{ font: '500 9px var(--font-mono, monospace)', letterSpacing: '0.14em' }}
      >
        ECOTURISMO AVENTURA
      </text>
      <text
        x="100"
        y="215"
        textAnchor="middle"
        fill="#6B6B6B"
        style={{ font: '400 7.5px var(--font-mono, monospace)', letterSpacing: '0.1em' }}
      >
        MOGI DAS CRUZES · SP
      </text>
    </svg>
  )
}
