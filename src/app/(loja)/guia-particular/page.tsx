import type { Metadata } from 'next'
import Link from 'next/link'

import { Serra } from '@/components/marca/serra'
import { JsonLdScript } from '@/components/seo/json-ld'
import { LinkBotao } from '@/components/ui/button'
import { linkWhatsApp } from '@/lib/formato'
import { migalhas, servicoDeGuia } from '@/lib/seo/json-ld'
import { metadataDaPagina } from '@/lib/seo/metadata'
import { URL_BASE } from '@/lib/seo/site'
import { buscarSettings } from '@/server/services/institucional-service'

/**
 * Guia particular — a saída fechada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O TÍTULO CARREGA O TERMO QUE A PESSOA DIGITA
 * ────────────────────────────────────────────────────────────────────────────
 * "Guia particular de trekking" e não "Saídas exclusivas". O segundo é mais
 * bonito e não é procurado por ninguém: quem quer isto digita "guia particular
 * trilha", "guia de trekking", "guia particular Mogi das Cruzes".
 *
 * Não é enfeitar o texto com palavra-chave — é escrever o nome que a coisa tem
 * no idioma de quem procura. O `<h1>`, o `<title>`, a descrição e o
 * `serviceType` do JSON-LD dizem a mesma coisa, que é o que o Google usa para
 * concluir que a página É sobre isso.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A MENSAGEM DO WHATSAPP JÁ VAI PREENCHIDA COMO FORMULÁRIO
 * ────────────────────────────────────────────────────────────────────────────
 * O pedido do cliente foi um texto convidando a pessoa a contar destino e
 * quantidade. O texto está na página — e a mensagem que abre no WhatsApp
 * repete a mesma estrutura em campos vazios.
 *
 * Isso não é firula: a Caqui responde no celular, e a diferença entre receber
 * "oi, quanto custa?" e receber destino, número de pessoas e data é a diferença
 * entre uma conversa de dez mensagens e um orçamento em uma. Quem chega já
 * com os campos na tela tende a preenchê-los.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = metadataDaPagina({
  titulo: 'Guia particular de trekking',
  descricao:
    'Saída fechada com guia particular na Serra do Mar: você escolhe o destino, a data e quem vai. Guias com Cadastur e monitores credenciados pelo PESM, saindo de Mogi das Cruzes.',
  caminho: '/guia-particular',
})

/**
 * A mensagem que abre no WhatsApp.
 *
 * Vive aqui, e não no `whatsappMessageTemplate` do CRM, porque aquele template
 * pertence ao carrinho — ele tem placeholders de item, quantidade e preço, e é
 * montado pelo `lib/carrinho/mensagem.ts`. Reaproveitá-lo aqui obrigaria a
 * inventar valores para placeholders que não existem nesta conversa.
 */
const PEDIDO =
  'Olá! Quero uma saída particular com a Caqui Trekking.\n\n' +
  'Para onde: \n' +
  'Quantas pessoas: \n' +
  'Data (ou mês): \n' +
  'Nível do grupo: '

