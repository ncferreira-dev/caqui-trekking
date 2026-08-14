import type { ReactNode } from 'react'

import type { SettingsDTO } from '@/server/services/institucional-service'

/**
 * A faixa de credibilidade da home.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TRÊS SELOS, E O NÚMERO QUANDO ELE EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * O briefing pede "Guias Cadastur · Monitores credenciados PESM · Segurança e
 * Qualidade em 1° lugar". Os dois primeiros são registros verificáveis, e o
 * número deles está no banco, editável no CRM. Quando existe, ele aparece:
 * "Cadastur 26.123456.10.0001-3" prova o que "guias certificados" só alega.
 *
 * Quando não existe, o selo continua — só sem o número. É a mesma regra do
 * rodapé: falha de dado ESSENCIAL é erro, falha de dado acessório é ausência.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * É UM `<ul>`, NÃO TRÊS DIVS
 * ────────────────────────────────────────────────────────────────────────────
 * São três itens da mesma natureza. Quem usa leitor de tela ouve "lista de 3
 * itens" e sabe quantos vêm pela frente; com divs soltas, ouve três frases sem
 * relação nenhuma entre si.
 */
export function FaixaDeCredibilidade({ settings }: { settings: SettingsDTO | null }) {
  return (
    <section aria-label="Credenciais da Caqui Trekking" className="secao-areia">
      <ul className="mx-auto grid w-full max-w-7xl gap-px px-5 py-8 sm:grid-cols-3 sm:px-8">
        <Selo
          icone={<Certificado />}
          titulo="Guias Cadastur"
          {...(settings?.cadastur ? { dado: settings.cadastur } : {})}
          texto="Registro no Ministério do Turismo, conferível no portal."
        />
        <Selo
          icone={<Montanha />}
          titulo="Monitores PESM"
          {...(settings?.pesm ? { dado: settings.pesm } : {})}
          texto="Credenciados pelo Parque Estadual da Serra do Mar."
        />
        <Selo
          icone={<Escudo />}
          titulo="Segurança em 1º lugar"
          texto="Equipamento conferido, briefing antes de sair e grupo com tamanho limitado."
        />
      </ul>
    </section>
  )
}

function Selo({
  icone,
  titulo,
  dado,
  texto,
}: {
  icone: ReactNode
  titulo: string
  dado?: string
  texto: string
}) {
  return (
    <li className="flex gap-4 py-4 sm:px-6 sm:py-2 sm:first:pl-0 sm:last:pr-0">
      <span className="text-caqui-ink-900 shrink-0" aria-hidden="true">
        {icone}
      </span>

      <div>
        <p className="font-display text-corpo uppercase">{titulo}</p>
        {dado && <p className="text-caqui-ink-900 text-micro mt-0.5 font-mono break-all">{dado}</p>}
        <p className="text-caqui-ink-700 text-corpo-sm mt-1">{texto}</p>
      </div>
    </li>
  )
}

/* Os três desenhados à mão, com o mesmo traço gravado das montanhas da logo:
   contorno de 1,6px, terminação reta, sem preenchimento. Um pacote de ícones
   traria três estilos diferentes dos nossos grafismos na mesma faixa. */

function Certificado() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M6 4h20v18H6z" />
      <path d="M10 10h12M10 15h8" strokeLinecap="square" />
      <circle cx="22" cy="24" r="4" />
      <path d="M20 27v5l2-1.4 2 1.4v-5" strokeLinejoin="round" />
    </svg>
  )
}

function Montanha() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M2 26 12 8l6 10 3-5 9 13z" strokeLinejoin="round" />
      <path d="M9 14h6" strokeLinecap="square" />
    </svg>
  )
}

function Escudo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M16 3 5 7v9c0 7 5 11.6 11 13 6-1.4 11-6 11-13V7z" strokeLinejoin="round" />
      <path d="m11 16 3.5 3.5L21 13" strokeLinecap="square" />
    </svg>
  )
}
