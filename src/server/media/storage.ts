import { env } from '@/lib/env'
import { cloudinaryStorage } from '@/server/media/cloudinary'

/**
 * A porta de storage de mídia.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE UMA INTERFACE E NÃO CHAMAR O SDK DIRETO
 * ────────────────────────────────────────────────────────────────────────────
 * Não é para "poder trocar de provedor um dia" — essa justificativa quase
 * nunca se paga. É por dois motivos concretos:
 *
 *  1. **Os testes precisam provar o pipeline sem rede.** Validação de MIME,
 *     limite de tamanho, rollback quando o storage falha, apagar de verdade no
 *     delete: nada disso pode depender de credencial nem de conexão. O dublê
 *     de memória registra cada chamada, e é assim que o teste afirma
 *     "o arquivo grande demais foi recusado ANTES de qualquer envio".
 *  2. **Um único ponto de entrada e de saída do storage.** O vazamento eterno
 *     do projeto de referência (docs/00-analise-dalia.md, seção 7.6) existia
 *     porque `uploader` era chamado de um lugar e `destroy` de lugar nenhum.
 *     Com a porta, `grep 'remover('` responde a pergunta "o que apaga arquivo
 *     neste projeto?" em uma tela.
 *
 * IMPORTANTE: existe UM caminho de produção, o Cloudinary. O driver de memória
 * é dublê de teste e se RECUSA a rodar fora de `NODE_ENV=test`. Isso é
 * deliberado: o projeto de referência mantinha um caminho legado em disco
 * (`server/uploads/`, 14 JPGs de 2025) servido publicamente por uma rota que
 * ninguém revisava. Segundo caminho vivo é dívida, não flexibilidade.
 */

export type ArquivoParaEnvio = {
  bytes: Buffer
  /** Caminho no provedor, sem extensão. Ex.: `caqui/produto/12/a1b2c3`. */
  publicId: string
  mime: string
}

export type ResultadoDeEnvio = {
  /** URL canônica, SEM transformação. As variantes saem de `lib/media/urls`. */
  url: string
  publicId: string
}

export interface MediaStorage {
  readonly nome: string
  enviar(arquivo: ArquivoParaEnvio): Promise<ResultadoDeEnvio>
  /** Idempotente: apagar o que já não existe é sucesso, não erro. */
  remover(publicId: string): Promise<void>
  /** Usado pelo caçador de órfãos. */
  listarPublicIds(prefixo: string): Promise<string[]>
}

/** Raiz de tudo que este projeto sobe. Delimita a busca por órfãos. */
export const PASTA_RAIZ = 'caqui'

let storageDeTeste: MediaStorage | null = null

/** Registrado pelo dublê, no setup dos testes. Nunca em produção. */
export function _definirStorageDeTeste(storage: MediaStorage | null): void {
  storageDeTeste = storage
}

export function obterStorage(): MediaStorage {
  if (env.NODE_ENV === 'test') {
    if (!storageDeTeste) {
      throw new Error(
        'Nenhum storage de teste registrado. Importe `@/server/media/memoria` no arquivo de teste.',
      )
    }
    return storageDeTeste
  }

  return cloudinaryStorage()
}
