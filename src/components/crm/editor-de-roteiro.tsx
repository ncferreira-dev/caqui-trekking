'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { ZonaDeUpload } from '@/components/crm/zona-de-upload'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'

/**
 * O editor de roteiro.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SÓ EDITA. NÃO CRIA.
 * ────────────────────────────────────────────────────────────────────────────
 * Criar um roteiro do zero é um trabalho editorial — descrição longa, lista do
 * que levar, política de cancelamento, foto — que se faz com calma, não do
 * celular no meio da trilha. O CRM da Caqui é para operação diária, e a
 * operação diária é mexer no que já existe: corrigir um horário, mudar a
 * dificuldade depois de refazer a trilha, ajustar o que está incluso. Roteiro
 * novo entra por seed ou por um fluxo próprio, quando houver foto para dar a
 * ele. Ver docs/10-crm.md.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AS LISTAS SÃO UMA LINHA POR ITEM
 * ────────────────────────────────────────────────────────────────────────────
 * Destaques, incluso, não incluso e o que levar são arrays. A tela poderia ter
 * uma linha com botão de adicionar e remover para cada um — mas são quatro
 * listas, e isso viraria uma tela de administração de listas. Uma linha por
 * item num textarea é como a Caqui já pensa a lista, colável de um print do
 * WhatsApp, e o vazio simplesmente some.
 */

const DIFICULDADES = [
  { valor: 'FACIL', rotulo: 'Fácil' },
  { valor: 'MODERADO', rotulo: 'Moderado' },
  { valor: 'DIFICIL', rotulo: 'Difícil' },
  { valor: 'EXTREMO', rotulo: 'Extremo' },
]

const ESTADOS = [
  { valor: 'DRAFT', rotulo: 'Rascunho (só você vê)' },
  { valor: 'PUBLISHED', rotulo: 'Publicado (no ar)' },
]

export type RoteiroParaEditar = {
  id: number
  title: string
  subtitle: string | null
  description: string
  city: string
  state: string
  region: string | null
  difficulty: string
  distanceKm: string | null
  elevationGainM: number | null
  maxAltitudeM: number | null
  durationMinutes: number | null
  minAge: number | null
  requiresExperience: boolean
  highlights: string[]
  included: string[]
  notIncluded: string[]
  whatToBring: string[]
  cancellationPolicy: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

/** Número livre → inteiro ou null. Campo vazio vira null, não 0. */
function inteiroOuNulo(texto: string): number | null {
  const t = texto.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n) : null
}

const linhas = (texto: string): string[] =>
  texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')

