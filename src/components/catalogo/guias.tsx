import { Imagem, MidiaVazia } from '@/components/midia/imagem'
import type { GuiaDTO } from '@/server/dto/public-dto'

/**
 * Os guias responsáveis.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A CREDENCIAL É UM NÚMERO, E O NÚMERO APARECE
 * ────────────────────────────────────────────────────────────────────────────
 * "Guias certificados" é o que qualquer site escreve. O Cadastur é um registro
 * público e conferível no portal do Ministério do Turismo, e a credencial do
 * PESM é emitida pelo Parque Estadual da Serra do Mar — os dois são
 * verificáveis por quem quiser verificar.
 *
 * Imprimir o número é a diferença entre alegar e provar, e é o argumento mais
 * forte que uma operadora de trilha guiada tem contra o "conhecido que leva o
 * pessoal no fim de semana". Por isso vêm em mono, tratados como dado —
 * mesmo registro tipográfico de distância e cota.
 *
 * Guia sem foto não vira card quebrado: entra com o grafismo das montanhas,
 * porque a credencial vale sem retrato e o cadastro vai ser feito do celular,
 * no meio da trilha.
 */
export function Guias({ guias }: { guias: GuiaDTO[] }) {
  if (guias.length === 0) return null

  return (
    <section aria-labelledby="guias" className="flex flex-col gap-5">
      <h2 id="guias" className="text-display-s uppercase">
        Quem leva você
      </h2>

      <ul className="grid gap-5 sm:grid-cols-2">
        {guias.map((guia) => {
          const foto = guia.fotos[0]

          return (
            <li key={guia.id} className="border-caqui-ink-900 flex gap-4 border bg-white p-4">
              <div className="border-caqui-ink-900 size-20 shrink-0 overflow-hidden border">
                {/* `semente` pelo nome: sem ela, uma equipe de quatro
                    guias sem foto aparece como quatro chapas idênticas lado a
                    lado, que lê como falha de carregamento e não como gravura.
                    Ver `MidiaVazia` em `midia/imagem.tsx`. */}
                {foto ? <Imagem midia={foto} sizes="5rem" /> : <MidiaVazia semente={guia.nome} />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-display text-corpo uppercase">{guia.nome}</p>

                <dl className="mt-1.5 flex flex-col gap-0.5">
                  {guia.cadastur && (
                    <div className="flex gap-1.5">
                      <dt className="text-caqui-ink-500 text-micro font-mono uppercase">
                        Cadastur
                      </dt>
                      <dd className="text-caqui-ink-900 text-micro font-mono">{guia.cadastur}</dd>
                    </div>
                  )}
                  {guia.pesm && (
                    <div className="flex gap-1.5">
                      <dt className="text-caqui-ink-500 text-micro font-mono uppercase">PESM</dt>
                      <dd className="text-caqui-ink-900 text-micro font-mono">{guia.pesm}</dd>
                    </div>
                  )}
                </dl>

                {guia.bio && (
                  <p className="text-caqui-ink-700 text-corpo-sm mt-2 line-clamp-3">{guia.bio}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
