# Loja Genesis — pagamento com Mercado Pago

## O que tem nesta pasta

```
index.html            a página (substitui a atual)
lib/catalogo.js       PREÇOS das bobinas, das ferramentas e do frete — é aqui que você edita
lib/mercadopago.js    conexão com o Mercado Pago (não precisa mexer)
api/catalogo.js       a página busca os preços oficiais aqui
api/checkout.js       cria o pagamento no Mercado Pago
api/pedido.js         confere o pagamento quando o cliente volta
api/webhook.js        recebe avisos do Mercado Pago e grava na planilha (opcional)
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
```

As **fotos dos produtos** (películas, PPF e ferramentas) continuam na pasta `assets/img/` do seu repositório. Ao subir, **coloque esses 5 arquivos dentro da pasta `assets/img/` que já existe**. Não apague nem substitua a pasta inteira, senão as fotos dos produtos somem.

Abrindo o `index.html` direto do computador, só aparecem as imagens que estiverem na pasta `assets/img/` ao lado dele.

## Como fica a compra

1. Cliente monta o carrinho: películas e PPF em bobina fechada (escolhe tonalidade e tamanho da bobina) e ferramentas por unidade.
2. Clica em **Finalizar compra**, preenche dados e endereço (o CEP preenche rua, bairro e cidade sozinho e calcula o frete).
3. Vai para o Mercado Pago e paga com Pix, cartão ou boleto.
4. Volta para o site e vê "Pagamento aprovado" com o número do pedido (ex.: GEN-261014-4F2A1).

O botão **Prefiro fechar pelo WhatsApp** continua no carrinho. Se o pagamento online não estiver configurado, a página volta sozinha a fechar tudo pelo WhatsApp, como antes.

## Passo a passo para ativar

**1. Subir os arquivos**
Suba esta pasta no repositório que está ligado à **Vercel** (o do catalogo.genesisprotection.com.br), mantendo a pasta `assets/`. No GitHub Pages o pagamento não funciona, porque lá não roda a parte de servidor.

**2. Pegar o Access Token no Mercado Pago (conta PJ da Genesis)**
Mercado Pago → *Suas integrações* → *Criar aplicação* → escolha **Checkout Pro** → dentro da aplicação, *Credenciais de produção* → copie o **Access Token** (começa com `APP_USR-`).

**3. Cadastrar na Vercel**
Projeto → *Settings → Environment Variables*:

| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | o Access Token do passo 2 |
| `SITE_URL` | `https://catalogo.genesisprotection.com.br` (sem barra no final) |

Depois, em *Deployments*, clique em **Redeploy** para valer.

**4. Testar de verdade**
Compre o item mais barato (Mini Raspador, R$ 9,50 + frete) pagando com Pix e depois devolva o valor pelo painel do Mercado Pago. Teste no domínio oficial, não no link de preview.

## Trocar preços

Abra `lib/catalogo.js`. Use ponto nos centavos (`1217.60`, não `1.217,60`). A página e o pagamento passam a usar o novo valor sozinhos; não precisa mexer no `index.html`.

- **Películas:** em `PELICULAS`, troque o valor dentro de `bobinas`, por exemplo `bobinas: { 30: 2950.00, 15: 1650.00 }`. O preço vale para todas as tonalidades daquele produto.
- **PPF e PPF colorido:** troque o `preco` da bobina em `PPF` ou `PPF_COLORIDO`.
- **Ferramentas:** troque o `preco` em `FERRAMENTAS`.
- **Frete:** os valores por região ficam no fim do arquivo, em `FRETE`.

Produto novo, tonalidade nova ou tamanho de bobina novo também mudam a página. Nesses casos, me mande a informação que eu atualizo os dois arquivos juntos.

## Onde ver as vendas

- **E-mail e app do Mercado Pago:** cada venda aprovada chega como notificação, com valor e itens.
- **Planilha (opcional, recomendado):** grava cada pedido com nome, CPF/CNPJ, WhatsApp, **endereço de entrega** e itens. Siga as instruções no topo de `planilha/apps-script.js` e cadastre na Vercel `PLANILHA_URL` e `PLANILHA_SEGREDO`.

Sem a planilha, o endereço de entrega fica guardado nos dados do pagamento no Mercado Pago e o cliente também pode mandar pelo botão "Avisar a Genesis no WhatsApp" que aparece depois de pagar.

## Segurança

- O Access Token fica só na Vercel; nunca aparece na página.
- O valor cobrado é sempre calculado no servidor com os preços de `lib/catalogo.js`. Mesmo que alguém altere o preço no navegador, o Mercado Pago recebe o preço oficial.
- Mais de 20 bobinas do mesmo item, ou produto inexistente, são recusados.
