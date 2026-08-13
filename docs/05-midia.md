# 05 — Mídia e uploads

> Fase A, PROMPT 05. 5 rotas novas, 2 scripts, 49 testes.
> Total do projeto: **110 testes**.

---

## A decisão de storage: Cloudinary, corrigido

O projeto de referência usava Cloudinary e **nunca apagou uma imagem sequer**.
Não foi má-fé: o `if` que deveria apagar lia um campo que não existia no
schema, então nunca entrava. O código _parecia_ apagar.

Manter o mesmo provedor foi decisão consciente — o problema nunca foi o
Cloudinary. Foi como ele era usado. Ponto a ponto:

| Lá                                                       | Aqui                                          |
| -------------------------------------------------------- | --------------------------------------------- |
| `multer-storage-cloudinary` prendia o SDK em `1.x`       | SDK v2 direto, sem ponte                      |
| `public_id` **descartado** na resposta                   | persistido em `MediaAsset.publicId`           |
| `grep destroy` → **zero ocorrências**                    | `remover()` no delete e no rollback do upload |
| Sem `f_auto`, `q_auto`, `srcset`, WebP/AVIF, placeholder | tudo isso, na entrega                         |
| Validação só via `allowed_formats` do provedor           | bytes conferidos antes de sair da máquina     |
| Caminho legado em disco servindo 14 JPGs de 2025         | um caminho só                                 |

O `publicId` é o item central. Sem ele não há como apagar — **nem depois, na
mão**: as fotos de lá se chamam `product-0-1757796592563`, sem vínculo
recuperável com o produto. Cada foto que subiu está lá para sempre, e isso é
aluguel eterno pago em cota de storage e banda.

### Configuração ausente é erro alto, não default silencioso

As três variáveis (`CLOUDINARY_CLOUD_NAME`, `_API_KEY`, `_API_SECRET`) são
**opcionais em conjunto e obrigatórias em conjunto**. Preenchidas pela metade,
a aplicação não sobe.

Sem nenhuma delas, o site inteiro funciona — catálogo, agenda, carrinho, CRM.
Só o upload não, e ele responde **503 `MEDIA_STORAGE_UNCONFIGURED` nomeando as
variáveis que faltam**. Há teste verificando os três nomes na mensagem.

Exigi-las no boot impediria `npm run dev` de subir antes de existir uma conta
no provedor, e o remédio seria pior: valor de mentira no `.env` só para o
processo levantar.

---

## Um original armazenado, variantes por URL

O caminho óbvio seria gerar thumb/card/full no upload e guardar três arquivos.
Não é o que fazemos.

- **Três arquivos são três coisas para apagar.** Todo vazamento do projeto de
  referência nasceu de "esqueci de apagar" — e ele tinha _um_ arquivo por
  imagem.
- **`f_auto` escolhe o formato pelo `Accept` do navegador.** Fixar WebP no
  upload congela a decisão no dia do upload. Hoje entrega AVIF para quem
  aceita, e amanhã entrega o que vier depois, sem reprocessar nada.
- **Mudar a largura de um card vira uma constante**, não uma migração de todas
  as imagens já enviadas.

O banco guarda a URL **canônica**, sem transformação. `src/lib/media/urls.ts` é
o único arquivo que conhece o formato de URL do provedor.

```ts
srcsetDe(imagem.url, imagem.width)
// → …/f_auto,q_auto,c_limit,w_320/… 320w, …w_640/… 640w, …
```

`c_limit` é o detalhe que importa: reduz quando a imagem é maior e **não faz
nada quando é menor**. Sem ele, uma foto de 900 px pedida em 1600 seria
ampliada — mais bytes para entregar menos nitidez.

O `srcset` também **nunca oferece largura maior que a imagem real**. Oferecer
`1600w` para uma foto de 880 px faria o navegador escolher com base numa
largura que não existe.

---

## Validação: a ordem das checagens é a funcionalidade

```
1. tamanho em bytes   não custa nada, corta o caso mais caro
2. bytes mágicos      16 bytes, dá o erro preciso
3. decodificação      confirma que os bytes são mesmo uma imagem
4. dimensão mínima    o conteúdo serve para o site?
                      ↓
             só aqui algo sai da máquina
```

O projeto de referência invertia: bufferizava o arquivo inteiro, transferia
para o provedor, e deixava a recusa acontecer lá. Um arquivo de 500 MB era pago
em banda antes de ser recusado.

| Limite         | Valor       | De onde vem                                       |
| -------------- | ----------- | ------------------------------------------------- |
| Tamanho        | **12 MB**   | as 41 fotos da Caqui vão de 133 KB a 2,8 MB       |
| Menor lado     | **600 px**  | a menor foto real tem 880 px; abaixo de 600 borra |
| Por requisição | 10 arquivos | e teto de `Content-Length` antes de bufferizar    |

**Duas camadas de tipo, não uma.** Os bytes mágicos dão o erro preciso e
baratam a recusa; o `sharp` decodifica de verdade. Um `.pdf` com os 3 bytes de
JPEG colados na frente passa na primeira e morre na segunda — há teste.

