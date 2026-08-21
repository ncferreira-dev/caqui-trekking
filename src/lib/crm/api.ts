'use client'

/**
 * O cliente do painel para `/api/admin/*`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELE RAMIFICA PELO `code`, NUNCA PELA `message`
 * ────────────────────────────────────────────────────────────────────────────
 * O envelope de erro é `{ error: { code, message } }`. O `code` é o contrato —
 * estável, em SCREAMING_SNAKE. A `message` é para humano e pode mudar a
 * qualquer momento, inclusive de idioma.
 *
 * No projeto de referência o front lia `err.response.data.message` e comparava
 * com string. Bastava alguém melhorar a redação de uma mensagem para o
 * tratamento de erro parar de funcionar em silêncio.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 401 MANDA PARA O LOGIN. 403 NÃO.
 * ────────────────────────────────────────────────────────────────────────────
 * São coisas diferentes e o painel precisa reagir diferente: 401 é "não sei
 * quem você é" — a sessão caiu, e insistir não adianta. 403 é "sei quem você é
 * e você não pode" — deslogar seria absurdo, e a pessoa só precisa saber que
 * aquela ação não é dela.
 *
 * No projeto de referência os dois eram 403, e por isso o front não conseguia
 * distinguir sessão expirada de falta de permissão.
 */

export type DetalheDeErro = { campo: string; mensagem: string }

export class ErroDaApi extends Error {
  readonly code: string
  readonly status: number
  /** Os campos que o servidor recusou, quando ele disse quais. */
  readonly detalhes: DetalheDeErro[]

  constructor(code: string, message: string, status: number, detalhes: DetalheDeErro[] = []) {
    super(message)
    this.name = 'ErroDaApi'
    this.code = code
    this.status = status
    this.detalhes = detalhes
  }

  /** Sessão caiu. Quem chama deve mandar para o login. */
  get sessaoExpirada(): boolean {
    return this.status === 401
  }

  /** Autenticado, mas sem permissão. Deslogar seria errado. */
  get semPermissao(): boolean {
    return this.status === 403
  }
}

type Envelope<T> = { data: T }
export type EnvelopeErro = {
  error?: {
    code?: string
    message?: string
    details?: { field?: string; message?: string }[]
  }
}

/** Quantos campos entram na mensagem antes de ela virar um muro de texto. */
const TETO_DE_CAMPOS = 3

/**
 * A frase que a Caqui lê quando uma requisição é recusada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * "DADOS INVÁLIDOS." SOZINHO É UM BECO SEM SAÍDA, E ELE ESCONDEU UM DEFEITO
 * ────────────────────────────────────────────────────────────────────────────
 * A API sempre devolveu `details: [{ field, message }]` em erro de validação.
 * O cliente lia só `message` e jogava o resto fora, então toda recusa chegava
 * na tela como "Dados inválidos." — sem dizer qual campo, e sem nada a fazer
 * além de tentar de novo igual.
 *
 * O custo, medido em 18/08/2026: o POST de saída recusava `meetingPoint: null`
 * por um `.nullable()` que faltava no schema. Ou seja, "+ Nova saída" não
 * funcionava com os campos opcionais em branco, que é a operação normal. Na
 * tela isso apareceu como "Dados inválidos.", e ficou assim até alguém ler o
 * corpo da resposta na mão.
 *
 * O conserto do schema fecha AQUELE caso. Isto aqui fecha a classe: qualquer
 * divergência futura entre formulário e schema passa a se anunciar com o nome
 * do campo, na tela de quem está tentando salvar. É pura de propósito, para
 * ser testável sem subir servidor nem fingir `fetch`.
 */
export function mensagemDeErro(corpo: EnvelopeErro | null, status: number): string {
  const base = corpo?.error?.message ?? `Falha inesperada (${status}).`

  const campos = (corpo?.error?.details ?? [])
    .map((d) => {
      const campo = (d.field ?? '').trim()
      const mensagem = (d.message ?? '').trim()
      if (!campo || campo === '(raiz)') return mensagem
      return mensagem ? `${campo}: ${mensagem}` : campo
    })
    .filter((linha) => linha !== '')

  if (campos.length === 0) return base

  const mostrados = campos.slice(0, TETO_DE_CAMPOS).join(' · ')
  const resto = campos.length - TETO_DE_CAMPOS
  return resto > 0 ? `${base} ${mostrados} e mais ${resto}.` : `${base} ${mostrados}`
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response

  try {
    resposta = await fetch(caminho, {
      ...init,
      headers: {
        // `FormData` fica DE FORA de propósito. Quem monta multipart é o
        // navegador, e ele precisa escrever o próprio `boundary` no
        // cabeçalho. Declarar `application/json` aqui faria o servidor
        // receber bytes de multipart anunciados como JSON, e o erro sairia
        // como "envio inválido" sem dizer por quê.
        ...(init?.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init?.headers,
      },
    })
  } catch {
    // Rede fora. A distinção importa: "sem conexão" é acionável (esperar,
    // tentar de novo) e "erro do servidor" não é.
    throw new ErroDaApi('OFFLINE', 'Sem conexão com o servidor. Tente de novo.', 0)
  }

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as EnvelopeErro | null

    throw new ErroDaApi(
      corpo?.error?.code ?? 'UNKNOWN',
      // A mensagem do servidor é exibida porque estas rotas são
      // administrativas: quem lê é a Caqui, e "Já existe uma saída deste
      // roteiro nesta data" é exatamente o que ela precisa saber. Na API
      // pública a regra é a oposta — ver a tela de erro da loja.
      mensagemDeErro(corpo, resposta.status),
      resposta.status,
      (corpo?.error?.details ?? []).map((d) => ({
        campo: d.field ?? '',
        mensagem: d.message ?? '',
      })),
    )
  }

  const corpo = (await resposta.json()) as Envelope<T>
  return corpo.data
}

export const api = {
  get: <T>(caminho: string) => chamar<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) =>
    chamar<T>(caminho, { method: 'POST', body: JSON.stringify(corpo ?? {}) }),
  patch: <T>(caminho: string, corpo: unknown) =>
    chamar<T>(caminho, { method: 'PATCH', body: JSON.stringify(corpo) }),
  put: <T>(caminho: string, corpo: unknown) =>
    chamar<T>(caminho, { method: 'PUT', body: JSON.stringify(corpo) }),
  delete: <T>(caminho: string) => chamar<T>(caminho, { method: 'DELETE' }),

  /**
   * Envio de arquivo, pelo MESMO caminho de erro dos outros verbos.
   *
   * Existe para o upload de foto não precisar de um `fetch` solto, que teria
   * o próprio jeito de ler o envelope de erro e divergiria na primeira
   * mudança. O que muda é só o corpo: `FormData` em vez de JSON.
   */
  enviar: <T>(caminho: string, formulario: FormData) =>
    chamar<T>(caminho, { method: 'POST', body: formulario }),
}
