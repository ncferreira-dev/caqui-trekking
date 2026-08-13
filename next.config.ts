import path from 'node:path'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Sem isto, o Turbopack sobe a árvore procurando a raiz do workspace, acha um
  // package-lock.json solto em ~/ e avisa que ignorou o lockfile. Fixar a raiz
  // no diretório do projeto torna o build reprodutível e cala o aviso pela
  // causa certa, em vez de silenciá-lo.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },

  typescript: {
    // Build falha se o TypeScript falhar. É o padrão do Next; declarado aqui
    // para deixar explícito que NÃO se deve trocar por `ignoreBuildErrors`.
    ignoreBuildErrors: false,
  },

  // Nota: o Next 16 removeu a integração `next lint` e a chave `eslint` do
  // NextConfig. O lint roda pelo `npm run check`, não pelo build.
}

export default nextConfig
