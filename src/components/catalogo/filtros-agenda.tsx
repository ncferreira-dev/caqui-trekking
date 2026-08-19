import Link from 'next/link'

import { classesDeBotao } from '@/components/ui/button'
import { SelectNativo } from '@/components/ui/select-nativo'
import { cn } from '@/lib/ui/cn'
import { mesPorExtenso } from '@/lib/datetime'
import { rotuloDificuldade } from '@/lib/formato'
import type { OpcoesDeAgenda } from '@/server/services/departure-service'

/**
 * Os filtros da agenda.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * É UM `<form method="get">`. SEM `'use client'`, SEM ESTADO, SEM UM BYTE DE
 * JAVASCRIPT — NEM O DO BOTÃO.
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo é um componente de cliente com quatro `useState` e um `router.push`
 * no `onChange`. Esse caminho custa bundle, custa hidratação, e entrega uma
 * experiência PIOR:
 *
 *   • O estado do filtro vive na memória do componente, então a URL não
 *     descreve a tela. Mandar "olha a agenda de setembro" pelo WhatsApp manda
 *     a agenda inteira.
 *   • O botão voltar não desfaz o filtro, porque nada foi para o histórico.
 *   • Enquanto o bundle não chega, os `<select>` existem e não fazem nada.
 *
 * Com `<form method="get" action="/agenda">`, o navegador monta a query string
 * sozinho — é literalmente para isso que o formulário GET existe. A URL vira o
 * estado, o histórico funciona, o link é compartilhável, o Google indexa
 * `/agenda?mes=2026-09`, e a página se comporta igual antes e depois da
 * hidratação.
 *
 * Por isso o `<select>` daqui é o `SelectNativo` e não o `Select` de
 * `campo.tsx` — aquele usa `useId` e é módulo de cliente. E por isso o botão é
 * um `<button>` com `classesDeBotao()` em vez do componente `Button`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO APLICA SOZINHO NO `change`
 * ────────────────────────────────────────────────────────────────────────────
 * Auto-aplicar é agradável com UM filtro. Com quatro, quem quer "setembro +
 * moderado + cachoeira" recarrega a página três vezes e vê o resultado piscar
 * duas vezes até chegar onde queria. Um botão "Aplicar" é um clique a mais e
 * duas recargas a menos.
 */

/**
 * Faixas fixas, em centavos.
 *
 * Derivar as faixas dos preços reais (quartis, mín/máx) produz rótulos que
 * mudam a cada publicação — "R$ 137 a R$ 284" não é uma escolha, é um enigma.
 * Números redondos são o que a pessoa tem na cabeça quando pensa em quanto
 * quer gastar.
 */
const FAIXAS_DE_PRECO = [
  { valor: '0-15000', rotulo: 'Até R$ 150', min: 0, max: 15000 },
  { valor: '15000-30000', rotulo: 'R$ 150 a R$ 300', min: 15000, max: 30000 },
  { valor: '30000-60000', rotulo: 'R$ 300 a R$ 600', min: 30000, max: 60000 },
  { valor: '60000-', rotulo: 'Acima de R$ 600', min: 60000, max: undefined },
] as const

export function faixaDePreco(valor: string | undefined) {
  return FAIXAS_DE_PRECO.find((f) => f.valor === valor)
}

export type ValoresDeFiltro = {
  mes?: string | undefined
  dificuldade?: string | undefined
  atividade?: string | undefined
  preco?: string | undefined
  passadas?: boolean | undefined
  vista?: 'lista' | 'calendario' | undefined
}

/**
 * Monta um link para a agenda preservando o que já está aplicado.
 *
 * Existe porque três controles precisam do MESMO link com uma peça trocada: o
 * seletor de vista troca `vista`, as setas do calendário trocam `mes`, e o
 * rodapé troca `passadas`. Escrito à mão em cada um, o primeiro esquecimento
 * de um parâmetro descarta em silêncio um filtro que a pessoa está vendo
 * aplicado na tela — o mesmo defeito que o `<select>` de mês já teve.
 */
export function linkDaAgenda(
  valores: ValoresDeFiltro,
  mudanca: Partial<ValoresDeFiltro> = {},
): string {
  const v = { ...valores, ...mudanca }
  const busca = new URLSearchParams()

  if (v.mes) busca.set('mes', v.mes)
  if (v.dificuldade) busca.set('dificuldade', v.dificuldade)
  if (v.atividade) busca.set('atividade', v.atividade)
  if (v.preco) busca.set('preco', v.preco)
  if (v.passadas) busca.set('passadas', '1')
  if (v.vista === 'calendario') busca.set('vista', 'calendario')

  const query = busca.toString()
  return query ? `/agenda?${query}` : '/agenda'
}

