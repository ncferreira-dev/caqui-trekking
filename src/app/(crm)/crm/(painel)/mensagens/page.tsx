import type { Metadata } from 'next'

import { CaixaDeMensagens, type MensagemDoPainel } from '@/components/crm/caixa-de-mensagens'
import { CabecalhoDeSecao, Painel, Rotulo, Vazio } from '@/components/crm/pecas'
import { dataCurta, horaLocal } from '@/lib/datetime'
import { telefoneBR } from '@/lib/formato'
import { Paginacao } from '@/components/crm/paginacao'
import { fatiar } from '@/lib/crm/paginacao'
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
/**
 * 50 por caixa. As duas listas paginam SEPARADO (`?mensagens=` e `?leads=`):
 * elas crescem em ritmos muito diferentes, e uma página só faria a segunda
 * pular junto com a primeira sem ninguém pedir.
 */
const POR_PAGINA = 50

export default async function PaginaMensagens({ searchParams }: PageProps<'/crm/mensagens'>) {
  await exigirSessaoDaPagina()

  const params = await searchParams
  const [totalMensagens, totalLeads] = await Promise.all([
    prisma.contactMessage.count(),
    prisma.lead.count(),
  ])
  const fatiaMensagens = fatiar(params['mensagens'], totalMensagens, POR_PAGINA)
  const fatiaLeads = fatiar(params['leads'], totalLeads, POR_PAGINA)

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
      take: fatiaMensagens.tamanho,
      skip: fatiaMensagens.offset,
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
      take: fatiaLeads.tamanho,
      skip: fatiaLeads.offset,
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

          <Paginacao
            fatia={fatiaMensagens}
            itens="mensagens"
            href={(p) => (p <= 1 ? '/crm/mensagens' : `/crm/mensagens?mensagens=${p}`)}
          />
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
                    {l.email ?? (l.phone ? telefoneBR(l.phone) : 'Sem contato')}
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
          <Paginacao
            fatia={fatiaLeads}
            itens="leads"
            href={(p) => (p <= 1 ? '/crm/mensagens' : `/crm/mensagens?leads=${p}`)}
          />
        </Painel>

        <p className="text-caqui-ink-500 text-micro font-mono uppercase">
          Lead sem consentimento não pode entrar em disparo. É a LGPD.
        </p>
      </div>
    </>
  )
}
