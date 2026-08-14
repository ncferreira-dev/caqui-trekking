import { serializarJsonLd, type JsonLd } from '@/lib/seo/json-ld'

/**
 * Injeta um bloco de dados estruturados.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `dangerouslySetInnerHTML` É OBRIGATÓRIO AQUI, E É SEGURO POR CAUSA DO ESCAPE
 * ────────────────────────────────────────────────────────────────────────────
 * O nome é assustador, mas a alternativa é pior: se o JSON entrasse como filho
 * de texto (`<script>{json}</script>`), o React escaparia as aspas e as chaves,
 * e o resultado deixaria de ser JSON válido — o Google leria lixo e ignoraria o
 * bloco inteiro. Então o conteúdo precisa entrar cru.
 *
 * O que torna isso seguro NÃO é o React, é `serializarJsonLd`: ele troca `<`,
 * `>` e `&` pelos escapes unicode ANTES de o texto chegar aqui, então não
 * existe mais a sequência `</script>` que um valor vindo do CRM poderia usar
 * para fechar a tag e injetar HTML. Ver o comentário longo em `lib/seo/json-ld`.
 *
 * É um Server Component: o script sai no HTML do servidor, que é onde o
 * rastreador do Google o lê. Renderizá-lo no cliente o esconderia de boa parte
 * dos rastreadores, que não executam JavaScript.
 */
export function JsonLdScript({ dados }: { dados: JsonLd | JsonLd[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializarJsonLd(dados) }}
    />
  )
}
