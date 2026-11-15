import React, { useState, useEffect, useRef } from 'react';
import { BellRing, X } from 'lucide-react';
import { Incident, ToastNotification } from './types';
import { INITIAL_INCIDENTS, INTERSECTION_CENTER } from './data/mockData';
import { StreetViewModal } from './components/StreetViewModal';
import { NavRail, type Tela } from './components/shell/NavRail';
import { TelaSimulacao } from './screens/TelaSimulacao';
import { TelaMapaAlerta } from './screens/TelaMapaAlerta';
import { TelaCameras } from './screens/TelaCameras';
import { TelaRelatorios } from './screens/TelaRelatorios';
import { useSimulacao } from './sim/useSimulacao';
import { useAssistente } from './components/sim/Sugestoes';

export function App() {
  const [tela, setTela] = useState<Tela>('simular');

  // Relatos de quase-acidentes recebidos (entrada pelo WhatsApp)
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);

  // Limpa automaticamente qualquer estado antigo em cache do HMR fora do cruzamento atual
  useEffect(() => {
    setIncidents((prev) => {
      const hasLegacyCoords = prev.some((inc) => inc.lng < -44.2709 || inc.lat > -2.55);
      return hasLegacyCoords ? INITIAL_INCIDENTS : prev;
    });
  }, []);

  // Simulação por agentes: intervenções, tempo, agentes e cenários
  const sim = useSimulacao();
  const assistente = useAssistente(sim);
  const [relatosAtivos, setRelatosAtivos] = useState(true);
  const relatosAtivosRef = useRef(true);
  relatosAtivosRef.current = relatosAtivos;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [latestIncidentId, setLatestIncidentId] = useState<string | null>(null);

  const abrirStreetView = () => setIsStreetViewOpen(true);

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
    <div className="h-screen overflow-hidden bg-gv-bg text-gv-ink flex">
      <NavRail atual={tela} onMudar={setTela} />

      {/* Notificações de relatos recebidos */}
      <div aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-2 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-toast bg-gv-panel/95 backdrop-blur-md text-gv-ink p-4 rounded-xl shadow-2xl border-l-4 border-gv-green border border-gv-border flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-gv-green/15 border border-gv-green/40 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-5 h-5 text-gv-green" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gv-green">WhatsApp • {toast.timestamp}</span>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-gv-muted hover:text-gv-ink"
                  aria-label="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm font-bold text-gv-ink mt-0.5 leading-snug">{toast.title}</p>
              <p className="text-xs text-gv-muted mt-1 line-clamp-2">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      <main className="flex-1 min-w-0 min-h-0">
        {tela === 'mapa' && (
          <TelaMapaAlerta sim={sim} assistente={assistente} incidents={incidents} latestIncidentId={latestIncidentId} relatosAtivos={relatosAtivos} onOpenStreetView={abrirStreetView} />
        )}
        {tela === 'cameras' && <TelaCameras onNavegar={setTela} />}
        {tela === 'simular' && (
          <TelaSimulacao sim={sim} assistente={assistente} incidents={incidents} latestIncidentId={latestIncidentId} relatosAtivos={relatosAtivos} onOpenStreetView={abrirStreetView} />
        )}
        {tela === 'relatorios' && (
          <TelaRelatorios
            sim={sim}
            onSendReport={handleSendWhatsAppReport}
            isProcessing={isProcessing}
            totalReportsCount={incidents.length}
            relatosAtivos={relatosAtivos}
            onRelatosAtivos={(ligado) => {
              setRelatosAtivos(ligado);
              if (!ligado) setToasts([]);
            }}
          />
        )}
      </main>

      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        incidents={incidents}
        intervencoesReais={sim.intervencoes}
      />
    </div>
  );
}

export default App;
