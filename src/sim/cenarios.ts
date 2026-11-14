/**
 * Comparação de cenários: roda cada configuração do início ao fim com a MESMA semente
 * (mesmos carros chegando na mesma hora), para a diferença vir só das intervenções.
 */
import { carregarRede, Rede } from './rede';
import { Simulacao } from './motor';
import { CUSTO } from './intervencoes';
import type { ConfigCenario, ResultadoCenario } from './tipos';

export type GeoJsonRede = Parameters<typeof carregarRede>[0];

export interface ResultadoComparado extends ResultadoCenario {
  nome: string;
  custo: number; // R$ de implantação
  tempoMedioPedestreS: number;
  /** Ganho em relação ao primeiro cenário (base), em %. Positivo = melhor. */
  ganho: { tempo: number; infracoes: number; conflitosGraves: number; risco: number };
  /** Nota 0..100 para o ranking (segurança pesa mais que fluidez, depois custo). */
  nota: number;
}

export function rodarCenario(rede: Rede, config: ConfigCenario, duracaoS = 1800, aquecimentoS = 300): ResultadoCenario & { sim: Simulacao } {
  const sim = new Simulacao(rede, { ...config, intervencoes: [...config.intervencoes] });
  sim.avancar(aquecimentoS);
  sim.zerarMetricas();
  sim.avancar(duracaoS);
  return { config, duracaoS, metricas: sim.metricas(), calor: sim.pontosCalor(), sim };
}

export function compararCenarios(
  rede: Rede,
  cenarios: { nome: string; config: ConfigCenario }[],
  duracaoS = 1800
): ResultadoComparado[] {
  const res = cenarios.map(({ nome, config }) => {
    const r = rodarCenario(rede, config, duracaoS);
    const custo = config.intervencoes.reduce((a, i) => a + (CUSTO[i.tipo] ?? 0), 0);
    return { nome, ...r, custo, tempoMedioPedestreS: r.sim.tempoMedioPedestreS };
  });
  const base = res[0].metricas;
  const pct = (b: number, x: number) => (b > 0 ? Math.round(((b - x) / b) * 100) : 0);
  const custoMax = Math.max(1, ...res.map((r) => r.custo));
  return res
    .map(({ sim, ...r }) => {
      void sim;
      const m = r.metricas;
      const ganho = {
        tempo: pct(base.tempoMedioTravessiaS, m.tempoMedioTravessiaS),
        infracoes: pct(base.infracoesTotal, m.infracoesTotal),
        conflitosGraves: pct(base.conflitosGraves, m.conflitosGraves),
        risco: pct(base.indiceRisco, m.indiceRisco),
      };
      const nota =
        50 * (1 - m.indiceRisco / 100) +
        30 * Math.max(0, Math.min(1, 1 - (m.tempoMedioTravessiaS - 30) / 300)) +
        20 * (1 - r.custo / custoMax);
      return { ...r, ganho, nota: Math.round(nota) };
    })
    .sort((a, b) => b.nota - a.nota);
}
