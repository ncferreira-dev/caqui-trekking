/**
 * A TABELA DE AUTORIZAÇÃO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ELA EXISTE, E POR QUE A VARREDURA SOZINHA NÃO BASTAVA
 * ────────────────────────────────────────────────────────────────────────────
 * O projeto já tinha uma varredura que abre `src/app/api/admin` no disco e
 * exige 401 de toda rota sem sessão. Ela pega o defeito mais grave — rota nova
 * nascendo pública — e não pega o segundo mais grave: rota nova nascendo com o
 * PAPEL ERRADO.
 *
 * Uma rota de gestão de usuários que aceita ADMIN passa naquela varredura com
 * folga: ela recusa quem não tem sessão, exatamente como manda. Só que ADMIN
 * não deveria poder criar OWNER. O buraco fica aberto e verde.
 *
 * Esta tabela fecha isso. Ela é a resposta escrita para "quem pode chamar
 * isto?", e o teste em `src/test/autorizacao.test.ts` a confronta com o disco.
 * Três coisas passam a quebrar, e as três importam:
 *
 *   1. Rota nova sem entrada aqui — ninguém acrescenta endpoint administrativo
 *      sem decidir, por escrito, quem acessa.
 *   2. Entrada aqui para rota que não existe mais — senão a tabela vira
 *      documentação envelhecida, que é pior que documentação nenhuma, porque
 *      alguém acredita nela.
 *   3. Comportamento divergindo da tabela — o guard foi removido, afrouxado ou
 *      trocado de papel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELA NÃO É A SEGURANÇA. ELA É A PROVA DE QUE A SEGURANÇA ESTÁ LÁ.
 * ────────────────────────────────────────────────────────────────────────────
 * Quem barra de verdade é o `exigirPapel` dentro de cada handler. Esta tabela
 * não é lida em runtime de propósito: se ela fosse o mecanismo, um erro de
 * digitação numa chave abriria uma rota em silêncio. Sendo só a expectativa do
 * teste, um erro de digitação aqui QUEBRA o teste — falha para o lado seguro.
 *
 * A UI do CRM também consulta os papéis, mas para ESCONDER botão. Esconder
 * botão é cortesia, não barreira: o `fetch` continua chamável do console.
 */

export type Papel = 'OWNER' | 'ADMIN'
export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Chave: caminho relativo a `/api/admin`, sem barra inicial. `''` é a raiz. */
export type ChaveDeRota = string

export type RegraDeRota = Partial<Record<Metodo, readonly Papel[]>>

const TODOS: readonly Papel[] = ['OWNER', 'ADMIN']
const SO_OWNER: readonly Papel[] = ['OWNER']

/**
 * O mapa completo de `/api/admin/*`.
 *
 * A regra de fundo, do PROMPT 04: **OWNER faz tudo. ADMIN faz tudo menos
 * gerenciar usuários e destruir conteúdo.** Operação de rotina é de ADMIN —
 * é ela que roda todo dia, do celular, no meio da trilha.
 */
