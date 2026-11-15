import React, { useMemo, useState } from 'react';
import { Incident } from '../types';
import { TacticalMap } from '../components/TacticalMap';
import { KpiCard } from '../components/shell/KpiCard';
import { AlertCard } from '../components/shell/AlertCard';
import type { Simulacao } from '../sim/useSimulacao';
import type { Assistente } from '../components/sim/Sugestoes';

interface Props {
  sim: Simulacao;
  assistente: Assistente;
  incidents: Incident[];
  latestIncidentId: string | null;
  relatosAtivos: boolean;
  onOpenStreetView: () => void;
}

const FILTROS = ['Todos', 'Carro × ciclista', 'Pedestre'] as const;

/** Tela "Mapa" (Mapa de Alerta do Figma): visão do gestor com KPIs reais da simulação e os relatos recebidos. */
export const TelaMapaAlerta: React.FC<Props> = ({ sim, assistente, incidents, latestIncidentId, relatosAtivos, onOpenStreetView }) => {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todos');

  const visiveis = useMemo(() => {
    if (filtro === 'Todos') return incidents;
    if (filtro === 'Carro × ciclista') return incidents.filter((i) => /ciclista|bicicleta/i.test(i.tipo));
    return incidents.filter((i) => /pedestre|atropel/i.test(i.tipo));
  }, [incidents, filtro]);

  const nCiclista = incidents.filter((i) => /ciclista|bicicleta/i.test(i.tipo)).length;
  const risco = sim.metricas?.risco;
  const riscoRotulo = risco === undefined ? '—' : risco >= 15 ? 'Crítico' : risco >= 7 ? 'Moderado' : 'Baixo';
  const riscoCor = risco === undefined ? 'cyan' : risco >= 15 ? 'red' : risco >= 7 ? 'amber' : 'green';

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="shrink-0 px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gv-border">
        <div>
          <h1 className="text-lg font-bold text-gv-ink leading-tight">Mapa de Alerta · São Luís</h1>
          <p className="text-xs text-gv-muted">SMTT · Coordenação de Engenharia de Tráfego</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gv-cyan/15 border border-gv-cyan/40 text-gv-cyan">
          Av. dos Africanos × Vicente Venâncio
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col gap-3 p-3">
        <div className="flex flex-wrap gap-3 shrink-0">
          <KpiCard rotulo="Relatos recebidos" valor={String(incidents.length)} variacao="via WhatsApp" corVariacao="cyan" />
          <KpiCard rotulo="Quase-acidentes carro × ciclista" valor={String(nCiclista)} variacao={nCiclista > 0 ? `${nCiclista} no período` : 'nenhum registrado'} corVariacao={nCiclista > 0 ? 'amber' : 'green'} />
          <KpiCard rotulo="Índice de risco do cruzamento" valor={risco === undefined ? '—' : risco.toFixed(0)} variacao={riscoRotulo} corVariacao={riscoCor} />
          <KpiCard rotulo="Intervenções no mapa" valor={String(sim.intervencoes.length)} variacao={sim.intervencoes.length > 0 ? 'rodando na simulação' : 'cruzamento como está hoje'} corVariacao="cyan" />
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0 min-h-[420px] lg:min-h-0">
            <TacticalMap incidents={incidents} onOpenStreetView={onOpenStreetView} latestIncidentId={latestIncidentId} sim={sim} relatosAtivos={relatosAtivos} assistente={assistente} />
          </div>

          <aside className="w-full lg:w-[360px] shrink-0 bg-gv-panel border border-gv-border rounded-xl p-4 flex flex-col gap-3 lg:min-h-0 max-h-[60vh] lg:max-h-none overflow-y-auto">
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="text-base font-bold text-gv-ink">Alertas recentes</h2>
              <span className="bg-gv-red text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{visiveis.length}</span>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {FILTROS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    filtro === f ? 'bg-gv-cyan/15 border-gv-cyan text-gv-cyan' : 'bg-gv-card border-gv-border text-gv-ink hover:border-gv-cyan/40'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {visiveis.length === 0 ? (
                <p className="text-xs text-gv-muted bg-gv-card border border-dashed border-gv-border rounded-xl px-3 py-2">Nenhum relato nesse filtro.</p>
              ) : (
                visiveis.map((inc) => <AlertCard key={inc.id} incidente={inc} />)
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
