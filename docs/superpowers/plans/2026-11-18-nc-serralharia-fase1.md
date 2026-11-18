# NC Serralharia (fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web instalável que, a partir das medidas tiradas em obra, gera desenho cotado, 3D, lista de material, lista de corte, custo e folhas para guardas, corrimãos e portões.

**Architecture:** Ficheiros estáticos com módulos ES, sem compilação. Cada modelo (`guarda`, `corrimao`, `portao`) é uma função pura que devolve uma única estrutura `Resultado` (peças, painéis, acessórios); desenho 2D, 3D, corte e custo leem todos dela. Dados no aparelho (IndexedDB), com exportação/importação em JSON.

**Tech Stack:** HTML/CSS/JS (ES modules), three.js r160 + OrbitControls em `app/vendor/`, SVG, IndexedDB, service worker.

**Spec:** `docs/superpowers/specs/2026-11-18-nc-serralharia-design.md`

## Global Constraints

- Tudo dentro de `app/`. Sem dependências de rede em execução (three.js local, sem fontes externas).
- Interface em português de Portugal. Entradas em mm; listas em m e kg.
- Sem Node/Python: testes em `app/tests/index.html`, no browser. Servidor local: `serve.ps1` (PowerShell HttpListener, porta 8765).
- A pasta não é repositório git e o utilizador não pediu commits: os passos «commit» são omitidos.
- A folha de proposta nunca mostra custo, margem nem horas.
- Valores por omissão: altura da guarda 1100; afastamento máx. de prumos 1200; vão livre máx. entre varões 110; travessa inferior a 100 do pavimento; suportes de corrimão a 1000 máx.; vara 6000; espessura de corte 3; IVA 23%; margem 30%; validade 30 dias.
- Comprimentos de corte pela ponta mais comprida; ângulos em graus, 0 = esquadria.

## Review Focus

1. Campo vazio, zero, negativo ou texto num número → o modelo devolve `avisos` e nunca lança exceção nem NaN (teste em cada modelo: `calc({})` e `calc({comprimento:-5})`).
2. Peça mais comprida que a vara → `corte` devolve aviso de emenda e não entra em ciclo infinito (teste em `corte`).
3. Troço muito curto (menor que dois prumos) ou vão de portão menor que o aro → aviso, sem peças de comprimento negativo (teste em guarda e portão).
4. Importar ficheiro que não é JSON ou sem `versao` → rejeita e os dados existentes ficam intactos (teste em `store`).
5. Preço em falta na tabela para um perfil/acessório → custo trata como 0 e lista o item em `semPreco`, sem NaN (teste em `custo`).

---

## Estruturas partilhadas (todas as tarefas)

```js
// Peça linear
{ grupo:'prumo', perfil:'tq40x2', L:1100, ang:[0,0],
  a:[x,y,z], b:[x,y,z],        // eixo em mm; X ao longo, Y altura, Z profundidade
  s:[s1,y1,s2,y2] }            // coordenadas no alçado desenvolvido
// Painel
{ grupo:'vidro'|'chapa', esp:10, w:900, h:800,
  o:[x,y,z], u:[ux,uy,uz], s:[s1,y1,s2,y2] }   // canto inferior, direção ao longo
// Acessório
{ ref:'sapata', qtd:4 }
// Resultado de um modelo
{ pecas:[], paineis:[], acessorios:[], ligacoes:0, avisos:[], cotas:[{s1,s2,y,texto}|{y1,y2,s,texto}],
  comprimentoTotal:0, altura:0 }
```

`Trabalho = { id, tipo:'guarda'|'corrimao'|'portao', nome, medidas:{…}, material:'aco'|'inox304'|'inox316'|'aluminio', acabamento, cor:'#rrggbb', corNome, margem, horasOficina:null|n, horasMontagem:n, precos:{…cópia}, alterado }`
`Obra = { id, cliente, nome, morada, numero, data, validade, condicoes, trabalhos:[Trabalho], alterado }`

---

### Task 1: Base, servidor, catálogo e arnês de testes

**Files:** Create `serve.ps1`, `.claude/launch.json`, `app/index.html` (esqueleto com importmap `three`→`./vendor/three.module.min.js`), `app/img/logo-nc.svg`, `app/js/catalogo.js`, `app/tests/index.html`, `app/tests/t.js`, `app/tests/catalogo.test.js`, `app/vendor/*` (descarregar three r160 `build/three.module.min.js` e `examples/jsm/controls/OrbitControls.js`).

