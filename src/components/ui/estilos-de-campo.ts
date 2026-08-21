/**
 * As classes do controle de formulário, num módulo SEM `'use client'`.
 *
 * Existe por um motivo mecânico: `campo.tsx` é um módulo de cliente (usa
 * `useId`), e importar qualquer coisa de um módulo de cliente a partir de um
 * componente de servidor cria uma referência de cliente — mesmo que a coisa
 * importada seja uma string.
 *
 * O `<select>` dos filtros da agenda precisa das mesmas classes e não pode
 * arrastar bundle nenhum (ver `components/catalogo/filtros-agenda.tsx`).
 * Então a aparência mora aqui, onde os dois lados podem ler.
 */

export const CLASSES_CONTROLE = [
  'w-full min-h-11 px-3 py-2',
  'bg-white text-caqui-ink-900 font-sans text-corpo',
  'border border-caqui-ink-900 rounded-xs',
  'placeholder:text-caqui-ink-500',
  'transition-[border-color,box-shadow] duration-150',
  'disabled:bg-caqui-sand-100 disabled:text-caqui-ink-500 disabled:cursor-not-allowed',
  'disabled:border-caqui-rule',
].join(' ')

export const CLASSES_COM_ERRO = 'border-caqui-danger border-2'

/** O rótulo acima do controle. Mono espacejado, como toda etiqueta do site. */
export const CLASSES_ROTULO = 'text-caqui-ink-900 text-rotulo font-mono uppercase'

// ─────────────────────────────────────────────────────────────────────────────
// A VARIANTE DO CRM
// ─────────────────────────────────────────────────────────────────────────────
// Em 20/08/2026 o cadastro de peça foi refeito no molde do projeto de
// referência, a pedido do cliente: campo espaçoso, canto arredondado, rótulo em
// texto normal. O resto do painel continuou denso e com rótulo mono em
// caixa-alta, e o painel passou a ter duas caras.
//
// A convergência é do PAINEL, não do site. A vitrine — contato, newsletter,
// "avise-me" — continua com o controle denso, que é o do design system e casa
// com o resto da página pública. Trocar os dois de uma vez mudaria a cara do
// site sem ninguém ter pedido.
//
// Por isso são duas variantes, e não uma substituição. Quem escolhe é o
// contexto ligado no layout do painel, e não cada formulário — dez chamadas
// separadas divergiriam no primeiro campo que alguém esquecesse.
export const CLASSES_CONTROLE_CRM = [
  'w-full min-h-11 px-4 py-3',
  'bg-white text-caqui-ink-900 font-sans text-corpo',
  'border border-caqui-sand-200 rounded-lg',
  'placeholder:text-caqui-ink-500',
  'transition-colors duration-150',
  'focus:border-caqui-orange-500 focus:outline-none',
  'disabled:bg-caqui-sand-100 disabled:text-caqui-ink-500 disabled:cursor-not-allowed',
].join(' ')

/** Rótulo do painel: texto normal, não etiqueta mono. */
export const CLASSES_ROTULO_CRM = 'text-caqui-ink-700 text-sm font-medium'
