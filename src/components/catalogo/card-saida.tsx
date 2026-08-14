import Link from 'next/link'

import { Capa } from '@/components/midia/imagem'
import { BadgeDificuldade, BadgeDisponibilidade, Etiqueta } from '@/components/ui/badge'
import { Card, CardCorpo, CardMidia, CardRodape } from '@/components/ui/card'
import { horaLocal, partesDaData } from '@/lib/datetime'
import { formatarDuracao } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'
import type { Dificuldade } from '@/components/ui/badge'
import type { ItemAgendaDTO } from '@/server/services/departure-service'

/**
 * O card da agenda.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A DATA É A PRIMEIRA COISA, E É UM CARIMBO — NÃO UMA LINHA DE TEXTO
 * ────────────────────────────────────────────────────────────────────────────
 * Quem entra na agenda está procurando UM DIA, não um roteiro: "o que tem no
 * fim de semana do dia 15?". Uma lista de cards com "Sáb · 15 ago" em corpo
 * 12px obriga a ler todos para varrer as datas.
 *
 * Aqui o dia é um numeral de 40px sobre o canto da foto, com o mês e o dia da
 * semana em mono ao lado. Dá para varrer a coluna de datas com o olho, sem ler
 * nada. É o mesmo motivo de o `font-variant-numeric: tabular-nums` estar no
 * `body`: dígitos de largura fixa alinham entre cards diferentes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SAÍDA ENCERRADA NÃO SOME — E TAMBÉM NÃO SE DISFARÇA DE DISPONÍVEL
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing é explícito: ela fica, esmaecida, como prova social e histórico.
 * A tentação é resolver isso com `opacity: 0.5` e pronto. Só que opacidade
 * baixa reprova em contraste — o texto do card cairia de 19,44:1 para algo
 * perto de 7:1 e os rótulos secundários para menos de 4,5:1.
 *
 * Então o esmaecimento é feito com DESSATURAÇÃO (`grayscale`) na foto e a
 * trama diagonal por cima, e o texto mantém o preto. A informação de "isto já
 * passou" está na tarja escrita "Encerrado", que não depende nem de cor nem de
 * opacidade — e o preço sai, porque preço de saída que já aconteceu é oferta
 * de algo que não se pode comprar.
 */

export function CardSaida({
  saida,
  prioridade = false,
}: {
  saida: ItemAgendaDTO
  prioridade?: boolean
}) {
  const inicio = new Date(saida.inicioUtc)
  const { dia, mes, semana } = partesDaData(inicio)
  const encerrada = saida.encerrada

  return (
    <Card interativo={!encerrada} className={cn('h-full', encerrada && 'opacity-90')}>
      <CardMidia className={cn(encerrada && 'grayscale')}>
        <Capa
          midia={saida.trip.capa}
          sizes="(min-width: 64rem) 22rem, (min-width: 40rem) 45vw, 92vw"
          {...(prioridade ? { prioridade } : {})}
        />

        {encerrada && (
          <>
            <span className="trama-indisponivel absolute inset-0" aria-hidden="true" />
            <span className="bg-caqui-ink-900 text-rotulo absolute top-0 left-0 px-3 py-1.5 font-mono text-white uppercase">
              Encerrado
            </span>
          </>
        )}

        {/* O carimbo de data. Fundo sólido preto e não translúcido: sobre foto
            clara, um preto a 70% deixa o numeral com contraste imprevisível. */}
        <span className="bg-caqui-ink-900 absolute right-0 bottom-0 flex items-end gap-2 px-3 py-2 text-white">
          <span className="font-display text-[2.5rem] leading-[0.8] tracking-tight">{dia}</span>
          <span className="flex flex-col pb-0.5">
            <span className="text-micro font-mono uppercase">{mes}</span>
            <span className="text-caqui-sand-400 text-micro font-mono uppercase">{semana}</span>
          </span>
        </span>
      </CardMidia>

      <CardCorpo>
        <div className="flex flex-wrap items-center gap-2">
          {!encerrada && <BadgeDisponibilidade estado={saida.disponibilidade} />}
          <BadgeDificuldade nivel={saida.trip.dificuldade as Dificuldade} />
        </div>

        <h3 className="text-display-s uppercase">
          {/* O link cobre o card inteiro por `::after`, mas o texto do link é
              só o título — quem navega por lista de links no leitor de tela
              ouve "Pedra Grande de Quatinga", não o card inteiro recitado. */}
          <Link
            href={`/trekking/${saida.trip.slug}`}
            className="rounded-xs after:absolute after:inset-0 after:content-['']"
          >
            {saida.trip.titulo}
          </Link>
        </h3>

        <p className="text-caqui-ink-700 text-corpo-sm">
          {saida.trip.cidade} · {saida.trip.estado}
        </p>

        {saida.trip.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {saida.trip.tags.slice(0, 3).map((tag) => (
              <Etiqueta key={tag.slug}>{tag.label}</Etiqueta>
            ))}
          </div>
        )}
      </CardCorpo>

      <CardRodape>
        <div className="text-caqui-ink-700 text-micro flex flex-col gap-0.5 font-mono uppercase">
          {saida.horarioEncontro && <span>Saída {saida.horarioEncontro}</span>}
          {!saida.horarioEncontro && <span>{horaLocal(inicio)}</span>}
          {saida.trip.duracaoMinutos !== null && (
            <span className="text-caqui-ink-500">{formatarDuracao(saida.trip.duracaoMinutos)}</span>
          )}
        </div>

        {encerrada ? (
          <span className="text-caqui-ink-500 text-micro font-mono uppercase">Já realizada</span>
        ) : (
          <div className="text-right">
            {saida.precoDeCentavos !== null && saida.precoDeCentavos > saida.precoCentavos && (
              <span className="text-caqui-ink-500 text-micro block font-mono line-through">
                {formatarBRL(saida.precoDeCentavos)}
              </span>
            )}
            <span className="preco block">{formatarBRL(saida.precoCentavos)}</span>
          </div>
        )}
      </CardRodape>
    </Card>
  )
}
