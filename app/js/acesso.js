// PIN de acesso à app, fixos. Aqui ficam só os resumos (PBKDF2-SHA256); os PIN não estão no código.
// Para trocar os PIN é preciso gerar resumos novos e publicar a app outra vez.
export const SAL = 'c9757ed6cc22b39cf25c5b9fb79ebdc8';
export const VOLTAS = 600000;
export const ACESSOS = [
  { nome: 'PIN 1', h: '33d9db06cd9c66b9f5343a06fa31427b1197955dd7d312cb70568e9b71c08fbe' },
  { nome: 'PIN 2', h: '864758ebc6b7577c25881987604f8bc3f222944fd2fe62b4339476040d5f8413' },
  { nome: 'Brian', h: 'ed943d4a549f50b8d08b00b86f65212ba9016891fed563d040b76037bded2c52' },
  { nome: 'Duarte', h: '0162d76e7b2b9257bf0a3c568775c0a75e5a375289107e1a40d1ddec4b0ebbd5' },
  { nome: 'Tiago', h: '2a8b308a0d2f887331967274d048ae08685f213f967817e14c4dc1ed34833117' },
];