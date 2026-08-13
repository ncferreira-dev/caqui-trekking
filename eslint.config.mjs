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
