# Loja Genesis — pagamento Mercado Pago e frete Princesa dos Campos

## O que tem nesta pasta

```
index.html            a página (substitui a atual)
lib/catalogo.js       PREÇOS, pesos das embalagens e origem do frete — é aqui que você edita
lib/mercadopago.js    conexão com o Mercado Pago (não precisa mexer)
lib/brudam.js         conexão com a transportadora (não precisa mexer)
lib/frete.js          cálculo do frete (não precisa mexer)
lib/pedido.js         conferência dos itens do carrinho (não precisa mexer)
lib/olist.js          conexão com o Olist ERP: pedido, NF-e e estoque (não precisa mexer)
api/catalogo.js       a página busca os preços oficiais aqui
api/frete.js          calcula o frete pelo CEP (carrinho e formulário)
api/checkout.js       gera a cotação do frete e o pagamento no Mercado Pago
api/pedido.js         confere o pagamento quando o cliente volta
api/webhook.js        recebe avisos do Mercado Pago, aprova a cotação, lança no Olist e grava na planilha
api/olist.js          confere a ligação com o Olist: abra /api/olist no navegador
planilha/apps-script.js   código da planilha de pedidos (opcional)
package.json          configuração da Vercel (não precisa mexer)
```

## Imagens

Este pacote traz só as **imagens novas**, dentro de `assets/img/`:

```
genesis_logo.png             logo completo (fundo transparente)
genesis_escudo.png           só o escudo
genesis_favicon.png          ícone da aba do navegador
banner_carro.jpg             banner do topo
banner_carro_celular.jpg     banner do topo no celular
pelicula_metal_hp.jpg        foto da Metal HP Cerâmico (caixa Nano Metal)
pelicula_photochromic.jpg    foto da Photochromic Series
```

As demais **fotos dos produtos** continuam na pasta `assets/img/` do seu repositório. Ao subir, **coloque esses arquivos dentro da pasta `assets/img/` que já existe**. Não apague nem substitua a pasta inteira, senão as fotos dos produtos somem.

## Como fica a compra

1. O cliente monta o carrinho: películas e PPF em bobina fechada e ferramentas por unidade.
2. Digita o CEP e vê o **frete e o prazo da Princesa dos Campos**.
3. Clica em **Finalizar compra**, preenche os dados e o endereço (o CEP completa rua, bairro e cidade).
4. A loja gera a cotação na transportadora e leva o cliente ao **Mercado Pago**, para pagar com Pix, cartão ou boleto.
5. Ele volta para o site e vê "Pagamento aprovado" com o número do pedido. A cotação do frete é aprovada na transportadora sozinha.

O botão **Prefiro fechar pelo WhatsApp** continua no carrinho.

**Enquanto o pagamento online não estiver ativo** (no GitHub Pages, ou na Vercel sem o `MP_ACCESS_TOKEN`), o carrinho mostra **Escolher forma de pagamento**, com duas opções:
- **Pix direto para a Genesis:** QR Code e "Pix copia e cola" com o valor dos produtos, para a chave CNPJ 62.406.067/0001-88. O cliente envia o comprovante pelo WhatsApp, e a equipe passa o frete da Princesa dos Campos à parte.
- **Cartão ou boleto:** o cliente pede no WhatsApp o link de pagamento do Mercado Pago, já com o frete.

A mensagem do WhatsApp chega com o número do pedido (o mesmo que aparece no Pix), os itens, o total e o CEP.

## Passo a passo para colocar no ar

**1. Subir os arquivos**
Suba esta pasta no repositório ligado à **Vercel** (o do lojaoficial.genesisprotection.com.br), juntando as imagens novas na pasta `assets/img/` que já existe. No GitHub Pages o pagamento e o frete não funcionam, porque lá não roda a parte de servidor.

**2. Pegar o Access Token do Mercado Pago (conta PJ da Genesis)**
1. Entre em mercadopago.com.br/developers com a conta da Genesis e abra **Suas integrações**.
2. Clique em **Criar aplicação**, dê um nome (ex.: "Loja Genesis") e escolha **Pagamentos online → Checkout Pro**.
3. Dentro da aplicação, abra **Credenciais de produção**. Se pedir, preencha o setor e o endereço do site para ativar.
4. Copie o **Access Token** (começa com `APP_USR-`).

**3. Cadastrar na Vercel** (projeto → *Settings → Environment Variables*)

| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | o Access Token do passo 2 |
| `SITE_URL` | `https://lojaoficial.genesisprotection.com.br` (sem barra no final) |
| `BRUDAM_USUARIO` | o "usuario" que a transportadora enviou |
| `BRUDAM_SENHA` | a "senha" que a transportadora enviou |
| `BRUDAM_SERVICO` | `27` |

