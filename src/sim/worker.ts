/// <reference lib="webworker" />
/**
 * Roda o motor fora da thread da tela. Mensagens:
 *   -> { tipo: 'iniciar', geojson, config }   (re)cria a simulação
 *   -> { tipo: 'rodar' } | { tipo: 'pausar' }
 *   -> { tipo: 'velocidade', fator }          1 = tempo real
 *   -> { tipo: 'intervencoes', lista }        aplica no meio da simulação
 *   -> { tipo: 'detalhe', id }                pede o painel do agente
 *   -> { tipo: 'comparar', cenarios, duracaoS }
 *   <- { tipo: 'quadro', quadro } (≈10 por segundo) | { tipo: 'detalhe', detalhe }
 *   <- { tipo: 'comparacao', resultados } | { tipo: 'progresso', feito, total }
 */
import { carregarRede, Rede } from './rede';
import { Simulacao } from './motor';
import { compararCenarios } from './cenarios';
import type { ConfigCenario, Intervencao } from './tipos';

type Msg =
  | { tipo: 'iniciar'; geojson: Parameters<typeof carregarRede>[0]; config: ConfigCenario }
  | { tipo: 'rodar' }
  | { tipo: 'pausar' }
  | { tipo: 'velocidade'; fator: number }
  | { tipo: 'intervencoes'; lista: Intervencao[] }
  | { tipo: 'detalhe'; id: number }
  | { tipo: 'comparar'; cenarios: { nome: string; config: ConfigCenario }[]; duracaoS: number };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let rede: Rede | null = null;
let sim: Simulacao | null = null;
let rodando = false;
let fator = 1;
let relogio: ReturnType<typeof setInterval> | null = null;
let ultimo = 0;
let detalheId: number | null = null;

function tique() {
  if (!sim || !rodando) return;
  const agora = performance.now();
  const realS = Math.min(0.5, (agora - ultimo) / 1000);
  ultimo = agora;
  sim.avancar(realS * fator, 0.25);
  enviarQuadro();
}

function enviarQuadro() {
  if (!sim) return;
  ctx.postMessage({ tipo: 'quadro', quadro: sim.quadro() });
  if (detalheId !== null) ctx.postMessage({ tipo: 'detalhe', detalhe: sim.detalhe(detalheId) });
}

ctx.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  switch (m.tipo) {
    case 'iniciar':
      rede = carregarRede(m.geojson);
      sim = new Simulacao(rede, m.config);
      detalheId = null;
      enviarQuadro();
      break;
    case 'rodar':
      rodando = true;
      ultimo = performance.now();
      if (!relogio) relogio = setInterval(tique, 100);
      break;
    case 'pausar':
      rodando = false;
      break;
    case 'velocidade':
      fator = m.fator;
      break;
    case 'intervencoes':
      sim?.aplicarIntervencoes(m.lista);
      enviarQuadro();
      break;
    case 'detalhe':
      detalheId = m.id;
      if (sim) ctx.postMessage({ tipo: 'detalhe', detalhe: sim.detalhe(m.id) });
      break;
    case 'comparar': {
      if (!rede) break;
      const res = [];
      for (let i = 0; i < m.cenarios.length; i++) {
        ctx.postMessage({ tipo: 'progresso', feito: i, total: m.cenarios.length });
        res.push(m.cenarios[i]);
      }
      const resultados = compararCenarios(rede, res, m.duracaoS).map((r) => ({ ...r, calor: r.calor.slice(0, 4000) }));
      ctx.postMessage({ tipo: 'comparacao', resultados });
      break;
    }
  }
};
