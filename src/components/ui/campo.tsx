'use client'

import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
  useState,
} from 'react'

import { CLASSES_COM_ERRO, CLASSES_CONTROLE } from '@/components/ui/estilos-de-campo'
import { cn } from '@/lib/ui/cn'

/**
 * Campos de formulário.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O SELECT É O `<select>` NATIVO. DE PROPÓSITO.
 * ────────────────────────────────────────────────────────────────────────────
 * Um listbox desenhado à mão custa ~250 linhas — `aria-activedescendant`,
 * typeahead, Home/End/Escape, gerenciamento de foco, fechar no clique de fora,
 * rolagem para a opção ativa — e é o componente que mais quebra acessibilidade
 * em projeto real, porque cada um desses detalhes falha em silêncio.
 *
 * Em troca, ele dá controle sobre a aparência da LISTA ABERTA. Que é
 * exatamente a parte que ninguém vê no celular: iOS e Android substituem por
 * um seletor nativo de rolagem de qualquer jeito. E o CRM da Caqui é operado
 * do celular.
 *
 * Então: `appearance: none` no gatilho, para ele combinar com o Input, e o
 * comportamento nativo intacto. Se algum dia surgir um caso que o nativo não
 * atenda — busca dentro da lista, opção com duas linhas —, aí sim vale o
 * custo, e só naquele caso.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ERRO NÃO É SÓ A BORDA VERMELHA
 * ────────────────────────────────────────────────────────────────────────────
 * A borda muda de cor, e junto vem um ícone e um texto ligado por
 * `aria-describedby`, com `role="alert"`. Borda vermelha sozinha não existe
 * para quem tem daltonismo nem para quem usa leitor de tela.
 */

// As classes moram em `estilos-de-campo.ts`, um módulo sem `'use client'`.
// Ver o comentário de lá: os filtros da agenda precisam delas SEM arrastar
// este arquivo — e este arquivo é de cliente por causa do `useId`.
const CONTROLE = CLASSES_CONTROLE
const COM_ERRO = CLASSES_COM_ERRO

type CampoBaseProps = {
  rotulo: string
  /** Texto de apoio. Aparece antes do erro e some quando há erro. */
  dica?: string
  erro?: string
  obrigatorio?: boolean
  className?: string
}

function Envelope({
  id,
  rotulo,
  dica,
  erro,
  obrigatorio,
  className,
  children,
}: CampoBaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-caqui-ink-900 text-rotulo font-mono uppercase">
        {rotulo}
        {obrigatorio && (
          <>
            <span className="text-caqui-danger ml-1" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
      </label>

      {children}

      {dica && !erro && (
        <p id={`${id}-dica`} className="text-caqui-ink-500 text-corpo-sm">
          {dica}
        </p>
      )}

      {erro && (
        <p
          id={`${id}-erro`}
          role="alert"
          className="text-caqui-danger text-corpo-sm flex items-start gap-1.5"
        >
          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
            <path
              d="M8 1.5 15 14H1L8 1.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M8 6v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
            <circle cx="8" cy="11.75" r="0.85" fill="currentColor" />
          </svg>
          {erro}
        </p>
      )}
    </div>
  )
}

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & CampoBaseProps

export function Input({ rotulo, dica, erro, obrigatorio, className, ...props }: InputProps) {
  const gerado = useId()
  const id = props.id ?? gerado

  return (
    <Envelope
      id={id}
      rotulo={rotulo}
      dica={dica}
      erro={erro}
      obrigatorio={obrigatorio}
      className={className}
    >
      <input
        {...props}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
        required={obrigatorio}
        className={cn(CONTROLE, erro && COM_ERRO)}
      />
    </Envelope>
  )
}

/**
 * Campo de senha com olho.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MOSTRAR A SENHA É MEDIDA DE SEGURANÇA, NÃO O CONTRÁRIO
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo é achar que esconder sempre é mais seguro. Na prática, quem digita
 * às cegas erra, erra de novo, e a saída é escolher uma senha curta e fácil, ou
 * deixar colada num papel. Pior: aqui a Caqui entra pelo CELULAR, teclado de
 * vidro, muitas vezes em pé no meio da rua, e três erros seguidos disparam o
 * bloqueio de conta que o `auth-service` aplica de propósito.
 *
 * O risco real de alguém lendo por cima do ombro é escolha de quem está lá, e
 * por isso o padrão continua sendo oculto: o olho é opt-in, um toque, e volta a
 * esconder no toque seguinte.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE FAZ ISTO SER ACESSÍVEL, E NÃO SÓ UM ÍCONE BONITO
 * ────────────────────────────────────────────────────────────────────────────
 *  - É `<button type="button">`. Sem o `type`, dentro de um `<form>` ele vira
 *    submit e o clique no olho tentaria fazer login.
 *  - `aria-pressed` informa o estado a quem usa leitor de tela; o nome do botão
 *    diz a AÇÃO ("Mostrar senha"), não o estado, que é o que o `aria-pressed`
 *    já carrega.
 *  - O alvo tem 44px, como todo alvo do projeto.
 *  - O ícone é `aria-hidden`: quem lê a tela ouve o nome do botão, e ouvir
 *    "olho" no meio não ajuda ninguém.
 *  - O campo mantém `autocomplete`, então o gerenciador de senhas continua
 *    preenchendo normalmente nos dois estados.
 */
export function InputSenha({
  rotulo,
  dica,
  erro,
  obrigatorio,
  className,
  ...props
}: Omit<InputProps, 'type'>) {
  const gerado = useId()
  const id = props.id ?? gerado
  const [visivel, setVisivel] = useState(false)

  return (
    <Envelope
      id={id}
      rotulo={rotulo}
      dica={dica}
      erro={erro}
      obrigatorio={obrigatorio}
      className={className}
    >
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visivel ? 'text' : 'password'}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
          required={obrigatorio}
          className={cn(CONTROLE, 'pr-12', erro && COM_ERRO)}
        />

        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          aria-controls={id}
          className={cn(
            'absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2',
            'text-caqui-ink-700 hover:text-caqui-ink-900 items-center justify-center',
            'rounded-xs transition-colors',
          )}
        >
          <OlhoIcone aberto={visivel} />
          <span className="sr-only">{visivel ? 'Ocultar senha' : 'Mostrar senha'}</span>
        </button>
      </div>
    </Envelope>
  )
}

