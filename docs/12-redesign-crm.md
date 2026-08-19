# 12 · Redesign do CRM — pedido guardado (18/08/2026)

> **Status: não implementado.** O cliente pediu para guardar e voltar depois,
> quando o front do site público estiver fechado. Este arquivo existe para que
> nada precise ser reconstruído de memória.

## O que foi pedido

Aplicar no painel administrativo (`/crm`) o design de um dashboard de terceiro,
entregue como snippet no formato de integração do **shadcn/ui**:

```tsx
// efferd-dashboard-2.tsx
import { AppShell } from '@/components/app-shell'
import { Dashboard } from '@/components/dashboard'

export function EfferdDashboard2() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  )
}
```

Dependências pedidas junto: `recharts`, `lucide-react`, `@radix-ui/react-avatar`,
`@radix-ui/react-separator`, `@radix-ui/react-collapsible`,
`@radix-ui/react-dropdown-menu`.

---

## ⚠️ O snippet está incompleto

`EfferdDashboard2` é **um invólucro de três linhas**. Ele importa dois
componentes que **não vieram**:

| Import                   | Existe no repo? |
| ------------------------ | --------------- |
| `@/components/app-shell` | não             |
| `@/components/dashboard` | não             |

`AppShell` e `Dashboard` é que contêm o design de verdade: a barra lateral, o
cabeçalho, os cartões de métrica, os gráficos, a tabela. Sem eles não há nada
para portar.

**Primeira coisa a pedir ao cliente quando este assunto voltar:** os arquivos
`app-shell.tsx` e `dashboard.tsx` (ou uma captura de tela do dashboard, se o que
ele quer é a aparência e não o código).

---

## Este projeto não é shadcn, e a diferença não é cosmética

| Item                       | Estado no projeto       |
| -------------------------- | ----------------------- |
| `components.json`          | não existe              |
| Radix                      | nenhum pacote instalado |
| `recharts`                 | não instalado           |
| `lucide-react`             | não instalado           |
| `class-variance-authority` | não instalado           |
| `tailwind-merge` / `clsx`  | não (há `lib/ui/cn.ts`) |

`src/components/ui/` existe, mas **não é a pasta do shadcn**: são 12 componentes
próprios (`abas`, `acordeao`, `badge`, `button`, `campo`, `card`, `dialogo`,
`esqueleto`, `select-nativo`, `toast`…), escritos contra o design system deste
repositório.

Rodar `npx shadcn init` aqui sobrescreveria `components.json`, `globals.css` e
possivelmente `button.tsx`. **Não rodar sem decidir isto antes.**

### Três regras do design system que o shadcn quebra de saída

Documentadas em `src/app/globals.css`, com medição:

1. **Não existe raio de pílula.** Nenhum `border-radius: 9999px` no projeto. É a
   regra que sozinha mais afasta do visual de template de SaaS.
2. **Profundidade é deslocamento sólido**, não sombra difusa
   (`--shadow-corte-1/2/3`). O shadcn usa sombra difusa em tudo.
3. **Não existe modo escuro por classe.** O shadcn traz `.dark` e um alternador.
   O CRM é claro; o site tem seções escuras por token (`palco-noite`), que é
   outra coisa.

Além disso, o ESLint recusa `text-caqui-orange-*` e travessão em copy — duas
travas que um componente de terceiro vai disparar.

---

## As perguntas que precisam de resposta antes de escrever código

1. **É a aparência ou o código?** Se for a aparência, o caminho barato é
   reconstruir o layout com os componentes que já existem, sem dependência nova.
   Se for o código, aí sim entra a conversa de Radix e shadcn.
2. **Quais telas?** São 7 páginas no CRM (`painel`, `saidas`, `roteiros`,
   `produtos`, `mensagens`, `config`, `login`). O dashboard cobre `painel`; o
   resto é formulário e tabela, onde o ganho é menor.
3. **`recharts` entra?** O `painel` hoje não tem gráfico. Se for entrar, vale
   confirmar que há dado suficiente para um gráfico dizer algo — a operação tem
   5 roteiros e 6 saídas.
4. **O CRM é operado do celular**, no meio da trilha (requisito escrito do
   projeto). Dashboard de desktop com barra lateral fixa precisa de resposta
   para isso.

---

## Caminho sugerido (a confirmar)

Reconstruir a **casca** (`AppShell`: barra lateral colapsável + cabeçalho) e o
**painel** com os componentes atuais, adotando do design de referência a
composição e a hierarquia, sem trazer Radix nem shadcn. Ganha-se o visual sem
abrir mão das travas nem somar ~6 dependências.

`lucide-react` é a única dependência da lista com custo baixo e ganho claro —
o CRM hoje desenha cada ícone à mão em `components/crm/icones.tsx`.
