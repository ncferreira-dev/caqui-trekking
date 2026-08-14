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