export function EditorDeRoteiro({
  aberto,
  aoFechar,
  roteiro,
}: {
  aberto: boolean
  aoFechar: () => void
  roteiro: RoteiroParaEditar
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const idBase = useId()

  const [titulo, setTitulo] = useState(roteiro.title)
  const [subtitulo, setSubtitulo] = useState(roteiro.subtitle ?? '')
  const [descricao, setDescricao] = useState(roteiro.description)
  const [cidade, setCidade] = useState(roteiro.city)
  const [estado, setEstado] = useState(roteiro.state)
  const [regiao, setRegiao] = useState(roteiro.region ?? '')
  const [dificuldade, setDificuldade] = useState(roteiro.difficulty)
  const [distancia, setDistancia] = useState(roteiro.distanceKm ?? '')
  const [ganho, setGanho] = useState(roteiro.elevationGainM?.toString() ?? '')
  const [altitude, setAltitude] = useState(roteiro.maxAltitudeM?.toString() ?? '')
  const [duracao, setDuracao] = useState(roteiro.durationMinutes?.toString() ?? '')
  const [idade, setIdade] = useState(roteiro.minAge?.toString() ?? '')
  const [experiencia, setExperiencia] = useState(roteiro.requiresExperience)
  const [destaques, setDestaques] = useState(roteiro.highlights.join('\n'))
  const [incluso, setIncluso] = useState(roteiro.included.join('\n'))
  const [naoIncluso, setNaoIncluso] = useState(roteiro.notIncluded.join('\n'))
  const [oQueLevar, setOQueLevar] = useState(roteiro.whatToBring.join('\n'))
  const [cancelamento, setCancelamento] = useState(roteiro.cancellationPolicy ?? '')
  // Preserva o status REAL, inclusive ARCHIVED. O bug antigo colapsava ARCHIVED
  // em DRAFT aqui e, como o corpo do PATCH sempre manda `status`, salvar um
  // roteiro arquivado sem tocar no select o rebaixava para rascunho em silêncio.
  // Agora ele mantém ARCHIVED até uma troca EXPLÍCITA para rascunho/publicado.
  const [status, setStatus] = useState<string>(roteiro.status)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Se o roteiro chega arquivado, o select mostra e mantém "Arquivado"; trocar
  // para rascunho/publicado passa a ser uma reativação explícita, nunca acidental.
  const opcoesEstado =
    roteiro.status === 'ARCHIVED'
      ? [...ESTADOS, { valor: 'ARCHIVED', rotulo: 'Arquivado (fora do ar)' }]
      : ESTADOS

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (titulo.trim().length < 3) return setErro('O título é obrigatório.')
    if (descricao.trim().length < 10) return setErro('A descrição precisa de ao menos uma frase.')
    if (estado.trim().length !== 2) return setErro('O estado é a sigla de duas letras, ex.: SP.')
    if (distancia.trim() !== '' && !/^\d{1,3}([.,]\d{1,2})?$/.test(distancia.trim())) {
      return setErro('Distância em km, ex.: 8.5. Deixe em branco se não se aplica.')
    }

    const corpo = {
      title: titulo.trim(),
      subtitle: subtitulo.trim() || null,
      description: descricao.trim(),
      city: cidade.trim(),
      state: estado.trim().toUpperCase(),
      region: regiao.trim() || null,
      difficulty: dificuldade,
      distanceKm: distancia.trim() || null,
      elevationGainM: inteiroOuNulo(ganho),
      maxAltitudeM: inteiroOuNulo(altitude),
      durationMinutes: inteiroOuNulo(duracao),
      minAge: inteiroOuNulo(idade),
      requiresExperience: experiencia,
      highlights: linhas(destaques),
      included: linhas(incluso),
      notIncluded: linhas(naoIncluso),
      whatToBring: linhas(oQueLevar),
      cancellationPolicy: cancelamento.trim() || null,
      status,
    }

    setEnviando(true)
    try {
      await api.patch(`/api/admin/trips/${roteiro.id}`, corpo)
      mostrar({ tom: 'sucesso', titulo: 'Roteiro salvo' })
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
      titulo="Editar roteiro"
      className="w-[min(48rem,calc(100vw-2rem))]"
      rodape={
        <>
          <Button variante="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form={idBase} carregando={enviando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={idBase} onSubmit={enviar} noValidate className="flex flex-col gap-6">
        {/* ── Identidade ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Input
            rotulo="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            obrigatorio
          />
          <Input
            rotulo="Subtítulo"
            value={subtitulo}
            onChange={(e) => setSubtitulo(e.target.value)}
            placeholder="Rapel e trilha com vista do Alto Tietê"
            dica="Uma linha, aparece abaixo do título. Opcional."
          />
          <Textarea
            rotulo="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={5}
            obrigatorio
          />
        </div>

        {/* ── Fotos: a zona de upload com moldura de enquadramento ─────────── */}
        <ZonaDeUpload max={8} />

        {/* ── Onde e quão difícil ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input
            rotulo="Cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            obrigatorio
          />
          <Input
            rotulo="UF"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            maxLength={2}
            placeholder="SP"
            obrigatorio
          />
          <Input
            rotulo="Região"
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            placeholder="Alto Tietê"
          />
          <Select
            rotulo="Dificuldade"
            value={dificuldade}
            onChange={(e) => setDificuldade(e.target.value)}
            opcoes={DIFICULDADES}
          />
          <Input
            rotulo="Distância (km)"
            inputMode="decimal"
            value={distancia}
            onChange={(e) => setDistancia(e.target.value)}
            placeholder="8.5"
          />
          <Input
            rotulo="Duração (min)"
            inputMode="numeric"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            placeholder="360"
          />
          <Input
            rotulo="Ganho de elevação (m)"
            inputMode="numeric"
            value={ganho}
            onChange={(e) => setGanho(e.target.value)}
          />
          <Input
            rotulo="Altitude máx. (m)"
            inputMode="numeric"
            value={altitude}
            onChange={(e) => setAltitude(e.target.value)}
          />
          <Input
            rotulo="Idade mínima"
            inputMode="numeric"
            value={idade}
            onChange={(e) => setIdade(e.target.value)}
            placeholder="livre"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={experiencia}
            onChange={(e) => setExperiencia(e.target.checked)}
            className="accent-caqui-orange-500 size-5"
          />
          <span className="text-corpo-sm">Exige experiência prévia em trilha</span>
        </label>

        {/* ── Listas ──────────────────────────────────────────────────────── */}
        <div className="border-caqui-rule grid gap-4 border-t pt-5 sm:grid-cols-2">
          <Textarea
            rotulo="O que a trilha tem"
            value={destaques}
            onChange={(e) => setDestaques(e.target.value)}
            rows={4}
            dica="Um item por linha."
          />
          <Textarea
            rotulo="O que levar"
            value={oQueLevar}
            onChange={(e) => setOQueLevar(e.target.value)}
            rows={4}
            dica="Um item por linha."
          />
          <Textarea
            rotulo="Está incluso"
            value={incluso}
            onChange={(e) => setIncluso(e.target.value)}
            rows={4}
            dica="Um item por linha."
          />
          <Textarea
            rotulo="Não está incluso"
            value={naoIncluso}
            onChange={(e) => setNaoIncluso(e.target.value)}
            rows={4}
            dica="Um item por linha."
          />
        </div>

        <Textarea
          rotulo="Política de cancelamento"
          value={cancelamento}
          onChange={(e) => setCancelamento(e.target.value)}
          rows={3}
          dica="Vira uma pergunta no final da página. Opcional."
        />

        <Select
          rotulo="Estado de publicação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          opcoes={opcoesEstado}
        />

        {erro && (
          <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
