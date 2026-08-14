# 09a — Catálogo de óculos da Caqui Wear

> Levantamento das 26 fotos de óculos entregues pelo cliente, e a estrutura
> de produto que sai delas. Insumo do PROMPT 09.

---

## De onde vem

As 26 fotos estavam classificadas como "roteiros" desde o PROMPT 05, por causa
do nome de arquivo do WhatsApp (`IMG-2024…-WA….jpg`). Abrindo as imagens, são
óculos de sol da marca. Ver `assets/README.md`.

Cada foto foi aberta e descrita — formato, cor da armação, cor da lente,
material da haste, proteção lateral, preço impresso e enquadramento.

---

## O preço acompanha o material da haste

Não é coincidência: é a estrutura do catálogo, e ela caiu pronta.

| Linha     | Preço    | Fotos | O que define                  |
| --------- | -------- | ----: | ----------------------------- |
| Acetato   | R$ 59,90 |    11 | armação inteira em acetato    |
| Madeira   | R$ 71,90 |    13 | haste de madeira ou bambu     |
| Espelhado | R$ 89,90 |     2 | laranja da marca, aro e lente |

---

## Formato é PRODUTO, cor é VARIANTE

O eixo de variante do schema é `size × colorName` (`@@unique([productId,
size, colorName])`). Não existe eixo de formato. Então wayfarer, redondo e
glacier são produtos diferentes — e têm preços diferentes de qualquer jeito.

Codificar o formato dentro de `colorName` funcionaria e seria mentira: o CRM
passaria a listar "Marrom Glacier" como se fosse uma cor, e o seletor de cor
da página do produto mostraria silhuetas diferentes lado a lado como se
fossem a mesma peça.

Todas as variantes usam `size: UNICO`.

---

## Os 10 produtos

### 1. Óculos Glacier Caqui

`oculos-glacier-caqui` · **R$ 59,90** · `ACESSORIO` · 2 fotos

Óculos de sol estilo montanhismo, com aba lateral perfurada que corta a luz que entra pelo canto do olho. Lente marrom, armação em acetato.

| Cor           | Hex       | Fotos |
| ------------- | --------- | ----: |
| Marrom Escuro | `#4A3B32` |     2 |

### 2. Óculos Quadrado Caqui

`oculos-quadrado-caqui` · **R$ 59,90** · `ACESSORIO` · 2 fotos

Armação quadrada preta fosca em acetato, com lente espelhada prateada.

| Cor   | Hex       | Fotos |
| ----- | --------- | ----: |
| Preto | `#0D0D0D` |     2 |

### 3. Óculos Redondo Caqui

`oculos-redondo-caqui` · **R$ 59,90** · `ACESSORIO` · 2 fotos

Armação redonda em acetato translúcido, lente marrom. Silhueta clássica.

| Cor               | Hex       | Fotos |
| ----------------- | --------- | ----: |
| Vinho Translúcido | `#6B2F2F` |     2 |

### 4. Óculos Aviador Redondo Caqui

`oculos-aviador-redondo-caqui` · **R$ 59,90** · `ACESSORIO` · 1 foto

Lentes redondas com ponte dupla — a barra reta ligando os aros, do aviador clássico. Lente cinza escura.

| Cor           | Hex       | Fotos |
| ------------- | --------- | ----: |
| Marrom Escuro | `#3A2E28` |     1 |

### 5. Óculos Wayfarer Caqui

`oculos-wayfarer-caqui` · **R$ 59,90** · `ACESSORIO` · 4 fotos

O wayfarer da Caqui em acetato, com a marca gravada na haste. Quatro cores.

| Cor                | Hex       | Fotos |
| ------------------ | --------- | ----: |
| Preto              | `#0D0D0D` |     1 |
| Preto Degradê      | `#2B2B2B` |     1 |
| Marrom Degradê     | `#6E6058` |     1 |
| Marrom Avermelhado | `#5A3A32` |     1 |

