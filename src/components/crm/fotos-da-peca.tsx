/**
 * PARADO — SEM USO DESDE 20/08/2026, DE PROPÓSITO.
 *
 * Este componente é o mapa de "qual foto é de qual cor", pedido do cliente em
 * 18/08. Ele vivia dentro do bloco de cada peça na lista antiga; quando a lista
 * virou grade de quadrados, saiu junto — e a saída não foi intencional.
 *
 * O cliente decidiu, em 20/08, que ele volta JUNTO COM O CLOUDINARY: subir a
 * foto e declarar a cor dela são a mesma tarefa. Recolocá-lo antes disso
 * entregaria uma tela sem nenhuma foto para marcar.
 *
 * NÃO APAGUE sem retomar essa conversa. Ver docs/14-cadastro-de-produto.md.
 */

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Aviso, Vazio } from '@/components/crm/pecas'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { coresSemFoto } from '@/lib/media/cor-da-foto'
import { cn } from '@/lib/ui/cn'

/**
 * Qual foto é de qual cor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PEDIDO, NA FALA DO CLIENTE
 * ────────────────────────────────────────────────────────────────────────────
 * "Dá para adicionar, na mesma camisa baby look, três cores. Caso seja
 * complicado de fazer isso automático, coloque essa opção lá dentro do CRM,
 * onde por exemplo a cor amarela pode ser imagem dois, a cor azul pode ser
 * imagem um e a cor vermelha pode ser a três."
 *
 * A escolha explícita é a certa, e a automática é a armadilha. Amarrar pela
 * ORDEM ("a 1ª cor usa a 1ª imagem") parece economizar uma tela e cobra caro
 * no dia em que alguém reordenar as fotos ou subir uma foto de detalhe no
 * meio: a associação passa a estar errada EM SILÊNCIO. Ninguém recebe erro. O
 * site mostra a camiseta azul para quem clicou em vermelho.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `<select>` COM AS CORES DA PEÇA, NUNCA TEXTO LIVRE
 * ────────────────────────────────────────────────────────────────────────────
 * Texto livre produz "Azul", "azul" e "Azul Marinho " com espaço no fim, e a
 * associação falha sem avisar. O seletor só oferece o que a peça tem — e o
 * servidor confere de novo, porque `<select>` é cortesia e o `fetch` continua
 * chamável do console (ver `definirCorDaFoto`).
 */

export type FotoDaPeca = {
  id: number
  url: string
  alt: string
  cor: string | null
}

/** O valor do `<option>` neutro. String vazia, porque `<select>` não tem null. */
const SEM_COR = ''

export function FotosDaPeca({
  fotos,
  cores,
  nomeDaPeca,
}: {
  fotos: FotoDaPeca[]
  /** As cores que a peça tem cadastradas, na ordem das variantes. */
  cores: string[]
  nomeDaPeca: string
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const [ocupada, setOcupada] = useState<Record<number, boolean>>({})

  const semFoto = coresSemFoto(fotos, cores)

  if (fotos.length === 0) {
    return (
      <Vazio titulo="Sem foto ainda">
        <p>
          Quando as fotos entrarem, é aqui que você diz qual delas é de cada cor. A loja passa a
          trocar a foto junto com a cor escolhida.
        </p>
      </Vazio>
    )
  }

  async function definir(foto: FotoDaPeca, valor: string) {
    if (ocupada[foto.id]) return
    setOcupada((atual) => ({ ...atual, [foto.id]: true }))
    try {
      await api.patch(`/api/admin/media/${foto.id}`, { cor: valor === SEM_COR ? null : valor })
      router.refresh()
    } catch (causa) {
      mostrar({
        tom: 'erro',
        titulo: 'A cor não mudou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'Tente de novo.',
      })
    } finally {
      setOcupada((atual) => ({ ...atual, [foto.id]: false }))
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {cores.length === 0 && (
        <Aviso titulo="Esta peça não tem cor cadastrada">
          <p>
            Cadastre as variantes primeiro, pelo “Editar”. Sem cor não há o que ligar, e o seletor
            abaixo fica sem opções.
          </p>
        </Aviso>
      )}

      {semFoto.length > 0 && (
        /* AVISO, não erro: ficar sem foto é estado legítimo, a foto ainda não
           chegou. O que não pode é quem cadastra descobrir isso pela galeria
           vazia na loja, semanas depois. */
        <Aviso titulo={`Sem foto própria: ${semFoto.join(', ')}`}>
          <p>
            Na loja, quem escolher essas cores vê as fotos sem cor marcada. Se não houver nenhuma, a
            galeria fica vazia: o site nunca mostra a foto de outra cor.
          </p>
        </Aviso>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {fotos.map((foto, indice) => (
          <li key={foto.id} className="border-caqui-rule flex flex-col gap-2 border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- ver o
                cabeçalho de `midia/imagem.tsx`: quem serve é o Cloudinary. */}
            <img
              src={foto.url}
              alt={foto.alt}
              className="border-caqui-rule aspect-square w-full border object-cover"
              loading="lazy"
            />

            <label className="flex flex-col gap-1">
              <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                Imagem {indice + 1}
              </span>
              <select
                value={foto.cor ?? SEM_COR}
                disabled={cores.length === 0 || ocupada[foto.id]}
                onChange={(e) => void definir(foto, e.target.value)}
                aria-label={`Cor da imagem ${indice + 1} de ${nomeDaPeca}`}
                className={cn(
                  'border-caqui-ink-900 text-corpo-sm min-h-11 border bg-white px-2',
                  'focus-visible:ring-caqui-ink-900 focus-visible:ring-2 focus-visible:outline-none',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <option value={SEM_COR}>Serve para todas</option>
                {cores.map((cor) => (
                  <option key={cor} value={cor}>
                    {cor}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