### Um `alt` por arquivo, pareado por posição

`alt` é **obrigatório estar presente**, e pode ser vazio. String vazia é a
marcação correta de imagem decorativa; o que não pode é o campo faltar, porque
aí o leitor de tela lê o nome do arquivo.

Quantidade diferente de arquivos e de `alt` é **400**. Sem essa checagem, a
foto A recebe a descrição da foto B — erro que ninguém percebe olhando a tela.

No projeto de referência o campo `alt` **não existia no model**: o nome do
produto fazia as vezes, e havia `<img>` sem atributo `alt` nenhum.

---

## HEIC entra, e entra sem blur

Duas das 41 fotos da Caqui são HEIC, tiradas de iPhone. O binário distribuído
do `sharp` **lê o cabeçalho** de um HEIC (dimensões, orientação) mas **não
decodifica os pixels** — falta o plugin de decode.

A escolha foi aceitar assim. A operação inteira da Caqui é feita do celular:
recusar o formato trocaria um enfeite (o placeholder borrado) por uma barreira
real de uso. O `blurDataUrl` é nulável no schema exatamente para isto, e a UI
cai no fundo sólido.

Para os outros formatos, falha de decodificação **não** é tolerada — ali ela
significa arquivo corrompido, e vira 415.

---

## Orientação do EXIF: as dimensões guardadas são as de EXIBIÇÃO

Um JPEG de retrato costuma ser gravado em paisagem com `Orientation: 6`.
Guardar 4032×3024 para uma foto que aparece 3024×4032 produz **CLS** na hora em
que o navegador troca a proporção reservada pela real — e o `width`, o `height`
e o `srcset` passam a mentir juntos.

`dimensoesDeExibicao()` troca os lados para orientações 5 a 8. O placeholder
também nasce girado pelo `.rotate()`, senão ele apareceria deitado e "giraria"
quando a foto real carregasse.

---

## Nenhum órfão, dos dois lados

Órfão tem duas direções, com gravidades diferentes:

| Direção                  | Sintoma                                      |
| ------------------------ | -------------------------------------------- |
| **Arquivo sem registro** | silencioso, cobrado para sempre. Ninguém vê. |
| **Registro sem arquivo** | imagem quebrada na página, visível na hora.  |

Daí a ordem de cada operação:

**Upload** — sobe primeiro, grava depois. Se a gravação falhar, o que já subiu é
removido no `catch`. Se o próprio desfazer falhar, vai um `console.error` com
`ÓRFÃO POTENCIAL` e o `publicId`.

**Delete** — a remoção no storage acontece **dentro da transação**. Se o
provedor recusar, o rollback devolve o registro. Preferimos "o delete falhou,
tente de novo" a "sumiu da lista e o arquivo ficou lá para sempre".

E há `npm run media:orfaos`, que compara os dois lados e lista o que não tem
par. Ele existe porque nenhuma disciplina de código cobre tudo — o
`onDelete: Cascade` do schema apaga linhas de `media_assets` quando um Trip é
removido de verdade, e o provedor não fica sabendo. **O script não apaga nada**:
lista, e a decisão é de quem lê.

---

## A imagem principal é a de `sortOrder` 0 — e isso está declarado

Não existe campo `isPrimary`. Um booleano paralelo à ordem pode desincronizar:
duas principais, nenhuma principal.

Posição carregando significado é exatamente o que deu errado no projeto de
referência (`imagesGoldCount`: as N primeiras eram material Ouro, o resto
Prata). O problema lá **não era ser posicional** — era o significado não estar
declarado em lugar nenhum. Apagar a segunda foto de uma peça com 3 douradas e 2
prateadas fazia o seletor de material mostrar a cor errada, sem erro e sem log,
até um cliente reclamar que recebeu a peça errada.

Aqui: a API devolve `principal: true` **materializado**, o front não deriva
nada, e apagar renumera os irmãos dentro da mesma transação — a galeria nunca
fica sem capa.

### O manifesto de reordenação precisa ser completo

`PATCH /api/admin/media/reorder` recebe a lista **inteira** e recusa com **409**
se faltar um id, sobrar um id, ou vier um id de outro dono. A resposta diz
qual.

A melhor peça do projeto de referência era justamente o manifesto de ordem com
token `"__NEW__"`, que reconciliava fotos existentes e novas. O que faltava era
esta checagem: lá, um manifesto incompleto — um `map` sobre lista filtrada, um
item perdido no estado do React — apagava a diferença sem avisar.

---

## Rotas

