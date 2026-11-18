// Folhas para imprimir: preparação (oficina) e proposta (cliente).
import { esc, dec, eur, dataPT, logoSVG } from './fmt.js';
import { PERFIS, MATERIAIS, ACESSORIOS, acabamentoDe } from './catalogo.js';
import { listaMaterial, nomeAcessorio } from './custo.js';
import { alcadoSVG, plantaSVG } from './desenho2d.js';
import { TIPOS } from './calc.js';

function cabecalho(titulo, obra, empresa) {
  const e = empresa || {};
  return `<header class="f-cab"><div class="f-logo">${logoSVG({ altura: 90, cor: '#1a1a1a' })}</div>
<div class="f-emp">${[e.morada, e.telefone, e.email, e.nif ? 'NIF ' + e.nif : ''].filter(Boolean).map(esc).join('<br>')}</div></header>
<h1 class="f-tit">${esc(titulo)}</h1>
<table class="f-dados"><tr><th>Cliente</th><td>${esc(obra.cliente)}</td><th>Data</th><td>${esc(dataPT(obra.data))}</td></tr>
<tr><th>Obra</th><td>${esc(obra.nome)}</td><th>N.º</th><td>${esc(obra.numero)}</td></tr>
<tr><th>Morada</th><td colspan="3">${esc(obra.morada)}</td></tr></table>`;
}

export function descricaoMaterial(trabalho) {
  const m = MATERIAIS[trabalho.material] || MATERIAIS.aco, a = acabamentoDe(trabalho.material, trabalho.acabamento);
  return `${m.nome}, ${a.nome.toLowerCase()}${a.comCor && trabalho.corNome ? ' ' + trabalho.corNome : ''}`;
}

/** Folha de preparação para a oficina: desenhos, material, corte e acessórios. Sem preços. */
export function folhaPreparacao(obra, trabalho, res, plano, imagem3d, empresa, fotos = []) {
  const tipo = (TIPOS[trabalho.tipo] || {}).nome || '';
  const mat = listaMaterial(res, trabalho.material).map(l => l.painel
    ? `<tr><td>${esc(l.nome)}</td><td class="n">${l.qtd}</td><td class="n">${dec(l.m2)} m²</td><td class="n">${l.kg ? dec(l.kg, 1) : '—'}</td></tr>`
    : `<tr><td>${esc(l.nome)}</td><td class="n">${l.qtd}</td><td class="n">${dec(l.mTotal)} m</td><td class="n">${dec(l.kg, 1)}</td></tr>`).join('');
  const corte = plano.porPerfil.map(g => {
    const cont = new Map();
    for (const v of g.varas) for (const c of v.cortes) {
      const k = `${c.L}|${c.ang[0]}|${c.ang[1]}`; cont.set(k, (cont.get(k) || 0) + 1);
    }
    const linhas = [...cont].map(([k, q]) => { const [L, a1, a2] = k.split('|');
      return `<tr><td></td><td class="n">${q}</td><td class="n">${dec(+L, 1)}</td><td class="n">${dec(+a1, 1)}° / ${dec(+a2, 1)}°</td></tr>`; }).join('');
    return `<tr class="grupo"><td>${esc((PERFIS[g.perfil] || {}).nome || g.perfil)}</td><td colspan="3">${g.nVaras} vara(s) · sobra ${dec(g.desperdicio / 1000)} m</td></tr>${linhas}`;
  }).join('');
  const ac = res.acessorios.map(a => `<tr><td>${esc(nomeAcessorio(a))}</td><td class="n">${dec(a.qtd, a.qtd % 1 ? 2 : 0)} ${(ACESSORIOS[a.ref] || {}).un || 'un'}</td></tr>`).join('');
  const avisos = [...res.avisos, ...plano.avisos].map(a => `<li>${esc(a)}</li>`).join('');
  return `<article class="folha">${cabecalho('Folha de preparação', obra, empresa)}
<h2>${esc(trabalho.nome || tipo)} <small>${esc(tipo)} · ${esc(descricaoMaterial(trabalho))}</small></h2>
${avisos ? `<ul class="f-avisos">${avisos}</ul>` : ''}
<h3>${res.dn ? 'Isométrico' : 'Alçado'}</h3><div class="f-des">${alcadoSVG(res)}</div>
<h3>Planta</h3><div class="f-des f-planta">${plantaSVG(res)}</div>
${imagem3d ? `<h3>Pormenor 3D</h3><img class="f-3d" src="${imagem3d}" alt="Pormenor 3D">` : ''}
<h3>Lista de material</h3><table class="f-tab"><tr><th>Material</th><th class="n">Qtd.</th><th class="n">Total</th><th class="n">kg</th></tr>${mat}</table>
<h3>Lista de corte</h3><p class="f-nota">Comprimentos em mm, pela ponta mais comprida. Ângulos de cada topo (0° = esquadria).</p>
<table class="f-tab"><tr><th>Perfil</th><th class="n">Qtd.</th><th class="n">Comprimento</th><th class="n">Ângulos</th></tr>${corte}</table>
${ac ? `<h3>Acessórios e ferragens</h3><table class="f-tab">${ac}</table>` : ''}
${trabalho.notas ? `<h3>Notas</h3><p>${esc(trabalho.notas)}</p>` : ''}
${fotos.length ? `<h3>Fotos</h3><div class="f-fotos">${fotos.map(f => `<figure><img src="${esc(f.src)}" alt="">${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}</article>`;
}

/** Proposta para o cliente. Só preços de venda: nunca valores internos. */
export function folhaProposta(obra, linhas, empresa, precos) {
  const sub = linhas.reduce((s, l) => s + (+l.venda || 0), 0);
  // O IVA é o de cada trabalho (cópia de preços do trabalho), para bater com o ecrã.
  const proprio = linhas.some(l => Number.isFinite(l.iva));
  const iva = proprio ? linhas.reduce((s, l) => s + (+l.iva || 0), 0) : sub * (+precos.iva || 0) / 100;
  const taxa = proprio ? (sub > 0 ? Math.round(iva / sub * 1000) / 10 : 0) : (+precos.iva || 0);
  const corpo = linhas.map((l, i) => `<tr><td class="n">${i + 1}</td><td><strong>${esc(l.nome)}</strong><br>${esc(l.descricao)}<br><em>${esc(l.acabamento)}</em>
${l.imagem ? `<br><img class="f-mini" src="${l.imagem}" alt="">` : ''}</td><td class="n">${eur(l.venda)}</td></tr>`).join('');
  return `<article class="folha">${cabecalho('Proposta', obra, empresa)}
<table class="f-tab f-prop"><tr><th class="n">N.º</th><th>Descrição</th><th class="n">Valor</th></tr>${corpo}</table>
<table class="f-totais"><tr><th>Total sem IVA</th><td>${eur(sub)}</td></tr><tr><th>IVA ${dec(taxa, taxa % 1 ? 1 : 0)}%</th><td>${eur(iva)}</td></tr>
<tr class="f-total"><th>Total</th><td>${eur(sub + iva)}</td></tr></table>
<p class="f-nota">Validade da proposta: ${esc(obra.validade || 30)} dias.</p>
${obra.condicoes ? `<h3>Condições</h3><p>${esc(obra.condicoes).replace(/\n/g, '<br>')}</p>` : ''}</article>`;
}
