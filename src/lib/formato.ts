/**
 * Formatação de dados de contato.
 *
 * O número vive no banco em formato E.164 sem o `+` (`5511943017232`), porque
 * é assim que a API do WhatsApp o quer. Exibir isso cru seria hostil, e
 * guardar as duas formas convidaria a divergirem. Então: uma fonte, e a
 * apresentação derivada dela.
 */

/** `5511943017232` → `(11) 94301-7232`. Devolve o original se não reconhecer. */
export function telefoneBR(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  const semPais = digitos.startsWith('55') ? digitos.slice(2) : digitos

  if (semPais.length === 11) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`
  }
  if (semPais.length === 10) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 6)}-${semPais.slice(6)}`
  }

  return numero
}

/**
 * Link do WhatsApp.
 *
 * `wa.me` e não `api.whatsapp.com`: o primeiro abre o app instalado no celular
 * e cai na web no desktop, sem passar por uma tela intermediária.
 *
 * A mensagem passa por `encodeURIComponent`. No projeto de referência a URL
 * era montada com percent-encoding escrito À MÃO, o que quebrava com acento e
 * quebra de linha — e o texto do pedido da Caqui tem os dois.
 */
export function linkWhatsApp(numero: string, mensagem?: string): string {
  const digitos = numero.replace(/\D/g, '')
  const base = `https://wa.me/${digitos}`
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base
}

/** `@caquitrekking` → `https://instagram.com/caquitrekking`. */
export function linkInstagram(perfil: string): string {
  return `https://instagram.com/${perfil.replace(/^@/, '')}`
}

/** 270 → "4h30". Minutos são inteiros: sem float, sem `toFixed`. */
export function formatarDuracao(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto}min`
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`
}

const DIFICULDADES: Record<string, string> = {
  FACIL: 'Fácil',
  MODERADO: 'Moderado',
  DIFICIL: 'Difícil',
  EXTREMO: 'Extremo',
}

/** O enum do banco é em inglês sem acento; o que a pessoa lê, não. */
export function rotuloDificuldade(nivel: string): string {
  return DIFICULDADES[nivel] ?? nivel
}
