import { redirect } from 'next/navigation'

/**
 * `/crm/roteiros` virou `/crm/trilhas` em 20/08/2026.
 *
 * Mesma razão do redirecionamento de `/crm/saidas`: o endereço antigo está em
 * links do painel e possivelmente em abas abertas. Ver o comentário de lá.
 */
export default function RedirecionaRoteiros(): never {
  redirect('/crm/trilhas')
}
