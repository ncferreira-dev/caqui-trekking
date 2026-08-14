'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Fronteira de erro.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE APARECE NA TELA E O QUE VAI PARA O LOG SÃO COISAS DIFERENTES
 * ────────────────────────────────────────────────────────────────────────────
 * A pessoa vê uma frase em português e um botão. O `digest` — o identificador
 * que o Next gera para casar esta tela com a linha do log do servidor —
 * aparece pequeno, porque é o que ela pode informar ao pedir ajuda.
 *
 * O que NÃO aparece é a mensagem do erro. No projeto de referência, o catch
 * genérico concatenava `error.message` na resposta, então um 500 entregava
 * nome de model, nome de campo e nome de índice do banco a qualquer visitante.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * "TENTAR DE NOVO" É `reset()`, NÃO `location.reload()`
 * ────────────────────────────────────────────────────────────────────────────
 * `reset()` remonta só o segmento que quebrou. Recarregar a página inteira
 * descartaria estado de rolagem e refaria todas as requisições da rota — mais
 * lento, e frustrante quando a falha foi um pico de rede.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // O log do navegador é o que sobra para diagnosticar falha só do cliente.
    console.error('[app] erro não tratado:', error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-caqui-ink-500 text-rotulo font-mono uppercase">Algo quebrou</p>
      <h1 className="text-display-l mt-3 uppercase">Não foi possível carregar</h1>

      <p className="text-caqui-ink-700 text-corpo-lg mt-5 max-w-md">
        O erro foi registrado do nosso lado. Tente de novo. Se persistir, chame no WhatsApp e
        informe o código abaixo.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Button onClick={reset} tamanho="lg">
          Tentar de novo
        </Button>
      </div>

      {error.digest && (
        <p className="text-caqui-ink-500 text-micro mt-8 font-mono uppercase">
          Código: {error.digest}
        </p>
      )}
    </main>
  )
}
