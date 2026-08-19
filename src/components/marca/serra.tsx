import { cn } from '@/lib/ui/cn'

/**
 * A SERRA — o palco.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE, SE JÁ HÁ `<Montanhas>` EM `grafismos.tsx`
 * ────────────────────────────────────────────────────────────────────────────
 * `<Montanhas>` é um GRAFISMO: uma faixa de 220 unidades de altura que assina
 * o pé de uma seção. Tem parcimônia declarada — uma vez por página — e é isso
 * que a mantém reconhecível.
 *
 * Isto aqui é outra coisa: é CENÁRIO. A serra ocupando a viewport inteira,
 * dividida em camadas que se escondem umas atrás das outras, para o herói ter
 * profundidade de verdade num site que não tem uma única fotografia.
 *
 * Separar os dois arquivos é o que impede o grafismo de virar papel de parede.
 * `<Montanhas>` continua com a regra de uma vez por página; `<Serra>` só
 * aparece em herói e em abertura de capítulo, e nunca as duas juntas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A OCLUSÃO É O QUE FAZ A PROFUNDIDADE, E ELA EXIGE MASSA
 * ────────────────────────────────────────────────────────────────────────────
 * O registro da marca é gravura: contorno e hachura, nunca preenchimento
 * sólido. Cinco cristas seguindo essa regra à risca, porém, viram um
 * emaranhado de arame — sem uma esconder a outra, todas as linhas convivem no
 * mesmo plano e a profundidade some.
 *
 * A saída é a mesma da gravura impressa: a massa não é tinta, é O PAPEL. Cada
 * camada é preenchida com a COR DO FUNDO (`--serra-massa`), não com preto.
 * Ela oculta o que está atrás sem pintar nada por cima — exatamente como uma
 * área não gravada da matriz.
 *
 * Quem usa define as duas variáveis:
 *
 *   color            → a tinta (o traço). Herda; use `text-*`.
 *   --serra-massa    → o papel (o vazio). Precisa bater com o fundo da seção.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PERSPECTIVA ATMOSFÉRICA
 * ────────────────────────────────────────────────────────────────────────────
 * O que está longe não é só menor: é mais claro e menos definido, porque tem
 * mais ar no caminho. Aqui isso é obtido variando SÓ a espessura e a opacidade
 * do traço — nunca a cor, que é uma só, como numa chapa de uma tinta.
 *
 * `vectorEffect="non-scaling-stroke"` mantém a espessura ótica constante: sem
 * ele, a camada esticada para 1600px de largura engrossaria o traço junto e a
 * hierarquia entre as cinco se perderia justamente no desktop.
 */

/** Da mais distante (1) para a mais próxima (5). */
export type Profundidade = 1 | 2 | 3 | 4 | 5

type Camada = {
  /** A crista, sem fechar. O componente fecha contra a base. */
  crista: string
  /** Hachura do flanco. Sempre à DIREITA do cume: a luz vem de um lado só. */
  hachura?: string
  /** Linha d'água / vale, quebrada em trechos como na logo. */
  agua?: string
  traco: number
  opacidade: number
  /** Opacidade da massa. A camada distante deixa passar um pouco de neblina. */
  massa: number
  /**
   * Onde o viewBox COMEÇA no eixo Y.
   *
   * Cada crista ocupa uma faixa diferente da altura — a distante vive perto da
   * base, a próxima sobe muito mais. Com um viewBox único para as cinco, a
   * camada distante carregaria ~70% de espaço vazio acima dela, e esse vazio
   * vira um vão morto na página, porque a altura do SVG é derivada da largura
   * (ver o cabeçalho de `Serra`).
   *
   * Recortar o topo por camada faz cada uma ter a altura do próprio desenho.
   * Efeito colateral desejado: a camada próxima fica naturalmente mais alta que
   * a distante, sem ninguém precisar dizer isso numa classe.
   */
  topo: number
}