| Método   | Rota                        | O que faz                            |
| -------- | --------------------------- | ------------------------------------ |
| `GET`    | `/api/admin/media?tripId=1` | galeria do item, na ordem            |
| `POST`   | `/api/admin/media`          | envia N arquivos (multipart)         |
| `PATCH`  | `/api/admin/media/reorder`  | manifesto completo de ordem          |
| `PATCH`  | `/api/admin/media/:id`      | corrige o `alt`                      |
| `DELETE` | `/api/admin/media/:id`      | apaga do banco **e** do storage      |
| `GET`    | `/api/admin/tags`           | tags com contagem de roteiros        |
| `POST`   | `/api/admin/tags`           | cria (409 em slug repetido)          |
| `PATCH`  | `/api/admin/tags/:id`       | edita label e ícone — **não** o slug |
| `DELETE` | `/api/admin/tags/:id`       | recusa com 409 se estiver em uso     |

Todas exigem sessão (OWNER ou ADMIN) e todas são cobertas pela varredura de
diretório do PROMPT 04, que falha se alguma rota admin nascer sem guard.

**A autenticação vem antes de ler o corpo.** `exigirPapel` é a primeira linha, e
só depois o `formData()` consome o stream — o equivalente ao
`authenticateToken` antes do multer, a única coisa que o fluxo de upload do
projeto de referência acertou.

### Códigos de erro

| Código                       | Status | Quando                                   |
| ---------------------------- | ------ | ---------------------------------------- |
| `MEDIA_INVALID_FILE`         | 415    | não é imagem, ou está corrompida         |
| `MEDIA_TOO_LARGE`            | 413    | acima de 12 MB                           |
| `MEDIA_TOO_SMALL`            | 422    | menor lado abaixo de 600 px              |
| `MEDIA_OWNER_INVALID`        | 400    | zero ou mais de um dono                  |
| `MEDIA_NOT_FOUND`            | 404    | id inexistente                           |
| `MEDIA_STORAGE_UNCONFIGURED` | 503    | credenciais faltando — a mensagem nomeia |
| `MEDIA_STORAGE_FAILED`       | 503    | provedor fora do ar                      |

Três códigos diferentes para "não deu para subir" porque a UI reage diferente a
cada um: arquivo grande pede outro arquivo, tipo inválido pede outro formato, e
storage desconfigurado é problema do servidor. O projeto de referência devolvia
`"Erro ao cadastrar o produto"` para os três.

---

## Importação em lote

Convenção completa em [`assets/README.md`](../assets/README.md).

```
<slug-do-item>__<NN>__<texto-alternativo-em-kebab>.<ext>
```

```bash
npm run media:importar                        # confere, não escreve nada
npm run media:importar -- --aplicar           # sobe
npm run media:importar -- --renomear          # propõe nomes para a pasta crua
```

**O padrão é conferir.** Um script de importação que sobe no primeiro comando é
um script que sobe errado na primeira tentativa.

Idempotente: o `publicId` é derivado do nome (`caqui/<tipo>/<slug>/<NN>`), e o
que já existe é pulado.

### `--renomear` existe porque o material real não segue convenção

As 41 fotos entregues se chamam `Camiseta cinza chumbo poliamida r$60,00
cada(2).jpg` e `IMG-20241102-WA0057.jpg`. Duas **não têm extensão nenhuma** —
são HEIC de iPhone.

O modo `--renomear` agrupa por descrição, detecta o preço que está no nome
(**para conferência; o script nunca grava preço**) e escreve um `renomear.sh`
com os `mv` propostos. Não executa.

A extensão proposta vem dos **bytes**, não do nome — a mesma disciplina do
upload, aplicada na hora de renomear. É o que faz `Canecas r$35,00 cada` virar
`canecas__02__canecas.heic` em vez de um `.jpg` mentiroso.

Rodando contra o material real: 15 arquivos, 9 grupos, tudo dentro da convenção
depois do rename. E aí o script **recusa a importação**, porque nenhum produto
com esses slugs existe no catálogo — ele não cria produtos. Nome de arquivo não
diz categoria nem preço, e adivinhar colocaria peça errada na loja.

---

## Testes

**49 casos** novos.

Os que carregam mais peso:

- **arquivo inválido no meio do lote → zero envios ao storage.** Prova que a
  validação toda acontece antes do primeiro byte sair.
- **falha no meio do lote → o que já subiu é removido.** Nem registro no banco,
  nem arquivo pendurado.
- **storage recusa o delete → o registro NÃO some do banco.**
- **apagar a principal → sobra exatamente uma principal.**
- **manifesto incompleto → 409 e nada muda**, com o id faltante na mensagem.
- **PDF renomeado para `.jpg` → recusado**; a extensão não é consultada.
- **JPEG com cabeçalho válido e conteúdo corrompido → recusado** na segunda
  camada.
- **`urlVariante` idempotente** e URL de outro domínio devolvida intacta.
- **credenciais ausentes → mensagem nomeia as três variáveis.**
- **caçador de órfãos acha nos dois sentidos.**

O dublê de storage **registra cada chamada**. É o que permite afirmar coisas que
nenhum assert sobre o banco alcança — "não houve envio", "houve exatamente uma
remoção, com este `publicId`".

Nenhum binário versionado: as imagens de teste são geradas pelo `sharp` na
hora.