Já estão no código, não precisa cadastrar: o CNPJ da Guardian (62.406.067/0001-88), o CNPJ da base Londrina da transportadora (80.227.796/0059-75) e a origem (R. Tupi, 620, Londrina/PR).

Esses dados de acesso ficam **só na Vercel**. Não coloque no `index.html`, no `catalogo.js` nem em nenhum arquivo do GitHub.

**4. Publicar**
Em *Deployments*, clique em **Redeploy** para as variáveis valerem.

**5. Testar**
- **Frete:** coloque um produto no carrinho e digite um CEP. Deve aparecer "Princesa dos Campos: R$ …" com o prazo. Se aparecer erro, abra na Vercel *Deployments → (último) → Logs* e procure "Frete Brudam": a mensagem da transportadora aparece ali.
- **Pagamento:** compre o item mais barato (Mini Raspador, R$ 9,50 + frete) pagando com Pix e depois devolva o valor pelo painel do Mercado Pago. Teste no domínio oficial, não no link de preview.
- Para testar o frete no ambiente de testes da transportadora em vez do real, cadastre `BRUDAM_AMBIENTE` = `homologacao`. Sem essa variável, a loja usa o ambiente real (produção).

## Pesos das embalagens (frete)

A transportadora cobra pelo **peso real**, na tabela da Guardian. Os pesos em `lib/catalogo.js`, em `EMBALAGENS`, estão **aproximados** até vocês pesarem:

| Embalagem | Peso usado |
|---|---|
| Película 1,52 × 30 m | 7 kg |
| Película 1,52 × 15 m | 4 kg |
| Photochromic 1,52 × 10 m | 3 kg |
| PPF 1,52 × 15 m | 11 kg |
| Camaleão 0,50 × 5 m | 1,5 kg |
| Cada ferramenta | 0,3 kg (+ 0,3 kg da caixa) |

Para trocar, edite o número depois de `peso:` (use ponto: `6.5`, não `6,5`). As medidas (altura `a`, largura `l`, comprimento `c`, em metros) são opcionais.

## Trocar preços

Abra `lib/catalogo.js`. Use ponto nos centavos (`1217.60`, não `1.217,60`). A página e o pagamento passam a usar o novo valor sozinhos.

- **Películas:** em `PELICULAS`, troque o valor dentro de `bobinas`, por exemplo `bobinas: { 30: 2950.00, 15: 1650.00 }`. O preço vale para todas as tonalidades daquele produto.
- **PPF e PPF colorido:** troque o `preco` da bobina em `PPF` ou `PPF_COLORIDO`.
- **Ferramentas:** troque o `preco` em `FERRAMENTAS`.
- **Frete por região (reserva):** os valores ficam no fim do arquivo, em `FRETE`. Só valem quando a transportadora não está configurada.

Produto novo, tonalidade nova ou tamanho de bobina novo também mudam a página. Nesses casos, me mande a informação que eu atualizo os arquivos juntos.

## Onde ver as vendas

- **Mercado Pago:** cada venda aprovada chega por e-mail e no app, com valor e itens.
- **Transportadora:** cada pedido pago gera uma cotação **aprovada** no sistema da Princesa dos Campos. O número dela fica no pedido do Mercado Pago e na planilha, para pedir a coleta.
- **Planilha (opcional, recomendado):** grava cada pedido com cliente, CPF/CNPJ, WhatsApp, endereço de entrega, itens, prazo e número da cotação do frete. Siga as instruções no topo de `planilha/apps-script.js` e cadastre na Vercel `PLANILHA_URL` e `PLANILHA_SEGREDO`.

- **Olist:** cada pagamento aprovado vira um pedido **aprovado** no Olist, com cliente, endereço, itens e frete, e o marcador "Loja online". Reembolso ou cancelamento no Mercado Pago cancela o pedido no Olist. A NF-e é emitida pela equipe no Olist, a não ser que `OLIST_NF=automatica` esteja na Vercel. Para conferir a ligação, abra `https://lojaoficial.genesisprotection.com.br/api/olist`; para conferir um código, `/api/olist?codigo=GD037CUT`. Os códigos dos produtos no Olist precisam ser iguais aos da loja; quando forem diferentes, preencha `CODIGOS_OLIST` em `lib/catalogo.js`.

## Segurança

- O Access Token do Mercado Pago e a senha da transportadora ficam só na Vercel; nunca aparecem na página.
- O valor dos produtos e do frete é sempre calculado no servidor. Mesmo que alguém altere algo no navegador, o Mercado Pago recebe os valores oficiais.
- Mais de 20 bobinas do mesmo item, ou produto inexistente, são recusados.
