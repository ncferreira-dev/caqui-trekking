'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { ehLinkCurtoDeMaps, extrairCoordenadas } from '@/lib/maps/coordenadas'
import { centavosParaReais, reaisParaCentavos } from '@/lib/money'

/**
 * O formulário de saída — criar e editar, no mesmo componente.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DISPONIBILIDADE NÃO ENTRA AQUI, E ISSO É DE PROPÓSITO
 * ────────────────────────────────────────────────────────────────────────────
 * O toque de disponibilidade fica na LINHA da lista, não neste formulário. É o
 * campo mexido todo dia, e enfiá-lo aqui obrigaria a abrir um modal para uma
 * ação que precisa ser um toque. Este formulário é para o que muda raramente:
 * data, preço, ponto de encontro.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A DATA É "PAREDE LOCAL", NÃO INSTANTE UTC
 * ────────────────────────────────────────────────────────────────────────────
 * O `<input type="datetime-local">` fala "2026-08-15T06:00" — sábado, 6 da
 * manhã, sem fuso. É o que a Caqui pensa. O servidor converte para o instante
 * UTC certo com `instanteLocal`, respeitando o horário de verão da DATA
 * escolhida. Mandar `toISOString()` daqui gravaria a saída três horas
 * adiantada, que foi exatamente o tipo de bug que o PROMPT 02 caçou no projeto
 * de referência.
 */

export type RoteiroOpcao = { id: number; titulo: string; precoSugeridoCentavos: number }

export type SaidaParaEditar = {
  id: number
  tripId: number
  tituloRoteiro: string
  /** Parede local pronta para o input: "2026-08-15T06:00". */
  inicioParede: string
  precoCentavos: number
  compareAtPriceCents: number | null
  meetingPoint: string | null
  meetingTimeLocal: string | null
  meetingLat: number | null
  meetingLng: number | null
  /** O recado interno. Nunca sai do painel. */
  internalNotes: string | null
  status: 'DRAFT' | 'PUBLISHED'
}

type Props = {
  aberto: boolean
  aoFechar: () => void
  /** Em edição, a saída. Ausente = criar. */
  saida?: SaidaParaEditar
  /** Só usado na criação, para escolher o roteiro. */
  roteiros?: RoteiroOpcao[]
  /**
   * Data já escolhida, em parede local ("2026-08-15T06:00").
   *
   * É o que o calendário passa quando alguém toca num dia vazio: o dia já foi
   * decidido no gesto, e reabrir o formulário com o campo em branco obrigaria
   * a pessoa a digitar de novo a informação que ela acabou de dar. Só vale na
   * criação; em edição a data vem da própria saída.
   */
  dataInicial?: string
}

