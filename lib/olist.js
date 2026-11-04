// Integração com o Olist ERP (antigo Tiny), API v2 com token fixo.
// Documentação: https://api-docs.erp.olist.com/api-v2/introducao
//
// Variáveis na Vercel (o token fica SÓ lá, nunca no código):
//   OLIST_TOKEN      token da extensão "Token API" (liga a integração)
//   OLIST_NF         manual (padrão) | automatica   → automatica: gera e emite a NF-e quando o pagamento é aprovado
//   OLIST_ESTOQUE    nao (padrão) | bloquear        → bloquear: confere o saldo no Olist antes de gerar o pagamento
//   OLIST_SERIE_NF   opcional, série da NF-e (padrão 1)
//   OLIST_NATUREZA   opcional, id da natureza de operação usada no pedido
//   OLIST_DEPOSITO   opcional, nome do depósito que dá baixa no estoque

import { PRODUTOS, codigoOlist } from './catalogo.js';

const BASE = 'https://api.tiny.com.br/api2';
const env = (k) => String(process.env[k] || '').trim();
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const corta = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

export const olistAtivo = () => env('OLIST_TOKEN').length > 0;
export const nfAutomatica = () => env('OLIST_NF').toLowerCase().startsWith('auto');
export const bloquearSemEstoque = () => env('OLIST_ESTOQUE').toLowerCase() === 'bloquear';

export class ErroOlist extends Error {
  constructor(mensagem, { codigo = 0, erros = [], http = 0 } = {}) {
    super(mensagem);
    this.codigo = codigo;
    this.erros = erros;
    this.http = http;
  }
}

// ---------------------------------------------------------------- chamadas
const registros = (ret) => [].concat(ret?.registros || []).map((x) => x?.registro || x).filter(Boolean);

function listaErros(ret) {
  const daRaiz = [].concat(ret?.erros || []).map((e) => e?.erro ?? e);
  const dosRegistros = registros(ret).flatMap((r) => [].concat(r.erros || []).map((e) => e?.erro ?? e));
  return [...daRaiz, ...dosRegistros].filter(Boolean).map(String);
}

// Consulta sem resultado volta como "erro" na API v2.
const semRegistros = (e) => e instanceof ErroOlist
  && (e.codigo === 20 || /n[aã]o retornou registros|nenhum registro|n[aã]o encontrad/i.test(e.erros.join(' ') || e.message));

