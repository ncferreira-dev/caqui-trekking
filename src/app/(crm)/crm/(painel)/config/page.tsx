import type { Metadata } from 'next'

import { EditorDeTemplate } from '@/components/crm/editor-de-template'
import { FormularioDeContato } from '@/components/crm/formulario-de-contato'
import { Aviso, CabecalhoDeSecao, Painel, Rotulo } from '@/components/crm/pecas'
import { dataCurta } from '@/lib/datetime'
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

  const [settings, usuarios] = await Promise.all([
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
  ])

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

        {usuario.role === 'OWNER' && (
          <Painel titulo="Quem tem acesso" acao={<Rotulo>só a dona vê isto</Rotulo>}>
            <ul className="divide-caqui-rule divide-y">
              {usuarios.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <span className="text-corpo-sm">{u.name}</span>
                  <span className="text-caqui-ink-700 text-micro font-mono">{u.email}</span>
                  <Rotulo>{u.role === 'OWNER' ? 'Dona' : 'Equipe'}</Rotulo>
                  {!u.active && (
                    <span className="text-caqui-danger text-micro font-mono uppercase">
                      Desativado
                    </span>
                  )}
                  <span className="ml-auto">
                    <Rotulo>
                      {u.lastLoginAt ? `entrou ${dataCurta(u.lastLoginAt)}` : 'nunca entrou'}
                    </Rotulo>
                  </span>
                </li>
              ))}
            </ul>
          </Painel>
        )}
      </div>
    </>
  )
}
