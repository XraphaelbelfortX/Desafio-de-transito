import React from 'react';
import { AlertTriangle, Bike, Footprints, Car } from 'lucide-react';
import type { Incident, SeverityLevel } from '../../types';

const COR_SEVERIDADE: Record<SeverityLevel, string> = {
  critica: '#ef4444',
  alta: '#fb923c',
  media: '#facc15',
  baixa: '#8a97b0',
};

const iconePorTipo = (tipo: string) => {
  const t = tipo.toLowerCase();
  if (t.includes('ciclista') || t.includes('bicicleta')) return Bike;
  if (t.includes('pedestre') || t.includes('atropel')) return Footprints;
  if (t.includes('moto')) return Car;
  return AlertTriangle;
};

/** Cartão de relato/alerta (lista "Alertas recentes"), com a cor da faixa dada pela severidade real. */
export const AlertCard: React.FC<{ incidente: Incident }> = ({ incidente }) => {
  const cor = COR_SEVERIDADE[incidente.severidade];
  const Icone = iconePorTipo(incidente.tipo);
  return (
    <div className="bg-gv-card border border-gv-border rounded-xl flex gap-3 items-center overflow-hidden pr-3 w-full">
      <div className="self-stretch w-1 shrink-0" style={{ background: cor }} />
      <div className="w-16 h-16 rounded-md shrink-0 flex items-center justify-center my-3" style={{ background: `${cor}22` }}>
        <Icone className="w-6 h-6" style={{ color: cor }} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 py-3">
        <p className="text-[13px] font-bold text-gv-ink truncate">{incidente.tipo}</p>
        <p className="text-[11px] text-gv-muted truncate">{incidente.resumo}</p>
        <p className="text-[11px] text-gv-cyan truncate">
          {incidente.horario ?? 'Agora mesmo'} · {incidente.origem ?? 'WhatsApp Cidadão'}
        </p>
      </div>
    </div>
  );
};
