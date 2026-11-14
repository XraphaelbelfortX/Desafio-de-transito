import React, { useState, useEffect, useRef } from 'react';
import { Building2, Activity, AlertTriangle, BellRing, X } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Topbar */}
      <header className="bg-gov-navy text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/40 flex items-center justify-center shadow-inner">
              <Building2 className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                SMTT São Luís • protótipo
              </span>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                Guardião Viário — simulador de segurança viária
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">Cruzamento:</span>
              <strong className="text-white">Av. dos Africanos × Vicente Venâncio de Queiroga</strong>
            </div>
            <div className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 border ${relatosAtivos ? 'bg-red-500/20 border-red-400/40 text-red-200' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
              <AlertTriangle className={`w-4 h-4 ${relatosAtivos ? 'text-red-400' : 'text-slate-400'}`} />
              <span>{relatosAtivos ? `${incidents.length} relatos de quase-acidente` : 'Relatos desligados'}</span>
            </div>
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

      {/* Layout principal: mapa + relatos à esquerda, simulador de intervenções à direita */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 order-1 h-[min(78vh,760px)] min-h-[480px]">
            <TacticalMap incidents={incidents} onOpenStreetView={abrirStreetView} latestIncidentId={latestIncidentId} sim={sim} relatosAtivos={relatosAtivos} />
          </div>

          <aside className="lg:col-span-4 lg:row-span-2 order-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)]">
            <PainelIntervencoes sim={sim} />
          </aside>

          <div className="lg:col-span-8 order-3">
            <LogComportamento sim={sim} />
          </div>

          <div className="lg:col-span-8 order-4">
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
