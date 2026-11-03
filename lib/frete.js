// Frete do pedido: pela transportadora (Brudam) quando tudo está configurado,
// ou pela tabela fixa por região enquanto não estiver.
import { ORIGEM, EMBALAGENS, calcularFrete as freteTabela } from './catalogo.js';
import { subtotalItens } from './pedido.js';
import {
  configBrudam, faltandoBrudam, calcularFreteBrudam, emitirCotacaoBrudam, ErroBrudam,
} from './brudam.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const arred = (n, casas = 3) => Math.round(n * 10 ** casas) / 10 ** casas;
const TRANSPORTADORA = 'Princesa dos Campos';

export class ErroFrete extends Error {
  constructor(mensagem, status = 422) { super(mensagem); this.status = status; }
}

// ---------------------------------------------------------------- configuração
// A transportadora cobra pelo PESO REAL na tabela do cliente: o peso é obrigatório.
// As medidas são opcionais; quando todas estão preenchidas, seguem junto na cotação.
const temMedidas = (e) => e && e.a > 0 && e.l > 0 && e.c > 0;

export function faltandoFrete() {
  const falta = faltandoBrudam();
  if (soDigitos(ORIGEM.cep).length !== 8) falta.push('CEP de origem (ORIGEM em lib/catalogo.js)');
  for (const [k, e] of Object.entries(EMBALAGENS)) {
    if (k === 'caixa_ferramentas') continue;
    if (!(e.peso > 0)) falta.push(`peso: ${e.nome} (EMBALAGENS.${k})`);
  }
  return falta;
}
export const freteReal = () => faltandoFrete().length === 0;

// ---------------------------------------------------------------- cidade (IBGE) pelo CEP
const cacheIbge = new Map();
export async function ibgeDoCep(cep) {
  const d = soDigitos(cep);
  if (d.length !== 8) throw new ErroFrete('Informe um CEP válido.', 400);
  if (cacheIbge.has(d)) return cacheIbge.get(d);
  let ibge = '';
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j && !j.erro && /^\d{7}$/.test(String(j.ibge))) ibge = String(j.ibge);
  } catch { /* tenta a reserva abaixo */ }
  if (!ibge) {
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
      const j = await r.json();
      const cidade = j?.city; const uf = j?.state;
      if (cidade && uf) {
        const m = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`).then((x) => x.json());
        const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
        const achou = (Array.isArray(m) ? m : []).find((x) => sem(x.nome) === sem(cidade));
        if (achou) ibge = String(achou.codigo_ibge).slice(0, 7);
      }
    } catch { /* sem cidade */ }
  }
  if (!ibge) throw new ErroFrete('Não encontramos esse CEP. Confira os números.', 400);
  cacheIbge.set(d, ibge);
  return ibge;
}

// ---------------------------------------------------------------- carga (volumes, peso, valor)
export function montarCarga(itens) {
  const grupos = new Map();
  let pesoFerramentas = 0;
  for (const i of itens) {
    if (i.embalagem === 'ferramenta') { pesoFerramentas += EMBALAGENS.ferramenta.peso * i.qtd; continue; }
    const e = EMBALAGENS[i.embalagem];
    const g = grupos.get(i.embalagem) || { dAlt: e.a, dLar: e.l, dCom: e.c, qVol: 0, pBru: 0, medidas: temMedidas(e) };
    g.qVol += i.qtd;
    g.pBru += e.peso * i.qtd;
    grupos.set(i.embalagem, g);
  }
  const volumes = [...grupos.values()];
  if (pesoFerramentas > 0) {
    const cx = EMBALAGENS.caixa_ferramentas;
    volumes.push({ dAlt: cx.a, dLar: cx.l, dCom: cx.c, qVol: 1, pBru: pesoFerramentas + (cx.peso || 0), medidas: temMedidas(cx) });
  }
  volumes.forEach((v) => { v.pBru = arred(v.pBru); });
  // Só manda as medidas se todos os volumes tiverem medidas (senão vai só peso e quantidade).
  const comMedidas = volumes.every((v) => v.medidas);
  volumes.forEach((v) => { delete v.medidas; });
  return {
    volumes: comMedidas ? volumes : null,
    qVol: volumes.reduce((s, v) => s + v.qVol, 0),  // continua contando os volumes
    pBru: arred(volumes.reduce((s, v) => s + v.pBru, 0)),
    vNF: subtotalItens(itens),
  };
}

// ---------------------------------------------------------------- cotação
const cache = new Map(); // chave -> { expira, resultado }
const chaveDe = (cep, itens) => soDigitos(cep) + '|' + itens.map((i) => `${i.id}:${i.qtd}`).sort().join(',');

// modo: 'carrinho' (cálculo rápido) ou 'checkout' (gera a cotação oficial)
export async function cotarFrete(cep, itens, { modo = 'carrinho', docDestino = '', telefone = '' } = {}) {
  const d = soDigitos(cep);
  if (d.length !== 8) throw new ErroFrete('Informe um CEP válido.', 400);

  if (!freteReal()) {
    const r = freteTabela(d);
    if (!r) throw new ErroFrete('Informe um CEP válido.', 400);
    return { fonte: 'tabela', nome: r.nome, valor: r.valor, dias: null, cotacaoId: null, servico: null };
  }

  const chave = chaveDe(d, itens);
  const guardado = cache.get(chave);
  if (modo === 'carrinho' && guardado && guardado.expira > Date.now()) return guardado.resultado;

  const c = configBrudam();
  const carga = {
    ...montarCarga(itens),
    cepDestino: d,
    ibgeOrigem: /^\d{7}$/.test(String(ORIGEM.ibge || '')) ? String(ORIGEM.ibge) : await ibgeDoCep(ORIGEM.cep),
    ibgeDestino: await ibgeDoCep(d),
    docDestino: /^\d{11}$|^\d{14}$/.test(docDestino) ? docDestino : '',
  };

  let o;
  try {
    if (modo === 'checkout') {
      o = await emitirCotacaoBrudam(carga, { telefone }, c);
    } else {
      try {
        o = await calcularFreteBrudam(carga, c);
      } catch (e) {
        // Se o cálculo simples não estiver liberado para este usuário, usa a cotação.
        if (e instanceof ErroBrudam && [401, 403, 404, 405].includes(e.http)) o = await emitirCotacaoBrudam(carga, { telefone }, c);
        else throw e;
      }
    }
  } catch (e) {
    console.error('Frete Brudam:', e.message, e.http || '', JSON.stringify(e.detalhes || []));
    if (/Nenhum serviço/.test(e.message)) {
      throw new ErroFrete('A transportadora ainda não entrega nesse CEP pela loja. Fale com a gente no WhatsApp para combinar a entrega.', 422);
    }
    throw new ErroFrete('A transportadora não conseguiu calcular o frete agora. Tente de novo em instantes ou finalize pelo WhatsApp.', 502);
  }

  const resultado = {
    fonte: 'transportadora',
    nome: TRANSPORTADORA,
    valor: Math.round(o.valor * 100) / 100,
    dias: o.dias,
    cotacaoId: o.cotacaoId,
    servico: o.servico,
    ambiente: c.ambiente,
  };
  cache.set(chave, { expira: Date.now() + 15 * 60 * 1000, resultado: { ...resultado, cotacaoId: null } });
  return resultado;
}
