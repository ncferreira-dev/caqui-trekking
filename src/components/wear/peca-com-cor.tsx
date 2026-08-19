'use client'

import { useState, type ReactNode } from 'react'

import { GaleriaDoProduto } from '@/components/wear/galeria-produto'
import { SeletorDeVariante } from '@/components/wear/seletor-de-variante'
import { fotosDaCor } from '@/lib/media/cor-da-foto'
import type { ProdutoDetalheDTO } from '@/server/dto/public-dto'

/**
 * A peça inteira: galeria à esquerda, escolha à direita, uma cor só entre as
 * duas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE COMPONENTE EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * Pedido do cliente em 18/08/2026: escolher a cor precisa trocar a FOTO junto
 * com o preço. A galeria e o seletor são vizinhos na grade, mas eram
 * independentes — e a cor vivia dentro do seletor, onde a galeria não alcança.
 *
 * A cor subiu para cá. É o menor lugar que enxerga os dois.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE VEM DEPOIS CONTINUA SENDO DO SERVIDOR
 * ────────────────────────────────────────────────────────────────────────────
 * Descrição, acordeão, compartilhar e tabela de medidas entram por `children`.
 * Passar conteúdo já renderizado por um componente de cliente NÃO o arrasta
 * para o bundle: ele continua sendo HTML vindo do servidor. Sem isso, subir a
 * cor para cá teria custado a hidratação da coluna inteira.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A REGRA DA FOTO NÃO MORA AQUI
 * ────────────────────────────────────────────────────────────────────────────
 * `fotosDaCor` é pura e vive em `lib/media/cor-da-foto.ts`, porque o card da
 * vitrine precisa concordar com esta página sobre qual foto pertence a qual
 * cor. Escrita nos dois lugares, a regra divergiria na primeira correção e o
 * hover do card mostraria a cor que a galeria recusa.
 */
export function PecaComCor({
  produto,
  aviso,
  children,
}: {
  produto: ProdutoDetalheDTO
  /**
   * O que vai ACIMA do seletor: hoje, o aviso de peça toda esgotada.
   *
   * Prop separada de `children` porque a ORDEM importa e ela se perdeu na
   * primeira versão: com tudo entrando por `children`, o aviso de esgotado
   * passou a aparecer depois do botão de comprar, que é exatamente tarde
   * demais.
   */
  aviso?: ReactNode
  /** Tudo que fica abaixo do seletor. Renderizado no servidor. */
  children: ReactNode
}) {
  const primeiraDisponivel = produto.variantes.find((v) => v.disponivel)
  const [cor, setCor] = useState<string | null>(
    primeiraDisponivel?.cor ?? produto.cores[0]?.nome ?? null,
  )

  const imagens = fotosDaCor(produto.imagens, cor)

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:gap-14">
      {/* `key` na cor: trocar de cor troca o CONJUNTO de fotos, e o índice da
          foto ativa não significa a mesma coisa nos dois conjuntos. Sem isto, a
          pessoa que estava na terceira foto do preto veria a terceira do rosa,
          ou uma galeria apontando para um índice que não existe mais. */}
      <GaleriaDoProduto
        key={cor ?? 'sem-cor'}
        imagens={imagens}
        nome={produto.nome}
        semente={produto.slug}
      />

      <div className="flex flex-col gap-8 lg:sticky lg:top-24 lg:h-fit">
        {aviso}
        <SeletorDeVariante produto={produto} cor={cor} aoTrocarCor={setCor} />
        {children}
      </div>
    </div>
  )
}
