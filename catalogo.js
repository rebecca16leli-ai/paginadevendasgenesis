// =====================================================================
//  CATÁLOGO GENESIS — fonte única de preços
//  É AQUI que você troca preços e valores de frete.
//  A página lê estes valores ao abrir, e o pagamento SEMPRE usa estes
//  números (mesmo que alguém altere o preço no navegador).
//
//  Formato do preço: use ponto nos centavos. Ex.: 1217.60  (não 1.217,60)
//  Películas e PPF são vendidos em BOBINA FECHADA (tabela de 27/10/2026).
// =====================================================================

export const WHATSAPP = '5541988866000';

// Quantas bobinas (ou unidades) de um mesmo item cabem em um pedido.
const MAX_BOBINAS = 20;
const MAX_FERRAMENTAS = 99;

// ---- Películas automotivas · largura 1,52 m ----
// tons = tonalidades (VLT %) · bobinas = { metros: preço da bobina }
// O preço é o mesmo para todas as tonalidades de um produto.
const PELICULAS = [
  { id: "imperiale", codigo: "GDN-IMP", nome: "GUARDIAN IMPERIALE CERÂMICO",
    tons: ["05", "15", "35", "50", "75"], bobinas: { 30: 2950.00, 15: 1650.00 } },
  { id: "democrazia", codigo: "GDN-DEM", nome: "GUARDIAN DEMOCRAZIA CARBONO",
    tons: ["05", "15", "35", "50"], bobinas: { 30: 1700.00, 15: 900.00 } },
  { id: "black_gold", codigo: "GDN-BG", nome: "GUARDIAN BLACK GOLD",
    tons: ["05", "15", "35", "50"], bobinas: { 30: 750.00, 15: 400.00 }, codigos: { "15": "GDN-BG-20" } },
  { id: "metal_hp", codigo: "GDN-MET", nome: "GUARDIAN METAL HP CERÂMICO",
    tons: ["05", "15", "35"], bobinas: { 30: 4500.00, 15: 2250.00 } },
  { id: "photochromic", codigo: "GDN-PHO", nome: "GUARDIAN PHOTOCHROMIC SERIES",
    tons: ["35", "75"], bobinas: { 10: 3000.00 } },
];

// ---- PPF · bobina 1,52 × 15 m · preço da bobina ----
const PPF = [
  { id: "ppf_elite65", nome: "GUARDIAN ELITE SERIES 6.5", preco: 4700.00 },
  { id: "ppf_matte", nome: "GUARDIAN MATTE ULTRA", preco: 6000.00 },
  { id: "ppf_black", nome: "GUARDIAN BLACK ULTRA", preco: 6900.00 },
  { id: "ppf_elite75", nome: "GUARDIAN ELITE SERIES 7.5", preco: 5500.00 },
  { id: "ppf_scudo", nome: "GUARDIAN SCUDO 6.5", preco: 3950.00 },
];

// ---- Linha especial · PPF colorido · bobina 0,50 × 5 m · preço da bobina ----
const PPF_COLORIDO = [
  { id: "camaleao_purple", nome: "ELITE CAMALEÃO PURPLE", preco: 1150.00 },
  { id: "camaleao_black", nome: "ELITE CAMALEÃO BLACK", preco: 1150.00 },
];