export default async function PaginaGuiaParticular() {
  const settings = await buscarSettings()

  const dadosEstruturados = [
    servicoDeGuia(URL_BASE, settings),
    migalhas(URL_BASE, [
      { nome: 'Início', caminho: '/' },
      { nome: 'Guia particular', caminho: '/guia-particular' },
    ]),
  ]

  return (
    <>
      <JsonLdScript dados={dadosEstruturados} />

      {/* ── Abertura em palco noturno ─────────────────────────────────────
          Esta página não usa `CabecalhoDePagina` (a faixa de areia das páginas
          internas) de propósito: ela é uma OFERTA, não um índice. O palco
          escuro a marca como parente do herói da home, e é o que separa "olha
          o catálogo" de "fale com a gente". */}
      <section
        className="palco-noite relative isolate overflow-hidden"
        style={
          {
            '--serra-massa': 'var(--color-caqui-noite-900)',
            '--neblina-mistura': 'screen',
          } as React.CSSProperties
        }
      >
        <div className="grao pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-5xl px-5 pt-16 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
          <p className="text-rotulo text-caqui-sand-400 font-mono uppercase">
            Saída fechada · No seu ritmo
          </p>
          <h1 className="texto-cartaz text-display-2xl mt-5 text-white">
            Guia particular de trekking
          </h1>
          <p className="text-corpo-lg text-caqui-sand-200 mt-6 max-w-2xl">
            Você diz para onde quer ir, quem vai junto e quando. A gente monta a saída em volta
            disso. Sem grupo aberto, sem dividir a trilha com quem você não conhece.
          </p>
        </div>

        <div aria-hidden="true" className="pointer-events-none relative">
          <div className="text-caqui-sand-200 opacity-30">
            <Serra profundidade={2} />
          </div>
          <div className="text-caqui-sand-200 -mt-[6%] opacity-55">
            <Serra profundidade={4} />
          </div>
        </div>
      </section>

      {/* ── O convite e o botão ───────────────────────────────────────────
          O texto vem ANTES do botão, e é o pedido do cliente: dizer à pessoa o
          que contar. Um botão de WhatsApp sozinho recebe "oi"; um botão
          precedido de três perguntas recebe um briefing. */}
      <section aria-labelledby="conversa" className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
        <div className="border-caqui-rule border-t pt-10">
          <h2 id="conversa" className="text-display-m uppercase">
            Conta pra gente o essencial
          </h2>

          <p className="text-corpo-lg text-caqui-ink-700 mt-5 max-w-2xl">
            Manda uma mensagem dizendo <strong className="text-caqui-ink-900">para onde</strong>{' '}
            você pretende ir, <strong className="text-caqui-ink-900">quantas pessoas</strong> vão e{' '}
            <strong className="text-caqui-ink-900">quando</strong>. Se ainda não sabe o destino,
            tudo bem: diga quanto tempo tem e como é o preparo do grupo, e a gente sugere o roteiro
            que combina.
          </p>

          <div className="mt-9">
            {settings?.whatsappNumber ? (
              <a
                href={linkWhatsApp(settings.whatsappNumber, PEDIDO)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-caqui-forest-600 focus-visible:ring-caqui-ink-900 border-caqui-ink-900 font-display text-corpo hover:bg-caqui-forest-800 inline-flex min-h-13 items-center justify-center gap-3 rounded-xs border px-7 text-white uppercase shadow-[var(--shadow-corte-2)] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-corte-3)] focus-visible:ring-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <IconeWhatsApp />
                Falar no WhatsApp
              </a>
            ) : (
              /* Falha de dado ACESSÓRIO é ausência, não erro — a mesma regra do
                 rodapé. Sem número cadastrado, o formulário continua servindo. */
              <LinkBotao href="/contato" tamanho="lg">
                Falar com a Caqui
              </LinkBotao>
            )}

            <p className="text-caqui-ink-500 text-corpo-sm mt-4">
              Prefere escrever?{' '}
              <Link href="/contato" className="rounded-xs underline underline-offset-4">
                Use o formulário
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ── Como funciona ────────────────────────────────────────────────── */}
      <section aria-labelledby="como" className="secao-areia">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
          <h2 id="como" className="text-display-m uppercase">
            Como funciona
          </h2>

          <ol className="mt-10 grid gap-8 sm:grid-cols-3" data-cena-lista>
            {PASSOS.map((passo, indice) => (
              <li key={passo.titulo} className="border-caqui-rule border-t pt-5">
                <span className="numeral text-numeral text-caqui-forest-800">
                  {String(indice + 1).padStart(2, '0')}
                </span>
                <h3 className="text-display-s mt-3 uppercase">{passo.titulo}</h3>
                <p className="text-corpo text-caqui-ink-700 mt-2">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── O que está sempre incluso ─────────────────────────────────────
          Fatos que já existem no site (faixa de credibilidade e /sobre). Nada
          inventado: sem número de pessoas, sem preço, sem promessa de prazo. */}
      <section aria-labelledby="incluso" className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
        <h2 id="incluso" className="text-display-m uppercase">
          O que vai junto, sempre
        </h2>

        <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {INCLUSO.map((item) => (
            <li key={item} className="border-caqui-rule text-corpo flex gap-3 border-b pb-4">
              <span className="text-caqui-forest-600 shrink-0" aria-hidden="true">
                <svg viewBox="0 0 20 20" className="mt-1 size-4" fill="none" strokeWidth="2.2">
                  <path d="M3 10.5 7.5 15 17 5" stroke="currentColor" strokeLinecap="square" />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>

        <p className="text-caqui-ink-700 text-corpo mt-10">
          Ainda em dúvida sobre o destino?{' '}
          <Link href="/trekking" className="rounded-xs underline underline-offset-4">
            Veja os roteiros que a gente já opera
          </Link>
          . Qualquer um deles pode virar saída fechada.
        </p>
      </section>
    </>
  )
}

const PASSOS = [
  {
    titulo: 'Você conta',
    texto: 'Destino, quantas pessoas, quando e como é o preparo do grupo. Uma mensagem basta.',
  },
  {
    titulo: 'A gente desenha',
    texto:
      'Sugerimos o roteiro, o horário de encontro e o que levar, e ajustamos o ritmo ao grupo.',
  },
  {
    titulo: 'Fecha e sobe',
    texto: 'Confirmado o dia, você recebe o briefing e a lista de equipamento antes da saída.',
  },
] as const

const INCLUSO = [
  'Guia cadastrado no Cadastur, conferível no portal do Ministério do Turismo',
  'Monitor credenciado pelo Parque Estadual da Serra do Mar quando o roteiro exige',
  'Briefing de segurança antes de sair',
  'Equipamento coletivo conferido peça por peça',
  'Roteiro ajustado ao ritmo do grupo, não ao contrário',
  'Grupo fechado: só quem você convidou',
] as const

/** O glifo oficial do WhatsApp. Traço fechado, para escalar sem borrar. */
function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 5.83 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09s.9 2.43 1.02 2.6c.12.16 1.76 2.69 4.26 3.77.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  )
}
