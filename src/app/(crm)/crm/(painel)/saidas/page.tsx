import { redirect } from 'next/navigation'

/**
 * `/crm/saidas` virou `/crm/trilhas` em 20/08/2026.
 *
 * O redirecionamento fica porque o endereço antigo está espalhado: o painel
 * aponta para ele em seis lugares, e alguém pode ter deixado a aba aberta ou o
 * link salvo. Uma rota que some em silêncio vira 404 no meio da operação.
 *
 * `?mes=` viaja junto — é o mesmo parâmetro na tela nova, e perder o mês
 * jogaria a pessoa em outro lugar do tempo sem explicação.
 */
export default async function RedirecionaSaidas({ searchParams }: PageProps<'/crm/saidas'>) {
  const params = await searchParams
  const mes = Array.isArray(params['mes']) ? params['mes'][0] : params['mes']
  redirect(mes ? `/crm/trilhas?mes=${mes}` : '/crm/trilhas')
}
