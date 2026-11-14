import React, { useState, useEffect, useRef } from 'react';
import { Building2, Activity, AlertTriangle, BellRing, X, Layers3, ListChecks, MessageCircle } from 'lucide-react';
import { Incident, ToastNotification } from './types';
import { INITIAL_INCIDENTS, INTERVENTIONS_CATALOG, INTERSECTION_CENTER } from './data/mockData';
import { TacticalMap } from './components/TacticalMap';
import { StreetViewModal } from './components/StreetViewModal';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { PainelIntervencoes } from './components/sim/PainelIntervencoes';
import { LogComportamento } from './components/sim/LogComportamento';
import { useSimulacao } from './sim/useSimulacao';

export function App() {
  // Relatos de quase-acidentes recebidos (entrada pelo WhatsApp)
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);

  // Limpa automaticamente qualquer estado antigo em cache do HMR fora do cruzamento atual
  useEffect(() => {
    setIncidents((prev) => {
      const hasLegacyCoords = prev.some((inc) => inc.lng < -44.2709 || inc.lat > -2.550);
      return hasLegacyCoords ? INITIAL_INCIDENTS : prev;
    });
  }, []);

  // Simulação por agentes: intervenções, tempo, agentes e cenários
  const sim = useSimulacao();
  const [relatosAtivos, setRelatosAtivos] = useState(true);
  const relatosAtivosRef = useRef(true);
  relatosAtivosRef.current = relatosAtivos;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [latestIncidentId, setLatestIncidentId] = useState<string | null>(null);

  // Ilustração do Street View (desenho fora de escala, não altera a simulação)
  const [ilustracao, setIlustracao] = useState<string[]>([]);
  const abrirStreetView = () => {
    setIlustracao(sim.intervencoes.some((i) => i.tipo === 'tachoes') ? ['tachao'] : []);
    setIsStreetViewOpen(true);
  };
  const alternarIlustracao = (id: string) =>
    setIlustracao((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Relato do cidadão (protótipo): classificação por palavras-chave e ponto no cruzamento
  const handleSendWhatsAppReport = (transcribedText: string) => {
    if (!relatosAtivosRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      if (!relatosAtivosRef.current) {
        setIsProcessing(false);
        return;
      }
      const jitterLat = (Math.random() - 0.5) * 0.00014;
      const jitterLng = (Math.random() - 0.5) * 0.00014;

      const lower = transcribedText.toLowerCase();
      let classifiedType = 'Risco de Colisão no Cruzamento';
      if (lower.includes('bicicleta') || lower.includes('ciclista') || lower.includes('ciclofaixa')) {
        classifiedType = 'Quase-Colisão com Ciclista';
      } else if (lower.includes('pedestre') || lower.includes('atropel') || lower.includes('criança') || lower.includes('faixa')) {
        classifiedType = 'Quase-Atropelamento em Travessia';
      } else if (lower.includes('moto')) {
        classifiedType = 'Frenagem Crítica de Motociclista';
      }

      const newIncident: Incident = {
        id: `inc-${Date.now()}`,
        lat: Number((INTERSECTION_CENTER.lat + jitterLat).toFixed(5)),
        lng: Number((INTERSECTION_CENTER.lng + jitterLng).toFixed(5)),
        tipo: classifiedType,
        severidade: 'critica',
        resumo: transcribedText,
        horario: 'Agora mesmo',
        origem: 'WhatsApp Cidadão',
        pesoHeatmap: 1.0,
      };

      setIncidents((prev) => [newIncident, ...prev]);
      setLatestIncidentId(newIncident.id);
      setIsProcessing(false);

      const newToast: ToastNotification = {
        id: `toast-${Date.now()}`,
        title: `Relato recebido: ${classifiedType}`,
        message: 'Marcado no cruzamento da Av. dos Africanos com a Vicente Venâncio. Veja na mancha de calor "Relatos".',
        incidentResumo: transcribedText,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 2)]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 6500);
    }, 600);
  };

  // Abas do painel lateral do operador
  const [aba, setAba] = useState<'intervencoes' | 'log' | 'relatos'>('intervencoes');
  const etapa = sim.cenarios.A || sim.cenarios.B ? 3 : sim.intervencoes.length > 0 ? 2 : 1;
  const ETAPAS = ['Coloque intervenções', 'Rode e observe', 'Compare cenários'];

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-900 flex flex-col">
      {/* Topbar */}
      <header className="bg-gov-navy text-white border-b border-slate-800 shadow-sm shrink-0">
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/25 border border-blue-400/40 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold tracking-tight text-white leading-tight">Guardião Viário</h1>
              <p className="text-[11px] text-slate-300 truncate">
                SMTT São Luís · Av. dos Africanos × Av. Vicente Venâncio de Queiroga
              </p>
            </div>
          </div>

          {/* Fluxo do operador */}
          <ol className="hidden md:flex items-center gap-1.5" aria-label="Como usar">
            {ETAPAS.map((rotulo, i) => {
              const n = i + 1;
              const atual = n === etapa;
              const feita = n < etapa;
              return (
                <li key={rotulo} className="flex items-center gap-1.5">
                  <span
                    className={`flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-xs font-semibold border ${
                      atual ? 'bg-white text-gov-navy border-white' : feita ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/40' : 'bg-white/5 text-slate-300 border-white/10'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center ${atual ? 'bg-gov-navy text-white' : feita ? 'bg-emerald-500 text-white' : 'bg-white/10'}`}>
                      {feita ? '✓' : n}
                    </span>
                    {rotulo}
                  </span>
                  {n < ETAPAS.length && <span className="w-4 h-px bg-white/20" />}
                </li>
              );
            })}
          </ol>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 border ${
                sim.rodando ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100' : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${sim.rodando ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <Activity className="w-3.5 h-3.5" />
              {sim.rodando ? `Simulando · ${sim.velocidade}×` : 'Pausado'}
            </span>
            <button
              type="button"
              onClick={() => setAba('relatos')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 border ${relatosAtivos ? 'bg-red-500/15 border-red-400/40 text-red-100 hover:bg-red-500/25' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {relatosAtivos ? `${incidents.length} relatos` : 'Relatos desligados'}
            </button>
          </div>
        </div>
      </header>

      {/* Notificações de relatos recebidos */}
      <div aria-live="polite" className="fixed top-16 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-2 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-toast bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl border-l-4 border-emerald-400 border border-slate-700/80 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">WhatsApp • {toast.timestamp}</span>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-slate-400 hover:text-white"
                  aria-label="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm font-bold text-white mt-0.5 leading-snug">{toast.title}</p>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mesa do operador: mapa ocupa a tela, painel fixo à direita */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto lg:overflow-hidden">
        <div className="flex-1 min-w-0 min-h-[520px] lg:min-h-0">
          <TacticalMap incidents={incidents} onOpenStreetView={abrirStreetView} latestIncidentId={latestIncidentId} sim={sim} relatosAtivos={relatosAtivos} />
        </div>

        <aside className="w-full lg:w-[420px] xl:w-[440px] shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:min-h-0 max-h-[90vh] lg:max-h-none">
          <nav className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 shrink-0" role="tablist" aria-label="Painel">
            {(
              [
                { id: 'intervencoes', rotulo: 'Intervenções', icone: Layers3, extra: sim.intervencoes.length || null },
                { id: 'log', rotulo: 'O que aconteceu', icone: ListChecks, extra: null },
                { id: 'relatos', rotulo: 'Relatos', icone: MessageCircle, extra: relatosAtivos ? incidents.length : null },
              ] as const
            ).map((t) => {
              const ativo = aba === t.id;
              const Icone = t.icone;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => setAba(t.id)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                    ativo ? 'border-blue-700 text-blue-800 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icone className="w-4 h-4" />
                  {t.rotulo}
                  {t.extra !== null && (
                    <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center ${ativo ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {t.extra}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="flex-1 min-h-0 flex flex-col">
            {aba === 'intervencoes' && <PainelIntervencoes sim={sim} />}
            {aba === 'log' && (
              <div className="flex-1 min-h-0 overflow-y-auto painel-embutido">
                <LogComportamento sim={sim} />
              </div>
            )}
            {aba === 'relatos' && (
              <div className="flex-1 min-h-0 overflow-y-auto painel-embutido">
                <WhatsAppSimulator
                  onSendReport={handleSendWhatsAppReport}
                  isProcessing={isProcessing}
                  totalReportsCount={incidents.length}
                  ativo={relatosAtivos}
                  onAtivo={(ligado) => {
                    setRelatosAtivos(ligado);
                    if (!ligado) setToasts([]);
                  }}
                />
              </div>
            )}
          </div>
        </aside>
      </main>

      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        activeInterventions={ilustracao}
        interventionsCatalog={INTERVENTIONS_CATALOG}
        onToggleIntervention={alternarIlustracao}
      />
    </div>
  );
}

export default App;
