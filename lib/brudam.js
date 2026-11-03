// Integração com a API da transportadora Princesa dos Campos (sistema Brudam).
// Documentação: https://princesadoscampos.brudam.com.br/docs/
//
// As credenciais ficam SÓ nas variáveis de ambiente da Vercel (nunca no código):
//   BRUDAM_AMBIENTE         producao | homologacao   (padrão: producao)
//   BRUDAM_USUARIO          usuário da API (32 caracteres)
//   BRUDAM_SENHA            senha da API (64 caracteres)
//   BRUDAM_TOKEN            opcional: token fixo, usado só se não houver usuário e senha
//   BRUDAM_CNPJ_EMITENTE    opcional: CNPJ da base da transportadora (padrão 80.227.796/0059-75, Londrina)
//   BRUDAM_CNPJ_CLIENTE     opcional: CNPJ cadastrado na transportadora (padrão 62406067000188)
//   BRUDAM_SERVICO          código do serviço do contrato (27)

const URLS = {
  producao: 'https://princesadoscampos.brudam.com.br/api/v1',
  homologacao: 'https://epchomolog.brudam.com.br/api/v1',
};

const env = (k) => String(process.env[k] || '').trim();
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export function configBrudam() {
  const ambiente = env('BRUDAM_AMBIENTE').toLowerCase() === 'homologacao' ? 'homologacao' : 'producao';
  return {
    ambiente,
    base: URLS[ambiente],
    usuario: env('BRUDAM_USUARIO'),
    senha: env('BRUDAM_SENHA'),
    token: env('BRUDAM_TOKEN'),
    cnpjEmitente: soDigitos(env('BRUDAM_CNPJ_EMITENTE') || '80227796005975'), // base Londrina da Princesa dos Campos
    cnpjCliente: soDigitos(env('BRUDAM_CNPJ_CLIENTE') || '62406067000188'), // Guardian Advanced Protection Films
    servico: env('BRUDAM_SERVICO') || '27',
  };
}

// O que ainda falta configurar na Vercel (lista vazia = pronto).
export function faltandoBrudam(c = configBrudam()) {
  const falta = [];
  if (!(c.usuario && c.senha) && !c.token) falta.push('BRUDAM_USUARIO e BRUDAM_SENHA');
  if (c.cnpjCliente.length !== 14) falta.push('BRUDAM_CNPJ_CLIENTE');
  return falta;
}

export class ErroBrudam extends Error {
  constructor(mensagem, { http = 0, detalhes = [] } = {}) {
    super(mensagem);
    this.http = http;
    this.detalhes = detalhes;
  }
}

// ---------------------------------------------------------------- token
let cacheToken = { valor: '', expira: 0, base: '' };

function expiracaoJwt(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// fetch que transforma falha de rede em erro legível (ex.: bloqueio, tempo esgotado).
async function chamar(url, opcoes) {
  try {
    return await fetch(url, { ...opcoes, signal: AbortSignal.timeout(15000) });
  } catch (e) {
    const causa = e?.cause?.code || e?.name || e?.message || 'erro de rede';
    throw new ErroBrudam(`Sem conexão com a transportadora (${causa}).`, { http: 0 });
  }
}

async function login(c) {
  const r = await chamar(`${c.base}/acesso/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usuario: c.usuario, senha: c.senha }),
  });
  const j = await r.json().catch(() => ({}));
  const chave = j?.data?.access_key;
  if (!r.ok || !chave) {
    const detalhes = [].concat(Array.isArray(j?.data) ? j.data : j?.message ? [j.message] : []).map(String);
    throw new ErroBrudam('Login na transportadora recusado.', { http: r.status, detalhes });
  }
  cacheToken = { valor: chave, expira: expiracaoJwt(chave) || Date.now() + 50 * 60 * 1000, base: c.base };
  return chave;
}

async function token(c, renovar = false) {
  if (c.usuario && c.senha) {
    const valido = cacheToken.valor && cacheToken.base === c.base && Date.now() < cacheToken.expira - 60 * 1000;
    if (valido && !renovar) return cacheToken.valor;
    try {
      return await login(c);
    } catch (e) {
      if (c.token) return c.token; // reserva: token fixo da transportadora
      throw e;
    }
  }
  return c.token;
}

const temOpcoes = (j) => j && j.data && typeof j.data === 'object' && Object.keys(j.data).length > 0;

// ---------------------------------------------------------------- chamadas
async function post(c, caminho, corpo) {
  let renovou = false;
  let semServico = false;
  while (true) {
    const t = await token(c, renovou);
    const r = await chamar(`${c.base}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(corpo),
    });
    // Token vencido: faz login de novo uma vez.
    if (r.status === 401 && !renovou && c.usuario && c.senha) { renovou = true; continue; }
    const j = await r.json().catch(() => ({}));
    const detalhes = Array.isArray(j?.data) ? j.data.map((d) => (typeof d === 'string' ? d : JSON.stringify(d)))
      : typeof j?.data === 'string' ? [j.data] : [];
    // Dados recusados: tenta de novo sem o código de serviço (usa o serviço do cadastro).
    if (r.status === 400 && corpo.cServ && !semServico) {
      console.error('Brudam 400 com cServ, tentando sem:', j?.message, JSON.stringify(detalhes));
      const { cServ, ...resto } = corpo; corpo = resto; semServico = true; continue;
    }
    if (!r.ok || (Number(j.status) !== 1 && !temOpcoes(j))) {
      throw new ErroBrudam(j?.message || `A transportadora respondeu ${r.status}.`, { http: r.status, detalhes });
    }
    return j;
  }
}

