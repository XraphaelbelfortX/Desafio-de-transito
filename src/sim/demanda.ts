/**
 * Demanda do trecho. TODOS OS VOLUMES SÃO ESTIMATIVAS para a demonstração:
 * substitua pela contagem classificada da SMTT (veículos/hora por movimento) quando houver.
 */

export type DesejoId =
  | 'oeste_reto'
  | 'leste_reto'
  | 'vv_para_oeste'
  | 'vv_para_leste'
  | 'leste_para_vv'
  | 'oeste_para_vv'
  | 'retorno_leste_oeste'
  | 'retorno_oeste_leste'
  | 'norte_para_oeste'
  | 'norte_para_leste'
  | 'oeste_para_norte'
  | 'leste_para_norte';

export interface Desejo {
  id: DesejoId;
  /** Frase com origem e destino, mostrada no painel do agente. */
  descricao: string;
  /** Veículos por hora no pico. */
  volumePico: number;
}

export const DESEJOS: Desejo[] = [
  { id: 'oeste_reto', descricao: 'seguir pela Africanos no sentido oeste', volumePico: 1650 },
  { id: 'leste_reto', descricao: 'seguir pela Africanos no sentido leste', volumePico: 1550 },
  { id: 'vv_para_oeste', descricao: 'sair da Vicente Venâncio e seguir para oeste', volumePico: 180 },
  { id: 'vv_para_leste', descricao: 'sair da Vicente Venâncio e seguir para leste', volumePico: 220 },
  { id: 'leste_para_vv', descricao: 'vir pela pista sul e entrar na Vicente Venâncio', volumePico: 200 },
  { id: 'oeste_para_vv', descricao: 'vir pela pista norte e entrar na Vicente Venâncio', volumePico: 110 },
  { id: 'retorno_leste_oeste', descricao: 'vir no sentido leste e voltar para oeste', volumePico: 70 },
  { id: 'retorno_oeste_leste', descricao: 'vir no sentido oeste e voltar para leste', volumePico: 80 },
  { id: 'norte_para_oeste', descricao: 'sair da rua norte e seguir para oeste', volumePico: 110 },
  { id: 'norte_para_leste', descricao: 'sair da rua norte e seguir para leste', volumePico: 80 },
  { id: 'oeste_para_norte', descricao: 'vir pela pista norte e entrar na rua norte', volumePico: 120 },
  { id: 'leste_para_norte', descricao: 'vir pela pista sul e entrar na rua norte', volumePico: 60 },
];

/** Pedestres por hora no pico, somando os dois sentidos. */
export const PEDESTRES_PICO: Record<string, number> = {
  travessia_vv: 90,
  travessia_norte: 40,
};

/** Fração do volume de pico em cada hora do dia (0h a 23h). */
const PERFIL_VEICULOS = [
  0.08, 0.05, 0.04, 0.04, 0.07, 0.22, 0.58, 1.0, 0.92, 0.72, 0.66, 0.74, 0.88, 0.84, 0.7, 0.7, 0.8, 0.95, 1.0,
  0.82, 0.62, 0.46, 0.3, 0.16,
];

/** Pedestres seguem entrada e saída de escolas e comércio. */
const PERFIL_PEDESTRES = [
  0.02, 0.01, 0.01, 0.01, 0.03, 0.15, 0.6, 1.0, 0.7, 0.5, 0.55, 0.75, 0.95, 0.85, 0.6, 0.6, 0.75, 0.95, 0.9, 0.6,
  0.4, 0.25, 0.12, 0.05,
];

const interpolar = (perfil: number[], hora: number) => {
  const h = ((hora % 24) + 24) % 24;
  const i = Math.floor(h);
  const f = h - i;
  return perfil[i] * (1 - f) + perfil[(i + 1) % 24] * f;
};

export const fatorVeiculos = (hora: number) => interpolar(PERFIL_VEICULOS, hora);
export const fatorPedestres = (hora: number) => interpolar(PERFIL_PEDESTRES, hora);

/** Noite: menos gente na rua e mais gente acelerando e avançando sinal. */
export const ehNoite = (hora: number) => {
  const h = ((hora % 24) + 24) % 24;
  return h >= 22 || h < 5;
};

/** Composição da frota (São Luís tem muita moto). */
export const FROTA = { carro: 0.72, moto: 0.22, onibus: 0.06 };

/**
 * Desvio fora do trecho modelado para quem não tem rota legal dentro dele (m).
 * Também é estimativa: medir no mapa o retorno legal mais próximo de cada lado.
 */
export const DESVIO_EXTERNO_CONVERSAO = 1600;
export const DESVIO_EXTERNO_RETORNO = 1200;
