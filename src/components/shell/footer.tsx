import Link from 'next/link'

import { LogoFantasma } from '@/components/shell/logo-fantasma'
import { Newsletter } from '@/components/shell/newsletter'
import { LinkBotao } from '@/components/ui/button'
import { linkInstagram, linkWhatsApp, telefoneBR } from '@/lib/formato'
import type { SettingsDTO } from '@/server/services/institucional-service'

/**
 * O RODAPÉ, QUE É A ÚLTIMA CENA E NÃO UM DEPÓSITO DE LINKS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELE ESTAVA NUM PRETO DIFERENTE DO RESTO DO SITE
 * ════════════════════════════════════════════════════════════════════════════
 * Até 18/08/2026 este rodapé era `bg-caqui-ink-900` (#0D0D0D, preto neutro),
 * porque o site inteiro era claro e o rodapé era a única superfície escura que
 * existia. Depois do redesenho, TODAS as cenas escuras passaram a ser
 * `noite-900` (#0B1114, azulado, a hora azul antes do nascer do sol).
 *
 * Dois pretos quase iguais empilhados na mesma rolagem não leem como duas
 * decisões: leem como erro de renderização. E o defeito é pior justamente por
 * ser sutil, porque ninguém consegue apontar o que está errado.
 *
 * Agora ele é `palco-noite`, a mesma chapa do herói e da abertura de capítulo.
 *
 * ⚠️ Isso arrastou uma correção de CONTRASTE junto, e ela não é cosmética:
 * `rule-invertido` (branco a 20%) foi trocado por `rule-noite` (areia a 22%).
 * Branco frio sobre azul-escuro some; o filete estava lá e não dividia nada.
 * Ver os dois tokens em `globals.css`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A SERRA NÃO ENTRA AQUI, E ISSO É DE PROPÓSITO
 * ════════════════════════════════════════════════════════════════════════════
 * `<Serra>` tem parcimônia declarada no próprio arquivo: só herói e abertura de
 * capítulo, nunca as duas juntas. Toda página da loja já abre com ela. Repetir
 * o desenho no pé faria a marca aparecer duas vezes por rolagem, e o grafismo
 * que aparece sempre para de significar alguma coisa.
 *
 * O que amarra o rodapé ao resto é o RESTO do vocabulário: a superfície da
 * noite, o grão de papel, a linha topográfica, a tipografia de cartaz, o
 * numeral em mono e a faixa de dados com filete no topo. Tudo isso já é usado
 * em outro lugar do site, e nada disso é enfeite novo.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELE PASSOU A TER UMA SAÍDA
 * ════════════════════════════════════════════════════════════════════════════
 * A versão anterior não tinha nenhum botão. Quem chegava ao pé da página tinha
 * lido tudo e não clicado em nada, e a resposta do site era uma lista de links
 * de navegação em corpo 16.
 *
 * As duas frases de cartaz dizem exatamente o que os dois botões fazem, e é
 * essa correspondência que faz o bloco ser composição em vez de decoração. A
 * copy sai do que a página `/sobre` já fecha hoje ("escolha uma data na agenda,
 * ou monte a saída do seu jeito"), então não há promessa nova sendo feita aqui.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * NADA É FIXO NO CÓDIGO
 * ════════════════════════════════════════════════════════════════════════════
 * Componente de servidor: recebe as configurações já resolvidas pelo layout.
 * Número, Instagram, Cadastur e credencial do PESM saem do banco, editáveis no
 * CRM, e cada bloco SOME quando o dado não existe.
 *
 * No projeto de referência, trocar o número de WhatsApp exigia editar quatro
 * arquivos e publicar, e um deles guardava o número dentro de uma URL
 * percent-encoded escrita à mão. Um deles ia ser esquecido, e o esquecido
 * mandaria clientes para um número morto.
 */

const LINKS = [
  { href: '/trekking', rotulo: 'Expedições' },
  { href: '/agenda', rotulo: 'Agenda' },
  { href: '/guia-particular', rotulo: 'Guia particular' },
  { href: '/wear', rotulo: 'Caqui Wear' },
  { href: '/sobre', rotulo: 'Sobre nós' },
  { href: '/contato', rotulo: 'Contato' },
] as const

