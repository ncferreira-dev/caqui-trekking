'use client'

import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialogo'

/**
 * Confirmação de ação destrutiva.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A PERGUNTA DIZ A CONSEQUÊNCIA, NÃO "TEM CERTEZA?"
 * ────────────────────────────────────────────────────────────────────────────
 * "Tem certeza?" não informa nada. Quem clicou já tinha certeza — foi por isso
 * que clicou. O diálogo só vale se disser o que vai acontecer com o mundo:
 * "a saída some da agenda pública e ninguém mais consegue reservar; quem já
 * comprou precisa ser avisado no WhatsApp".
 *
 * Depois de ler isso a pessoa às vezes desiste. É esse o objetivo — e é por
 * isso que o texto da consequência é obrigatório neste componente, não
 * opcional.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SEM DUPLO ENVIO, E O ERRO FICA NO DIÁLOGO
 * ────────────────────────────────────────────────────────────────────────────
 * O botão desabilita no primeiro clique. Se a chamada falhar, a mensagem
 * aparece AQUI e o diálogo continua aberto: fechar e mostrar um aviso no canto
 * faria a pessoa perder o contexto do que tentou fazer, e o padrão de reação é
 * clicar de novo no mesmo botão — que agora está atrás do diálogo fechado.
 */
export function Confirmar({
  aberto,
  aoFechar,
  titulo,
  consequencia,
  rotuloConfirmar,
  aoConfirmar,
  children,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  /** O que muda no mundo. Obrigatório de propósito. */
  consequencia: ReactNode
  rotuloConfirmar: string
  /** Deve lançar em caso de falha — a mensagem do erro vai para a tela. */
  aoConfirmar: () => Promise<void>
  children?: ReactNode
}) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    if (enviando) return
    setEnviando(true)
    setErro(null)

    try {
      await aoConfirmar()
      aoFechar()
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível concluir.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        <>
          <Button variante="secondary" onClick={aoFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button variante="danger" onClick={confirmar} carregando={enviando}>
            {rotuloConfirmar}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">{consequencia}</div>
        {children}
        {erro && (
          <p role="alert" className="text-caqui-danger text-corpo-sm">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
