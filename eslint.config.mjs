import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Desliga as regras de estilo que conflitam com o Prettier.
  // Precisa vir DEPOIS das configs acima para sobrescrevê-las.
  prettier,

  {
    rules: {
      // Dinheiro é Int de centavos neste projeto (docs/00-analise-dalia.md,
      // seção 3.6: no projeto de referência o helper de arredondamento errava
      // sistematicamente acima de R$ 8.192). `toFixed` em valor monetário é o
      // atalho que reintroduz float — a formatação passa por um helper único.
      'no-restricted-properties': [
        'error',
        {
          property: 'toFixed',
          message:
            'Não use toFixed em valor monetário. Dinheiro é Int de centavos; formate com o helper de moeda.',
        },
      ],
      // Erro engolido foi uma das dívidas do projeto de referência.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },

  {
    // Escopado ao código-fonte: sem isso, a própria regra abaixo casa com o
    // texto da sua mensagem e este arquivo se auto-reprova.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // O laranja da marca REPROVA como cor de texto: #F26522 sobre branco
          // dá 3,15:1, e o AA exige 4,5:1. A única exceção sancionada é o
          // preço, e ela vive no utilitário `.preco`, que trava o tamanho em
          // 28px — onde o mínimo cai para 3:1 e a combinação passa.
          //
          // Documentar isso não basta: `text-caqui-orange-500` é a coisa mais
          // natural do mundo de se escrever, e o erro é invisível para quem
          // enxerga bem. Ver docs/06-design-system.md.
          selector: 'Literal[value=/text-caqui-orange-/]',
          message:
            'Laranja como cor de texto reprova no WCAG AA (3,15:1 sobre branco). Use a classe `.preco` para o preço, ou text-caqui-ink-900 / text-caqui-orange-600 sobre fundo escuro.',
        },
        {
          selector: 'TemplateElement[value.raw=/text-caqui-orange-/]',
          message:
            'Laranja como cor de texto reprova no WCAG AA (3,15:1 sobre branco). Use a classe `.preco` para o preço.',
        },
      ],
    },
  },

  {
    // ────────────────────────────────────────────────────────────────────────
    // `<img>` É PERMITIDO EM EXATAMENTE DOIS ARQUIVOS
    // ────────────────────────────────────────────────────────────────────────
    // A regra `@next/next/no-img-element` pressupõe que o otimizador do Next é
    // quem serve as imagens. Neste projeto não é: o Cloudinary já entrega
    // `f_auto,q_auto,c_limit` na borda, negociando AVIF/WebP pelo `Accept`.
    // Passar por `/_next/image` em cima disso custaria uma invocação de função
    // por imagem e por largura, re-encodaria um arquivo já otimizado e mataria
    // o `f_auto`. A justificativa completa está no cabeçalho de imagem.tsx.
    //
    // A exceção é NOMINAL, e não global, de propósito: um `<img>` solto em
    // qualquer outro arquivo continua sendo erro. Quem quiser renderizar
    // imagem passa pelos componentes que sabem montar `srcset`, `sizes` e o
    // borrão — que é justamente o que a regra existe para garantir.
    // `zona-de-upload.tsx` entra porque exibe prévia de arquivo LOCAL: um
    // `object URL` que só existe no navegador, sem passar por Cloudinary nem por
    // otimizador. `next/image` não sabe servir um `blob:` e reclamaria da falta
    // de `width`/`height` de uma imagem que ainda nem foi enviada.
    files: [
      'src/components/midia/imagem.tsx',
      'src/components/catalogo/galeria.tsx',
      'src/components/crm/zona-de-upload.tsx',
    ],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },

  {
    // ──────────────────────────────────────────────────────────────────────
    // TRAVESSAO NAO ENTRA EM TEXTO DO SITE
    // ──────────────────────────────────────────────────────────────────────
    // Decisao de voz da marca, pedida pelo cliente em 18/08/2026: o texto do
    // site nao usa travessao nem meia-risca. Frase que pediria um deles vira
    // duas frases, ou ganha dois-pontos, ou uma virgula.
    //
    // E trava, e nao conselho, porque travessao e a coisa mais natural do mundo
    // de se digitar em portugues escrito com cuidado, e porque o defeito nao
    // quebra nada: ele so aparece na tela, semanas depois, num paragrafo que
    // ninguem esta mais olhando. Foram 34 ocorrencias na primeira varredura.
    //
    // ESCOPO: so `app/` e `components/`, que e onde a copy mora.
    //   - `src/test/**` fica de fora: a descricao de um teste e documentacao
    //     para quem le o codigo, nao texto que alguem ve no site.
    //   - comentario de codigo tambem fica de fora em qualquer arquivo, porque
    //     nao e `JSXText` nem `Literal`. A documentacao deste projeto usa
    //     travessao e continua usando.
    //
    // ⚠️ AS DUAS REGRAS DO LARANJA ESTAO REPETIDAS AQUI DE PROPOSITO.
    //
    // Em flat config, as opcoes de uma MESMA regra nao se somam entre blocos:
    // o ultimo bloco que casa com o arquivo SUBSTITUI a configuracao inteira.
    // Quando este bloco nasceu, em 18/08/2026, ele apagou em silencio a trava
    // do laranja dentro de `app/` e `components/` — exatamente as duas pastas
    // onde `className` existe. Em `lib/` e `server/`, onde ela sobreviveu, ha
    // 1 `className` contra 1.312 nas duas de cima.
    //
    // Ou seja: a trava continuou verde, continuou documentada em tres lugares,
    // e parou de olhar qualquer coisa. E o defeito que a skill chama de "o pior
    // estado possivel": uma checagem que existe e nao ve nada.
    //
    // Provado assim, e este comando precisa continuar acusando erro:
    //   printf 'export const a = "text-caqui-orange-500"' \
    //     | npx eslint --stdin --stdin-filename src/components/prova.tsx
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/text-caqui-orange-/]',
          message:
            'Laranja como cor de texto reprova no WCAG AA (3,15:1 sobre branco). Use a classe `.preco` para o preço, ou text-caqui-ink-900 / text-caqui-orange-600 sobre fundo escuro.',
        },
        {
          selector: 'TemplateElement[value.raw=/text-caqui-orange-/]',
          message:
            'Laranja como cor de texto reprova no WCAG AA (3,15:1 sobre branco). Use a classe `.preco` para o preço.',
        },
        {
          selector: 'JSXText[value=/[\u2014\u2013]/]',
          message:
            'Travessao e meia-risca nao entram em texto do site. Use ponto, dois-pontos ou virgula.',
        },
        {
          selector: 'Literal[value=/[\u2014\u2013]/]',
          message:
            'Travessao e meia-risca nao entram em texto do site. Use ponto, dois-pontos ou virgula.',
        },
      ],
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Código gerado pelo Prisma: não é nosso, não passa por lint.
    'src/generated/**',
  ]),
])

export default eslintConfig
