// Conversa com a API do Mercado Pago usando o Access Token guardado na Vercel.
// O token NUNCA vai para o navegador: só estas funções de servidor o usam.

const API = 'https://api.mercadopago.com';

export class ErroPagamento extends Error {
  constructor(mensagem, status = 500, detalhe = null) {
    super(mensagem);
    this.status = status;
    this.detalhe = detalhe;
  }
}

export async function mercadoPago(caminho, { method = 'GET', body, idempotencia } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new ErroPagamento('Pagamento online ainda não configurado.', 503);
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (idempotencia) headers['X-Idempotency-Key'] = idempotencia;

  const r = await fetch(API + caminho, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Mercado Pago respondeu', r.status, JSON.stringify(dados));
    throw new ErroPagamento('O Mercado Pago recusou a solicitação.', 502, dados);
  }
  return dados;
}

// Endereço público do site (usado para o cliente voltar depois de pagar).
// Na Vercel, cadastre SITE_URL, por exemplo: https://catalogo.genesisprotection.com.br
export function enderecoDoSite(req) {
  const doEnv = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (doEnv) return doEnv;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export function lerCorpo(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}