export function Footer({ settings }: { settings: SettingsDTO | null }) {
  return (
    <footer
      className="palco-noite relative isolate mt-auto overflow-hidden"
      style={{ '--serra-massa': 'var(--color-caqui-noite-900)' } as React.CSSProperties}
    >
      {/* O grão fica ATRÁS do conteúdo, e não por cima: `mix-blend-mode:
          overlay` mistura com o que já foi pintado abaixo dele, então daqui ele
          granula o fundo sem tocar na tipografia. É o mesmo empilhamento do
          herói e da abertura de capítulo. */}
      <div className="grao pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* ══ A CENA DE SAÍDA ══════════════════════════════════════════════ */}
      <section aria-labelledby="rodape-saida" className="relative isolate">
        {/* A textura fica SÓ neste bloco. Ela é horizontal e cita a curva de
            nível da carta topográfica (ver `linha-topografica` em globals.css).
            Estendida ao rodapé inteiro, viraria tela de mosquiteiro atrás de
            duas dezenas de linhas de texto pequeno. Aqui ela cobre a área da
            tipografia grande e para antes dos dados, o que dá ao bloco uma
            densidade decrescente de cima para baixo. */}
        <div
          className="linha-topografica pointer-events-none absolute inset-0 opacity-50"
          aria-hidden="true"
        />

        <div className="relative mx-auto w-full max-w-7xl px-5 pt-16 pb-14 sm:px-8 sm:pt-20 sm:pb-16">
          <p className="text-rotulo text-caqui-sand-400 font-mono uppercase">O próximo passo</p>

          {/* `display-l` e não `display-2xl`. A conta está no cabeçalho de
              `manifesto.tsx`: em Archivo Black caixa-alta, a escala de cartaz
              maior só permite ~13 caracteres por linha, e estas frases têm 17 e
              15. Além disso a maior tipografia do site é a do herói, uma vez.

              `block` em cada `<span>` porque aqui o lugar onde a linha termina
              É o ritmo: as duas frases correspondem, na ordem, aos dois botões
              logo abaixo. Deixar o navegador quebrar desfaria o par. */}
          <p id="rodape-saida" className="texto-cartaz text-display-l mt-5 text-white">
            <span className="block">Escolha uma data.</span>
            <span className="text-caqui-sand-400 block">Ou monte a sua.</span>
          </p>

          {/* No celular os dois ocupam a linha inteira, igual ao herói: com
              largura automática eles saem quase do mesmo tamanho, e dois blocos
              quase iguais leem como desalinho, não como hierarquia. */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <LinkBotao href="/agenda" tamanho="lg" className="w-full sm:w-auto">
              Ver a agenda
            </LinkBotao>
            <LinkBotao
              href="/guia-particular"
              tamanho="lg"
              variante="secondary"
              className="w-full sm:w-auto"
            >
              Montar uma saída
            </LinkBotao>
          </div>
        </div>
      </section>

      {/* ══ A LEGENDA DA CARTA ═══════════════════════════════════════════
          Navegação, contato e assinatura. Três colunas no desktop, duas em
          tablet, uma no celular. */}
      <div className="border-caqui-rule-noite relative border-t">
        <div className="mx-auto grid w-full max-w-7xl gap-x-10 gap-y-12 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1fr_1fr_22rem]">
          <nav aria-label="Rodapé">
            <h2 className="text-caqui-sand-400 text-rotulo font-mono uppercase">Navegar</h2>

            {/* Numerado, como o menu do celular e como o método em `/sobre`.
                O numeral é a única imagem que este projeto tem em lugar de
                fotografia, e repeti-lo é o que faz o site ter vocabulário. */}
            <ul className="mt-5 flex flex-col">
              {LINKS.map((link, indice) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="border-caqui-rule-noite group flex items-baseline gap-4 border-b py-3.5"
                  >
                    <span className="numeral text-micro text-caqui-sand-400 group-hover:text-caqui-realce-escuro shrink-0 transition-colors duration-200">
                      {String(indice + 1).padStart(2, '0')}
                    </span>
                    {/* O rótulo desliza e o numeral fica parado. É o gesto que
                        um índice impresso não pode ter e uma lista na tela
                        pode: a coluna de números continua alinhada, servindo de
                        régua, e só o item apontado se move.
                        `translate-x` e não `margin`: transformação é composição
                        pura, não refaz layout, e a linha inteira tem 6 irmãs
                        que não deveriam ser recalculadas por causa de um
                        ponteiro passando por cima. */}
                    <span className="text-corpo group-hover:text-caqui-realce-escuro text-white transition-[color,transform] duration-200 ease-[var(--ease-padrao)] group-hover:translate-x-1">
                      {link.rotulo}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-caqui-sand-400 text-rotulo font-mono uppercase">
              Falar com a gente
            </h2>

            {/* Lista de definição, e não uma linha de texto com uma etiqueta
                colada no fim. O rótulo em cima e o dado embaixo é a mesma forma
                da ficha do roteiro e das credenciais em `/sobre`. */}
            <dl className="mt-5 flex flex-col gap-5">
              {settings?.whatsappNumber && (
                <Contato
                  rotulo="WhatsApp"
                  href={linkWhatsApp(settings.whatsappNumber)}
                  externo
                  valor={telefoneBR(settings.whatsappNumber)}
                />
              )}
              {settings?.email && (
                <Contato rotulo="E-mail" href={`mailto:${settings.email}`} valor={settings.email} />
              )}
              {settings?.instagramTrekking && (
                <Contato
                  rotulo="Instagram Trekking"
                  href={linkInstagram(settings.instagramTrekking)}
                  externo
                  valor={settings.instagramTrekking}
                />
              )}
              {settings?.instagramWear && (
                <Contato
                  rotulo="Instagram Wear"
                  href={linkInstagram(settings.instagramWear)}
                  externo
                  valor={settings.instagramWear}
                />
              )}
            </dl>
          </div>

          {/* A coluna do formulário atravessa as duas do tablet: em `sm` o
              grid tem duas colunas e a newsletter cairia sozinha numa metade,
              com o campo espremido em ~280px ao lado de um vazio do mesmo
              tamanho. */}
          <div className="sm:col-span-2 sm:max-w-md lg:col-span-1 lg:max-w-none">
            {/* O texto do erro do campo vem em `danger` (#C1121F), que sobre a
                noite dá 3,05:1 e REPROVA no AA. Medido, não estimado, e o
                defeito já existia no rodapé preto (3,12:1). `danger-claro`
                existe para superfície escura e dá 6,36:1. Ver o token em
                `globals.css`. */}
            <Newsletter className="[&_label>span]:text-caqui-danger-claro [&_[role=alert]]:text-caqui-danger-claro" />
          </div>
        </div>
      </div>

      {/* ══ O COLOFÃO ════════════════════════════════════════════════════ */}
      <div className="border-caqui-rule-noite relative border-t">
        <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-8">
            <div className="flex items-center gap-5">
              {/* A MARCA DO RODAPÉ TAMBÉM ABRE O CRM.
                  Pedido do cliente em 18/08/2026: cinco toques aqui levam ao
                  painel, igual à marca do topo. É `LogoFantasma` e não `Brasao`
                  justamente para não existirem duas implementações do mesmo
                  gesto: a contagem é compartilhada pelo `sessionStorage`, e a
                  regra mora num arquivo só. Ver `logo-fantasma.tsx`. */}
              <LogoFantasma classeDaMarca="w-16 shrink-0" className="shrink-0" />
              <p className="font-display text-display-s text-caqui-realce-escuro max-w-[15ch] uppercase">
                Segurança e qualidade em 1º lugar
              </p>
            </div>

            {/* As credenciais só aparecem quando existem, e o número nunca é
                inventado. Até 18/08/2026 o seed publicava `00.000000.00-0`
                dentro de uma etiqueta escrita "Cadastur". Ver `prisma/seed.ts`
                e o mesmo cuidado em `/sobre`. */}
            {(settings?.cadastur ?? settings?.pesm) && (
              <dl className="flex flex-wrap gap-x-10 gap-y-4">
                {settings?.cadastur && (
                  <div>
                    <dt className="text-caqui-sand-400 text-micro font-mono uppercase">Cadastur</dt>
                    {/* `break-all` porque o número tem 20 caracteres e, a 200%
                        de zoom em 320px, forçaria rolagem horizontal. */}
                    <dd className="numeral text-dado mt-1.5 break-all text-white">
                      {settings.cadastur}
                    </dd>
                  </div>
                )}
                {settings?.pesm && (
                  <div>
                    <dt className="text-caqui-sand-400 text-micro font-mono uppercase">
                      Credenciamento PESM
                    </dt>
                    <dd className="numeral text-dado mt-1.5 text-white">{settings.pesm}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* `pr-16` reservado à direita, e ele NÃO é folga estética.
              O botão flutuante do WhatsApp é `fixed right-4 bottom-4` com ~56px,
              e esta é a última linha do documento: ela termina exatamente
              embaixo dele. Medido em 18/08/2026 no `/contato`, com a etiqueta
              mais longa do site: "você fecha no WhatsApp" saía "no WH" e o
              resto ficava debaixo do círculo verde.
              A partir de `xl` o contêiner centralizado já termina antes do
              botão, e o respiro volta a zero. */}
          <div className="border-caqui-rule-noite mt-10 flex flex-col gap-2 border-t pt-6 pr-16 sm:flex-row sm:items-center sm:justify-between sm:pr-20 xl:pr-0">
            <p className="text-caqui-sand-400 text-micro font-mono uppercase">
              © {new Date().getFullYear()} Caqui Trekking · Mogi das Cruzes · SP
            </p>
            {/* A frase mais honesta do site, e ela fica no lugar em que ninguém
                a procura de propósito: quem chegou aqui embaixo já entendeu que
                a compra termina numa conversa. */}
            <p className="text-caqui-sand-400 text-micro font-mono uppercase">
              O pagamento não acontece aqui · você fecha no WhatsApp
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

/**
 * Uma linha de contato.
 *
 * O link envolve SÓ o valor, não o rótulo: "WhatsApp" é a categoria do dado, e
 * um leitor de tela que ouvisse "WhatsApp (11) 99999 9999, link" leria a
 * categoria como parte do destino.
 */
function Contato({
  rotulo,
  href,
  valor,
  externo = false,
}: {
  rotulo: string
  href: string
  valor: string
  externo?: boolean
}) {
  return (
    <div>
      <dt className="text-caqui-sand-400 text-micro font-mono uppercase">{rotulo}</dt>
      <dd className="mt-1.5">
        <a
          href={href}
          {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="text-corpo hover:text-caqui-realce-escuro rounded-xs text-white underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
        >
          {valor}
        </a>
      </dd>
    </div>
  )
}
