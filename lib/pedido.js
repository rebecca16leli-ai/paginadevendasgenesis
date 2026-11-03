// Confere os itens que chegam do navegador contra o catálogo do servidor.
import { PRODUTOS } from './catalogo.js';

export function normalizarItens(lista) {
  const erros = [];
  const agrupados = new Map();
  let itemInvalido = false;
  for (const item of Array.isArray(lista) ? lista.slice(0, 80) : []) {
    const id = String(item?.id ?? '');
    const qtd = Number(item?.qtd);
    if (!PRODUTOS[id] || !Number.isInteger(qtd) || qtd < 1) { itemInvalido = true; continue; }
    agrupados.set(id, (agrupados.get(id) || 0) + qtd);
  }
  if (itemInvalido) erros.push('Algum item do carrinho mudou ou não está mais disponível. Atualize a página e confira o carrinho.');
  const itens = [];
  for (const [id, qtd] of agrupados) {
    const p = PRODUTOS[id];
    if (qtd > p.max) {
      erros.push(`${p.nome}: máximo de ${p.max} ${p.unidade === 'bobina' ? 'bobinas' : 'unidades'} por pedido.`);
      continue;
    }
    itens.push({ id, qtd, ...p });
  }
  if (itens.length === 0 && erros.length === 0) erros.push('Seu carrinho está vazio.');
  return { itens, erros };
}

export const subtotalItens = (itens) => Math.round(itens.reduce((s, i) => s + i.qtd * i.preco, 0) * 100) / 100;
