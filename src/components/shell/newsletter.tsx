'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/campo'

/**
 * Captura de lead do rodapé.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CONSENTIMENTO É UMA CAIXA QUE COMEÇA DESMARCADA
 * ────────────────────────────────────────────────────────────────────────────
 * `POST /api/leads` exige `consentimento: true` — o Zod recusa qualquer outra
 * coisa, e não existe caminho no servidor que crie um lead sem ele. Isto aqui
 * é a ponta visível dessa regra: não há caixa pré-marcada, e o botão não
 * envia sem ela.
 *
 * "Assinou porque não desmarcou" não é consentimento sob a LGPD, e uma lista
 * construída assim é um passivo que só aparece quando alguém reclama.
 */
export function Newsletter() {
  const [email, setEmail] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'ok' | 'erro'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setEstado('enviando')
    setErro(null)

    try {
      const resposta = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, origem: 'rodape', consentimento }),
      })

      if (!resposta.ok) {
        const corpo = (await resposta.json()) as { error?: { message?: string } }
        // A mensagem do servidor é em pt-BR e específica ("Informe ao menos um
        // e-mail ou telefone"). Repassá-la é melhor que um "erro" genérico —
        // era exatamente o que o projeto de referência fazia de errado.
        throw new Error(corpo.error?.message ?? 'Não foi possível cadastrar agora.')
      }

      setEstado('ok')
    } catch (falha) {
      setEstado('erro')
      setErro(falha instanceof Error ? falha.message : 'Não foi possível cadastrar agora.')
    }
  }

  if (estado === 'ok') {
    return (
      <p role="status" className="text-caqui-forest-300 text-corpo-sm">
        Pronto. Você recebe a agenda quando ela sair.
      </p>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      <Input
        rotulo="Receba a agenda do mês"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        {...(erro ? { erro } : {})}
        obrigatorio
        className="[&_label]:text-white"
      />

      <Checkbox
        rotulo="Autorizo receber a agenda por e-mail"
        checked={consentimento}
        onChange={(e) => setConsentimento(e.target.checked)}
        className="[&_label]:text-caqui-sand-100"
      />

      <Button
        type="submit"
        tamanho="sm"
        carregando={estado === 'enviando'}
        disabled={!consentimento || email.length === 0}
      >
        Quero receber
      </Button>
    </form>
  )
}
