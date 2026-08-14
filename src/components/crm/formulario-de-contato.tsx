'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/campo'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'

/**
 * O formulário dos dados da empresa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * É O QUE SAI NO SITE COM O NOME DA CAQUI, E ELA MESMA EDITA
 * ────────────────────────────────────────────────────────────────────────────
 * Antes esta tela era só leitura, com um aviso dizendo "edição é pelo banco".
 * Trocar o número do WhatsApp ou o Cadastur exigia abrir o Prisma Studio, e
 * isso é o oposto do que o CRM promete. Agora salva por `PUT /api/admin/settings`,
 * que grava auditoria de quem mudou e o valor anterior — o mesmo caminho do
 * template.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O NÚMERO DO WHATSAPP É A ÚNICA ARMADILHA
 * ────────────────────────────────────────────────────────────────────────────
 * O servidor quer só dígitos, com DDI e DDD ("5511943017232"), porque é o
 * formato que a API do WhatsApp exige. Mas ninguém digita assim: a Caqui vai
 * colar "(11) 94301-7232". Então o campo aceita como ela escreve e a limpeza
 * para dígitos acontece no envio — e o DDI 55 é acrescentado se ela esqueceu,
 * porque esquecer o 55 é o erro que faz o link do WhatsApp abrir vazio.
 */

type CamposDeContato = {
  whatsappNumber: string
  email: string | null
  instagramTrekking: string | null
  instagramWear: string | null
  linktree: string | null
  cadasturNumber: string | null
  pesmCredentials: string | null
  heroTitle: string | null
  heroSubtitle: string | null
  aboutText: string | null
}

/** "(11) 94301-7232" → "5511943017232". Acrescenta o 55 se faltou. */
function normalizarWhatsapp(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return digitos
}

export function FormularioDeContato({ inicial }: { inicial: CamposDeContato }) {
  const router = useRouter()
  const { mostrar } = useToast()

  // O WhatsApp entra já formatado para leitura ("(11) 94301-7232"); a limpeza
  // para dígitos acontece só no envio. O resto entra como está no banco.
  const [campos, setCampos] = useState({
    ...inicial,
    whatsappNumber: formatarInicial(inicial.whatsappNumber),
  })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function set<K extends keyof CamposDeContato>(chave: K, valor: string) {
    setCampos((atual) => ({ ...atual, [chave]: valor }))
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)

    const whats = normalizarWhatsapp(campos.whatsappNumber)
    if (!/^\d{12,13}$/.test(whats)) {
      return setErro('O WhatsApp precisa do DDD e do número. Ex.: (11) 94301-7232.')
    }

    // Campo de texto vazio vira `null`, não string vazia: o site checa `?? '—'`
    // e um `""` passaria por "preenchido", mostrando um campo em branco no
    // rodapé em vez de esconder o que não existe. E o e-mail vazio como `""`
    // reprovaria na validação `.email()` do servidor.
    const limpar = (v: string | null) => (v && v.trim() !== '' ? v.trim() : null)

    const corpo = {
      whatsappNumber: whats,
      email: limpar(campos.email),
      instagramTrekking: limpar(campos.instagramTrekking),
      instagramWear: limpar(campos.instagramWear),
      linktree: limpar(campos.linktree),
      cadasturNumber: limpar(campos.cadasturNumber),
      pesmCredentials: limpar(campos.pesmCredentials),
      heroTitle: limpar(campos.heroTitle),
      heroSubtitle: limpar(campos.heroSubtitle),
      aboutText: limpar(campos.aboutText),
    }

    setEnviando(true)
    try {
      await api.put('/api/admin/settings', corpo)
      mostrar({ tom: 'sucesso', titulo: 'Salvo', descricao: 'O site já mostra os dados novos.' })
      router.refresh()
    } catch (causa) {
      setErro(
        causa instanceof ErroDaApi ? causa.message : 'Não foi possível salvar. Tente de novo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <section className="border-caqui-rule border bg-white">
        <div className="border-caqui-rule border-b px-4 py-2.5">
          <h2 className="font-display text-corpo-sm uppercase">Contato</h2>
        </div>
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <Input
            rotulo="WhatsApp"
            value={campos.whatsappNumber}
            onChange={(e) => set('whatsappNumber', e.target.value)}
            placeholder="(11) 94301-7232"
            dica="É o número que recebe os pedidos."
            obrigatorio
          />
          <Input
            rotulo="E-mail"
            type="email"
            value={campos.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            placeholder="contato@caquitrekking.com.br"
          />
          <Input
            rotulo="Instagram Trekking"
            value={campos.instagramTrekking ?? ''}
            onChange={(e) => set('instagramTrekking', e.target.value)}
            placeholder="caquitrekking"
            dica="Só o nome, sem @."
          />
          <Input
            rotulo="Instagram Wear"
            value={campos.instagramWear ?? ''}
            onChange={(e) => set('instagramWear', e.target.value)}
            placeholder="caqui.wear"
            dica="Só o nome, sem @."
          />
          <Input
            rotulo="Cadastur"
            value={campos.cadasturNumber ?? ''}
            onChange={(e) => set('cadasturNumber', e.target.value)}
            placeholder="00.000000.00.0000-0"
            dica="Registro no Ministério do Turismo."
          />
          <Input
            rotulo="PESM"
            value={campos.pesmCredentials ?? ''}
            onChange={(e) => set('pesmCredentials', e.target.value)}
            placeholder="Monitores credenciados PESM"
          />
          <Input
            rotulo="Linktree"
            className="sm:col-span-2"
            value={campos.linktree ?? ''}
            onChange={(e) => set('linktree', e.target.value)}
            placeholder="https://linktr.ee/caquitrekking"
          />
        </div>
      </section>

      <section className="border-caqui-rule border bg-white">
        <div className="border-caqui-rule border-b px-4 py-2.5">
          <h2 className="font-display text-corpo-sm uppercase">Textos do site</h2>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          <Input
            rotulo="Título do herói"
            value={campos.heroTitle ?? ''}
            onChange={(e) => set('heroTitle', e.target.value)}
            placeholder="Venha viver novas experiências"
            dica="A frase grande da página inicial."
          />
          <Input
            rotulo="Subtítulo do herói"
            value={campos.heroSubtitle ?? ''}
            onChange={(e) => set('heroSubtitle', e.target.value)}
            placeholder="Ecoturismo e aventura em Mogi das Cruzes e região"
          />
          <Textarea
            rotulo="Sobre a Caqui"
            value={campos.aboutText ?? ''}
            onChange={(e) => set('aboutText', e.target.value)}
            rows={5}
            dica="O texto da página Sobre."
          />
        </div>
      </section>

      {erro && (
        <p role="alert" className="border-caqui-danger text-corpo-sm border-l-4 px-3 py-2">
          {erro}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" carregando={enviando}>
          Salvar contato e textos
        </Button>
      </div>
    </form>
  )
}

/** Mostra o número guardado de forma legível no primeiro render. */
function formatarInicial(digitos: string): string {
  const d = digitos.replace(/\D/g, '')
  const semPais = d.startsWith('55') ? d.slice(2) : d
  if (semPais.length === 11) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`
  }
  return digitos
}
