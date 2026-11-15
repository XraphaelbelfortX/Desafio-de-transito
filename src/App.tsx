import React, { useState } from 'react';
import { OCORRENCIAS } from './data/mockData';
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

  // Simulação por agentes: intervenções, tempo, agentes e cenários
  const sim = useSimulacao();
  const assistente = useAssistente(sim);

  const [isStreetViewOpen, setIsStreetViewOpen] = useState<boolean>(false);
  const abrirStreetView = () => setIsStreetViewOpen(true);

  return (
    <div className="h-screen overflow-hidden bg-gv-bg text-gv-ink flex">
      <NavRail atual={tela} onMudar={setTela} />

      <main className="flex-1 min-w-0 min-h-0">
        {tela === 'mapa' && (
          <TelaMapaAlerta sim={sim} assistente={assistente} incidents={OCORRENCIAS} onOpenStreetView={abrirStreetView} onNavegar={setTela} />
        )}
        {tela === 'cameras' && <TelaCameras onNavegar={setTela} />}
        {tela === 'simular' && <TelaSimulacao sim={sim} assistente={assistente} incidents={OCORRENCIAS} onOpenStreetView={abrirStreetView} />}
        {tela === 'relatorios' && <TelaRelatorios sim={sim} incidents={OCORRENCIAS} onNavegar={setTela} />}
      </main>

      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        incidents={OCORRENCIAS}
        intervencoesReais={sim.intervencoes}
      />
    </div>
  );
}

export default App;
