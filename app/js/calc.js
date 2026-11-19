import { calcGuarda, DEF_GUARDA } from './modelos/guarda.js';
import { calcCorrimao, DEF_CORRIMAO } from './modelos/corrimao.js';
import { calcPortao, DEF_PORTAO } from './modelos/portao.js';
import { calcTubagem, DEF_TUBAGEM } from './modelos/tubagem.js';
import { calcTelheiro, DEF_TELHEIRO } from './modelos/telheiro.js';
import { calcGrade, DEF_GRADE } from './modelos/grade.js';
import { calcEscada, DEF_ESCADA } from './modelos/escada.js';
import { vazio } from './modelos/util.js';

export const TIPOS = {
  guarda: { nome: 'Guarda', calc: calcGuarda, def: DEF_GUARDA },
  corrimao: { nome: 'Corrimão', calc: calcCorrimao, def: DEF_CORRIMAO },
  portao: { nome: 'Portão', calc: calcPortao, def: DEF_PORTAO },
  tubagem: { nome: 'Tubagem', calc: calcTubagem, def: DEF_TUBAGEM },
  telheiro: { nome: 'Telheiro / pérgula', calc: calcTelheiro, def: DEF_TELHEIRO },
  grade: { nome: 'Grade de janela', calc: calcGrade, def: DEF_GRADE },
  escada: { nome: 'Escada reta', calc: calcEscada, def: DEF_ESCADA },
};

/** Calcula as peças de um trabalho. Nunca lança erro: devolve avisos. */
export function calcular(trabalho) {
  const t = TIPOS[trabalho && trabalho.tipo];
  if (!t) return vazio(['Tipo de trabalho desconhecido.']);
  try { return t.calc(trabalho.medidas || {}); }
  catch (e) { return vazio(['Não foi possível calcular com estas medidas.']); }
}
