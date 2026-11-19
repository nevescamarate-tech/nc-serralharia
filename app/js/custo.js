import { PERFIS, MATERIAIS, ACESSORIOS, kgm, perimetro, acabamentoDe, painelInfo, painelMetal } from './catalogo.js';

const n0 = v => (Number.isFinite(+v) ? +v : 0);

/** Lista de material: perfis (quantidade, metros, kg) e painéis (m²). */
export function listaMaterial(res, material) {
  const mat = MATERIAIS[material] || MATERIAIS.aco;
  const por = new Map();
  for (const p of res.pecas) {
    const g = por.get(p.perfil) || { perfil: p.perfil, nome: (PERFIS[p.perfil] || {}).nome || p.perfil, qtd: 0, mTotal: 0, kg: 0 };
    g.qtd++; g.mTotal += p.L / 1000; por.set(p.perfil, g);
  }
  const lista = [...por.values()].map(g => ({ ...g, kg: g.mTotal * kgm(g.perfil, material) }));
  const pain = new Map();
  for (const p of res.paineis) {
    const k = p.grupo + p.esp;
    const inf = painelInfo(p, material);
    const g = pain.get(k) || { painel: p.grupo, nome: inf.nome, qtd: 0, m2: 0, esp: p.esp, kg: 0, preco: inf.preco };
    g.kg += inf.kg;
    g.qtd++; g.m2 += p.w * p.h / 1e6; pain.set(k, g);
  }
  for (const g of pain.values()) {
    if (!g.kg) delete g.kg;
    lista.push(g);
  }
  return lista;
}

/** Peso do metal (perfis e chapa), em kg. */
export function pesoKg(res, material) {
  return listaMaterial(res, material).reduce((s, x) => s + (!x.painel || painelMetal(x.painel) ? x.kg || 0 : 0), 0);
}
/** Superfície exterior a tratar, em m². */
export function superficieM2(res) {
  let a = 0;
  for (const p of res.pecas) a += perimetro(PERFIS[p.perfil]) * p.L / 1e6;
  for (const p of res.paineis) if (painelMetal(p.grupo)) a += 2 * p.w * p.h / 1e6;
  return a;
}
export function horasEstimadas(res) {
  if (Number.isFinite(res.horas)) return res.horas;   // o modelo (tubagem) traz a sua própria estimativa
  const metros = res.pecas.reduce((s, p) => s + p.L, 0) / 1000;
  return Math.round((0.05 * res.pecas.length + 0.12 * res.ligacoes + 0.15 * metros) * 2) / 2;
}

