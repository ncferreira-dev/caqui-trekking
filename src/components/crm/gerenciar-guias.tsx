'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Confirmar } from '@/components/crm/confirmar'
import { BotoesDeOrdem } from '@/components/crm/ordem-e-destaque'
import { Rotulo, Vazio } from '@/components/crm/pecas'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { cn } from '@/lib/ui/cn'

/**
 * Os guias, no painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELES MORAM EM CONFIGURAÇÕES, E ISSO É DECISÃO
 * ────────────────────────────────────────────────────────────────────────────
 * A barra do painel tem seis itens e esse é o teto declarado
 * (`navegacao.tsx`): o sétimo ou espreme tudo abaixo dos 44px, ou vira um
 * "mais…" que é o hambúrguer com outro nome.
 *
 * Guia não é operação diária — é conteúdo institucional, mexido quando alguém
 * entra ou sai da equipe. E é exatamente o vizinho certo do Cadastur e da
 * credencial do PESM da empresa, que já vivem nesta tela: são os mesmos
 * números, na escala da pessoa em vez da escala da empresa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DESATIVAR ≠ ARQUIVAR, E OS DOIS BOTÕES DIZEM ISSO
 * ────────────────────────────────────────────────────────────────────────────
 * "No site" é um interruptor: some agora, volta em um clique. É para licença,
 * período fora, guia ainda sem foto.
 *
 * "Arquivar" é a saída definitiva, só do OWNER, e o texto da confirmação diz o
 * que ela NÃO faz: as saídas já realizadas continuam mostrando quem guiou,
 * porque é essa a prova de que a trilha teve guia credenciado.
 */

export type GuiaDoPainel = {
  id: number
  nome: string
  bio: string | null
  cadastur: string | null
  pesm: string | null
  ativo: boolean
  saidas: number
}

