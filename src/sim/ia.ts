/**
 * IA dos motoristas e pedestres (versão baseada em regras + probabilidade).
 *
 * Cada agente tem um perfil (pressa, obediência, aversão a risco). Diante de uma chance de
 * infringir, ele pesa: ganho de tempo x chance de ser pego x risco físico x pressão social
 * (efeito manada). A decisão é sorteada com a semente da simulação, então o mesmo cenário
 * com a mesma semente dá sempre o mesmo resultado.
 *
 * "Desistiu" = teria infringido se não houvesse fiscalização no local (câmera, radar, agente)
 * ou se a geometria permitisse; a tela destaca esses agentes.
 */
import type { Decisao, Perfil, TipoAgente, TipoInfracao } from './tipos';
import { NOMES_INFRACAO } from './tipos';
import type { Rng } from './geo';

/** Peso base de cada infração (quanto ela "custa" moralmente sem fiscalização). */
const BASE: Record<TipoInfracao, number> = {
  caixa_amarela: 0.6,
  conversao_proibida: -0.6,
  retorno_proibido: -0.4,
  avanco_sinal: -1.0,
  excesso_velocidade: 0.3,
  moto_corredor: 1.2,
  parada_irregular: 0.4,
  pedestre_fora_faixa: 0.8,
};

/** Multa/consequência percebida ao ser pego (escala relativa). */
const PUNICAO: Record<TipoInfracao, number> = {
  caixa_amarela: 3.5,
  conversao_proibida: 4,
  retorno_proibido: 4,
  avanco_sinal: 5,
  excesso_velocidade: 4,
  moto_corredor: 2.5,
  parada_irregular: 3,
  pedestre_fora_faixa: 1.5,
};

export function sortearPerfil(rng: Rng, tipo: TipoAgente, pico: boolean): Perfil {
  const pressaMedia = (pico ? 0.6 : 0.42) + (tipo === 'app' ? 0.12 : tipo === 'moto' ? 0.1 : tipo === 'onibus' ? 0.05 : 0);
  return {
    pressa: rng.perfil(pressaMedia, 0.2),
    obediencia: rng.perfil(tipo === 'onibus' ? 0.6 : 0.5, 0.2),
    aversaoRisco: rng.perfil(tipo === 'moto' ? 0.35 : 0.5, 0.2),
  };
}

/**
 * Efeito manada: para cada tipo de infração, a fração recente de motoristas que infringiram
 * quando tiveram a chance (média móvel). Quanto mais gente infringe sem nada acontecer,
 * mais os próximos infringem; cada flagrante derruba essa pressão.
 */
export class EfeitoManada {
  nivel: Record<TipoInfracao, number>;

  constructor(pico: boolean) {
    const base = pico ? 0.25 : 0.18;
    this.nivel = Object.fromEntries(Object.keys(BASE).map((k) => [k, base])) as Record<TipoInfracao, number>;
  }

  /** Alguém teve a chance de infringir e decidiu (infringiu ou não). */
  observar(k: TipoInfracao, infringiu: boolean) {
    this.nivel[k] += 0.04 * ((infringiu ? 1 : 0) - this.nivel[k]);
  }

  /** Alguém foi flagrado: os outros veem e a pressão cai. */
  flagrante(k: TipoInfracao) {
    this.nivel[k] *= 0.85;
  }
}

export interface ContextoDecisao {
  tempo: number;
  infracao: TipoInfracao;
  ganhoTempoS: number;
  chanceFiscalizacao: number; // no local, com as intervenções
  chanceFiscalizacaoBase: number; // sem as intervenções (para saber se "desistiu")
  risco: number; // 0..1
  bonusObediencia: number; // pintura/sinalização
  possivel: boolean; // a geometria deixa?
  manada: number;
}

const sig = (u: number) => 1 / (1 + Math.exp(-u));

function utilidade(p: Perfil, c: ContextoDecisao, fiscal: number) {
  const ganho = Math.min(3, c.ganhoTempoS / 25) * (0.5 + 1.6 * p.pressa);
  const medo = fiscal * PUNICAO[c.infracao] * (1.2 - 0.5 * p.pressa);
  const perigo = c.risco * (0.6 + 2.2 * p.aversaoRisco);
  const norma = (p.obediencia + c.bonusObediencia) * 2.4;
  return BASE[c.infracao] + ganho + 2.2 * c.manada - medo - perigo - norma;
}

export function decidir(rng: Rng, perfil: Perfil, c: ContextoDecisao): Decisao & { desistiu: boolean } {
  const pCom = sig(utilidade(perfil, c, c.chanceFiscalizacao));
  const pSem = sig(utilidade(perfil, { ...c, bonusObediencia: 0 }, c.chanceFiscalizacaoBase));
  const r = rng.rnd();
  const quer = r < pCom;
  const infringiu = quer && c.possivel;
  const desistiu = (!c.possivel && quer) || (!quer && r < pSem);

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const partes: string[] = [];
  partes.push(`ganharia ~${Math.round(c.ganhoTempoS)} s`);
  partes.push(`chance de ser pego ${pct(c.chanceFiscalizacao)}${c.chanceFiscalizacao > c.chanceFiscalizacaoBase + 0.05 ? ' (fiscalização no local)' : ''}`);
  partes.push(`risco ${c.risco < 0.25 ? 'baixo' : c.risco < 0.55 ? 'médio' : 'alto'}`);
  if (c.manada > 0.3) partes.push(`${pct(c.manada)} dos outros estão fazendo o mesmo`);
  partes.push(`pressa ${pct(perfil.pressa)}, obediência ${pct(perfil.obediencia)}`);
  const nome = NOMES_INFRACAO[c.infracao].toLowerCase();
  let motivo: string;
  if (infringiu) motivo = `Infringiu (${nome}): ${partes.join('; ')}.`;
  else if (!c.possivel && quer) motivo = `Queria infringir (${nome}), mas a geometria não deixa mais. ${partes.join('; ')}.`;
  else if (desistiu) motivo = `Desistiu de infringir (${nome}) por causa da fiscalização: ${partes.join('; ')}.`;
  else motivo = `Respeitou a regra (${nome}): ${partes.join('; ')}.`;

  return {
    tempo: c.tempo,
    infracao: c.infracao,
    infringiu,
    ganhoTempoS: c.ganhoTempoS,
    chanceFiscalizacao: c.chanceFiscalizacao,
    risco: c.risco,
    pressaoSocial: c.manada,
    probabilidade: pCom,
    motivo,
    desistiu,
  };
}

/** Folga mínima (s) que o agente aceita para atravessar/entrar numa corrente de tráfego. */
export function brechaAceita(p: Perfil, esperaS: number, entrando: boolean, pedestre: boolean): number {
  const base = pedestre ? 7 : entrando ? 4.2 : 6;
  const g = base * (1.15 - 0.45 * p.pressa + 0.35 * p.aversaoRisco);
  // impaciência: quanto mais espera, menor a brecha que aceita
  return g * Math.max(0.4, 1 - esperaS / 120);
}