**Interfaces — Produces:**
- `t.js`: `test(nome, fn)`, `eq(a,b)`, `perto(a,b,tol=0.5)`, `ok(v)`; a página mostra `N passaram, M falharam` em `#resumo`.
- `catalogo.js`: `PERFIS` (mapa id → `{id, nome, forma:'tr'|'tq'|'tret'|'barra'|'varao'|'vq', d|a|b, e}`), `MATERIAIS` (id → `{nome, densidade, acabamentos:[{id,nome,modo:'m2'|'kg'|'nenhum'}]}`; densidades 7850, 7900, 7900, 2700), `CORES_RAL` (≥12 `{ral,nome,hex}`), `ACESSORIOS` (ref → `{nome, un}`), `PRECOS_EXEMPLO`, `area(perfil)` mm², `perimetro(perfil)` mm, `kgm(perfilId, materialId)`.
- `PRECOS_EXEMPLO = { exemplo:true, kg:{aco:1.6, inox304:5.5, inox316:7.5, aluminio:6.0}, m2:{vidro:95, chapa_aco:28, chapa_inox:95, chapa_aluminio:45}, acessorios:{ref:€}, horaOficina:28, horaMontagem:30, deslocacao:40, acabamento:{pintado:12, lacado:16, galvanizado:0.75, galv_lacado:… , escovado:8, polido:18, anodizado:14}, margem:30, iva:23, vara:6000, serra:3, materialModo:'varas'|'util', desperdicio:8 }`

- [ ] Teste: `kgm('tq40x2','aco')` ≈ 2.39 (tol 0.05); `kgm('tr42x2','inox304')` ≈ 1.99; `kgm('varao12','aco')` ≈ 0.888.
- [ ] Abrir `/tests/` e ver falhar; implementar; ver passar.

### Task 2: Corte

**Files:** Create `app/js/corte.js`, `app/tests/corte.test.js`.

**Produces:** `planoCorte(pecas, {vara=6000, serra=3}) → { porPerfil:[{perfil, varas:[{cortes:[{L,ang}], sobra}], nVaras, totalUtil, desperdicio}], avisos:[] }` — first-fit decrescente; peça > vara: aviso «emenda» e conta `ceil(L/vara)` varas próprias.

- [ ] Testes: 4×2900 do mesmo perfil → 2 varas; 3×2000 → 1 vara (2000×3+3×3 > 6000? não: 6009 > 6000 → 2 varas); 1×7000 → aviso e 2 varas; lista vazia → `porPerfil:[]`.
- [ ] Falhar, implementar, passar.

### Task 3: Modelo guarda

**Files:** Create `app/js/modelos/guarda.js`, `app/js/modelos/util.js`, `app/tests/guarda.test.js`.

**Produces:** `util.js`: `num(v, def)` (número finito > 0 ou `def`), `reparte(L, max) → n vãos`. `guarda.js`: `DEF_GUARDA`, `calcGuarda(medidas) → Resultado`.
`medidas = { trocos:[{comp, desnivel:0, viragem:0}], altura:1100, fixacao:'topo'|'lateral', enchimento:'varoes'|'barras'|'vidro'|'chapa'|'nenhum', pPrumo:'tq40x2', pCorrimao:'tr42x2', pTravessa:'tret40x20x2', pVarao:'varao12', maxPrumos:1200, vaoMax:110, baixo:100, nBarras:5 }` (`viragem` = ângulo em planta, em graus, antes do troço).

Regras: prumos em cada extremidade de troço (um só no canto partilhado) e repartidos por igual com afastamento ≤ `maxPrumos`; corrimão por troço com `L = hipotenusa(comp, desnivel)`, meia-esquadria (`viragem/2`) nos cantos; prumo `L = altura − altura do perfil do corrimão` (fixação lateral: +120); travessas superior e inferior entre prumos nos enchimentos `varoes` e `chapa`; nº de varões por vão = `ceil((vão + d)/(vaoMax + d)) − 1`; `barras`: `nBarras` horizontais entre prumos; `vidro`: painel por vão com folga de 20 e 4 pinças; acessórios: `sapata` (topo) ou `fix_lateral` por prumo, `bucha` ×4 (topo) ou ×2 (lateral) por prumo, `tampa` ×2 no corrimão. `ligacoes` = nº de topos soldados.

