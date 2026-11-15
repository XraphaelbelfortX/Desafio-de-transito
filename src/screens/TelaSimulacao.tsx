import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Incident } from '../types';
import { TacticalMap } from '../components/TacticalMap';
import { PaletaIntervencoes } from '../components/sim/PaletaIntervencoes';
import { PainelIntervencoes } from '../components/sim/PainelIntervencoes';
import type { IdCenario, Simulacao } from '../sim/useSimulacao';
import type { Assistente } from '../components/sim/Sugestoes';

interface Props {
  sim: Simulacao;
  assistente: Assistente;
  incidents: Incident[];
  latestIncidentId: string | null;
  relatosAtivos: boolean;
  onOpenStreetView: () => void;
}

/** Tela "Simular" (SimCity Tático do Figma): paleta à esquerda, mapa ao centro, painel de decisão à direita. */
export const TelaSimulacao: React.FC<Props> = ({ sim, assistente, incidents, latestIncidentId, relatosAtivos, onOpenStreetView }) => {
  const [cenarioAtivo, setCenarioAtivo] = useState<IdCenario | 'atual'>('atual');

  const abrirCenario = (id: IdCenario) => {
    setCenarioAtivo(id);
    sim.carregar(sim.cenarios[id] ?? []);
  };
  const novoCenario = () => {
    setCenarioAtivo('atual');
    sim.limpar();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="shrink-0 px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gv-border">
        <div>
          <h1 className="text-lg font-bold text-gv-ink leading-tight">Simulação tática · Africanos × Vicente Venâncio</h1>
          <p className="text-xs text-gv-muted">Arraste intervenções para o mapa. Custo e redução de risco recalculam na hora.</p>
        </div>
        <div className="flex items-center gap-1 bg-gv-card border border-gv-border rounded-xl p-1">
          {(['A', 'B'] as IdCenario[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => abrirCenario(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                cenarioAtivo === id ? 'bg-gv-cyan/20 text-gv-cyan' : 'text-gv-muted hover:text-gv-ink'
              }`}
            >
              Cenário {id}
            </button>
          ))}
          <button
            type="button"
            onClick={novoCenario}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              cenarioAtivo === 'atual' ? 'bg-gv-cyan/20 text-gv-cyan' : 'text-gv-muted hover:text-gv-ink'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> novo
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto lg:overflow-hidden">
        <aside className="w-full lg:w-[280px] shrink-0 lg:min-h-0 max-h-[50vh] lg:max-h-none">
          <PaletaIntervencoes sim={sim} assistente={assistente} />
        </aside>

        <div className="flex-1 min-w-0 min-h-[420px] lg:min-h-0">
          <TacticalMap incidents={incidents} onOpenStreetView={onOpenStreetView} latestIncidentId={latestIncidentId} sim={sim} relatosAtivos={relatosAtivos} assistente={assistente} />
        </div>

        <aside className="w-full lg:w-[360px] shrink-0 lg:min-h-0 max-h-[70vh] lg:max-h-none">
          <PainelIntervencoes sim={sim} />
        </aside>
      </div>
    </div>
  );
};
