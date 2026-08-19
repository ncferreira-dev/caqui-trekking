'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, InputSenha, Select } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'

/**
 * Criar acesso ao painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ROTA EXISTIA E NÃO TINHA BOTÃO
 * ────────────────────────────────────────────────────────────────────────────
 * `POST /api/admin/users` está pronta, correta e auditada desde o começo. A
 * tela de Configurações apenas LISTAVA quem tem acesso. Ou seja: o dia em que
 * a Caqui contratasse a segunda pessoa, a única saída seria escrever no banco
 * à mão.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A SENHA É DEFINIDA AQUI, E ISSO É UMA ESCOLHA, NÃO UM ATALHO
 * ────────────────────────────────────────────────────────────────────────────
 * O caminho "certo" de manual é convite por e-mail com link de definição de
 * senha. Ele exige envio de e-mail transacional, token com validade, uma rota
 * pública de troca e uma tela a mais. Nada disso existe neste projeto hoje.
 *
 * Fingir o fluxo bonito com uma senha provisória que ninguém é obrigado a
 * trocar seria pior: daria a impressão de que existe expiração quando não
 * existe. Então: o dono define a senha, o formulário diz em voz alta que ela
 * precisa ser combinada por fora, e o campo tem botão de revelar para a senha
 * poder ser conferida antes de ser passada adiante.
 *
 * O que NÃO acontece aqui: a senha não vai para o `toast`, não vai para a
 * auditoria (a rota grava só e-mail e papel) e não fica em nenhum estado
 * depois que o modal fecha.
 */
export function NovoUsuario() {
  const router = useRouter()
  const { mostrar } = useToast()
  const idBase = useId()

  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'OWNER'>('ADMIN')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setAberto(false)
    // A senha não sobrevive ao fechamento. Reabrir o formulário com a senha da
    // pessoa anterior ainda no campo é como deixar o papelzinho na mesa.
    setNome('')
    setEmail('')
    setSenha('')
    setRole('ADMIN')
    setErro(null)
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (senha.length < 12) {
      setErro('A senha precisa ter pelo menos 12 caracteres.')
      return
    }

    setEnviando(true)
    try {
      await api.post('/api/admin/users', {
        nome: nome.trim(),
        email: email.trim(),
        senha,
        role,
      })
      mostrar({
        tom: 'sucesso',
        titulo: 'Acesso criado',
        // Sem a senha na descrição: o toast fica na tela por segundos, em cima
        // de um painel que pode estar sendo projetado ou compartilhado.
        descricao: `${email.trim()} já pode entrar no painel.`,
      })
      router.refresh()
      fechar()
    } catch (causa) {
      setErro(causa instanceof ErroDaApi ? causa.message : 'Não foi possível criar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button tamanho="sm" onClick={() => setAberto(true)}>
        + Novo acesso
      </Button>

      {aberto && (
        <Modal
          aberto
          aoFechar={fechar}
          titulo="Novo acesso ao painel"
          rodape={
            <>
              <Button variante="ghost" onClick={fechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" form={idBase} carregando={enviando}>
                Criar acesso
              </Button>
            </>
          }
        >
          <form id={idBase} onSubmit={enviar} noValidate className="flex flex-col gap-5">
            <Input
              rotulo="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="off"
              obrigatorio
            />

            <Input
              rotulo="E-mail"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              dica="É com ele que a pessoa entra."
              obrigatorio
            />

            <InputSenha
              rotulo="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              // `new-password` impede o gerenciador de oferecer a senha DO DONO
              // num campo que vai criar a credencial de outra pessoa.
              autoComplete="new-password"
              dica="Mínimo de 12 caracteres. Combine com a pessoa por fora; o painel não envia e-mail."
              obrigatorio
            />

            <Select
              rotulo="Papel"
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'OWNER')}
              opcoes={[
                { valor: 'ADMIN', rotulo: 'Equipe' },
                { valor: 'OWNER', rotulo: 'Dono' },
              ]}
              dica="Equipe faz tudo, menos criar e gerenciar acessos."
            />

            {role === 'OWNER' && (
              <p className="border-caqui-orange-500 bg-caqui-sand-100 text-corpo-sm border-l-4 px-3 py-2">
                <strong>Dono cria e remove outros acessos, inclusive o seu.</strong> Só marque isto
                para alguém que responde pela empresa.
              </p>
            )}

            {erro && (
              <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
                {erro}
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  )
}
