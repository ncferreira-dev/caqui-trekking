import { Montanhas } from '@/components/marca/grafismos'
import { LARGURAS, srcsetDe, urlVariante } from '@/lib/media/urls'
import type { MediaDTO } from '@/server/dto/public-dto'
import { cn } from '@/lib/ui/cn'

/**
 * A imagem do catálogo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO É `next/image`
 * ────────────────────────────────────────────────────────────────────────────
 * `next/image` existe para resolver três coisas: gerar variantes, negociar
 * formato e reservar espaço. As duas primeiras já estão resolvidas antes da
 * imagem chegar aqui — o Cloudinary entrega `f_auto,q_auto,c_limit` na borda,
 * escolhendo AVIF ou WebP pelo `Accept` do navegador (ver docs/05-midia.md).
 *
 * Passar por `/_next/image` em cima disso significaria:
 *
 *   1. Uma invocação de função serverless por imagem, por largura, no primeiro
 *      acesso — custo real na Vercel, e latência real no primeiro visitante de
 *      cada tamanho.
 *   2. Re-encodar um arquivo JÁ otimizado. Recomprimir um AVIF em WebP não
 *      melhora nada; degrada.
 *   3. Perder o `f_auto`: o formato passaria a ser decidido pelo otimizador do
 *      Next, e o CDN do Cloudinary viraria um armazenamento burro.
 *
 * O que sobra de `next/image` é `width`/`height` e `loading="lazy"` — dois
 * atributos nativos do HTML, que estão aqui embaixo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O BORRÃO É `background-image` DA PRÓPRIA `<img>`
 * ────────────────────────────────────────────────────────────────────────────
 * Sem elemento extra, sem estado, sem `onLoad`. O `blurDataUrl` (um data URI de
 * ~20×20px gravado no upload) pinta o fundo da própria imagem; quando os bytes
 * reais chegam, eles cobrem o fundo. Se o JavaScript não rodar, funciona
 * igual — e é isso que separa um placeholder de um placeholder que quebra.
 */

export type ImagemProps = {
  midia: MediaDTO
  /**
   * O atributo `sizes`. É OBRIGATÓRIO e não tem padrão: sem ele o navegador
   * assume `100vw` e baixa a imagem de 2000px para preencher um card de 380px.
   * Errar aqui é o defeito de performance mais caro e mais silencioso que
   * existe em catálogo — nada aparece quebrado, só pesado.
   */
  sizes: string
  /** `true` só na imagem acima da dobra. Mais de uma anula o efeito. */
  prioridade?: boolean
  className?: string
}

export function Imagem({ midia, sizes, prioridade = false, className }: ImagemProps) {
  return (
    <img
      src={urlVariante(midia.url, LARGURAS.card)}
      srcSet={srcsetDe(midia.url, midia.width)}
      sizes={sizes}
      alt={midia.alt}
      // Sempre presentes: é o que reserva a proporção antes do byte chegar e
      // impede o salto de layout. `MediaAsset` exige os dois no banco por isso.
      width={midia.width}
      height={midia.height}
      loading={prioridade ? 'eager' : 'lazy'}
      fetchPriority={prioridade ? 'high' : undefined}
      decoding="async"
      className={cn('block h-full w-full object-cover', className)}
      style={
        midia.blurDataUrl
          ? {
              backgroundImage: `url("${midia.blurDataUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    />
  )
}

/**
 * O lugar da imagem quando não existe imagem.
 *
 * Não é um caso de borda: a Caqui vai publicar roteiro antes de ter foto, e o
 * CRM é operado do celular no meio da trilha. Um `<img>` com `src` vazio
 * renderiza o ícone de imagem quebrada do navegador — que comunica "site com
 * defeito", não "foto ainda não subiu".
 *
 * `aria-hidden` porque não há informação aqui: o nome do roteiro está ao lado,
 * e anunciar "montanhas decorativas" só atrapalha quem usa leitor de tela.
 */
export function MidiaVazia({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-caqui-sand-100 flex h-full w-full items-end justify-center overflow-hidden',
        className,
      )}
    >
      <Montanhas className="h-2/3 w-full opacity-25" />
    </div>
  )
}

/** Imagem ou o vazio, decidido num lugar só. */
export function Capa({
  midia,
  sizes,
  prioridade,
  className,
}: {
  midia: MediaDTO | null
  sizes: string
  prioridade?: boolean
  className?: string
}) {
  if (!midia) return <MidiaVazia className={className} />
  return (
    <Imagem
      midia={midia}
      sizes={sizes}
      {...(prioridade ? { prioridade } : {})}
      {...(className ? { className } : {})}
    />
  )
}
