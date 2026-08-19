import Link from 'next/link'

import { classesDaLinha, MiniaturaDaLinha } from '@/components/catalogo/miniatura-da-linha'
import { BadgeDificuldade } from '@/components/ui/badge'
import { cn } from '@/lib/ui/cn'
import { diaEMes } from '@/lib/datetime'
import { formatarDistancia, formatarDuracao } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import type { Dificuldade } from '@/components/ui/badge'
import type { TripResumoDTO } from '@/server/dto/public-dto'

/**
 * O roteiro como LINHA NUMERADA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AQUI O NUMERAL É O ÍNDICE, NÃO A DATA — E ISSO NÃO É DETALHE
 * ────────────────────────────────────────────────────────────────────────────
 * `LinhaDeSaida` e esta peça parecem a mesma coisa e respondem a perguntas
 * diferentes, que é a distinção que este projeto já documentava entre os dois
 * cards antigos:
 *
 *   /agenda    "o que tem no dia 15?"   → o numeral é a DATA
 *   /trekking  "para onde dá para ir?"  → o numeral é o ÍNDICE, e o que decide
 *                                          é a ficha: distância e subida
 *
 * Por isso são dois componentes e não um com `variante`. Um componente que
 * responde a duas perguntas acaba respondendo mal às duas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A FICHA É A IMAGEM
 * ────────────────────────────────────────────────────────────────────────────
 * Sem fotografia no banco, o que ocupa o lugar visual da imagem é o dado. A
 * faixa em mono — distância, ganho de elevação, duração — é o elemento mais
 * largo da linha de propósito: ela é o que diferencia "12 km com 840 m de
 * subida" de "5 km quase plano", e é a informação que a pessoa está de fato
 * comparando quando percorre esta página.
 *
 * Campo ausente SOME. A primeira versão o transformava num travessão, para
 * manter a régua da coluna — mas esta ficha é uma linha que reflui, não uma
 * tabela de colunas fixas, então omitir não desalinha nada. E travessão é
 * pontuação: numa lista de dados ele lê como um valor que ninguém entende, em
 * vez de como ausência.
 */
export function LinhaDeRoteiro({ trip, indice }: { trip: TripResumoDTO; indice: number }) {
  const proxima = trip.proximaSaida

  // Mesma peça e mesma grade da agenda, de propósito: as duas listas são a
  // mesma forma editorial, e cópias separadas foi como elas começaram a
  // divergir da home antes. Ver `miniatura-da-linha.tsx`.
  const grade = classesDaLinha(trip.capa !== null)

  return (
    <div className="group border-caqui-rule hover:bg-caqui-sand-100 relative border-b transition-colors duration-150">
      <div
        className={cn(
          'mx-auto grid w-full max-w-7xl items-start gap-x-5 gap-y-4 px-5 py-7 sm:gap-x-8 sm:px-8 lg:items-center',
          grade.grade,
        )}
      >
        {/* ── O índice ─────────────────────────────────────────────────────
            Dois dígitos sempre. `01` e `02` alinham; `1` e `2` dançam, e a
            coluna de numerais é justamente o que dá régua vertical à lista. */}
        <span className="numeral text-numeral-xl text-caqui-ink-500 leading-none">
          {String(indice + 1).padStart(2, '0')}
        </span>

        {/* ── A foto, quando houver. Hoje `null` em todos. ─────────────── */}
        <MiniaturaDaLinha capa={trip.capa} />

        {/* ── O roteiro ────────────────────────────────────────────────── */}
        <div className={cn('min-w-0', grade.conteudo)}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <BadgeDificuldade nivel={trip.dificuldade as Dificuldade} />
            {proxima ? (
              <span className="text-micro text-caqui-ink-700 font-mono uppercase">
                Próxima {diaEMes(new Date(proxima.inicioUtc))}
              </span>
            ) : (
              <span className="text-micro text-caqui-ink-500 font-mono uppercase">
                Sem data marcada
              </span>
            )}
          </div>

          <h2 className="text-display-s uppercase">
            <Link
              href={`/trekking/${trip.slug}`}
              className="rounded-xs after:absolute after:inset-0 after:content-['']"
            >
              {trip.titulo}
            </Link>
          </h2>

          {/* O SUBTÍTULO É O QUE DIZ O QUE A TRILHA É.
              Ele estava no banco em todos os roteiros — "Rapel na cachoeira,
              café da manhã e feijoada", "Trilha noturna e rapel na descida" — e
              a lista simplesmente não o renderizava. O resultado era uma coluna
              de nomes próprios em caixa-alta ("ESCALAVRADO · TERESÓPOLIS") que
              não diz nada a quem não conhece a região.
              Vem em caixa BAIXA e em corpo maior que a linha de lugar: depois
              de um título em Archivo Black caixa-alta, o olho precisa de um
              registro diferente para ler, não de mais do mesmo em cinza. */}
          {trip.subtitulo && <p className="text-corpo text-caqui-ink-900 mt-2">{trip.subtitulo}</p>}

          <p className="text-caqui-ink-500 text-corpo-sm mt-1.5">
            {trip.cidade} · {trip.estado}
            {trip.regiao ? ` · ${trip.regiao}` : ''}
            {trip.tags.length > 0 && (
              <>
                {' · '}
                {trip.tags
                  .slice(0, 3)
                  .map((t) => t.label)
                  .join(' · ')}
              </>
            )}
          </p>

          {/* A ficha. Fica DENTRO da coluna do roteiro no desktop, logo abaixo
              do lugar — é ela que a pessoa compara entre linhas, então precisa
              estar na mesma abscissa em todas. */}
          <dl className="text-micro mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono uppercase">
            <Dado
              rotulo="Distância"
              valor={trip.distanciaKm !== null ? `${formatarDistancia(trip.distanciaKm)} km` : null}
            />
            <Dado
              rotulo="Subida"
              valor={trip.ganhoElevacaoM !== null ? `+${trip.ganhoElevacaoM} m` : null}
            />
            <Dado
              rotulo="Duração"
              valor={trip.duracaoMinutos !== null ? formatarDuracao(trip.duracaoMinutos) : null}
            />
          </dl>
        </div>

        {/* ── Preço e seta ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-end justify-between gap-4 lg:flex-col lg:items-end lg:justify-center',
            grade.dado,
          )}
        >
          {proxima ? (
            <div className="text-right">
              <span className="text-micro text-caqui-ink-500 block font-mono uppercase">
                A partir de
              </span>
              <span className="preco block">{formatarBRL(proxima.precoCentavos)}</span>
            </div>
          ) : (
            <span className="text-micro text-caqui-ink-500 font-mono uppercase">Sob consulta</span>
          )}

          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="text-caqui-ink-900 size-5 shrink-0 transition-transform duration-150 group-hover:translate-x-1 lg:mt-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="square" />
          </svg>
        </div>
      </div>
    </div>
  )
}

/**
 * Um par rótulo/valor da ficha.
 *
 * `<dt>`/`<dd>` e não dois `<span>`: é uma lista de definições de verdade, e é
 * assim que um leitor de tela anuncia "Distância, 12 km" em vez de ler duas
 * palavras soltas.
 */
function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  // Sem valor, o par inteiro não é renderizado. Ver o bloco "A FICHA É A
  // IMAGEM" no topo do arquivo.
  if (valor === null) return null

  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-caqui-ink-500">{rotulo}</dt>
      <dd className="text-caqui-ink-900 font-medium">{valor}</dd>
    </div>
  )
}
