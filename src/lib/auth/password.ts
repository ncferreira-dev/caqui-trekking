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
 * O hash de mentira, derivado UMA vez no carregamento do módulo.
 *
 * ⚠️ NÃO volte a escrever este valor à mão.
 *
 * Até 18/08/2026 ele era um literal de zeros, e o literal tinha 59 caracteres.
 * Um hash bcrypt tem exatamente 60. O `bcryptjs` confere o comprimento antes de
 * derivar qualquer coisa e devolve `false` na hora.
 *
 * Medido nesta máquina: a comparação contra aquele literal levava 0,00 ms; a
 * comparação contra um hash real de custo 12 leva ~270 ms. A função existia
 * para eliminar essa diferença e produzia uma diferença de cinco ordens de
 * grandeza — ou seja, ela era o oráculo, não a defesa.
 *
 * Derivado, o valor não pode estar com o comprimento errado. É a diferença
 * entre uma constante que alguém precisa acertar e uma que o computador acerta.
 */
const HASH_FALSO = bcrypt.hashSync('nao-importa-o-que-tem-aqui', CUSTO)

/**
 * Gasta o tempo de um hash sem ter um usuário para comparar.
 *
 * Sem isto, o login responde visivelmente mais rápido para e-mail inexistente
 * do que para e-mail válido com senha errada, e isso é um oráculo: dá para
 * enumerar quais e-mails têm conta só cronometrando a resposta. O e-mail
 * comercial da Caqui é público, no rodapé do site.
 */
export async function queimarTempoDeHash(): Promise<void> {
  await bcrypt.compare('senha-que-nao-importa', HASH_FALSO)
}
