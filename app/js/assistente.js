// Ecrã «Pedir solução ao Claude»: fotografia e/ou descrição → proposta de trabalho com alternativas.
import * as store from './store.js';
import { TIPOS } from './calc.js';
import { CAMPOS } from './formularios.js';
import { esc } from './fmt.js';
import { reduzirFoto } from './fotos.js';
import { pedirSolucao } from './claude.js';

const $ = (s, el = document) => el.querySelector(s);
const rotulo = (tipo, campo) => campo === 'trocos' ? 'Comprimento' : ((CAMPOS[tipo] || []).find(c => c.id === campo) || {}).rotulo || campo;
function valor(tipo, campo, v) {
  if (campo === 'trocos') return `${Math.round(v[0].comp)} mm`;
  const c = (CAMPOS[tipo] || []).find(x => x.id === campo) || {};
  if (c.tipo === 'sel') return c.opcoes[v] || v;
  if (c.tipo === 'bool') return v ? 'sim' : 'não';
  return `${v}${c.un === undefined ? ' mm' : c.un ? ' ' + c.un : ''}`;
}
function cartao(s, i, principal) {
  const linhas = Object.entries(s.medidas).map(([k, v]) => `<tr><td>${esc(rotulo(s.tipo, k))}</td><td class="n">${esc(valor(s.tipo, k, v))}</td></tr>`).join('');
  return `<section class="bloco proposta"><p><strong>${principal ? 'Solução proposta' : 'Alternativa'}: ${esc(s.nome)}</strong><br><span class="dica">${esc(TIPOS[s.tipo].nome)}</span></p>
<p>${esc(s.razao)}</p>${linhas ? `<table class="tab">${linhas}</table>` : '<p class="dica">Sem medidas: introduza-as no trabalho.</p>'}
<button class="${principal ? 'b-pri' : 'b-sec'}" data-criar="${i}">Criar este trabalho</button></section>`;
}

export async function ecraClaude(obraId, { ecra, topo, aviso, ir, novoTrabalho }) {
  const obra = await store.lerObra(obraId);
  if (!obra) return ir('#/');
  const chave = await store.kv.ler('claudeChave');
  let foto = '';
  ecra.innerHTML = `${topo('Pedir solução ao Claude', `#/obra/${obra.id}`)}
${chave ? '' : '<p class="faixa">Ainda não há chave do Claude neste aparelho. <a href="#/definicoes">Introduzir em Definições</a></p>'}
<section class="bloco proposta"><p>Tire ou escolha uma fotografia do local e diga o que pretende. As medidas que souber, escreva-as: o Claude não mede pela fotografia.</p>
<label class="b-sec ficheiro">Fotografia do local<input type="file" id="c-foto" accept="image/*" capture="environment"></label>
<div id="c-mini"></div>
<label class="campo"><span>O que pretende e medidas que já tem</span><textarea id="c-texto" rows="4" placeholder="ex.: guarda para esta varanda, 3,20 m de comprimento, cliente quer vidro"></textarea></label>
<button class="b-pri" id="c-pedir" ${chave ? '' : 'disabled'}>Pedir solução</button>
<p class="dica">A fotografia e o texto são enviados para a Anthropic (Claude) e cada pedido é cobrado na sua conta. As obras guardadas não são enviadas.</p></section>
<div id="c-resposta"></div>`;
  $('#c-foto').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    foto = f ? (await reduzirFoto(f, 1568)) || '' : '';
    $('#c-mini').innerHTML = foto ? `<img src="${foto}" alt="Fotografia escolhida" class="c-mini">` : (f ? '<p class="alerta">Não foi possível ler esta fotografia.</p>' : '');
  };
  $('#c-pedir').onclick = async () => {
    const texto = $('#c-texto').value.trim(), botao = $('#c-pedir'), caixa = $('#c-resposta');
    if (!foto && !texto) return aviso('Junte uma fotografia ou escreva o que pretende.');
    botao.disabled = true; botao.textContent = 'O Claude está a analisar…'; caixa.innerHTML = '';
    let r;
    try { r = await pedirSolucao(chave, { texto, imagem: foto }); } catch (e) { r = { erro: 'Não foi possível falar com o Claude.' }; }
    if (!$('#c-resposta')) return;                              // o utilizador saiu do ecrã entretanto
    botao.disabled = false; botao.textContent = 'Pedir outra vez';
    if (!r.ok) { caixa.innerHTML = `<p class="alerta">${esc(r.erro)}</p>${r.observacoes ? `<p>${esc(r.observacoes)}</p>` : ''}`; return; }
    const todas = [r.solucao, ...r.alternativas];
    caixa.innerHTML = `<h2>Proposta do Claude</h2>${todas.map((s, i) => cartao(s, i, i === 0)).join('')}
${r.aConfirmar.length ? `<h3>A confirmar no local</h3><section class="bloco"><ul class="lista-s">${r.aConfirmar.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
${r.observacoes ? `<h3>Observações</h3><section class="bloco"><p>${esc(r.observacoes)}</p></section>` : ''}
<p class="dica">É uma proposta: confirme as medidas no local antes de mandar fabricar.</p>`;
    caixa.onclick = async ev => {
      const b = ev.target.closest('[data-criar]'); if (!b) return;
      const s = todas[+b.dataset.criar]; b.disabled = true;
      const notas = [texto, r.observacoes].filter(Boolean).join('\n');
      const t = await novoTrabalho(obra, s.tipo, { nome: s.nome, notas, confirmar: r.aConfirmar.join('\n'), medidas: s.medidas });
      if (foto) {
        const id = store.novoId();
        try { await store.guardarAnexo('foto:' + id, foto); t.fotos = [{ id, legenda: 'Fotografia enviada ao Claude' }]; await store.guardarObra(obra); } catch (e) { /* sem espaço: o trabalho fica sem a foto */ }
      }
      ir(`#/trabalho/${obra.id}/${t.id}`);
    };
  };
}
