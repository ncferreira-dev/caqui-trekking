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

export class ErroDaApi extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ErroDaApi'
    this.code = code
    this.status = status
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
type EnvelopeErro = { error?: { code?: string; message?: string } }

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response

  try {
    resposta = await fetch(caminho, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
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
      corpo?.error?.message ?? `Falha inesperada (${resposta.status}).`,
      resposta.status,
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
}
