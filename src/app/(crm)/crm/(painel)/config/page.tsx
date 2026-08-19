import type { Metadata } from 'next'

import { EditorDeTemplate } from '@/components/crm/editor-de-template'
import { FormularioDeContato } from '@/components/crm/formulario-de-contato'
import { GerenciarAcessos, type AcessoDoPainel } from '@/components/crm/gerenciar-acessos'
import { GerenciarGuias, type GuiaDoPainel } from '@/components/crm/gerenciar-guias'
import { TrilhaDeAuditoria, type LinhaDaTrilha } from '@/components/crm/trilha-de-auditoria'
import { Aviso, CabecalhoDeSecao, Painel, Rotulo } from '@/components/crm/pecas'
import { prisma } from '@/lib/prisma'
import { PLACEHOLDERS_VALIDOS } from '@/server/services/admin/content-admin-service'
import { exigirSessaoDaPagina } from '@/server/crm/sessao-da-pagina'

export const metadata: Metadata = {
  title: 'Configurações',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * Configurações.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE ESTÁ AQUI É O QUE APARECE NO SITE COM O NOME DA EMPRESA
 * ────────────────────────────────────────────────────────────────────────────
 * Número de WhatsApp, Cadastur, credencial do PESM, texto do herói e o
 * template da mensagem. No projeto de referência, trocar o número exigia
 * editar quatro arquivos e publicar — um deles com o número dentro de uma URL
 * percent-encoded escrita à mão, praticamente garantindo o esquecimento.
 *
 * Toda escrita passa por `PUT /api/admin/settings`, que grava auditoria com
 * quem mudou, quando e o valor anterior.
 *
 * A lista de usuários é só do OWNER — quem cria usuário cria acesso, e pode
 * criar outro OWNER e se tornar irremovível.
 */
export default async function PaginaConfig() {
  const usuario = await exigirSessaoDaPagina()

  const [settings, usuarios, linhasDeGuias, linhasDaTrilha] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { id: 1 } }),
    // Só busca se for OWNER: dado que a tela não vai mostrar não deve nem sair
    // do banco. Esconder na renderização deixaria o nome e o e-mail de toda a
    // equipe dentro do HTML entregue a um ADMIN.
    usuario.role === 'OWNER'
      ? prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            lastLoginAt: true,
          },
          orderBy: [{ role: 'asc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),

    // Guia é conteúdo institucional, visível para os dois papéis. Só ARQUIVAR
    // é do OWNER, e a rota é quem barra.
    prisma.guide.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        bio: true,
        cadasturNumber: true,
        pesmCredential: true,
        active: true,
        _count: { select: { departures: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // A TRILHA, FILTRADA PELO PAPEL
    // ────────────────────────────────────────────────────────────────────────
    // ADMIN vê tudo MENOS o que aconteceu com acesso: essas linhas carregam
    // e-mail e papel de outras pessoas, e gestão de acesso é a única coisa que
    // ADMIN não faz. Dado que a tela não vai mostrar não deve nem sair do banco
    // — a mesma regra que já vale para a lista de usuários acima.
    prisma.auditLog.findMany({
      where: usuario.role === 'OWNER' ? {} : { entityType: { not: 'User' } },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        before: true,
        after: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { id: 'desc' },
      // Trinta linhas é o que responde "o que mudou hoje/ontem" sem virar um
      // arquivo. A trilha completa continua no banco, que é onde ela precisa
      // estar; esta tela é a janela, não o arquivo.
      take: 30,
    }),
  ])

  const acessos: AcessoDoPainel[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.name,
    email: u.email,
    role: u.role,
    ativo: u.active,
    ultimoLoginIso: u.lastLoginAt?.toISOString() ?? null,
  }))

  const trilha: LinhaDaTrilha[] = linhasDaTrilha.map((l) => ({
    id: l.id,
    acao: l.action,
    entidade: l.entityType,
    entidadeId: l.entityId,
    quem: l.user?.name ?? null,
    quandoIso: l.createdAt.toISOString(),
    antes: l.before,
    depois: l.after,
  }))

  const guias: GuiaDoPainel[] = linhasDeGuias.map((g) => ({
    id: g.id,
    nome: g.name,
    bio: g.bio,
    cadastur: g.cadasturNumber,
    pesm: g.pesmCredential,
    ativo: g.active,
    saidas: g._count.departures,
  }))

  if (!settings) {
    return (
      <>
        <CabecalhoDeSecao titulo="Configurações" />
        <Aviso tom="erro" titulo="Configurações não encontradas">
          <p>
            A linha de configuração do site não existe no banco. Rode{' '}
            <code>npx prisma db seed</code> para criá-la. Sem ela o rodapé some e o botão de
            WhatsApp não aparece no site.
          </p>
        </Aviso>
      </>
    )
  }

  return (
    <>
      <CabecalhoDeSecao titulo="Configurações" descricao="O que o site mostra em nome da Caqui." />

      <div className="flex flex-col gap-4">
        <FormularioDeContato
          inicial={{
            whatsappNumber: settings.whatsappNumber,
            email: settings.email,
            instagramTrekking: settings.instagramTrekking,
            instagramWear: settings.instagramWear,
            linktree: settings.linktree,
            cadasturNumber: settings.cadasturNumber,
            pesmCredentials: settings.pesmCredentials,
            heroTitle: settings.heroTitle,
            heroSubtitle: settings.heroSubtitle,
            aboutText: settings.aboutText,
          }}
        />

        {/* ── O template, com prévia ao vivo ─────────────────────────────── */}
        <Painel
          titulo="Mensagem do WhatsApp"
          acao={<Rotulo>o que o cliente envia ao finalizar</Rotulo>}
        >
          <EditorDeTemplate
            templateInicial={settings.whatsappMessageTemplate}
            numero={settings.whatsappNumber}
            placeholders={PLACEHOLDERS_VALIDOS}
          />
        </Painel>

        {/* ── Os guias ─────────────────────────────────────────────────────
            Ficam aqui, e não numa seção própria da navegação: a barra do
            painel tem seis itens e esse é o teto. E o vizinho está certo, o
            Cadastur da empresa mora dois painéis acima. */}
        <Painel titulo="Quem guia" acao={<Rotulo>aparecem no site</Rotulo>}>
          <GerenciarGuias guias={guias} podeArquivar={usuario.role === 'OWNER'} />
        </Painel>

        {usuario.role === 'OWNER' && (
          <Painel titulo="Quem tem acesso" acao={<Rotulo>só o dono vê isto</Rotulo>}>
            <GerenciarAcessos acessos={acessos} meuId={usuario.userId} />
          </Painel>
        )}

        {/* ── O que mudou ──────────────────────────────────────────────────
            A trilha é gravada desde o primeiro dia, dentro da transação de
            cada mudança, e nunca teve tela. É a resposta para "quem mudou o
            preço dessa saída?". */}
        <Painel titulo="O que mudou" acao={<Rotulo>as 30 últimas mudanças</Rotulo>}>
          <TrilhaDeAuditoria linhas={trilha} />
        </Painel>
      </div>
    </>
  )
}
