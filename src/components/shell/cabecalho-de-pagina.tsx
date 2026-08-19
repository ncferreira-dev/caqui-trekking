import type { ReactNode } from 'react'

import { Serra } from '@/components/marca/serra'
import { costurarSeparador } from '@/lib/formato'
import { cn } from '@/lib/ui/cn'

/**
 * A ABERTURA DE CAPÍTULO — o mesmo palco do herói, em todas as páginas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ELE DEIXOU DE SER UMA FAIXA DE AREIA
 * ────────────────────────────────────────────────────────────────────────────
 * Até 18/08/2026 este componente era uma faixa `secao-areia` com uma curva de
 * nível na base. Ela era coerente com o site antigo, que era claro do começo ao
 * fim.
 *
 * Quando a home ganhou vídeo em palco noturno, o site passou a ter duas
 * linguagens: a home era cinema e o resto era catálogo. Sair da home dava a
 * sensação de trocar de site — que foi exatamente a observação do cliente.
 *
 * A correção é aqui, e não página por página. Toda página interna abre com o
 * MESMO palco: fundo `noite-900`, tipografia de cartaz em branco, a serra em
 * gravura de linha branca ao pé, e o grão por cima unificando tudo. É a mesma
 * chapa do herói, só sem o vídeo — e é o que faz `/agenda` e `/trekking`
 * parecerem capítulos do mesmo objeto em vez de páginas de sistemas diferentes.
 *
 * Consequência que precisa andar junto: estas rotas entram em `ROTAS_COM_HEROI`
 * no `Header`, senão a barra branca sólida pousa em cima do palco escuro. Ver o
 * comentário lá.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A COTA VIROU FAIXA DE DADOS
 * ────────────────────────────────────────────────────────────────────────────
 * Antes ela era um número solto encostado na curva de nível. Agora é a mesma
 * faixa opaca em mono que fecha o herói da home: filete em cima, dado à
 * esquerda. Repetir a peça é o que faz o site ter vocabulário em vez de ter
 * enfeites.
 */
export function CabecalhoDePagina({
  sobretitulo,
  titulo,
  descricao,
  cota,
  acao,
  className,
}: {
  /** Texto ou nó — a Caqui Wear passa um breadcrumb com link. */
  sobretitulo?: ReactNode
  titulo: string
  descricao?: string
  /** Número que acompanha a página. Some quando não faz sentido. */
  cota?: string
  acao?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('palco-noite relative isolate overflow-hidden', className)}
      style={
        {
          '--serra-massa': 'var(--color-caqui-noite-900)',
          '--neblina-mistura': 'screen',
        } as React.CSSProperties
      }
    >
      <div className="grao pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* `pt-32`: o header é transparente sobre esta seção (ver
          `ROTAS_COM_HEROI`), então ele NÃO empurra o conteúdo — o respiro para
          os 80px da barra precisa vir daqui. */}
      <div className="relative mx-auto w-full max-w-7xl px-5 pt-32 pb-12 sm:px-8 sm:pb-16">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
          {/* ⚠️ SEM `max-w` NESTE BLOCO.
              Tentado com `max-w-2xl` e o resultado foi "TREK-KING" quebrado na
              tela: em `display-2xl` a 1440px, "TREKKING" pede 669px e a coluna
              oferecia 672 — no limite, e o `hyphens: auto` de `texto-cartaz`
              (a rede de segurança) fez o trabalho dela. A rede funcionou; a
              largura é que estava errada.
              A restrição de medida pertence ao PARÁGRAFO, que é o que precisa
              de linha curta para ser lido. Título não. */}
          <div className="min-w-0">
            {sobretitulo && (
              <p className="text-rotulo text-caqui-sand-400 font-mono uppercase">{sobretitulo}</p>
            )}
            {/* `display-xl` e não `display-2xl`: a maior tipografia do site é a
                do herói da home, uma vez só. Abertura de capítulo vem um degrau
                abaixo — é o que faz a home continuar sendo a primeira tela e
                não mais uma página igual às outras. */}
            {/* `costurarSeparador`: em escala de cartaz, "Escalavrado ·
                Teresópolis" quebrava com o `·` ABRINDO a segunda linha, o que
                lê como marcador de lista. Ver o comentário da função. */}
            <h1 className="texto-cartaz text-display-xl mt-4 text-white">
              {costurarSeparador(titulo)}
            </h1>
            {descricao && (
              <p className="text-corpo-lg text-caqui-sand-200 mt-5 max-w-xl">{descricao}</p>
            )}
          </div>
          {acao}
        </div>
      </div>

      {/* A serra, em gravura de linha branca. Duas camadas: mais que isso, numa
          abertura sem vídeo atrás, vira papel de parede. */}
      <div aria-hidden="true" className="pointer-events-none relative">
        <div className="text-caqui-sand-200 opacity-30">
          <Serra profundidade={2} />
        </div>
        <div className="text-caqui-sand-200 -mt-[6%] opacity-55">
          <Serra profundidade={4} />
        </div>
      </div>

      {cota && (
        <div className="border-caqui-rule-noite bg-caqui-noite-900 relative border-t">
          <div className="mx-auto w-full max-w-7xl px-5 py-3 sm:px-8">
            <p className="text-rotulo text-caqui-sand-400 font-mono uppercase">{cota}</p>
          </div>
        </div>
      )}
    </header>
  )
}
