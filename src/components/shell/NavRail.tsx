import React from 'react';
import { ShieldCheck, Map, Camera, SlidersHorizontal, FileBarChart } from 'lucide-react';

export type Tela = 'mapa' | 'cameras' | 'simular' | 'relatorios';

const ITENS: { id: Tela; rotulo: string; icone: React.ElementType }[] = [
  { id: 'mapa', rotulo: 'Mapa', icone: Map },
  { id: 'cameras', rotulo: 'Câmeras', icone: Camera },
  { id: 'simular', rotulo: 'Simular', icone: SlidersHorizontal },
  { id: 'relatorios', rotulo: 'Relatórios', icone: FileBarChart },
];

interface Props {
  atual: Tela;
  onMudar: (t: Tela) => void;
}

/** Barra de navegação fixa à esquerda (72px), igual às 3 telas do Figma. */
export const NavRail: React.FC<Props> = ({ atual, onMudar }) => (
  <nav aria-label="Navegação principal" className="w-[72px] shrink-0 h-full bg-gv-panel flex flex-col items-center gap-3 pt-4">
    <div className="w-8 h-8 rounded-lg bg-gv-cyan/15 border border-gv-cyan/40 flex items-center justify-center" title="Guardião Viário">
      <ShieldCheck className="w-5 h-5 text-gv-cyan" />
    </div>
    {ITENS.map((item) => {
      const Icone = item.icone;
      const ativo = item.id === atual;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onMudar(item.id)}
          aria-current={ativo ? 'page' : undefined}
          className={`flex flex-col items-center gap-1 py-2 rounded-xl w-14 transition-colors ${
            ativo ? 'bg-gv-cyan/15 text-gv-cyan' : 'text-gv-muted hover:text-gv-ink hover:bg-white/5'
          }`}
        >
          <Icone className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-semibold">{item.rotulo}</span>
        </button>
      );
    })}
  </nav>
);
