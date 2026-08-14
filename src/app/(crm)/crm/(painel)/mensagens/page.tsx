import type { Metadata } from 'next'

import { CaixaDeMensagens, type MensagemDoPainel } from '@/components/crm/caixa-de-mensagens'
import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { dataCurta, horaLocal } from '@/lib/datetime'
import { telefoneBR } from '@/lib/formato'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = { title: 'Mensagens', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Caixa de entrada: mensagens de contato e leads.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O LEAD MOSTRA SE PODE VIRAR CAMPANHA
 * ────────────────────────────────────────────────────────────────────────────
 * `consentAt` não é decoração de auditoria: é o que separa um contato que a
 * Caqui pode incluir num disparo de um que ela não pode. A coluna aparece na
 * tela porque a decisão é de quem opera, e ela precisa da informação na hora
 * de montar a lista — não escondida num campo que só o banco vê.
 *
 * Lead sem consentimento continua na lista, marcado. Some-lo seria pior: a
 * pessoa pediu para ser avisada de uma vaga específica, e esse pedido continua
 * valendo mesmo sem autorização para campanha.
 */
export default async function PaginaMensagens() {
  await exigirSessaoDaPagina()

  const [mensagens, leads] = await Promise.all([
    prisma.contactMessage.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        message: true,
        read: true,
        createdAt: true,
        trip: { select: { title: true } },
      },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.lead.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        source: true,
        consentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  const dados: MensagemDoPainel[] = mensagens.map((m) => ({
    id: m.id,
    nome: m.name,
    email: m.email,
    telefone: m.phone,
    mensagem: m.message,
    lida: m.read,
    quando: `${dataCurta(m.createdAt)} · ${horaLocal(m.createdAt)}`,
    roteiro: m.trip?.title ?? null,
  }))

  const naoLidas = dados.filter((m) => !m.lida).length

  return (
    <>
      <CabecalhoDeSecao
        titulo="Caixa"
        descricao="Quem escreveu pelo site e quem pediu para ser avisado."
        acao={<Rotulo>{naoLidas} não lida(s)</Rotulo>}
      />

      <div className="flex flex-col gap-4">
        <Painel titulo="Mensagens de contato" acao={<Rotulo>{dados.length}</Rotulo>}>
          <CaixaDeMensagens mensagens={dados} />
        </Painel>

        <Painel titulo="Leads: avise-me e newsletter" acao={<Rotulo>{leads.length}</Rotulo>}>
          {leads.length === 0 ? (
            <Vazio titulo="Nenhum lead ainda">
              <p>
                Aparecem aqui os contatos deixados no &ldquo;Avise-me&rdquo; de uma saída esgotada e
                na assinatura do rodapé.
              </p>
            </Vazio>
          ) : (
            <ul className="divide-caqui-rule divide-y">
              {leads.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <span className="text-corpo-sm">{l.name ?? 'Sem nome'}</span>
                  <span className="text-caqui-ink-700 text-micro font-mono">
                    {l.email ?? (l.phone ? telefoneBR(l.phone) : '—')}
                  </span>
                  <Rotulo>{l.source}</Rotulo>
                  <span className="ml-auto">
                    {l.consentAt ? (
                      // forest-800 sobre branco = 11,08:1
                      <span className="text-caqui-forest-800 text-micro font-mono uppercase">
                        Consentiu {dataCurta(l.consentAt)}
                      </span>
                    ) : (
                      <span className="text-caqui-danger text-micro font-mono uppercase">
                        Sem consentimento
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <p className="text-caqui-ink-500 text-micro font-mono uppercase">
          Lead sem consentimento não pode entrar em disparo. É a LGPD.
        </p>
      </div>
    </>
  )
}
