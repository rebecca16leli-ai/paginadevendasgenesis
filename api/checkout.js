// POST /api/checkout — recebe o carrinho e os dados de entrega,
// recalcula tudo com os preços do servidor e cria o pagamento no Mercado Pago.
import { randomUUID } from 'node:crypto';
import { normalizarItens } from '../lib/pedido.js';
import { cotarFrete, ErroFrete } from '../lib/frete.js';
import { mercadoPago, enderecoDoSite, lerCorpo, ErroPagamento } from '../lib/mercadopago.js';
import { itensSemEstoque } from '../lib/olist.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const texto = (v, max = 120) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

function novoNumeroPedido() {
  const d = new Date();
  const data = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const sufixo = randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();
  return `GEN-${data}-${sufixo}`;
}

function validar(corpo) {
  // Itens: só aceita produtos do catálogo, quantidade inteira e dentro do limite.
  const { itens, erros } = normalizarItens(corpo.itens);

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
  if (entrega.cep.length !== 8) erros.push('Informe um CEP válido.');
  if (!entrega.rua || !entrega.numero || !entrega.bairro || !entrega.cidade || !/^[A-Z]{2}$/.test(entrega.uf)) {
    erros.push('Preencha o endereço de entrega completo.');
  }

  return { erros, itens, cliente, entrega };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  const { erros, itens, cliente, entrega } = validar(lerCorpo(req));
  if (erros.length) return res.status(400).json({ erro: erros.join(' ') });

  // Estoque no Olist (só bloqueia com OLIST_ESTOQUE=bloquear na Vercel).
  const semEstoque = await itensSemEstoque(itens);
  if (semEstoque.length) {
    const lista = semEstoque.map((i) => (i.saldo > 0 ? `${i.nome} (temos ${i.saldo})` : `${i.nome} (esgotado)`)).join('; ');
    return res.status(409).json({
      erro: `Sem estoque suficiente agora: ${lista}. Ajuste o carrinho ou fale com a gente no WhatsApp.`,
      semEstoque,
    });
  }

  // O frete é sempre recalculado aqui (o valor do navegador não vale).
  let frete;
  try {
    frete = await cotarFrete(entrega.cep, itens, {
      modo: 'checkout',
      docDestino: /^\d+$/.test(cliente.documento) ? cliente.documento : '',
      telefone: cliente.telefone,
    });
  } catch (e) {
    const status = e instanceof ErroFrete ? e.status : 500;
    return res.status(status).json({
      erro: e instanceof ErroFrete ? e.message : 'Não foi possível calcular o frete agora.',
      // Resposta da transportadora, para diagnóstico (a página não mostra este campo).
      ...(e instanceof ErroFrete && e.detalhe ? { detalhe: e.detalhe } : {}),
    });
  }

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
    ...(frete.valor > 0 ? { shipments: { mode: 'not_specified', cost: frete.valor } } : {}),
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
      // Endereço em partes, para o pedido no Olist (e a NF-e) sair completo.
      entrega_rua: entrega.rua,
      entrega_numero: entrega.numero,
      entrega_complemento: entrega.complemento,
      entrega_bairro: entrega.bairro,
      entrega_cidade: entrega.cidade,
      entrega_uf: entrega.uf,
      entrega_cep: entrega.cep,
      itens: itensTexto,
      itens_ids: itens.map((i) => `${i.id}:${i.qtd}`).join(','),
      frete_regiao: frete.nome,
      frete_valor: frete.valor,
      frete_gratis: frete.gratis ? 'sim' : '',
      frete_custo: frete.custo ?? frete.valor,
      frete_fonte: frete.fonte,
      frete_prazo_dias: frete.dias ?? '',
      cotacao_id: frete.cotacaoId ?? '',
      cotacao_erro: (frete.avisoCotacao || '').slice(0, 250),
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
    return res.status(200).json({
      pedido,
      checkoutUrl: pref.init_point,
      frete: {
        valor: frete.valor, dias: frete.dias, nome: frete.nome, gratis: frete.gratis,
        // Diagnóstico: se a cotação oficial foi registrada na transportadora.
        ...(frete.fonte === 'transportadora' ? { cotacao: frete.cotacaoId ? 'registrada' : `não registrada: ${frete.avisoCotacao}` } : {}),
      },
    });
  } catch (err) {
    const status = err instanceof ErroPagamento ? err.status : 500;
    const erro = status === 503
      ? 'O pagamento online ainda não está ativo. Finalize pelo WhatsApp, por favor.'
      : 'Não foi possível gerar o pagamento agora. Tente de novo em instantes ou finalize pelo WhatsApp.';
    return res.status(status).json({ erro });
  }
}
