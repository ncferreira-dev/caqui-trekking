'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { NovoUsuario } from '@/components/crm/novo-usuario'
import { Rotulo } from '@/components/crm/pecas'
import { Button } from '@/components/ui/button'
import { Input, InputSenha, Select } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { dataCurta } from '@/lib/datetime'
import { cn } from '@/lib/ui/cn'

/**
 * Quem tem acesso ao painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A LISTA ERA SÓ LEITURA, E ESSE ERA O BURACO
 * ────────────────────────────────────────────────────────────────────────────
 * Este painel já mostrava nome, e-mail, papel e "Desativado" como estado
 * possível. Nenhum caminho do sistema escrevia esse estado: dava para criar
 * acesso e não dava para tirar. Quem saísse da equipe continuava entrando até
 * alguém abrir o banco.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A PRÓPRIA LINHA NÃO OFERECE O QUE A API RECUSA
 * ────────────────────────────────────────────────────────────────────────────
 * Desativar e rebaixar a si mesmo são barrados no servidor. Aqui esses botões
 * simplesmente não aparecem na sua linha, marcada com "você". Mostrar um botão
 * que sempre termina em erro é a mesma hostilidade de um filtro que só devolve
 * vazio.
 *
 * O que CONTINUA aparecendo na sua linha é "Trocar senha": essa é sua e é o
 * caminho normal de rotina.
 */

export type AcessoDoPainel = {
  id: number
  nome: string
  email: string
  role: 'OWNER' | 'ADMIN'
  ativo: boolean
  ultimoLoginIso: string | null
}

