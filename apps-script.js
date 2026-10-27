/**
 * PLANILHA DE PEDIDOS GENESIS (opcional)
 *
 * 1. Crie uma Planilha Google e renomeie a aba para: Pedidos
 * 2. Na linha 1, cole este cabeçalho (uma palavra por coluna, separadas por TAB):
 *    Data	Pedido	Pagamento ID	Status	Valor total	Frete	Forma	Cliente	CPF/CNPJ	E-mail	WhatsApp	Endereço de entrega	Itens
 * 3. Extensões → Apps Script → apague tudo, cole este código e troque o SEGREDO abaixo.
 * 4. Implantar → Nova implantação → Tipo "App da Web"
 *      Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
 *    Copie a URL gerada e cadastre na Vercel como PLANILHA_URL.
 *    Cadastre também PLANILHA_SEGREDO com o mesmo texto do SEGREDO.
 */

const SEGREDO = 'troque-por-uma-senha-longa';

function doPost(e) {
  const dados = JSON.parse(e.postData.contents || '{}');
  if (dados.segredo !== SEGREDO) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false }));
  }

  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pedidos');
  const linha = [
    dados.data, dados.pedido, "'" + dados.pagamento_id, dados.status, dados.valor_total,
    dados.frete, dados.forma, dados.cliente, "'" + dados.documento, dados.email,
    "'" + dados.whatsapp, dados.entrega, dados.itens,
  ];

  // Se o pagamento já está na planilha, só atualiza a linha (ex.: Pix pendente → aprovado).
  const ids = aba.getRange(1, 3, Math.max(aba.getLastRow(), 1), 1).getValues().map(function (l) {
    return String(l[0]).replace("'", '');
  });
  const existente = ids.indexOf(String(dados.pagamento_id));
  if (existente > 0) {
    aba.getRange(existente + 1, 1, 1, linha.length).setValues([linha]);
  } else {
    aba.appendRow(linha);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }));
}
