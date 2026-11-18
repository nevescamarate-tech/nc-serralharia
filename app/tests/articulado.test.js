import { test, eq, ok } from './t.js';
import { lerCSV, lerXLSX, extrairLinhas, classificar, medidasDeLinha } from '../js/articulado.js';

test('lê CSV com ponto e vírgula, aspas e vírgula decimal', () => {
  const r = lerCSV('Art;Designação;Un;Quant\n1.1;"Guarda; em aço";m;12,5\n');
  eq(r.length, 2); eq(r[1], ['1.1', 'Guarda; em aço', 'm', '12,5']);
});
test('lê CSV separado por vírgulas ou por tabulações', () => {
  eq(lerCSV('a,b\n1,2')[1], ['1', '2']); eq(lerCSV('a\tb\r\n1\t2')[1], ['1', '2']);
});
test('encontra o cabeçalho e extrai artigo, descrição, unidade e quantidade', () => {
  const l = extrairLinhas([['Mapa de quantidades'], [], ['Art.', 'Designação dos trabalhos', 'Un.', 'Quant.'],
    ['5.1', 'Guarda metálica', 'm', '12,5'], ['5', 'SERRALHARIAS', '', ''], ['2.1', 'Betão C25/30', 'm3', 40]]);
  eq(l.length, 3);
  eq(l[0], { art: '5.1', desc: 'Guarda metálica', un: 'm', qtd: 12.5 });
  eq(l[1].qtd, null); eq(l[2].qtd, 40);
});
test('sem cabeçalho reconhecível: usa a coluna de texto mais comprido como descrição', () => {
  const l = extrairLinhas([['1', 'Portão de correr em ferro', 'un', '2'], ['2', 'Corrimão em inox', 'm', '8']]);
  eq(l.length, 2); eq(l[0].desc, 'Portão de correr em ferro'); eq(l[0].qtd, 2); eq(l[1].un, 'm');
});
test('folha vazia ou só com lixo: lista vazia, sem erro', () => {
  eq(extrairLinhas([]), []); eq(extrairLinhas([[], [null, undefined]]), []); eq(extrairLinhas(null), []);
});
test('classifica as linhas de serralharia', () => {
  eq(classificar('Fornecimento e montagem de guarda metálica em aço'), 'guarda');
  eq(classificar('GUARDA-CORPOS em vidro'), 'guarda');
  eq(classificar('Corrimão em tubo de inox Ø42'), 'corrimao');
  eq(classificar('Portão de correr motorizado'), 'portao');
  eq(classificar('Gradeamento em ferro forjado'), 'outro');
  eq(classificar('Tubagem em aço inox AISI 316 DN50'), 'outro');
  eq(classificar('Betão C25/30 em fundações'), null);
  eq(classificar('Guarda-vento em alvenaria'), null);
  eq(classificar(''), null); eq(classificar(null), null);
});
test('linha em metros vira comprimento da guarda ou do corrimão em mm', () => {
  eq(medidasDeLinha({ un: 'm', qtd: 12.5 }, 'guarda').trocos[0].comp, 12500);
  eq(medidasDeLinha({ un: 'ML', qtd: 8 }, 'corrimao').comp, 8000);
  eq(medidasDeLinha({ un: 'un', qtd: 2 }, 'guarda'), {});
  eq(medidasDeLinha({ un: 'm', qtd: null }, 'guarda'), {});
  eq(medidasDeLinha({ un: 'm', qtd: 3 }, 'portao'), {});
});
test('lê um ficheiro Excel verdadeiro (.xlsx)', async () => {
  const buf = await (await fetch('./fixtures/articulado.xlsx')).arrayBuffer();
  const r = await lerXLSX(buf);
  eq(r.erro, undefined); eq(r.folhas.length, 1); eq(r.folhas[0].nome, 'MQT');
  const l = extrairLinhas(r.folhas[0].linhas);
  eq(l.length, 3);
  eq(l[0], { art: '5.1', desc: 'Guarda metálica em aço pintado, h=1,10 m', un: 'm', qtd: 12.5 });
  eq(l[1].desc, 'Portão de correr');
});
test('ficheiro que não é Excel: devolve erro, sem exceção', async () => {
  ok((await lerXLSX(new TextEncoder().encode('isto não é um zip').buffer)).erro);
  ok((await lerXLSX(new ArrayBuffer(0))).erro);
});
