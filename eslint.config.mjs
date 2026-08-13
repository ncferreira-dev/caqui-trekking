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
