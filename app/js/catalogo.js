// Catálogo: perfis, materiais, acabamentos, cores, acessórios e preços de exemplo.

export const PERFIS = {};
function add(id, nome, forma, o) { PERFIS[id] = { id, nome, forma, ...o }; }

// Tubo redondo (d = diâmetro exterior, e = espessura)
[[33.7, 2, 'tr33x2'], [42.4, 2, 'tr42x2'], [48.3, 2, 'tr48x2'], [60.3, 2, 'tr60x2']]
  .forEach(([d, e, id]) => add(id, `Tubo redondo Ø${String(d).replace('.', ',')}×${e}`, 'tr', { d, e }));
// Tubo quadrado
[[20, 2], [30, 2], [40, 2], [50, 2], [60, 3], [80, 3], [80, 4], [100, 3], [100, 4], [120, 4]]
  .forEach(([a, e]) => add(`tq${a}x${e}`, `Tubo quadrado ${a}×${a}×${e}`, 'tq', { a, e }));
// Tubo retangular
[[40, 20, 2], [50, 30, 2], [60, 40, 2], [80, 20, 2], [80, 40, 2], [100, 50, 3], [120, 60, 3], [150, 50, 3]]
  .forEach(([a, b, e]) => add(`tret${a}x${b}x${e}`, `Tubo retangular ${a}×${b}×${e}`, 'tret', { a, b, e }));
// Barra chata
[[30, 5], [40, 5], [40, 8], [50, 8]]
  .forEach(([a, b]) => add(`barra${a}x${b}`, `Barra chata ${a}×${b}`, 'barra', { a, b }));
// Varão redondo e quadrado
[10, 12, 16].forEach(d => add(`varao${d}`, `Varão redondo Ø${d}`, 'varao', { d }));
[10, 12, 14].forEach(a => add(`vq${a}`, `Varão quadrado ${a}×${a}`, 'vq', { a }));

// Tubo para tubagem (ISO 1127): diâmetro nominal → diâmetro exterior em mm
export const DIAMETROS = { 15: { de: 21.3 }, 20: { de: 26.9 }, 25: { de: 33.7 }, 32: { de: 42.4 }, 40: { de: 48.3 }, 50: { de: 60.3 }, 65: { de: 76.1 },
  80: { de: 88.9 }, 100: { de: 114.3 }, 125: { de: 139.7 }, 150: { de: 168.3 }, 200: { de: 219.1 }, 250: { de: 273 }, 300: { de: 323.9 } };
export const ESPESSURAS = [1.5, 2, 2.6, 3, 4];
for (const [dn, { de }] of Object.entries(DIAMETROS)) for (const e of ESPESSURAS)
  add(`tu${dn}x${e}`, `Tubo DN${dn} Ø${String(de).replace('.', ',')}×${String(e).replace('.', ',')}`, 'tu', { d: de, e, dn: +dn });

/** Área da secção em mm². */
export function area(p) {
  if (!p) return 0;
  switch (p.forma) {
    case 'tr': case 'tu': return Math.PI / 4 * (p.d ** 2 - (p.d - 2 * p.e) ** 2);
    case 'tq': return p.a ** 2 - (p.a - 2 * p.e) ** 2;
    case 'tret': return p.a * p.b - (p.a - 2 * p.e) * (p.b - 2 * p.e);
    case 'barra': return p.a * p.b;
    case 'varao': return Math.PI / 4 * p.d ** 2;
    case 'vq': return p.a ** 2;
    default: return 0;
  }
}
/** Perímetro exterior da secção em mm. */
export function perimetro(p) {
  if (!p) return 0;
  switch (p.forma) {
    case 'tr': case 'tu': case 'varao': return Math.PI * p.d;
    case 'tq': case 'vq': return 4 * p.a;
    case 'tret': case 'barra': return 2 * (p.a + p.b);
    default: return 0;
  }
}
/** Dimensões exteriores: a = face maior, b = face menor; redondo = true se for circular. */
export function dims(perfilId) {
  const p = PERFIS[perfilId];
  if (!p) return { a: 40, b: 40, redondo: false };
  if (p.forma === 'tr' || p.forma === 'tu' || p.forma === 'varao') return { a: p.d, b: p.d, redondo: true };
  return { a: p.a, b: p.b || p.a, redondo: false };
}

