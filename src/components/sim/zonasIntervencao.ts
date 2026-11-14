import type { Categoria, TipoIntervencao } from '../../sim/intervencoes';

/** Cor da mancha no mapa. A mesma cor pinta o número na lista. */
export const COR_ZONA: Record<TipoIntervencao, string> = {
  camera: '#2563eb',
  agente: '#4f46e5',
  semaforo: '#f59e0b',
  fechar_canteiro: '#22c55e',
  retorno: '#2dd4bf',
  tachoes: '#eab308',
  faixa_elevada: '#f8fafc',
  refugio: '#cbd5e1',
  lombada: '#facc15',
};

const CLARAS = new Set<TipoIntervencao>([
  'semaforo',
  'fechar_canteiro',
  'retorno',
  'tachoes',
  'faixa_elevada',
  'refugio',
  'lombada',
]);

/** Texto legível sobre a cor da zona. */
export const tintaSobre = (tipo: TipoIntervencao) => (CLARAS.has(tipo) ? '#0f172a' : '#ffffff');

export const ROTULO_CURTO: Record<TipoIntervencao, string> = {
  camera: 'Câmera',
  semaforo: 'Semáforo',
  fechar_canteiro: 'Fecha canteiro',
  retorno: 'Retorno',
  tachoes: 'Tachões',
  faixa_elevada: 'Faixa elevada',
  refugio: 'Refúgio',
  lombada: 'Lombada',
  agente: 'Agente',
};

/** Onde a mancha colorida aparece, em uma frase curta. */
export const ALCANCE: Record<TipoIntervencao, string> = {
  camera: 'Círculo de 60 m em volta do ícone',
  agente: 'Círculo de 45 m, das 6h às 20h',
  semaforo: 'O cruzamento mais próximo, não o ícone',
  fechar_canteiro: 'A abertura do canteiro em que encaixa',
  retorno: 'O trecho do canteiro em que encaixa',
  tachoes: 'A linha amarela na via',
  faixa_elevada: 'A faixa de pedestres inteira',
  refugio: 'O canteiro, no meio da travessia',
  lombada: 'A pista em que foi solta',
};

export const GRUPOS: { categoria: Categoria; titulo: string }[] = [
  { categoria: 'fiscalizacao', titulo: 'Age num raio' },
  { categoria: 'controle', titulo: 'Age no cruzamento' },
  { categoria: 'geometria', titulo: 'Age na abertura ou na faixa' },
  { categoria: 'moderacao', titulo: 'Age na pista' },
];
