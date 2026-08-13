import { env } from '@/lib/env'
import {
  _definirStorageDeTeste,
  type ArquivoParaEnvio,
  type MediaStorage,
  type ResultadoDeEnvio,
} from '@/server/media/storage'

/**
 * Dublê de storage, para os testes.
 *
 * NÃO é um segundo caminho de produção — ele se recusa a existir fora de
 * `NODE_ENV=test`. O projeto de referência tinha um caminho legado de upload
 * em disco convivendo com o provedor, servindo 14 arquivos de 2025 por uma
 * rota pública que ninguém revisava (docs/00-analise-dalia.md, seção 7.2).
 * A recusa abaixo é o que impede este arquivo de virar aquilo.
 *
 * Além de guardar bytes, ele REGISTRA cada chamada. É o que permite ao teste
 * afirmar coisas que nenhum assert sobre o banco alcança:
 *  - "o arquivo grande demais não gerou UM envio sequer"
 *  - "o delete chamou `remover` com exatamente este publicId"
 *  - "quando a segunda foto falhou, a primeira foi removida"
 */

export type ChamadaDeStorage =
  | { tipo: 'enviar'; publicId: string; mime: string; bytes: number }
  | { tipo: 'remover'; publicId: string }

class StorageDeMemoria implements MediaStorage {
  readonly nome = 'memoria'
  readonly objetos = new Map<string, { bytes: Buffer; mime: string }>()
  readonly chamadas: ChamadaDeStorage[] = []

  /** Faz o próximo `enviar` falhar. Para testar rollback. */
  falharNoProximoEnvio: Error | null = null
  /** Faz `remover` falhar. Para testar que o registro NÃO some do banco. */
  falharAoRemover: Error | null = null

  constructor() {
    if (env.NODE_ENV !== 'test') {
      throw new Error(
        'O storage de memória é dublê de teste e não roda fora de NODE_ENV=test. ' +
          'Em produção existe um caminho só: o Cloudinary.',
      )
    }
  }

  async enviar(arquivo: ArquivoParaEnvio): Promise<ResultadoDeEnvio> {
    this.chamadas.push({
      tipo: 'enviar',
      publicId: arquivo.publicId,
      mime: arquivo.mime,
      bytes: arquivo.bytes.byteLength,
    })

    if (this.falharNoProximoEnvio) {
      const erro = this.falharNoProximoEnvio
      this.falharNoProximoEnvio = null
      throw erro
    }

    this.objetos.set(arquivo.publicId, { bytes: arquivo.bytes, mime: arquivo.mime })

    // URL com o mesmo formato do provedor real, de propósito: assim os testes
    // de integração exercitam o construtor de variantes de verdade.
    return {
      url: `https://res.cloudinary.com/memoria/image/upload/v1/${arquivo.publicId}.jpg`,
      publicId: arquivo.publicId,
    }
  }

  async remover(publicId: string): Promise<void> {
    this.chamadas.push({ tipo: 'remover', publicId })
    if (this.falharAoRemover) throw this.falharAoRemover
    this.objetos.delete(publicId)
  }

  async listarPublicIds(prefixo: string): Promise<string[]> {
    return [...this.objetos.keys()].filter((id) => id.startsWith(prefixo))
  }

  limpar(): void {
    this.objetos.clear()
    this.chamadas.length = 0
    this.falharNoProximoEnvio = null
    this.falharAoRemover = null
  }

  enviosDe(publicId: string): number {
    return this.chamadas.filter((c) => c.tipo === 'enviar' && c.publicId === publicId).length
  }

  get envios(): ChamadaDeStorage[] {
    return this.chamadas.filter((c) => c.tipo === 'enviar')
  }

  get remocoes(): ChamadaDeStorage[] {
    return this.chamadas.filter((c) => c.tipo === 'remover')
  }
}

export const storageDeMemoria = new StorageDeMemoria()

// Registra-se na porta assim que o módulo é importado. O teste só precisa
// importar este arquivo.
_definirStorageDeTeste(storageDeMemoria)
