# 14 · Cadastro de produto: cor, imagem e ordem — pedido guardado (18/08/2026)

> **Status: implementado em 19/08/2026.** O modelo, a API, o seletor no CRM, o
> filtro da loja e o aviso de cor sem foto estão no ar em localhost. O que
> continua faltando é o UPLOAD (o Cloudinary ainda não tem credencial): as
> fotos existem no banco por seed de preview, não por envio real.
>
> Ver a seção "Como ficou" no fim deste arquivo.

## O que foi pedido

Ao cadastrar um produto no CRM, a cor e a imagem precisam estar **relacionadas**.
Uma baby look com três cores deveria mostrar a foto **daquela** cor quando a
pessoa escolhe a cor. E, se amarrar isso automaticamente for complicado, então
que exista a escolha explícita dentro do CRM: "amarelo é a imagem 2, azul é a
imagem 1, vermelho é a imagem 3".

## O diagnóstico: hoje as duas coisas não se conhecem

Está no schema, e é literal:

```prisma
model ProductVariant {
  size      VariantSize
  colorName String      @db.VarChar(60)
  colorHex  String?     @db.VarChar(7)   // a bolinha de cor na UI
}

model MediaAsset {
  url       String
  sortOrder Int @default(0)
  productId Int?                          // pertence ao PRODUTO
}
```

A variante sabe a cor. A imagem sabe o produto. **Nada liga as duas.**

O efeito na loja é o que o cliente descreveu: em `/wear/[slug]`, escolher
"Fúcsia" no `SeletorDeVariante` troca o preço e a disponibilidade, e a galeria
continua exatamente igual. A bolinha de cor no card também é só um `hex`
desenhado, sem foto por trás.

## A escolha explícita é a certa, e a automática é uma armadilha

O cliente ofereceu os dois caminhos. O segundo é o bom, e vale registrar por quê.

**Amarrar pela ordem** ("a 1ª cor usa a 1ª imagem") parece economizar uma tela e
cobra caro depois: no dia em que alguém reordenar as fotos, subir uma foto de
detalhe no meio, ou cadastrar a terceira cor antes da foto dela chegar, a
associação passa a estar errada **em silêncio**. Ninguém recebe erro. O site
mostra a camiseta azul para quem clicou em vermelho, e isso vira reclamação de
cliente, não alerta de sistema.

Associação implícita por posição é o mesmo tipo de defeito que este projeto já
combate em outros lugares: uma regra que depende de alguém lembrar da ordem.

## Modelo proposto: a imagem declara qual cor ela mostra

Um campo, na ponta certa:

```prisma
model MediaAsset {
  /// A cor que esta foto mostra. Nulo = serve para qualquer cor.
  ///
  /// Casa com `ProductVariant.colorName` por TEXTO, e não por id, porque cor
  /// não é uma linha própria no banco: ela vive repetida em cada variante
  /// (P/M/G da mesma cor são três linhas com o mesmo `colorName`).
  colorName String? @db.VarChar(60)
}
```

Como a loja passa a se comportar:

| Situação                         | O que a galeria mostra                     |
| -------------------------------- | ------------------------------------------ |
| Nenhuma foto marcada com cor     | Igual a hoje. Nada quebra.                 |
| Cor escolhida tem fotos marcadas | As fotos daquela cor, seguidas das sem cor |
| Cor escolhida sem foto própria   | As sem cor. Nunca a foto de outra cor.     |

A última linha é a regra que importa: **na dúvida, mostrar foto neutra, nunca a
cor errada.** Foto genérica é uma informação faltando; foto da cor errada é uma
informação falsa.

### Por que um campo e não uma tabela de ligação

Uma peça de roupa fotografada mostra **uma** cor. Uma tabela `MediaAssetColor`
permitiria uma foto pertencer a várias cores, o que não é caso real aqui, e
custaria mais uma tela no CRM para um ganho que ninguém pediu.

Se aparecer o caso (uma foto de vitrine com as três cores lado a lado), ele já
é atendido por `colorName = null`, que significa exatamente "serve para todas".

## O que muda no CRM

Na tela de mídia do produto, cada foto ganha **um seletor com as cores que
aquele produto já tem cadastradas**, mais a opção "Serve para todas".

Detalhes que decidem se isso funciona na prática:

1. **O seletor lista as cores do produto**, não um campo de texto livre. Texto
   livre produz "Azul", "azul" e "Azul Marinho " com espaço no fim, e aí a
   associação falha sem avisar.
2. **Cadastrar a cor vem antes de subir a foto.** Se não houver variante, o
   seletor aparece desabilitado dizendo por quê, em vez de sumir.
3. **A ordem continua sendo `sortOrder`**, dentro de cada cor. As duas coisas
   são independentes: cor diz QUAL grupo, ordem diz a sequência dentro dele.
