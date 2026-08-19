'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Brasao } from '@/components/marca/grafismos'
import { cn } from '@/lib/ui/cn'
import {
  decidirToque,
  JANELA_MS,
  TOQUES_ATE_FEEDBACK,
  TOQUES_NECESSARIOS,
  type Contagem,
} from '@/lib/ui/gesto-do-painel'

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
 * O GESTO VIVE EM DOIS LUGARES, E A CONTAGEM É UMA SÓ
 * ════════════════════════════════════════════════════════════════════════════
 * Desde 18/08/2026 a marca do RODAPÉ também responde ao gesto, a pedido do
 * cliente. As duas instâncias compartilham a contagem, porque ela mora no
 * `sessionStorage` e não no estado do componente.
 *
 * Isso não é efeito colateral, é o comportamento certo: quem opera o CRM
 * conhece o gesto, não a implementação, e cinco toques na marca deve significar
 * a mesma coisa nos dois lugares. Toques distribuídos entre as duas (três em
 * cima, dois embaixo) contam juntos, o que é uma consequência inofensiva de a
 * contagem ser do documento e não do elemento.
 *
 * O único estado LOCAL é o pulso a partir do 3º toque, e ele é local de
 * propósito: o retorno visual pertence à marca que a pessoa está tocando.
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

/**
 * A REGRA MORA EM `lib/ui/gesto-do-painel.ts`, E ISSO NÃO É ARRUMAÇÃO.
 *
 * Ela saiu daqui em 18/08/2026 porque, aqui dentro, o gesto estava quebrado e
 * era impossível perceber: cinco toques levavam à home em vez do painel, sem
 * erro nenhum. A causa era uma ordem de eventos, e ordem de evento não aparece
 * lendo o arquivo. Ver o bloco no topo daquele módulo e o teste que reproduz
 * o defeito em `src/test/gesto-do-painel.test.ts`.
 *
 * O que ficou neste arquivo é só o que precisa de navegador: ler e gravar o
 * `sessionStorage`, ouvir o ponteiro e navegar.
 */

const CHAVE_CONTAGEM = 'caqui:toques'

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

export function LogoFantasma({
  className,
  /**
   * O tamanho do brasão. O padrão é o do header.
   *
   * Existe porque o gesto passou a viver em DOIS lugares (header e rodapé) e
   * as duas marcas têm tamanhos diferentes. A alternativa seria duplicar o
   * componente, e duas cópias do mesmo gesto é a receita para uma delas ficar
   * para trás quando a regra mudar.
   */
  classeDaMarca = 'h-12 w-auto sm:h-14',
}: {
  className?: string
  classeDaMarca?: string
}) {
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

  /**
   * A decisão tomada no `pointerdown`, esperando o `click` que vem logo atrás.
   *
   * É um `ref` e não estado porque o `click` do MESMO toque precisa lê-la, e
   * estado só estaria atualizado no render seguinte. Foi exatamente aqui que o
   * defeito de 18/08/2026 morava: o `click` refazia a conta em vez de obedecer
   * a uma decisão já tomada.
   */
  const engolirClique = useRef(false)

  const registrarToque = useCallback(() => {
    const decisao = decidirToque(lerContagem(), Date.now())

    gravarContagem(decisao.contagem)
    setToques(decisao.toque)
    engolirClique.current = decisao.engolirClique

    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      gravarContagem({ total: 0, ultimoToque: 0 })
      setToques(0)
    }, JANELA_MS)

    // A PARTIR DO 3º TOQUE, O PAINEL COMEÇA A CHEGAR.
    //
    // `(crm)` é um grupo de rota separado justamente para que quem entra na
    // loja não baixe o código do painel (ver docs/07-shell.md). O preço disso
    // é que, no 5º toque, o `push` ainda precisaria buscar o chunk, e o gesto
    // terminaria numa tela parada. O cliente pediu que a página já esteja
    // carregando quando o 5º toque acontecer.
    //
    // O 3º toque é o ponto certo: é onde o pulso já começou, ou seja, onde o
    // sistema já reconheceu que ISTO é o gesto e não um toque acidental. Quem
    // tocou uma vez na marca continua sem baixar nada do painel.
    if (decisao.prefetchDoPainel) router.prefetch('/crm')

    if (decisao.irAoPainel) router.push('/crm')
  }, [router])

  /**
   * `onPointerDown` e não `onClick`: dispara antes da navegação, então o toque
   * é contabilizado mesmo quando o link leva a página embora.
   */
  const aoApontar = useCallback(() => registrarToque(), [registrarToque])

  const aoClicar = useCallback((evento: React.MouseEvent) => {
    // Obedece à decisão do `pointerdown`. NÃO recalcula: a contagem pode ter
    // sido zerada no meio do caminho, e foi assim que o gesto passou meses
    // levando para a home em vez do painel.
    if (engolirClique.current) evento.preventDefault()
    engolirClique.current = false
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
        <Brasao className={classeDaMarca} titulo="" />

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
