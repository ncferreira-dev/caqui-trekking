import { linkWhatsApp } from '@/lib/formato'
import { cn } from '@/lib/ui/cn'

/**
 * Botão flutuante de WhatsApp.
 *
 * É componente de SERVIDOR: um link, sem estado, sem JavaScript. O reflexo
 * seria fazer disso um widget cliente — não há motivo. Ele aparece no primeiro
 * paint, funciona antes da hidratação, e não custa um byte de bundle.
 *
 * Fica fora da árvore do CRM de propósito: o painel administrativo não é lugar
 * de atalho para o cliente final.
 *
 * `aria-label` explícito porque o conteúdo visível é um ícone. E `rel` com
 * `noopener` — `target="_blank"` sem ele dá à aba de destino acesso a
 * `window.opener`.
 */
export function WhatsAppFlutuante({ numero }: { numero: string }) {
  return (
    <a
      href={linkWhatsApp(numero)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Caqui Trekking no WhatsApp"
      className={cn(
        'fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6',
        'inline-flex size-14 items-center justify-center',
        'bg-caqui-forest-600 border-caqui-ink-900 rounded-full border text-white',
        'shadow-[var(--shadow-corte-2)]',
        'transition-transform duration-150 ease-[var(--ease-padrao)]',
        'hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-corte-3)]',
        'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        'focus-visible:ring-2 focus-visible:ring-white',
      )}
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
        <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2.1 22l5.34-1.4a9.83 9.83 0 0 0 4.6 1.17h.01c5.43 0 9.85-4.42 9.85-9.86A9.8 9.8 0 0 0 12.04 2Zm0 17.94h-.01c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.16.83.84-3.09-.2-.32a8.16 8.16 0 0 1-1.25-4.36c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.19-8.2 8.19Z" />
      </svg>
    </a>
  )
}
