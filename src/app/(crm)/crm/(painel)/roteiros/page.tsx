import type { Metadata } from 'next'
import Link from 'next/link'

import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { BadgeDificuldade } from '@/components/ui/badge'
import { formatarDuracao } from '@/lib/formato'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/ui/cn'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'
import type { Dificuldade } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Roteiros', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Os roteiros.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A COLUNA QUE IMPORTA É "SAÍDAS FUTURAS"
 * ────────────────────────────────────────────────────────────────────────────
 * Um roteiro publicado com zero saídas futuras está no ar e ninguém consegue
 * comprar: a página abre bonita e o seletor de data diz "sem data marcada". É
 * o estado mais caro do sistema, porque não parece defeito nenhum — parece um
 * roteiro normal.
 *
 * Por isso o número aparece na lista, e o zero é marcado. O painel também
 * alerta sobre isso; aqui a Caqui vê qual roteiro é, no meio da lista.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O EDITOR RICO E A GALERIA POR ARRASTAR NÃO ESTÃO AQUI
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing pede os dois. Eles dependem de um upload de imagem funcionando
 * ponta a ponta, e o Cloudinary ainda não tem credencial neste projeto —
 * `POST /api/admin/media` responde 503 `MEDIA_STORAGE_UNCONFIGURED` nomeando
 * as variáveis que faltam.
 *
 * Entregar uma área de arrastar que sempre falha seria pior que não entregar:
 * a Caqui tentaria, veria erro, e concluiria que o CRM está quebrado. O que
 * está aqui é o que funciona hoje — listar, ver estado, e ir para a página
 * pública conferir. A galeria entra junto com a configuração do storage, no
 * PROMPT 11. Ver docs/10-crm.md.
 */
export default async function PaginaRoteiros() {
  await exigirSessaoDaPagina()

  const agora = new Date()

  const roteiros = await prisma.trip.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      city: true,
      state: true,
      difficulty: true,
      durationMinutes: true,
      status: true,
      featured: true,
      _count: {
        select: { departures: { where: { status: 'PUBLISHED', startAt: { gte: agora } } } },
      },
    },
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    take: 100,
  })

  const publicados = roteiros.filter((t) => t.status === 'PUBLISHED').length

  return (
    <>
      <CabecalhoDeSecao
        titulo="Roteiros"
        descricao="Cada roteiro é escrito uma vez e repetido em datas diferentes."
        acao={<Rotulo>{publicados} publicado(s)</Rotulo>}
      />

      <Painel>
        {roteiros.length === 0 ? (
          <Vazio titulo="Nenhum roteiro cadastrado">
            <p>Sem roteiro não há o que agendar, e a agenda do site fica vazia.</p>
          </Vazio>
        ) : (
          <ul className="divide-caqui-rule divide-y">
            {roteiros.map((t) => {
              const semAgenda = t.status === 'PUBLISHED' && t._count.departures === 0

              return (
                <li
                  key={t.id}
                  className={cn('px-4 py-3', semAgenda && 'border-caqui-orange-500 border-l-4')}
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-corpo-sm">{t.title}</span>
                        {t.status === 'DRAFT' && (
                          <span className="border-caqui-ink-900 text-micro border px-1.5 py-0.5 font-mono uppercase">
                            Rascunho
                          </span>
                        )}
                        {t.status === 'ARCHIVED' && (
                          <span className="bg-caqui-ink-900 text-micro px-1.5 py-0.5 font-mono text-white uppercase">
                            Arquivado
                          </span>
                        )}
                        {t.featured && <Rotulo>destaque</Rotulo>}
                      </div>
                      <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                        {t.city} · {t.state}
                        {t.durationMinutes ? ` · ${formatarDuracao(t.durationMinutes)}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <BadgeDificuldade nivel={t.difficulty as Dificuldade} />

                      <span
                        className={cn(
                          'text-micro font-mono uppercase',
                          semAgenda ? 'text-caqui-danger' : 'text-caqui-ink-500',
                        )}
                      >
                        {t._count.departures} data(s) futura(s)
                      </span>

                      <Link
                        href={`/trekking/${t.slug}`}
                        target="_blank"
                        className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
                      >
                        Ver no site
                      </Link>
                    </div>
                  </div>

                  {semAgenda && (
                    <p className="text-caqui-ink-700 text-micro mt-2 font-mono uppercase">
                      Está no ar e ninguém consegue comprar:{' '}
                      <Link href="/crm/saidas" className="rounded-xs underline underline-offset-4">
                        publicar uma data
                      </Link>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Painel>
    </>
  )
}
