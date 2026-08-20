'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { reaisParaCentavos } from '@/lib/money'

/**
 * Criar trilha: o roteiro e a primeira data dele, num salvamento só.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE OS DOIS JUNTOS
 * ────────────────────────────────────────────────────────────────────────────
 * Pedido do cliente em 20/08/2026, e o argumento é do próprio site: quem
 * compra abre a página da trilha e escolhe a data ali mesmo. Ele nunca vê
 * "roteiros" num lugar e "saídas" em outro. A separação que existia no
 * cadastro era a separação do BANCO (`Trip` 1:N `Departure`) vazando para
 * quem opera.
 *
 * O ganho não é comodidade. Três dos cinco roteiros estavam publicados sem
 * nenhuma data futura, aparecendo no site como "sob consulta". Marcar a data
 * no mesmo gesto ataca isso na origem, em vez de alertar depois de acontecer.
 *
 * A data é OPCIONAL: "sob consulta" é estado legítimo, e às vezes o texto da
 * trilha é escrito antes de a data fechar com o guia. Exigir faria inventarem
 * uma data para conseguir salvar, e data inventada vira agenda errada.
 *
 * As datas SEGUINTES continuam no "+ Nova saída", da tela de Saídas: marcar
 * mais um domingo não deve reabrir um formulário de trilha inteiro.
 *
 * Os dois nascem na MESMA transação (`criarTrip` → `gravarSaida`). Se a data
 * falhar, o roteiro não fica salvo pela metade.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SÓ O ESSENCIAL AQUI. O RESTO É NO "EDITAR"
 * ────────────────────────────────────────────────────────────────────────────
 * O editor de roteiro tem vinte campos: quatro listas, política de
 * cancelamento, altitude, idade mínima, fotos. Pedir tudo isso na criação
 * transformaria "cadastrar a trilha nova" num formulário que ninguém termina
 * de pé, e o roteiro não existiria até alguém sentar com calma.
 *
 * Aqui entram os cinco campos sem os quais o roteiro não é nada: nome, o que
 * é, onde fica e quão pesado. Com isso ele já existe, já aparece na lista, e
 * já pode receber data. O trabalho editorial acontece depois, no "Editar", e
 * pode ser feito em três sessões.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NASCE EM RASCUNHO, E NÃO HÁ COMO PEDIR O CONTRÁRIO
 * ────────────────────────────────────────────────────────────────────────────
 * A regra é do SERVIDOR (`criarTrip` grava `status: 'DRAFT'` fixo), e não uma
 * caixa desmarcada nesta tela. Um roteiro recém-criado não tem foto, não tem
 * data e tem a descrição pela metade: publicar por padrão colocaria isso na
 * vitrine no instante do "salvar".
 */

const DIFICULDADES = [
  { valor: 'FACIL', rotulo: 'Fácil' },
  { valor: 'MODERADO', rotulo: 'Moderado' },
  { valor: 'DIFICIL', rotulo: 'Difícil' },
  { valor: 'EXTREMO', rotulo: 'Extremo' },
]