export function GerenciarGuias({
  guias,
  podeArquivar,
}: {
  guias: GuiaDoPainel[]
  /** OWNER. A barreira real é a rota; aqui é só não oferecer o que dá 403. */
  podeArquivar: boolean
}) {
  const router = useRouter()
  const { mostrar } = useToast()

  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<GuiaDoPainel | null>(null)
  const [arquivando, setArquivando] = useState<GuiaDoPainel | null>(null)
  const [ocupado, setOcupado] = useState<Record<number, boolean>>({})

  // A ordem que o site usa na página "Quem guia". A lista chega já ordenada
  // por `sortOrder`, então ela É o manifesto que as setas devolvem.
  const ordemAtual = guias.map((g) => g.id)

  async function alternarAtivo(guia: GuiaDoPainel) {
    if (ocupado[guia.id]) return
    setOcupado((atual) => ({ ...atual, [guia.id]: true }))
    try {
      await api.patch(`/api/admin/guides/${guia.id}`, { ativo: !guia.ativo })
      router.refresh()
    } catch (causa) {
      mostrar({
        tom: 'erro',
        titulo: 'Não mudou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'O guia continua como estava.',
      })
    } finally {
      setOcupado((atual) => ({ ...atual, [guia.id]: false }))
    }
  }

  return (
    <>
      <div className="flex items-center justify-end px-4 py-2">
        <Button tamanho="sm" onClick={() => setCriando(true)}>
          + Novo guia
        </Button>
      </div>

      {guias.length === 0 ? (
        <Vazio titulo="Nenhum guia cadastrado">
          <p>
            O site mostra os guias com Cadastur e credencial do PESM. É a prova de que a operação é
            regular, e hoje a página “Quem guia” está vazia.
          </p>
        </Vazio>
      ) : (
        <ul className="divide-caqui-rule divide-y">
          {guias.map((guia) => (
            <li key={guia.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className={cn('text-corpo-sm', !guia.ativo && 'text-caqui-ink-500')}>
                {guia.nome}
              </span>

              {guia.cadastur && (
                <span className="text-caqui-ink-700 text-micro font-mono">{guia.cadastur}</span>
              )}
              {!guia.cadastur && (
                <span className="text-caqui-danger text-micro font-mono uppercase">
                  sem Cadastur
                </span>
              )}

              <span className="ml-auto flex flex-wrap items-center gap-3">
                <Rotulo>{guia.saidas} saída(s)</Rotulo>

                <BotoesDeOrdem colecao="guides" ids={ordemAtual} id={guia.id} rotulo={guia.nome} />

                {/* Interruptor com rótulo escrito: um switch mudo obriga a
                    adivinhar se a cor significa "está no site" ou "clique para
                    pôr no site". */}
                <button
                  type="button"
                  onClick={() => alternarAtivo(guia)}
                  disabled={ocupado[guia.id]}
                  aria-pressed={guia.ativo}
                  className={cn(
                    'text-micro min-h-11 border px-3 font-mono uppercase transition-colors',
                    guia.ativo
                      ? 'border-caqui-forest-600 bg-caqui-forest-300 text-caqui-ink-900'
                      : 'border-caqui-rule-forte text-caqui-ink-500 bg-white',
                  )}
                >
                  {guia.ativo ? 'No site' : 'Fora do site'}
                </button>

                <button
                  type="button"
                  onClick={() => setEditando(guia)}
                  className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro min-h-11 rounded-xs font-mono uppercase underline underline-offset-4"
                >
                  Editar
                </button>

                {podeArquivar && (
                  <button
                    type="button"
                    onClick={() => setArquivando(guia)}
                    className="text-caqui-ink-500 hover:text-caqui-danger text-micro min-h-11 rounded-xs font-mono uppercase underline underline-offset-4"
                  >
                    Arquivar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {criando && (
        <FormularioDeGuia
          aoFechar={() => setCriando(false)}
          aoSalvar={async (dados) => {
            await api.post('/api/admin/guides', dados)
            mostrar({ tom: 'sucesso', titulo: 'Guia cadastrado' })
            router.refresh()
          }}
        />
      )}

      {editando && (
        <FormularioDeGuia
          guia={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (dados) => {
            await api.patch(`/api/admin/guides/${editando.id}`, dados)
            mostrar({ tom: 'sucesso', titulo: 'Guia salvo' })
            router.refresh()
          }}
        />
      )}

      {arquivando && (
        <Confirmar
          aberto
          aoFechar={() => setArquivando(null)}
          titulo={`Arquivar ${arquivando.nome}?`}
          rotuloConfirmar="Arquivar"
          consequencia="Ele sai do site e some desta lista."
          aoConfirmar={async () => {
            await api.delete(`/api/admin/guides/${arquivando.id}`)
            mostrar({ tom: 'sucesso', titulo: 'Guia arquivado' })
            router.refresh()
          }}
        >
          <p>
            As {arquivando.saidas} saída(s) que ele guiou continuam registradas com o nome dele: é a
            prova de que a trilha teve guia credenciado, e ela não se reescreve.
          </p>
          <p className="mt-2">
            Se for coisa temporária, use <strong>“No site”</strong> em vez disto. Aquilo volta em um
            clique.
          </p>
        </Confirmar>
      )}
    </>
  )
}

type CamposDoGuia = {
  nome: string
  bio: string | null
  cadastur: string | null
  pesm: string | null
}

function FormularioDeGuia({
  guia,
  aoFechar,
  aoSalvar,
}: {
  guia?: GuiaDoPainel
  aoFechar: () => void
  aoSalvar: (dados: CamposDoGuia) => Promise<void>
}) {
  const [nome, setNome] = useState(guia?.nome ?? '')
  const [cadastur, setCadastur] = useState(guia?.cadastur ?? '')
  const [pesm, setPesm] = useState(guia?.pesm ?? '')
  const [bio, setBio] = useState(guia?.bio ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (nome.trim().length < 2) {
      setErro('O nome é obrigatório.')
      return
    }

    setEnviando(true)
    try {
      await aoSalvar({
        nome: nome.trim(),
        cadastur: cadastur.trim() || null,
        pesm: pesm.trim() || null,
        bio: bio.trim() || null,
      })
      aoFechar()
    } catch (causa) {
      setErro(causa instanceof ErroDaApi ? causa.message : 'Não foi possível salvar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={guia ? 'Editar guia' : 'Novo guia'}
      rodape={
        <>
          <Button variante="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form="formulario-de-guia" carregando={enviando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="formulario-de-guia" onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <Input rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} obrigatorio />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            rotulo="Cadastur"
            value={cadastur}
            onChange={(e) => setCadastur(e.target.value)}
            placeholder="00.000000.00-0"
            dica="Aparece no site, ao lado do nome."
          />
          <Input
            rotulo="Credencial do PESM"
            value={pesm}
            onChange={(e) => setPesm(e.target.value)}
            dica="Para quem é monitor credenciado pelo parque."
          />
        </div>

        <Textarea
          rotulo="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          dica="Duas ou três linhas. Aparece na página “Quem guia”."
        />

        {erro && (
          <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
