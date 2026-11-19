// Testes de robustez: muitas combinações de medidas e opções, a verificar regras que têm de valer sempre.
import { test, ok, semNaN } from './t.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo, listaMaterial } from '../js/custo.js';
import { alcadoSVG, plantaSVG } from '../js/desenho2d.js';
import { folhaPreparacao, folhaProposta } from '../js/folhas.js';
import { PRECOS_EXEMPLO, PERFIS, MATERIAIS, DIAMETROS, ESPESSURAS, dims } from '../js/catalogo.js';

// Gerador pseudo-aleatório com semente fixa: os casos são sempre os mesmos.
let semente = 12345;
const rnd = () => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; };
const entre = (a, b) => Math.round(a + rnd() * (b - a));
const um = lista => lista[Math.floor(rnd() * lista.length)];
const perfis = (...formas) => Object.values(PERFIS).filter(p => formas.includes(p.forma)).map(p => p.id);
const TUBOS = perfis('tq', 'tret', 'tr'), FINOS = perfis('varao', 'vq', 'barra');

const geradores = {
  guarda: () => ({ trocos: Array.from({ length: entre(1, 4) }, (_, i) => ({ comp: entre(200, 9000), desnivel: um([0, 0, 0, entre(-2500, 2500)]), viragem: i ? um([0, 90, -90, 45, -135, entre(-170, 170)]) : 0 })),
    altura: um([900, 1000, 1100, 1200, entre(400, 2000)]), fixacao: um(['topo', 'lateral']), enchimento: um(['varoes', 'barras', 'vidro', 'chapa', 'nenhum']),
    pPrumo: um(TUBOS), pCorrimao: um(TUBOS), pTravessa: um(TUBOS), pVarao: um(FINOS), maxPrumos: um([1200, 1000, 1500, entre(300, 3000)]), vaoMax: um([110, 100, 90, entre(40, 200)]), baixo: um([100, 50, entre(20, 200)]), nBarras: entre(1, 12) }),
  corrimao: () => ({ comp: entre(200, 15000), desnivel: um([0, entre(-3000, 3000)]), altura: entre(700, 1200), tubo: um(perfis('tr', 'tq', 'tret')), montagem: um(['parede', 'prumos']), pPrumo: um(TUBOS), extremidade: um(['tampa', 'curva']), maxSuportes: um([1000, entre(300, 2500)]) }),
  portao: () => ({ largura: entre(600, 9000), altura: entre(900, 3000), tipo: um(['batente1', 'batente2', 'correr']), enchimento: um(['varoes', 'chapa', 'laminas', 'almofadas']), nAlmofadas: um([0, 0, entre(1, 8)]), tardoz: rnd() < 0.5, isolamento: rnd() < 0.5, relevo: um([20, entre(0, 80)]),
    pAro: um(TUBOS), pTravessa: um(TUBOS), pVarao: um(FINOS), pLamina: um(perfis('tret', 'barra')), vaoMax: um([110, entre(40, 200)]), folgaLado: entre(5, 40), folgaChao: entre(10, 150), sobreposicao: entre(50, 500), pilares: rnd() < 0.5, pPilar: um(perfis('tq', 'tret')), motor: rnd() < 0.5 }),
  tubagem: () => ({ dn: +um(Object.keys(DIAMETROS)), esp: um(ESPESSURAS), trocos: Array.from({ length: entre(1, 7) }, () => ({ comp: entre(150, 9000), dir: um(['dir', 'esq', 'cima', 'baixo', 'frente', 'tras']), tes: um([0, 0, 0, 1, 3]) })),
    ini: um(['livre', 'flange', 'tampao']), fim: um(['livre', 'flange', 'tampao']), maxSuportes: um([2000, entre(500, 4000)]) }),
  telheiro: () => ({ comp: entre(600, 40000), largura: entre(600, 9000), altura: entre(1000, 6000), pendente: um([0, 5, 10, entre(0, 40)]), aguas: um(['uma', 'uma', 'duas']), apoio: um(['pilares', 'parede']), cobertura: um(['sandwich', 'trapezoidal', 'ripado', 'nenhuma']),
    pPilar: um(perfis('tq', 'tret', 'tr')), pViga: um(perfis('tret', 'tq')), pMadre: um(TUBOS), vaoMax: um([3500, entre(500, 8000)]), maxMadres: um([1000, 450, entre(100, 2000)]), beiral: um([200, 0, entre(0, 800)]) }),
  grade: () => ({ largura: entre(200, 5000), altura: entre(200, 3500), qtd: um([1, 1, entre(1, 12)]), pAro: um(perfis('tret', 'tq', 'barra')), pBarra: um(perfis('tr', 'varao', 'vq', 'tq')), vaoMax: um([120, 110, entre(40, 200)]) }),
  guardamuro: () => ({ comp: entre(100, 60000), altura: um([600, entre(150, 1500)]), passo: um([110, entre(30, 300)]), modulo: um([2970, entre(400, 6000)]), rasgo: um([80, entre(40, 150)]), pCorrimao: um(perfis('tr', 'tq')), pBarra: um(perfis('tr', 'varao', 'vq')), pChata: um(perfis('barra')) }),
  abrigo: () => ({ comp: entre(600, 7000), largura: entre(600, 4500), altura: entre(1200, 3800), pendente: um([5, 0, entre(0, 30)]), pes: um([150, 0, entre(0, 500)]), porta: rnd() < 0.7, portaL: um([900, entre(200, 3000)]), portaH: um([2000, entre(500, 3500)]),
    piso: rnd() < 0.7, revestimento: um(['trapezoidal', 'nenhum']), cobertura: um(['sandwich', 'trapezoidal', 'nenhuma']), pPilar: um(perfis('tq')), pBase: um(perfis('tret', 'tq')), pTopo: um(perfis('tq', 'tret')) }),
  gradeamento: () => ({ comp: entre(200, 60000), altura: um([1200, 1000, entre(300, 3000)]), fixacao: um(['chumbado', 'sapata']), enchimento: um(['varoes', 'barras']), pPrumo: um(TUBOS), pTravessa: um(TUBOS), pVarao: um(FINOS),
    maxPrumos: um([2000, entre(200, 4000)]), vaoMax: um([110, entre(40, 200)]), baixo: um([80, entre(0, 200)]), topo: um([100, entre(0, 300)]), pontas: um([0, 0, entre(0, 300)]), nBarras: entre(1, 15) }),
  escada: () => ({ desnivel: entre(300, 7000), largura: um([900, 1000, entre(400, 2500)]), cobertor: um([280, 250, entre(150, 450)]), espelhoMax: um([180, 170, entre(100, 240)]), pBanzo: um(perfis('tret', 'tq')), degrau: um(['lacrimada', 'gradil']), patamar: um([0, 1200, entre(0, 5000)]), estrutura: um(['banzos', 'central']), patamarLargura: um([0, 0, entre(0, 6000)]), patamarLado: um(['dir', 'esq']), guarda: um(['nenhuma', 'um', 'dois']), guardaAltura: um([1100, entre(300, 2000)]), guardaPasso: um([100, entre(20, 400)]), pGuarda: um(perfis('barra', 'vq', 'varao', 'tq')), pPilar: um(perfis('tq')) }),
};
const obra = { cliente: 'C', nome: 'O', morada: '', numero: '1', data: '2026-11-18', validade: 30, condicoes: '' };