### 6. Óculos Quadrado Madeira Caqui

`oculos-quadrado-madeira-caqui` · **R$ 71,90** · `ACESSORIO` · 6 fotos

Armação quadrada com haste de madeira e a marca gravada. Lente polarizada.

| Cor               | Hex       | Fotos |
| ----------------- | --------- | ----: |
| Preto             | `#0D0D0D` |     4 |
| Vinho Translúcido | `#6B2F2F` |     2 |

### 7. Óculos Redondo Madeira Caqui

`oculos-redondo-madeira-caqui` · **R$ 71,90** · `ACESSORIO` · 2 fotos

Aro redondo com haste de madeira. Lente marrom.

| Cor                | Hex       | Fotos |
| ------------------ | --------- | ----: |
| Preto              | `#0D0D0D` |     1 |
| Marrom Avermelhado | `#5A3A32` |     1 |

### 8. Óculos Wayfarer Madeira Caqui

`oculos-wayfarer-madeira-caqui` · **R$ 71,90** · `ACESSORIO` · 4 fotos

O wayfarer com haste de madeira e a marca gravada. Três cores.

| Cor               | Hex       | Fotos |
| ----------------- | --------- | ----: |
| Preto             | `#0D0D0D` |     2 |
| Marrom Escuro     | `#4A3B32` |     1 |
| Vinho Translúcido | `#6B2F2F` |     1 |

### 9. Óculos Hexagonal Madeira Caqui

`oculos-hexagonal-madeira-caqui` · **R$ 71,90** · `ACESSORIO` · 1 foto

Aro hexagonal com haste de madeira e lente espelhada dourada.

| Cor   | Hex       | Fotos |
| ----- | --------- | ----: |
| Preto | `#0D0D0D` |     1 |

### 10. Óculos Espelhado Laranja Caqui

`oculos-espelhado-laranja-caqui` · **R$ 89,90** · `ACESSORIO` · 2 fotos

Wayfarer laranja fosco com lente espelhada laranja — a cor da marca inteira, do aro à lente.

| Cor     | Hex       | Fotos |
| ------- | --------- | ----: |
| Laranja | `#F26522` |     2 |

---

## Duas dívidas conscientes

### O preço está queimado nas 26 imagens

Toda foto tem uma etiqueta branca com o valor impresso. Decidido em 14/08/2026
**deixar como está**, com o risco assumido: quando a Caqui reajustar o preço no
CRM, a foto vai continuar mostrando o valor antigo, e o cliente acredita na
foto. É o tipo de coisa que vira reclamação no WhatsApp — e a correção, quando
vier, é pedir as fotos sem a etiqueta ou recortar a faixa.

Contradiz a regra do projeto de que preço vive no banco e é editável no CRM.
Está registrado aqui para não virar surpresa.

### Uma foto por cor, e a galeria é do produto

A convenção de importação liga foto a **produto**, não a variante. Num produto
de 4 cores como o `oculos-wayfarer-caqui`, as 4 fotos entram na mesma galeria e
quem escolhe "Preto" continua vendo a foto do marrom ao lado.

É exatamente a decisão em aberto registrada em `docs/relatorio-fase-a.md` sobre
foto por cor das camisetas. Os óculos tornam o problema mais visível, porque a
cor É o produto aqui.

---

## O que falta para importar

1. **Cadastrar os 10 produtos** — o script de importação não cria produto, e
   recusa grupo cujo slug não existe no banco. É a próxima etapa do PROMPT 09.
2. **Renomear os arquivos** — `assets/_oculos/renomear.sh` está gerado e não
   executado, seguindo a mesma regra do `--renomear`. Ele move as 26 fotos para
   `assets/wear/` já na convenção `<slug>__<NN>__<alt>.jpg`.
3. **Credenciais do Cloudinary** no `.env` — sem elas o upload responde 503.
