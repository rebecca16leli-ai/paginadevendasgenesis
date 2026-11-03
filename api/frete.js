// POST /api/frete — { cep, itens:[{id,qtd}] } -> valor e prazo do frete.
// Usado pelo carrinho e pelo formulário de entrega para mostrar o frete antes de pagar.
import { normalizarItens } from '../lib/pedido.js';
import { cotarFrete, ErroFrete } from '../lib/frete.js';
import { lerCorpo } from '../lib/mercadopago.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  const corpo = lerCorpo(req);
  const { itens, erros } = normalizarItens(corpo.itens);
  if (erros.length) return res.status(400).json({ erro: erros.join(' ') });
  try {
    const f = await cotarFrete(corpo.cep, itens, { modo: 'carrinho' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ fonte: f.fonte, nome: f.nome, valor: f.valor, dias: f.dias });
  } catch (e) {
    const status = e instanceof ErroFrete ? e.status : 500;
    return res.status(status).json({ erro: e instanceof ErroFrete ? e.message : 'Não foi possível calcular o frete agora.' });
  }
}
