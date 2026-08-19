'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Confirmar } from '@/components/crm/confirmar'
import { Rotulo, Vazio } from '@/components/crm/pecas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/campo'
import { Modal } from '@/components/ui/dialogo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { gerarSlug } from '@/lib/slug'

/**
 * As atividades, e a tela que faltava para elas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CRUD COMPLETO NA API, ZERO TELA
 * ────────────────────────────────────────────────────────────────────────────
 * `ActivityTag` tinha GET, POST, PATCH e DELETE prontos, auditados, com o 409
 * certo para tag em uso. Nada disso tinha botão: as atividades do site eram as
 * do seed, para sempre.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O SLUG NASCE DO RÓTULO E NÃO MUDA NUNCA MAIS
 * ────────────────────────────────────────────────────────────────────────────
 * Ele vai para a URL do filtro (`/agenda?atividade=rapel`), que é endereço
 * compartilhado por WhatsApp e indexado pelo Google. Por isso a API recusa
 * mudá-lo, e aqui ele só aparece: derivado na criação, e depois somente
 * leitura. Renomear "Rapel" para "Rapel guiado" muda o que se lê, não o
 * endereço.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A CONTAGEM É O QUE EVITA A VIAGEM PERDIDA
 * ────────────────────────────────────────────────────────────────────────────
 * Apagar tag em uso responde 409. Mostrar "3 roteiro(s)" ao lado do lixo é o
 * que impede a pessoa de tentar, receber o erro, e ter que descobrir sozinha
 * quais roteiros usam aquilo.
 */

export type TagDoPainel = {
  id: number
  slug: string
  label: string
  icone: string | null
  roteiros: number
}

export function GerenciarTags({ tags }: { tags: TagDoPainel[] }) {
  const router = useRouter()
  const { mostrar } = useToast()

  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<TagDoPainel | null>(null)
  const [apagando, setApagando] = useState<TagDoPainel | null>(null)

  return (
    <>
      <div className="flex items-center justify-end px-4 py-2">
        <Button tamanho="sm" onClick={() => setCriando(true)}>
          + Nova atividade
        </Button>
      </div>

      {tags.length === 0 ? (
        <Vazio titulo="Nenhuma atividade cadastrada">
          <p>
            Atividade é o que dá para fazer num roteiro: rapel, cachoeira, nascer do sol. Ela vira o
            filtro “Atividade” na agenda do site.
          </p>
        </Vazio>
      ) : (
        <ul className="divide-caqui-rule divide-y">
          {tags.map((tag) => (
            <li key={tag.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="text-corpo-sm">{tag.label}</span>
              <span className="text-caqui-ink-500 text-micro font-mono">{tag.slug}</span>

              <span className="ml-auto flex items-center gap-3">
                <Rotulo>{tag.roteiros} roteiro(s)</Rotulo>

                <button
                  type="button"
                  onClick={() => setEditando(tag)}
                  className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro min-h-11 rounded-xs font-mono uppercase underline underline-offset-4"
                >
                  Renomear
                </button>

                {/* Tag em uso não mostra o botão: a API recusa, e oferecer um
                    caminho que sempre termina em erro é hostil. */}
                {tag.roteiros === 0 && (
                  <button
                    type="button"
                    onClick={() => setApagando(tag)}
                    className="text-caqui-ink-500 hover:text-caqui-danger text-micro min-h-11 rounded-xs font-mono uppercase underline underline-offset-4"
                  >
                    Apagar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {criando && (
        <FormularioDeTag
          aoFechar={() => setCriando(false)}
          aoSalvar={async (label) => {
            await api.post('/api/admin/tags', { slug: gerarSlug(label), label: label.trim() })
            mostrar({ tom: 'sucesso', titulo: 'Atividade criada' })
            router.refresh()
          }}
        />
      )}

      {editando && (
        <FormularioDeTag
          tag={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (label) => {
            await api.patch(`/api/admin/tags/${editando.id}`, { label: label.trim() })
            mostrar({ tom: 'sucesso', titulo: 'Atividade renomeada' })
            router.refresh()
          }}
        />
      )}

      {apagando && (
        <Confirmar
          aberto
          aoFechar={() => setApagando(null)}
          titulo={`Apagar “${apagando.label}”?`}
          rotuloConfirmar="Apagar"
          consequencia="Ela some do filtro da agenda do site."
          aoConfirmar={async () => {
            await api.delete(`/api/admin/tags/${apagando.id}`)
            mostrar({ tom: 'sucesso', titulo: 'Atividade apagada' })
            router.refresh()
          }}
        >
          <p>
            Nenhum roteiro usa esta atividade hoje, então nada mais muda. Se algum passar a usar
            antes de você confirmar, a API recusa e nada é perdido.
          </p>
        </Confirmar>
      )}
    </>
  )
}

function FormularioDeTag({
  tag,
  aoFechar,
  aoSalvar,
}: {
  tag?: TagDoPainel
  aoFechar: () => void
  aoSalvar: (label: string) => Promise<void>
}) {
  const [label, setLabel] = useState(tag?.label ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Derivado a cada tecla, nunca guardado em estado paralelo: dois estados
  // espelhando a mesma coisa é como o slug e o rótulo saem de sincronia.
  const slug = tag?.slug ?? gerarSlug(label)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (label.trim().length < 2) {
      setErro('O nome precisa de pelo menos duas letras.')
      return
    }
    if (!tag && slug === '') {
      setErro('Esse nome não gera um endereço válido. Use letras.')
      return
    }

    setEnviando(true)
    try {
      await aoSalvar(label)
      aoFechar()
    } catch (causa) {
      setErro(causa instanceof ErroDaApi ? causa.message : 'Não foi possível salvar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={tag ? 'Renomear atividade' : 'Nova atividade'}
      rodape={
        <>
          <Button variante="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form="formulario-de-tag" carregando={enviando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="formulario-de-tag" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Input
          rotulo="Nome"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Cachoeira"
          obrigatorio
        />

        <p className="text-caqui-ink-500 text-corpo-sm">
          Endereço do filtro: <code className="font-mono">/agenda?atividade={slug || '…'}</code>
          {tag && ' Ele não muda ao renomear, para não quebrar links já compartilhados.'}
        </p>

        {erro && (
          <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