/**
 * Os cinco perfis.
 *
 * Os cumes NÃO se alinham entre camadas — é a única regra que importa aqui.
 * Duas cristas com pico na mesma abscissa leem como uma coisa só, e o
 * paralaxe depois não recupera a profundidade que o desenho não tem.
 *
 * O desenho é da Serra do Mar: paredão que sobe rápido do vale, topo em domo
 * de granito, e não o triângulo de montanha de livro infantil.
 */
const CAMADAS: Record<Profundidade, Camada> = {
  1: {
    crista:
      'M0 196 L112 172 Q152 160 190 176 L268 196 L352 168 L430 190 L512 162 Q548 150 586 168 L664 194 L742 170 L826 192 L904 166 L988 190 L1066 172 Q1104 160 1142 178 L1220 196 L1300 174 L1382 194 L1462 172 L1540 190 L1600 180',
    traco: 1,
    opacidade: 0.24,
    massa: 0.5,
    topo: 148,
  },
  2: {
    crista:
      'M0 210 L96 178 L176 202 L258 166 Q300 150 340 172 L420 200 L508 164 L590 194 L672 170 L758 200 L840 168 Q880 152 918 174 L998 202 L1082 168 L1166 196 L1250 172 L1336 200 L1420 174 L1508 198 L1600 178',
    hachura: 'M340 172 L356 194 M340 180 L370 206 M918 174 L934 194 M918 182 L948 208',
    traco: 1.3,
    opacidade: 0.36,
    massa: 0.72,
    topo: 138,
  },
  3: {
    crista:
      'M0 218 L86 176 L164 206 L248 154 Q292 132 334 158 L414 200 L500 150 L578 188 L662 160 L748 202 L830 164 L914 204 L1000 158 Q1042 138 1082 164 L1160 204 L1246 160 L1330 200 L1414 168 L1502 202 L1600 176',
    hachura:
      'M334 158 L352 182 M334 168 L368 196 M500 150 L518 176 M500 160 L534 190 M1082 164 L1098 186 M1082 174 L1114 200',
    agua: 'M60 232 H236 M300 238 H468 M540 230 H716',
    traco: 1.7,
    opacidade: 0.52,
    massa: 0.88,
    topo: 120,
  },
  4: {
    crista:
      'M0 228 L78 178 L152 212 L238 142 Q286 116 330 146 L410 204 L500 132 L582 186 L668 150 L756 206 L840 158 L926 210 L1014 144 Q1058 120 1100 150 L1180 208 L1268 148 L1354 204 L1440 162 L1528 206 L1600 182',
    hachura:
      'M330 146 L352 178 M330 158 L368 192 M330 170 L384 206 M500 132 L522 166 M500 144 L538 180 M1100 150 L1120 180 M1100 162 L1136 194',
    agua: 'M120 242 H330 M396 248 H588 M660 240 H852 M912 246 H1104',
    traco: 2.2,
    opacidade: 0.74,
    massa: 0.96,
    topo: 104,
  },
  5: {
    crista:
      'M0 236 L70 176 L146 218 L232 126 Q284 96 330 130 L412 208 L508 114 L594 180 L682 138 L774 212 L862 152 L950 216 L1040 128 Q1088 100 1132 134 L1214 212 L1306 138 L1396 206 L1488 156 L1580 210 L1600 200',
    hachura:
      'M330 130 L356 172 M330 144 L372 190 M330 158 L388 208 M508 114 L534 156 M508 128 L550 174 M508 142 L566 192 M1132 134 L1156 174 M1132 148 L1172 192 M862 152 L882 184 M862 164 L898 200',
    agua: 'M42 250 H288 M352 254 H602 M676 248 H918 M984 252 H1250 M1310 248 H1560',
    traco: 2.9,
    opacidade: 1,
    massa: 1,
    topo: 84,
  },
}