export function custo(trabalho, res, plano, precos) {
  const semPreco = [], linhas = [];
  const material = trabalho.material in MATERIAIS ? trabalho.material : 'aco';
  const mat = MATERIAIS[material];
  let cap = 'materiais';
  const linha = (desc, qtd, un, pu) => { const total = qtd * pu; linhas.push({ desc, qtd, un, pu, total, cap }); return total; };

  // Perfis
  let precoKg = n0(precos.kg && precos.kg[material]);
  if (!(precos.kg && precos.kg[material] > 0) && res.pecas.length) semPreco.push(material);
  const vara = n0(precos.vara) || 6000;
  let cMaterial = 0;
  for (const g of plano.porPerfil) {
    const m = precos.materialModo === 'util' ? g.totalUtil / 1000 * (1 + n0(precos.desperdicio) / 100) : g.nVaras * vara / 1000;
    const kg = m * kgm(g.perfil, material);
    cMaterial += linha(`${(PERFIS[g.perfil] || {}).nome || g.perfil} (${mat.nome})`, kg, 'kg', precoKg);
  }
  // Painéis
  let cPaineis = 0;
  for (const g of listaMaterial(res, material).filter(x => x.painel)) {
    const ch = g.preco || (g.painel === 'vidro' ? 'vidro' : 'chapa_' + mat.familia);
    const pu = precos.m2 && precos.m2[ch];
    if (!(pu > 0)) semPreco.push(ch);
    cPaineis += linha(g.nome, g.m2, 'm²', n0(pu));
  }
  // Consumíveis de oficina: percentagem sobre os materiais (0 se a tabela do trabalho não a tiver)
  cap = 'consumiveis';
  const pc = n0(precos.consumiveis);
  const cCons = pc > 0 && cMaterial + cPaineis > 0 ? linha('Consumíveis (fio, gás, discos)', pc, '%', (cMaterial + cPaineis) / 100) : 0;
  // Acessórios
  cap = 'ferragens';
  let cAcess = 0;
  for (const a of res.acessorios) {
    const pu = precos.acessorios && precos.acessorios[a.ref];
    if (!(pu > 0)) semPreco.push(a.ref);
    // fator: alguns acessórios (tubagem) têm o preço de tabela para DN50 e escalam com o diâmetro
    cAcess += linha(nomeAcessorio(a), a.qtd, (ACESSORIOS[a.ref] || {}).un || 'un', n0(pu) * (a.fator > 0 ? a.fator : 1));
  }
  // Mão de obra de oficina
  cap = 'oficina';
  const manual = trabalho.horasOficina;
  const oficinaH = manual !== null && manual !== undefined && manual !== '' && Number.isFinite(+manual) && +manual >= 0 ? +manual : horasEstimadas(res);
  const cOficina = linha('Mão de obra de oficina', oficinaH, 'h', n0(precos.horaOficina));
  // Acabamento
  cap = 'tratamento';
  const acab = acabamentoDe(material, trabalho.acabamento), pa = precos.acabamento || {};
  const m2 = superficieM2(res), kg = pesoKg(res, material);
  let cAcab = 0;
  if (acab.modo === 'm2') cAcab = linha(`Acabamento: ${acab.nome}`, m2, 'm²', n0(pa[acab.id]));
  else if (acab.modo === 'kg') cAcab = linha(`Acabamento: ${acab.nome}`, kg, 'kg', n0(pa[acab.id]));
  else if (acab.modo === 'ambos') cAcab = linha('Galvanização', kg, 'kg', n0(pa.galvanizado)) + linha('Lacagem', m2, 'm²', n0(pa.lacado));
  // Montagem e deslocação
  cap = 'montagem';
  const hM = n0(trabalho.horasMontagem);
  const cMont = linha('Montagem em obra', hM, 'h', n0(precos.horaMontagem));
  cap = 'deslocacao';
  const cDesl = trabalho.semDeslocacao ? 0 : linha('Deslocação', 1, 'un', n0(precos.deslocacao));

  const total = cMaterial + cPaineis + cCons + cAcess + cOficina + cAcab + cMont + cDesl;
  const margem = Number.isFinite(+trabalho.margem) && trabalho.margem !== '' && trabalho.margem !== null ? +trabalho.margem : n0(precos.margem);
  const venda = total * (1 + margem / 100);
  const iva = venda * n0(precos.iva) / 100;
  return { material: cMaterial, paineis: cPaineis, consumiveis: cCons, acessorios: cAcess, oficinaH, oficina: cOficina, acabamento: cAcab,
    montagem: cMont, deslocacao: cDesl, total, margem, venda, iva, vendaIva: venda + iva, linhas,
    semPreco: [...new Set(semPreco)], pesoKg: kg, superficieM2: m2 };
}

/** Nome do acessório para as listas; nos de tubagem troca «(preço para DN50)» pelo diâmetro do trabalho. */
export function nomeAcessorio(a) {
  const nome = (ACESSORIOS[a.ref] || {}).nome || a.ref;
  return a.sufixo ? nome.replace(/\s*\(preço para DN50\)/, '') + ' ' + a.sufixo : nome;
}

const CAPITULOS = [['materiais', 'Materiais'], ['ferragens', 'Ferragens e fixação'], ['tratamento', 'Tratamento e acabamento'], ['consumiveis', 'Consumíveis de oficina'],
  ['oficina', 'Mão de obra de oficina'], ['montagem', 'Montagem em obra'], ['deslocacao', 'Deslocação']];
/** Custo arrumado por capítulos (só os que têm valor), com a percentagem de cada um no total. */
export function capitulos(c) {
  const lista = [];
  for (const [id, nome] of CAPITULOS) {
    const linhas = (c.linhas || []).filter(l => l.cap === id && l.total !== 0);
    const total = linhas.reduce((s, l) => s + l.total, 0);
    if (linhas.length && total > 0) lista.push({ n: lista.length + 1, id, nome, total, pct: c.total > 0 ? total / c.total * 100 : 0, linhas });
  }
  return lista;
}