- [ ] Testes: troço único 3000, omissões → 4 prumos, 1 corrimão L=3000, 6 travessas, cada vão com vão livre ≤ 110; troço 3000 com desnível 1750 → corrimão L≈3473; 2 troços com viragem 90 → prumos = soma − 1 e `ang` 45 no canto; `calcGuarda({})` e `{trocos:[{comp:-5}]}` → `avisos.length>0`, sem NaN; troço de 50 → aviso.
- [ ] Falhar, implementar, passar.

### Task 4: Modelos corrimão e portão

**Files:** Create `app/js/modelos/corrimao.js`, `app/js/modelos/portao.js`, testes correspondentes.

**Produces:**
- `calcCorrimao({comp, desnivel:0, altura:900, tubo:'tr42x2', montagem:'parede'|'prumos', pPrumo:'tr42x2', extremidade:'tampa'|'curva', maxSuportes:1000}) → Resultado`. Suportes: `reparte(comp, max)+1`, com o primeiro e o último a 150 das pontas; `curva`: +2 acessórios `curva90` e +80 por ponta no tubo.
- `calcPortao({largura, altura:1800, tipo:'batente1'|'batente2'|'correr', enchimento:'varoes'|'chapa'|'laminas', pAro:'tq50x2', pTravessa:'tq40x2', pVarao:'vq12', pLamina:'tret80x20x2', vaoMax:110, folgaLado:15, folgaChao:50, sobreposicao:200, pilares:false, pPilar:'tq100x3', motor:false}) → Resultado`. Batente: largura da folha = `(largura − folgas)/nFolhas`; aro com 4 peças a 45°; travessa intermédia se altura > 1500; pilares `L = altura + 600` (chumbar). Correr: folha = `largura + sobreposicao`, `carril` = 2×largura (acessório ao metro), 2 `roda`, 1 `guia_sup`, 2 `batente_fim`, `cremalheira` (m) e `motor_prep` se `motor`. Batente: 2 `dobradica` por folha (3 se altura > 2000), 1 `fechadura`, `batente_chao` nas 2 folhas.

- [ ] Testes corrimão: 3000 parede → 4 suportes, tubo 3000; curva → tubo 3160. Portão batente2 3000×1800 → 2 folhas de 1477.5 (tol 1), 8 peças de aro com `ang` [45,45], 4 dobradiças; correr 4000 → folha 4200, carril 8 m; `calcPortao({})` → avisos; largura 60 → aviso sem negativos.
- [ ] Falhar, implementar, passar.

### Task 5: Custo

**Files:** Create `app/js/custo.js`, `app/js/calc.js`, testes.

**Produces:**
- `calc.js`: `calcular(trabalho) → Resultado` (despacha por `tipo`).
- `listaMaterial(res, material) → [{perfil, nome, qtd, mTotal, kg}]` + painéis `{nome, m2}`.
- `custo(trabalho, res, plano, precos) → { material, paineis, acessorios, oficinaH, oficina, acabamento, montagem, deslocacao, total, margem, venda, iva, vendaIva, linhas:[{desc, qtd, un, pu, total}], semPreco:[] }`.
  Horas de oficina estimadas = `0.05×nCortes + 0.12×ligacoes + 0.15×metros`, substituídas por `trabalho.horasOficina` se não for null. Acabamento: modo `m2` → área exterior (perímetro × L + painéis de chapa ×2) × preço; modo `kg` → peso × preço. Chapa: preço `chapa_<família do material>`. `venda = total × (1 + margem/100)`.
- `superficieM2(res)`, `pesoKg(res, material)`.

- [ ] Testes: custo com tabela de exemplo → `total = soma das parcelas`; margem 30 → `venda = total×1.3`; `vendaIva = venda×1.23`; preço de acessório em falta → `semPreco` contém a ref e sem NaN; `horasOficina:10` → `oficinaH===10`.
- [ ] Falhar, implementar, passar.

### Task 6: Dados

**Files:** Create `app/js/store.js`, teste.