export function GerenciarAcessos({
  acessos,
  meuId,
}: {
  acessos: AcessoDoPainel[]
  /** Para não oferecer na própria linha o que o servidor recusa. */
  meuId: number
}) {
  const router = useRouter()
  const { mostrar } = useToast()

  const [editando, setEditando] = useState<AcessoDoPainel | null>(null)
  const [trocandoSenha, setTrocandoSenha] = useState<AcessoDoPainel | null>(null)
  const [ocupado, setOcupado] = useState<Record<number, boolean>>({})

  async function alternarAtivo(acesso: AcessoDoPainel) {
    if (ocupado[acesso.id]) return
    setOcupado((atual) => ({ ...atual, [acesso.id]: true }))
    try {
      await api.patch(`/api/admin/users/${acesso.id}`, { ativo: !acesso.ativo })
      mostrar({
        tom: 'sucesso',
        titulo: acesso.ativo ? 'Acesso revogado' : 'Acesso devolvido',
        descricao: acesso.ativo
          ? `${acesso.nome} foi desconectado agora, em todos os aparelhos.`
          : `${acesso.nome} pode entrar de novo. As sessões antigas continuam mortas.`,
      })
      router.refresh()
    } catch (causa) {
      mostrar({
        tom: 'erro',
        titulo: 'Não mudou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'O acesso continua como estava.',
      })
    } finally {
      setOcupado((atual) => ({ ...atual, [acesso.id]: false }))
    }
  }

  return (
    <>
      <div className="flex items-center justify-end px-4 py-2">
        <NovoUsuario />
      </div>

      <ul className="divide-caqui-rule divide-y">
        {acessos.map((acesso) => {
          const souEu = acesso.id === meuId

          return (
            <li key={acesso.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className={cn('text-corpo-sm', !acesso.ativo && 'text-caqui-ink-500')}>
                {acesso.nome}
              </span>
              <span className="text-caqui-ink-700 text-micro font-mono">{acesso.email}</span>
              <Rotulo>{acesso.role === 'OWNER' ? 'Dono' : 'Equipe'}</Rotulo>
              {souEu && (
                <span className="border-caqui-ink-900 text-micro border px-1.5 font-mono uppercase">
                  você
                </span>
              )}

              <span className="ml-auto flex flex-wrap items-center gap-3">
                <Rotulo>
                  {acesso.ultimoLoginIso
                    ? `entrou ${dataCurta(new Date(acesso.ultimoLoginIso))}`
                    : 'nunca entrou'}
                </Rotulo>

                {souEu ? (
                  /* O estado, sem o botão: a API recusa desativar a si mesmo,
                     e um botão que sempre dá erro não é informação. */
                  <span
                    className={cn(
                      'text-micro border px-3 py-1.5 font-mono uppercase',
                      'border-caqui-forest-600 bg-caqui-forest-300 text-caqui-ink-900',
                    )}
                  >
                    Ativo
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => alternarAtivo(acesso)}
                    disabled={ocupado[acesso.id]}
                    aria-pressed={acesso.ativo}
                    className={cn(
                      'text-micro min-h-11 border px-3 font-mono uppercase transition-colors',
                      acesso.ativo
                        ? 'border-caqui-forest-600 bg-caqui-forest-300 text-caqui-ink-900'
                        : 'border-caqui-danger text-caqui-danger bg-white',
                    )}
                  >
                    {acesso.ativo ? 'Ativo' : 'Revogado'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setTrocandoSenha(acesso)}
                  className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro min-h-11 rounded-xs font-mono uppercase underline underline-offset-4"
                >
                  Trocar senha
                </button>

                {!souEu && (
                  <button
                    type="button"
                    onClick={() => setEditando(acesso)}
                    className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro min-h-11 rounded-xs font-mono uppercase underline underline-offset-4"
                  >
                    Editar
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {editando && (
        <EditarAcesso
          acesso={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (dados) => {
            await api.patch(`/api/admin/users/${editando.id}`, dados)
            mostrar({ tom: 'sucesso', titulo: 'Acesso salvo' })
            router.refresh()
          }}
        />
      )}

      {trocandoSenha && (
        <TrocarSenha
          acesso={trocandoSenha}
          souEu={trocandoSenha.id === meuId}
          aoFechar={() => setTrocandoSenha(null)}
          aoSalvar={async (senha) => {
            const eraEu = trocandoSenha.id === meuId
            await api.patch(`/api/admin/users/${trocandoSenha.id}`, { senha })
            mostrar({
              tom: 'sucesso',
              titulo: 'Senha trocada',
              // A senha NÃO vai para o toast: ele fica segundos na tela, em
              // cima de um painel que pode estar sendo projetado.
              descricao: eraEu
                ? 'Entre de novo com a senha nova.'
                : 'Todas as sessões dessa pessoa foram encerradas.',
            })
            // Trocar a PRÓPRIA senha invalida o cookie desta aba também (o
            // `tokenVersion` subiu). Sem este empurrão, a pessoa ficaria numa
            // tela morta, tomando 401 no próximo clique sem entender por quê.
            if (eraEu) router.replace('/crm')
            else router.refresh()
          }}
        />
      )}
    </>
  )
}

function EditarAcesso({
  acesso,
  aoFechar,
  aoSalvar,
}: {
  acesso: AcessoDoPainel
  aoFechar: () => void
  aoSalvar: (dados: { nome: string; role: 'OWNER' | 'ADMIN' }) => Promise<void>
}) {
  const [nome, setNome] = useState(acesso.nome)
  const [role, setRole] = useState(acesso.role)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    if (nome.trim().length < 2) return setErro('O nome é obrigatório.')

    setEnviando(true)
    try {
      await aoSalvar({ nome: nome.trim(), role })
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
      titulo="Editar acesso"
      rodape={
        <>
          <Button variante="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form="editar-acesso" carregando={enviando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="editar-acesso" onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <p className="text-caqui-ink-700 text-corpo-sm">
          E-mail: <strong>{acesso.email}</strong>. O e-mail é a identidade de login e o alvo da
          auditoria, por isso ele não muda aqui. Quem trocou de e-mail ganha um acesso novo e este é
          revogado.
        </p>

        <Input rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} obrigatorio />

        <Select
          rotulo="Papel"
          value={role}
          onChange={(e) => setRole(e.target.value as 'OWNER' | 'ADMIN')}
          opcoes={[
            { valor: 'ADMIN', rotulo: 'Equipe' },
            { valor: 'OWNER', rotulo: 'Dono' },
          ]}
          dica="Equipe faz tudo, menos criar e gerenciar acessos."
        />

        {role === 'OWNER' && acesso.role !== 'OWNER' && (
          <p className="border-caqui-orange-500 bg-caqui-sand-100 text-corpo-sm border-l-4 px-3 py-2">
            <strong>Dono cria e revoga outros acessos, inclusive o seu.</strong>
          </p>
        )}

        {erro && (
          <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}

function TrocarSenha({
  acesso,
  souEu,
  aoFechar,
  aoSalvar,
}: {
  acesso: AcessoDoPainel
  souEu: boolean
  aoFechar: () => void
  aoSalvar: (senha: string) => Promise<void>
}) {
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    if (senha.length < 12) return setErro('A senha precisa ter pelo menos 12 caracteres.')

    setEnviando(true)
    try {
      await aoSalvar(senha)
      // Some do estado assim que sai daqui: reabrir o formulário com a senha
      // da pessoa anterior ainda no campo é o papelzinho deixado na mesa.
      setSenha('')
      aoFechar()
    } catch (causa) {
      setErro(causa instanceof ErroDaApi ? causa.message : 'Não foi possível trocar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={souEu ? 'Trocar a sua senha' : `Trocar a senha de ${acesso.nome}`}
      rodape={
        <>
          <Button variante="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form="trocar-senha" carregando={enviando}>
            Trocar senha
          </Button>
        </>
      }
    >
      <form id="trocar-senha" onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <InputSenha
          rotulo="Nova senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          dica="Mínimo de 12 caracteres."
          obrigatorio
        />

        <p className="border-caqui-rule-forte text-corpo-sm border-l-4 px-3 py-2">
          {souEu
            ? 'Trocar a própria senha encerra TODAS as suas sessões, inclusive esta. Você vai voltar para o login e entrar com a senha nova.'
            : `Todas as sessões de ${acesso.nome} são encerradas na hora. Combine a senha nova por fora: o painel não envia e-mail.`}
        </p>

        {erro && (
          <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
