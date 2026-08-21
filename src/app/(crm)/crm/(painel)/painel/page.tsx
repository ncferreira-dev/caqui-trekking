import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { BadgeDisponibilidade } from '@/components/ui/badge'
import { LinkBotao } from '@/components/ui/button'
import { diaEMes, horaLocal, inicioDoMes } from '@/lib/datetime'
import { formatarBRL } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/ui/cn'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'
import { estadoDeVagas, lucroCentavos, taxaDeOcupacao } from '@/lib/vagas'

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
  const inicioDoMesCorrente = inicioDoMes(agora)

  const [
    proximas,
    totalDeProximas,
    aindaAbertasNaJanela,
    semAgenda,
    naoLidas,
    leads,
    rascunhos,
    porFechar,
    fechadasNoMes,
  ] = await Promise.all([
    prisma.departure.findMany({
      where: { status: 'PUBLISHED', startAt: { gte: agora } },
      select: {
        id: true,
        startAt: true,
        priceCents: true,
        capacity: true,
        seatsTaken: true,
        lastSpotsAt: true,
        availabilityOverride: true,
        trip: { select: { slug: true, title: true } },
      },
      orderBy: { startAt: 'asc' },
      // ────────────────────────────────────────────────────────────────────
      // ESTE TETO É DA LISTA, E NÃO DO NÚMERO
      // ────────────────────────────────────────────────────────────────────
      // O KPI "Próximas saídas" imprimia `proximas.length`, ou seja, o
      // tamanho desta consulta cortada. Com 12 datas publicadas ele mostrava
      // 8, e mostraria 8 para sempre: um número de painel que para de subir é
      // pior que número nenhum, porque ninguém desconfia dele.
      //
      // A contagem agora é uma consulta própria (`totalDeProximas`), e este
      // corte continua sendo só o quanto cabe na lista abaixo.
      take: 8,
    }),

    prisma.departure.count({ where: { status: 'PUBLISHED', startAt: { gte: agora } } }),

    prisma.departure.findMany({
      // "com vaga aberta nos próximos 7 dias" deixou de ser um filtro do
      // banco em 18/08/2026: o selo agora é conta, e conta não vira `where`.
      // A janela continua no banco (é índice); o selo é filtrado em memória,
      // sobre no máximo algumas dezenas de linhas.
      where: { status: 'PUBLISHED', startAt: { gte: agora, lte: emSeteDias } },
      select: {
        id: true,
        startAt: true,
        capacity: true,
        seatsTaken: true,
        lastSpotsAt: true,
        availabilityOverride: true,
        trip: { select: { title: true } },
      },
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

    // ════════════════════════════════════════════════════════════════════════
    // A FILA DE FECHAMENTO
    // ════════════════════════════════════════════════════════════════════════
    // Saída publicada, com data no passado e sem `closedAt`. É uma BUSCA QUE
    // PRECISA VOLTAR VAZIA, e não um botão que alguém lembra de apertar.
    //
    // Cancelada fica de fora: não houve viagem para contabilizar, e ela ficaria
    // na fila para sempre.
    //
    // Sem esta fila, o relatório do mês seria a média de metade das saídas, que
    // não é a média de nada.
    prisma.departure.findMany({
      where: { status: 'PUBLISHED', startAt: { lt: agora }, closedAt: null },
      select: { id: true, startAt: true, trip: { select: { title: true } } },
      orderBy: { startAt: 'desc' },
      take: 10,
    }),

    // O RESULTADO DO MÊS. Só o que foi FECHADO entra: saída sem fechamento não
    // tem receita nem custo, e contá-la como zero puxaria a média para baixo
    // inventando um prejuízo que ninguém teve.
    prisma.departure.findMany({
      where: { closedAt: { gte: inicioDoMesCorrente } },
      select: {
        id: true,
        revenueCents: true,
        costCents: true,
        attendeeCount: true,
        capacity: true,
      },
    }),
  ])

  // O ALERTA PRECISA FILTRAR EM MEMÓRIA AGORA.
  //
  // Antes de 18/08/2026 este alerta vinha de um `where: { availability:
  // 'AVAILABLE' }`, porque o selo era uma coluna. Agora ele é uma conta, e
  // conta não vira `where`. A janela de sete dias continua no banco, que é onde
  // o índice ajuda; o filtro do selo roda sobre as poucas dezenas de linhas que
  // sobraram.

  // ══════════════════════════════════════════════════════════════════════════
  // O RESULTADO DO MÊS
  // ══════════════════════════════════════════════════════════════════════════
  // `lucroCentavos` devolve `null` quando falta receita OU custo. Aqui isso
  // vira uma CONTAGEM SEPARADA em vez de virar zero: uma saída com receita
  // lançada e custo em branco não é uma saída sem lucro, é uma saída sem
  // resposta. Somá-la como zero inflaria o resultado do mês em silêncio, e o
  // número inflado é o que alguém usa para decidir preço.
  const lucros = fechadasNoMes.map((d) => lucroCentavos(d))
  const completas = lucros.filter((v): v is number => v !== null)
  const incompletas = lucros.length - completas.length
  const lucroDoMes = completas.reduce((soma, v) => soma + v, 0)

  const ocupacoes = fechadasNoMes
    .map((d) => taxaDeOcupacao(d))
    .filter((v): v is number => v !== null)
  const ocupacaoMedia =
    ocupacoes.length > 0 ? ocupacoes.reduce((s, v) => s + v, 0) / ocupacoes.length : null

  const aindaAbertas = aindaAbertasNaJanela.filter(
    (s) => estadoDeVagas(s).disponibilidade !== 'SOLD_OUT',
  )

  const temAlerta =
    aindaAbertas.length > 0 || semAgenda.length > 0 || naoLidas > 0 || porFechar.length > 0

  return (
    <>
      <CabecalhoDeSecao
        titulo="Painel"
        descricao="O que precisa de olho hoje."
        acao={
          <LinkBotao href="/crm/trilhas" tamanho="sm">
            Ver saídas
          </LinkBotao>
        }
      />

      <div className="flex flex-col gap-4">
        {/* ── O RESULTADO DO MÊS ──────────────────────────────────────────
            Vem antes das contagens de propósito: "quanto sobrou" é a pergunta
            que o dono faz primeiro, e "quantas mensagens não lidas" é a que ele
            faz depois de já saber que o mês está de pé.

            Só aparece quando existe saída fechada. Um painel financeiro
            mostrando R$ 0,00 no dia 1º de cada mês não informa nada e ensina a
            pessoa a ignorar o bloco. */}
        {fechadasNoMes.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero
              rotulo="Resultado do mês"
              valor={formatarBRL(lucroDoMes)}
              href="/crm/trilhas"
              nota={
                incompletas > 0
                  ? `${incompletas} saída(s) sem receita ou custo lançado, fora da conta`
                  : `${completas.length} saída(s) fechada(s)`
              }
            />
            <Numero
              rotulo="Saídas fechadas"
              valor={fechadasNoMes.length}
              href="/crm/trilhas"
              nota="no mês corrente"
            />
            <Numero
              rotulo="Ocupação média"
              valor={ocupacaoMedia === null ? 'sem dado' : `${Math.round(ocupacaoMedia * 100)}%`}
              href="/crm/trilhas"
              nota="pessoas que foram, sobre a capacidade"
            />
            <Numero
              rotulo="Por fechar"
              valor={porFechar.length}
              href="/crm/trilhas"
              destaque={porFechar.length > 0}
              nota={porFechar.length > 0 ? 'o relatório depende disso' : 'nada pendente'}
            />
          </div>
        )}

        {/* ── Números ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Numero rotulo="Próximas saídas" valor={totalDeProximas} href="/crm/trilhas" />
          <Numero rotulo="Saídas em rascunho" valor={rascunhos} href="/crm/trilhas" />
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
                  Pode ser verdade, ou pode ter esgotado sem alguém marcar. Vale conferir antes de
                  alguém reservar uma vaga que não existe.
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {aindaAbertas.map((s) => (
                    <li key={s.id} className="font-mono">
                      <Link href="/crm/trilhas" className="rounded-xs underline underline-offset-4">
                        {diaEMes(s.startAt)} · {s.trip.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Aviso>
            )}

            {porFechar.length > 0 && (
              <Aviso titulo={`${porFechar.length} saída(s) já aconteceram e não foram fechadas`}>
                <p>
                  Enquanto não forem fechadas, elas não entram no resultado do mês, e o número lá em
                  cima é a média de uma parte só.
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {porFechar.map((s) => (
                    <li key={s.id} className="font-mono">
                      <Link href="/crm/trilhas" className="rounded-xs underline underline-offset-4">
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
                      <Link href="/crm/trilhas" className="rounded-xs underline underline-offset-4">
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
        <Painel
          titulo="Próximas saídas"
          acao={
            <Rotulo>
              {totalDeProximas > proximas.length
                ? `as ${proximas.length} mais próximas de ${totalDeProximas}`
                : 'por data'}
            </Rotulo>
          }
        >
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
                  <BadgeDisponibilidade estado={estadoDeVagas(s).disponibilidade} />
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </>
  )
}

/**
 * O número do painel.
 *
 * `valor` aceita string desde 18/08/2026, para o resultado do mês caber aqui:
 * ele é dinheiro formatado ("R$ 1.179,10"), não contagem. Um segundo componente
 * quase igual só para isso duplicaria a regra do destaque, que é a parte que
 * importa.
 *
 * `nota` é a linha de contexto embaixo. Ela existe porque número financeiro sem
 * contexto mente por omissão: "R$ 1.179,10" com três saídas fora da conta é
 * outro número, e quem lê precisa saber disso na mesma olhada.
 */
function Numero({
  rotulo,
  valor,
  href,
  nota,
  destaque = false,
}: {
  rotulo: string
  valor: number | string
  href: string
  nota?: string
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
      {nota && <p className="text-caqui-ink-500 text-micro mt-1">{nota}</p>}
    </Link>
  )
}