// ---- Ferramentas · preço por unidade ----
const FERRAMENTAS = {
  "GD001KIT": { nome: "KIT ESPÁTULAS PARA PPF", preco: 119.90 },
  "GD028KIT": { nome: "KIT PARA DESMONTAGEM INTERNA 38PC", preco: 149.90 },
  "GD034KIT": { nome: "JOGO DE PINÇAS METÁLICAS HARD", preco: 99.90 },
  "GD065PNÇ": { nome: "PINÇA METÁLICA PONTA CHATA", preco: 35.50 },
  "GD066PNÇ": { nome: "PINÇA METÁLICA PONTA FINA", preco: 35.50 },
  "GD067PNÇ": { nome: "PINÇA METÁLICA PONTA CURVADA", preco: 35.50 },
  "GD010CUT": { nome: "CAIXA CORTADORA DE LÂMINA", preco: 74.50 },
  "GD037CUT": { nome: "MINI RASPADOR", preco: 9.50 },
  "GD003CUT": { nome: "ESTILETE BASIC ALUMÍNIO", preco: 44.90 },
  "GD004CUT": { nome: "CORTADOR LINE GUARDIAN", preco: 20.00 },
  "GD009CUT": { nome: "RASPADOR DUPLO", preco: 29.90 },
  "GD042CUT": { nome: "ESTILETE OLFA 9mm", preco: 109.90 },
  "GD097CUT": { nome: "LÂMINAS GOLD TITANIUM 9mm 30° CX/10", preco: 25.00 },
  "GD099CUT": { nome: "LÂMINAS AÇO CARBONO 9mm 30° CX/10", preco: 25.00 },
  "GD045CUT": { nome: "LÂMINAS AÇO INOX 9mm 30° CX/10", preco: 25.00 },
  "GD025CUT": { nome: "CORTADOR DE LINE SIMPLES", preco: 29.90 },
  "GD047CUT": { nome: "SUPORTE DE LÂMINA PARA FILME", preco: 29.90 },
  "GD018CUT": { nome: "SUPORTE METÁLICO DE PRECISÃO 2PC", preco: 80.00 },
  "GD020RD": { nome: "MINI RODO LONGO", preco: 34.90 },
  "GD002RD": { nome: "CABO PLÁSTICO BLUE MAX 35CM", preco: 45.00 },
  "GD022RD": { nome: "CABO ALUMÍNIO BLUE MAX 45CM", preco: 45.00 },
  "GD021RD": { nome: "RODO GRANDE DE SILICONE", preco: 75.00 },
  "GD023RD": { nome: "BLUE MAX ORIGINAL 90°", preco: 69.90 },
  "GD005ESP": { nome: "ESPÁTULA GOLD COM FELTRO", preco: 19.90 },
  "GD006ESP": { nome: "ESPÁTULA DE ACABAMENTO PARA FILM", preco: 19.50 },
  "GD007ESP": { nome: "MINI ESPÁTULA COM FELTRO", preco: 14.90 },
  "GD008ESP": { nome: "ESPÁTULA SLIM FIBRA DE CARBONO", preco: 34.90 },
  "GD016ESP": { nome: "ESPÁTULA GREEN COM FURO", preco: 15.90 },
  "GD019ESP": { nome: "ESPÁTULA PPF WRAP WARD VERDE + ESPÁTULA PPF SOFT AZUL", preco: 30.00 },
  "GD038ESP": { nome: "ESPÁTULA TIAZINHA", preco: 9.90 },
  "GD050ESP": { nome: "ESPÁTULA CONQUISTADOR (BATMAN)", preco: 29.90 },
  "GD032ESP": { nome: "KIT TUCKING 3 PEÇAS HARD", preco: 19.90 },
  "GD033ESP": { nome: "ESPÁTULA LONGA DE RASPAGEM PLÁSTICA", preco: 14.90 },
  "GD029ESP": { nome: "TAPE DE ALCÂNTARA PARA ESPÁTULAS", preco: 40.00 },
  "GD013ESP": { nome: "MINI ESPÁTULA PARA WRAP", preco: 17.90 },
  "GD049ESP": { nome: "ESPÁTULA DE FELTRO 3M", preco: 17.90 },
  "GD051SPY": { nome: "PULVERIZADOR MANUAL SNOW", preco: 129.90 },
  "GD030SPY": { nome: "BORRIFADOR SUPER-RESISTENTE PARA ACD/ALC", preco: 89.90 },
  "GD024SPY": { nome: "PULVERIZADOR PARA ACD/ALC 750 ML", preco: 49.90 },
  "GD031SPY": { nome: "MOCHILA DE PULVERIZAÇÃO ELÉTRICA 3L", preco: 1217.60 },
  "GD039LUV": { nome: "LUVA ALTA PERFORMANCE A SECO", preco: 100.00 },
  "GD027LUV": { nome: "LUVA PARA WRAP/FILM", preco: 19.90 },
  "GD040ACS": { nome: "CORDÃO RETRÁTIL MULTIUSO 90CM", preco: 55.90 },
  "GD043ACS": { nome: "TAPE DE TEFLON ANTIRRISCO COM 10M", preco: 69.90 },
  "GD015GIF": { nome: "PRENDEDOR DE ROLO", preco: 14.90 },
  "GD048MIC": { nome: "MICROFIBRA PREMIUM 2 LADOS", preco: 35.00 },
};

// ---------------------------------------------------------------------
// Monta a lista de itens vendáveis. Não precisa mexer daqui para baixo.
// Cada película vira um item por tonalidade e bobina, ex.: "imperiale-35-30".
// ---------------------------------------------------------------------
const pct = (t) => `${Number(t)}%`;

export const PRODUTOS = {};
for (const p of PELICULAS) {
  for (const tom of p.tons) {
    for (const [metros, preco] of Object.entries(p.bobinas)) {
      PRODUTOS[`${p.id}-${tom}-${metros}`] = {
        nome: `${p.nome} ${pct(tom)} · BOBINA ${metros} M`,
        codigo: (p.codigos && p.codigos[tom]) || `${p.codigo}-${tom}`,
        preco, unidade: 'bobina', max: MAX_BOBINAS,
      };
    }
  }
}
for (const p of PPF) {
  PRODUTOS[p.id] = { nome: `${p.nome} · BOBINA 1,52 × 15 M`, preco: p.preco, unidade: 'bobina', max: MAX_BOBINAS };
}
for (const p of PPF_COLORIDO) {
  PRODUTOS[p.id] = { nome: `${p.nome} · BOBINA 0,50 × 5 M`, preco: p.preco, unidade: 'bobina', max: MAX_BOBINAS };
}
for (const [id, p] of Object.entries(FERRAMENTAS)) {
  PRODUTOS[id] = { ...p, unidade: 'un', max: MAX_FERRAMENTAS };
}

// Frete fixo por região, pelo primeiro dígito do CEP (valor em R$).
// O valor é cobrado junto no pagamento.
export const FRETE = [
  { prefixos: ['8', '9'], nome: 'Sul', valor: 25 },
  { prefixos: ['0', '1', '2', '3'], nome: 'Sudeste', valor: 35 },
  { prefixos: ['7'], nome: 'Centro-Oeste', valor: 45 },
  { prefixos: ['4', '5'], nome: 'Nordeste', valor: 55 },
  { prefixos: ['6'], nome: 'Norte / Nordeste', valor: 60 },
];

export function calcularFrete(cep) {
  const d = String(cep || '').replace(/\D/g, '');
  if (d.length !== 8) return null;
  return FRETE.find((r) => r.prefixos.includes(d[0])) || null;
}
