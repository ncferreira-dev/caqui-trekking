'use client'

import Link from 'next/link'
import { useState } from 'react'

import { AviseMe } from '@/components/catalogo/avise-me'
import { BadgeDisponibilidade } from '@/components/ui/badge'
import { Button, classesDeBotao } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { eventoAdicionarAMochila } from '@/lib/analytics'
import { lineIdDeSaida, useCarrinho } from '@/lib/carrinho/store'
import { diaEMes } from '@/lib/datetime'
import { linkWhatsApp } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'
import type { SaidaDTO } from '@/server/dto/public-dto'

/**
 * O SELETOR DE SAÍDA — o ponto de conversão da página.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELE NÃO VENDE. ELE MONTA A CONVERSA.
 * ────────────────────────────────────────────────────────────────────────────
 * Esta é a regra estrutural do projeto inteiro: o site NUNCA processa
 * pagamento. Não existe checkout, não existe gateway, não existe pedido. O
 * botão põe a data e a quantidade numa mochila, e a mochila vira uma mensagem
 * de WhatsApp onde a Caqui fecha a venda conversando (PROMPT 09).
 *
 * Por isso o rótulo é "Adicionar à mochila" e não "Comprar" ou "Reservar
 * agora": os dois prometem uma vaga garantida que só a conversa confirma, e a
 * promessa quebrada custa mais que o clique ganho.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE VAI PARA A MOCHILA: `departureId` E QUANTIDADE. SÓ.
 * ────────────────────────────────────────────────────────────────────────────
 * Sem preço, sem título, sem disponibilidade. Preço guardado no cliente é um
 * campo editável no DevTools, e dado guardado envelhece — um carrinho aberto
 * na terça mostraria "vagas abertas" na quinta, depois de a saída lotar. O
 * servidor recalcula tudo a partir do id em `POST /api/cart/validate`.
 * Ver `src/lib/carrinho/store.ts`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A SAÍDA ESGOTADA NÃO É UM BOTÃO CINZA
 * ────────────────────────────────────────────────────────────────────────────
 * Ela continua na lista, com trama diagonal (que não depende de cor), rádio
 * desabilitado — e um "Avise-me" ao lado. É o momento de maior intenção da
 * página; ver `avise-me.tsx`.
 */

/** O teto do `itemCarrinhoSchema`. Repetir o número aqui seria convidá-lo a divergir. */
const MAXIMO_POR_SAIDA = 20

