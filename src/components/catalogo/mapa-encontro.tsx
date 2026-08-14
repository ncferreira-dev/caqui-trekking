'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

/**
 * O ponto de encontro, com mapa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O MAPA SÓ CARREGA DEPOIS DE UM CLIQUE — E ISSO NÃO É PREGUIÇA
 * ────────────────────────────────────────────────────────────────────────────
 * Um `<iframe>` de mapa incorporado dispara, no primeiro pixel da página, uma
 * requisição para um terceiro que carrega o IP, o `Referer` (a URL exata da
 * expedição que a pessoa está vendo) e o `User-Agent` de toda visitante — sem
 * que ninguém tenha pedido mapa nenhum. É rastreamento por padrão, e é
 * exatamente a postura que este projeto recusou no consentimento da newsletter
 * e na captura de lead.
 *
 * Também é caro: um embed de mapa é o recurso mais pesado de uma página de
 * roteiro, e a maioria das pessoas nunca olha para ele — elas querem o
 * ENDEREÇO, e vão abrir no app de navegação do próprio celular.
 *
 * Então: a fachada mostra o endereço e o horário (que é o que 90% procura), e
 * o mapa entra quando alguém pede. A frase diz para onde o clique manda dado —
 * consentimento informado só vale se disser o que acontece.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * OPENSTREETMAP, NÃO GOOGLE MAPS
 * ────────────────────────────────────────────────────────────────────────────
 * O embed do Google exige chave de API, cobra por carregamento e obriga a
 * aceitar os termos dele em nome da visitante. O do OpenStreetMap não exige
 * nada. Os links "abrir no Google Maps" e "abrir no Waze" continuam ali,
 * porque é para lá que a pessoa vai de fato — e clicar num link é navegação
 * que ela escolheu, não um pedido feito em nome dela.
 */
export function MapaEncontro({
  ponto,
  horario,
  coordenadas,
}: {
  ponto: string | null
  horario: string | null
  coordenadas: { lat: number; lng: number } | null
}) {
  const [carregado, setCarregado] = useState(false)
  const quadro = useRef<HTMLIFrameElement>(null)

  // O botão "Carregar mapa" REMOVE a si mesmo ao ser clicado — o `<iframe>`
  // toma o lugar dele. Sem isto, o foco do teclado cai no `<body>` e a pessoa
  // volta para o topo do documento no meio da leitura da página. Mandar o foco
  // para o mapa é o destino óbvio: é o que ela acabou de pedir, e o `<iframe>`
  // é focável e rolável por teclado.
  useEffect(() => {
    if (carregado) quadro.current?.focus()
  }, [carregado])

  if (!ponto && !coordenadas) return null

  const consulta = coordenadas ? `${coordenadas.lat},${coordenadas.lng}` : (ponto ?? '')

  return (
    <section aria-labelledby="ponto-de-encontro" className="flex flex-col gap-4">
      <h2 id="ponto-de-encontro" className="text-display-s uppercase">
        Ponto de encontro
      </h2>

      <div className="border-caqui-ink-900 chanfro-md border bg-white">
        <div className="flex flex-col gap-1 px-5 py-4">
          {ponto && <p className="text-corpo font-medium">{ponto}</p>}
          {horario && (
            <p className="text-caqui-ink-700 text-rotulo font-mono uppercase">
              Encontro às {horario}
            </p>
          )}
          {coordenadas && (
            <p className="text-caqui-ink-500 text-micro font-mono">
              {grau(coordenadas.lat)}, {grau(coordenadas.lng)}
            </p>
          )}
        </div>

        {coordenadas && (
          <div className="border-caqui-ink-900 aspect-[16/9] border-t">
            {carregado ? (
              <iframe
                ref={quadro}
                title="Mapa do ponto de encontro"
                loading="lazy"
                // `referrerPolicy` corta o `Referer`: mesmo depois do
                // consentimento, o terceiro não precisa saber QUAL expedição.
                referrerPolicy="no-referrer"
                src={urlDoEmbed(coordenadas)}
                className="h-full w-full"
              />
            ) : (
              <div className="bg-caqui-sand-100 flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
                <Alfinete />
                <p className="text-caqui-ink-700 text-corpo-sm max-w-xs">
                  O mapa vem do OpenStreetMap. Carregar envia sua conexão para lá.
                </p>
                <Button variante="secondary" tamanho="sm" onClick={() => setCarregado(true)}>
                  Carregar mapa
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Como chegar ─────────────────────────────────────────────────
            Era um par de links sublinhados, do tamanho de uma legenda. Virou
            botão porque esta é a ação mais executada da página DEPOIS da
            compra: quem já tem a vaga volta aqui na véspera, e às vezes na
            estrada, com uma mão no volante, para traçar a rota.

            O Google Maps é o primário e ocupa a linha inteira no celular. O
            Waze fica ao lado, secundário, e só aparece com coordenada: sem
            `ll` ele abriria o app na posição atual da pessoa, que é pior que
            não oferecer.

            `noopener noreferrer` continua valendo, e `target="_blank"` é o
            certo aqui: quem está lendo o roteiro não quer perder a página
            para o app de mapas. */}
        <div className="border-caqui-rule flex flex-col gap-2 border-t px-5 py-4 sm:flex-row">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={[
              'inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-4',
              'border-caqui-ink-900 bg-caqui-orange-500 text-caqui-ink-900 border',
              'text-rotulo font-mono uppercase',
              'shadow-[var(--shadow-corte-1)] transition-transform',
              'hover:translate-x-px hover:translate-y-px hover:shadow-none',
            ].join(' ')}
          >
            <Alfinete pequeno />
            Como chegar
            <span className="sr-only">, abre o Google Maps em outra aba</span>
          </a>

          {coordenadas && (
            <a
              href={`https://waze.com/ul?ll=${coordenadas.lat},${coordenadas.lng}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                'inline-flex min-h-11 items-center justify-center gap-2 px-4',
                'border-caqui-ink-900 border bg-white',
                'text-rotulo font-mono uppercase',
                'hover:bg-caqui-sand-100 transition-colors',
              ].join(' ')}
            >
              Waze
              <span className="sr-only">, abre o Waze em outra aba</span>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * Coordenada com 5 casas (~1 m de precisão), em ponto decimal.
 *
 * `Intl` e não `toFixed` — o ESLint deste projeto bloqueia `toFixed` para
 * forçar todo arredondamento a passar por um formatador explícito, e aqui o
 * locale `en-US` é a escolha CERTA e não um descuido: coordenada geográfica se
 * escreve com ponto no mundo inteiro, inclusive no Brasil. Colar "−23,52145"
 * no Google Maps não encontra nada.
 */
const FORMATO_GRAU = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
})

function grau(valor: number): string {
  return FORMATO_GRAU.format(valor)
}

/**
 * A caixa do embed.
 *
 * O `bbox` é um retângulo em volta do ponto. 0,006° dá cerca de 650 m de lado
 * na latitude de Mogi — perto o bastante para reconhecer a rua, longe o
 * bastante para achar a estrada de acesso, que é o que importa numa portaria
 * de fazenda no meio do mato.
 */
function urlDoEmbed({ lat, lng }: { lat: number; lng: number }): string {
  const raio = 0.006
  const bbox = [lng - raio, lat - raio, lng + raio, lat + raio].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

function Alfinete({ pequeno = false }: { pequeno?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={pequeno ? 'size-4' : 'text-caqui-ink-900 size-8'}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M12 2c-3.9 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
