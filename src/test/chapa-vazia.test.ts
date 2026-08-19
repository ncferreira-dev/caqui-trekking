import { describe, expect, it } from 'vitest'

import { CAMADAS_DA_CHAPA, deslocarCamada } from '@/components/midia/imagem'

/**
 * A CHAPA QUE OCUPA O LUGAR DA FOTO NÃO PODE MOSTRAR A PRÓPRIA BORDA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DEFEITO, ENCONTRADO OLHANDO A TELA EM 18/08/2026
 * ────────────────────────────────────────────────────────────────────────────
 * Cada crista da chapa é um SVG mais largo que a caixa, empurrado para a
 * esquerda por margem negativa. A massa dela termina onde o SVG termina, então
 * empurrar demais faz a borda direita entrar na caixa: um retângulo de canto
 * vivo atravessando a paisagem.
 *
 * Foi visto na galeria de `/trekking/escalavrado-teresopolis`. A camada alta
 * tinha 170% de largura e podia ser deslocada até -149%: terminava a 21% da
 * caixa e deixava 79% de borda à mostra.
 *
 * O que torna isto sério não é o tamanho do erro, é a INTERMITÊNCIA: o
 * deslocamento sai do hash do slug, então a maioria dos itens fica certa e um
 * ou outro mostra o retalho. Um defeito assim passa por revisão, passa por
 * "abri a página e estava bom", e chega em produção.
 *
 * A invariante cabe numa linha, e é o que este arquivo prova para TODAS as
 * sementes possíveis em vez de para as que alguém abriu:
 *
 *     largura + deslocamento >= 100
 *
 * Verificado quebrando: devolvendo o deslocamento antigo (`-(n % 210)` na
 * camada da frente), o primeiro caso falha.
 */
describe('deslocamento das camadas da chapa vazia', () => {
  const camadas = Object.entries(CAMADAS_DA_CHAPA)

  it.each(camadas)('%s: a camada nunca descobre a borda direita', (nome, camada) => {
    // 4000 sementes cobre com folga o espaço de restos usado pelas três
    // camadas, e roda em milissegundos.
    for (let semente = 0; semente < 4000; semente++) {
      const deslocamento = deslocarCamada(semente, camada)
      const cobertura = camada.larguraMinima + deslocamento

      expect(
        cobertura,
        `${nome} com semente ${semente}: largura ${camada.larguraMinima}% e deslocamento ` +
          `${deslocamento}% cobrem só ${cobertura}% da caixa. Abaixo de 100% a borda ` +
          'direita do SVG entra em cena como um retângulo de canto vivo.',
      ).toBeGreaterThanOrEqual(100)
    }
  })

  it.each(camadas)('%s: o deslocamento é sempre para a esquerda, ou zero', (_nome, camada) => {
    for (let semente = 0; semente < 500; semente++) {
      // Deslocamento positivo empurraria o desenho para a DIREITA e descobriria
      // a borda esquerda, que é o mesmo defeito espelhado.
      expect(deslocarCamada(semente, camada)).toBeLessThanOrEqual(0)
    }
  })

  it('sementes diferentes produzem recortes diferentes', () => {
    // Sem isto, uma função que devolvesse a constante 0 passaria em tudo acima
    // e a chapa voltaria a ser a mesma gravura em todos os itens, que é o
    // defeito que originou a semente. Ver o cabeçalho de `MidiaVazia`.
    const vistos = new Set<number>()
    for (let semente = 0; semente < 200; semente++) {
      vistos.add(deslocarCamada(semente, CAMADAS_DA_CHAPA.frente))
    }
    expect(vistos.size).toBeGreaterThan(50)
  })
})
