import type { Metadata } from 'next'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'
import { Etiqueta } from '@/components/ui/badge'
import { Card, CardCorpo } from '@/components/ui/card'
import { buscarSettings, listarGuias } from '@/server/services/institucional-service'

export const metadata: Metadata = {
  title: 'Sobre',
  description:
    'Quem é a Caqui Trekking: guias cadastrados no Cadastur e monitores credenciados pelo PESM, em Mogi das Cruzes.',
}

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

export default async function PaginaSobre() {
  const [settings, guias] = await Promise.all([buscarSettings(), listarGuias()])

  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Quem leva você"
        titulo="Sobre a Caqui"
        descricao="Segurança e qualidade em 1º lugar. Isso é credencial, não slogan."
      />

      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8">
        {settings?.sobre ? (
          <div className="text-corpo-lg whitespace-pre-line">{settings.sobre}</div>
        ) : (
          <p className="text-caqui-ink-700 text-corpo-lg">
            O texto institucional é editável no CRM e ainda não foi preenchido.
          </p>
        )}

        <dl className="mt-10 grid gap-4 sm:grid-cols-2">
          {settings?.cadastur && (
            <div className="border-caqui-rule border p-4">
              <dt className="text-caqui-ink-500 text-micro font-mono uppercase">Cadastur</dt>
              <dd className="text-corpo mt-1 font-mono break-all">{settings.cadastur}</dd>
            </div>
          )}
          {settings?.pesm && (
            <div className="border-caqui-rule border p-4">
              <dt className="text-caqui-ink-500 text-micro font-mono uppercase">
                Credenciamento PESM
              </dt>
              <dd className="text-corpo mt-1 font-mono">{settings.pesm}</dd>
            </div>
          )}
        </dl>
      </div>

      {guias.length > 0 && (
        <section className="secao-areia">
          <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
            <h2 className="text-display-m uppercase">Guias e monitores</h2>

            <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {guias.map((guia) => (
                <li key={guia.id}>
                  <Card plano className="h-full bg-white">
                    <CardCorpo>
                      <h3 className="text-display-s uppercase">{guia.nome}</h3>
                      {guia.bio && <p className="text-caqui-ink-700 text-corpo-sm">{guia.bio}</p>}
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        {guia.cadastur && <Etiqueta tom="mata">Cadastur {guia.cadastur}</Etiqueta>}
                        {guia.pesm && <Etiqueta tom="mata">PESM {guia.pesm}</Etiqueta>}
                      </div>
                    </CardCorpo>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
