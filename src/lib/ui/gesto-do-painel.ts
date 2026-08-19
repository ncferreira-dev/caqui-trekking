/**
 * O GESTO QUE LEVA AO PAINEL, COMO LÓGICA PURA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ISTO SAIU DE DENTRO DO COMPONENTE
 * ════════════════════════════════════════════════════════════════════════════
 * Porque, dentro dele, o gesto estava QUEBRADO e ninguém tinha como perceber.
 *
 * Descoberto em 18/08/2026, medindo no navegador: cinco toques na marca
 * contavam certo, o pulso aparecia certo, a contagem zerava certo, e a pessoa
 * terminava na HOME em vez do painel. Sem erro no console, sem nada vermelho.
 *
 * A causa é uma ordem de eventos, e ela é sutil o bastante para sobreviver a
 * qualquer revisão de código. No 5º toque acontecia isto:
 *
 *   1. `pointerdown` conta o 5º toque, ZERA a contagem (para o 6º toque não
 *      jogar a pessoa no painel de novo) e chama `router.push('/crm')`.
 *   2. `click` dispara logo depois e pergunta ao `sessionStorage`: "esta é a
 *      2ª batida ou mais da sequência?". A contagem acabou de ser zerada, então
 *      a resposta é NÃO.
 *   3. Sem `preventDefault`, o `<Link href="/">` navega. Ele é o último a
 *      falar, e ganha do `push` do passo 1.
 *
 * A marca do rodapé só tornou o defeito visível porque foi a primeira vez que
 * alguém testou o gesto do começo ao fim.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O CONSERTO É NÃO PERGUNTAR DUAS VEZES
 * ════════════════════════════════════════════════════════════════════════════
 * A decisão de engolir o clique é tomada UMA vez, no mesmo instante em que a
 * contagem é conhecida, e devolvida junto. O `click` não consulta mais nada:
 * ele obedece a uma decisão que já foi tomada.
 *
 * E é por isso que este arquivo existe separado. Enquanto a regra morava dentro
 * do componente, ela só era observável abrindo um navegador, tocando cinco
 * vezes numa logo e olhando a barra de endereço. Aqui ela é uma função que
 * recebe dado e devolve dado, e o teste em `src/test/gesto-do-painel.test.ts`
 * roda em milissegundos, sem DOM, sem `sessionStorage` e sem router.
 */

/** O que ficou guardado da sequência anterior. */
export type Contagem = {
  total: number
  /** `Date.now()` do último toque. Zero quando não há sequência em curso. */
  ultimoToque: number
}

/** O que o componente deve fazer depois deste toque. */
export type Decisao = {
  /** A nova contagem, para gravar. */
  contagem: Contagem
  /**
   * O toque desta sequência, para o pulso. Difere de `contagem.total` no 5º
   * toque, quando a contagem é zerada mas a batida ainda foi a quinta.
   */
  toque: number
  /**
   * Cancelar a navegação do `<Link>`.
   *
   * Verdadeiro do 2º toque em diante, INCLUSIVE no 5º — que é justamente o
   * caso que estava errado. Ver o bloco no topo do arquivo.
   */
  engolirClique: boolean
  /** Começar a baixar o painel. Acontece uma vez, no 3º toque. */
  prefetchDoPainel: boolean
  /** Ir para o painel agora. */
  irAoPainel: boolean
}

export const TOQUES_NECESSARIOS = 5
/** A partir daqui a marca dá sinal de vida, e o painel começa a ser baixado. */
export const TOQUES_ATE_FEEDBACK = 3
/**
 * A janela é de OCIOSIDADE, não de duração total: o que zera é a PAUSA entre
 * toques. O briefing pede "5 toques em até 3 segundos" e "zera após 3s parado";
 * cinco toques rápidos levam menos de um segundo de qualquer jeito, então a
 * regra mais permissiva satisfaz as duas.
 */
export const JANELA_MS = 3000

const ZERADA: Contagem = { total: 0, ultimoToque: 0 }

export function decidirToque(anterior: Contagem, agora: number): Decisao {
  const continua = agora - anterior.ultimoToque <= JANELA_MS
  const toque = continua ? anterior.total + 1 : 1

  const irAoPainel = toque >= TOQUES_NECESSARIOS

  return {
    // Zera ao chegar no painel: sem isto, voltar para o site e tocar uma vez na
    // marca dispararia o 6º toque da mesma sequência e jogaria a pessoa no
    // painel de novo, sem ela ter pedido nada.
    contagem: irAoPainel ? ZERADA : { total: toque, ultimoToque: agora },
    toque,
    // Do 2º em diante. O 1º continua fazendo o que qualquer pessoa espera de
    // uma logo: ir para a home.
    engolirClique: toque > 1,
    prefetchDoPainel: toque === TOQUES_ATE_FEEDBACK,
    irAoPainel,
  }
}
