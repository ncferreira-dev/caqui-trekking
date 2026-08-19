import { describe, expect, it } from 'vitest'

import { ASPECTO, decidirVideo, orientacaoIdeal, VIDEO_HEROI } from '@/lib/media/video-heroi'

/**
 * A decisão de qual vídeo do herói tocar — ou de não tocar nenhum.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NASCEU FALHANDO EM 18/08/2026
 * ────────────────────────────────────────────────────────────────────────────
 * Escrito antes de `lib/media/video-heroi.ts` existir. A primeira execução
 * falhou no import, e cada caso abaixo falhou por conta própria antes de a
 * regra correspondente ser escrita.
 *
 * O defeito que ele existe para impedir não é visual, é de conta alheia: um
 * vídeo de fundo que ignora `Save-Data` gasta megabytes do plano de quem está
 * no 4G no ponto de ônibus, e quem escreveu nunca vai perceber, porque
 * desenvolve no Wi-Fi. O mesmo vale para `prefers-reduced-motion`, que é
 * acessibilidade, não preferência estética.
 */

describe('decidirVideo — quando NÃO tocar', () => {
  const base = { larguraViewport: 1440, alturaViewport: 900 }

  it('não toca sob prefers-reduced-motion', () => {
    const d = decidirVideo({
      ...base,
      movimentoReduzido: true,
      poupaDados: false,
      tipoDeConexao: '4g',
    })
    expect(d).toEqual({ tocar: false, motivo: 'movimento-reduzido' })
  })

  it('não toca sob Save-Data', () => {
    const d = decidirVideo({
      ...base,
      movimentoReduzido: false,
      poupaDados: true,
      tipoDeConexao: '4g',
    })
    expect(d).toEqual({ tocar: false, motivo: 'poupa-dados' })
  })

  it.each(['slow-2g', '2g'])('não toca em conexão %s', (tipo) => {
    const d = decidirVideo({
      ...base,
      movimentoReduzido: false,
      poupaDados: false,
      tipoDeConexao: tipo,
    })
    expect(d).toEqual({ tocar: false, motivo: 'conexao-lenta' })
  })

  it('movimento reduzido vence Save-Data — o motivo relatado é o de acessibilidade', () => {
    // Não é preciosismo: o motivo vai para o atributo `data-motivo`, que é como
    // se depura "por que o vídeo não tocou no aparelho do cliente". Se os dois
    // valem, o que importa saber é o que não se resolve trocando de rede.
    const d = decidirVideo({
      ...base,
      movimentoReduzido: true,
      poupaDados: true,
      tipoDeConexao: '2g',
    })
    expect(d).toEqual({ tocar: false, motivo: 'movimento-reduzido' })
  })

  it('3g NÃO impede — `effectiveType` é pessimista durante o carregamento', () => {
    // Nasceu falhando em 18/08/2026, depois de o próprio site recusar o vídeo
    // em localhost com `data-video="conexao-lenta"` enquanto o console
    // reportava 4g. `effectiveType` deriva de RTT recente, e o RTT está
    // inflado justamente no carregamento inicial, que é quando a decisão é
    // tomada. Ver o comentário de CONEXOES_LENTAS.
    const d = decidirVideo({
      ...base,
      movimentoReduzido: false,
      poupaDados: false,
      tipoDeConexao: '3g',
    })
    expect(d).toEqual({ tocar: true, orientacao: 'paisagem' })
  })

  it('Save-Data em 3g AINDA impede — o sinal explícito manda', () => {
    // A distinção que importa: `3g` é estimativa do navegador e foi
    // despromovida; `saveData` é escolha da pessoa e continua valendo.
    const d = decidirVideo({
      ...base,
      movimentoReduzido: false,
      poupaDados: true,
      tipoDeConexao: '3g',
    })
    expect(d).toEqual({ tocar: false, motivo: 'poupa-dados' })
  })

  it('conexão desconhecida NÃO impede — a API não existe no Safari', () => {
    // `navigator.connection` é ausente no Safari e no Firefox. Tratar
    // `undefined` como "lenta" desligaria o vídeo em metade do tráfego real.
    const d = decidirVideo({
      ...base,
      movimentoReduzido: false,
      poupaDados: false,
      tipoDeConexao: undefined,
    })
    expect(d).toEqual({ tocar: true, orientacao: 'paisagem' })
  })
})