export const MATERIAIS = {
  aco: { nome: 'Aço (ferro)', familia: 'aco', densidade: 7850, corBase: '#5a5f66', acabamentos: [
    { id: 'pintado', nome: 'Pintado', modo: 'm2', comCor: true },
    { id: 'galvanizado', nome: 'Galvanizado', modo: 'kg', comCor: false, corFixa: '#b8bcc0' },
    { id: 'galv_lacado', nome: 'Galvanizado e lacado', modo: 'ambos', comCor: true },
    { id: 'nenhum', nome: 'Sem acabamento', modo: 'nenhum', comCor: false, corFixa: '#5a5f66' }] },
  inox304: { nome: 'Inox AISI 304', familia: 'inox', densidade: 7900, corBase: '#c9ccd1', acabamentos: [
    { id: 'escovado', nome: 'Escovado', modo: 'm2', comCor: false, corFixa: '#c2c5ca' },
    { id: 'polido', nome: 'Polido', modo: 'm2', comCor: false, corFixa: '#e3e6ea' },
    { id: 'decapado', nome: 'Decapado e passivado', modo: 'm2', comCor: false, corFixa: '#cfd2d6' },
    { id: 'nenhum', nome: 'Sem acabamento', modo: 'nenhum', comCor: false, corFixa: '#c9ccd1' }] },
  inox316: { nome: 'Inox AISI 316', familia: 'inox', densidade: 7900, corBase: '#c9ccd1', acabamentos: [
    { id: 'escovado', nome: 'Escovado', modo: 'm2', comCor: false, corFixa: '#c2c5ca' },
    { id: 'polido', nome: 'Polido', modo: 'm2', comCor: false, corFixa: '#e3e6ea' },
    { id: 'decapado', nome: 'Decapado e passivado', modo: 'm2', comCor: false, corFixa: '#cfd2d6' },
    { id: 'nenhum', nome: 'Sem acabamento', modo: 'nenhum', comCor: false, corFixa: '#c9ccd1' }] },
  aluminio: { nome: 'Alumínio', familia: 'aluminio', densidade: 2700, corBase: '#d0d3d6', acabamentos: [
    { id: 'lacado', nome: 'Lacado', modo: 'm2', comCor: true },
    { id: 'anodizado', nome: 'Anodizado', modo: 'm2', comCor: false, corFixa: '#cfd2d4' },
    { id: 'nenhum', nome: 'Sem acabamento', modo: 'nenhum', comCor: false, corFixa: '#d0d3d6' }] },
};

export function acabamentoDe(materialId, acabamentoId) {
  const m = MATERIAIS[materialId] || MATERIAIS.aco;
  return m.acabamentos.find(a => a.id === acabamentoId) || m.acabamentos[0];
}

/** kg por metro de um perfil num material. Perfil ou material desconhecido → 0. */
export function kgm(perfilId, materialId) {
  const p = PERFIS[perfilId], m = MATERIAIS[materialId];
  if (!p || !m) return 0;
  return area(p) * m.densidade / 1e6;
}

export const CORES_RAL = [
  { ral: 'RAL 9005', nome: 'Preto', hex: '#0e0e10' },
  { ral: 'RAL 7016', nome: 'Cinzento antracite', hex: '#383e42' },
  { ral: 'RAL 7021', nome: 'Cinzento negro', hex: '#2f3234' },
  { ral: 'RAL 7035', nome: 'Cinzento claro', hex: '#c5c7c4' },
  { ral: 'RAL 9006', nome: 'Alumínio branco', hex: '#a1a1a0' },
  { ral: 'RAL 9007', nome: 'Alumínio cinzento', hex: '#878581' },
  { ral: 'RAL 9010', nome: 'Branco puro', hex: '#f1ece1' },
  { ral: 'RAL 9016', nome: 'Branco tráfego', hex: '#f1f0ea' },
  { ral: 'RAL 8017', nome: 'Castanho chocolate', hex: '#442f29' },
  { ral: 'RAL 8019', nome: 'Castanho acinzentado', hex: '#3d3635' },
  { ral: 'RAL 6005', nome: 'Verde musgo', hex: '#114232' },
  { ral: 'RAL 6009', nome: 'Verde abeto', hex: '#27352a' },
  { ral: 'RAL 3005', nome: 'Vermelho vinho', hex: '#59191f' },
  { ral: 'RAL 5010', nome: 'Azul genciana', hex: '#004f7c' },
  { ral: 'RAL 1015', nome: 'Marfim claro', hex: '#e6d2b5' },
];

