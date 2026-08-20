import type { Metadata } from 'next'
import Link from 'next/link'

import { ArquivarItem } from '@/components/crm/arquivar-item'
import { EditarRoteiro } from '@/components/crm/editar-roteiro'
import { GerenciarTags, type TagDoPainel } from '@/components/crm/gerenciar-tags'
import { NovoRoteiro } from '@/components/crm/novo-roteiro'
import { BotaoDestaque, BotoesDeOrdem } from '@/components/crm/ordem-e-destaque'
import { Paginacao } from '@/components/crm/paginacao'
import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { BadgeDificuldade } from '@/components/ui/badge'
import { formatarDuracao } from '@/lib/formato'
import { fatiar } from '@/lib/crm/paginacao'
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
/**
 * 50 por página. O catálogo tem 5, então o rodapé só mostra a contagem — e é
 * ela que importa: o teto mudo de antes ("take: 100" e nada mais) mostraria
 * 100 linhas com a cara de "são todas". Ver `lib/crm/paginacao.ts`.
 */
const POR_PAGINA = 50

export default async function PaginaRoteiros({ searchParams }: PageProps<'/crm/roteiros'>) {
  // Arquivar é destrutivo e só do OWNER. A barreira real é a rota; aqui só
  // escondemos de quem não pode, por cortesia.
  const sessao = await exigirSessaoDaPagina()
  const ehOwner = sessao.role === 'OWNER'

  const agora = new Date()

  const params = await searchParams
  const total = await prisma.trip.count({ where: { deletedAt: null } })
  const fatia = fatiar(params['pagina'], total, POR_PAGINA)

  const roteiros = await prisma.trip.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      city: true,
      state: true,
      region: true,
      difficulty: true,
      distanceKm: true,
      elevationGainM: true,
      maxAltitudeM: true,
      durationMinutes: true,
      minAge: true,
      requiresExperience: true,
      highlights: true,
      included: true,
      notIncluded: true,
      whatToBring: true,
      cancellationPolicy: true,
      status: true,
      featured: true,
      activityTags: { select: { activityTagId: true } },
      _count: {
        select: { departures: { where: { status: 'PUBLISHED', startAt: { gte: agora } } } },
      },
    },
    // ────────────────────────────────────────────────────────────────────
    // A MESMA ORDEM DA VITRINE, E NÃO AGRUPADO POR ESTADO
    // ────────────────────────────────────────────────────────────────────
    // Esta lista ordenava por `status` primeiro, o que juntava os rascunhos.
    // Ficou insustentável quando as setas de subir/descer entraram: elas
    // mostrariam uma posição e gravariam outra, e a pessoa moveria um item
    // para cima sem ver nada sair do lugar.
    //
    // Agora a lista É a ordem da vitrine. Rascunho e arquivado continuam
    // marcados com etiqueta, no meio, que é onde eles de fato estão na fila.
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    take: fatia.tamanho,
    skip: fatia.offset,
  })

  // As atividades, com a contagem de uso: é ela que decide se o lixo aparece,
  // e ela evita a viagem "tenta apagar, toma 409, volta".
  const linhasDeTags = await prisma.activityTag.findMany({
    select: {
      id: true,
      slug: true,
      label: true,
      icon: true,
      _count: { select: { trips: true } },
    },
    orderBy: { label: 'asc' },
  })

  const tags: TagDoPainel[] = linhasDeTags.map((t) => ({
    id: t.id,
    slug: t.slug,
    label: t.label,
    icone: t.icon,
    roteiros: t._count.trips,
  }))

  const opcoesDeTag = tags.map((t) => ({ id: t.id, label: t.label }))

  // A ordem completa que a tela está mostrando. As setas mandam a lista
  // inteira de volta, não um `sortOrder` solto. Ver `ordem-service.ts`.
  const ordemAtual = roteiros.map((t) => t.id)

  const publicados = roteiros.filter((t) => t.status === 'PUBLISHED').length

  return (
    <>
      <CabecalhoDeSecao
        titulo="Roteiros"
        descricao="Cada roteiro é escrito uma vez e repetido em datas diferentes."
        acao={
          <span className="flex items-center gap-3">
            <Rotulo>{publicados} publicado(s)</Rotulo>
            <NovoRoteiro />
          </span>
        }
      />

      <div className="flex flex-col gap-4">
        {/* ── A regra da vitrine, escrita onde ela é operada ───────────────
            As setas controlam a ordem MANUAL. Duas outras regras passam na
            frente dela no site, e quem está reordenando precisa saber disso
            aqui, não numa documentação: quem tem data marcada vem antes de
            quem não tem, e o destaque vem antes dentro de cada grupo.

            Sem esta linha, a pessoa sobe um roteiro sem data para o topo, não
            vê nada mudar em `/trekking`, e conclui que o botão está quebrado. */}
        <p className="text-caqui-ink-700 text-corpo-sm">
          As setas definem a ordem da vitrine. No site, roteiro com data marcada aparece antes de
          roteiro sem data, e o destaque vem antes dentro de cada grupo.
        </p>

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
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      {/* Piso de largura: mesma armadilha da linha de saida,
                          medida em 19/08/2026. `flex-1` tem base ZERO, e o
                          bloco de acoes ao lado (ordem, destaque, dificuldade,
                          contagem, editar, arquivar, ver no site) reivindicava
                          a linha inteira. Em 1024px os CINCO roteiros ficavam
                          com largura zero: o nome caia uma palavra por linha
                          por cima dos botoes. Ver docs/10-crm.md. */}
                      <div className="min-w-0 flex-1 lg:min-w-56">
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
                        </div>
                        <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                          {t.city} · {t.state}
                          {t.durationMinutes ? ` · ${formatarDuracao(t.durationMinutes)}` : ''}
                        </p>

                        {/* DIFICULDADE E CONTAGEM DE DATAS SÃO INFORMAÇÃO, E
                            INFORMAÇÃO MORA DO LADO DO NOME.
                            Até 20/08/2026 as duas ficavam na tira da direita,
                            espremidas entre o botão de destaque e o "Editar" —
                            dois rótulos que não se clicam, no meio de seis
                            coisas que se clicam. Quem varria a linha atrás de
                            um comando tropeçava nelas, e quem procurava a
                            dificuldade tinha que achá-la num campo de botões.
                            Agora a esquerda responde "o que é este roteiro" e
                            a direita, "o que dá para fazer com ele". */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <BadgeDificuldade nivel={t.difficulty as Dificuldade} />

                          <span
                            className={cn(
                              'text-micro font-mono uppercase',
                              semAgenda ? 'text-caqui-danger' : 'text-caqui-ink-500',
                            )}
                          >
                            {t._count.departures} data(s) futura(s)
                          </span>
                        </div>
                      </div>

                      {/* AS AÇÕES EMPILHAM, como na lista de saídas: primeiro o
                          que posiciona o roteiro na vitrine, depois o que se
                          faz com o roteiro em si. */}
                      <div className="flex flex-col gap-2 lg:items-end">
                        <div className="flex flex-wrap items-center gap-3">
                          <BotoesDeOrdem
                            colecao="trips"
                            ids={ordemAtual}
                            id={t.id}
                            rotulo={t.title}
                          />

                          <BotaoDestaque
                            colecao="trips"
                            id={t.id}
                            destacado={t.featured}
                            rotulo={t.title}
                            semDataFutura={t._count.departures === 0}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <EditarRoteiro
                            roteiro={{
                              id: t.id,
                              title: t.title,
                              subtitle: t.subtitle,
                              description: t.description,
                              city: t.city,
                              state: t.state,
                              region: t.region,
                              difficulty: t.difficulty,
                              distanceKm: t.distanceKm ? t.distanceKm.toString() : null,
                              elevationGainM: t.elevationGainM,
                              maxAltitudeM: t.maxAltitudeM,
                              durationMinutes: t.durationMinutes,
                              minAge: t.minAge,
                              requiresExperience: t.requiresExperience,
                              highlights: t.highlights,
                              included: t.included,
                              notIncluded: t.notIncluded,
                              whatToBring: t.whatToBring,
                              cancellationPolicy: t.cancellationPolicy,
                              status: t.status,
                              activityTagIds: t.activityTags.map((r) => r.activityTagId),
                            }}
                            tags={opcoesDeTag}
                          />

                          {ehOwner && t.status !== 'ARCHIVED' && (
                            <ArquivarItem
                              colecao="trips"
                              id={t.id}
                              nome={t.title}
                              consequencia="Ele sai do site e desta lista."
                            >
                              <p>
                                As {t._count.departures} saída(s) futura(s) dele param de aparecer
                                na agenda. As saídas já realizadas continuam registradas: o
                                histórico não se reescreve.
                              </p>
                              <p className="mt-2">
                                Se for coisa temporária, ponha em <strong>rascunho</strong> pelo
                                “Editar”. Aquilo volta em um clique.
                              </p>
                            </ArquivarItem>
                          )}

                          <Link
                            href={`/trekking/${t.slug}`}
                            target="_blank"
                            className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
                          >
                            Ver no site
                          </Link>
                        </div>
                      </div>
                    </div>

                    {semAgenda && (
                      <p className="text-caqui-ink-700 text-micro mt-2 font-mono uppercase">
                        Está no ar e ninguém consegue comprar:{' '}
                        <Link
                          href="/crm/saidas"
                          className="rounded-xs underline underline-offset-4"
                        >
                          publicar uma data
                        </Link>
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <Paginacao
            fatia={fatia}
            itens="roteiros"
            href={(p) => (p <= 1 ? '/crm/roteiros' : `/crm/roteiros?pagina=${p}`)}
          />
        </Painel>

        {/* ── As atividades ────────────────────────────────────────────────
          Elas moram AQUI, e não numa seção própria da navegação: a barra do
          painel tem seis itens e esse é o teto (ver `navegacao.tsx`). Além
          disso, atividade só faz sentido ao lado do roteiro que a usa, que é
          onde ela é marcada. */}
        <Painel titulo="Atividades" acao={<Rotulo>viram filtro na agenda</Rotulo>}>
          <GerenciarTags tags={tags} />
        </Painel>
      </div>
    </>
  )
}