export function SeletorDeSaida({
  saidas,
  tituloDoRoteiro,
  whatsapp,
}: {
  saidas: SaidaDTO[]
  tituloDoRoteiro: string
  whatsapp: string | null
}) {
  const futuras = saidas.filter((s) => !s.encerrada)
  const primeiraLivre = futuras.find((s) => s.disponibilidade !== 'SOLD_OUT')
  const esgotadas = futuras.filter((s) => s.disponibilidade === 'SOLD_OUT').length

  const [selecionadaId, setSelecionadaId] = useState<number | null>(primeiraLivre?.id ?? null)
  const [quantidade, setQuantidade] = useState(1)
  const [adicionada, setAdicionada] = useState(false)

  // DOIS estados para um modal, e não um só.
  //
  // Desmontar o `<AviseMe>` para fechá-lo parece equivalente e não é: o
  // `useDialogoNativo` de `ui/dialogo.tsx` devolve o foco ao gatilho num efeito
  // que começa com `if (aberto) return`. Se o componente some com `aberto`
  // ainda `true`, esse efeito nunca roda, `dialogo.close()` nunca é chamado, e
  // o foco do teclado cai no `<body>` — a pessoa perde o lugar na página.
  //
  // Então: `aviseMe` guarda QUAL saída, `aviseMeAberto` guarda SE está aberto.
  // Fechar só troca o booleano, e o diálogo faz o resto sozinho.
  const [aviseMe, setAviseMe] = useState<SaidaDTO | null>(null)
  const [aviseMeAberto, setAviseMeAberto] = useState(false)

  const { adicionar } = useCarrinho()
  const { mostrar } = useToast()

  const selecionada = futuras.find((s) => s.id === selecionadaId) ?? null
  const total = selecionada ? selecionada.precoCentavos * quantidade : 0

  function escolher(saida: SaidaDTO) {
    setSelecionadaId(saida.id)
    // A confirmação some ao trocar de data: mantê-la faria parecer que a nova
    // data também já foi adicionada.
    setAdicionada(false)
  }

  function aoAdicionar() {
    if (!selecionada) return

    adicionar({
      lineId: lineIdDeSaida(selecionada.id),
      tipo: 'DEPARTURE',
      departureId: selecionada.id,
      quantidade,
    })

    eventoAdicionarAMochila({
      tipo: 'DEPARTURE',
      item: `${tituloDoRoteiro} · ${diaEMes(new Date(selecionada.inicioUtc))}`,
    })

    setAdicionada(true)
    mostrar({
      tom: 'sucesso',
      titulo: 'Na mochila',
      descricao: `${tituloDoRoteiro} · ${diaEMes(new Date(selecionada.inicioUtc))}, ${quantidade} ${
        quantidade === 1 ? 'vaga' : 'vagas'
      }.`,
    })
  }

  if (futuras.length === 0) {
    return <SemData tituloDoRoteiro={tituloDoRoteiro} whatsapp={whatsapp} />
  }

  return (
    <div
      // O alvo do `IntersectionObserver` da barra fixa do mobile, e o destino
      // do link "escolher data" dela.
      id="seletor-de-saida"
      // `border` junto com `border-caqui-ink-900`: a classe de cor sozinha só
      // escreve `border-color`, e o Preflight mantém `border-width: 0`. O
      // contêiner do ponto de conversão estava sem borda nenhuma.
      className="border-caqui-ink-900 border bg-white shadow-[var(--shadow-corte-2)]"
    >
      <div className="border-caqui-ink-900 border-b px-5 py-4">
        <h2 className="text-display-s uppercase">Escolha a data</h2>
        <p className="text-caqui-ink-700 text-corpo-sm mt-1">
          {/* NAO diga "disponiveis" aqui.
              `futuras` e tudo que ainda nao aconteceu, esgotado inclusive: a
              saida esgotada continua na lista de proposito, para a pessoa ver
              que existe e pedir para ser avisada. Chamar o total de
              "disponiveis" e uma promessa que a propria lista desmente duas
              linhas abaixo, onde aparece o selo ESGOTADO. */}
          {futuras.length} {futuras.length === 1 ? 'data' : 'datas'}
          {esgotadas > 0 && ` · ${esgotadas} esgotada${esgotadas === 1 ? '' : 's'}`}
        </p>
      </div>

      <fieldset className="border-caqui-ink-900 border-b">
        <legend className="sr-only">Datas de saída</legend>

        <ul>
          {futuras.map((saida) => (
            <ItemDeData
              key={saida.id}
              saida={saida}
              selecionada={saida.id === selecionadaId}
              aoEscolher={() => escolher(saida)}
              aoAvisar={() => {
                setAviseMe(saida)
                setAviseMeAberto(true)
              }}
            />
          ))}
        </ul>
      </fieldset>

      {selecionada ? (
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex items-end justify-between gap-4">
            <Quantidade valor={quantidade} aoMudar={setQuantidade} />

            <div className="text-right">
              <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                {quantidade} × {formatarBRL(selecionada.precoCentavos)}
              </p>
              <p className="preco">{formatarBRL(total)}</p>
            </div>
          </div>

          <Button onClick={aoAdicionar} tamanho="lg" bloco>
            Adicionar à mochila
          </Button>

          {adicionada && (
            <p
              // `status` e não `alert`: é uma confirmação, não uma
              // interrupção. O toast já anunciou; aqui fica o caminho.
              role="status"
              className="border-caqui-forest-600 bg-caqui-sand-100 text-corpo-sm border-l-4 px-3 py-2"
            >
              Na mochila.{' '}
              <Link
                href="/carrinho"
                className="rounded-xs font-medium underline underline-offset-4"
              >
                Ver a mochila e fechar pelo WhatsApp
              </Link>
            </p>
          )}

          <p className="text-caqui-ink-500 text-micro text-center font-mono uppercase">
            A vaga é confirmada na conversa. Nada é cobrado no site.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-5">
          <p className="text-caqui-ink-700 text-corpo-sm">
            As datas abertas estão esgotadas no momento. Deixe seu contato numa delas. Vaga cancela,
            e a Caqui avisa antes de anunciar.
          </p>
        </div>
      )}

      {whatsapp && (
        <div className="border-caqui-rule border-t px-5 py-4">
          <a
            href={linkWhatsApp(
              whatsapp,
              `Olá! Tenho uma dúvida sobre a expedição ${tituloDoRoteiro}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caqui-ink-700 text-rotulo hover:text-caqui-ink-900 rounded-xs font-mono uppercase underline underline-offset-4"
          >
            Tirar dúvida no WhatsApp
          </a>
        </div>
      )}

      {aviseMe && (
        <AviseMe
          // `key` pela saída: trocar de data remonta o formulário, então o
          // estado "pronto" de um envio anterior não reaparece já preenchido
          // na próxima data.
          key={aviseMe.id}
          departureId={aviseMe.id}
          inicioUtc={aviseMe.inicioUtc}
          tituloDoRoteiro={tituloDoRoteiro}
          aberto={aviseMeAberto}
          aoFechar={() => setAviseMeAberto(false)}
        />
      )}
    </div>
  )
}

function ItemDeData({
  saida,
  selecionada,
  aoEscolher,
  aoAvisar,
}: {
  saida: SaidaDTO
  selecionada: boolean
  aoEscolher: () => void
  aoAvisar: () => void
}) {
  const esgotada = saida.disponibilidade === 'SOLD_OUT'

  return (
    <li
      className={cn(
        'border-caqui-rule relative border-b last:border-b-0',
        selecionada && 'bg-caqui-sand-100',
      )}
    >
      {esgotada && <span className="trama-indisponivel absolute inset-0" aria-hidden="true" />}

      <div className="relative flex items-center gap-3 px-5 py-3.5">
        <label
          className={cn(
            'flex flex-1 items-center gap-3',
            esgotada ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          <input
            type="radio"
            name="saida"
            value={saida.id}
            checked={selecionada}
            disabled={esgotada}
            onChange={aoEscolher}
            // `accent-color` deixa o rádio NATIVO com a cor da marca. Um rádio
            // desenhado à mão custaria estado de foco, de disabled e de
            // teclado — o nativo já tem os três, e o grupo de rádios dá
            // navegação por seta de graça.
            className="accent-caqui-orange-600 size-4 shrink-0"
          />

          <span className="flex-1">
            <span className="text-corpo block font-medium">
              {diaEMes(new Date(saida.inicioUtc))}
            </span>
            {saida.horarioEncontro && (
              <span className="text-caqui-ink-500 text-micro block font-mono uppercase">
                Saída {saida.horarioEncontro}
              </span>
            )}
          </span>

          <span className="text-right">
            <span className="text-dado block font-mono font-medium">
              {formatarBRL(saida.precoCentavos)}
            </span>
            <BadgeDisponibilidade estado={saida.disponibilidade} className="mt-1" />
          </span>
        </label>
      </div>

      {esgotada && (
        <div className="relative px-5 pb-3.5">
          <Button variante="secondary" tamanho="sm" onClick={aoAvisar}>
            Avise-me
          </Button>
        </div>
      )}
    </li>
  )
}

/**
 * O contador de vagas.
 *
 * Botões `−` e `+` em volta de um `<input type="number">`, e não só o input:
 * no celular, o passo nativo é um par de setas de 8px que ninguém acerta. O
 * input continua ali, editável e com teclado numérico, para quem quer digitar
 * "8" em vez de clicar oito vezes.
 */
function Quantidade({ valor, aoMudar }: { valor: number; aoMudar: (n: number) => void }) {
  const limitar = (n: number) => Math.min(MAXIMO_POR_SAIDA, Math.max(1, n))

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="quantidade-vagas"
        className="text-caqui-ink-900 text-rotulo font-mono uppercase"
      >
        Vagas
      </label>

      <div className="border-caqui-ink-900 flex items-stretch border">
        <BotaoDePasso
          rotulo="Menos uma vaga"
          simbolo="−"
          desabilitado={valor <= 1}
          aoClicar={() => aoMudar(limitar(valor - 1))}
        />

        <input
          id="quantidade-vagas"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAXIMO_POR_SAIDA}
          value={valor}
          onChange={(e) => aoMudar(limitar(Number(e.currentTarget.value) || 1))}
          className="text-dado w-12 [appearance:textfield] border-x-0 text-center font-mono font-medium [&::-webkit-inner-spin-button]:appearance-none"
        />

        <BotaoDePasso
          rotulo="Mais uma vaga"
          simbolo="+"
          desabilitado={valor >= MAXIMO_POR_SAIDA}
          aoClicar={() => aoMudar(limitar(valor + 1))}
        />
      </div>
    </div>
  )
}

function BotaoDePasso({
  rotulo,
  simbolo,
  desabilitado,
  aoClicar,
}: {
  rotulo: string
  simbolo: string
  desabilitado: boolean
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      className={cn(
        'text-display-s hover:bg-caqui-sand-100 inline-flex size-11 items-center justify-center',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      <span aria-hidden="true">{simbolo}</span>
    </button>
  )
}

/** Roteiro publicado sem data marcada. Não é erro: é o estado normal na virada da temporada. */
function SemData({
  tituloDoRoteiro,
  whatsapp,
}: {
  tituloDoRoteiro: string
  whatsapp: string | null
}) {
  return (
    <div id="seletor-de-saida" className="border-caqui-ink-900 border bg-white p-5">
      <h2 className="text-display-s uppercase">Sem data marcada</h2>
      <p className="text-caqui-ink-700 text-corpo-sm mt-3">
        Este roteiro não tem saída aberta agora. A Caqui monta saída fechada para grupo, a partir de
        quatro pessoas, na data que vocês escolherem.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {whatsapp && (
          <a
            href={linkWhatsApp(
              whatsapp,
              `Olá! Queria saber sobre datas para a expedição ${tituloDoRoteiro}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            // `classesDeBotao()` e não a string remontada à mão: a versão
            // manual perdia `text-sm`, `tracking-tight`, a transição e os
            // estados de hover e active. Um botão primário que não afunda no
            // clique é o único do site que não afunda.
            className={classesDeBotao()}
          >
            Pedir data no WhatsApp
          </a>
        )}
        <Link
          href="/agenda"
          className="text-caqui-ink-700 text-rotulo hover:text-caqui-ink-900 rounded-xs text-center font-mono uppercase underline underline-offset-4"
        >
          Ver a agenda inteira
        </Link>
      </div>
    </div>
  )
}