export const ACESSORIOS = {
  sapata: { nome: 'Sapata de fixação ao pavimento', un: 'un' },
  fix_lateral: { nome: 'Fixação lateral de prumo', un: 'un' },
  bucha: { nome: 'Bucha metálica M10', un: 'un' },
  tampa: { nome: 'Tampa de topo', un: 'un' },
  pinca_vidro: { nome: 'Pinça de vidro', un: 'un' },
  suporte_parede: { nome: 'Suporte de corrimão à parede', un: 'un' },
  curva90: { nome: 'Curva a 90°', un: 'un' },
  dobradica: { nome: 'Dobradiça de soldar', un: 'un' },
  fechadura: { nome: 'Fechadura com puxador', un: 'un' },
  batente_chao: { nome: 'Batente de pavimento', un: 'un' },
  roda: { nome: 'Roda para portão de correr', un: 'un' },
  carril: { nome: 'Carril de pavimento', un: 'm' },
  guia_sup: { nome: 'Guia superior com roletes', un: 'un' },
  batente_fim: { nome: 'Batente de fim de curso', un: 'un' },
  cremalheira: { nome: 'Cremalheira', un: 'm' },
  motor_prep: { nome: 'Chapa de base e preparação para motor', un: 'un' },
  curva_inox: { nome: 'Curva 90° de soldar (preço para DN50)', un: 'un' },
  flange_inox: { nome: 'Flange de soldar (preço para DN50)', un: 'un' },
  tampao_inox: { nome: 'Tampão de soldar (preço para DN50)', un: 'un' },
  te_inox: { nome: 'Tê de soldar (preço para DN50)', un: 'un' },
  abracadeira_inox: { nome: 'Abraçadeira de tubo (preço para DN50)', un: 'un' },
  placa_base: { nome: 'Placa de base de pilar, cortada e furada', un: 'un' },
  perno: { nome: 'Perno de ancoragem M12 com porca e anilha', un: 'un' },
  bucha_quimica: { nome: 'Bucha química M12 (varão, porca e resina)', un: 'un' },
  parafuso_cob: { nome: 'Autoperfurante de cobertura com anilha EPDM', un: 'un' },
};

export const PRECOS_EXEMPLO = {
  exemplo: true,
  kg: { aco: 1.6, inox304: 5.5, inox316: 7.5, aluminio: 6.0 },
  m2: { vidro: 95, chapa_aco: 28, chapa_inox: 95, chapa_aluminio: 45, sandwich: 24, trapezoidal: 11 },
  acessorios: { sapata: 4.5, fix_lateral: 7, bucha: 0.6, tampa: 0.8, pinca_vidro: 9, suporte_parede: 5.5, curva90: 6,
    dobradica: 8, fechadura: 45, batente_chao: 12, roda: 22, carril: 14, guia_sup: 18, batente_fim: 15,
    cremalheira: 9, motor_prep: 35, placa_base: 14, perno: 2.5, bucha_quimica: 4.5, parafuso_cob: 0.25, curva_inox: 9, flange_inox: 18, tampao_inox: 7, te_inox: 14, abracadeira_inox: 4 },
  horaOficina: 28, horaMontagem: 30, deslocacao: 40,
  acabamento: { pintado: 12, lacado: 16, galvanizado: 0.75, escovado: 8, polido: 18, anodizado: 14, decapado: 6 },
  margem: 30, iva: 23, vara: 6000, serra: 3, materialModo: 'varas', desperdicio: 8, consumiveis: 3,
};

/** Painéis: nome para as listas, peso por m² (quando não vem da espessura) e chave do preço por m². */
export const PAINEIS = {
  vidro: { nome: 'Vidro laminado' }, chapa: { nome: 'Chapa' },
  sandwich: { nome: 'Painel sandwich de cobertura', kgm2: 10, preco: 'sandwich' },
  trapezoidal: { nome: 'Chapa trapezoidal de cobertura', kgm2: 6.5, preco: 'trapezoidal' },
};
/** Nome e peso (kg) de um painel de w × h mm. */
export function painelInfo(p, material) {
  const d = PAINEIS[p.grupo] || { nome: p.grupo }, m2 = p.w * p.h / 1e6;
  const kg = d.kgm2 ? m2 * d.kgm2 : p.grupo === 'chapa' ? m2 * p.esp / 1000 * (MATERIAIS[material] || MATERIAIS.aco).densidade : 0;
  return { nome: `${d.nome} ${String(p.esp).replace('.', ',')} mm`, kg, preco: d.preco || null };
}