export function NovoRoteiro() {
  const router = useRouter()
  const { mostrar } = useToast()
  const idBase = useId()

  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('SP')
  const [dificuldade, setDificuldade] = useState('MODERADO')

  // ── A primeira data ───────────────────────────────────────────────────────
  const [quandoVaiSubir, setQuandoVaiSubir] = useState('')
  const [preco, setPreco] = useState('')
  const [pontoDeEncontro, setPontoDeEncontro] = useState('')
  const [horaDeEncontro, setHoraDeEncontro] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  /** Marcou a data? Basta o campo de data: os outros dependem dele. */
  const temData = quandoVaiSubir.trim() !== ''

  function fechar() {
    setAberto(false)
    setTitulo('')
    setDescricao('')
    setCidade('')
    setEstado('SP')
    setDificuldade('MODERADO')
    setQuandoVaiSubir('')
    setPreco('')
    setPontoDeEncontro('')
    setHoraDeEncontro('')
    setErro(null)
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (titulo.trim().length < 3) return setErro('O título é obrigatório.')
    if (descricao.trim().length < 10) return setErro('A descrição precisa de ao menos uma frase.')
    if (cidade.trim().length < 2) return setErro('Diga a cidade da trilha.')
    if (estado.trim().length !== 2) return setErro('O estado é a sigla de duas letras, ex.: SP.')

    // A data é opcional. Mas se ela foi preenchida, o preço passa a ser
    // obrigatório: saída sem preço não vira nada no site, e o servidor
    // recusaria com "Dados inválidos." sem dizer qual campo.
    const precoCentavos = temData ? reaisParaCentavos(preco) : null
    if (temData && precoCentavos === null) {
      return setErro('Marcou a data: diga também quanto custa por pessoa.')
    }

    setEnviando(true)
    try {
      await api.post('/api/admin/trips', {
        title: titulo.trim(),
        description: descricao.trim(),
        city: cidade.trim(),
        state: estado.trim().toUpperCase(),
        difficulty: dificuldade,
        ...(temData && precoCentavos !== null
          ? {
              primeiraSaida: {
                startAt: quandoVaiSubir,
                priceCents: precoCentavos,
                meetingPoint: pontoDeEncontro.trim() || null,
                meetingTimeLocal: horaDeEncontro.trim() || null,
              },
            }
          : {}),
      })
      mostrar({
        tom: 'sucesso',
        titulo: temData ? 'Trilha e data criadas' : 'Trilha criada',
        descricao: temData
          ? 'As duas em rascunho. Complete pelo “Editar” e publique quando estiver pronta.'
          : 'Em rascunho, e sem data marcada. Complete pelo “Editar” e publique quando estiver pronta.',
      })
      router.refresh()
      fechar()
    } catch (causa) {
      setErro(causa instanceof ErroDaApi ? causa.message : 'Não foi possível criar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button tamanho="sm" onClick={() => setAberto(true)}>
        + Nova trilha
      </Button>

      {aberto && (
        <Modal
          aberto
          aoFechar={fechar}
          titulo="Nova trilha"
          rodape={
            <>
              <Button variante="ghost" onClick={fechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" form={idBase} carregando={enviando}>
                Criar trilha
              </Button>
            </>
          }
        >
          <form id={idBase} onSubmit={enviar} noValidate className="flex flex-col gap-5">
            <Input
              rotulo="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Pedra Grande de Quatinga"
              dica="O endereço da página sai daqui e não muda depois."
              obrigatorio
            />

            <Textarea
              rotulo="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder="O que é a trilha, em um parágrafo. Dá para melhorar depois."
              obrigatorio
            />

            <div className="grid grid-cols-3 gap-4">
              <Input
                rotulo="Cidade"
                className="col-span-2"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Mogi das Cruzes"
                obrigatorio
              />
              <Input
                rotulo="UF"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                maxLength={2}
                obrigatorio
              />
            </div>

            <Select
              rotulo="Dificuldade"
              value={dificuldade}
              onChange={(e) => setDificuldade(e.target.value)}
              opcoes={DIFICULDADES}
            />

            {/* ── A PRIMEIRA DATA ───────────────────────────────────────────
                No site o cliente abre a página da trilha e escolhe a data ali
                mesmo; ele nunca vê "roteiros" e "saídas" como lugares
                diferentes. Aqui é a mesma coisa: escreve a trilha e já marca a
                estreia dela.

                Opcional de propósito. Trilha sem data aparece no site como
                "sob consulta", que é estado legítimo, e às vezes o texto é
                escrito antes de a data fechar com o guia. Exigir a data faria
                inventarem uma para conseguir salvar. */}
            <fieldset className="border-caqui-rule flex flex-col gap-4 border-t pt-5">
              <legend className="sr-only">Primeira data</legend>

              <div>
                <p className="font-display text-corpo-sm uppercase">Primeira data</p>
                <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                  Opcional. Sem data, a trilha aparece no site como sob consulta.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  rotulo="Quando vai subir"
                  type="datetime-local"
                  value={quandoVaiSubir}
                  onChange={(e) => setQuandoVaiSubir(e.target.value)}
                />
                <Input
                  rotulo="Preço por pessoa"
                  inputMode="decimal"
                  placeholder="90,00"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  dica={
                    temData ? 'Obrigatório, já que você marcou a data.' : 'Só o número, em reais.'
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  rotulo="Ponto de encontro"
                  value={pontoDeEncontro}
                  onChange={(e) => setPontoDeEncontro(e.target.value)}
                  placeholder="Portal de Extrema/MG, na Fernão Dias"
                />
                <Input
                  rotulo="Horário de encontro"
                  type="time"
                  value={horaDeEncontro}
                  onChange={(e) => setHoraDeEncontro(e.target.value)}
                />
              </div>
            </fieldset>

            <p className="border-caqui-rule-forte text-corpo-sm border-l-4 px-3 py-2">
              Nasce tudo em <strong>rascunho</strong>: você vê aqui, o cliente não. Foto, listas do
              que levar e política de cancelamento entram pelo “Editar”.
            </p>

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
