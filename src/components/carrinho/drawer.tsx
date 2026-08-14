'use client'

import { ConteudoDaMochila } from '@/components/carrinho/conteudo'
import { useMochila } from '@/components/carrinho/contexto'
import { Drawer } from '@/components/ui/dialogo'

/**
 * A mochila em painel lateral.
 *
 * Existe para não tirar a pessoa de onde ela está. Depois de adicionar uma
 * vaga na página da expedição, ir para `/carrinho` significa perder a página —
 * e voltar para escolher a segunda data vira um "voltar" no navegador.
 *
 * A página `/carrinho` continua existindo, e é ela que tem URL: é o que
 * permite compartilhar, recarregar e chegar de fora. O drawer é o atalho.
 *
 * Todo o comportamento de diálogo — armadilha de foco, Escape, camada
 * superior, trava de rolagem — vem de `ui/dialogo.tsx`, que envolve o
 * `<dialog>` nativo.
 */
export function DrawerDaMochila() {
  const { aberta, fechar } = useMochila()

  return (
    <Drawer aberto={aberta} aoFechar={fechar} titulo="Sua mochila">
      <ConteudoDaMochila compacta />
    </Drawer>
  )
}
