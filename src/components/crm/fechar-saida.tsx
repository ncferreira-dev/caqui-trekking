'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { dataCurta } from '@/lib/datetime'
import { centavosParaReais, formatarBRL, reaisParaCentavos } from '@/lib/money'

/**
 * O FECHAMENTO DA SAÍDA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUATRO CAMPOS, E O NÚMERO DE CAMPOS É A DECISÃO DE PRODUTO
 * ════════════════════════════════════════════════════════════════════════════
 * Quantas pessoas foram, quanto entrou, quanto custou, e uma observação. Se
 * levar mais que isso, não é preenchido — e um fechamento não preenchido
 * derruba o relatório inteiro, porque a média de um mês com metade das saídas
 * fechadas não é a média de nada.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RECEITA É LANÇADA, NUNCA CALCULADA
 * ════════════════════════════════════════════════════════════════════════════
 * O campo abre com a SUGESTÃO de `preço × pessoas`, e a sugestão é um ponto de
 * partida, não a resposta. Essa conta está errada em quase toda saída real:
 * desconto de grupo, cortesia de aniversário, meia de criança, guia convidado,
 * gente que pagou metade e vai acertar depois.
 *
 * Se o número fosse calculado, o relatório de lucro ficaria bonito e falso — e
 * é o tipo de relatório que alguém usa para decidir preço.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEIXAR EM BRANCO É UMA RESPOSTA
 * ════════════════════════════════════════════════════════════════════════════
 * Custo em branco significa "ainda não sei quanto custou", e é diferente de
 * zero. `lucroCentavos` devolve `null` quando falta um dos lados, em vez de
 * tratar ausência como zero: senão a saída sem custo lançado apareceria como a
 * mais lucrativa do mês, e a lista ordenada por lucro colocaria o dado que
 * falta no topo.
 */
export type SaidaParaFechar = {
  id: number
  inicioIso: string
  precoCentavos: number
  vagasFechadas: number
  attendeeCount: number | null
  revenueCents: number | null
  costCents: number | null
  closingNotes: string | null
  jaFechada: boolean
  trip: { titulo: string }
}

export function FecharSaida({
  aberto,
  aoFechar,
  saida,
}: {
  aberto: boolean
  aoFechar: () => void
  saida: SaidaParaFechar
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const idBase = useId()

  // Abre com quem FECHOU vaga, que é o palpite mais próximo de quem foi. A
  // pessoa corrige para baixo quando alguém faltou, que é o caso comum.
  const [pessoas, setPessoas] = useState(String(saida.attendeeCount ?? saida.vagasFechadas))
  const [receita, setReceita] = useState(
    saida.revenueCents !== null ? centavosParaReais(saida.revenueCents) : '',
  )
  const [custo, setCusto] = useState(
    saida.costCents !== null ? centavosParaReais(saida.costCents) : '',
  )
  const [observacoes, setObservacoes] = useState(saida.closingNotes ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const quantasPessoas = Number(pessoas)
  const sugestao =
    Number.isInteger(quantasPessoas) && quantasPessoas > 0
      ? saida.precoCentavos * quantasPessoas
      : null

  const receitaCentavos = receita.trim() === '' ? null : reaisParaCentavos(receita)
  const custoCentavos = custo.trim() === '' ? null : reaisParaCentavos(custo)

  const lucro =
    receitaCentavos !== null && custoCentavos !== null ? receitaCentavos - custoCentavos : null

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (enviando) return

    if (!Number.isInteger(quantasPessoas) || quantasPessoas < 0) {
      setErro('Informe quantas pessoas foram.')
      return
    }
    if (receita.trim() !== '' && receitaCentavos === null) {
      setErro('Receita inválida. Use o formato 1.234,56.')
      return
    }
    if (custo.trim() !== '' && custoCentavos === null) {
      setErro('Custo inválido. Use o formato 1.234,56.')
      return
    }

    setEnviando(true)
    setErro(null)

    try {
      await api.post(`/api/admin/departures/${saida.id}/fechar`, {
        pessoas: quantasPessoas,
        receitaCentavos,
        custoCentavos,
        observacoes: observacoes.trim() === '' ? null : observacoes.trim(),
      })

      mostrar({
        tom: 'sucesso',
        titulo: saida.jaFechada ? 'Fechamento atualizado' : 'Saída fechada',
        descricao: `${saida.trip.titulo} · ${dataCurta(new Date(saida.inicioIso))}`,
      })
      router.refresh()
      aoFechar()
    } catch (causa) {
      setErro(causa instanceof ErroDaApi ? causa.message : 'Não foi possível fechar agora.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={saida.jaFechada ? 'Revisar o fechamento' : 'Fechar a saída'}
      rodape={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variante="secondary" onClick={aoFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button type="submit" form={`${idBase}-form`} carregando={enviando}>
            {saida.jaFechada ? 'Salvar' : 'Fechar a saída'}
          </Button>
        </div>
      }
    >
      <form id={`${idBase}-form`} onSubmit={enviar} className="flex flex-col gap-5" noValidate>
        <p className="text-caqui-ink-700 text-corpo-sm">
          <strong>{saida.trip.titulo}</strong> · {dataCurta(new Date(saida.inicioIso))}
        </p>

        <Input
          rotulo="Quantas pessoas foram"
          type="text"
          inputMode="numeric"
          value={pessoas}
          onChange={(e) => setPessoas(e.target.value.replace(/\D/g, ''))}
          dica={`${saida.vagasFechadas} tinham fechado vaga. Gente falta, então o número aqui pode ser menor.`}
          obrigatorio
        />

        <Input
          rotulo="Receita recebida"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={receita}
          onChange={(e) => setReceita(e.target.value)}
          dica={
            sugestao !== null
              ? `Preço x pessoas dá ${formatarBRL(sugestao)}. É só uma sugestão: desconto, cortesia e meia entram aqui.`
              : 'Deixe em branco se ainda não souber.'
          }
        />

        <Input
          rotulo="Custo da saída"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={custo}
          onChange={(e) => setCusto(e.target.value)}
          dica="Transporte, alimentação, ingresso do parque, cachê de guia externo. Em branco = ainda não sei."
        />

        {/* O lucro aparece EM TEMPO REAL, e é o que faz a pessoa conferir o
            número antes de salvar em vez de descobrir no relatório do mês. */}
        <div className="border-caqui-rule flex items-baseline justify-between border-t pt-4">
          <span className="text-caqui-ink-500 text-micro font-mono uppercase">Resultado</span>
          {lucro === null ? (
            <span className="text-caqui-ink-500 text-corpo-sm italic">
              falta lançar {receitaCentavos === null ? 'a receita' : 'o custo'}
            </span>
          ) : (
            <span className="numeral text-dado-lg">{formatarBRL(lucro)}</span>
          )}
        </div>

        <Textarea
          rotulo="Observações"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          dica="Choveu, faltou gente, o parque cobrou a mais. O que você vai querer lembrar."
        />

        {erro && (
          <p role="alert" className="text-caqui-danger text-corpo-sm">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
