import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { Incident } from '../types';
import { TacticalMap } from '../components/TacticalMap';
import { KpiCard } from '../components/shell/KpiCard';
import { AlertCard } from '../components/shell/AlertCard';
import type { Tela } from '../components/shell/NavRail';
import type { Simulacao } from '../sim/useSimulacao';
import type { Assistente } from '../components/sim/Sugestoes';
import { totalConflitos } from '../sim/cenarios';

interface Props {
  sim: Simulacao;
  assistente: Assistente;
  incidents: Incident[];
  onOpenStreetView: () => void;
  onNavegar: (t: Tela) => void;
}

const FILTROS = ['Todas', 'Críticas', 'Altas'] as const;

/** Tela "Mapa": visão geral com um único alerta por cruzamento; o clique abre tudo. */
export const TelaMapaAlerta: React.FC<Props> = ({ sim, assistente, incidents, onOpenStreetView, onNavegar }) => {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todas');

  const visiveis = useMemo(() => {
    if (filtro === 'Críticas') return incidents.filter((i) => i.severidade === 'critica');
    if (filtro === 'Altas') return incidents.filter((i) => i.severidade === 'alta');
    return incidents;
  }, [incidents, filtro]);

  const criticas = incidents.filter((i) => i.severidade === 'critica').length;
  const m = sim.metricas;
  const risco = m?.risco;
  const minutos = m ? m.horas * 60 : 0;
  // Sem escala calibrada para dizer "alto" ou "baixo": o número só vale comparado a outro cenário.
  const riscoRotulo = risco === undefined || minutos < 5 ? 'medindo…' : 'quase-acidentes ponderados por hora';
  const fmt = (v: number) => Math.round(v).toLocaleString('pt-BR');

  const alternar = () => setAberto((a) => !a);
  const irSimular = () => onNavegar('simular');

  const resumoPopup = (
    <div className="p-1 w-[290px] text-gv-ink">
      <p className="text-[13px] font-bold">Av. dos Africanos × Vicente Venâncio</p>
      <div className="flex gap-4 mt-2">
        <div>
          <p className="text-xl font-bold text-gv-red leading-none">{incidents.length}</p>
          <p className="text-[10px] text-gv-muted mt-0.5">ocorrências</p>
        </div>
        <div>
          <p className="text-xl font-bold text-gv-orange leading-none">{criticas}</p>
          <p className="text-[10px] text-gv-muted mt-0.5">críticas</p>
        </div>
        <div>
          <p className="text-xl font-bold text-gv-amber leading-none">{risco === undefined ? '—' : fmt(risco)}</p>
          <p className="text-[10px] text-gv-muted mt-0.5">risco/h simulado</p>
        </div>
      </div>
      <p className="text-[11px] text-gv-muted mt-2 leading-snug">
        A lista completa está ao lado. Para testar o que resolve, abra a simulação deste cruzamento.
      </p>
      <button
        type="button"
        onClick={irSimular}
        className="mt-2.5 w-full py-2 rounded-lg bg-gv-cyan text-gv-cyanink text-xs font-bold hover:brightness-110"
      >
        Simular intervenção →
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="shrink-0 px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gv-border">
        <div>
          <h1 className="text-lg font-bold text-gv-ink leading-tight">Mapa de Alerta · São Luís</h1>
          <p className="text-xs text-gv-muted">Visão geral, sem mexer em nada. Clique no alerta do cruzamento para ver tudo.</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gv-cyan/15 border border-gv-cyan/40 text-gv-cyan">
          Av. dos Africanos × Vicente Venâncio
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col gap-3 p-3">
        <div className="flex flex-wrap gap-3 shrink-0">
          <KpiCard rotulo="Ocorrências registradas" valor={String(incidents.length)} variacao={`${criticas} críticas`} corVariacao="red" />
          <KpiCard rotulo="Índice de risco (simulado)" valor={risco === undefined ? '—' : fmt(risco)} variacao={riscoRotulo} corVariacao="amber" />
          <KpiCard rotulo="Quase-acidentes por hora (simulado)" valor={m ? fmt(totalConflitos(m)) : '—'} variacao={m ? `${fmt(m.conflitosGraves)} graves` : 'medindo…'} corVariacao="amber" />
          <KpiCard
            rotulo="Intervenções em teste"
            valor={String(sim.intervencoes.length)}
            variacao={sim.intervencoes.length > 0 ? 'na aba Simular' : 'cruzamento como está hoje'}
            corVariacao="cyan"
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0 min-h-[420px] lg:min-h-0">
            <TacticalMap
              incidents={incidents}
              onOpenStreetView={onOpenStreetView}
              sim={sim}
              assistente={assistente}
              compacto
              hotspot={{ total: incidents.length, aberto, onAlternar: alternar, conteudo: resumoPopup }}
            />
          </div>

          <aside className="w-full lg:w-[360px] shrink-0 bg-gv-panel border border-gv-border rounded-xl p-4 flex flex-col gap-3 lg:min-h-0 max-h-[60vh] lg:max-h-none overflow-y-auto">
            <h2 className="text-base font-bold text-gv-ink shrink-0">Alertas</h2>

            {/* Um único alerta por cruzamento; clicar abre tudo */}
            <button
              type="button"
              onClick={alternar}
              aria-expanded={aberto}
              className={`shrink-0 w-full text-left rounded-xl border overflow-hidden flex items-stretch transition ${
                aberto ? 'border-gv-red/60 bg-gv-red/10' : 'border-gv-border bg-gv-card hover:border-gv-red/50'
              }`}
            >
              <span className="w-1 bg-gv-red shrink-0" />
              <span className="flex-1 p-3 flex items-start gap-3">
                <span className="w-10 h-10 rounded-lg bg-gv-red/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-gv-red" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold text-gv-ink">Cruzamento crítico</span>
                  <span className="block text-[11px] text-gv-muted">Av. dos Africanos × Vicente Venâncio</span>
                  <span className="block text-[11px] text-gv-red font-semibold mt-0.5">
                    {incidents.length} ocorrências · {criticas} críticas
                  </span>
                </span>
                {aberto ? <ChevronUp className="w-4 h-4 text-gv-muted mt-1" /> : <ChevronDown className="w-4 h-4 text-gv-muted mt-1" />}
              </span>
            </button>

            {!aberto && <p className="text-[11px] text-gv-muted">Clique no alerta (aqui ou no mapa) para ver as ocorrências.</p>}

            {aberto && (
              <>
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
                    <p className="text-xs text-gv-muted bg-gv-card border border-dashed border-gv-border rounded-xl px-3 py-2">Nenhuma ocorrência nesse filtro.</p>
                  ) : (
                    visiveis.map((inc) => <AlertCard key={inc.id} incidente={inc} />)
                  )}
                </div>
                <button
                  type="button"
                  onClick={irSimular}
                  className="shrink-0 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gv-cyan text-gv-cyanink text-sm font-bold hover:brightness-110"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Simular intervenção neste cruzamento
                </button>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};
