import type { Categoria, TipoIntervencao } from '../../sim/intervencoes';
import { PALETA } from './paleta';

/** A mancha é sempre azul. O glifo é que diz o tipo. */
export const COR_ZONA: Record<TipoIntervencao, string> = {
  camera: PALETA.intervencao,
  agente: PALETA.intervencao,
  semaforo: PALETA.intervencao,
  fechar_canteiro: PALETA.intervencao,
  retorno: PALETA.intervencao,
  tachoes: PALETA.intervencao,
  faixa_elevada: PALETA.intervencao,
  refugio: PALETA.intervencao,
  lombada: PALETA.intervencao,
};

/** Texto legível sobre a mancha azul. */
export const tintaSobre = (_tipo: TipoIntervencao) => '#ffffff';

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
  { categoria: 'fiscalizacao', titulo: 'Fiscalização · age num raio' },
  { categoria: 'controle', titulo: 'Controle · age no cruzamento' },
  { categoria: 'geometria', titulo: 'Mudar a via · age na abertura ou na faixa' },
  { categoria: 'moderacao', titulo: 'Reduzir velocidade · age na pista' },
];