export function FiltrosAgenda({
  opcoes,
  valores,
  totalFiltrado,
}: {
  opcoes: OpcoesDeAgenda
  valores: ValoresDeFiltro
  totalFiltrado: number
}) {
  const algumFiltro = Boolean(
    valores.mes ?? valores.dificuldade ?? valores.atividade ?? valores.preco,
  )

  // O mês escolhido pode estar FORA da janela que gerou as opções — é o caso
  // de `?mes=2025-03` com a janela começando no mês corrente. Sem esta linha o
  // `<select>` não teria a opção, cairia em "Todos os meses", e o próximo
  // "Aplicar" descartaria em silêncio o filtro que a pessoa está vendo aplicado
  // na tela. Aqui ele entra na lista como qualquer outro.
  const meses =
    valores.mes && !opcoes.meses.some((m) => m.chave === valores.mes)
      ? [{ chave: valores.mes, rotulo: mesPorExtenso(valores.mes), total: 0 }, ...opcoes.meses]
      : opcoes.meses

  return (
    <form
      method="get"
      action="/agenda"
      aria-label="Filtrar a agenda"
      className="secao-areia px-5 py-6 sm:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        {/* ── Lista ou calendário ────────────────────────────────────────
            Dois LINKS, não dois botões com estado: a vista é parte do
            endereço, então ela sobrevive ao compartilhamento e ao botão
            voltar, exatamente como os filtros abaixo. */}
        <div className="flex items-center gap-3">
          <span id="rotulo-da-vista" className="text-caqui-ink-700 text-rotulo font-mono uppercase">
            Ver como
          </span>
          <div
            role="group"
            aria-labelledby="rotulo-da-vista"
            className="border-caqui-rule-forte inline-flex border"
          >
            <BotaoDeVista valores={valores} destino="lista" rotulo="Lista" />
            <BotaoDeVista valores={valores} destino="calendario" rotulo="Calendário" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectNativo
            id="filtro-mes"
            name="mes"
            rotulo="Mês"
            defaultValue={valores.mes ?? ''}
            opcoes={[
              { valor: '', rotulo: 'Todos os meses' },
              ...meses.map((m) => ({
                valor: m.chave,
                // Sem a contagem quando ela é 0: "(0)" ao lado de um mês que a
                // pessoa acabou de escolher lê como defeito, não como
                // informação. A contagem real aparece na lista abaixo.
                rotulo: m.total > 0 ? `${m.rotulo} (${m.total})` : m.rotulo,
              })),
            ]}
          />

          <SelectNativo
            id="filtro-dificuldade"
            name="dificuldade"
            rotulo="Dificuldade"
            defaultValue={valores.dificuldade ?? ''}
            opcoes={[
              { valor: '', rotulo: 'Qualquer nível' },
              ...opcoes.dificuldades.map((d) => ({ valor: d, rotulo: rotuloDificuldade(d) })),
            ]}
          />

          <SelectNativo
            id="filtro-atividade"
            name="atividade"
            rotulo="Atividade"
            defaultValue={valores.atividade ?? ''}
            opcoes={[
              { valor: '', rotulo: 'Todas as atividades' },
              ...opcoes.tags.map((t) => ({ valor: t.slug, rotulo: t.label })),
            ]}
          />

          <SelectNativo
            id="filtro-preco"
            name="preco"
            rotulo="Faixa de preço"
            defaultValue={valores.preco ?? ''}
            opcoes={[
              { valor: '', rotulo: 'Qualquer preço' },
              ...FAIXAS_DE_PRECO.map((f) => ({ valor: f.valor, rotulo: f.rotulo })),
            ]}
          />
        </div>

        {/* Sobrevivem ao envio. Sem isto, filtrar dentro da vista "com saídas
            anteriores" jogaria a pessoa de volta ao mês atual sem explicação,
            e aplicar um filtro dentro do calendário devolveria a lista. */}
        {valores.passadas && <input type="hidden" name="passadas" value="1" />}
        {valores.vista === 'calendario' && <input type="hidden" name="vista" value="calendario" />}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-caqui-ink-700 text-rotulo font-mono uppercase">
            {totalFiltrado === 0
              ? 'Nenhuma saída'
              : `${totalFiltrado} ${totalFiltrado === 1 ? 'saída' : 'saídas'}`}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {algumFiltro && (
              <Link
                href={linkDaAgenda({ passadas: valores.passadas, vista: valores.vista })}
                className="text-caqui-ink-700 text-rotulo hover:text-caqui-ink-900 rounded-xs font-mono uppercase underline underline-offset-4"
              >
                Limpar filtros
              </Link>
            )}
            <button type="submit" className={classesDeBotao()}>
              <span>Aplicar</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

/** Uma das duas vistas. A ativa não é link para si mesma. */
function BotaoDeVista({
  valores,
  destino,
  rotulo,
}: {
  valores: ValoresDeFiltro
  destino: 'lista' | 'calendario'
  rotulo: string
}) {
  const ativo = (valores.vista ?? 'lista') === destino

  return (
    <Link
      href={linkDaAgenda(valores, { vista: destino })}
      aria-current={ativo ? 'true' : undefined}
      className={cn(
        'text-rotulo inline-flex min-h-11 items-center px-4 font-mono uppercase transition-colors',
        ativo
          ? 'bg-caqui-ink-900 text-white'
          : 'text-caqui-ink-700 hover:bg-caqui-sand-200 bg-white',
      )}
    >
      {rotulo}
    </Link>
  )
}
