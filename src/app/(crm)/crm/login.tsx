'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, InputSenha } from '@/components/ui/campo'

/**
 * Login.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O FRONT NÃO GUARDA TOKEN NENHUM
 * ────────────────────────────────────────────────────────────────────────────
 * A resposta desta rota não traz token — há teste no backend garantindo isso.
 * A sessão volta como cookie `httpOnly`, que o JavaScript desta página não
 * consegue nem ler. Por isso o `fetch` leva `credentials: 'same-origin'` e
 * nada é salvo em lugar nenhum.
 *
 * O projeto de referência guardava o JWT em `localStorage` por 7 dias: um XSS
 * entregava uma credencial administrativa válida por uma semana, e o "logout"
 * era um `removeItem` que não dizia nada ao servidor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A MENSAGEM DE ERRO VEM DO SERVIDOR, E É DE PROPÓSITO QUE ELA SEJA VAGA
 * ────────────────────────────────────────────────────────────────────────────
 * E-mail inexistente e senha errada devolvem o MESMO código, a mesma frase e o
 * mesmo tempo de resposta. Aqui, o front só repassa. Melhorar a mensagem
 * ("este e-mail não existe") reabriria o oráculo que o backend fecha de
 * propósito.
 *
 * `ACCOUNT_LOCKED` é o único caso que ganha tratamento próprio, porque aí a
 * informação é útil e não revela nada: a conta existe e quem está tentando já
 * sabe disso.
 */
export function FormularioDeLogin() {
  const router = useRouter()
  const [estado, setEstado] = useState<'parado' | 'enviando'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setEstado('enviando')
    setErro(null)

    const dados = new FormData(evento.currentTarget)

    try {
      const resposta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: String(dados.get('email') ?? ''),
          senha: String(dados.get('senha') ?? ''),
        }),
      })

      if (resposta.ok) {
        // `refresh` para o servidor reavaliar a sessão com o cookie novo, e só
        // então navegar. Sem isso, a página de destino renderiza com o estado
        // anterior e "pisca" deslogada.
        router.refresh()
        // Para o PAINEL, não de volta para `/crm` — que é esta mesma tela.
        // Antes do PROMPT 10 não havia painel, e o `push('/crm')` só
        // recarregava o login já autenticado.
        router.push('/crm/painel')
        return
      }

      const retorno = (await resposta.json()) as { error?: { code?: string; message?: string } }
      setErro(retorno.error?.message ?? 'Não foi possível entrar.')
      setEstado('parado')
    } catch {
      setErro('Sem conexão com o servidor.')
      setEstado('parado')
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Input
        rotulo="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        obrigatorio
      />
      <InputSenha rotulo="Senha" name="senha" autoComplete="current-password" obrigatorio />

      {erro && (
        <p role="alert" className="text-caqui-danger text-corpo-sm">
          {erro}
        </p>
      )}

      <Button type="submit" bloco tamanho="lg" carregando={estado === 'enviando'}>
        Entrar
      </Button>
    </form>
  )
}
