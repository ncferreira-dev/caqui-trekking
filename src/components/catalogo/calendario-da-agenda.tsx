import Link from 'next/link'

import {
  chaveDia,
  diaPorExtenso,
  diasDaGradeDoMes,
  mensagemDeDiaLivre,
  NOMES_DAS_COLUNAS,
  agruparPorDia,
  type DiaDaGrade,
} from '@/lib/calendario'
import { deslocarMes, mesPorExtenso } from '@/lib/datetime'
import { linkWhatsApp } from '@/lib/formato'
import { cn } from '@/lib/ui/cn'
import type { ItemAgendaDTO } from '@/server/services/departure-service'

/**
 * A agenda como CALENDÁRIO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELA NÃO SUBSTITUI A LISTA. AS DUAS RESPONDEM PERGUNTAS DIFERENTES
 * ────────────────────────────────────────────────────────────────────────────
 * A lista cronológica responde "qual é a próxima?", e é a forma certa para
 * quem chega sem data na cabeça. O calendário responde "eu posso no dia 12,
 * tem alguma coisa?" — que é a pergunta de quem já tem o fim de semana livre
 * marcado e está decidindo o que fazer nele.
 *
 * São duas perguntas, dois formatos, e nenhum dos dois é uma versão melhor do
 * outro. Por isso o calendário entra como segunda VISTA (`?vista=calendario`),
 * com a lista continuando embaixo dele, e não no lugar dela. A URL descreve a
 * escolha, então o link é compartilhável e o botão voltar desfaz.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DIA VAZIO É O RECURSO, NÃO O BURACO
 * ────────────────────────────────────────────────────────────────────────────
 * O pedido do cliente (18/08/2026): tocar num dia sem saída manda uma mensagem
 * de WhatsApp já preenchida com aquele dia.
 *
 * Isso vira o calendário do avesso, e para melhor. Num calendário comum, 25
 * das 31 células são vazio morto, e a página parece uma agenda deserta. Aqui
 * cada célula vazia é uma oferta de saída fechada: a Caqui monta trilha para
 * grupo em qualquer data, e esta é a única tela do site onde esse fato aparece
 * no lugar exato em que a pessoa está pensando na data.
 *
 * Dia que JÁ PASSOU não recebe o link. Convidar alguém a pedir uma saída para
 * a semana retrasada é a definição de formulário que não olhou o dado.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UM LINK POR CÉLULA, E NENHUM DENTRO DO OUTRO
 * ────────────────────────────────────────────────────────────────────────────
 * A tentação é fazer a célula clicável e pôr um link por saída dentro dela.
 * Link dentro de link é HTML inválido, e o navegador conserta desmontando a
 * árvore de um jeito que ninguém previu.
 *
 * Aqui a célula inteira é UM link, e os títulos dentro dela são texto. Quem
 * tem saída no dia vai para a linha correspondente da lista logo abaixo
 * (`#dia-2026-08-15`), que é onde cabem preço, horário, dificuldade e o botão.
 * Ganha de quebra o alvo de toque: a célula inteira, e não um chip de 12px.
 */

export type SaidaDoDia = Pick<ItemAgendaDTO, 'id' | 'disponibilidade' | 'encerrada'> & {
  trip: { titulo: string }
  inicioUtc: string
}

/** A cor do traço da célula. Mesma semântica dos selos de `ui/badge`. */
const TRACO = {
  AVAILABLE: 'bg-caqui-forest-600',
  LAST_SPOTS: 'bg-caqui-orange-500',
  SOLD_OUT: 'bg-caqui-danger',
} as const