export const AUTORIZACAO: Record<ChaveDeRota, RegraDeRota> = {
  // ── Painel ────────────────────────────────────────────────────────────────
  dashboard: { GET: TODOS },

  // ── Saídas: a operação diária ─────────────────────────────────────────────
  departures: { GET: TODOS, POST: TODOS },
  // Editar data, preço e ponto de encontro. Rotina de ADMIN; a disponibilidade
  // tem rota própria abaixo porque é o toque de todo dia.
  // DELETE aqui é EXCLUIR de vez (hard delete), e só de saída passada ou
  // cancelada — a regra fica no serviço. Destrutivo, então SO_OWNER.
  'departures/[id]': { PATCH: TODOS, DELETE: SO_OWNER },
  // O LIVRO DE VAGAS. Passou a ser o toque de todo dia desde 18/08/2026:
  // quem fecha a venda no WhatsApp lança aqui, e o selo do site sai da conta.
  // ADMIN precisa, senão o CRM não serve para quem opera.
  'departures/[id]/vagas': { PATCH: TODOS },
  // A EXCEÇÃO: forçar o selo contra a conta (chuva, parque interditado) ou
  // desfazer a exceção. Rara, e por isso pede motivo. Continua sendo ADMIN:
  // quem decide não subir é quem está no ponto de encontro às cinco da manhã.
  'departures/[id]/availability': { PATCH: TODOS },
  // O FECHAMENTO: quantos foram, quanto entrou, quanto custou. ADMIN, porque
  // quem guiou é quem sabe quantos foram.
  'departures/[id]/fechar': { POST: TODOS },
  'departures/[id]/duplicate': { POST: TODOS },
  // Cancelar avisa gente que já comprou. Continua sendo rotina, mas a
  // interface exige confirmação escrita — ver components/crm/confirmar.tsx.
  'departures/[id]/cancel': { POST: TODOS },

  // ── Conteúdo ──────────────────────────────────────────────────────────────
  // POST entrou em 18/08/2026. Até então o CRM não tinha como criar roteiro:
  // os cinco existentes vieram do seed, e `Trip` é a entidade que todo o resto
  // do sistema pendura. ADMIN pode, porque escrever roteiro é trabalho de quem
  // opera; PUBLICAR também é ADMIN (`PATCH`), e destruir continua só do OWNER.
  trips: { GET: TODOS, POST: TODOS },
  // A ordem da vitrine. Entrou em 18/08/2026: o site sempre ordenou por
  // `featured` e `sortOrder`, e nenhuma tela escrevia nenhum dos dois.
  // Reordenar é rotina de conteúdo, como publicar.
  'trips/reorder': { PATCH: TODOS },
  // DELETE aqui é ARQUIVAR (soft delete). Só OWNER: tirar um roteiro do ar
  // apaga a vitrine de um produto inteiro.
  'trips/[id]': { PATCH: TODOS, DELETE: SO_OWNER },
  products: { GET: TODOS, POST: TODOS },
  'products/reorder': { PATCH: TODOS },
  // Editar peça e reconciliar variantes. Cadastro de conteúdo é rotina de ADMIN.
  // DELETE é ARQUIVAR (soft delete) e é só do OWNER, pela mesma régua de
  // `trips/[id]`: tirar da loja o que o site publica é decisão de quem responde
  // pela empresa. Entrou em 18/08/2026 — até então `Product.deletedAt` existia,
  // era respeitado em toda leitura, e nenhum caminho do sistema o escrevia.
  'products/[id]': { PATCH: TODOS, DELETE: SO_OWNER },
  'variants/[id]': { PATCH: TODOS },
  // ── Guias ─────────────────────────────────────────────────────────────────
  // Entrou em 18/08/2026. `Guide` só tinha rota pública de leitura: nome,
  // Cadastur e credencial do PESM eram imutáveis pelo painel, e são justamente
  // os dados que o site publica como prova de que a operação é regular.
  //
  // Cadastrar e editar é rotina de ADMIN. ARQUIVAR é do OWNER, pela mesma
  // régua de `trips/[id]`: tirar do ar quem o site apresenta como equipe é
  // decisão de quem responde pela empresa.
  guides: { GET: TODOS, POST: TODOS },
  'guides/reorder': { PATCH: TODOS },
  'guides/[id]': { PATCH: TODOS, DELETE: SO_OWNER },

  tags: { GET: TODOS, POST: TODOS },
  // DELETE de tag é TODOS, e não SO_OWNER como esta linha chegou a dizer.
  // A tabela nasceu com o palpite errado e o teste pegou: a política escrita
  // em docs/04-permissoes.md é "ADMIN faz tudo, menos gerenciar usuários e
  // ARQUIVAR ROTEIRO". Apagar uma tag de atividade é gestão de conteúdo de
  // rotina — e o serviço já recusa remover tag em uso (409).
  'tags/[id]': { PATCH: TODOS, DELETE: TODOS },

  // ── Mídia ─────────────────────────────────────────────────────────────────
  media: { GET: TODOS, POST: TODOS },
  // PATCH cobre DOIS gestos com auditorias distintas: corrigir o texto
  // alternativo (`media.alt`) e ligar a foto a uma cor (`media.cor`). Os dois
  // são cadastro de conteúdo, rotina de ADMIN.
  'media/[id]': { PATCH: TODOS, DELETE: TODOS },
  'media/reorder': { PATCH: TODOS },

  // ── Caixa de entrada ──────────────────────────────────────────────────────
  messages: { GET: TODOS, PATCH: TODOS },
  leads: { GET: TODOS },

  // ── Configuração ──────────────────────────────────────────────────────────
  // Mexe no número do WhatsApp e no template da mensagem — o que sai no nome
  // da empresa. ADMIN edita; a auditoria registra quem.
  settings: { GET: TODOS, PUT: TODOS },
  // Criar usuário é criar acesso. Só OWNER, sem exceção.
  users: { GET: SO_OWNER, POST: SO_OWNER },
  // Desativar, rebaixar e resetar senha. Entrou em 18/08/2026: até então o CRM
  // sabia criar acesso e não sabia tirar, e `User.active` era um estado que
  // nenhum caminho do sistema alcançava. Mesma porta estreita do POST.
  'users/[id]': { PATCH: SO_OWNER },
}
