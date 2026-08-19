import { Neblina, Serra } from '@/components/marca/serra'

/**
 * O manifesto — o segundo movimento da home.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ELE EXISTE, SE NÃO VENDE NADA
 * ────────────────────────────────────────────────────────────────────────────
 * A home antiga ia do herói direto para o carrossel de saídas. Funciona, e é
 * exatamente por isso que ela parecia catálogo: duas telas de produto, sem uma
 * frase que diga por que existir.
 *
 * Este bloco é a respiração entre o herói e a oferta. Ele custa uma rolagem e
 * paga em duas coisas: dá tempo de a pessoa decidir que gostou antes de ser
 * apresentada a um preço, e é o único lugar da home onde a marca fala em
 * primeira pessoa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESCALA DE CARTAZ NÃO SERVE PARA FRASE — MEDIDO EM 18/08/2026
 * ────────────────────────────────────────────────────────────────────────────
 * A primeira versão usou `display-2xl` nas três frases. Resultado medido: a
 * seção ficou com 1591px de altura, mais de duas telas, e o "manifesto" virou
 * uma parede de texto.
 *
 * A conta explica sozinha. `display-2xl` dá 120px em 1280px de janela, e em
 * Archivo Black caixa-alta cabem ~0,62em por caractere. Numa coluna de 960px
 * isso permite **13 caracteres por linha**. As frases têm 21, 33 e 40 — então
 * cada uma quebrava em duas a quatro linhas, nove no total.
 *
 * `display-l` (52px) permite ~29 caracteres por linha, e é a escala em que uma
 * frase cabe. A escala de cartaz continua existindo e continua sendo usada — no
 * `<h1>` do herói, onde a copy tem quatro palavras. E isso é a hierarquia
 * correta de qualquer jeito: a maior tipografia do site deve estar na primeira
 * tela, uma vez, e não repetida na seção seguinte.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A CHAPA INVERTIDA
 * ────────────────────────────────────────────────────────────────────────────
 * No herói a serra é traço CLARO sobre a noite. Aqui é traço PRETO sobre areia.
 * Mesmo desenho, mesma hachura, tinta trocada — é o que uma gravura faz quando
 * muda de papel, e é o que amarra as duas seções como partes de uma coisa só em
 * vez de duas telas com o mesmo enfeite.
 *
 * A serra fica NO FLUXO, não em `position: absolute`. A primeira versão a
 * posicionou por cima e exigiu adivinhar um `padding-bottom` que a
 * acomodasse — 224px no celular, 288px no desktop, números tirados do nada que
 * ainda deixavam o desenho encostar no parágrafo. No fluxo, a altura dela É o
 * espaço dela, e não há nada para calibrar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O TEXTO É PROPOSTA, NÃO DADO
 * ────────────────────────────────────────────────────────────────────────────
 * Diferente do resto da home, isto não vem do CRM: é copy escrita para o
 * projeto. Ela foi mantida sem número nenhum de propósito — nenhuma alegação de
 * "X anos de estrada" ou "grupos de até Y pessoas", porque essas informações eu
 * não tenho, e alegação inventada em página institucional é o tipo de coisa que
 * a Caqui teria que sustentar depois.
 *
 * As três frases descrevem o que a operação de fato faz, e cada uma tem
 * respaldo em dado real do site: saída de nascer do sol às 03:00 na agenda,
 * guias com Cadastur e monitores PESM na faixa de credibilidade, e o cume como
 * destino dos roteiros.
 */
export function Manifesto() {
  return (
    <section
      aria-labelledby="manifesto"
      className="secao-areia relative isolate overflow-hidden"
      style={
        {
          '--serra-massa': 'var(--color-caqui-sand-100)',
          // Sobre fundo claro a neblina escurece. Ver `Neblina` em serra.tsx.
          '--neblina-mistura': 'multiply',
        } as React.CSSProperties
      }
    >
      {/* A textura de superfície. HORIZONTAL — a diagonal a 45° já significa
          "esgotado" neste projeto, e reusar o ângulo como decoração faria o
          vocabulário mentir. Ver `linha-topografica` em globals.css. */}
      <div className="linha-topografica pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-5xl px-5 pt-20 pb-14 sm:px-8 sm:pt-28 sm:pb-16">
        <p className="text-rotulo text-caqui-forest-800 font-mono uppercase">
          Por que a gente sobe
        </p>

        {/* Três batidas, uma por linha. `block` em cada `<span>` porque em
            manifesto o lugar onde a linha termina É o ritmo — deixar o
            navegador decidir transformaria as três frases num parágrafo. */}
        <h2
          id="manifesto"
          className="texto-cartaz text-display-l mt-6 [text-wrap:pretty]"
          data-cena
        >
          <span className="block">Acordar antes do sol.</span>
          <span className="text-caqui-ink-700 block">Subir com quem conhece o caminho.</span>
          <span className="block">Voltar sabendo por que valeu.</span>
        </h2>

        <p className="text-corpo-lg text-caqui-ink-700 mt-8 max-w-xl" data-cena>
          A Serra do Mar não é um destino distante. Ela é o quintal de Mogi das Cruzes, e a gente
          leva você até onde a vista abre, com quem sabe o caminho de volta.
        </p>
      </div>

      {/* A serra em tinta, no fluxo. Três camadas com deriva contínua conduzida
          pela rolagem, sem JavaScript — ver o bloco CENA em globals.css. As
          profundidades diferentes é o que impede as cristas de andarem como um
          bloco só, que é o que mata a sensação de distância. */}
      <div aria-hidden="true" className="pointer-events-none relative">
        <div
          className="text-caqui-ink-900"
          data-deriva
          style={{ '--deriva': '3%' } as React.CSSProperties}
        >
          <Serra profundidade={1} className="opacity-40" />
        </div>
        {/* Sobreposição em PORCENTAGEM, não em rem — a altura do SVG vem da
            largura, então só uma medida também relativa à largura mantém a
            mesma sobreposição em 375px e em 1920px. Ver o cabeçalho de
            `Serra`. */}
        <div
          className="text-caqui-ink-900 -mt-[6%]"
          data-deriva
          style={{ '--deriva': '5%' } as React.CSSProperties}
        >
          <Serra profundidade={3} className="opacity-60" />
        </div>
        <Neblina className="bottom-[6%] h-[8%]" intensidade={0.8} />
        <div className="text-caqui-ink-900 -mt-[7%]">
          <Serra profundidade={5} />
        </div>
      </div>
    </section>
  )
}