export function EditorDeSaida({ aberto, aoFechar, saida, roteiros = [], dataInicial }: Props) {
  const router = useRouter()
  const { mostrar } = useToast()
  const idBase = useId()

  const editando = saida !== undefined

  const [tripId, setTripId] = useState(String(saida?.tripId ?? roteiros[0]?.id ?? ''))
  const [inicio, setInicio] = useState(saida?.inicioParede ?? dataInicial ?? '')
  // ────────────────────────────────────────────────────────────────────────
  // O PREÇO JÁ NASCE SUGERIDO, E NÃO SÓ AO TROCAR O ROTEIRO
  // ────────────────────────────────────────────────────────────────────────
  // `escolherRoteiro` sugere o preço da trilha quando alguém MUDA o seletor.
  // Só que o seletor já abre com o primeiro roteiro escolhido, e ninguém muda
  // para o valor que já está lá. O resultado, visto em 18/08/2026 criando uma
  // saída pelo calendário: o campo abria vazio, "Criar saída" recusava com
  // "Preço inválido", e a sugestão que o formulário sabia dar nunca aparecia.
  //
  // A mesma conta, no estado inicial. Continua sendo SUGESTÃO: quem quiser
  // outro preço apaga e digita.
  const [precoDe, setPrecoDe] = useState(
    saida?.compareAtPriceCents != null ? centavosParaReais(saida.compareAtPriceCents) : '',
  )
  const [preco, setPreco] = useState(() => {
    if (saida) return centavosParaReais(saida.precoCentavos)
    const primeiro = roteiros[0]
    return primeiro && primeiro.precoSugeridoCentavos > 0
      ? centavosParaReais(primeiro.precoSugeridoCentavos)
      : ''
  })
  const [ponto, setPonto] = useState(saida?.meetingPoint ?? '')
  const [horario, setHorario] = useState(saida?.meetingTimeLocal ?? '')
  // O local vem de um LINK do Google Maps, não de dois números. Ao editar uma
  // saída que já tem coordenada, remonto um link canônico para o campo mostrar
  // que há local e para a extração devolver o mesmo par.
  const [mapsLink, setMapsLink] = useState(
    saida?.meetingLat != null && saida.meetingLng != null
      ? `https://www.google.com/maps?q=${saida.meetingLat},${saida.meetingLng}`
      : '',
  )
  const [observacoes, setObservacoes] = useState(saida?.internalNotes ?? '')
  const [publicar, setPublicar] = useState(saida?.status === 'PUBLISHED')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Derivado do link a cada render — nada de estado espelhando estado. É a
  // coordenada que o Google Maps embutiu no link colado, ou null.
  const coord = extrairCoordenadas(mapsLink)

  // Ao trocar o roteiro na criação, sugere o preço dele — sem sobrescrever o
  // que a pessoa já digitou, que seria hostil.
  function escolherRoteiro(novo: string) {
    setTripId(novo)
    if (!editando && preco === '') {
      const r = roteiros.find((x) => String(x.id) === novo)
      if (r) setPreco(centavosParaReais(r.precoSugeridoCentavos))
    }
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    const centavos = reaisParaCentavos(preco)
    if (centavos === null) {
      setErro('Preço inválido. Use o formato 90,00.')
      return
    }
    if (!inicio) {
      setErro('Escolha a data e a hora da saída.')
      return
    }

    // A coordenada sai do LINK. Link vazio = sem mapa. Link com texto mas sem
    // coordenada é erro: melhor barrar do que salvar sem local e a pessoa achar
    // que gravou o ponto.
    if (mapsLink.trim() !== '' && coord === null) {
      setErro(
        ehLinkCurtoDeMaps(mapsLink)
          ? 'Esse é um link curto. Abra ele no navegador e cole o link completo da barra de endereço.'
          : 'Não achei a localização nesse link. Cole o link do Google Maps do local.',
      )
      return
    }
    const latN = coord?.lat ?? null
    const lngN = coord?.lng ?? null

    // "De" vazio significa SEM preço anterior, e é `null`, não zero: zero
    // riscaria "R$ 0,00" ao lado do preço no card.
    const centavosDe = precoDe.trim() === '' ? null : reaisParaCentavos(precoDe)
    if (centavosDe === null && precoDe.trim() !== '') {
      setErro('Preço “de” inválido. Use o formato 120,00.')
      return
    }
    if (centavosDe !== null && centavosDe <= centavos) {
      // O site só risca o "de" quando ele é MAIOR que o preço atual (ver
      // `linha-de-saida.tsx`). Salvar um valor menor produz um campo que a
      // pessoa preencheu e que simplesmente não aparece em lugar nenhum.
      setErro('O preço “de” precisa ser maior que o preço atual, senão ele não aparece no site.')
      return
    }

    const corpo = {
      startAt: inicio,
      priceCents: centavos,
      compareAtPriceCents: centavosDe,
      meetingPoint: ponto.trim() || null,
      meetingTimeLocal: horario.trim() || null,
      meetingLat: latN,
      meetingLng: lngN,
      internalNotes: observacoes.trim() || null,
    }

    setEnviando(true)
    try {
      if (editando) {
        await api.patch(`/api/admin/departures/${saida.id}`, {
          ...corpo,
          status: publicar ? 'PUBLISHED' : 'DRAFT',
        })
        mostrar({ tom: 'sucesso', titulo: 'Saída salva' })
      } else {
        const { id } = await api.post<{ id: number }>('/api/admin/departures', {
          tripId: Number(tripId),
          ...corpo,
        })
        // Cria em rascunho; se a pessoa marcou publicar, publica em seguida.
        if (publicar) await api.patch(`/api/admin/departures/${id}`, { status: 'PUBLISHED' })
        mostrar({
          tom: 'sucesso',
          titulo: 'Saída criada',
          descricao: publicar
            ? 'Já está na agenda do site.'
            : 'Em rascunho. Publique quando quiser.',
        })
      }
      router.refresh()
      aoFechar()
    } catch (causa) {
      setErro(
        causa instanceof ErroDaApi ? causa.message : 'Não foi possível salvar. Tente de novo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? 'Editar saída' : 'Nova saída'}
      rodape={
        <>
          <Button variante="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form={idBase} carregando={enviando}>
            {editando ? 'Salvar' : 'Criar saída'}
          </Button>
        </>
      }
    >
      <form id={idBase} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        {editando ? (
          <p className="text-caqui-ink-700 text-corpo-sm">
            Roteiro: <strong>{saida.tituloRoteiro}</strong>. O roteiro de uma saída não muda; para
            outra trilha, crie uma saída nova.
          </p>
        ) : (
          <Select
            rotulo="Roteiro"
            value={tripId}
            onChange={(e) => escolherRoteiro(e.target.value)}
            opcoes={roteiros.map((r) => ({ valor: String(r.id), rotulo: r.titulo }))}
            obrigatorio
          />
        )}

        <Input
          rotulo="Data e hora"
          type="datetime-local"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          obrigatorio
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            rotulo="Preço por pessoa"
            inputMode="decimal"
            placeholder="90,00"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            dica="Só o número, em reais."
            obrigatorio
          />
          {/* O "de" riscado. A coluna existe no banco e a rota sempre aceitou
              o campo; faltava o input, então não havia como anunciar promoção
              sem escrever no banco à mão. */}
          <Input
            rotulo="Preço “de” (riscado)"
            inputMode="decimal"
            placeholder="120,00"
            value={precoDe}
            onChange={(e) => setPrecoDe(e.target.value)}
            dica="Opcional. Mostra um preço mais alto riscado do lado, como se fosse um desconto — ex: R$ 500,00 riscado ao lado de R$ 425,00. Só aparece se for maior que o preço por pessoa."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            rotulo="Horário de encontro"
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            dica="Aparece no card e no WhatsApp."
          />
        </div>

        <Input
          rotulo="Ponto de encontro"
          value={ponto}
          onChange={(e) => setPonto(e.target.value)}
          placeholder="Portaria da Fazenda Santa Rita, Mogi das Cruzes/SP"
          dica="O endereço exato do local de saída."
        />

        <fieldset className="border-caqui-rule flex flex-col gap-2 border-t pt-4">
          <legend className="text-caqui-ink-700 text-rotulo font-mono uppercase">
            Local no mapa
          </legend>
          <Input
            rotulo="Link do Google Maps"
            type="url"
            inputMode="url"
            placeholder="https://maps.google.com/..."
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
            dica="Abra o local no Google Maps e cole aqui o link da barra de endereço. É o que faz o botão “Como chegar” aparecer no site."
          />
          {coord && (
            <p className="text-caqui-ink-700 text-corpo-sm">
              ✓ Local reconhecido. O botão “Como chegar” vai aparecer no site.
            </p>
          )}
          {coord === null && ehLinkCurtoDeMaps(mapsLink) && (
            <p className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
              Esse é um link curto (maps.app.goo.gl). Abra ele no navegador e cole o link completo
              que aparecer na barra de endereço.
            </p>
          )}
        </fieldset>

        {/* ── O recado interno ─────────────────────────────────────────────
            Fica ABAIXO do mapa e ACIMA de publicar, de propósito: é a última
            coisa que se escreve antes de decidir se a saída vai ao ar, e é
            onde mora "levar corda extra" e "o grupo do João pediu 6 vagas".

            Ele NUNCA sai em rota pública. `SELECT_DEPARTURE_PUBLICA` não o
            inclui, e `api.test.ts` procura a string do fixture em toda
            resposta pública para provar isso. */}
        <Textarea
          rotulo="Observações internas"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Levar corda extra. O grupo do João pediu 6 vagas."
          dica="Só quem tem acesso ao painel vê. Nunca aparece no site nem na mensagem do WhatsApp."
        />

        <label className="border-caqui-ink-900 flex cursor-pointer items-start gap-3 border bg-white p-3">
          <input
            type="checkbox"
            checked={publicar}
            onChange={(e) => setPublicar(e.target.checked)}
            className="accent-caqui-orange-500 mt-0.5 size-5"
          />
          <span className="text-corpo-sm">
            <strong>Publicar na agenda do site.</strong>
            <span className="text-caqui-ink-500 mt-0.5 block">
              Desmarcado, a saída fica em rascunho: você vê aqui, o cliente não.
            </span>
          </span>
        </label>

        {erro && (
          <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
