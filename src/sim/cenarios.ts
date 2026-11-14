import type { Rede } from './rede';
import { Motor, type Metricas, type TipoConflito, type TipoInfracao } from './motor';
import { analisar, type Intervencao, type IntervencaoLocal, orcar, type Orcamento } from './intervencoes';
import { paraLocal } from './geometria';

/**
 * Cenários e a conta de risco.
 *
 * CORREÇÃO DA CONTA DE RISCO: a versão anterior somava as reduções de cada intervenção
 * (45% + 60% = 105%) e travava em 90%. Reduções não se somam: a segunda medida age sobre o
 * risco que sobrou da primeira. Quando for preciso combinar porcentagens, use
 * combinarReducoes (1 − Π(1 − rᵢ)). Na comparação de cenários o risco é MEDIDO na simulação:
 * conflitos por hora ponderados por gravidade (grave = 3, moderado = 1) e vulnerabilidade
 * (pedestre × 2, colisão traseira × 0,7), e a redução é 1 − risco do cenário / risco atual.
 */
export function combinarReducoes(reducoes: number[]): number {
  return 1 - reducoes.reduce((resto, r) => resto * (1 - Math.min(1, Math.max(0, r))), 1);
}

export function reducaoDeRisco(riscoCenario: number, riscoAtual: number): number | null {
  if (riscoAtual <= 0) return null;
  return 1 - riscoCenario / riscoAtual;
}

export const paraLocais = (rede: Rede, ints: Intervencao[]): IntervencaoLocal[] =>
  ints.map((i) => ({ id: i.id, tipo: i.tipo, p: paraLocal(rede.quadro, i.lng, i.lat), tempos: i.tempos }));

export interface ItemOrcado {
  intervencao: IntervencaoLocal;
  efeito: string;
  orcamento: Orcamento;
}

export interface OrcamentoCenario {
  itens: ItemOrcado[];
  invalidas: { intervencao: IntervencaoLocal; motivo: string }[];
  implantacao: number;
  mensal: number;
  prazoDias: number;
}

export function orcarCenario(rede: Rede, ints: IntervencaoLocal[]): OrcamentoCenario {
  const itens: ItemOrcado[] = [];
  const invalidas: { intervencao: IntervencaoLocal; motivo: string }[] = [];
  for (const i of ints) {
    const a = analisar(rede, i);
    if (!a.valida) {
      invalidas.push({ intervencao: i, motivo: a.efeito });
      continue;
    }
    itens.push({ intervencao: i, efeito: a.efeito, orcamento: orcar(rede, i, a) });
  }
  return {
    itens,
    invalidas,
    implantacao: itens.reduce((acc, i) => acc + i.orcamento.totalImplantacao, 0),
    mensal: itens.reduce((acc, i) => acc + i.orcamento.totalMensal, 0),
    // obras independentes podem correr em paralelo: o prazo é o do item mais longo
    prazoDias: itens.reduce((acc, i) => Math.max(acc, i.orcamento.prazoDias), 0),
  };
}

export interface OpcoesRodada {
  hora: number;
  horas?: number;
  aquecimentoMin?: number;
  sementes?: number[];
  dt?: number;
  aoProgresso?: (fracao: number) => void;
}

export interface ResultadoRodada {
  metricas: Metricas;
  /** Faixa entre as sementes, para mostrar a incerteza. */
  riscoMin: number;
  riscoMax: number;
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Roda o cenário sem interface, em pedaços, para não travar a tela. */
export async function rodarCenario(rede: Rede, ints: IntervencaoLocal[], op: OpcoesRodada): Promise<ResultadoRodada> {
  const horas = op.horas ?? 1;
  const aquec = (op.aquecimentoMin ?? 6) * 60;
  const sementes = op.sementes ?? [11, 23, 37];
  const dt = op.dt ?? 0.25;
  const passosPorSemente = Math.ceil((aquec + horas * 3600) / dt);
  const total = passosPorSemente * sementes.length;
  const resultados: Metricas[] = [];
  for (const semente of sementes) {
    const m = new Motor(rede, ints, semente);
    m.definirHora(op.hora - aquec / 3600);
    let k = 0;
    while (k < passosPorSemente) {
      const fim = Math.min(passosPorSemente, k + 1500);
      for (; k < fim; k++) {
        m.passo(dt);
        if (k === Math.ceil(aquec / dt)) m.reiniciarMetricas();
      }
      op.aoProgresso?.(Math.min(1, (resultados.length * passosPorSemente + k) / total));
      await new Promise((r) => setTimeout(r, 0));
    }
    resultados.push(m.metricas());
  }
  const chavesInfr = Object.keys(resultados[0].infracoes) as TipoInfracao[];
  const chavesConf = Object.keys(resultados[0].conflitos) as TipoConflito[];
  const metricas: Metricas = {
    horas,
    veiculos: media(resultados.map((r) => r.veiculos)),
    atrasoMedio: media(resultados.map((r) => r.atrasoMedio)),
    infracoes: Object.fromEntries(chavesInfr.map((k) => [k, media(resultados.map((r) => r.infracoes[k]))])) as Record<TipoInfracao, number>,
    conflitos: Object.fromEntries(chavesConf.map((k) => [k, media(resultados.map((r) => r.conflitos[k]))])) as Record<TipoConflito, number>,
    conflitosGraves: media(resultados.map((r) => r.conflitosGraves)),
    risco: media(resultados.map((r) => r.risco)),
    pedestres: media(resultados.map((r) => r.pedestres)),
    esperaMediaPedestre: media(resultados.map((r) => r.esperaMediaPedestre)),
  };
  return {
    metricas,
    riscoMin: Math.min(...resultados.map((r) => r.risco)),
    riscoMax: Math.max(...resultados.map((r) => r.risco)),
  };
}

export const totalInfracoes = (m: Metricas) => Object.values(m.infracoes).reduce((a, b) => a + b, 0);
export const totalConflitos = (m: Metricas) => Object.values(m.conflitos).reduce((a, b) => a + b, 0);