/**
 * O olho.
 *
 * Fechado, ele ganha uma BARRA cruzando, e não só uma pálpebra abaixada: a
 * barra é o sinal universal de "desligado" e sobrevive a 16px, que é o tamanho
 * em que a diferença entre uma pálpebra e um olho aberto desaparece.
 */
function OlhoIcone({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M1.5 10S4.9 4.5 10 4.5 18.5 10 18.5 10 15.1 15.5 10 15.5 1.5 10 1.5 10Z" />
        <circle cx="10" cy="10" r="2.6" />
        {!aberto && <path d="M3.5 16.5 16.5 3.5" strokeWidth="1.8" />}
      </g>
    </svg>
  )
}

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> &
  CampoBaseProps

export function Textarea({ rotulo, dica, erro, obrigatorio, className, ...props }: TextareaProps) {
  const gerado = useId()
  const id = props.id ?? gerado

  return (
    <Envelope
      id={id}
      rotulo={rotulo}
      dica={dica}
      erro={erro}
      obrigatorio={obrigatorio}
      className={className}
    >
      <textarea
        rows={4}
        {...props}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
        required={obrigatorio}
        className={cn(CONTROLE, 'resize-y', erro && COM_ERRO)}
      />
    </Envelope>
  )
}

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> &
  CampoBaseProps & {
    opcoes: { valor: string; rotulo: string; desabilitada?: boolean }[]
    /** Primeira opção vazia. Omita quando já houver valor padrão. */
    placeholder?: string
  }

export function Select({
  rotulo,
  dica,
  erro,
  obrigatorio,
  opcoes,
  placeholder,
  className,
  ...props
}: SelectProps) {
  const gerado = useId()
  const id = props.id ?? gerado

  return (
    <Envelope
      id={id}
      rotulo={rotulo}
      dica={dica}
      erro={erro}
      obrigatorio={obrigatorio}
      className={className}
    >
      <div className="relative">
        <select
          {...props}
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
          required={obrigatorio}
          className={cn(CONTROLE, 'cursor-pointer appearance-none pr-10', erro && COM_ERRO)}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.desabilitada}>
              {o.rotulo}
            </option>
          ))}
        </select>

        {/* `pointer-events-none` para o clique atravessar e abrir a lista nativa. */}
        <svg
          viewBox="0 0 12 8"
          className="text-caqui-ink-900 pointer-events-none absolute top-1/2 right-3.5 w-3 -translate-y-1/2"
          aria-hidden="true"
        >
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
    </Envelope>
  )
}

/**
 * Caixa de marcação.
 *
 * O quadrado desenhado é um `<span>`, mas o `<input>` real continua no DOM,
 * apenas visualmente escondido com `appearance:none` e tamanho zero seria
 * errado — aqui ele fica sobreposto e transparente, então o clique, o foco e
 * o `:checked` nativos continuam valendo.
 */
export function Checkbox({
  rotulo,
  descricao,
  erro,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
  rotulo: ReactNode
  descricao?: string
  erro?: string
  className?: string
}) {
  const gerado = useId()
  const id = props.id ?? gerado

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-start gap-2.5">
        <span className="relative mt-0.5 inline-flex size-5 shrink-0">
          <input
            {...props}
            type="checkbox"
            id={id}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? `${id}-erro` : undefined}
            className={cn(
              'peer size-5 cursor-pointer appearance-none',
              'border-caqui-ink-900 rounded-xs border bg-white',
              'checked:bg-caqui-orange-500',
              'disabled:border-caqui-rule disabled:bg-caqui-sand-100 disabled:cursor-not-allowed',
              erro && 'border-caqui-danger border-2',
            )}
          />
          <svg
            viewBox="0 0 16 16"
            className="text-caqui-ink-900 pointer-events-none absolute inset-0 hidden size-5 p-0.5 peer-checked:block"
            aria-hidden="true"
          >
            <path
              d="M3 8.5 6.5 12 13 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="square"
            />
          </svg>
        </span>

        <label htmlFor={id} className="text-caqui-ink-700 text-corpo-sm cursor-pointer">
          {rotulo}
          {descricao && <span className="text-caqui-ink-500 mt-0.5 block">{descricao}</span>}
        </label>
      </div>

      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-caqui-danger text-corpo-sm">
          {erro}
        </p>
      )}
    </div>
  )
}
