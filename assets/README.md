# `assets/` — material bruto para importação em lote

Esta pasta é **estação de trabalho, não storage**. O conteúdo dela não vai para
o git (só este README vai) e nada aqui é servido pelo site. As imagens vivem no
Cloudinary depois da importação.

```
assets/
├── wear/       → produtos da Caqui Wear   (--destino=produto, o padrão)
├── roteiros/   → galeria das expedições   (--destino=roteiro)
├── guias/      → fotos dos guias          (--destino=guia)
└── _originais/ → material cru, antes de renomear
```

---

## A convenção de nome de arquivo

```
<slug-do-item>__<NN>__<texto-alternativo-em-kebab>.<ext>
```

| Parte  | Regra                                                                          |
| ------ | ------------------------------------------------------------------------------ |
| `slug` | igual ao slug já cadastrado do produto/roteiro. Para guia, use o **id**.       |
| `NN`   | dois dígitos. **`01` é a imagem principal** — a capa.                          |
| `alt`  | kebab-case. Vira o texto alternativo: hífens viram espaços, inicial maiúscula. |
| `ext`  | `.jpg` `.jpeg` `.png` `.webp` `.avif` `.heic` `.heif`                          |

O separador é `__` (dois sublinhados). Slug usa hífen simples, então nenhum
slug válido contém `__` e a divisão nunca fica ambígua.

```
camiseta-poliamida-azul__01__camiseta-azul-de-poliamida-vista-de-frente.jpg
camiseta-poliamida-azul__02__detalhe-do-bordado-no-peito.jpg
caneca-caqui__01__caneca-branca-com-a-logo-da-caqui-trekking.jpg
```

### Por que as três partes são obrigatórias

- **slug** — o script **não cria produtos**. Nome de arquivo não diz categoria
  nem preço, e adivinhar colocaria peça errada no catálogo. Slug sem
  correspondência é relatado, e a importação daquele grupo não acontece.
- **NN** — sem ordem explícita a galeria fica na ordem que o sistema de
  arquivos devolver, que muda entre máquinas.
- **alt** — é obrigatório no banco. Abrir exceção justamente no caminho que
  sobe dezenas de imagens de uma vez seria abrir para a maioria delas.

O `alt` gerado a partir do nome é um **ponto de partida**. Ele é lido em voz
alta por leitor de tela e indexado pelo Google Imagens; vale revisar no CRM
depois. "Trilha", "Serra do Mar", "cachoeira" e "Mogi das Cruzes" são as
palavras que fazem diferença aqui.

---

## Uso

```bash
npm run media:importar                        # confere e NÃO escreve nada
npm run media:importar -- --aplicar           # sobe de verdade
npm run media:importar -- --destino=roteiro   # outra pasta, outro tipo de dono
npm run media:importar -- --renomear          # propõe nomes para a pasta crua
```

O padrão é conferir. Um script de importação que sobe no primeiro comando é um
script que sobe errado na primeira tentativa.

### `--renomear`

Lê a pasta como ela está, agrupa por descrição, detecta o preço que estiver no
nome e **escreve um `renomear.sh`** com os `mv` propostos. Não executa nada.

Existe porque o material real não segue convenção nenhuma: as 41 fotos que a
Caqui entregou têm nomes como `Camiseta cinza chumbo poliamida r$60,00
cada(2).jpg` e `IMG-20241102-WA0057.jpg`. O preço detectado entra como
comentário, para conferência — **o script nunca grava preço**, isso é do
cadastro do produto.

---

## Idempotência

O identificador no storage é derivado do nome: `caqui/<tipo>/<slug>/<NN>`.
Rodar duas vezes não duplica: o que já existe é pulado e contado no relatório.

Trocar a foto `01` de um produto é, portanto, um processo em dois passos —
apagar a imagem pelo CRM (o que remove do storage) e importar de novo. O
provedor recebe `overwrite: false`; sobrescrever em silêncio é como se perde a
imagem anterior sem ninguém notar.

---

## O que a importação valida

O mesmo que o upload pelo CRM, porque é o mesmo caminho de código:

- tipo real pelos **bytes**, não pela extensão — JPEG, PNG, WebP, AVIF, HEIC
- máximo de **12 MB** por arquivo
- menor lado com pelo menos **600 px**
- `alt` presente
- dimensões extraídas já com a rotação do EXIF aplicada
- `blurDataUrl` gerado (exceto em HEIC — ver `docs/05-midia.md`)
