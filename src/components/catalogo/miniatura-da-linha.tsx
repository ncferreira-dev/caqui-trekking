import { Imagem } from '@/components/midia/imagem'
import type { MediaDTO } from '@/server/dto/public-dto'

/**
 * A MINIATURA DA LINHA, QUE HOJE NÃO APARECE EM LUGAR NENHUM.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELA NASCE DESLIGADA, E ISSO É O PROJETO INTEIRO DELA
 * ════════════════════════════════════════════════════════════════════════════
 * Nenhum roteiro da Caqui tem capa no banco. Se esta peça renderizasse o vazio
 * (`MidiaVazia`), a agenda passaria a ter uma coluna de chapas repetidas do lado
 * de fora do numeral, que é exatamente o problema que fez a linha existir no
 * lugar do card. Ver o cabeçalho de `linha-de-saida.tsx`.
 *
 * Então: sem foto, ela devolve `null` e a linha continua idêntica ao que é
 * hoje, byte por byte. No dia em que alguém subir a primeira imagem de um
 * roteiro no CRM, a miniatura aparece sozinha, só naquela linha, sem deploy.
 *
 * ⚠️ E é por isso que a GRADE também é condicional (`classesDaLinha` abaixo).
 * Uma coluna a mais declarada "para quando houver foto" seria uma coluna de
 * largura zero com o `gap` do grid aplicado assim mesmo: um vão fantasma de
 * 20px na frente do título, em todas as linhas, para sempre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O NUMERAL CONTINUA MANDANDO
 * ════════════════════════════════════════════════════════════════════════════
 * A miniatura entra DEPOIS da data, e é pequena de propósito. A agenda é uma
 * lista cronológica: a pergunta que ela responde é "quando é a próxima?", e o
 * numeral gigante é a coluna que se varre com o olho sem ler nada. A foto
 * ilustra a linha; ela não pode assumir o lugar do eixo da lista.
 *
 * Quem quiser fotografia liderando já tem a peça pronta: `CardSaida`, guardada
 * para a home.
 *
 * Some abaixo de 640px porque ali a linha já é data em cima e título embaixo;
 * enfiar 112px de imagem no meio deixaria o título com menos de 40% da largura.
 */
export function MiniaturaDaLinha({ capa }: { capa: MediaDTO | null }) {
  if (!capa) return null

  return (
    <div className="border-caqui-rule hidden aspect-[4/3] w-28 shrink-0 overflow-hidden border sm:block lg:w-[9.5rem]">
      <Imagem
        midia={capa}
        // Fixo, porque a caixa é fixa: 112px no tablet e 152px no desktop. O
        // navegador serve a variante de 320 e cobre os dois com folga em telas
        // de densidade 2x.
        sizes="152px"
        // O zoom lento é o mesmo gesto do resto da linha (banho de fundo e seta
        // que desliza), e não um efeito novo: `group` está na linha inteira.
        className="motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[var(--ease-padrao)] motion-safe:group-hover:scale-[1.04]"
      />
    </div>
  )
}

/**
 * As classes de grade da linha, nas duas formas que ela tem.
 *
 * Existe aqui, e não repetida em cada linha, porque `LinhaDeSaida` e
 * `LinhaDeRoteiro` têm exatamente a mesma grade e nada garante que continuariam
 * iguais se cada uma carregasse a sua cópia. Foi assim que a agenda e o
 * catálogo de roteiros começaram a divergir da home antes.
 *
 *   sem foto   data | conteúdo | dado
 *   com foto   data | foto | conteúdo | dado
 *
 * No celular as duas são iguais: a miniatura está `hidden`, e item de grade com
 * `display: none` não é posicionado, então ele não deixa buraco.
 */
export function classesDaLinha(temFoto: boolean) {
  if (!temFoto) {
    return {
      grade: 'grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto]',
      conteudo: 'col-span-2 lg:col-span-1',
      dado: 'col-span-2 lg:col-span-1',
    }
  }

  return {
    grade: 'grid-cols-[auto_1fr] sm:grid-cols-[auto_auto_1fr] lg:grid-cols-[auto_auto_1fr_auto]',
    // A partir de `sm` o título sobe para a mesma linha da data e da foto: com
    // a imagem ao lado, deixar o título embaixo separaria a foto do nome dela.
    conteudo: 'col-span-2 sm:col-span-1',
    dado: 'col-span-2 sm:col-span-3 lg:col-span-1',
  }
}