**Produces:** `abrir()`, `listarObras()`, `guardarObra(obra)`, `apagarObra(id)`, `lerPrecos()`, `guardarPrecos(p)`, `lerEmpresa()`, `guardarEmpresa(e)`, `exportar() → string JSON {versao:1, exportado, obras, precos, empresa}`, `analisarImport(texto) → {ok, erro?, novas, atualizadas, iguais}`, `aplicarImport(texto)`, `novoId()`, `diasSemCopia()`. IndexedDB `nc-serralharia` com stores `obras` (keyPath `id`) e `kv`; se IndexedDB falhar, memória + `localStorage`. Chama `navigator.storage.persist()` em `abrir()`. Junção por `id`, ganha o `alterado` mais recente.

- [ ] Testes (com base de dados de nome `nc-teste`): guardar e ler obra; importar texto `"abc"` → `ok:false` e obras intactas; importar sem `versao` → `ok:false`; importar obra com `alterado` mais antigo → não substitui; mais recente → substitui.
- [ ] Falhar, implementar, passar.

### Task 7: Desenho 2D

**Files:** Create `app/js/desenho2d.js`, teste.

**Produces:** `alcadoSVG(res, {titulo}) → string SVG` (peças pelo `s`, com espessura real do perfil, painéis, cotas gerais e parciais em mm, altura), `plantaSVG(res) → string SVG` (projeção XZ com cotas dos troços). Traço preto sobre branco; `viewBox` ajustado; texto das cotas legível em A4.

- [ ] Testes: o SVG da guarda de 3000 contém `>3000<` e `>1100<`, e nº de `<rect`/`<line` ≥ nº de peças; resultado vazio → SVG válido com «sem medidas».
- [ ] Falhar, implementar, passar.

### Task 8: Vista 3D

**Files:** Create `app/js/vista3d.js`.

**Produces:** `criarVista(container) → { mostrar(res, {material, cor}), imagem() → dataURL PNG, destruir() }`. Peça redonda → cilindro; quadrada/retangular/barra → caixa orientada de `a` a `b`; painel de vidro transparente; material metálico conforme `material` (inox sem cor, aço/alumínio com `cor`); chão claro, luz ambiente + direcional, OrbitControls com toque; câmara enquadrada na caixa envolvente; `preserveDrawingBuffer:true` para `imagem()`.

- [ ] Verificação no browser: abrir um trabalho, ver o modelo, rodar; `imagem()` devolve PNG não vazio.

### Task 9: Ecrãs e folhas

**Files:** Create `app/js/app.js`, `app/js/formularios.js`, `app/js/folhas.js`, `app/css/app.css`, `app/css/print.css`; modify `app/index.html`.

**Consumes:** tudo o que foi produzido nas tarefas 1–8.

**Produces:** navegação por `location.hash` (`#/`, `#/obra/<id>`, `#/trabalho/<obra>/<id>`, `#/precos`, `#/definicoes`); ecrãs da spec; `formularios.js`: `CAMPOS[tipo]` (definição declarativa dos campos, incluindo lista de troços) e `desenharFormulario(el, tipo, medidas, onChange)`; `folhas.js`: `folhaPreparacao(obra, trabalho, res, plano, imagem3d, empresa) → HTML`, `folhaProposta(obra, linhas, empresa, precos) → HTML` (uma linha por trabalho: descrição, material/acabamento/cor, preço; totais sem IVA, IVA, total; validade, condições). Impressão: a folha é colocada em `#folha` e chama `window.print()`; `print.css` esconde o resto.
Comportamento: alterar uma medida recalcula e guarda (com `alterado`); trabalho novo copia `precos` atuais; botão «atualizar preços»; preços de exemplo com etiqueta «exemplo»; aviso de cópia de segurança se `diasSemCopia() > 7`; apagar pede confirmação; alvos de toque ≥ 44 px; campos numéricos com `inputmode="numeric"`.

- [ ] Teste: `folhaProposta(...)` não contém «margem», «custo» nem «hora» (teste de texto em `folhas.test.js`).
- [ ] Verificação no browser a 375 px e 768 px: criar obra → guarda → ver desenho, 3D, custo → mudar margem → proposta.

### Task 10: Modo sem rede

**Files:** Create `app/manifest.webmanifest`, `app/sw.js`, `app/img/icon-192.png`/`icon-512.png` (ou SVG `any maskable`); modify `app/index.html`.

**Produces:** service worker cache-first com lista explícita de todos os ficheiros da app e versão de cache `nc-v1`; manifesto com `name: "NC Serralharia"`, `display: standalone`, cores preto/branco.

- [ ] Verificação: recarregar com o servidor parado (ou `fetch` de `./js/app.js` via `caches.match`) devolve a app.
