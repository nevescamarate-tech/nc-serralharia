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
  const desenha = () => renderer.render(cena, camara);
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
    for (const o of [...grupo.children]) { grupo.remove(o); o.geometry && o.geometry.dispose(); }
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

  let primeira = true;
  return {
    mostrar(res, { material, acabamento, cor } = {}) {
      limpa();
      const metal = materialMetal(material, acabamento, cor);
      const vidro = new THREE.MeshStandardMaterial({ color: '#a9d8e8', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide });
      const escuro = new THREE.MeshStandardMaterial({ color: '#6b6f73', metalness: 0.5, roughness: 0.5 });
      for (const p of res.pecas) { const m = malhaPeca(p, metal); if (m) grupo.add(m); }
      for (const p of res.paineis) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.esp), p.grupo === 'vidro' ? vidro : metal);
        m.position.set(p.o[0] + p.u[0] * p.w / 2, p.o[1] + p.h / 2 + (p.dy || 0) / 2, p.o[2] + p.u[2] * p.w / 2);
        m.rotation.order = 'YXZ';
        m.rotation.y = -Math.atan2(p.u[2], p.u[0]);
        if (p.dy) m.rotation.z = Math.atan2(p.dy, p.w);
        grupo.add(m);
      }
      for (const pt of res.pontos || []) {
        let m;
        if (pt.tipo === 'sapata') { m = new THREE.Mesh(new THREE.BoxGeometry(110, 8, 110), metal); m.position.set(pt.p[0], pt.p[1] + 4, pt.p[2]); }
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
