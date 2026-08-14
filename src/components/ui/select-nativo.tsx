import { CLASSES_CONTROLE, CLASSES_ROTULO } from '@/components/ui/estilos-de-campo'
import { cn } from '@/lib/ui/cn'

/**
 * O mesmo `<select>` do design system, sem hook nenhum — logo, sem
 * `'use client'`, logo, sem um byte no bundle.
 *
 * `campo.tsx` usa `useId` para casar `<label for>` com `<select id>` quando o
 * id não é informado, e isso o torna um módulo de cliente. Aqui o id é
 * OBRIGATÓRIO e vem de quem chama, porque neste caso ele já existe: o campo
 * tem `name`, e o `name` de um filtro em query string é único na página por
 * definição.
 *
 * É a mesma aparência, a mesma marcação, o mesmo comportamento nativo — só sem
 * o custo que o `useId` cobraria numa página que não precisa de interatividade
 * nenhuma.
 */
export function SelectNativo({
  id,
  name,
  rotulo,
  opcoes,
  defaultValue,
  className,
}: {
  id: string
  name: string
  rotulo: string
  opcoes: { valor: string; rotulo: string }[]
  defaultValue?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={CLASSES_ROTULO}>
        {rotulo}
      </label>

      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={defaultValue}
          className={cn(CLASSES_CONTROLE, 'cursor-pointer appearance-none pr-10')}
        >
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
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
    </div>
  )
}
