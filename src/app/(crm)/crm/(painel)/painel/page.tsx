import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { BadgeDisponibilidade } from '@/components/ui/badge'
import { LinkBotao } from '@/components/ui/button'
import { diaEMes, horaLocal } from '@/lib/datetime'
import { formatarBRL } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/ui/cn'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'
import type { Disponibilidade } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Painel', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * O painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * OS DADOS VÊM DO PRISMA, NÃO DE UM `fetch` EM `/api/admin/dashboard`
 * ────────────────────────────────────────────────────────────────────────────
 * Mesma decisão do layout da loja: já estamos dentro do servidor, e uma
 * requisição HTTP para nós mesmos custa conexão e round-trip para devolver os
 * mesmos bytes. A rota HTTP continua existindo — ela é o contrato, e tem
 * `exigirPapel` e teste próprio.
 *
 * O que NÃO pode acontecer é a página confiar na sessão sem conferir: por isso
 * `exigirSessaoDaPagina()` aqui também, e não só no layout. Layout do Next não
 * é barreira — uma página pode ser renderizada em contextos onde o layout não
 * roda antes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ALERTA SINALIZA, NÃO ACUSA
 * ────────────────────────────────────────────────────────────────────────────
 * "Saída em 3 dias ainda como vagas abertas" pode ser verdade. Quem sabe é
 * quem guia. O painel aponta e oferece o caminho; não afirma erro. Painel que
 * grita errado duas vezes vira painel que ninguém lê.
 */
export default async function PaginaPainel() {
  await exigirSessaoDaPagina()

  const agora = new Date()
  const emSeteDias = new Date(agora.getTime() + SETE_DIAS_MS)

  const [proximas, aindaAbertas, semAgenda, naoLidas, leads, rascunhos] = await Promise.all([
    prisma.departure.findMany({
      where: { status: 'PUBLISHED', startAt: { gte: agora } },
      select: {
        id: true,
        startAt: true,
        priceCents: true,
        availability: true,
        trip: { select: { slug: true, title: true } },
      },
      orderBy: { startAt: 'asc' },
      take: 8,
    }),

    prisma.departure.findMany({
      where: {
        status: 'PUBLISHED',
        availability: 'AVAILABLE',
        startAt: { gte: agora, lte: emSeteDias },
      },
      select: { id: true, startAt: true, trip: { select: { title: true } } },
      orderBy: { startAt: 'asc' },
    }),

    prisma.trip.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        departures: { none: { status: 'PUBLISHED', startAt: { gte: agora } } },
      },
      select: { id: true, slug: true, title: true },
      orderBy: { title: 'asc' },
    }),

    prisma.contactMessage.count({ where: { read: false } }),
    prisma.lead.count(),
    prisma.departure.count({ where: { status: 'DRAFT' } }),
  ])

  const temAlerta = aindaAbertas.length > 0 || semAgenda.length > 0 || naoLidas > 0

  return (
    <>
      <CabecalhoDeSecao
        titulo="Painel"
        descricao="O que precisa de olho hoje."
        acao={
          <LinkBotao href="/crm/saidas" tamanho="sm">
            Ver saídas
          </LinkBotao>
        }
      />

      <div className="flex flex-col gap-4">
        {/* ── Números ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Numero rotulo="Próximas saídas" valor={proximas.length} href="/crm/saidas" />
          <Numero rotulo="Saídas em rascunho" valor={rascunhos} href="/crm/saidas" />
          <Numero
            rotulo="Mensagens não lidas"
            valor={naoLidas}
            href="/crm/mensagens"
            destaque={naoLidas > 0}
          />
          <Numero rotulo="Leads capturados" valor={leads} href="/crm/mensagens" />
        </div>

        {/* ── Alertas ────────────────────────────────────────────────────── */}
        {temAlerta && (
          <div className="flex flex-col gap-2">
            {aindaAbertas.length > 0 && (
              <Aviso
                titulo={`${aindaAbertas.length} saída(s) em menos de 7 dias, ainda com vagas abertas`}
              >
                <p>
                  Pode ser verdade — ou pode ter esgotado sem alguém marcar. Vale conferir antes de
                  alguém reservar uma vaga que não existe.
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {aindaAbertas.map((s) => (
                    <li key={s.id} className="font-mono">
                      <Link href="/crm/saidas" className="rounded-xs underline underline-offset-4">
                        {diaEMes(s.startAt)} · {s.trip.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Aviso>
            )}

            {semAgenda.length > 0 && (
              <Aviso titulo={`${semAgenda.length} roteiro(s) publicado(s) sem data futura`}>
                <p>
                  Estão no ar e ninguém consegue comprar: a página abre, e o seletor de data mostra
                  &ldquo;sem data marcada&rdquo;.
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {semAgenda.map((t) => (
                    <li key={t.id} className="font-mono">
                      <Link
                        href="/crm/roteiros"
                        className="rounded-xs underline underline-offset-4"
                      >
                        {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Aviso>
            )}

            {naoLidas > 0 && (
              <Aviso tom="neutro" titulo={`${naoLidas} mensagem(ns) não lida(s)`}>
                <Link href="/crm/mensagens" className="rounded-xs underline underline-offset-4">
                  Abrir a caixa
                </Link>
              </Aviso>
            )}
          </div>
        )}

        {/* ── Próximas saídas ────────────────────────────────────────────── */}
        <Painel titulo="Próximas saídas" acao={<Rotulo>por data</Rotulo>}>
          {proximas.length === 0 ? (
            <Vazio titulo="Nenhuma data publicada">
              <p>
                A agenda está vazia. Sem data publicada, o site inteiro mostra &ldquo;sem data
                marcada&rdquo; e não há como reservar.
              </p>
            </Vazio>
          ) : (
            <ul className="divide-caqui-rule divide-y">
              {proximas.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-corpo-sm truncate">{s.trip.title}</p>
                    <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                      {diaEMes(s.startAt)} · {horaLocal(s.startAt)} · {formatarBRL(s.priceCents)}
                    </p>
                  </div>
                  <BadgeDisponibilidade estado={s.availability as Disponibilidade} />
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </>
  )
}

function Numero({
  rotulo,
  valor,
  href,
  destaque = false,
}: {
  rotulo: string
  valor: number
  href: string
  destaque?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'block border bg-white px-3 py-2.5 transition-colors',
        // Destaque é BORDA, não cor de número: o valor precisa continuar
        // legível, e laranja como texto reprova no AA (3,15:1 sobre branco).
        destaque
          ? 'border-caqui-orange-500 border-l-4'
          : 'border-caqui-rule hover:border-caqui-ink-900',
      )}
    >
      <p className="text-caqui-ink-500 text-micro font-mono uppercase">{rotulo}</p>
      <p className="text-dado-lg font-display text-caqui-ink-900 mt-0.5">{valor}</p>
    </Link>
  )
}
