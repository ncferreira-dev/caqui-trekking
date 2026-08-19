# 19 · Acesso, ordem da vitrine, trilha e tetos (18/08/2026)

Fecha os sete itens que sobraram do levantamento de
[15-mapa-da-api.md](15-mapa-da-api.md), menos os que dependem de imagem.

## 1. Revogar acesso

**O buraco.** `User.active` existe desde o primeiro dia. O guard o consulta a
cada requisição, e a tela de Configurações imprimia "Desativado" como estado
possível. **Nada no sistema escrevia esse campo**: não havia
`PATCH /api/admin/users/:id`. O CRM sabia criar acesso e não sabia tirar.

É a diferença entre ter controle de acesso e ter uma lista de quem entrou uma
vez.

**O que entrou.** A rota, exclusiva do OWNER, com `nome`, `ativo`, `role` e
`senha`. E o painel "Quem tem acesso" passou a operar de verdade.

**As travas, e o que cada uma protege:**

- **Não mexer em si mesmo** (desativar, rebaixar): é trancar-se para fora com
  um clique, no meio da sessão, sem ninguém do outro lado para reabrir.
- **Sempre sobrar um dono ativo**: mora DENTRO da transação, com a tabela de
  usuários travada por `FOR UPDATE`. Pelo caminho normal ela nunca dispara,
  porque a trava acima já garante que quem pediu continua ativo. Ela existe
  para o que a lógica sozinha não cobre: dois pedidos simultâneos, cada um
  desativando o outro dono, os dois lendo "ainda há dois".

As duas se sobrepõem, e por isso os testes atacam **uma de cada vez**: o da
trava de si-mesmo roda com um segundo dono na mesa, para que só ela possa
produzir a recusa; o da invariante chama o serviço direto, com o chamador já
inativo, que é o estado que a corrida produziria. Sem esse cuidado as duas
mutações passavam verdes, e foi assim que o problema apareceu.

> ⚠️ **O `FOR UPDATE` não tem teste, e isso é declarado.** Removê-lo não derruba
> nenhum caso da suíte: a corrida que ele impede não é reproduzível de forma
> determinística num teste sequencial. Os testes provam a CONFERÊNCIA; a
> serialização fica na conferência humana.

**A sessão morre na mesma requisição.** Desativar, reativar e trocar senha
incrementam o `tokenVersion`. Para o `ativo: false` o guard já barra sozinho;
o incremento cobre o outro lado, que é REATIVAR devolvendo validade a um cookie
que passou semanas fora do controle da empresa. Trocar a própria senha derruba
a própria sessão, e a tela manda a pessoa ao login em vez de deixá-la numa
página morta.

## 2. A ordem da vitrine

**O buraco.** `/trekking` e `/wear` ordenam por `featured` e `sortOrder`. Os
dois campos existem desde o primeiro dia e o site os obedece. Nenhuma tela
escrevia nenhum dos dois: a etiqueta "destaque" na lista de roteiros era
decoração de leitura, e a ordem era a que o seed deixou.

**O que entrou.** `PATCH /api/admin/{trips,products,guides}/reorder`, com o
manifesto COMPLETO numa transação só, e setas de subir/descer nas três telas.

**Subir/descer e não arrastar.** Arrastar custa uma biblioteca, um caminho
alternativo obrigatório para teclado (WCAG 2.2) e um alvo confiável no polegar.
Dois botões de 44px resolvem os três de graça.

**A precedência real, que não estava escrita em lugar nenhum:**

```
data marcada  >  destaque  >  ordem manual
```

`listarTrips` ordena no banco por destaque e ordem, e DEPOIS reordena em JS
pondo quem tem saída futura na frente. A terceira regra vence as duas. Está
certo (roteiro sem data não dá para comprar), e tem um efeito que a interface
precisa contar: **marcar destaque num roteiro sem data não muda nada na tela**.
Por isso o aviso aparece na tela onde a decisão é tomada, e a precedência virou
teste.

As duas listas do CRM passaram a ser ordenadas como a vitrine, e não agrupadas
por estado: as setas não podem mostrar uma posição e gravar outra.

## 3. As duas trilhas que ninguém lia

`DepartureAvailabilityChange` e `AuditLog` recebiam linha a cada mudança, com
autor, IP, antes e depois, dentro da mesma transação. Vinte e seis ações
distintas. Nenhuma tela mostrava nada.

