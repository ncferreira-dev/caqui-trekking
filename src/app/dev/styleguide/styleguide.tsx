'use client'

import { type ReactNode, useState } from 'react'

import { Brasao, Divisor, Montanhas } from '@/components/marca/grafismos'
import { Abas } from '@/components/ui/abas'
import { Acordeao, AcordeaoItem } from '@/components/ui/acordeao'
import { BadgeDificuldade, BadgeDisponibilidade, Etiqueta } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardCorpo, CardMidia, CardRodape, Ficha } from '@/components/ui/card'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/campo'
import { Drawer, Modal } from '@/components/ui/dialogo'
import { Carregando, Esqueleto, EsqueletoCard } from '@/components/ui/esqueleto'
import { ProvedorDeToast, useToast } from '@/components/ui/toast'

/* ==========================================================================
   Estrutura da página
   ========================================================================== */

function Secao({
  id,
  titulo,
  nota,
  children,
}: {
  id: string
  titulo: string
  nota?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="border-caqui-rule scroll-mt-24 border-t py-12">
      <h2 className="text-display-l uppercase">{titulo}</h2>
      {nota && <div className="text-caqui-ink-700 text-corpo mt-3 max-w-2xl">{nota}</div>}
      <div className="mt-8">{children}</div>
    </section>
  )
}