describe('decidirVideo — qual orientação', () => {
  const ok = { movimentoReduzido: false, poupaDados: false, tipoDeConexao: '4g' } as const

  it.each([
    ['iPhone 14 retrato', 390, 844, 'retrato'],
    ['iPhone SE retrato', 375, 667, 'retrato'],
    ['iPad retrato', 768, 1024, 'retrato'],
    ['iPad paisagem', 1024, 768, 'paisagem'],
    ['notebook', 1440, 900, 'paisagem'],
    ['desktop largo', 1920, 1080, 'paisagem'],
    ['celular deitado', 844, 390, 'paisagem'],
  ])('%s (%ix%i) → %s', (_nome, largura, altura, esperado) => {
    const d = decidirVideo({ ...ok, larguraViewport: largura, alturaViewport: altura })
    expect(d).toEqual({ tocar: true, orientacao: esperado })
  })

  it('escolhe a orientação que MENOS corta, não a que "parece" certa', () => {
    // A regra não é "viewport alto → vídeo alto". É: escolher o vídeo cuja
    // proporção está mais perto da do viewport, porque `object-fit: cover`
    // descarta exatamente a diferença entre as duas.
    //
    // O ponto de virada é a média geométrica das duas proporções — abaixo dele
    // o retrato corta menos, acima dele o paisagem corta menos.
    const virada = Math.sqrt(ASPECTO.retrato * ASPECTO.paisagem)

    const logoAbaixo = decidirVideo({
      ...ok,
      larguraViewport: virada * 1000 - 30,
      alturaViewport: 1000,
    })
    const logoAcima = decidirVideo({
      ...ok,
      larguraViewport: virada * 1000 + 30,
      alturaViewport: 1000,
    })

    expect(logoAbaixo).toEqual({ tocar: true, orientacao: 'retrato' })
    expect(logoAcima).toEqual({ tocar: true, orientacao: 'paisagem' })
  })

  it('viewport de altura zero não quebra nem devolve NaN', () => {
    // Acontece de verdade: alguns navegadores relatam 0 no primeiro quadro,
    // antes do layout. Uma divisão por zero aqui viraria `NaN`, toda comparação
    // com NaN é falsa, e a decisão cairia num galho não previsto.
    const d = decidirVideo({ ...ok, larguraViewport: 390, alturaViewport: 0 })
    expect(d).toEqual({ tocar: true, orientacao: 'retrato' })
  })
})

describe('VIDEO_HEROI — os arquivos declarados', () => {
  it('as duas orientações têm webm, mp4 e pôster', () => {
    for (const orientacao of ['retrato', 'paisagem'] as const) {
      const fontes = VIDEO_HEROI[orientacao]
      expect(fontes.webm).toMatch(/^\/videos\/.+\.webm$/)
      expect(fontes.mp4).toMatch(/^\/videos\/.+\.mp4$/)
      expect(fontes.poster).toMatch(/^\/videos\/.+\.jpg$/)
    }
  })

  it('retrato e paisagem apontam para arquivos DIFERENTES', () => {
    // O defeito que isto pega é copiar-e-colar o bloco de fontes e esquecer de
    // trocar o caminho — o mobile passaria a baixar o arquivo de desktop, que é
    // o dobro do peso e ainda vem cortado errado.
    expect(VIDEO_HEROI.retrato.webm).not.toBe(VIDEO_HEROI.paisagem.webm)
    expect(VIDEO_HEROI.retrato.mp4).not.toBe(VIDEO_HEROI.paisagem.mp4)
    expect(VIDEO_HEROI.retrato.poster).not.toBe(VIDEO_HEROI.paisagem.poster)
  })

  it('as proporções declaradas batem com a intenção de cada corte', () => {
    // `paisagem` é 16:9; `retrato` é o vertical nativo do celular.
    expect(ASPECTO.paisagem).toBeCloseTo(16 / 9, 2)
    expect(ASPECTO.retrato).toBeLessThan(1)
  })
})

describe('orientacaoIdeal — usada também quando o vídeo NÃO toca', () => {
  it('devolve o corte certo para o pôster, sem depender da decisão de tocar', () => {
    // O defeito que isto pega: sob movimento reduzido o vídeo não entra, mas a
    // cena continua mostrando a imagem. Se o pôster viesse fixo no corte de
    // desktop, quem pediu menos movimento no celular receberia de brinde o
    // enquadramento errado.
    expect(orientacaoIdeal({ larguraViewport: 390, alturaViewport: 844 })).toBe('retrato')
    expect(orientacaoIdeal({ larguraViewport: 1440, alturaViewport: 900 })).toBe('paisagem')
  })
})
