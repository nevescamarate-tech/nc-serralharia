import { calcGuarda, DEF_GUARDA } from './modelos/guarda.js';
import { calcCorrimao, DEF_CORRIMAO } from './modelos/corrimao.js';
import { calcPortao, DEF_PORTAO } from './modelos/portao.js';
import { calcTubagem, DEF_TUBAGEM } from './modelos/tubagem.js';
import { calcTelheiro, DEF_TELHEIRO } from './modelos/telheiro.js';
import { calcGrade, DEF_GRADE } from './modelos/grade.js';
import { calcEscada, DEF_ESCADA } from './modelos/escada.js';
import { calcGradeamento, DEF_GRADEAMENTO } from './modelos/gradeamento.js';
import { calcAbrigo, DEF_ABRIGO } from './modelos/abrigo.js';
import { calcGuardaMuro, DEF_GUARDAMURO } from './modelos/guardamuro.js';
import { calcLivre, DEF_LIVRE } from './modelos/livre.js';
import { calcFlangeada, DEF_FLANGEADA } from './modelos/flangeada.js';
import { vazio } from './modelos/util.js';

export const TIPOS = {
  guarda: { nome: 'Guarda', calc: calcGuarda, def: DEF_GUARDA },
  guardamuro: { nome: 'Guarda de barras em muro', calc: calcGuardaMuro, def: DEF_GUARDAMURO },
  corrimao: { nome: 'Corrimão', calc: calcCorrimao, def: DEF_CORRIMAO },
  portao: { nome: 'Portão', calc: calcPortao, def: DEF_PORTAO },
  tubagem: { nome: 'Tubagem soldada', calc: calcTubagem, def: DEF_TUBAGEM },
  flangeada: { nome: 'Tubagem flangeada (troço a troço)', calc: calcFlangeada, def: DEF_FLANGEADA, semClaude: true },
  telheiro: { nome: 'Telheiro / pérgula', calc: calcTelheiro, def: DEF_TELHEIRO },
  grade: { nome: 'Grade de janela', calc: calcGrade, def: DEF_GRADE },
  gradeamento: { nome: 'Gradeamento de muro', calc: calcGradeamento, def: DEF_GRADEAMENTO },
  escada: { nome: 'Escada reta', calc: calcEscada, def: DEF_ESCADA },
  livre: { nome: 'Trabalho livre (lista de peças)', calc: calcLivre, def: DEF_LIVRE },
  abrigo: { nome: 'Abrigo em quadro', calc: calcAbrigo, def: DEF_ABRIGO, oculto: true },   // fora da lista de tipos novos, a pedido
};

/** Calcula as peças de um trabalho. Nunca lança erro: devolve avisos. */
export function calcular(trabalho) {
  const t = TIPOS[trabalho && trabalho.tipo];
  if (!t) return vazio(['Tipo de trabalho desconhecido.']);
  try { return t.calc(trabalho.medidas || {}); }
  catch (e) { return vazio(['Não foi possível calcular com estas medidas.']); }
}