4. **Aviso, não erro, quando uma cor fica sem foto.** É um estado legítimo
   (a foto ainda não chegou), e o site já sabe degradar. Mas quem cadastra
   precisa saber que ficou assim.

## O que muda na loja

- `GaleriaDoProduto` recebe a cor selecionada e filtra.
- `SeletorDeVariante` passa a trocar a galeria junto com o preço.
- `CardProduto`: a `capaAlternativa` do hover deve respeitar a mesma regra, senão
  a segunda foto do card pode mostrar outra cor. Hoje o comentário do card diz
  que ela é "o mesmo produto de outro ângulo, nunca outra cor" — essa promessa
  passa a ser **verificável** em vez de combinada.

## Ordem de execução sugerida

1. Migration com `colorName` em `MediaAsset` (nulo, sem quebrar nada).
2. Seletor na tela de mídia do CRM.
3. Filtro na galeria da loja.
4. Aviso de "cor sem foto" no cadastro.

Os passos 1 e 2 já entregam valor sozinhos: o dado passa a existir, e a loja
continua funcionando igual até o passo 3.

---

## Como ficou (19/08/2026)

A ordem de execução sugerida acima foi seguida inteira.

### 1. O modelo

`MediaAsset.colorName`, nulo por padrão. A migração não quebra nada: toda foto
existente continua servindo para toda cor, e a associação só passa a existir
onde alguém a declarar. Sem índice, e o porquê está escrito no cabeçalho da
migração.

### 2. A regra, pura

`src/lib/media/cor-da-foto.ts`, com 19 casos de teste. Ela existe fora de
qualquer tela porque TRÊS lugares precisam concordar: a galeria da peça, a
segunda foto do card no hover, e o aviso do CRM. Escrita três vezes, divergiria
na primeira correção.

Quatro mutações foram usadas para provar que os testes mordem: completar a
galeria com o que sobrou, inverter a ordem dos grupos, normalizar acento junto
com caixa, e contar foto neutra como foto da cor. Todas derrubam casos.

### 3. A conferência é do servidor

`definirCorDaFoto` recusa cor que a peça não tem. O `<select>` do CRM é
cortesia; o `fetch` continua chamável do console, e um `colorName` sem variante
correspondente produz o pior estado possível deste campo: **a foto não é da cor
de ninguém e também não é neutra, então some da galeria para sempre, sem erro e
sem aviso.**

A comparação usa a MESMA `normalizarCor` que a loja usa para filtrar. Se as
duas divergissem, a foto gravaria "ok" e sumiria da vitrine.

### 4. A promessa do card virou conta

`card-produto.tsx` sempre disse, em comentário, que a segunda foto é "a mesma
peça de outro ângulo, nunca outra cor". Era combinado, não verificado: a
alternativa era `imagens[1]`, e numa peça com três cores fotografadas a segunda
imagem é a de OUTRA cor. O card prometia ângulo e entregava troca de cor no
hover.

Agora `capaEAlternativa` só faz par dentro do mesmo grupo de cor. Sem par, não
há hover: uma foto a menos é informação faltando; a foto de outra cor é
informação falsa.

### 5. Verificado na tela, com foto de verdade

`scripts/foto-temp.ts` ganhou o modo de peça: uma foto por cor, com o nome da
cor escrito na imagem, para o acerto ou o erro aparecerem de relance. Medido no
navegador, na baby look de três cores: escolher Fúcsia troca a galeria para a
foto Fúcsia, escolher Cinza Prata troca para a dela, e o `capaAlternativa` da
peça sai `null` porque não existe uma segunda foto laranja.

As fotos de preview foram removidas depois. Para ver de novo:

```bash
npx tsx --env-file=.env scripts/foto-temp.ts
```

E para desfazer, o mesmo comando com `--limpar`.

---

## PARADO em 20/08/2026 — o mapa de foto por cor

A tela que dizia **qual foto é de qual cor** (`components/crm/fotos-da-peca.tsx`)
saiu do painel quando a lista de peças virou grade de quadrados, e a saída não
foi intencional: ela morava dentro do bloco de cada produto na lista antiga.

O componente **continua no repositório, sem uso**, de propósito. Decisão do
cliente no mesmo dia: ele volta **junto com o Cloudinary**, porque subir a foto
e declarar a cor dela são a mesma tarefa e merecem a mesma tela. Recolocá-lo
antes disso entregaria uma tela que não tem foto nenhuma para marcar.

O que já existe e continua de pé:

- a coluna `MediaAsset.colorName`, com o dado de quem já tiver foto;
- a leitura pública, que escolhe a foto da cor escolhida na loja;
- os quadros por cor no formulário de peça, que hoje são molduras inertes e
  viram o destino do upload quando o storage ligar.

O que NÃO existe hoje: um jeito de, pelo painel, apontar uma foto já existente
para uma cor. Em produção isso importa se as peças de lá tiverem imagem.
