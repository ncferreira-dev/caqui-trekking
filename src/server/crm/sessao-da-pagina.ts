import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { lerToken, NOME_COOKIE_SESSAO } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import type { Autenticado } from '@/lib/auth/guard'

/**
 * A sessão, do ponto de vista de uma PÁGINA do CRM.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ISTO NÃO É A SEGURANÇA. É A NAVEGAÇÃO.
 * ────────────────────────────────────────────────────────────────────────────
 * O que protege dado é `exigirPapel` dentro de cada rota de `/api/admin/*`,
 * com a tabela de `src/server/autorizacao.ts` provando que nenhuma nasce sem
 * guard. Esta função existe para a pessoa não ver um painel vazio quando a
 * sessão expira: ela manda para o login em vez de renderizar uma casca que
 * vai levar 401 em toda requisição.
 *
 * Vale repetir porque a confusão é fácil e cara: se ESTA função sumisse, o
 * painel apareceria e nenhum dado carregaria. Se o guard da API sumisse, o
 * dado sairia para qualquer um. São camadas de propósitos diferentes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PAPEL VEM DO BANCO, NÃO DO TOKEN
 * ────────────────────────────────────────────────────────────────────────────
 * Mesma regra de `exigirAutenticacao`, e pelo mesmo motivo: rebaixar alguém de
 * OWNER para ADMIN, ou desativar a conta, passa a valer na navegação seguinte
 * — sem esperar o token expirar e sem lista de revogação. Custa uma leitura
 * por página do painel.
 *
 * Duplicação com o guard? Não: `exigirAutenticacao` recebe `Request` e LANÇA
 * `AppError` com status, porque a resposta dele é JSON. Aqui a resposta certa
 * é um `redirect`, e a entrada é o cookie jar do `next/headers`. Mesma regra,
 * dois contratos.
 */
export async function sessaoDaPagina(): Promise<Autenticado | null> {
  const jar = await cookies()
  const token = jar.get(NOME_COOKIE_SESSAO)?.value
  if (!token) return null

  const sessao = await lerToken(token)
  if (!sessao) return null

  const usuario = await prisma.user.findUnique({
    where: { id: sessao.userId },
    select: { id: true, name: true, email: true, role: true, active: true, tokenVersion: true },
  })

  if (!usuario || !usuario.active) return null
  if (usuario.tokenVersion !== sessao.tokenVersion) return null

  return { userId: usuario.id, role: usuario.role, nome: usuario.name, email: usuario.email }
}

/**
 * Exige sessão ou manda para o login.
 *
 * `redirect()` lança por dentro, então nada depois dele executa — é por isso
 * que o tipo de retorno não é `| null`.
 */
export async function exigirSessaoDaPagina(): Promise<Autenticado> {
  const usuario = await sessaoDaPagina()
  if (!usuario) redirect('/crm')
  return usuario
}