/**
 * Uma camada da serra.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ALTURA INTRÍNSECA, E NÃO CLASSE DE ALTURA — CORRIGIDO EM 18/08/2026
 * ────────────────────────────────────────────────────────────────────────────
 * A primeira versão tinha `viewBox="0 0 1600 400"` com `slice` e recebia a
 * altura por classe (`h-28`, `h-36`…). Na tela o resultado foi um zigue-zague
 * de eletrocardiograma, e a causa não era o desenho.
 *
 * `slice` escala para COBRIR e corta a sobra. Com o quadro renderizado em
 * 1440×112 (proporção 12,9) e o viewBox em proporção 4, a escala vinha da
 * largura e o desenho era renderizado com 360px de altura dentro de uma caixa
 * de 112 — ou seja, aparecia só a FATIA CENTRAL de 31% do desenho. Os cumes
 * ficavam acima do corte e a base abaixo; sobrava o miolo das encostas, que é
 * exatamente um zigue-zague.
 *
 * Aqui o SVG não recebe altura nenhuma. Com `viewBox` e `width: 100%`, o
 * navegador deriva a altura da proporção intrínseca (1600/260), e a proporção
 * renderizada passa a ser SEMPRE igual à do viewBox. Não há corte para
 * calibrar: a serra fica proporcionalmente idêntica em 375px e em 1920px, só
 * maior ou menor — que é como uma paisagem se comporta.
 *
 * Consequência para quem usa: o espaçamento entre camadas precisa ser em
 * PORCENTAGEM (`-mt-[7%]`), não em `rem`. Margem percentual resolve contra a
 * largura do pai, que é a mesma grandeza que governa a altura do SVG — então as
 * camadas se sobrepõem na mesma medida em qualquer tela. Com `-mt-8` fixo, no
 * celular a sobreposição comeria a camada inteira.
 */
export function Serra({
  profundidade,
  className,
}: {
  profundidade: Profundidade
  className?: string
}) {
  const c = CAMADAS[profundidade]

  return (
    <svg
      viewBox={`0 ${c.topo} 1600 ${260 - c.topo}`}
      aria-hidden="true"
      className={cn('block h-auto w-full', className)}
    >
      {/* A massa: o papel. Fecha a crista contra a base do viewBox. */}
      <path
        d={`${c.crista} L1600 260 L0 260 Z`}
        fill="var(--serra-massa, transparent)"
        fillOpacity={c.massa}
      />

      {/* A tinta: o traço. */}
      <g
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        <path d={c.crista} strokeWidth={c.traco} strokeOpacity={c.opacidade} />

        {c.hachura && (
          <path
            d={c.hachura}
            strokeWidth={c.traco * 0.45}
            strokeOpacity={c.opacidade * 0.62}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {c.agua && (
          <path
            d={c.agua}
            strokeWidth={c.traco * 0.42}
            strokeOpacity={c.opacidade * 0.4}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </g>
    </svg>
  )
}

/**
 * A neblina que se acumula entre as cristas.
 *
 * É o segundo mecanismo de profundidade, e o que impede as cinco camadas de
 * parecerem cinco adesivos empilhados: no vale entre duas cristas o ar é mais
 * denso, e é ali que a luz se acumula.
 *
 * Gradiente e não imagem: a mesma faixa custa ~0 byte, escala sem borrar, e
 * acompanha a cor da seção pela variável.
 *
 * `mix-blend-mode: screen` sobre a noite faz a neblina CLAREAR o que está
 * atrás em vez de cobrir — a crista continua visível através dela, que é o
 * comportamento de neblina de verdade. Sobre fundo claro o modo troca para
 * `multiply` pela variável `--neblina-mistura`.
 */
export function Neblina({
  className,
  intensidade = 1,
}: {
  className?: string
  /** Multiplicador da opacidade. 1 é o padrão do vale; 0,5 para o fundo. */
  intensidade?: number
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-0', className)}
      style={{
        mixBlendMode: 'var(--neblina-mistura, screen)' as React.CSSProperties['mixBlendMode'],
        backgroundImage:
          'linear-gradient(to top, transparent, var(--color-caqui-neblina) 38%, var(--color-caqui-neblina) 62%, transparent)',
        opacity: intensidade,
      }}
    />
  )
}