- **Histórico do selo**: `<details>` na própria linha da saída. Vem na mesma
  consulta, `take: 5`, porque a Caqui tem unidades de saída.
- **"O que mudou"**: painel em Configurações com as 30 últimas. ADMIN vê tudo
  menos o que aconteceu com acesso.

A tela traduz a chave crua (`departure.vagas`) para o que a pessoa lê. Assim
que ela abriu, três ações apareceram cruas — duas escritas com um ternário, que
a varredura manual não pegou. Virou trava: `travas-do-crm.test.ts` varre o
servidor e falha quando alguém acrescenta ação e esquece da tradução, e falha
também quando sobra tradução para ação que não existe mais.

## 4. Senha esquecida

O caso normal ficou dentro do painel: o dono troca a senha de qualquer pessoa
da equipe. Sobra um caso, e só ele: **o único dono esqueceu a própria senha**.

`scripts/resetar-senha.ts`, com as cinco travas de operação destrutiva:

1. ensaio por padrão (sem `--aplicar` não escreve)
2. `--destino=<trecho>` conferido contra a string de conexão real
3. `--como=email` obrigatório, vai para a trilha
4. conferência antes de escrever (conta existe, está ativa, senha longa)
5. **a senha entra por variável de ambiente, não por argumento** — argumento
   fica no histórico do shell e aparece em `ps` para qualquer processo da
   máquina

Não é "esqueci minha senha" na tela porque isso exige e-mail transacional, que
o projeto não tem, e uma rota pública que aceita e-mail e dispara ação, que é a
superfície mais atacada de qualquer painel.

## 5. Arquivar roteiro e peça

`DELETE /api/admin/trips/:id` existia e nenhuma tela chamava.
`DELETE /api/admin/products/:id` não existia: `Product.deletedAt` estava no
schema, era respeitado em toda leitura pública, e nenhum caminho do sistema o
escrevia.

Dava para esconder os dois pondo em rascunho. Só que rascunho significa "ainda
não está pronto", e a peça descontinuada ficava para sempre no meio da tela de
quem opera.

Soft delete nos dois, só do OWNER. O texto da confirmação diz o que arquivar
**não** faz: as saídas já realizadas continuam registradas, as variantes ficam,
e a mochila de quem já adicionou avisa em vez de quebrar.

## 6. Paginação

O defeito não era a falta de navegação, era o **teto mudo**: as telas liam com
`take: 100` (ou 200) e mais nada. No dia em que cortasse, a tela mostraria 100
linhas com a cara de "são todas".

`lib/crm/paginacao.ts` é pura, porque todo defeito de paginação é aritmético e
invisível: a página 3 pulando um item, a última vindo vazia, `?pagina=0`
virando `skip: -50`. Nada disso quebra nada, só some um registro.

A contagem aparece SEMPRE, mesmo com uma página só. "13 de 13" numa tela sem
setas parece redundante e é a frase que garante que nada ficou de fora.

O calendário de saídas não pagina: ele é recortado por mês por definição.

## 7. Teto nas leituras públicas

Sete rotas de leitura sem limite nenhum. Não é corrupção de dado, é conta: na
Vercel cada chamada é invocação cobrada, e no Neon é conexão ocupada.

240 por minuto por IP, em memória. Nenhuma pessoa navegando chega perto; quem
chega está em laço. As páginas do site não passam por aqui (chamam os serviços
direto no servidor), então o teto só alcança consumidor externo.

`travas-da-api.test.ts` varre `src/app/api` e falha se uma rota pública de GET
nascer sem teto.

> A primeira versão dessa varredura procurava o NOME da função, e o `import`
> sozinho já a satisfazia: apagar a chamada e deixar o import passava verde. Foi
> pego por mutação, não por revisão. Agora ela procura a chamada, com as linhas
> de import removidas antes.

## O que continua faltando

- Tudo que depende de foto: upload real (Cloudinary sem credencial),
  galeria, foto de guia, e a ligação cor ↔ imagem
  ([14](14-cadastro-de-produto.md)).
- O redesenho do CRM ([12](12-redesign-crm.md)), esperando `app-shell.tsx` e
  `dashboard.tsx`.
- **Nada disto está no ar.** O repositório tem mais de cem arquivos sem commit,
  e a migração `20260818170500_vagas_e_fechamento_de_saida` não foi aplicada em
  produção.
