import type { Metadata } from 'next'
import Link from 'next/link'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { BadgeDificuldade, BadgeDisponibilidade } from '@/components/ui/badge'
import { Card, CardCorpo } from '@/components/ui/card'
import { diaEMes } from '@/lib/datetime'
import { formatarBRL } from '@/lib/money'
import { listarDepartures } from '@/server/services/departure-service'

export const metadata: Metadata = {
  title: 'Agenda',
  description:
    'Próximas saídas da Caqui Trekking, com data, dificuldade, duração e disponibilidade.',
}

/**
 * Agenda — a página central do site.
 *
 * O que está aqui é a lista real, vinda do serviço. O agrupamento por mês, os
 * filtros (mês, dificuldade, atividade, faixa de preço), o estado vazio útil e
 * o card desenhado com data em destaque são o PROMPT 08.
 */
export default async function PaginaAgenda() {
  const { saidas, total } = await listarDepartures({
    incluirEncerradas: false,
    limit: 40,
    offset: 0,
  })

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Próximas saídas"
        titulo="Agenda"
        descricao="Toda saída tem data, guia e ponto de encontro definidos. A vaga é confirmada na conversa do WhatsApp."
        cota={`${total} ${total === 1 ? 'saída' : 'saídas'}`}
      />

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        {saidas.length === 0 ? (
          <p className="text-caqui-ink-700 text-corpo-lg">
            Nenhuma saída publicada no momento. A agenda do mês costuma sair na virada — chame no
            WhatsApp para ser avisado.
          </p>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {saidas.map((saida) => (
              <li key={saida.id}>
                <Link href={`/trekking/${saida.trip.slug}`} className="block h-full rounded-xs">
                  <Card interativo className="h-full">
                    <CardCorpo>
                      <div className="flex flex-wrap items-center gap-2">
                        <BadgeDisponibilidade estado={saida.disponibilidade} />
                        <BadgeDificuldade
                          nivel={
                            saida.trip.dificuldade as 'FACIL' | 'MODERADO' | 'DIFICIL' | 'EXTREMO'
                          }
                        />
                      </div>

                      <p className="text-caqui-ink-700 text-rotulo font-mono uppercase">
                        {diaEMes(new Date(saida.inicioUtc))}
                      </p>

                      <h2 className="text-display-s uppercase">{saida.trip.titulo}</h2>

                      <p className="text-caqui-ink-700 text-corpo-sm">
                        {saida.trip.cidade} · {saida.trip.estado}
                      </p>

                      <p className="preco mt-auto pt-3">{formatarBRL(saida.precoCentavos)}</p>
                    </CardCorpo>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
