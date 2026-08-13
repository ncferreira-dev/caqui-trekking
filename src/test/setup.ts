import 'dotenv/config'

/**
 * Setup dos testes.
 *
 * Aponta para o banco de TESTE antes de qualquer módulo da aplicação ser
 * carregado — `src/lib/env.ts` lê `process.env` na avaliação do módulo, então
 * a troca precisa acontecer aqui, no setupFile, e não dentro do caso de teste.
 */
const urlTeste = process.env['TEST_DATABASE_URL']

if (!urlTeste) {
  // Deriva do banco de dev trocando o sufixo, para não exigir mais uma
  // variável no .env de quem só quer rodar `npm test`.
  const dev = process.env['DATABASE_URL']
  if (!dev) {
    throw new Error('DATABASE_URL não definida. Copie o .env.example para .env.')
  }
  process.env['DATABASE_URL'] = dev.replace(/caqui_trekking_dev/, 'caqui_trekking_test')
} else {
  process.env['DATABASE_URL'] = urlTeste
}

if (!process.env['DATABASE_URL']?.includes('_test')) {
  // Trava de segurança: se por qualquer motivo a URL não apontar para um banco
  // de teste, aborta. Os testes truncam tabelas — rodar isso contra o banco de
  // desenvolvimento (ou pior) seria destrutivo e silencioso.
  throw new Error(
    `Recusando rodar testes: DATABASE_URL não aponta para um banco de teste (${process.env['DATABASE_URL']}).`,
  )
}

// `NODE_ENV` é somente-leitura no tipo que o Next declara, então a atribuição
// passa por Object.assign em vez de um cast solto.
Object.assign(process.env, {
  NODE_ENV: process.env['NODE_ENV'] ?? 'test',
  NEXT_PUBLIC_SITE_URL: process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000',
})
