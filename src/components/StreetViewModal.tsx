import React, { useState } from 'react';
import {
  X,
  Bike,
  ShieldAlert,
  Snail,
  Sparkles,
  CheckCircle2,
  MapPin,
  Layers,
  Eye,
} from 'lucide-react';
import { Intervention } from '../types';

interface StreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeInterventions: string[];
  interventionsCatalog: Intervention[];
  onToggleIntervention: (id: string) => void;
}

export const StreetViewModal: React.FC<StreetViewModalProps> = ({
  isOpen,
  onClose,
  activeInterventions,
  interventionsCatalog,
  onToggleIntervention,
}) => {
  const [viewMode, setViewMode] = useState<'projected' | 'before'>('projected');

  if (!isOpen) return null;

  const showCiclofaixa =
    viewMode === 'projected' &&
    (activeInterventions.includes('ciclofaixa') || activeInterventions.length === 0);
  const showTachao =
    viewMode === 'projected' &&
    (activeInterventions.includes('tachao') || activeInterventions.length === 0);
  const showNeckdown =
    viewMode === 'projected' && activeInterventions.includes('neckdown');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="street-view-title"
    >
      <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-toast">
        {/* Header Corporativo SMTT */}
        <div className="bg-gov-navy text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulação Digital Twin • Projeção Viária NACTO/SINAPI</span>
            </div>
            <h3 id="street-view-title" className="text-lg font-bold mt-0.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-400" />
              Street View — Av. dos Africanos × Av. Vicente Venâncio de Queiroga
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Controle Antes / Depois */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-800" />
              Modo de Inspeção Visual:
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('projected')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  viewMode === 'projected'
                    ? 'bg-gov-navy text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Com Ciclofaixa & Intervenções Projetadas
              </button>
              <button
                type="button"
                onClick={() => setViewMode('before')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  viewMode === 'before'
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Situação Atual (Sem Segregação)
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Coordenadas: -2.55556, -44.27128 • Cruzamento Coroado / Parque Timbiras
          </div>
        </div>

        {/* Viewport Street View Placeholder Realista com Projeção Tática */}
        <div className="relative w-full h-[390px] bg-slate-900 overflow-hidden select-none">
          {/* Fotografia de fundo / Perspectiva Urbana + Ciclofaixa Projetada em SVG Vetorial de Alta Precisão */}
          <svg
            viewBox="0 0 960 440"
            className="w-full h-full object-cover"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="55%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#dbeafe" />
              </linearGradient>
              <linearGradient id="asphaltGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="bikeLaneGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>
              <linearGradient id="neckdownGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>

            {/* Céu de São Luís */}
            <rect x="0" y="0" width="960" height="200" fill="url(#skyGrad)" />

            {/* Silhueta Urbana e Comércio da Av. dos Africanos */}
            <rect x="0" y="105" width="160" height="95" fill="#cbd5e1" />
            <rect x="15" y="120" width="130" height="28" fill="#1e40af" />
            <text x="80" y="139" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
              AUTO PEÇAS AFRICANOS
            </text>

            <rect x="165" y="90" width="190" height="110" fill="#e2e8f0" />
            <rect x="180" y="102" width="160" height="25" fill="#0f172a" />
            <text x="260" y="119" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">
              FARMÁCIA &amp; CLÍNICA POPULAR
            </text>

            <rect x="640" y="95" width="175" height="105" fill="#f1f5f9" />
            <rect x="652" y="110" width="150" height="26" fill="#b91c1c" />
            <text x="727" y="127" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
              MERCADINHO SÃO LUÍS
            </text>

            <rect x="820" y="80" width="140" height="120" fill="#cbd5e1" />

            {/* Poste e Semáforo SMTT */}
            <rect x="615" y="45" width="8" height="165" fill="#475569" />
            <rect x="520" y="52" width="100" height="7" fill="#475569" />
            <rect x="530" y="60" width="48" height="22" rx="3" fill="#15803d" stroke="#ffffff" strokeWidth="1.5" />
            <text x="554" y="74" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
              AV. AFRICANOS
            </text>

            {/* Calçadas Laterais */}
            <polygon points="0,200 350,200 120,440 0,440" fill="#94a3b8" />
            <polygon points="610,200 960,200 960,440 840,440" fill="#94a3b8" />

            {/* Leito Carroçável Principal (Av. dos Africanos + Entroncamento Vicente Venâncio) */}
            <polygon points="350,200 610,200 840,440 120,440" fill="url(#asphaltGrad)" />

            {/* Braço transversal da Rua Vicente Venâncio à direita */}
            <polygon points="560,235 960,245 960,335 660,320" fill="#1e293b" />

            {/* Eixo Central Duplo Amarelo da Av. dos Africanos */}
            <line x1="476" y1="200" x2="452" y2="440" stroke="#facc15" strokeWidth="4" />
            <line x1="484" y1="200" x2="464" y2="440" stroke="#facc15" strokeWidth="4" />

            {/* Faixa tracejada de rolamento */}
            <line
              x1="415"
              y1="200"
              x2="285"
              y2="440"
              stroke="#e2e8f0"
              strokeWidth="3"
              strokeDasharray="16 14"
            />

            {/* INTERVENÇÃO 3: Avanço de Calçada (Neckdown) */}
            {showNeckdown && (
              <g>
                <polygon
                  points="575,220 645,220 715,320 605,310"
                  fill="url(#neckdownGrad)"
                  fillOpacity="0.88"
                  stroke="#ecfdf5"
                  strokeWidth="3"
                />
                <circle cx="625" cy="255" r="7" fill="#fef08a" />
                <circle cx="645" cy="285" r="7" fill="#fef08a" />
                <text
                  x="648"
                  y="272"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="bold"
                >
                  NECKDOWN NACTO
                </text>
              </g>
            )}

            {/* INTERVENÇÃO 2: Pintura Ciclofaixa Vermelha Projetada */}
            {showCiclofaixa && (
              <g>
                <polygon
                  points="545,200 602,200 818,440 675,440"
                  fill="url(#bikeLaneGrad)"
                  fillOpacity="0.92"
                />
                {/* Bordas brancas termoplásticas */}
                <line x1="545" y1="200" x2="675" y2="440" stroke="#ffffff" strokeWidth="6" />
                <line x1="602" y1="200" x2="818" y2="440" stroke="#ffffff" strokeWidth="5" />

                {/* Pictograma de Bicicleta no Pavimento */}
                <g transform="translate(650, 335) scale(1.1)">
                  <circle cx="0" cy="20" r="10" fill="none" stroke="#ffffff" strokeWidth="3.5" />
                  <circle cx="34" cy="20" r="10" fill="none" stroke="#ffffff" strokeWidth="3.5" />
                  <path
                    d="M0,20 L14,5 L30,5 L17,20 Z M14,5 L10,-3 M30,5 L34,20"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <polygon points="15,-18 5,-4 25,-4" fill="#ffffff" />
                </g>
              </g>
            )}

            {/* INTERVENÇÃO 1: Tachões Refletivos (Tartarugas Bidirecionais SINAPI) */}
            {showTachao && (
              <g>
                {[
                  { x: 548, y: 215, s: 0.65 },
                  { x: 566, y: 248, s: 0.8 },
                  { x: 586, y: 285, s: 0.95 },
                  { x: 610, y: 328, s: 1.1 },
                  { x: 636, y: 376, s: 1.25 },
                  { x: 664, y: 426, s: 1.4 },
                ].map((t, idx) => (
                  <g key={idx} transform={`translate(${t.x}, ${t.y}) scale(${t.s})`}>
                    <rect
                      x="-12"
                      y="-5"
                      width="24"
                      height="10"
                      rx="2"
                      fill="#facc15"
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                    <rect x="-8" y="-2" width="16" height="4" fill="#fef08a" />
                  </g>
                ))}
              </g>
            )}

            {/* Alerta Visual quando no modo "Situação Atual (Sem Segregação)" */}
            {viewMode === 'before' && (
              <g>
                <ellipse
                  cx="635"
                  cy="325"
                  rx="115"
                  ry="58"
                  fill="#ef4444"
                  fillOpacity="0.45"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                />
                <text
                  x="635"
                  y="322"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="14"
                  fontWeight="bold"
                >
                  ZONA DE CONFLITO CRÍTICO
                </text>
                <text
                  x="635"
                  y="342"
                  textAnchor="middle"
                  fill="#fecaca"
                  fontSize="11"
                  fontWeight="bold"
                >
                  Conversão em alta velocidade s/ segregação ciclovia
                </text>
              </g>
            )}
          </svg>

          {/* Badges de HUD sobre a imagem Street View */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {showCiclofaixa && (
              <span className="bg-red-600/95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 border border-red-300/40">
                <Bike className="w-4 h-4" />
                Pintura Ciclofaixa Vermelha (Projetada)
              </span>
            )}
            {showTachao && (
              <span className="bg-amber-500/95 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Tachões Refletivos Bidirecionais
              </span>
            )}
            {showNeckdown && (
              <span className="bg-emerald-600/95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
                <Snail className="w-4 h-4" />
                Avanço de Calçada (Neckdown)
              </span>
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md text-white p-3 rounded-xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-blue-300 uppercase tracking-wide">
                Diagnóstico Guardião AI • Cruzamento Av. dos Africanos × Vicente Venâncio
              </p>
              <p className="text-xs text-slate-200 mt-0.5">
                A pintura vermelha de contraste combinada aos tachões reduz em até{' '}
                <strong className="text-emerald-400">78% as invasões de faixa</strong> por veículos em conversão à direita.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-300">
                Clique abaixo para testar camadas:
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé Interativo do Modal para ativar/desativar intervenções em tempo real */}
        <div className="p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {interventionsCatalog.map((item) => {
              const isActive = activeInterventions.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setViewMode('projected');
                    onToggleIntervention(item.id);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    isActive
                      ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  />
                  <span>{item.nome}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gov-navy hover:bg-blue-900 text-white font-semibold text-xs transition shadow"
          >
            Voltar ao Dashboard Tático
          </button>
        </div>
      </div>
    </div>
  );
};
