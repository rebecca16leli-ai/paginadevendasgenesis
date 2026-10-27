// POST /api/checkout — recebe o carrinho e os dados de entrega,
// recalcula tudo com os preços do servidor e cria o pagamento no Mercado Pago.
import { randomUUID } from 'node:crypto';
import { PRODUTOS, calcularFrete } from '../lib/catalogo.js';
import { mercadoPago, enderecoDoSite, lerCorpo, ErroPagamento } from '../lib/mercadopago.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const texto = (v, max = 120) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

function novoNumeroPedido() {
  const d = new Date();
  const data = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const sufixo = randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();
  return `GEN-${data}-${sufixo}`;
}

function validar(corpo) {
  const erros = [];

  // Itens: só aceita produtos do catálogo, quantidade inteira e dentro do limite.
  const agrupados = new Map();
  let itemInvalido = false;
  for (const item of Array.isArray(corpo.itens) ? corpo.itens.slice(0, 80) : []) {
    const id = String(item?.id ?? '');
    const qtd = Number(item?.qtd);
    if (!PRODUTOS[id] || !Number.isInteger(qtd) || qtd < 1) { itemInvalido = true; continue; }
    agrupados.set(id, (agrupados.get(id) || 0) + qtd);
  }
  if (itemInvalido) erros.push('Algum item do carrinho mudou ou não está mais disponível. Atualize a página e confira o carrinho.');
  const itens = [];
  for (const [id, qtd] of agrupados) {
    const p = PRODUTOS[id];
    if (qtd > p.max) {
      erros.push(`${p.nome}: máximo de ${p.max} ${p.unidade === 'bobina' ? 'bobinas' : 'unidades'} por pedido.`);
      continue;
    }
    itens.push({ id, qtd, ...p });
  }
  if (itens.length === 0 && erros.length === 0) erros.push('Seu carrinho está vazio.');

  const c = corpo.cliente || {};
  const cliente = {
    nome: texto(c.nome, 80),
    email: texto(c.email, 120).toLowerCase(),
    telefone: soDigitos(c.telefone),
    // CNPJ pode ter letras a partir de 2026 (CNPJ alfanumérico).
    documento: String(c.documento ?? '').toUpperCase().replace(/[^0-9A-Z]/g, ''),
  };
  if (cliente.nome.length < 3) erros.push('Informe o nome ou razão social.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cliente.email)) erros.push('Informe um e-mail válido.');
  if (cliente.telefone.length < 10 || cliente.telefone.length > 11) erros.push('Informe o WhatsApp com DDD.');
  if (!/^\d{11}$/.test(cliente.documento) && !/^[0-9A-Z]{12}\d{2}$/.test(cliente.documento)) {
    erros.push('Informe um CPF ou CNPJ válido.');
  }

  const e = corpo.entrega || {};
  const entrega = {
    cep: soDigitos(e.cep),
    rua: texto(e.rua),
    numero: texto(e.numero, 20),
    complemento: texto(e.complemento, 60),
    bairro: texto(e.bairro, 80),
    cidade: texto(e.cidade, 80),
    uf: texto(e.uf, 2).toUpperCase(),
  };
  const frete = calcularFrete(entrega.cep);
  if (!frete) erros.push('Informe um CEP válido.');
  if (!entrega.rua || !entrega.numero || !entrega.bairro || !entrega.cidade || !/^[A-Z]{2}$/.test(entrega.uf)) {
    erros.push('Preencha o endereço de entrega completo.');
  }

  return { erros, itens, cliente, entrega, frete };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  const { erros, itens, cliente, entrega, frete } = validar(lerCorpo(req));
  if (erros.length) return res.status(400).json({ erro: erros.join(' ') });

  const pedido = novoNumeroPedido();
  const site = enderecoDoSite(req);
  const enderecoTexto =
    `${entrega.rua}, ${entrega.numero}${entrega.complemento ? ' - ' + entrega.complemento : ''}, ` +
    `${entrega.bairro}, ${entrega.cidade}/${entrega.uf}, CEP ${entrega.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}`;
  const itensTexto = itens
    .map((i) => `${i.qtd}x ${i.nome}${i.codigo ? ` (${i.codigo})` : ''}`)
    .join(' | ');
  const [primeiroNome, ...sobrenome] = cliente.nome.split(' ');
  const numeroCasa = parseInt(entrega.numero, 10);

  const preferencia = {
    items: itens.map((i) => ({
      id: i.id,
      title: i.nome,
      ...(i.codigo ? { description: `Cód. ${i.codigo}` } : {}),
      quantity: i.qtd,
      unit_price: i.preco,
      currency_id: 'BRL',
    })),
    payer: {
      name: primeiroNome,
      surname: sobrenome.join(' ') || undefined,
      email: cliente.email,
      phone: { area_code: cliente.telefone.slice(0, 2), number: cliente.telefone.slice(2) },
      // Só pré-preenche o documento quando é numérico; CNPJ alfanumérico fica nos dados do pedido.
      ...(/^\d+$/.test(cliente.documento)
        ? { identification: { type: cliente.documento.length === 14 ? 'CNPJ' : 'CPF', number: cliente.documento } }
        : {}),
      address: {
        zip_code: entrega.cep,
        street_name: entrega.rua,
        ...(Number.isFinite(numeroCasa) ? { street_number: numeroCasa } : {}),
      },
    },
    shipments: { mode: 'not_specified', cost: frete.valor },
    back_urls: { success: `${site}/`, failure: `${site}/`, pending: `${site}/` },
    auto_return: 'approved',
    external_reference: pedido,
    statement_descriptor: 'GENESIS',
    additional_info: `Entrega: ${enderecoTexto}`,
    metadata: {
      pedido,
      cliente_nome: cliente.nome,
      cliente_email: cliente.email,
      cliente_documento: cliente.documento,
      cliente_telefone: cliente.telefone,
      entrega: enderecoTexto,
      itens: itensTexto,
      frete_regiao: frete.nome,
      frete_valor: frete.valor,
    },
  };
  // O Mercado Pago só avisa pedidos (webhook) em endereço https público.
  if (site.startsWith('https://')) preferencia.notification_url = `${site}/api/webhook`;

  try {
    const pref = await mercadoPago('/checkout/preferences', {
      method: 'POST',
      body: preferencia,
      idempotencia: pedido,
    });
    return res.status(200).json({ pedido, checkoutUrl: pref.init_point });
  } catch (err) {
    const status = err instanceof ErroPagamento ? err.status : 500;
    const erro = status === 503
      ? 'O pagamento online ainda não está ativo. Finalize pelo WhatsApp, por favor.'
      : 'Não foi possível gerar o pagamento agora. Tente de novo em instantes ou finalize pelo WhatsApp.';
    return res.status(status).json({ erro });
  }
}
