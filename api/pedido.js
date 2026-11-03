// GET /api/pedido?payment_id=123 — quando o cliente volta do Mercado Pago,
// a página confere aqui, direto com o Mercado Pago, se o pagamento foi aprovado.
import { mercadoPago, ErroPagamento } from '../lib/mercadopago.js';

export default async function handler(req, res) {
  const id = String(req.query.payment_id || '').replace(/\D/g, '');
  if (!id) return res.status(400).json({ erro: 'Pagamento não informado.' });

  try {
    const p = await mercadoPago(`/v1/payments/${id}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      status: p.status, // approved | pending | in_process | rejected | cancelled ...
      pedido: p.external_reference || null,
      valor: p.transaction_amount ?? null,
      forma: p.payment_type_id || null, // pix (bank_transfer), credit_card, ticket ...
    });
  } catch (err) {
    const status = err instanceof ErroPagamento ? err.status : 500;
    return res.status(status === 503 ? 503 : 502).json({ erro: 'Não foi possível confirmar o pagamento.' });
  }
}
