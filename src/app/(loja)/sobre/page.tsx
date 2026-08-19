import type { Metadata } from 'next'

import { Serra } from '@/components/marca/serra'
import { Etiqueta } from '@/components/ui/badge'
import { LinkBotao } from '@/components/ui/button'
import { metadataDaPagina } from '@/lib/seo/metadata'
import { buscarSettings, listarGuias } from '@/server/services/institucional-service'

export const metadata: Metadata = metadataDaPagina({
  titulo: 'Sobre a Caqui Trekking',
  descricao:
    'Quem é a Caqui Trekking: guias de trekking cadastrados no Cadastur e monitores credenciados pelo PESM, operando na Serra do Mar a partir de Mogi das Cruzes.',
  caminho: '/sobre',
})

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DINÂMICA, E ISSO PRECISA SER DECLARADO
 * ────────────────────────────────────────────────────────────────────────────
 * O texto institucional, o Cadastur e a lista de guias vêm do CRM. Estática, a
 * página serviria o estado do build até o próximo deploy — ver o mesmo bloco na
 * home.
 */
export const dynamic = 'force-dynamic'

/**
 * Sobre a Caqui.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE MUDOU, E POR QUE NÃO FOI SÓ ESTÉTICA
 * ────────────────────────────────────────────────────────────────────────────
 * A versão anterior era um bloco de texto do CRM seguido de duas caixinhas com
 * números. Quando o CRM estava vazio — que é o estado real hoje — a página
 * inteira dizia "O texto institucional é editável no CRM e ainda não foi
 * preenchido". Uma página institucional que confessa estar vazia é pior do que
 * uma página curta que diz algo verdadeiro.
 *
 * Aqui o MÉTODO carrega a página. Ele não depende do CRM porque descreve como a
 * operação funciona, e isso já estava escrito no site — na faixa de
 * credibilidade da home. O texto do CRM, quando existir, entra como a voz da
 * Caqui por cima disso; quando não existir, a página continua de pé e continua
 * dizendo a coisa mais importante.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CREDENCIAL SÓ APARECE SE FOR REAL
 * ────────────────────────────────────────────────────────────────────────────
 * Nenhum bloco desta página inventa número. Cadastur e PESM só são renderizados
 * quando vêm preenchidos do banco; sem eles, o selo continua existindo e diz o
 * que é verificável — "registro no Ministério do Turismo, conferível no
 * portal" — sem exibir um código.
 *
 * Isso não é preciosismo. Até 18/08/2026 o seed criava dois guias de exemplo
 * com `00.000000.00-0` e `PESM-0000`, e eles estavam NO AR, dentro de uma
 * etiqueta escrita "Cadastur". Ver o comentário em `prisma/seed.ts`.
 */
