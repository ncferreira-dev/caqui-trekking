import { describe, expect, it } from 'vitest'

import { _envSchema } from '@/lib/env'

/**
 * STRING VAZIA NUMA VARIÁVEL OPCIONAL SIGNIFICA AUSENTE.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO, ENCONTRADO EM 21/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * O `.env.example` entrega as três do Cloudinary como `""`. O schema pedia
 * `min(1)`, e string vazia não é ausente: é presente e curta demais. Resultado,
 * copiar o `.env.example` como o próprio arquivo manda derrubava a aplicação
 * INTEIRA no boot — inclusive o site público, que não usa upload nenhum.
 *
 * O sintoma não parecia isso. A tela do CRM ficava na sobreposição de erro do
 * Next e a pessoa dizia, com razão, "travou".
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE NÃO PODE AFROUXAR JUNTO
 * ════════════════════════════════════════════════════════════════════════════
 * A regra do topo de `env.ts` é que nenhuma variável tem fallback: faltou, o
 * processo não sobe. O tratamento de vazio vale SÓ para as opcionais. O último
 * bloco abaixo é o que impede alguém de estender o `vazio()` para uma
 * obrigatória e ressuscitar o `JWT_SECRET || 'production'` do projeto de
 * referência.
 */

const BASE = {
  DATABASE_URL: 'postgresql://u:s@localhost:5432/caqui',
  NODE_ENV: 'test',
  NEXT_PUBLIC_SITE_URL: 'https://exemplo.com',
  AUTH_SECRET: 'x'.repeat(32),
}

describe('Cloudinary vazio é ausente, não inválido', () => {
  it('as três em branco sobem, e ficam indefinidas', () => {
    const r = _envSchema.safeParse({
      ...BASE,
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
    })

    expect(r.success).toBe(true)
    expect(r.data?.CLOUDINARY_CLOUD_NAME).toBeUndefined()
    expect(r.data?.CLOUDINARY_API_SECRET).toBeUndefined()
  })

  it('só espaço em branco também conta como vazio', () => {
    const r = _envSchema.safeParse({ ...BASE, CLOUDINARY_CLOUD_NAME: '   ' })
    expect(r.success).toBe(true)
    expect(r.data?.CLOUDINARY_CLOUD_NAME).toBeUndefined()
  })

  it('ausentes de vez continuam subindo', () => {
    expect(_envSchema.safeParse(BASE).success).toBe(true)
  })

  it('as três preenchidas atravessam intactas', () => {
    const r = _envSchema.safeParse({
      ...BASE,
      CLOUDINARY_CLOUD_NAME: 'nuvem',
      CLOUDINARY_API_KEY: 'chave',
      CLOUDINARY_API_SECRET: 'segredo',
    })

    expect(r.success).toBe(true)
    expect(r.data?.CLOUDINARY_CLOUD_NAME).toBe('nuvem')
  })
})

describe('configuração pela metade continua sendo recusada', () => {
  it('duas preenchidas e uma em branco NÃO sobe', () => {
    // O pior dos três estados: parece configurado e só falha quando alguém
    // tenta subir uma foto. Vazio virar "ausente" não pode engolir isto.
    const r = _envSchema.safeParse({
      ...BASE,
      CLOUDINARY_CLOUD_NAME: 'nuvem',
      CLOUDINARY_API_KEY: 'chave',
      CLOUDINARY_API_SECRET: '',
    })

    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toContain('CLOUDINARY_API_SECRET')
  })
})

describe('as obrigatórias NÃO ganharam tolerância', () => {
  it('DATABASE_URL vazia derruba o boot', () => {
    // A regra do topo de `env.ts`. Se este teste passar a falhar, alguém
    // estendeu o `vazio()` para uma obrigatória, e o próximo deploy sem banco
    // vai subir calado.
    expect(_envSchema.safeParse({ ...BASE, DATABASE_URL: '' }).success).toBe(false)
  })

  it('AUTH_SECRET vazio derruba o boot', () => {
    expect(_envSchema.safeParse({ ...BASE, AUTH_SECRET: '' }).success).toBe(false)
  })

  it('AUTH_SECRET curto derruba o boot', () => {
    expect(_envSchema.safeParse({ ...BASE, AUTH_SECRET: 'curto' }).success).toBe(false)
  })
})
