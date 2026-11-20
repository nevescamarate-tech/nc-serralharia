// Pormenor 3D com three.js. Lê a mesma lista de peças que o desenho e o custo.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { MATERIAIS, acabamentoDe } from './catalogo.js';

const MM = 0.001;
const CIMA = new THREE.Vector3(0, 1, 0);

function materialMetal(material, acabamento, cor) {
  const mat = MATERIAIS[material] || MATERIAIS.aco, ac = acabamentoDe(material, acabamento);
  const hex = ac.comCor ? (cor || '#383e42') : (ac.corFixa || mat.corBase);
  const brilhante = mat.familia === 'inox' || ac.id === 'galvanizado' || ac.id === 'anodizado';
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), metalness: brilhante ? 0.55 : 0.25,
    roughness: ac.id === 'polido' ? 0.18 : brilhante ? 0.38 : 0.55 });
}

function malhaPeca(p, mat) {
  const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b);
  const dir = b.clone().sub(a), L = dir.length();
  if (!(L > 0)) return null;
  dir.normalize();
  const geo = p.redondo ? new THREE.CylinderGeometry(p.t / 2, p.t / 2, L, 20) : new THREE.BoxGeometry(p.t, L, p.p);
  const m = new THREE.Mesh(geo, mat);
  // Eixo local Y ao longo da peça; X local (espessura vista no alçado) no plano vertical.
  let z = new THREE.Vector3().crossVectors(dir, CIMA);
  if (z.lengthSq() < 1e-6) z.set(0, 0, 1); else z.normalize();
  const x = new THREE.Vector3().crossVectors(dir, z).normalize();
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir, z));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  return m;
}

/** Par de flanges de uma ligação, com o furo do tubo e os furos dos parafusos no círculo de furação. */
function flangeFurada(pt, mat) {
  const forma = new THREE.Shape(); forma.absarc(0, 0, pt.D / 2, 0, Math.PI * 2, false);
  const furo = (x, y, raio) => { const h = new THREE.Path(); h.absarc(x, y, raio, 0, Math.PI * 2, true); forma.holes.push(h); };
  furo(0, 0, pt.bore / 2);
  for (let i = 0; i < pt.furos.n; i++) { const a = (i + 0.5) * 2 * Math.PI / pt.furos.n; furo(Math.sin(a) * pt.furos.K / 2, Math.cos(a) * pt.furos.K / 2, pt.furos.h / 2); }
  const esp = Math.max(12, pt.esp * 0.6), geo = new THREE.ExtrudeGeometry(forma, { depth: esp, bevelEnabled: false, curveSegments: 16 });
  const g = new THREE.Group();
  for (const z of [-esp - 1.5, 1.5]) { const m = new THREE.Mesh(geo, mat); m.position.z = z; m.userData.lig = pt.lig; g.add(m); }
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...pt.dir).normalize()); g.position.set(...pt.p);
  return g;
}

