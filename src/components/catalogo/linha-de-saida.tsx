import Link from 'next/link'

import { classesDaLinha, MiniaturaDaLinha } from '@/components/catalogo/miniatura-da-linha'
import { BadgeDificuldade, BadgeDisponibilidade } from '@/components/ui/badge'
import { horaLocal, partesDaData } from '@/lib/datetime'
import { formatarDuracao } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'
import type { Dificuldade } from '@/components/ui/badge'
import type { ItemAgendaDTO } from '@/server/services/departure-service'

/**
 * A saída como LINHA, não como card.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE AO LADO DE `CardSaida`
 * ────────────────────────────────────────────────────────────────────────────
 * `CardSaida` é uma peça correta para um catálogo COM FOTOGRAFIA: a imagem
 * carrega a decisão, o carimbo de data pousa em cima dela, e um grid de nove
 * cards vende sozinho.
 *
 * A Caqui não tem fotografia. Nenhum roteiro tem capa — o banco devolve `null`
 * em todos. Então cada card renderiza o `MidiaVazia` (o grafismo de montanhas
 * sobre areia), e um grid de três colunas com seis desses é seis retângulos
 * cinzas. Repetido, o grafismo da marca para de ler como marca e passa a ler
 * como imagem quebrada.
 *
 * Há um segundo problema, de escala: a operação tem 2 a 6 saídas futuras. Duas
 * peças num grid de três colunas leem como "loja vazia". Duas LINHAS numa lista
 * leem como lista de duas linhas, que é o que é.
 *
 * A linha resolve os dois. Ela lidera pelo numeral da data, empilha a
 * informação técnica em mono à direita, e usa filete em vez de caixa — o que
 * este projeto já elegeu como profundidade (ver `--color-caqui-rule` em
 * `globals.css`).
 *
 * `CardSaida` FICA. No dia em que houver foto, ela volta a ser a peça certa
 * para a home — e a decisão entre as duas passa a ser sobre o material, não
 * sobre o layout.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TODA A REGRA DO CARD FOI PRESERVADA, INCLUSIVE A QUE PARECE DETALHE
 * ────────────────────────────────────────────────────────────────────────────
 *  - saída encerrada NÃO SOME (é prova social) e não se disfarça de disponível
 *  - o esmaecimento não usa `opacity`, que derrubaria o contraste do texto:
 *    a marcação é a tarja escrita "Encerrado" mais a trama diagonal, e o texto
 *    continua preto
 *  - preço de saída encerrada não aparece — é oferta do que não se pode comprar
 *  - `precoDe` riscado só quando é MAIOR que o preço atual
 *  - o link cobre a linha por `::after`, mas o texto acessível dele é só o
 *    título: quem navega por lista de links não ouve a linha inteira recitada
 */
