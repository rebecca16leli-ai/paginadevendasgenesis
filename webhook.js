// POST /api/webhook — o Mercado Pago chama este endereço sempre que um
// pagamento muda de situação. Aqui buscamos o pagamento direto no Mercado Pago
// (então um aviso falso não tem efeito) e, se a planilha estiver configurada,
// registramos o pedido com endereço de entrega e itens.
import { mercadoPago, lerCorpo } from '../lib/mercadopago.js';

const STATUS = {
  approved: 'Aprovado',
  pending: 'Aguardando pagamento',
  in_process: 'Em análise',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  refunded: 'Devolvido',
  charged_back: 'Estornado',
};

export default async function handler(req, res) {
  const corpo = lerCorpo(req);
  const q = req.query || {};
  const tipo = corpo.type || corpo.topic || q.type || q.topic;
  const id = String(corpo?.data?.id || q['data.id'] || (tipo === 'payment' ? q.id : '') || '').replace(/\D/g, '');

  // Outros avisos (ex.: merchant_order) não interessam aqui.
  if (tipo !== 'payment' || !id) return res.status(200).json({ ok: true, ignorado: true });

  let p;
  try {
    p = await mercadoPago(`/v1/payments/${id}`);
  } catch {
    // Responder erro faz o Mercado Pago tentar de novo mais tarde.
    return res.status(500).json({ ok: false });
  }

  const m = p.metadata || {};
  const itensMp = p.additional_info?.items || [];
  const pedido = {
    data: new Date(p.date_created || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    pedido: p.external_reference || m.pedido || '',
    pagamento_id: String(p.id),
    status: STATUS[p.status] || p.status,
    valor_total: p.transaction_amount,
    frete: m.frete_valor ?? '',
    forma: p.payment_type_id === 'bank_transfer' ? 'Pix' : (p.payment_type_id || ''),
    cliente: m.cliente_nome || '',
    documento: m.cliente_documento || '',
    email: m.cliente_email || p.payer?.email || '',
    whatsapp: m.cliente_telefone || '',
    entrega: m.entrega || '',
    itens: m.itens || itensMp.map((i) => `${i.quantity}x ${i.title}`).join(' | '),
  };
  console.log('Pedido', pedido.pedido, '→', pedido.status);

  const planilha = process.env.PLANILHA_URL;
  if (planilha) {
    try {
      await fetch(planilha, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ segredo: process.env.PLANILHA_SEGREDO || '', ...pedido }),
      });
    } catch (e) {
      console.error('Falha ao gravar na planilha:', e.message);
    }
  }

  return res.status(200).json({ ok: true });
}
