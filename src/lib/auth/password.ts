import bcrypt from 'bcryptjs'

/**
 * Hash e verificação de senha.
 *
 * Custo 12. O padrão da biblioteca é 10, fraco demais para uma credencial que
 * abre o CRM inteiro — e no projeto de referência não havia hash nenhum: o
 * login era `username === process.env.ADMINLOGIN && password ===
 * process.env.ADMINPASSWORD`, comparação de string em texto puro, com o
 * `bcrypt` declarado no package.json e nunca importado.
 */
const CUSTO = 12

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO)
}

/**
 * Verifica a senha.
 *
 * `bcrypt.compare` já é resistente a timing attack. Quando o usuário não
 * existe, o chamador deve gastar o mesmo tempo mesmo assim — ver
 * `queimarTempoDeHash`.
 */
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

/**
 * Gasta o tempo de um hash sem ter um usuário para comparar.
 *
 * Sem isto, o login responde visivelmente mais rápido para e-mail inexistente
 * do que para e-mail válido com senha errada — e isso é um oráculo: dá para
 * enumerar quais e-mails têm conta só cronometrando a resposta.
 */
export async function queimarTempoDeHash(): Promise<void> {
  await bcrypt.compare(
    'senha-que-nao-importa',
    '$2b$12$0000000000000000000000000000000000000000000000000000',
  )
}