async function chamar(servico, params = {}, tentativa = 0) {
  const token = env('OLIST_TOKEN');
  if (!token) throw new ErroOlist('Olist não configurado (falta OLIST_TOKEN na Vercel).');
  let r;
  try {
    r = await fetch(`${BASE}/${servico}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ token, formato: 'json', ...params }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new ErroOlist(`Sem conexão com o Olist (${e?.cause?.code || e?.name || 'erro de rede'}).`);
  }
  // Limite de chamadas por minuto: espera um pouco e tenta uma vez de novo.
  if (r.status === 429 && tentativa < 1) { await espera(2500); return chamar(servico, params, tentativa + 1); }
  const j = await r.json().catch(() => null);
  const ret = j?.retorno;
  if (!ret) throw new ErroOlist(`O Olist respondeu ${r.status} sem dados.`, { http: r.status });
  const erros = listaErros(ret);
  const registroComErro = registros(ret).some((x) => String(x.status || '').toUpperCase() === 'ERRO');
  if (String(ret.status || '').toUpperCase() !== 'OK' || registroComErro) {
    throw new ErroOlist(erros[0] || 'O Olist recusou a solicitação.', { codigo: Number(ret.codigo_erro) || 0, erros, http: r.status });
  }
  return ret;
}

// ---------------------------------------------------------------- conta
export async function infoConta() {
  const ret = await chamar('info.php');
  return ret.conta || {};
}

// ---------------------------------------------------------------- produtos e estoque
const cacheProduto = new Map(); // código -> { produto, expira }
const cacheSaldo = new Map();   // id -> { saldo, expira }

export async function produtoPorCodigo(codigo) {
  const cod = corta(codigo, 60).toUpperCase();
  if (!cod) return null;
  const c = cacheProduto.get(cod);
  if (c && c.expira > Date.now()) return c.produto;
  let produto = null;
  try {
    const ret = await chamar('produtos.pesquisa.php', { pesquisa: cod });
    const lista = [].concat(ret.produtos || []).map((x) => x?.produto || x);
    produto = lista.find((p) => String(p.codigo || '').trim().toUpperCase() === cod) || null;
  } catch (e) {
    if (!semRegistros(e)) throw e;
  }
  cacheProduto.set(cod, { produto, expira: Date.now() + 30 * 60 * 1000 });
  return produto;
}

export async function saldoDoProduto(id) {
  const c = cacheSaldo.get(String(id));
  if (c && c.expira > Date.now()) return c.saldo;
  const ret = await chamar('produto.obter.estoque.php', { id: String(id) });
  const saldo = Number(ret.produto?.saldo);
  cacheSaldo.set(String(id), { saldo, expira: Date.now() + 60 * 1000 });
  return saldo;
}

// Antes de gerar o pagamento: lista os itens sem saldo suficiente no Olist.
// Só bloqueia com OLIST_ESTOQUE=bloquear. Produto não encontrado ou Olist fora do ar não bloqueia a venda.
export async function itensSemEstoque(itens) {
  if (!olistAtivo() || !bloquearSemEstoque()) return [];
  const faltando = [];
  for (const i of itens) {
    const codigo = codigoOlist(i.id);
    if (!codigo) continue;
    try {
      const p = await produtoPorCodigo(codigo);
      if (!p) { console.error('Olist: produto não encontrado pelo código', codigo); continue; }
      const saldo = await saldoDoProduto(p.id);
      if (Number.isFinite(saldo) && saldo < i.qtd) faltando.push({ id: i.id, nome: i.nome, saldo: Math.max(0, Math.floor(saldo)) });
    } catch (e) {
      console.error('Olist: não consegui conferir o estoque de', codigo, '-', e.message);
    }
  }
  return faltando;
}

// ---------------------------------------------------------------- pedidos
// Todos os pedidos do Olist com este número da loja (normalmente um só), do mais antigo ao mais novo.
export async function pedidosPorNumeroLoja(numero) {
  try {
    const ret = await chamar('pedidos.pesquisa.php', { numeroEcommerce: String(numero) });
    const lista = [].concat(ret.pedidos || []).map((x) => x?.pedido || x);
    const exatos = lista.filter((p) => String(p.numero_ecommerce || '') === String(numero));
    const achados = exatos.length ? exatos : (lista.length && lista.every((p) => p.numero_ecommerce === undefined) ? lista : []);
    return achados.sort((a, b) => Number(a.id) - Number(b.id));
  } catch (e) {
    if (semRegistros(e)) return [];
    throw e;
  }
}
const cancelado = (p) => /cancelad/i.test(String(p.situacao || ''));
export async function pedidoPorNumeroLoja(numero) {
  const lista = await pedidosPorNumeroLoja(numero);
  return lista.find((p) => !cancelado(p)) || lista[0] || null;
}

export async function incluirPedido(pedido) {
  const ret = await chamar('pedido.incluir.php', { pedido: JSON.stringify({ pedido }) });
  const r = registros(ret)[0] || {};
  if (!r.id) throw new ErroOlist('O Olist não devolveu o número do pedido.', { erros: listaErros(ret) });
  return { id: String(r.id), numero: String(r.numero || '') };
}

export const alterarSituacao = (id, situacao) => chamar('pedido.alterar.situacao.php', { id: String(id), situacao });

// ---------------------------------------------------------------- nota fiscal
export async function gerarNotaDoPedido(idPedido) {
  const ret = await chamar('pedido.gerar.nota.fiscal.php', { id: String(idPedido), serie: env('OLIST_SERIE_NF') || '1', enviar_email: 'N' });
  const r = registros(ret)[0] || {};
  if (!r.id) throw new ErroOlist('O Olist não devolveu a nota gerada.', { erros: listaErros(ret) });
  return { id: String(r.id), numero: String(r.numero || ''), serie: String(r.serie || '') };
}

export async function emitirNota(idNota) {
  const ret = await chamar('nota.fiscal.emitir.php', { id: String(idNota), enviar_email: 'S' });
  const n = ret.nota_fiscal || ret.registros?.registro || ret;
  return { situacao: String(n.situacao || ''), chave: String(n.chave_acesso || '') };
}

// ---------------------------------------------------------------- pedido a partir do pagamento
const FORMAS = {
  bank_transfer: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito',
  ticket: 'Boleto', account_money: 'Saldo Mercado Pago', prepaid_card: 'Cartão pré-pago',
};
export const formaDoPagamento = (p) => FORMAS[p.payment_type_id] || p.payment_type_id || 'Mercado Pago';

function dataSP(d) {
  return new Date(d || Date.now()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Itens cobrados: usa o que o Mercado Pago registrou; se faltar, monta pelo catálogo.
function itensDoPagamento(p, m) {
  const doMp = (p.additional_info?.items || [])
    .map((it) => ({ id: String(it.id || ''), qtd: Number(it.quantity), valor: Number(it.unit_price), titulo: it.title }))
    .filter((i) => i.qtd > 0);
  const lista = doMp.length ? doMp : String(m.itens_ids || '').split(',').map((par) => {
    const [id, q] = par.split(':');
    return { id, qtd: Number(q), valor: PRODUTOS[id]?.preco, titulo: PRODUTOS[id]?.nome };
  }).filter((i) => i.id && i.qtd > 0);
  return lista.map((i) => ({
    item: {
      ...(codigoOlist(i.id) ? { codigo: codigoOlist(i.id) } : {}),
      descricao: corta(PRODUTOS[i.id]?.nome || i.titulo || i.id, 120),
      unidade: 'UN',
      quantidade: String(i.qtd),
      valor_unitario: Number(i.valor || 0).toFixed(2),
    },
  }));
}

export function montarPedido(p, m) {
  const doc = String(m.cliente_documento || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const forma = formaDoPagamento(p);
  const cliente = {
    nome: corta(m.cliente_nome || p.payer?.first_name || 'Cliente da loja', 60),
    tipo_pessoa: doc.length === 14 ? 'J' : 'F',
    ...(doc ? { cpf_cnpj: doc } : {}),
    endereco: corta(m.entrega_rua || m.entrega, 50),
    numero: corta(m.entrega_numero, 10),
    complemento: corta(m.entrega_complemento, 50),
    bairro: corta(m.entrega_bairro, 30),
    cep: soDigitos(m.entrega_cep).replace(/(\d{5})(\d{3})/, '$1-$2'),
    cidade: corta(m.entrega_cidade, 30),
    uf: corta(m.entrega_uf, 2).toUpperCase(),
    fone: soDigitos(m.cliente_telefone),
    email: corta(m.cliente_email || p.payer?.email, 50),
    atualizar_cliente: 'S',
  };
  for (const k of Object.keys(cliente)) if (cliente[k] === '') delete cliente[k];
  const natureza = env('OLIST_NATUREZA');
  const deposito = env('OLIST_DEPOSITO');
  return {
    data_pedido: dataSP(p.date_approved || p.date_created),
    numero_pedido_ecommerce: String(p.external_reference || m.pedido),
    cliente,
    itens: itensDoPagamento(p, m),
    marcadores: [{ marcador: { descricao: 'Loja online' } }],
    valor_frete: Number(m.frete_valor || 0).toFixed(2),
    ...(m.frete_valor ? { frete_por_conta: 'R' } : {}),
    ...(m.frete_fonte === 'transportadora' ? { nome_transportador: corta(m.frete_regiao || 'Princesa dos Campos', 100) } : {}),
    meio_pagamento: corta(`Mercado Pago - ${forma}`, 100),
    obs: corta(`Pedido ${p.external_reference || m.pedido} da loja online, pago no Mercado Pago (${forma}).`, 100),
    obs_internas: corta(`Mercado Pago pagamento ${p.id}${m.cotacao_id ? ` · cotação transportadora ${m.cotacao_id}` : ''}`, 100),
    ...(natureza ? { id_natureza_operacao: natureza } : {}),
    ...(deposito ? { nome_deposito: deposito } : {}),
  };
}

// Pagamento aprovado → pedido aprovado no Olist (e NF-e, se OLIST_NF=automatica).
// O Mercado Pago repete avisos: se o pedido já existe no Olist, não cria outro.
export async function registrarPedidoOlist(p, m) {
  const numeroLoja = String(p.external_reference || m.pedido || '');
  if (!numeroLoja) throw new ErroOlist('Pagamento sem número de pedido da loja.');
  const existente = await pedidoPorNumeroLoja(numeroLoja);
  if (existente) return { id: String(existente.id), numero: String(existente.numero || ''), novo: false, texto: `Pedido ${existente.numero || existente.id} no Olist` };

  const { id, numero } = await incluirPedido(montarPedido(p, m));

  // O Mercado Pago manda mais de um aviso ao mesmo tempo. Se outro aviso criou o mesmo
  // pedido, fica só o mais antigo: este aqui é cancelado e não segue adiante.
  await espera(1500);
  const vivos = (await pedidosPorNumeroLoja(numeroLoja).catch(() => [])).filter((x) => !cancelado(x));
  if (vivos.length > 1 && String(vivos[0].id) !== String(id)) {
    try { await alterarSituacao(id, 'cancelado'); } catch (e) { console.error('Olist: não consegui cancelar o pedido repetido', numero || id, e.message); }
    console.log('Olist: pedido repetido', numero || id, 'cancelado; vale o', vivos[0].numero);
    return { id: String(vivos[0].id), numero: String(vivos[0].numero || ''), novo: false, texto: `Pedido ${vivos[0].numero || vivos[0].id} no Olist` };
  }

  const partes = [`Pedido ${numero || id} no Olist`];
  try {
    await alterarSituacao(id, 'aprovado');
  } catch (e) {
    console.error('Olist: pedido', numero || id, 'criado, mas não consegui aprovar:', e.message);
    partes.push('aprovar manualmente');
  }
  if (nfAutomatica()) {
    try {
      const nota = await gerarNotaDoPedido(id);
      const emitida = await emitirNota(nota.id);
      partes.push(/autoriz/i.test(emitida.situacao) ? `NF-e ${nota.numero} autorizada` : `NF-e ${nota.numero}: ${emitida.situacao || 'enviada'}`);
    } catch (e) {
      console.error('Olist: NF-e do pedido', numero || id, '-', e.message, e.erros.join(' | '));
      partes.push(`emitir a NF-e manualmente (${corta(e.message, 80)})`);
    }
  }
  return { id, numero, novo: true, texto: partes.join(' · ') };
}

// Reembolso ou cancelamento no Mercado Pago → cancela no Olist todos os pedidos com esse número.
export async function cancelarPedidoOlist(numeroLoja) {
  const lista = await pedidosPorNumeroLoja(numeroLoja);
  if (!lista.length) return null;
  const abertos = lista.filter((x) => !cancelado(x));
  for (const x of abertos) await alterarSituacao(x.id, 'cancelado');
  return { numero: lista.map((x) => x.numero).join(', '), jaCancelado: abertos.length === 0 };
}
