'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Brasao } from '@/components/marca/grafismos'
import { cn } from '@/lib/ui/cn'

/**
 * A logo, e o gesto que leva ao CRM.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ISTO NÃO É AUTENTICAÇÃO. NÃO CHEGA PERTO.
 * ════════════════════════════════════════════════════════════════════════════
 * O gesto é um ATALHO. Digitar `/crm` na barra de endereço leva ao mesmo lugar,
 * e é assim que tem que ser: a barreira real é o guard do backend, aplicado
 * rota a rota, com um teste que percorre o diretório e falha se alguma rota
 * administrativa nascer sem ele (ver `docs/04-permissoes.md` e
 * `src/test/autorizacao.test.ts`).
 *
 * O projeto de referência ilustra o oposto melhor do que qualquer argumento:
 * escondia o botão do painel atrás de 5 cliques no copyright e, ao mesmo
 * tempo, listava `/login`, `/dashboard`, `/clients` e `/admin/` no
 * `robots.txt` — público, para qualquer um ler.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O 5º TOQUE NAVEGA. NÃO EXISTE BOTÃO "CRM" NO SITE.
 * ════════════════════════════════════════════════════════════════════════════
 * A primeira versão revelava um link "CRM" ao lado da logo e o mantinha pela
 * sessão inteira. Dois problemas, e o segundo é o grave:
 *
 *  1. Um botão de painel administrativo no cabeçalho de uma loja é ruído para
 *     quem está comprando, e some do lugar dependendo de quem abriu.
 *  2. Ele ficava **fixo**. Bastava um toque acidental repetido — coisa que
 *     acontece com logo no topo do celular — para a marca virar um botão de
 *     administração pelo resto da visita, inclusive com o cliente olhando.
 *
 * Agora o 5º toque leva direto ao `/crm`, que já é a tela de login. O atalho
 * some no instante em que cumpre a função, e a loja nunca mostra que existe um
 * painel. Nada é persistido: a contagem morre em 3 segundos parada.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A ARMADILHA: A LOGO É UM LINK
 * ════════════════════════════════════════════════════════════════════════════
 * Se cada toque navegasse, o componente desmontaria no primeiro e a contagem
 * morreria junto — de `/agenda`, seria impossível chegar a 5. Duas medidas
 * resolvem:
 *
 *  1. **A contagem vive no `sessionStorage`**, não em memória. Sobrevive à
 *     navegação do primeiro toque.
 *  2. **Do segundo toque em diante, a navegação é cancelada.** O primeiro
 *     toque continua fazendo o que qualquer pessoa espera de uma logo: ir para
 *     a home. Os seguintes são engolidos, e a página não pisca.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A JANELA É DE OCIOSIDADE, NÃO DE DURAÇÃO TOTAL
 * ════════════════════════════════════════════════════════════════════════════
 * O briefing pede "5 toques em até 3 segundos" e "contador zera após 3s
 * parado". Implementei a segunda: o que zera é a PAUSA entre toques. Cinco
 * toques rápidos levam menos de um segundo de qualquer jeito, então a regra
 * mais permissiva satisfaz as duas — e o briefing é explícito sobre o gesto
 * não ser frustrante de acertar.
 */

const CHAVE_CONTAGEM = 'caqui:toques'

const TOQUES_NECESSARIOS = 5
/** A partir daqui a logo dá sinal de vida. Antes disso, nada acontece. */
const TOQUES_ATE_FEEDBACK = 3
const JANELA_MS = 3000

type Contagem = { total: number; ultimoToque: number }

function lerContagem(): Contagem {
  try {
    const cru = sessionStorage.getItem(CHAVE_CONTAGEM)
    if (!cru) return { total: 0, ultimoToque: 0 }
    const dados = JSON.parse(cru) as Partial<Contagem>
    if (typeof dados.total !== 'number' || typeof dados.ultimoToque !== 'number') {
      return { total: 0, ultimoToque: 0 }
    }
    return { total: dados.total, ultimoToque: dados.ultimoToque }
  } catch {
    return { total: 0, ultimoToque: 0 }
  }
}

function gravarContagem(contagem: Contagem): void {
  try {
    sessionStorage.setItem(CHAVE_CONTAGEM, JSON.stringify(contagem))
  } catch {
    // Storage bloqueado. O gesto para de funcionar; o CRM continua acessível
    // pela URL. Degradação aceitável para um atalho.
  }
}

export function LogoFantasma({ className }: { className?: string }) {
  const router = useRouter()
  const [toques, setToques] = useState(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A contagem NÃO é restaurada na montagem, de propósito: ela já vive no
  // `sessionStorage` e `registrarToque` a lê a cada toque. Depois de uma
  // navegação, o próximo toque continua de onde parou — só o pulso reaparece
  // um toque mais tarde, o que ninguém percebe.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  const registrarToque = useCallback(() => {
    const agora = Date.now()
    const anterior = lerContagem()

    const total = agora - anterior.ultimoToque > JANELA_MS ? 1 : anterior.total + 1

    gravarContagem({ total, ultimoToque: agora })
    setToques(total)

    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      gravarContagem({ total: 0, ultimoToque: 0 })
      setToques(0)
    }, JANELA_MS)

    if (total >= TOQUES_NECESSARIOS) {
      // Zera ANTES de navegar: sem isto, voltar para o site e tocar uma vez na
      // logo dispararia o 6º toque da mesma sequência e jogaria a pessoa no
      // painel de novo, sem ela ter pedido nada.
      gravarContagem({ total: 0, ultimoToque: 0 })
      setToques(0)
      router.push('/crm')
    }
  }, [router])

  /**
   * `onPointerDown` e não `onClick`: dispara antes da navegação, então o toque
   * é contabilizado mesmo quando o link leva a página embora.
   */
  const aoApontar = useCallback(() => registrarToque(), [registrarToque])

  const aoClicar = useCallback((evento: React.MouseEvent) => {
    // A contagem já subiu no `pointerdown`. Se este é o 2º ou seguinte da
    // sequência, engole a navegação: o primeiro já levou para a home.
    if (lerContagem().total > 1) evento.preventDefault()
  }, [])

  const pulsando = toques >= TOQUES_ATE_FEEDBACK && toques < TOQUES_NECESSARIOS

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Link
        href="/"
        onPointerDown={aoApontar}
        onClick={aoClicar}
        aria-label="Caqui Trekking, ir para a página inicial"
        className={cn(
          'relative block shrink-0 rounded-xs',
          'transition-transform duration-150',
          // O pulso é `transform` e `opacity` apenas — nada que force layout.
          pulsando && 'motion-safe:animate-[caqui-pulso-logo_600ms_ease-in-out_infinite]',
        )}
      >
        <Brasao className="h-12 w-auto sm:h-14" titulo="" />

        {/* Sinal a partir do 3º toque.
            Existe separado da animação porque, sob `prefers-reduced-motion`, o
            pulso não roda — e aí este ponto é o ÚNICO retorno de que o gesto
            está sendo reconhecido. Sem ele, quem desligou animação tentaria no
            escuro. */}
        {pulsando && (
          <span
            aria-hidden="true"
            className="bg-caqui-orange-500 border-caqui-ink-900 absolute -top-0.5 -right-0.5 size-2.5 rounded-full border"
          />
        )}
      </Link>
    </div>
  )
}
