import Link from 'next/link'

import { Brasao } from '@/components/marca/grafismos'
import { Newsletter } from '@/components/shell/newsletter'
import { linkInstagram, linkWhatsApp, telefoneBR } from '@/lib/formato'
import type { SettingsDTO } from '@/server/services/institucional-service'

/**
 * Rodapé.
 *
 * Componente de servidor: recebe as configurações já resolvidas pelo layout.
 * Nada aqui é `hardcoded` — número, Instagram, Cadastur e credencial do PESM
 * saem do banco, editáveis no CRM.
 *
 * No projeto de referência, trocar o número de WhatsApp exigia editar quatro
 * arquivos e publicar, e um deles guardava o número dentro de uma URL
 * percent-encoded escrita à mão. Um deles ia ser esquecido, e o esquecido
 * mandaria clientes para um número morto.
 */

const LINKS = [
  { href: '/trekking', rotulo: 'Expedições' },
  { href: '/agenda', rotulo: 'Agenda' },
  { href: '/wear', rotulo: 'Caqui Wear' },
  { href: '/sobre', rotulo: 'Sobre nós' },
  { href: '/contato', rotulo: 'Contato' },
] as const

export function Footer({ settings }: { settings: SettingsDTO | null }) {
  return (
    <footer className="bg-caqui-ink-900 mt-auto text-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[auto_1fr_auto]">
          {/* ── Marca e credenciais ── */}
          <div className="flex flex-col gap-5">
            <Brasao className="w-28" titulo="Caqui Trekking" />

            <p className="font-display text-display-s text-caqui-realce-escuro uppercase">
              Segurança e qualidade em 1º lugar
            </p>

            <dl className="text-micro flex flex-col gap-2 font-mono uppercase">
              {settings?.cadastur && (
                <div>
                  <dt className="text-caqui-sand-400">Cadastur</dt>
                  {/* `break-all` porque o número tem 20 caracteres e, a 200%
                      de zoom em 320px, forçaria rolagem horizontal. */}
                  <dd className="text-caqui-sand-100 break-all">{settings.cadastur}</dd>
                </div>
              )}
              {settings?.pesm && (
                <div>
                  <dt className="text-caqui-sand-400">Credenciamento PESM</dt>
                  <dd className="text-caqui-sand-100">{settings.pesm}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* ── Navegação e contato ── */}
          <div className="grid gap-10 sm:grid-cols-2">
            <nav aria-label="Rodapé">
              <h2 className="text-caqui-sand-400 text-micro font-mono uppercase">Navegar</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover:text-caqui-realce-escuro text-corpo transition-colors"
                    >
                      {link.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="text-caqui-sand-400 text-micro font-mono uppercase">
                Falar com a gente
              </h2>
              <ul className="text-corpo mt-4 flex flex-col gap-2.5">
                {settings?.whatsappNumber && (
                  <li>
                    <a
                      href={linkWhatsApp(settings.whatsappNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-caqui-realce-escuro transition-colors"
                    >
                      {telefoneBR(settings.whatsappNumber)}
                      <span className="text-caqui-sand-400 text-micro ml-2 font-mono uppercase">
                        WhatsApp
                      </span>
                    </a>
                  </li>
                )}
                {settings?.email && (
                  <li>
                    <a
                      href={`mailto:${settings.email}`}
                      className="hover:text-caqui-realce-escuro transition-colors"
                    >
                      {settings.email}
                    </a>
                  </li>
                )}
                {settings?.instagramTrekking && (
                  <li>
                    <a
                      href={linkInstagram(settings.instagramTrekking)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-caqui-realce-escuro transition-colors"
                    >
                      {settings.instagramTrekking}
                      <span className="text-caqui-sand-400 text-micro ml-2 font-mono uppercase">
                        Trekking
                      </span>
                    </a>
                  </li>
                )}
                {settings?.instagramWear && (
                  <li>
                    <a
                      href={linkInstagram(settings.instagramWear)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-caqui-realce-escuro transition-colors"
                    >
                      {settings.instagramWear}
                      <span className="text-caqui-sand-400 text-micro ml-2 font-mono uppercase">
                        Wear
                      </span>
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* ── Newsletter ── */}
          <div className="lg:w-72">
            <Newsletter />
          </div>
        </div>

        <div className="border-caqui-rule-invertido mt-12 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caqui-sand-400 text-micro font-mono uppercase">
            © {new Date().getFullYear()} Caqui Trekking · Mogi das Cruzes · SP
          </p>
          <p className="text-caqui-sand-400 text-micro font-mono uppercase">
            O pagamento não acontece aqui · você fecha no WhatsApp
          </p>
        </div>
      </div>
    </footer>
  )
}