export function CalendarioDaAgenda({
  mes,
  saidas,
  agora,
  whatsapp,
  hrefDoMes,
}: {
  /** "2026-08". */
  mes: string
  /** Só as saídas DESTE mês. A célula não sabe filtrar. */
  saidas: SaidaDoDia[]
  agora: Date
  /** `null` quando não há número cadastrado: as células vazias ficam inertes. */
  whatsapp: string | null
  /** Monta o link de um mês preservando os filtros da página. */
  hrefDoMes: (chave: string) => string
}) {
  const dias = diasDaGradeDoMes(mes)
  const porDia = agruparPorDia(saidas, (s) => chaveDia(new Date(s.inicioUtc)))
  const hoje = chaveDia(agora)

  const semanas: DiaDaGrade[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))

  const anterior = deslocarMes(mes, -1)
  const seguinte = deslocarMes(mes, 1)

  return (
    <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
      {/* ── O cabeçalho do mês ─────────────────────────────────────────────
          As setas são links de verdade, com `rel` de sequência: navegar mês a
          mês entra no histórico, e a página funciona sem um byte de script. */}
      <div className="border-caqui-rule-forte mb-5 flex items-center justify-between gap-4 border-b pb-3">
        <SetaDeMes href={hrefDoMes(anterior)} sentido="anterior" rotulo={mesPorExtenso(anterior)} />

        <h2 className="text-display-s text-center uppercase">{mesPorExtenso(mes)}</h2>

        <SetaDeMes href={hrefDoMes(seguinte)} sentido="seguinte" rotulo={mesPorExtenso(seguinte)} />
      </div>

      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          Calendário de {mesPorExtenso(mes)}. Dias com saída levam à lista abaixo; dias livres abrem
          uma conversa no WhatsApp com a data já preenchida.
        </caption>
        <thead>
          <tr>
            {NOMES_DAS_COLUNAS.map((nome) => (
              <th
                key={nome}
                scope="col"
                className="text-caqui-ink-500 text-micro pb-2 font-mono font-normal uppercase"
              >
                {nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana[0]!.chave}>
              {semana.map((dia) => (
                <Celula
                  key={dia.chave}
                  dia={dia}
                  saidas={porDia.get(dia.chave) ?? []}
                  hoje={hoje}
                  whatsapp={whatsapp}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <Legenda temWhats={whatsapp !== null} />
    </div>
  )
}

function Celula({
  dia,
  saidas,
  hoje,
  whatsapp,
}: {
  dia: DiaDaGrade
  saidas: SaidaDoDia[]
  hoje: string
  whatsapp: string | null
}) {
  const ehHoje = dia.chave === hoje
  const passado = dia.chave < hoje
  const temSaida = saidas.length > 0

  const moldura = cn(
    'border-caqui-rule h-24 border p-0 align-top sm:h-28 lg:h-32',
    !dia.doMes && 'bg-caqui-sand-100/60',
  )

  // ── Dia de fora do mês: numeral apagado e nada mais ──────────────────────
  // Ele existe para a semana ter sete colunas, não para ser usado. Interagir
  // com ele levaria a pessoa para outro mês sem avisar.
  if (!dia.doMes) {
    return (
      <td className={moldura}>
        <span className="text-caqui-ink-500 block p-1.5 font-mono text-sm sm:p-2">{dia.dia}</span>
      </td>
    )
  }

  const numeral = (
    <span
      className={cn(
        'font-mono text-sm leading-none',
        ehHoje
          ? 'bg-caqui-ink-900 -mx-1 -my-0.5 inline-block px-1.5 py-1 text-white'
          : passado
            ? 'text-caqui-ink-500'
            : 'text-caqui-ink-900',
      )}
    >
      {dia.dia}
      {ehHoje && <span className="sr-only"> (hoje)</span>}
    </span>
  )

  if (temSaida) {
    const rotulos = saidas.map((s) => s.trip.titulo)
    return (
      <td className={moldura}>
        {/* `<a>` e não `<Link>`: o destino é a MESMA página, então não há rota
            para trocar. `<Link>` chamaria o roteador para chegar onde já
            estamos, e o `preventDefault` dele desliga a rolagem suave das
            âncoras (ver `shell/rolagem-suave.tsx`). */}
        <a
          href={`#dia-${dia.chave}`}
          aria-label={`${diaPorExtenso(dia.chave)}: ${saidas.length} ${
            saidas.length === 1 ? 'saída' : 'saídas'
          }. Ver na lista.`}
          className="hover:bg-caqui-sand-100 focus-visible:ring-caqui-ink-900 flex h-full w-full flex-col gap-1.5 p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:p-2"
        >
          {numeral}

          {/* ── Os traços ────────────────────────────────────────────────
              Uma barra por saída, na cor do estado, EMPILHADAS e ocupando a
              largura toda. Lado a lado elas caberiam no desktop e estourariam
              a célula no celular: numa tela de 375px cada dia tem 47px, e três
              traços de 12px mais o numeral não cabem em 31px de área útil.
              Empilhadas, a mesma peça serve a célula de 47px e a de 150px.

              A cor não carrega sozinha a informação — ela reforça a contagem
              de barras e o título escrito ao lado. Ver `ui/badge.tsx`. */}
          <span className="flex flex-col gap-0.5" aria-hidden="true">
            {saidas.slice(0, 3).map((s) => (
              <span
                key={s.id}
                className={cn(
                  'block h-1 w-full',
                  s.encerrada ? 'bg-caqui-ink-500' : TRACO[s.disponibilidade],
                )}
              />
            ))}
          </span>

          <span className="hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden="true">
            {rotulos.slice(0, 2).map((titulo, i) => (
              <span
                key={i}
                className="text-caqui-ink-900 text-micro truncate font-mono uppercase"
                title={titulo}
              >
                {titulo}
              </span>
            ))}
            {rotulos.length > 2 && (
              <span className="text-caqui-ink-500 text-micro font-mono">
                mais {rotulos.length - 2}
              </span>
            )}
          </span>
        </a>
      </td>
    )
  }

  // ── Dia livre no passado: só o numeral ───────────────────────────────────
  if (passado || whatsapp === null) {
    return (
      <td className={moldura}>
        <span className="block p-1.5 sm:p-2">{numeral}</span>
      </td>
    )
  }

  // ── Dia livre daqui para a frente: a oferta ──────────────────────────────
  return (
    <td className={moldura}>
      <a
        href={linkWhatsApp(whatsapp, mensagemDeDiaLivre(dia.chave))}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${diaPorExtenso(dia.chave)}: sem saída marcada. Pedir uma saída neste dia pelo WhatsApp.`}
        className="group/dia hover:bg-caqui-sand-100 focus-visible:ring-caqui-ink-900 flex h-full w-full flex-col justify-between p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:p-2"
      >
        {numeral}

        {/* ── O convite ────────────────────────────────────────────────────
            O "+" fica SEMPRE visível, e é ele que diz que a célula faz alguma
            coisa. A primeira versão escondia o convite inteiro atrás do hover,
            o que apagava o recurso justamente no celular, onde não existe
            hover e onde está a maior parte de quem visita a agenda.

            A palavra escrita continua sendo comportamento de ponteiro, em
            telas que a comportam: impressa em vinte células de uma vez ela
            vira um padrão de ruído que some da percepção em dois segundos. */}
        <span
          aria-hidden="true"
          className="text-caqui-ink-500 text-micro group-hover/dia:text-caqui-ink-900 font-mono uppercase transition-colors"
        >
          +
          <span className="ml-1 hidden opacity-0 transition-opacity group-hover/dia:opacity-100 group-focus-visible/dia:opacity-100 sm:inline">
            Pedir saída
          </span>
        </span>
      </a>
    </td>
  )
}

function SetaDeMes({
  href,
  sentido,
  rotulo,
}: {
  href: string
  sentido: 'anterior' | 'seguinte'
  rotulo: string
}) {
  return (
    <Link
      href={href}
      rel={sentido === 'anterior' ? 'prev' : 'next'}
      aria-label={`Ver ${rotulo}`}
      className="border-caqui-rule-forte text-caqui-ink-900 hover:bg-caqui-ink-900 focus-visible:ring-caqui-ink-900 inline-flex min-h-11 min-w-11 items-center justify-center border transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          d={sentido === 'anterior' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          strokeLinecap="square"
        />
      </svg>
    </Link>
  )
}

function Legenda({ temWhats }: { temWhats: boolean }) {
  return (
    <ul className="text-caqui-ink-700 text-micro mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono uppercase">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="bg-caqui-forest-600 block h-1.5 w-3" />
        Vagas abertas
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="bg-caqui-orange-500 block h-1.5 w-3" />
        Últimas vagas
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="bg-caqui-danger block h-1.5 w-3" />
        Esgotado
      </li>
      {temWhats && <li className="text-caqui-ink-500">Dia livre abre o WhatsApp com a data</li>}
    </ul>
  )
}