export default async function PaginaSobre() {
  const [settings, guias] = await Promise.all([buscarSettings(), listarGuias()])

  return (
    <>
      {/* ── Abertura ────────────────────────────────────────────────────── */}
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
          <p className="text-rotulo text-caqui-sand-400 font-mono uppercase">Quem leva você</p>
          <h1 className="texto-cartaz text-display-2xl mt-5 text-white">A Caqui</h1>
          <p className="text-corpo-lg text-caqui-sand-200 mt-6 max-w-2xl">
            Ecoturismo e aventura na Serra do Mar, saindo de Mogi das Cruzes. Segurança e qualidade
            em primeiro lugar. Aqui isso é credencial, não slogan.
          </p>
        </div>

        <div aria-hidden="true" className="pointer-events-none relative">
          <div className="text-caqui-sand-200 opacity-30">
            <Serra profundidade={1} />
          </div>
          <div className="text-caqui-sand-200 -mt-[6%] opacity-55">
            <Serra profundidade={3} />
          </div>
        </div>
      </section>

      {/* ── A voz da Caqui, quando existir ──────────────────────────────── */}
      {settings?.sobre && (
        <section
          aria-label="Nossa história"
          className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8"
        >
          <div className="text-corpo-lg text-caqui-ink-700 whitespace-pre-line">
            {settings.sobre}
          </div>
        </section>
      )}

      {/* ── O MÉTODO ─────────────────────────────────────────────────────
          O coração da página, e o único bloco que não depende do CRM. */}
      <section aria-labelledby="metodo" className="secao-areia">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-rotulo text-caqui-forest-800 font-mono uppercase">
            Como a gente opera
          </p>
          <h2 id="metodo" className="text-display-l mt-3 uppercase">
            O que acontece antes de você subir
          </h2>

          <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2" data-cena-lista>
            {METODO.map((passo, indice) => (
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

      {/* ── Credenciais ──────────────────────────────────────────────────
          O selo existe sempre; o NÚMERO só quando é real. */}
      <section
        aria-labelledby="credenciais"
        className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8"
      >
        <h2 id="credenciais" className="text-display-m uppercase">
          Credenciais
        </h2>

        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          <Credencial
            titulo="Cadastur"
            numero={settings?.cadastur ?? null}
            texto="Registro no Ministério do Turismo. Quando informado, o número é conferível no portal oficial do Cadastur."
          />
          <Credencial
            titulo="Credenciamento PESM"
            numero={settings?.pesm ?? null}
            texto="Monitores credenciados pelo Parque Estadual da Serra do Mar, exigidos nos roteiros dentro da unidade de conservação."
          />
        </dl>
      </section>

      {/* ── Guias ────────────────────────────────────────────────────────── */}
      {guias.length > 0 && (
        <section aria-labelledby="equipe" className="secao-areia">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
            <h2 id="equipe" className="text-display-m uppercase">
              Guias e monitores
            </h2>

            <ul className="border-caqui-rule mt-10 border-t" data-cena-lista>
              {guias.map((guia, indice) => (
                <li
                  key={guia.id}
                  className="border-caqui-rule grid grid-cols-[auto_1fr] items-start gap-x-5 border-b py-6 sm:gap-x-8"
                >
                  <span className="numeral text-numeral text-caqui-ink-500 leading-none">
                    {String(indice + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-display-s uppercase">{guia.nome}</h3>
                    {guia.bio && (
                      <p className="text-caqui-ink-700 text-corpo mt-2 max-w-2xl">{guia.bio}</p>
                    )}
                    {(guia.cadastur ?? guia.pesm) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {guia.cadastur && <Etiqueta tom="mata">Cadastur {guia.cadastur}</Etiqueta>}
                        {guia.pesm && <Etiqueta tom="mata">PESM {guia.pesm}</Etiqueta>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Saída ────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
        <div className="border-caqui-rule flex flex-wrap items-center justify-between gap-6 border-t pt-8">
          <p className="text-corpo-lg text-caqui-ink-700 max-w-md">
            Quer subir com a gente? Escolha uma data na agenda, ou monte a saída do seu jeito.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkBotao href="/agenda">Ver a agenda</LinkBotao>
            <LinkBotao href="/guia-particular" variante="secondary">
              Guia particular
            </LinkBotao>
          </div>
        </div>
      </section>
    </>
  )
}

/**
 * Uma credencial.
 *
 * O selo é sempre renderizado; o NÚMERO só quando existe. Sem ele, o texto
 * explica o que a credencial é — o que é verdadeiro e útil — em vez de um campo
 * vazio ou, pior, de um código inventado.
 */
function Credencial({
  titulo,
  numero,
  texto,
}: {
  titulo: string
  numero: string | null
  texto: string
}) {
  return (
    <div className="border-caqui-rule border p-5">
      <dt className="text-caqui-ink-500 text-micro font-mono uppercase">{titulo}</dt>
      {numero ? (
        <dd className="text-dado mt-2 font-mono break-all">{numero}</dd>
      ) : (
        <dd className="text-caqui-ink-500 text-corpo-sm mt-2 italic">
          Número ainda não informado.
        </dd>
      )}
      <p className="text-caqui-ink-700 text-corpo-sm mt-3">{texto}</p>
    </div>
  )
}

/**
 * O método.
 *
 * Cada item aqui já era afirmado pelo site — os três primeiros vêm da faixa de
 * credibilidade da home, e o quarto do que a página de cada roteiro entrega
 * (ponto de encontro, o que levar, política de cancelamento). Nada foi
 * inventado, e nenhum número foi acrescentado: "grupo com tamanho limitado" fica
 * como está, sem um teto que eu não tenho.
 */
const METODO = [
  {
    titulo: 'Quem guia é credenciado',
    texto:
      'Guias com registro no Cadastur e, nos roteiros dentro do Parque Estadual da Serra do Mar, monitores credenciados pelo PESM.',
  },
  {
    titulo: 'Equipamento conferido',
    texto:
      'O equipamento coletivo é checado peça por peça antes de cada saída: corda, capacete e o que o roteiro exigir.',
  },
  {
    titulo: 'Briefing antes de sair',
    texto:
      'Ninguém entra na trilha sem saber o percurso, o ritmo, os pontos de atenção e o que fazer se o tempo virar.',
  },
  {
    titulo: 'Grupo com tamanho limitado',
    texto:
      'O número de vagas por saída é fechado de propósito: guia que enxerga o grupo inteiro é o que torna o resto possível.',
  },
] as const
