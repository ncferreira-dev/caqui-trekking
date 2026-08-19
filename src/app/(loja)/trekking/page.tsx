import type { Metadata } from 'next'

import { LinhaDeRoteiro } from '@/components/catalogo/linha-de-roteiro'
import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { LinkBotao } from '@/components/ui/button'
import { listarTrips } from '@/server/services/trip-service'
import { metadataDaPagina } from '@/lib/seo/metadata'

/**
 * O título era "Expedições" — bonito, e invisível para a busca.
 *
 * A palavra "trekking" só aparecia no sufixo da marca ("Expedições · Caqui
 * Trekking"), então quem digita "trekking mogi das cruzes" não encontrava aqui
 * o termo que digitou. A URL já é `/trekking`; o `<title>` agora concorda com
 * ela, e o `<h1>` da página também.
 */
export const metadata: Metadata = metadataDaPagina({
  titulo: 'Trekking e expedições guiadas',
  descricao:
    'Roteiros de trekking guiado na Serra do Mar, saindo de Mogi das Cruzes: distância, altimetria, dificuldade e duração de cada trilha.',
  caminho: '/trekking',
})

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DINÂMICA, E ISSO PRECISA SER DECLARADO
 * ────────────────────────────────────────────────────────────────────────────
 * Esta página não usa nenhuma API dinâmica do Next — só chama o serviço, que
 * fala direto com o Prisma. Sem `fetch` para o Next observar e sem `cookies()`
 * ou `searchParams`, ela é PRÉ-RENDERIZADA no build e servida do Full Route
 * Cache até o próximo deploy.
 *
 * Isso quebra a regra central do projeto: disponibilidade é editada à mão no
 * CRM, e `encerrada` é derivada de `new Date()` no momento do render. Estática,
 * a página serviria para sempre o estado do build — SOLD_OUT invisível, preço
 * reajustado que não chega, e saída já realizada listada como futura.
 *
 * É a mesma doutrina do carrinho, do outro lado: dado guardado envelhece.
 * As 30 rotas de `src/app/api/*` declaram o mesmo `force-dynamic` pelo mesmo
 * motivo.
 */
export const dynamic = 'force-dynamic'

/**
 * A vitrine dos roteiros.
 *
 * A diferença entre esta página e a agenda é a pergunta que cada uma responde.
 * Aqui: "para onde dá para ir?" — e o card lidera com a FICHA TÉCNICA, porque
 * o que separa dois roteiros é distância, ganho de elevação e dificuldade. Na
 * agenda: "o que tem no dia 15?" — e lá o card lidera com a data.
 *
 * O mesmo dado, ordenado por duas perguntas diferentes. É por isso que são
 * dois componentes de card e não um com `variante`.
 */
export default async function PaginaTrekking() {
  const { trips, total } = await listarTrips({ limit: 30, offset: 0 })

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Roteiros"
        titulo="Trekking"
        descricao="Cada roteiro é escrito uma vez e repetido em datas diferentes. Escolha o roteiro aqui; a data, na agenda."
        cota={`${total} ${total === 1 ? 'roteiro' : 'roteiros'}`}
        acao={<LinkBotao href="/agenda">Ver por data</LinkBotao>}
      />

      {/* O índice editorial.
          Grid de cards saiu pelo mesmo motivo da home: nenhum roteiro tem capa
          no banco, então cada card renderizava o grafismo de vazio, e cinco
          retângulos cinzas em três colunas leem como catálogo quebrado. Aqui a
          ficha técnica ocupa o lugar visual que a foto ocuparia — e ela é, de
          fato, o que decide entre um roteiro e outro. */}
      <section aria-label="Roteiros" className="pb-20 sm:pb-24">
        {trips.length === 0 ? (
          <p className="text-caqui-ink-700 text-corpo-lg mx-auto w-full max-w-7xl px-5 pt-16 sm:px-8">
            Nenhum roteiro publicado ainda.
          </p>
        ) : (
          <div className="border-caqui-rule mt-12 border-t" data-cena-lista>
            {trips.map((trip, indice) => (
              <LinhaDeRoteiro key={trip.slug} trip={trip} indice={indice} />
            ))}
          </div>
        )}

        {/* Saída para quem chegou aqui e não achou o que queria. A página de
            guia particular existe justamente para o caso "quero ir num lugar
            que não está na lista". */}
        <div className="mx-auto mt-14 w-full max-w-7xl px-5 sm:px-8">
          <div className="border-caqui-rule flex flex-wrap items-center justify-between gap-6 border-t pt-8">
            <p className="text-corpo-lg text-caqui-ink-700 max-w-md">
              Quer ir a um lugar que não está na lista, ou fechar a trilha só para o seu grupo?
            </p>
            <LinkBotao href="/guia-particular" variante="secondary">
              Pedir uma saída particular
            </LinkBotao>
          </div>
        </div>
      </section>
    </>
  )
}
