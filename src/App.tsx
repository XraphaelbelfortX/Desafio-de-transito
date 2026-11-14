import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Bike,
  Snail,
  Building2,
  DollarSign,
  TrendingDown,
  Clock,
  CheckCircle2,
  BellRing,
  FileCheck2,
  AlertTriangle,
  Activity,
  Sparkles,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { Incident, Intervention, InterventionIconName, ToastNotification } from './types';
import {
  INITIAL_INCIDENTS,
  INTERVENTIONS_CATALOG,
  INTERSECTION_CENTER,
} from './data/mockData';
import { TacticalMap } from './components/TacticalMap';
import { StreetViewModal } from './components/StreetViewModal';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';

const formatCurrencyBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);

const renderInterventionIcon = (iconName: InterventionIconName, isActive: boolean) => {
  const baseClass = `w-5 h-5 transition-colors ${
    isActive ? 'text-white' : 'text-blue-900'
  }`;
  switch (iconName) {
    case 'ShieldAlert':
      return <ShieldAlert className={baseClass} />;
    case 'Bike':
      return <Bike className={baseClass} />;
    case 'Snail':
      return <Snail className={baseClass} />;
  }
};

export function App() {
  // 1. Estados Globais Obrigatórios (React Hooks)
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [activeInterventions, setActiveInterventions] = useState<string[]>([
    'ciclofaixa',
  ]);

  // Estados de UX / Modais / Processamento IA
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [latestIncidentId, setLatestIncidentId] = useState<string | null>(null);
  const [approvedOrderModal, setApprovedOrderModal] = useState<{
    protocolo: string;
    orcamento: number;
    reducaoRisco: number;
    tempoDias: number;
    itens: Intervention[];
  } | null>(null);

  // Toggle de Intervenções Táticas (Estilo SimCity)
  const handleToggleIntervention = (id: string) => {
    setActiveInterventions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // KPIs Dinâmicos calculados instantaneamente via useMemo
  const kpis = useMemo(() => {
    const selectedItems = INTERVENTIONS_CATALOG.filter((item) =>
      activeInterventions.includes(item.id)
    );

    const orcamentoTotal = selectedItems.reduce((acc, cur) => acc + cur.custo, 0);

    const somaReducaoBruta = selectedItems.reduce(
      (acc, cur) => acc + cur.reducaoRisco,
      0
    );
    // Travado em max 90% conforme regra de negócio
    const reducaoRiscoEstimada = Math.min(90, somaReducaoBruta);

    const tempoObraDias = selectedItems.reduce(
      (acc, cur) => acc + cur.tempoDias,
      0
    );

    return {
      orcamentoTotal,
      somaReducaoBruta,
      reducaoRiscoEstimada,
      tempoObraDias,
      selectedItems,
    };
  }, [activeInterventions]);

  // 3. Simulador do Backend (WhatsApp + OpenAI com delay de 1s)
  const handleSendWhatsAppReport = (transcribedText: string) => {
    setIsProcessingAI(true);

    setTimeout(() => {
      // Gera coordenadas concentradas exatamente na garganta da intersecção
      // Av. dos Africanos × Av. Vicente Venâncio de Queiroga (-2.55556, -44.27128)
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
      setIsProcessingAI(false);

      // Dispara Toast Obrigatório
      const newToast: ToastNotification = {
        id: `toast-${Date.now()}`,
        title: 'Novo alerta via WhatsApp: Risco de colisão processado pelo Guardião AI',
        message: `${classifiedType} georreferenciado em Av. dos Africanos × Av. Vicente Venâncio de Queiroga.`,
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
    }, 1000);
  };

  // Aprovar Ordem de Obra (dispara alerta de sucesso)
  const handleApproveWorkOrder = () => {
    if (kpis.selectedItems.length === 0) {
      window.alert(
        'Selecione pelo menos uma intervenção tática no painel antes de aprovar a Ordem de Obra.'
      );
      return;
    }

    const protocolo = `SMTT-SLZ-${new Date().getFullYear()}-${Math.floor(
      10000 + Math.random() * 90000
    )}`;

    setApprovedOrderModal({
      protocolo,
      orcamento: kpis.orcamentoTotal,
      reducaoRisco: kpis.reducaoRiscoEstimada,
      tempoDias: kpis.tempoObraDias,
      itens: kpis.selectedItems,
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Topbar Governamental Corporativa */}
      <header className="bg-gov-navy text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/40 flex items-center justify-center shadow-inner">
              <Building2 className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  Prefeitura de São Luís • GovTech
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  IA Preditiva Online
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                Guardião Viário — Inteligência Cidadã &amp; Decisão Tática
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">Intersecção Crítica:</span>
              <strong className="text-white">Av. dos Africanos × Vicente Venâncio de Queiroga</strong>
            </div>
            <div className="bg-red-500/20 border border-red-400/40 text-red-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{incidents.length} Quase-Acidentes</span>
            </div>
          </div>
        </div>
      </header>

      {/* Container de Toasts/Notificações de IA em Tempo Real */}
      <div
        aria-live="polite"
        className="fixed top-16 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-2 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-toast bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl border-l-4 border-emerald-400 border border-slate-700/80 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-5 h-5 text-emerald-300 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Webhook WhatsApp • {toast.timestamp}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                  }
                  className="text-slate-400 hover:text-white"
                  aria-label="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm font-bold text-white mt-0.5 leading-snug">
                {toast.title}
              </p>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                {toast.message}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Layout Principal: Grid 12 Colunas (Tailwind CSS) */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* ÁREA CENTRAL / ESQUERDA: Mapa + Simulador de Cidadão (col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Mapa Tático Interativo com Heatmap Nativo */}
          <div className="flex-1 min-h-[450px]">
            <TacticalMap
              incidents={incidents}
              activeInterventions={activeInterventions}
              riskReduction={kpis.reducaoRiscoEstimada}
              onOpenStreetView={() => setIsStreetViewOpen(true)}
              latestIncidentId={latestIncidentId}
            />
          </div>

          {/* Painel Inferior: Simulador de Cidadão (WhatsApp + OpenAI) */}
          <WhatsAppSimulator
            onSendReport={handleSendWhatsAppReport}
            isProcessing={isProcessingAI}
            totalReportsCount={incidents.length}
          />
        </div>

        {/* PAINEL LATERAL DIREITO: Gestão Tática (col-span-4) */}
        <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            {/* Header Obrigatório: "Guardião Viário - SMTT" */}
            <div className="bg-gov-navy text-white px-5 py-4 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Simulador de Engenharia de Tráfego
                </span>
                <span className="text-[10px] font-mono bg-blue-900/80 text-blue-200 px-2 py-0.5 rounded border border-blue-700">
                  SINAPI / NACTO
                </span>
              </div>
              <h2 className="text-lg font-extrabold tracking-tight mt-1">
                Guardião Viário - SMTT
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Ative intervenções táticas para mitigar os relatos de quase-acidentes na intersecção
              </p>
            </div>

            {/* Painel de Decisão: Lista das Intervenções (Tachões, Ciclofaixa, Avanço) */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Catálogo de Intervenções Táticas
                </h3>
                <span className="text-[11px] text-slate-500">
                  {activeInterventions.length} de {INTERVENTIONS_CATALOG.length} ativas
                </span>
              </div>

              <div className="space-y-2.5">
                {INTERVENTIONS_CATALOG.map((item) => {
                  const isActive = activeInterventions.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleIntervention(item.id)}
                      role="switch"
                      aria-checked={isActive}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleIntervention(item.id);
                        }
                      }}
                      className={`group cursor-pointer rounded-xl p-3.5 border transition-all duration-150 select-none ${
                        isActive
                          ? 'bg-blue-50/70 border-blue-700 shadow-sm ring-1 ring-blue-700/20'
                          : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm ${
                              isActive
                                ? 'bg-gov-navy text-white'
                                : 'bg-white text-blue-900 border border-slate-200'
                            }`}
                          >
                            {renderInterventionIcon(item.icon, isActive)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                {item.nome}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {item.descricaoTatica}
                            </p>

                            {/* Métricas Individuais da Intervenção */}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {formatCurrencyBRL(item.custo)}
                              </span>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                -{item.reducaoRisco}% risco
                              </span>
                              <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {item.tempoDias} {item.tempoDias === 1 ? 'dia' : 'dias'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {item.codigoSinapi}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Toggle Switch Visual */}
                        <div
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-1 ${
                            isActive ? 'bg-gov-navy' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* KPIs Dinâmicos: 3 Cards (Orçamento Total, Redução de Risco Estimada, Tempo de Obra) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    KPIs de Impacto Tático (Tempo Real)
                  </h3>
                  {kpis.somaReducaoBruta > 90 && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Teto Técnico: Máx 90%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Card 1: Orçamento Total */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <DollarSign className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                      <span className="truncate">Orçamento Total</span>
                    </div>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                      {formatCurrencyBRL(kpis.orcamentoTotal)}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Base SINAPI MA
                    </span>
                  </div>

                  {/* Card 2: Redução de Risco Estimada (travado em max 90%) */}
                  <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Redução Risco</span>
                    </div>
                    <p className="text-sm sm:text-base font-extrabold text-emerald-700 mt-1">
                      {kpis.reducaoRiscoEstimada}%
                    </p>
                    <div className="w-full h-1.5 bg-emerald-200 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${(kpis.reducaoRiscoEstimada / 90) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Card 3: Tempo de Obra */}
                  <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-200">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-900">
                      <Clock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <span className="truncate">Tempo de Obra</span>
                    </div>
                    <p className="text-sm sm:text-base font-extrabold text-blue-950 mt-1">
                      {kpis.tempoObraDias}{' '}
                      <span className="text-xs font-bold">
                        {kpis.tempoObraDias === 1 ? 'dia' : 'dias'}
                      </span>
                    </p>
                    <span className="text-[10px] text-blue-700/80 block mt-0.5">
                      Execução rápida
                    </span>
                  </div>
                </div>
              </div>

              {/* Feed Resumido de Relatos Recentes da Intersecção */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Últimos Relatos Captados (IA)
                  </span>
                  <span className="text-[11px] font-semibold text-blue-800">
                    {incidents.length} registros
                  </span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {incidents.slice(0, 3).map((inc) => (
                    <div
                      key={inc.id}
                      className="text-[11px] bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-start justify-between gap-2"
                    >
                      <div className="truncate">
                        <span className="font-bold text-slate-800">{inc.tipo}: </span>
                        <span className="text-slate-600">{inc.resumo}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {inc.horario}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé do Painel Lateral: Botão Final "Aprovar Ordem de Obra" */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              onClick={handleApproveWorkOrder}
              className="w-full py-3.5 px-5 rounded-xl bg-gov-navy hover:bg-blue-900 active:scale-[0.99] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
              <span>Aprovar Ordem de Obra</span>
            </button>
            <p className="text-[11px] text-center text-slate-500 mt-2">
              Gera Ordem de Serviço automática com memorial SINAPI para a equipe de engenharia SMTT
            </p>
          </div>
        </aside>
      </main>

      {/* Modal de Simulação Street View */}
      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        activeInterventions={activeInterventions}
        interventionsCatalog={INTERVENTIONS_CATALOG}
        onToggleIntervention={handleToggleIntervention}
      />

      {/* Modal de Sucesso: Ordem de Obra Aprovada */}
      {approvedOrderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-toast">
            <div className="bg-emerald-900 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                    Despacho Tático Autorizado • SMTT São Luís
                  </span>
                  <h3 className="text-lg font-extrabold">
                    Ordem de Obra Emitida com Sucesso!
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovedOrderModal(null)}
                className="text-emerald-200 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">
                    Protocolo Eletrônico SEI/SMTT
                  </span>
                  <strong className="font-mono text-slate-900">
                    {approvedOrderModal.protocolo}
                  </strong>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Pronto para Execução
                </span>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Intervenções Autorizadas para Av. dos Africanos × Vicente Venâncio:
                </p>
                <ul className="space-y-1.5">
                  {approvedOrderModal.itens.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"
                    >
                      <span className="font-semibold text-slate-800">
                        • {item.nome} ({item.codigoSinapi})
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrencyBRL(item.custo)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-slate-100 p-2.5 rounded-lg text-center">
                  <span className="text-[11px] text-slate-500 block">Custo Total</span>
                  <strong className="text-slate-900 text-sm">
                    {formatCurrencyBRL(approvedOrderModal.orcamento)}
                  </strong>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-lg text-center border border-emerald-200">
                  <span className="text-[11px] text-emerald-700 block">
                    Mitigação de Risco
                  </span>
                  <strong className="text-emerald-800 text-sm">
                    -{approvedOrderModal.reducaoRisco}%
                  </strong>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-lg text-center border border-blue-200">
                  <span className="text-[11px] text-blue-700 block">Prazo Estimado</span>
                  <strong className="text-blue-900 text-sm">
                    {approvedOrderModal.tempoDias}{' '}
                    {approvedOrderModal.tempoDias === 1 ? 'dia' : 'dias'}
                  </strong>
                </div>
              </div>

              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  Os cidadãos que enviaram relatos via WhatsApp nesta intersecção receberão retorno automático quando a obra for concluída.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setApprovedOrderModal(null)}
                className="w-full py-2.5 rounded-xl bg-gov-navy hover:bg-blue-900 text-white font-bold text-xs transition"
              >
                Fechar Comprovante da Ordem de Obra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
