// GET /api/catalogo — a página busca aqui os preços oficiais ao abrir,
// para mostrar exatamente o que será cobrado.
import { PRODUTOS, FRETE } from '../lib/catalogo.js';

export default function handler(req, res) {
  const produtos = {};
  for (const [id, p] of Object.entries(PRODUTOS)) {
    produtos[id] = { preco: p.preco, unidade: p.unidade, max: p.max };
  }
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    produtos,
    frete: FRETE,
    pagamentoAtivo: Boolean(process.env.MP_ACCESS_TOKEN),
  });
}
