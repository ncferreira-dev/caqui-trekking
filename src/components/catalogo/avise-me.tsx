'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { diaEMes } from '@/lib/datetime'

/**
 * "Avise-me" — a captura de lead da saída esgotada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESGOTADO É O MOMENTO DE MAIOR INTENÇÃO DA PÁGINA INTEIRA
 * ────────────────────────────────────────────────────────────────────────────
 * Quem chegou até aqui escolheu o roteiro, escolheu a data e clicou. O botão
 * cinza escrito "Esgotado", sem mais nada, joga fora a pessoa mais qualificada
 * que a página vai receber naquele dia — e desistência tem custo zero de
 * memória: ela não volta.
 *
 * Vaga cancela. Grupo pede segunda turma. O contato capturado aqui é o que
 * transforma as duas coisas em venda.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A CAIXA DE CONSENTIMENTO NASCE DESMARCADA, E O BOTÃO NÃO ENVIA SEM ELA
 * ────────────────────────────────────────────────────────────────────────────
 * "Assinou porque não desmarcou" não é consentimento sob a LGPD. O schema de
 * `POST /api/leads` exige `consentimento: true` e o serviço grava o `consentAt`
 * — QUANDO, não só que sim. Aqui a interface diz a mesma coisa: sem a marca, o
 * envio não acontece, e a frase explica para que serve o dado.
 *
 * O texto do consentimento é específico: "avisar sobre ESTA data". Um
 * "concordo em receber comunicações" genérico seria consentimento para
 * qualquer coisa, que é o mesmo que consentimento para nada.
 */

type Estado = 'formulario' | 'enviando' | 'pronto'

export function AviseMe({
  departureId,
  inicioUtc,
  tituloDoRoteiro,
  aberto,
  aoFechar,
}: {
  departureId: number
  inicioUtc: string
  tituloDoRoteiro: string
  aberto: boolean
  aoFechar: () => void
}) {
  const [estado, setEstado] = useState<Estado>('formulario')
  const [erro, setErro] = useState<string | null>(null)
  const [consentimento, setConsentimento] = useState(false)

  const data = diaEMes(new Date(inicioUtc))

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)

    const email = String(dados.get('email') ?? '').trim()
    const telefone = String(dados.get('telefone') ?? '').trim()

    if (!email && !telefone) {
      setErro('Informe um e-mail ou um WhatsApp para podermos avisar.')
      return
    }

    setErro(null)
    setEstado('enviando')

    try {
      const resposta = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(dados.get('nome') ? { nome: String(dados.get('nome')).trim() } : {}),
          ...(email ? { email } : {}),
          ...(telefone ? { telefone } : {}),
          // `origem` tem teto de 60 caracteres no schema. O id da saída cabe
          // sempre; o slug do roteiro, não — ele vai até 120.
          origem: `avise-me:${departureId}`,
          consentimento: true,
        }),
      })

      if (!resposta.ok) {
        // A mensagem do servidor NÃO é repassada: ela pode conter detalhe de
        // validação que não ajuda ninguém aqui. Uma frase só, com saída.
        setErro('Não foi possível registrar agora. Tente de novo ou chame no WhatsApp.')
        setEstado('formulario')
        return
      }

      setEstado('pronto')
    } catch {
      setErro('Sem conexão com o servidor. Tente de novo em instantes.')
      setEstado('formulario')
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={estado === 'pronto' ? 'Pronto' : 'Avise-me'}>
      {estado === 'pronto' ? (
        <div className="flex flex-col gap-4">
          <p className="text-corpo">
            Anotado. Se abrir vaga em <strong>{data}</strong>, a Caqui chama você antes de anunciar.
          </p>
          <p className="text-caqui-ink-500 text-corpo-sm">
            Enquanto isso, dá para ver outras datas do mesmo roteiro logo abaixo.
          </p>
          <Button onClick={aoFechar} bloco>
            Fechar
          </Button>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <p className="text-caqui-ink-700 text-corpo-sm">
            {tituloDoRoteiro} — {data}. Esta saída está esgotada. Deixe um contato e a Caqui avisa
            se abrir vaga.
          </p>

          <Input name="nome" rotulo="Nome" autoComplete="name" />
          <Input name="email" type="email" rotulo="E-mail" autoComplete="email" />
          <Input
            name="telefone"
            type="tel"
            rotulo="WhatsApp"
            autoComplete="tel"
            dica="Basta um dos dois."
          />

          <Checkbox
            name="consentimento"
            checked={consentimento}
            onChange={(e) => setConsentimento(e.currentTarget.checked)}
            rotulo="Pode me avisar sobre esta data"
            descricao="Usamos o contato só para isso. Nada de lista de e-mails."
          />

          {erro && (
            // `role="alert"` porque a mensagem aparece DEPOIS da ação: sem
            // isso, quem usa leitor de tela clica em enviar e não ouve nada.
            <p role="alert" className="text-caqui-danger text-corpo-sm">
              {erro}
            </p>
          )}

          <Button type="submit" bloco disabled={!consentimento} carregando={estado === 'enviando'}>
            Quero ser avisado
          </Button>
        </form>
      )}
    </Modal>
  )
}