export function criarVista(container) {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#f4f4f2');
  const camara = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.append(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';

  cena.add(new THREE.HemisphereLight(0xffffff, 0xb9b9b0, 1.5));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(3, 6, 5); cena.add(sol);
  const contra = new THREE.DirectionalLight(0xffffff, 0.9); contra.position.set(-4, 3, -5); cena.add(contra);

  const chao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#e6e5e0', roughness: 1 }));
  chao.rotation.x = -Math.PI / 2; cena.add(chao);
  const grupo = new THREE.Group(); grupo.scale.setScalar(MM); cena.add(grupo);

  const controlos = new OrbitControls(camara, renderer.domElement);
  controlos.enableDamping = false; controlos.maxPolarAngle = Math.PI / 2 - 0.02;
  container.style.position = 'relative';
  const camadaEtq = document.createElement('div'); camadaEtq.className = 'tres-etq'; container.append(camadaEtq);
  let etqs = [], ver = { tro: true, lig: true }, aoClicar = null, destaque = null;
  const fantasma = new THREE.MeshStandardMaterial({ color: '#9aa3ab', transparent: true, opacity: 0.18, depthWrite: false });
  const v3 = new THREE.Vector3();
  function poeEtiquetas() {
    const w = container.clientWidth, h = container.clientHeight;
    for (const e of etqs) {
      v3.set(e.p[0] * MM, e.p[1] * MM, e.p[2] * MM).project(camara);
      const visivel = v3.z < 1 && ver[e.tro ? 'tro' : 'lig'] && (!destaque || e.tro === destaque || (e.lig && destaqueLigs.includes(e.lig)));
      e.el.style.display = visivel ? '' : 'none';
      if (visivel) { e.el.style.left = ((v3.x + 1) / 2 * w).toFixed(1) + 'px'; e.el.style.top = ((1 - v3.y) / 2 * h).toFixed(1) + 'px'; }
    }
  }
  let destaqueLigs = [], ligsDe = {};
  const desenha = () => { renderer.render(cena, camara); poeEtiquetas(); };
  controlos.addEventListener('change', desenha);

  function tamanho() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return false;
    renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
    return true;
  }
  const obs = new ResizeObserver(() => { if (tamanho()) desenha(); });
  obs.observe(container);

  function limpa() {
    for (const o of [...grupo.children]) { grupo.remove(o); o.traverse(x => x.geometry && x.geometry.dispose()); }
  }
  function enquadra() {
    const caixa = new THREE.Box3().setFromObject(grupo);
    if (caixa.isEmpty()) { camara.position.set(2, 1.5, 3); controlos.target.set(0, 0.5, 0); return; }
    const c = caixa.getCenter(new THREE.Vector3()), t = caixa.getSize(new THREE.Vector3());
    const raio = Math.max(t.length() / 2, 0.3);
    const dist = raio / Math.sin(camara.fov * Math.PI / 360) * (camara.aspect < 1 ? 1 / camara.aspect : 1) * 0.95;
    camara.position.copy(c).add(new THREE.Vector3(-0.55, 0.42, 1).normalize().multiplyScalar(dist));
    controlos.target.copy(c); controlos.update();
    const lado = Math.max(t.x, t.z) * 3 + 4;
    chao.scale.set(lado, lado, 1); chao.position.set(c.x, Math.min(0, caixa.min.y < -0.3 ? 0 : caixa.min.y), c.z);
  }

  // clicar numa peça (sem arrastar) abre a ficha do seu troço
  let baixo = null; const raioLuz = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', e => { baixo = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!baixo || !aoClicar || Math.hypot(e.clientX - baixo[0], e.clientY - baixo[1]) > 5) return;
    const q = renderer.domElement.getBoundingClientRect();
    raioLuz.setFromCamera(new THREE.Vector2((e.clientX - q.left) / q.width * 2 - 1, -((e.clientY - q.top) / q.height) * 2 + 1), camara);
    const h = raioLuz.intersectObjects(grupo.children, true).find(x => x.object.userData.tro);
    if (h) aoClicar(h.object.userData.tro);
  });
  let primeira = true;
  return {
    mostrar(res, { material, acabamento, cor } = {}) {
      limpa();
      camadaEtq.innerHTML = ''; destaque = null; destaqueLigs = [];
      etqs = (res.etiquetas3d || []).map(e => {
        const el = document.createElement('span'); el.className = e.cls; el.textContent = e.txt;
        if (e.tro) el.onclick = () => aoClicar && aoClicar(e.tro);
        camadaEtq.append(el); return { ...e, el };
      });
      ligsDe = Object.fromEntries(((res.flangeada || {}).trocos || []).map(t => [t.id, t.ends.filter(x => typeof x === 'number')]));
      const metal = materialMetal(material, acabamento, cor);
      const vidro = new THREE.MeshStandardMaterial({ color: '#a9d8e8', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide });
      const escuro = new THREE.MeshStandardMaterial({ color: '#6b6f73', metalness: 0.5, roughness: 0.5 });
      for (const p of res.pecas) { const m = malhaPeca(p, metal); if (m) { m.userData.tro = p.tro; grupo.add(m); } }
      const cobertura = new THREE.MeshStandardMaterial({ color: '#d5d8da', metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide });
      for (const p of res.paineis) {
        if (p.v) {   // painel de cobertura: assenta no plano definido por u (largura) e v (pendente)
          const u = new THREE.Vector3(...p.u), w = new THREE.Vector3(...p.v), n = new THREE.Vector3().crossVectors(w, u).normalize();
          const c = new THREE.Mesh(new THREE.BoxGeometry(p.w - 4, Math.max(p.esp, 12), p.h), cobertura);
          c.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, n, w));
          c.position.set(...p.o).addScaledVector(u, p.w / 2).addScaledVector(w, p.h / 2).addScaledVector(n, Math.max(p.esp, 12) / 2);
          grupo.add(c); continue;
        }
        if (p.sem3d) continue;
        const pw = p.vis ? p.vis[0] : p.w, ph = p.vis ? p.vis[1] : p.h;   // face à vista, não a chapa planificada
        const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, p.e3 || p.esp), p.grupo === 'vidro' ? vidro : metal);
        m.position.set(p.o[0] + p.u[0] * pw / 2, p.o[1] + ph / 2 + (p.dy || 0) / 2, p.o[2] + p.u[2] * pw / 2);
        m.rotation.order = 'YXZ';
        m.rotation.y = -Math.atan2(p.u[2], p.u[0]);
        if (p.dy) {   // troço inclinado: os lados do painel ficam a prumo (paralelogramo), não rodados
          const pos = m.geometry.attributes.position;
          for (let k = 0; k < pos.count; k++) pos.setY(k, pos.getY(k) + pos.getX(k) * p.dy / p.w);
          pos.needsUpdate = true; m.geometry.computeVertexNormals();
        }
        grupo.add(m);
      }
      const comArcos = (res.arcos3d || []).length > 0, flangeMat = new THREE.MeshStandardMaterial({ color: '#aeb6bd', metalness: 0.5, roughness: 0.4 });
      for (const c of res.arcos3d || []) {       // curvas de tubagem com o raio verdadeiro
        const eixo = new THREE.CatmullRomCurve3(c.pts.map(p => new THREE.Vector3(...p)), false, 'centripetal');
        const tubo = new THREE.Mesh(new THREE.TubeGeometry(eixo, 24, c.r, 20, false), metal); tubo.userData.tro = c.tro; grupo.add(tubo);
      }
      for (const k of res.blocos3d || []) {      // equipamentos e reduções da tubagem flangeada
        const A = new THREE.Vector3(...k.a), B = new THREE.Vector3(...k.b), L = A.distanceTo(B) || 1;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(k.r2 || k.r, k.r, L, 28), k.tipo === 'reducao' ? metal : new THREE.MeshStandardMaterial({ color: k.tipo === 'junta_desm' ? 0x5a6066 : k.tipo === 'medidor' ? 0x39433a : 0x1f5fae, metalness: 0.2, roughness: 0.5 }));
        m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(CIMA, B.clone().sub(A).normalize()); m.userData.tro = k.tro;
        grupo.add(m);
      }
      for (const pt of res.pontos || []) {
        let m;
        if (pt.tipo === 'abracadeira' || (comArcos && pt.tipo === 'curva')) continue;
        if (pt.tipo === 'flange' && pt.furos) { grupo.add(flangeFurada(pt, flangeMat)); continue; }
        if (pt.tipo === 'curva') { m = new THREE.Mesh(new THREE.SphereGeometry(pt.r * 1.02, 20, 14), metal); m.position.set(...pt.p); }
        else if (pt.tipo === 'flange' || pt.tipo === 'tampao') {
          m = new THREE.Mesh(new THREE.CylinderGeometry(pt.tipo === 'flange' ? pt.r * 0.95 : pt.r * 0.52, pt.tipo === 'flange' ? pt.r * 0.95 : pt.r * 0.52, pt.tipo === 'flange' ? 18 : 30, 28), metal);
          m.quaternion.setFromUnitVectors(CIMA, new THREE.Vector3(...pt.dir)); m.position.set(...pt.p);
        } else if (pt.tipo === 'sapata') { m = new THREE.Mesh(new THREE.BoxGeometry(pt.lado || 110, 8, pt.lado || 110), metal); m.position.set(pt.p[0], pt.p[1] + 4, pt.p[2]); }
        else if (pt.tipo === 'fix_lateral') { m = new THREE.Mesh(new THREE.BoxGeometry(90, 130, 8), metal); m.position.set(pt.p[0], pt.p[1] - 60, pt.p[2]); }
        else { m = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 70, 12), metal); m.rotation.x = Math.PI / 2; m.position.set(pt.p[0], pt.p[1] - 8, pt.p[2] - 35); }
        grupo.add(m);
      }
      let carril = null;
      if (res.carril) {
        const L = res.carril.x2 - res.carril.x1;
        carril = new THREE.Mesh(new THREE.BoxGeometry(L, 12, 40), escuro); carril.position.set(res.carril.x1 + L / 2, 6, 0);
      }
      tamanho();
      if (primeira || !this._manter) enquadra();
      if (carril) grupo.add(carril);   // fora do enquadramento, para o portão não ficar pequeno
      primeira = false;
      desenha();
    },
    enquadrar() { tamanho(); enquadra(); desenha(); },
    /** Realça um troço (os outros ficam esbatidos); sem id, volta a mostrar tudo. */
    destacar(id) {
      destaque = id || null; destaqueLigs = id ? (ligsDe[id] || []) : [];
      grupo.traverse(o => { if (!o.isMesh) return; if (!o.userData.mat) o.userData.mat = o.material; o.material = destaque && o.userData.tro !== destaque && !(o.userData.lig && destaqueLigs.includes(o.userData.lig)) ? fantasma : o.userData.mat; });
      desenha();
    },
    /** Vistas prontas: 'iso', 'planta', 'frente', 'lado'. */
    vistaDe(k) {
      tamanho();
      const caixa = new THREE.Box3().setFromObject(grupo); if (caixa.isEmpty()) return;
      const c = caixa.getCenter(new THREE.Vector3()), raio = Math.max(caixa.getSize(new THREE.Vector3()).length() / 2, 0.3);
      const dist = raio / Math.sin(camara.fov * Math.PI / 360) * (camara.aspect < 1 ? 1 / camara.aspect : 1) * 0.95;
      const dir = { iso: [-0.55, 0.42, 1], planta: [0, 1, 0.001], frente: [0, 0.05, 1], lado: [1, 0.05, 0] }[k] || [-0.55, 0.42, 1];
      camara.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist)); controlos.target.copy(c); controlos.update(); desenha();
    },
    /** Liga ou desliga as etiquetas: { tro: bool, lig: bool }. */
    camadas(o) { ver = { ...ver, ...o }; desenha(); },
    set aoClicar(fn) { aoClicar = fn; },
    imagem() { tamanho(); desenha(); try { return renderer.domElement.toDataURL('image/png'); } catch (e) { return ''; } },
    destruir() {
      obs.disconnect(); limpa(); controlos.dispose(); renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* já perdido */ }
      renderer.domElement.remove();
    },
    set manterCamara(v) { this._manter = v; },
  };
}

/** Imagem PNG do 3D de um resultado, sem precisar de ecrã visível. */
export function imagem3d(res, opcoes, largura = 900, altura = 560) {
  if (!res.pecas.length && !res.paineis.length) return '';
  const caixa = document.createElement('div');
  caixa.style.cssText = `position:fixed;left:-10000px;top:0;width:${largura}px;height:${altura}px`;
  document.body.append(caixa);
  try {
    const v = criarVista(caixa); v.mostrar(res, opcoes);
    const img = v.imagem(); v.destruir(); return img;
  } catch (e) { return ''; }
  finally { caixa.remove(); }
}
