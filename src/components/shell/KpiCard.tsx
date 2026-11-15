import React from 'react';

interface Props {
  rotulo: string;
  valor: string;
  variacao?: string;
  corVariacao?: 'red' | 'green' | 'amber' | 'cyan';
  className?: string;
}

const COR_VARIACAO: Record<NonNullable<Props['corVariacao']>, string> = {
  red: 'text-gv-red',
  green: 'text-gv-green',
  amber: 'text-gv-amber',
  cyan: 'text-gv-cyan',
};

/** Cartão numérico do topo das telas (Mapa de Alerta / SimCity), igual ao componente do Figma. */
export const KpiCard: React.FC<Props> = ({ rotulo, valor, variacao, corVariacao = 'red', className }) => (
  <div className={`bg-gv-panel border border-gv-border rounded-xl px-4 py-3.5 flex flex-col gap-1.5 min-w-[180px] ${className ?? ''}`}>
    <span className="text-xs font-medium text-gv-muted">{rotulo}</span>
    <span className="text-2xl font-bold text-gv-ink tabular-nums leading-none">{valor}</span>
    {variacao && <span className={`text-[11px] font-semibold ${COR_VARIACAO[corVariacao]}`}>{variacao}</span>}
  </div>
);