// A resposta pode vir como lista ou como objeto { "0": {...}, "1": {...} }.
function opcoes(j) {
  const lista = Array.isArray(j.data) ? j.data : Object.values(j.data || {});
  return lista
    .map((it) => {
      const f = it.frete || it;
      return {
        ok: it.status === undefined || Number(it.status) === 1,
        mensagem: it.message || '',
        servico: String(it.cServ ?? f.cServ ?? ''),
        cotacaoId: it.ID ? Number(it.ID) : null,
        valor: Number(f.vTotal),
        dias: f.nDias !== undefined && f.nDias !== null ? Number(f.nDias) : null,
        icms: Number(f.vICMS) || 0,
      };
    })
    .filter((o) => o.ok && o.valor > 0);
}

function escolher(lista, servico) {
  if (!lista.length) return null;
  return lista.find((o) => o.servico === servico) || lista.slice().sort((a, b) => a.valor - b.valor)[0];
}

function corpoCotacao(c, carga) {
  return {
    ...(c.cnpjEmitente.length === 14 ? { nDocEmit: c.cnpjEmitente } : {}),
    nDocCli: c.cnpjCliente,
    cOrigCalc: Number(carga.ibgeOrigem),
    cDestCalc: Number(carga.ibgeDestino),
    CEP: carga.cepDestino,
    cServ: c.servico,
    pBru: carga.pBru,
    qVol: carga.qVol,
    vNF: carga.vNF,
    ...(carga.volumes ? { volumes: carga.volumes } : {}),
  };
}

// Cálculo simples, sem registrar cotação (usado no carrinho).
const mensagensDosServicos = (j) => (Array.isArray(j.data) ? j.data : Object.values(j.data || {}))
  .map((it) => it && it.message).filter(Boolean).map(String);

export async function calcularFreteBrudam(carga, c = configBrudam()) {
  const corpo = { ...corpoCotacao(c, carga), nDocRem: c.cnpjCliente };
  if (carga.docDestino) corpo.nDocDest = carga.docDestino;
  const j = await post(c, '/frete/cotacao/calcula', corpo);
  const o = escolher(opcoes(j), c.servico);
  if (!o) throw new ErroBrudam('Nenhum serviço da transportadora atende esse CEP.', { detalhes: mensagensDosServicos(j) });
  return o;
}

// Gera a cotação oficial no sistema da transportadora (usada no checkout).
export async function emitirCotacaoBrudam(carga, extra = {}, c = configBrudam()) {
  const corpo = { ...corpoCotacao(c, carga), solicit: 'LOJA ONLINE' };
  if (extra.telefone) corpo.telSolicit = Number(soDigitos(extra.telefone)) || undefined;
  const j = await post(c, '/comercial/emissao/cotacao', corpo);
  const o = escolher(opcoes(j), c.servico);
  if (!o) throw new ErroBrudam('Nenhum serviço da transportadora atende esse CEP.', { detalhes: mensagensDosServicos(j) });
  return o;
}

// Muda o status da cotação: 2 = aprovada (pagamento confirmado).
export async function alterarCotacaoBrudam(idCotacao, idStatus = 2, c = configBrudam()) {
  return post(c, '/comercial/alteracao/cotacao', { idCotacao: Number(idCotacao), idStatus });
}
