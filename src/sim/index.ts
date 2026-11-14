/**
 * Ponto de entrada do motor para a tela (Raphael).
 *
 *   const rede = await carregarRedePadrao();
 *   const sim = criarSimulacao(rede, { semente: 42, horario: 'pico_tarde', intervencoes: [] });
 *   sim.avancar(1);            // 1 s simulado
 *   const q = sim.quadro();    // agentes, eventos, métricas, semáforo
 *   sim.detalhe(q.agentes[0].id) // perfil + motivo da decisão (painel ao clicar)
 *   sim.aplicarIntervencoes([...])
 *
 * Para não travar a tela, use o hook useSimulacao (roda o motor num Web Worker).
 */
export * from './tipos';
export { carregarRede } from './rede';
export type { Rede } from './rede';
export { Simulacao } from './motor';
export { rodarCenario, compararCenarios } from './cenarios';
export type { ResultadoComparado } from './cenarios';
export { CUSTO } from './intervencoes';
export { PRESETS, intervencaoDe, cenariosDemo } from './presets';
export type { Preset } from './presets';

import { carregarRede } from './rede';
import { Simulacao } from './motor';
import type { ConfigCenario } from './tipos';

import { REDE_URL } from './constantes';
export { REDE_URL };
export { useSimulacao } from './useSimulacao';

export async function carregarRedePadrao(url = REDE_URL) {
  const r = await fetch(url);
  return carregarRede(await r.json());
}

export function criarSimulacao(rede: ReturnType<typeof carregarRede>, config: ConfigCenario) {
  return new Simulacao(rede, config);
}
