'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/campo'

type Campo = 'nome' | 'email' | 'telefone' | 'mensagem'

/**
 * Formulário de contato.
 *
 * Fala com `POST /api/contact` — a rota real, com o mesmo Zod que valida
 * qualquer outro cliente. O que chega de volta em `details` é mapeado CAMPO A
 * CAMPO para o input correspondente.
 *
 * É o motivo de a API devolver TODOS os problemas de uma vez, e não só o
 * primeiro (ver `zodParaDetails` em `lib/api/route-handler.ts`): no projeto de
 * referência, `error.details[0].message` em 14 pontos fazia o formulário
 * corrigir um campo por vez, um envio por erro.
 */
export function FormularioDeContato() {
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'ok'>('parado')
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setEstado('enviando')
    setErros({})
    setErroGeral(null)

    const dados = new FormData(evento.currentTarget)
    const corpo = {
      nome: String(dados.get('nome') ?? ''),
      mensagem: String(dados.get('mensagem') ?? ''),
      ...(dados.get('email') ? { email: String(dados.get('email')) } : {}),
      ...(dados.get('telefone') ? { telefone: String(dados.get('telefone')) } : {}),
    }

    try {
      const resposta = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      })

      if (resposta.ok) {
        setEstado('ok')
        return
      }

      const retorno = (await resposta.json()) as {
        error?: { message?: string; details?: { field: string; message: string }[] }
      }

      const porCampo: Partial<Record<Campo, string>> = {}
      for (const detalhe of retorno.error?.details ?? []) {
        if (detalhe.field === 'nome' || detalhe.field === 'email')
          porCampo[detalhe.field] = detalhe.message
        if (detalhe.field === 'telefone' || detalhe.field === 'mensagem')
          porCampo[detalhe.field] = detalhe.message
      }

      setErros(porCampo)
      if (Object.keys(porCampo).length === 0) {
        setErroGeral(retorno.error?.message ?? 'Não foi possível enviar agora.')
      }
      setEstado('parado')
    } catch {
      setErroGeral('Sem conexão com o servidor. Tente de novo em instantes.')
      setEstado('parado')
    }
  }

  if (estado === 'ok') {
    return (
      <div role="status" className="border-caqui-forest-600 border-l-4 py-2 pl-5">
        <p className="font-display text-display-s uppercase">Mensagem enviada</p>
        <p className="text-caqui-ink-700 text-corpo mt-2">
          A Caqui responde pelo WhatsApp, normalmente no mesmo dia.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <Input
        rotulo="Nome"
        name="nome"
        obrigatorio
        autoComplete="name"
        {...(erros.nome ? { erro: erros.nome } : {})}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          rotulo="WhatsApp"
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dica="É por aqui que a gente responde."
          {...(erros.telefone ? { erro: erros.telefone } : {})}
        />
        <Input
          rotulo="E-mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          {...(erros.email ? { erro: erros.email } : {})}
        />
      </div>

      <Textarea
        rotulo="Mensagem"
        name="mensagem"
        obrigatorio
        rows={6}
        dica="Conte qual trilha te interessa, quantas pessoas e a data que você tem em mente."
        {...(erros.mensagem ? { erro: erros.mensagem } : {})}
      />

      {erroGeral && (
        <p role="alert" className="text-caqui-danger text-corpo-sm">
          {erroGeral}
        </p>
      )}

      <Button type="submit" tamanho="lg" carregando={estado === 'enviando'}>
        Enviar mensagem
      </Button>
    </form>
  )
}