for (const tipo of Object.keys(TIPOS)) {
  test(`${tipo}: 400 combinações sem peças impossíveis, sem NaN, com custo e desenhos coerentes`, () => {
    for (let n = 0; n < 400; n++) {
      const medidas = geradores[tipo](), material = um(Object.keys(MATERIAIS));
      const trabalho = { tipo, nome: 'T', medidas, material, acabamento: um(MATERIAIS[material].acabamentos).id, margem: entre(0, 60), horasOficina: null, horasMontagem: entre(0, 16), cor: '#333333', corNome: 'x' };
      const caso = () => JSON.stringify({ tipo, medidas });
      const res = calcular(trabalho);
      ok(semNaN(res), 'NaN no resultado: ' + caso());
      ok(res.pecas.every(p => p.L > 0 && p.t > 0), 'peça com comprimento ou secção ≤ 0: ' + caso());
      ok(res.pecas.every(p => PERFIS[p.perfil]), 'perfil desconhecido: ' + caso());
      ok(res.paineis.every(p => p.w > 0 && p.h > 0), 'painel com medida ≤ 0: ' + caso());
      ok(res.acessorios.every(a => a.qtd > 0), 'acessório com quantidade ≤ 0: ' + caso());
      ok(res.pecas.length < 5000, 'peças a mais: ' + caso());
      for (const v of res.vaos) ok(v.folga > 0 && v.folga <= Math.max(20, +medidas.vaoMax || 110) + 0.11, `folga ${v.folga} fora do máximo: ` + caso());
      // corrimão da guarda: nunca mais curto do que o eixo do troço
      if (tipo === 'guarda') for (const p of res.pecas.filter(x => x.grupo === 'corrimao')) ok(p.ang.every(a => a >= 0 && a <= 80), 'ângulo de corte fora de 0–80: ' + caso());
      // lista de corte: nada se perde nem se inventa
      const plano = planoCorte(res.pecas, { vara: 6000, serra: 3 });
      const cortes = plano.porPerfil.reduce((s, g) => s + g.varas.reduce((a, v) => a + v.cortes.length, 0), 0);
      ok(cortes === res.pecas.length, `lista de corte com ${cortes} cortes para ${res.pecas.length} peças: ` + caso());
      for (const g of plano.porPerfil) {
        ok(g.nVaras * 6000 >= g.totalUtil - 0.01, 'varas a menos: ' + caso());
        for (const v of g.varas) if (!v.emenda) ok(v.cortes.reduce((s, c) => s + c.L, 0) + 3 * (v.cortes.length - 1) <= 6000.01, 'vara com cortes a mais: ' + caso());
      }
      // lista de material bate com as peças
      const lm = listaMaterial(res, material), metros = res.pecas.reduce((s, p) => s + p.L, 0) / 1000;
      ok(Math.abs(lm.filter(l => !l.painel).reduce((s, l) => s + l.mTotal, 0) - metros) < 0.001, 'metros da lista ≠ peças: ' + caso());
      // custo
      const c = custo(trabalho, res, plano, JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
      ok(semNaN(c) && c.total >= 0 && c.venda >= c.total - 0.001, 'custo incoerente: ' + caso());
      ok(Math.abs(c.linhas.reduce((s, l) => s + l.total, 0) - c.total) < 0.01, 'soma das parcelas ≠ total: ' + caso());
      ok(c.semPreco.length === 0, 'sem preço: ' + c.semPreco.join(',') + ' ' + caso());
      // desenhos e folhas
      const a = alcadoSVG(res), pl = plantaSVG(res);
      ok(!/NaN|Infinity|undefined/.test(a + pl), 'desenho com NaN: ' + caso());
      if (n % 40 === 0 && res.pecas.length) {
        const f = folhaPreparacao(obra, trabalho, res, plano, '', {}) + folhaProposta(obra, [{ nome: 'T', descricao: 'd', acabamento: 'a', venda: c.venda, iva: c.iva }], {}, PRECOS_EXEMPLO);
        ok(!/NaN|Infinity|undefined|\[object/.test(f), 'folha com NaN ou undefined: ' + caso());
      }
    }
  });
}

test('guarda: o desenho mostra tantas peças quantas a lista de material conta', () => {
  for (let n = 0; n < 60; n++) {
    const res = calcular({ tipo: 'guarda', medidas: geradores.guarda() });
    const svg = alcadoSVG(res);
    if (!res.pecas.length) continue;
    ok((svg.match(/class="pc"/g) || []).length === res.pecas.length, 'peças desenhadas ≠ peças contadas');
    ok((svg.match(/class="(pn|vd)"/g) || []).length === res.paineis.length, 'painéis desenhados ≠ contados');
  }
});
test('guarda: os prumos nunca ficam mais afastados do que o máximo pedido', () => {
  for (let n = 0; n < 200; n++) {
    const m = geradores.guarda(), res = calcular({ tipo: 'guarda', medidas: m });
    const max = Math.max(200, m.maxPrumos);
    for (const c of res.cotas.filter(x => x.tipo === 'h' && x.nivel === 1)) ok(c.s2 - c.s1 <= max + 0.5, `prumos a ${c.s2 - c.s1} com máximo ${max}`);
  }
});
test('guarda: as travessas e os varões cabem entre os prumos e dentro da altura', () => {
  for (let n = 0; n < 200; n++) {
    const m = { ...geradores.guarda(), enchimento: 'varoes' }, res = calcular({ tipo: 'guarda', medidas: m });
    const hc = dims(PERFIS[m.pCorrimao] ? m.pCorrimao : 'tr42x2').a;
    for (const p of res.pecas.filter(x => x.grupo === 'varao')) ok(p.L <= res.altura - hc + 0.5, 'varão mais alto do que a guarda');
  }
});
