'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'

/**
 * Criar roteiro.
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
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setAberto(false)
    setTitulo('')
    setDescricao('')
    setCidade('')
    setEstado('SP')
    setDificuldade('MODERADO')
    setErro(null)
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (titulo.trim().length < 3) return setErro('O título é obrigatório.')
    if (descricao.trim().length < 10) return setErro('A descrição precisa de ao menos uma frase.')
    if (cidade.trim().length < 2) return setErro('Diga a cidade da trilha.')
    if (estado.trim().length !== 2) return setErro('O estado é a sigla de duas letras, ex.: SP.')

    setEnviando(true)
    try {
      await api.post('/api/admin/trips', {
        title: titulo.trim(),
        description: descricao.trim(),
        city: cidade.trim(),
        state: estado.trim().toUpperCase(),
        difficulty: dificuldade,
      })
      mostrar({
        tom: 'sucesso',
        titulo: 'Roteiro criado',
        descricao: 'Em rascunho. Complete pelo “Editar” e publique quando estiver pronto.',
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
        + Novo roteiro
      </Button>

      {aberto && (
        <Modal
          aberto
          aoFechar={fechar}
          titulo="Novo roteiro"
          rodape={
            <>
              <Button variante="ghost" onClick={fechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" form={idBase} carregando={enviando}>
                Criar roteiro
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

            <p className="border-caqui-rule-forte text-corpo-sm border-l-4 px-3 py-2">
              O roteiro nasce em <strong>rascunho</strong>: você vê aqui, o cliente não. Foto,
              listas do que levar e política de cancelamento entram pelo “Editar”.
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