export function LinhaDeSaida({ saida, indice }: { saida: ItemAgendaDTO; indice?: number }) {
  const inicio = new Date(saida.inicioUtc)
  const { dia, mes, semana } = partesDaData(inicio)
  const encerrada = saida.encerrada

  /**
   * Saída encerrada NÃO ganha foto, mesmo tendo uma.
   *
   * A seção "já realizadas" existe como prova social e é deliberadamente mais
   * apagada que a de cima: numeral vazado, trama diagonal, sem preço. Uma foto
   * nela ficaria mais bonita que a saída que ainda vende, e a lista passaria a
   * puxar o olho para o que não dá mais para comprar.
   *
   * Se um dia isso for reavaliado, o caminho é dar a foto com a mesma trama por
   * cima, e não simplesmente soltá-la.
   */
  const capa = encerrada ? null : saida.trip.capa
  const grade = classesDaLinha(capa !== null)

  return (
    <div
      className={cn(
        'group border-caqui-rule relative border-b',
        // O respiro do hover vem de COR DE FUNDO e não de deslocamento: mover
        // a linha empurraria as vizinhas e a lista inteira tremeria.
        !encerrada && 'hover:bg-caqui-sand-100 transition-colors duration-150',
      )}
    >
      {/* O filete sangra de borda a borda (é o pai que não tem `max-w`), mas o
          CONTEÚDO respeita a coluna do site. É a diferença entre uma lista
          editorial e uma tabela esticada: a régua atravessa a página, o texto
          não. */}
      <div
        className={cn(
          'mx-auto grid w-full max-w-7xl items-start gap-x-5 gap-y-3 px-5 py-6 sm:gap-x-8 sm:px-8 lg:items-center lg:py-7',
          grade.grade,
        )}
      >
        {/* ── A data ───────────────────────────────────────────────────────
            O numeral é a coisa mais pesada da linha, porque é por ele que se
            varre a lista com o olho sem ler nada. `tabular-nums` (global no
            body) é o que mantém a coluna alinhada entre linhas diferentes. */}
        <div className="relative flex items-baseline gap-2">
          {/* ⚠️ NÃO troque a cor deste numeral no hover.
              Tentado em 18/08/2026 com `group-hover:text-caqui-orange-600`, e o
              ESLint recusou — corretamente. Medido: orange-600 sobre branco dá
              3,99:1 e sobre `sand-100` (o fundo do hover) dá 3,59:1. Os dois
              passam em texto grande, e este numeral nunca tem menos de 44px,
              então a exceção seria defensável AQUI.
              É por isso mesmo que ela não vale: a regra proíbe laranja como
              texto sobre fundo claro justamente porque todo caso individual
              parece defensável, e a segunda pessoa a abrir a exceção vai
              aplicá-la num rótulo de 12px. O retorno de hover já existe em dois
              canais — o banho de fundo da linha e a seta que desliza. */}
          <span
            className={cn(
              'numeral text-numeral-xl',
              encerrada ? 'text-caqui-ink-500' : 'text-caqui-ink-900',
            )}
          >
            {dia}
          </span>
          <span className="flex flex-col">
            <span className="text-rotulo text-caqui-ink-700 font-mono uppercase">{mes}</span>
            <span className="text-micro text-caqui-ink-500 font-mono uppercase">{semana}</span>
          </span>

          {encerrada && (
            <span
              className="trama-indisponivel pointer-events-none absolute -inset-x-1 inset-y-0"
              aria-hidden="true"
            />
          )}
        </div>

        {/* ── A foto, quando houver ────────────────────────────────────────
            Hoje devolve `null` em todas as linhas: nenhum roteiro tem capa no
            banco. Ver `miniatura-da-linha.tsx`. */}
        <MiniaturaDaLinha capa={capa} />

        {/* ── O roteiro ────────────────────────────────────────────────────
            `col-span-2` no celular: com o numeral ocupando a primeira coluna,
            o título ao lado dele ficaria com ~40% da largura e quebraria em
            quatro linhas. */}
        <div className={cn('min-w-0', grade.conteudo)}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {encerrada ? (
              <span className="bg-caqui-ink-900 text-micro px-2 py-1 font-mono text-white uppercase">
                Encerrado
              </span>
            ) : (
              <BadgeDisponibilidade estado={saida.disponibilidade} />
            )}
            <BadgeDificuldade nivel={saida.trip.dificuldade as Dificuldade} />
            {indice !== undefined && (
              <span className="text-micro text-caqui-ink-500 ml-auto font-mono lg:hidden">
                {String(indice + 1).padStart(2, '0')}
              </span>
            )}
          </div>

          <h3 className="text-display-s uppercase">
            <Link
              href={`/trekking/${saida.trip.slug}`}
              className="rounded-xs after:absolute after:inset-0 after:content-['']"
            >
              {saida.trip.titulo}
            </Link>
          </h3>

          {/* O que a saída É. Ver o comentário do campo em
              `departure-service.ts` — a agenda listava só nome próprio em
              caixa-alta, que não diz nada a quem não conhece a região. */}
          {saida.trip.subtitulo && (
            <p className="text-corpo text-caqui-ink-900 mt-2">{saida.trip.subtitulo}</p>
          )}

          <p className="text-caqui-ink-500 text-corpo-sm mt-1.5">
            {saida.trip.cidade} · {saida.trip.estado}
            {saida.trip.tags.length > 0 && (
              <>
                {' · '}
                {saida.trip.tags
                  .slice(0, 3)
                  .map((t) => t.label)
                  .join(' · ')}
              </>
            )}
          </p>
        </div>

        {/* ── A camada técnica ─────────────────────────────────────────────
            Mono, alinhada à direita no desktop. É a legenda de mapa: hora de
            encontro, duração, preço. */}
        <div
          className={cn(
            'flex flex-wrap items-end justify-between gap-4 lg:flex-col lg:items-end lg:justify-center',
            grade.dado,
          )}
        >
          <div className="text-micro text-caqui-ink-700 flex gap-3 font-mono uppercase lg:justify-end">
            <span>{saida.horarioEncontro ?? horaLocal(inicio)}</span>
            {saida.trip.duracaoMinutos !== null && (
              <span className="text-caqui-ink-500">
                {formatarDuracao(saida.trip.duracaoMinutos)}
              </span>
            )}
          </div>

          {encerrada ? (
            <span className="text-micro text-caqui-ink-500 font-mono uppercase">Já realizada</span>
          ) : (
            <div className="flex items-baseline gap-3">
              {saida.precoDeCentavos !== null && saida.precoDeCentavos > saida.precoCentavos && (
                <span className="text-micro text-caqui-ink-500 font-mono line-through">
                  {formatarBRL(saida.precoDeCentavos)}
                </span>
              )}
              <span className="preco">{formatarBRL(saida.precoCentavos)}</span>
              {/* A seta é o único enfeite da linha, e ela se move no hover: sem
                  imagem para reagir, o movimento dela é o que dá retorno de que
                  a linha inteira é clicável. `aria-hidden` porque o link já tem
                  texto — uma seta anunciada seria ruído. */}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="text-caqui-ink-900 size-5 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="square" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
