// GET /api/olist — confere a ligação com o Olist (sem mostrar o token).
// GET /api/olist?codigo=GD037CUT — confere se um código da loja existe no Olist.
// GET /api/olist?pedido=GEN-261104-ABCDE — confere se o pedido da loja chegou no Olist.
import { olistAtivo, nfAutomatica, bloquearSemEstoque, infoConta, produtoPorCodigo, pedidosPorNumeroLoja } from '../lib/olist.js';

let ultima = 0;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const base = {
    configurado: olistAtivo(),
    notaFiscal: nfAutomatica() ? 'automatica' : 'manual',
    estoque: bloquearSemEstoque() ? 'bloqueia venda sem saldo' : 'não confere',
  };
  if (!base.configurado) return res.status(200).json({ ...base, conectado: false, erro: 'Falta OLIST_TOKEN na Vercel.' });

  // Evita gastar o limite de chamadas do Olist com recarregamentos seguidos.
  if (Date.now() - ultima < 3000) return res.status(429).json({ ...base, erro: 'Espere alguns segundos e tente de novo.' });
  ultima = Date.now();

  try {
    const numeroPedido = String(req.query?.pedido || '').trim().toUpperCase();
    if (/^GEN-\d{6}-[0-9A-F]{5}$/.test(numeroPedido)) {
      const lista = await pedidosPorNumeroLoja(numeroPedido);
      return res.status(200).json({ ...base, conectado: true, pedido: numeroPedido, encontrado: lista.length > 0, noOlist: lista.map((p) => ({ numero: p.numero, situacao: p.situacao })) });
    }
    const codigo = String(req.query?.codigo || '').trim().slice(0, 60);
    if (codigo) {
      const p = await produtoPorCodigo(codigo);
      return res.status(200).json({ ...base, conectado: true, codigo, encontrado: !!p, ...(p ? { nome: p.nome, unidade: p.unidade } : {}) });
    }
    const conta = await infoConta();
    return res.status(200).json({
      ...base, conectado: true,
      empresa: conta.razao_social || conta.fantasia || '',
      ...(conta.fantasia && conta.fantasia !== conta.razao_social ? { fantasia: conta.fantasia } : {}),
      cnpj: conta.cnpj_cpf || '',
    });
  } catch (e) {
    return res.status(200).json({ ...base, conectado: false, erro: e.message, detalhe: (e.erros || []).slice(0, 3) });
  }
}