function Amostra({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-caqui-ink-500 text-micro font-mono uppercase">{rotulo}</span>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

function Grade({ children }: { children: ReactNode }) {
  return <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

/* ==========================================================================
   Página
   ========================================================================== */

export function Styleguide() {
  return (
    <ProvedorDeToast>
      <Conteudo />
    </ProvedorDeToast>
  )
}

function Conteudo() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
      <Cabecalho />
      <Cores />
      <Tipografia />
      <Botoes />
      <Selos />
      <Cartoes />
      <Formularios />
      <Sobreposicoes />
      <Divulgacao />
      <Carregamentos />
      <Grafismos />
    </main>
  )
}

function Cabecalho() {
  return (
    <header className="flex flex-col gap-8 py-12 sm:flex-row sm:items-center sm:gap-12">
      <Brasao className="w-28 shrink-0" />
      <div>
        <p className="text-caqui-ink-500 text-rotulo font-mono uppercase">
          Caqui Trekking · design system · v1
        </p>
        <h1 className="text-display-xl mt-2 uppercase">Guia de estilo</h1>
        <p className="text-caqui-ink-700 text-corpo-lg mt-4 max-w-2xl">
          Todos os componentes, em todos os estados. Esta página não existe em produção. A rota
          devolve 404 quando <code className="text-corpo-sm font-mono">NODE_ENV=production</code>.
        </p>
      </div>
    </header>
  )
}

/* ── Cores ─────────────────────────────────────────────────────────────── */

const PALETA = [
  { nome: 'orange-500', valor: '#F26522', uso: 'Ação e preço. Preenchimento.' },
  { nome: 'orange-600', valor: '#E04E12', uso: 'Hover do laranja.' },
  { nome: 'orange-400', valor: '#FF8A47', uso: 'Só gradiente. Nunca texto.' },
  { nome: 'ink-900', valor: '#0D0D0D', uso: 'Títulos, filete forte, rótulo do botão.' },
  { nome: 'ink-700', valor: '#2B2B2B', uso: 'Corpo de texto.' },
  { nome: 'ink-500', valor: '#6B6B6B', uso: 'Texto de apoio.' },
  { nome: 'forest-800', valor: '#1B4332', uso: 'Seção trekking, etiqueta de mata.' },
  { nome: 'forest-600', valor: '#2D6A4F', uso: 'Dificuldade moderada.' },
  { nome: 'forest-300', valor: '#95D5B2', uso: 'Vagas abertas. Preenchimento.' },
  { nome: 'sand-100', valor: '#F5F1EA', uso: 'Fundo de seção. Exige filete.' },
  { nome: 'sand-200', valor: '#E8E0D3', uso: 'Fundo de seção alternativo.' },
  { nome: 'danger', valor: '#C1121F', uso: 'Esgotado, erro, dificuldade alta.' },
]

const LIBERADOS = [
  ['ink-900', 'branco', '19,44:1', 'AAA'],
  ['ink-700', 'branco', '14,16:1', 'AAA'],
  ['forest-800', 'branco', '11,08:1', 'AAA'],
  ['ink-900', 'forest-300', '11,51:1', 'AAA'],
  ['forest-600', 'branco', '6,39:1', 'AA'],
  ['danger', 'branco', '6,22:1', 'AA'],
  ['ink-900', 'orange-500', '6,16:1', 'AA'],
  ['branco', 'danger', '6,22:1', 'AA'],
]

const PROIBIDOS = [
  ['branco', 'orange-500', '3,15:1', 'O botão laranja com rótulo branco. O erro mais comum.'],
  ['orange-500', 'branco', '3,15:1', 'Só ≥24px. Por isso o preço é grande.'],
  ['orange-500', 'sand-100', '2,80:1', 'Nem grande. Laranja não encosta em areia.'],
  ['orange-400', 'branco', '2,34:1', 'Decorativo. Só dentro de gradiente.'],
  ['forest-300', 'branco', '1,69:1', 'Preenchimento, nunca texto nem filete.'],
  ['sand-100', 'branco', '1,13:1', 'Não delimita nada sozinho.'],
]

function Cores() {
  return (
    <Secao
      id="cores"
      titulo="Cor"
      nota={
        <>
          A paleta é fixa, vem do cliente. A decisão de design aqui não é <em>quais</em> cores, é{' '}
          <strong>onde cada uma pode aparecer</strong>, e isso é resultado de medição, não de gosto.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PALETA.map((c) => (
          <div key={c.nome} className="border-caqui-rule flex gap-3 border p-3">
            <span
              className="border-caqui-ink-900 size-12 shrink-0 border"
              style={{ backgroundColor: c.valor }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-corpo-sm font-mono font-medium">{c.nome}</p>
              <p className="text-caqui-ink-500 text-micro font-mono">{c.valor}</p>
              <p className="text-caqui-ink-700 text-corpo-sm mt-1">{c.uso}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-display-s uppercase">Combinações liberadas</h3>
          <table className="text-corpo-sm mt-4 w-full font-mono">
            <thead>
              <tr className="border-caqui-ink-900 text-caqui-ink-500 text-micro border-b text-left uppercase">
                <th className="py-2 font-normal">Frente</th>
                <th className="py-2 font-normal">Fundo</th>
                <th className="py-2 text-right font-normal">Razão</th>
                <th className="py-2 text-right font-normal">WCAG</th>
              </tr>
            </thead>
            <tbody>
              {LIBERADOS.map(([frente, fundo, razao, nivel]) => (
                <tr key={`${frente}-${fundo}`} className="border-caqui-rule border-b">
                  <td className="py-2">{frente}</td>
                  <td className="py-2">{fundo}</td>
                  <td className="py-2 text-right">{razao}</td>
                  <td className="text-caqui-forest-600 py-2 text-right font-medium">{nivel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-caqui-danger text-display-s uppercase">Proibidas</h3>
          <p className="text-caqui-ink-700 text-corpo-sm mt-2">
            Estão aqui de propósito. Esconder o token não impede o erro. Mostrar o número que o
            reprova, sim. O ESLint recusa <code className="font-mono">text-caqui-orange-*</code> em{' '}
            <code className="font-mono">className</code>.
          </p>
          <ul className="mt-4 flex flex-col">
            {PROIBIDOS.map(([frente, fundo, razao, motivo]) => (
              <li key={`${frente}-${fundo}`} className="border-caqui-rule border-b py-2.5">
                <p className="text-corpo-sm font-mono">
                  <span className="text-caqui-danger font-medium">{razao}</span>
                  <span className="text-caqui-ink-500">
                    {' '}
                    · {frente} sobre {fundo}
                  </span>
                </p>
                <p className="text-caqui-ink-700 text-corpo-sm">{motivo}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Secao>
  )
}

/* ── Tipografia ────────────────────────────────────────────────────────── */

function Tipografia() {
  return (
    <Secao
      id="tipografia"
      titulo="Tipografia"
      nota={
        <>
          Três famílias, três trabalhos. <strong>Archivo Black</strong> nos títulos,{' '}
          <strong>DM Sans</strong> no corpo, <strong>DM Mono</strong> na camada de dados. O registro
          de legenda de mapa e etiqueta de equipamento.
        </>
      }
    >
      <div className="flex flex-col gap-8">
        {[
          ['display-xl', 'Serra do Mar', 'text-display-xl'],
          ['display-l', 'Pedra Grande de Quatinga', 'text-display-l'],
          ['display-m', 'Próximas saídas', 'text-display-m'],
          ['display-s', 'O que levar', 'text-display-s'],
        ].map(([nome, exemplo, classe]) => (
          <div key={nome} className="border-caqui-rule flex flex-col gap-1 border-b pb-5">
            <span className="text-caqui-ink-500 text-micro font-mono uppercase">{nome}</span>
            <p className={`font-display uppercase ${classe}`}>{exemplo}</p>
          </div>
        ))}

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="text-caqui-ink-500 text-micro font-mono uppercase">
              Corpo · DM Sans
            </span>
            <p className="text-corpo-lg">
              Travessia guiada pela Serra do Mar, com saída de Mogi das Cruzes. Guias cadastrados no
              Cadastur.
            </p>
            <p className="text-corpo">
              O ponto de encontro é a praça central de Quatinga, às 6h. A trilha tem trechos de solo
              exposto e um lance curto de escalaminhada.
            </p>
            <p className="text-corpo-sm text-caqui-ink-500">
              Sujeito a alteração por condição climática.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-caqui-ink-500 text-micro font-mono uppercase">
              Dados · DM Mono, tabular
            </span>
            <div className="border-caqui-rule border">
              <Ficha
                itens={[
                  { rotulo: 'Distância', valor: '8,5', unidade: 'km' },
                  { rotulo: 'Ganho', valor: '+620', unidade: 'm' },
                  { rotulo: 'Duração', valor: '4h30' },
                ]}
              />
              <Ficha
                itens={[
                  { rotulo: 'Distância', valor: '12,0', unidade: 'km' },
                  { rotulo: 'Ganho', valor: '+1.180', unidade: 'm' },
                  { rotulo: 'Duração', valor: '7h00' },
                ]}
              />
            </div>
            <p className="text-caqui-ink-700 text-corpo-sm">
              As colunas alinham entre fichas diferentes porque o dígito tem largura fixa. É o que
              faz uma lista de expedições parecer uma carta topográfica e não um feed.
            </p>
            <p className="text-micro text-caqui-ink-500 font-mono uppercase">
              Cadastur 26.012345.10.0001-3
            </p>
          </div>
        </div>

        <div className="secao-areia -mx-5 flex flex-wrap items-baseline gap-6 px-5 py-6 sm:-mx-8 sm:px-8">
          <div>
            <span className="text-caqui-ink-500 text-micro block font-mono uppercase">
              Preço · a única exceção
            </span>
            <span className="preco mt-1 block">R$ 90,00</span>
          </div>
          <p className="text-caqui-ink-700 text-corpo-sm max-w-md">
            Laranja como texto só sobrevive em corpo grande: 3,15:1 passa em ≥24px e reprova abaixo
            disso. Por isso o <code className="font-mono">font-size</code> está travado dentro do
            utilitário <code className="font-mono">.preco</code>, e não fica a cargo de quem usa.
          </p>
        </div>
      </div>
    </Secao>
  )
}

/* ── Botões ────────────────────────────────────────────────────────────── */

function Botoes() {
  return (
    <Secao
      id="botoes"
      titulo="Botão"
      nota={
        <>
          O rótulo do botão laranja é <strong>preto</strong>. Branco sobre esse laranja dá 3,15:1 e
          reprova no AA, e seria o elemento mais importante da página ilegível para quem tem baixa
          visão. Preto dá 6,16:1. E é como se serigrafa fita de equipamento.
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <Amostra rotulo="Variantes">
          <Button variante="primary">Reservar vaga</Button>
          <Button variante="secondary">Ver roteiro</Button>
          <Button variante="ghost">Falar no WhatsApp</Button>
          <Button variante="danger">Cancelar saída</Button>
        </Amostra>

        <Amostra rotulo="Tamanhos">
          <Button tamanho="sm">Pequeno</Button>
          <Button tamanho="md">Médio</Button>
          <Button tamanho="lg">Grande</Button>
        </Amostra>

        <Amostra rotulo="Estados">
          <Button disabled>Desabilitado</Button>
          <Button carregando>Enviando</Button>
          <Button variante="secondary" disabled>
            Desabilitado
          </Button>
          <Button variante="ghost" disabled>
            Desabilitado
          </Button>
        </Amostra>

        <div className="flex flex-col gap-3">
          <span className="text-caqui-ink-500 text-micro font-mono uppercase">
            Bloco · padrão em drawer e card
          </span>
          <div className="max-w-sm">
            <Button bloco tamanho="lg">
              Pedir vaga no WhatsApp
            </Button>
          </div>
        </div>

        <p className="text-caqui-ink-700 border-caqui-rule text-corpo-sm border-l-2 pl-4">
          Passe o mouse: a peça sobe 1px e a camada de baixo cresce. No clique ela encosta no papel
          : o deslocamento sólido some. É o feedback tátil que substitui a sombra difusa que cresce.
        </p>
      </div>
    </Secao>
  )
}

/* ── Selos ─────────────────────────────────────────────────────────────── */

function Selos() {
  return (
    <Secao
      id="selos"
      titulo="Selos"
      nota={
        <>
          Dificuldade é <strong>hexágono</strong>, a forma do brasão, com medidor de 4 traços.
          Disponibilidade é <strong>flâmula</strong> com entalhe e glifo. Formas diferentes porque
          aparecem lado a lado no mesmo card.
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <Amostra rotulo="Dificuldade">
          <BadgeDificuldade nivel="FACIL" />
          <BadgeDificuldade nivel="MODERADO" />
          <BadgeDificuldade nivel="DIFICIL" />
          <BadgeDificuldade nivel="EXTREMO" />
        </Amostra>

        <Amostra rotulo="Disponibilidade">
          <BadgeDisponibilidade estado="AVAILABLE" />
          <BadgeDisponibilidade estado="LAST_SPOTS" />
          <BadgeDisponibilidade estado="SOLD_OUT" />
        </Amostra>

        <Amostra rotulo="Etiqueta neutra">
          <Etiqueta>Rapel</Etiqueta>
          <Etiqueta>Cachoeira</Etiqueta>
          <Etiqueta tom="mata">PESM</Etiqueta>
        </Amostra>

        <div className="border-caqui-rule border p-5">
          <p className="text-micro text-caqui-ink-500 font-mono uppercase">
            Teste em escala de cinza
          </p>
          <p className="text-caqui-ink-700 text-corpo-sm mt-2 max-w-2xl">
            A rampa verde → vermelho <strong>não é monotônica</strong> em luminância: forest-600 dá
            0,114 e danger dá 0,119, ou seja 4% de diferença, indistinguíveis para quem tem
            protanopia. Por isso cada nível carrega três sinais: contagem de traços, rótulo escrito
            e cor. Tire a cor e o componente continua funcionando.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 [filter:grayscale(1)]">
            <BadgeDificuldade nivel="FACIL" />
            <BadgeDificuldade nivel="MODERADO" />
            <BadgeDificuldade nivel="DIFICIL" />
            <BadgeDificuldade nivel="EXTREMO" />
            <BadgeDisponibilidade estado="AVAILABLE" />
            <BadgeDisponibilidade estado="LAST_SPOTS" />
            <BadgeDisponibilidade estado="SOLD_OUT" />
          </div>
        </div>
      </div>
    </Secao>
  )
}

/* ── Cards ─────────────────────────────────────────────────────────────── */

function Cartoes() {
  return (
    <Secao
      id="cards"
      titulo="Card"
      nota={
        <>
          O canto cortado é a peça inteira: é a citação do hexágono do brasão, e é o que faz a
          silhueta dizer &ldquo;etiqueta&rdquo; em vez de &ldquo;caixa&rdquo;. A profundidade é um
          elemento de verdade atrás, não um <code className="font-mono">box-shadow</code>, porque{' '}
          <code className="font-mono">clip-path</code> recortaria a sombra junto.
        </>
      }
    >
      <Grade>
        <Card interativo>
          <CardMidia>
            <div className="from-caqui-orange-400 to-caqui-orange-600 absolute inset-0 bg-gradient-to-br" />
            <BadgeDisponibilidade estado="AVAILABLE" className="absolute top-3 left-3" />
          </CardMidia>
          <CardCorpo>
            <div className="flex flex-wrap gap-2">
              <BadgeDificuldade nivel="MODERADO" />
              <Etiqueta tom="mata">PESM</Etiqueta>
            </div>
            <h3 className="text-display-s uppercase">Pedra Grande de Quatinga</h3>
            <p className="text-caqui-ink-700 text-corpo-sm">Mogi das Cruzes · SP · Serra do Mar</p>
            <Ficha
              // Acompanha o padding do CardCorpo, que é 4 no mobile e 5 acima.
              // `-mx-5` fixo vazaria 4px de cada lado abaixo de 640px.
              className="-mx-4 sm:-mx-5"
              itens={[
                { rotulo: 'Distância', valor: '8,5', unidade: 'km' },
                { rotulo: 'Ganho', valor: '+620', unidade: 'm' },
                { rotulo: 'Duração', valor: '4h30' },
              ]}
            />
          </CardCorpo>
          <CardRodape>
            <div>
              <span className="text-caqui-ink-500 text-micro block font-mono uppercase">
                Sáb · 16 ago
              </span>
              <span className="preco">R$ 90,00</span>
            </div>
            <Button tamanho="sm">Reservar</Button>
          </CardRodape>
        </Card>

        <Card interativo>
          <CardMidia>
            <div className="bg-caqui-forest-800 absolute inset-0" />
            <BadgeDisponibilidade estado="LAST_SPOTS" className="absolute top-3 left-3" />
          </CardMidia>
          <CardCorpo>
            <div className="flex flex-wrap gap-2">
              <BadgeDificuldade nivel="DIFICIL" />
            </div>
            <h3 className="text-display-s uppercase">Travessia do Salesópolis</h3>
            <p className="text-caqui-ink-700 text-corpo-sm">Salesópolis · SP</p>
            <Ficha
              // Acompanha o padding do CardCorpo, que é 4 no mobile e 5 acima.
              // `-mx-5` fixo vazaria 4px de cada lado abaixo de 640px.
              className="-mx-4 sm:-mx-5"
              itens={[
                { rotulo: 'Distância', valor: '18,2', unidade: 'km' },
                { rotulo: 'Ganho', valor: '+1.180', unidade: 'm' },
                { rotulo: 'Duração', valor: '9h00' },
              ]}
            />
          </CardCorpo>
          <CardRodape>
            <div>
              <span className="text-caqui-ink-500 text-micro block font-mono uppercase">
                Dom · 24 ago
              </span>
              <span className="preco">R$ 180,00</span>
            </div>
            <Button tamanho="sm">Reservar</Button>
          </CardRodape>
        </Card>

        <Card>
          <CardMidia>
            <div className="bg-caqui-sand-200 absolute inset-0" />
            <div className="trama-indisponivel absolute inset-0" />
            <BadgeDisponibilidade estado="SOLD_OUT" className="absolute top-3 left-3" />
          </CardMidia>
          <CardCorpo>
            <div className="flex flex-wrap gap-2">
              <BadgeDificuldade nivel="FACIL" />
            </div>
            <h3 className="text-display-s uppercase">Cachoeira do Sertãozinho</h3>
            <p className="text-caqui-ink-700 text-corpo-sm">Mogi das Cruzes · SP</p>
            <Ficha
              // Acompanha o padding do CardCorpo, que é 4 no mobile e 5 acima.
              // `-mx-5` fixo vazaria 4px de cada lado abaixo de 640px.
              className="-mx-4 sm:-mx-5"
              itens={[
                { rotulo: 'Distância', valor: '4,0', unidade: 'km' },
                { rotulo: 'Ganho', valor: '+180', unidade: 'm' },
                { rotulo: 'Duração', valor: '3h00' },
              ]}
            />
          </CardCorpo>
          <CardRodape>
            <div>
              <span className="text-caqui-ink-500 text-micro block font-mono uppercase">
                Sáb · 16 ago
              </span>
              <span className="font-display text-display-s text-caqui-ink-500">R$ 70,00</span>
            </div>
            {/* Nunca `disabled`: um botão desabilitado sai do fluxo de teclado
                e some para leitor de tela. E a conversa é o produto. */}
            <Button tamanho="sm" variante="secondary">
              Lista de espera
            </Button>
          </CardRodape>
        </Card>
      </Grade>

      <p className="text-caqui-ink-700 border-caqui-rule text-corpo-sm mt-8 border-l-2 pl-4">
        No card esgotado o estado <strong>se propaga</strong>: a foto ganha trama, o preço perde o
        laranja, e o botão vira secundário com outro texto. Estado que muda o componente inteiro,
        não só um selo no canto.
      </p>
    </Secao>
  )
}

/* ── Formulários ───────────────────────────────────────────────────────── */

function Formularios() {
  const [aceito, setAceito] = useState(false)

  return (
    <Secao
      id="formularios"
      titulo="Formulário"
      nota={
        <>
          O <code className="font-mono">Select</code> é o{' '}
          <code className="font-mono">&lt;select&gt;</code> nativo, de propósito: um listbox à mão
          custa ~250 linhas e é o componente que mais quebra acessibilidade, em troca de controlar
          uma lista que o celular substitui por um seletor nativo de qualquer jeito.
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Input rotulo="Nome" placeholder="Como podemos te chamar?" obrigatorio />
          <Input
            rotulo="WhatsApp"
            type="tel"
            placeholder="(11) 90000-0000"
            dica="É por aqui que a gente confirma a vaga."
          />
          <Input
            rotulo="E-mail"
            type="email"
            defaultValue="nao-e-um-email"
            erro="Digite um e-mail válido, com @ e domínio."
          />
          <Input rotulo="Campo desabilitado" defaultValue="Não editável" disabled />
        </div>

        <div className="flex flex-col gap-6">
          <Select
            rotulo="Expedição"
            placeholder="Escolha uma expedição"
            obrigatorio
            opcoes={[
              { valor: 'pedra-grande', rotulo: 'Pedra Grande de Quatinga' },
              { valor: 'travessia', rotulo: 'Travessia do Salesópolis' },
              {
                valor: 'cachoeira',
                rotulo: 'Cachoeira do Sertãozinho, esgotada',
                desabilitada: true,
              },
            ]}
          />
          <Select
            rotulo="Dificuldade"
            erro="Selecione uma opção."
            opcoes={[
              { valor: 'FACIL', rotulo: 'Fácil' },
              { valor: 'MODERADO', rotulo: 'Moderado' },
            ]}
            placeholder="Escolha"
          />
          <Textarea
            rotulo="Mensagem"
            placeholder="Conta pra gente o que você procura."
            dica="Mínimo de 10 caracteres."
          />
          <Checkbox
            rotulo="Quero receber a agenda do mês"
            descricao="Só a agenda. Sem spam, e dá pra sair a qualquer momento."
            checked={aceito}
            onChange={(e) => setAceito(e.target.checked)}
          />
          <Checkbox rotulo="Aceito os termos" erro="É preciso aceitar para continuar." />
        </div>
      </div>
    </Secao>
  )
}

/* ── Sobreposições ─────────────────────────────────────────────────────── */

function Sobreposicoes() {
  const [modal, setModal] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const { mostrar } = useToast()

  return (
    <Secao
      id="sobreposicoes"
      titulo="Sobreposições"
      nota={
        <>
          Modal e Drawer usam o <code className="font-mono">&lt;dialog&gt;</code> nativo: armadilha
          de foco, Escape e camada superior saem de graça, sem{' '}
          <code className="font-mono">z-index</code> disputando com o header. Erro em toast{' '}
          <strong>não fecha sozinho</strong>. WCAG 2.2.1.
        </>
      }
    >
      <div className="flex flex-wrap gap-4">
        <Button onClick={() => setModal(true)}>Abrir modal</Button>
        <Button variante="secondary" onClick={() => setDrawer(true)}>
          Abrir mochila
        </Button>
        <Button
          variante="ghost"
          onClick={() =>
            mostrar({
              tom: 'sucesso',
              titulo: 'Adicionado à mochila',
              descricao: 'Camiseta Dry Fit, tamanho M.',
            })
          }
        >
          Toast de sucesso
        </Button>
        <Button
          variante="ghost"
          onClick={() =>
            mostrar({
              tom: 'erro',
              titulo: 'Não foi possível enviar',
              descricao: 'Confira sua conexão e tente de novo. Este aviso não fecha sozinho.',
            })
          }
        >
          Toast de erro
        </Button>
        <Button
          variante="ghost"
          onClick={() =>
            mostrar({
              tom: 'aviso',
              titulo: 'Últimas vagas',
              descricao: 'Restam 2 vagas nesta saída.',
            })
          }
        >
          Toast de aviso
        </Button>
      </div>

      <Modal
        aberto={modal}
        aoFechar={() => setModal(false)}
        titulo="Cancelar esta saída?"
        rodape={
          <>
            <Button variante="secondary" onClick={() => setModal(false)}>
              Voltar
            </Button>
            <Button variante="danger" onClick={() => setModal(false)}>
              Cancelar saída
            </Button>
          </>
        }
      >
        <p className="text-corpo">
          A saída de <strong>16 de agosto</strong> some do site imediatamente. Quem já pediu vaga
          precisa ser avisado no WhatsApp, porque o site não manda mensagem por você.
        </p>
      </Modal>

      <Drawer
        aberto={drawer}
        aoFechar={() => setDrawer(false)}
        titulo="Sua mochila"
        rodape={
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-rotulo font-mono uppercase">Total</span>
              <span className="preco">R$ 140,00</span>
            </div>
            <Button bloco tamanho="lg">
              Pedir vaga no WhatsApp
            </Button>
            <p className="text-caqui-ink-500 text-micro text-center font-mono uppercase">
              O pagamento não acontece aqui · você fecha no WhatsApp
            </p>
          </div>
        }
      >
        <ul className="flex flex-col gap-4">
          {[
            ['Pedra Grande de Quatinga', 'Sáb · 16 ago · 1 vaga', 'R$ 90,00'],
            ['Camiseta Dry Fit Caqui', 'Tamanho M · Preto', 'R$ 50,00'],
          ].map(([titulo, detalhe, valor]) => (
            <li key={titulo} className="border-caqui-rule flex gap-3 border-b pb-4">
              <span className="bg-caqui-sand-100 border-caqui-rule size-16 shrink-0 border" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-corpo uppercase">{titulo}</p>
                <p className="text-caqui-ink-500 text-micro font-mono uppercase">{detalhe}</p>
              </div>
              <span className="text-corpo-sm font-mono">{valor}</span>
            </li>
          ))}
        </ul>
      </Drawer>
    </Secao>
  )
}

/* ── Divulgação (abas e acordeão) ──────────────────────────────────────── */

function Divulgacao() {
  return (
    <Secao
      id="divulgacao"
      titulo="Abas e acordeão"
      nota={
        <>
          O acordeão é <code className="font-mono">&lt;details&gt;</code> nativo, com zero
          JavaScript, e o Ctrl+F do navegador abre a seção fechada para mostrar o resultado. Numa
          página de expedição, isso é a diferença entre o conteúdo existir e não existir para quem
          procura.
        </>
      }
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <Abas
          abas={[
            {
              id: 'agenda',
              rotulo: 'Agenda',
              contador: 3,
              conteudo: (
                <ul className="flex flex-col gap-3">
                  {[
                    ['Sáb · 16 ago', 'AVAILABLE'],
                    ['Sex · 22 ago', 'LAST_SPOTS'],
                    ['Sáb · 29 ago', 'SOLD_OUT'],
                  ].map(([data, estado]) => (
                    <li
                      key={data}
                      className="border-caqui-rule flex items-center justify-between gap-3 border-b pb-3"
                    >
                      <span className="text-corpo-sm font-mono uppercase">{data}</span>
                      <BadgeDisponibilidade
                        estado={estado as 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'}
                      />
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              id: 'roteiro',
              rotulo: 'Roteiro',
              conteudo: (
                <p className="text-corpo">
                  Saída às 6h da praça de Quatinga. Subida por trilha de solo até o mirante, parada
                  para lanche, descida pela mesma via.
                </p>
              ),
            },
            {
              id: 'guias',
              rotulo: 'Guias',
              contador: 2,
              conteudo: (
                <p className="text-corpo">
                  Dois guias cadastrados no Cadastur e credenciados pelo PESM acompanham o grupo.
                </p>
              ),
            },
          ]}
        />

        <Acordeao>
          <AcordeaoItem grupo="faq" titulo="O que levar" abertoPorPadrao>
            <ul className="list-inside list-disc space-y-1">
              <li>2 litros de água</li>
              <li>Lanche de trilha</li>
              <li>Calçado fechado com solado de aderência</li>
              <li>Protetor solar e boné</li>
            </ul>
          </AcordeaoItem>
          <AcordeaoItem grupo="faq" titulo="Política de cancelamento">
            <p>
              Cancelamento com mais de 72h de antecedência garante remarcação para outra data sem
              custo.
            </p>
          </AcordeaoItem>
          <AcordeaoItem grupo="faq" titulo="E se chover?">
            <p>
              Chuva leve não cancela. Em caso de alerta da Defesa Civil, a saída é remarcada e
              avisamos por WhatsApp.
            </p>
          </AcordeaoItem>
        </Acordeao>
      </div>
    </Secao>
  )
}

/* ── Carregamento ──────────────────────────────────────────────────────── */

function Carregamentos() {
  return (
    <Secao
      id="carregamento"
      titulo="Carregamento"
      nota={
        <>
          Hachura que pulsa, não brilho que varre. O shimmer diagonal anima{' '}
          <code className="font-mono">background-position</code>, que é repintura a cada frame; aqui
          pulsa <code className="font-mono">opacity</code>, que a GPU compõe. Sob{' '}
          <code className="font-mono">prefers-reduced-motion</code> o pulso para, e um{' '}
          <code className="font-mono">role=&quot;status&quot;</code> invisível avisa que está
          carregando.
        </>
      }
    >
      <Carregando descricao="Carregando expedições" className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Esqueleto className="h-8 w-2/3 max-w-sm" />
          <Esqueleto className="h-4 w-1/2 max-w-xs" />
        </div>
        <Grade>
          <EsqueletoCard />
          <EsqueletoCard />
          <EsqueletoCard />
        </Grade>
      </Carregando>
    </Secao>
  )
}

/* ── Grafismos ─────────────────────────────────────────────────────────── */

function Grafismos() {
  return (
    <Secao
      id="grafismos"
      titulo="Grafismos"
      nota={
        <>
          Parcimônia é regra, não conselho: <strong>curva de nível no máximo 2× por página</strong>,
          nunca em seções vizinhas; <strong>serra 1× por página</strong>, sempre no herói; nenhum
          dos dois como fundo repetido.
        </>
      }
    >
      <div className="flex flex-col gap-12">
        <div>
          <span className="text-caqui-ink-500 text-micro font-mono uppercase">
            Divisor · curva de nível com cota
          </span>
          <div className="mt-3">
            <Divisor cota="1.170 m" />
          </div>
          <p className="text-caqui-ink-700 text-corpo-sm mt-3 max-w-2xl">
            A cota fica <strong>fora</strong> do SVG, como elemento HTML. Texto dentro de um SVG
            esticado deforma junto, e no celular a cota apareceria esmagada a 27% da largura. Fora,
            ela ainda é selecionável e encontrável pelo Ctrl+F.
          </p>
        </div>

        <div>
          <span className="text-caqui-ink-500 text-micro font-mono uppercase">
            Serra · gravura, não silhueta chapada
          </span>
          <div className="secao-areia mt-3">
            <Montanhas className="h-44" />
          </div>
          <p className="text-caqui-ink-700 text-corpo-sm mt-3 max-w-2xl">
            As montanhas da logo real não são massa preta: são desenho de linha com hachura, no
            registro de xilogravura. O briefing escrito diz &ldquo;preto sólido&rdquo;. A logo
            desmente.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-10">
          <div>
            <span className="text-caqui-ink-500 text-micro block font-mono uppercase">
              Brasão · reconstrução
            </span>
            <Brasao className="mt-3 w-40" />
          </div>
          <p className="text-caqui-danger text-corpo-sm max-w-md border-l-2 pl-4">
            <strong>Isto não é o arquivo original.</strong> É uma reconstrução em vetor a partir da
            marca d&apos;água das fotos de produto, para o site ter marca enquanto o original não
            chega. Peça o <code className="font-mono">.ai</code> ou{' '}
            <code className="font-mono">.svg</code> à Caqui e substitua.
          </p>
        </div>
      </div>
    </Secao>
  )
}
