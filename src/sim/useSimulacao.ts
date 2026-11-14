/**
 * Hook React para a tela usar o motor (em Web Worker).
 *
 *   const sim = useSimulacao();
 *   sim.iniciar({ semente: 42, horario: 'pico_tarde', intervencoes: [] });
 *   sim.rodar(); sim.pausar(); sim.setVelocidade(5);
 *   sim.quadro?.agentes  -> desenhar
 *   sim.selecionar(id); sim.detalhe -> painel do agente
 *   sim.comparar([...]) -> sim.comparacao (ranking)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgenteDetalhe, ConfigCenario, Intervencao, Quadro } from './tipos';
import type { ResultadoComparado } from './cenarios';
import { REDE_URL } from './constantes';

export function useSimulacao() {
  const worker = useRef<Worker | null>(null);
  const geojson = useRef<unknown>(null);
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [detalhe, setDetalhe] = useState<AgenteDetalhe | null>(null);
  const [rodando, setRodando] = useState(false);
  const [velocidade, setVelocidadeEstado] = useState(1);
  const [comparacao, setComparacao] = useState<ResultadoComparado[] | null>(null);
  const [comparando, setComparando] = useState(false);
  const [eventos, setEventos] = useState<Quadro['eventos']>([]);

  useEffect(() => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.tipo === 'quadro') {
        setQuadro(m.quadro);
        if (m.quadro.eventos.length) setEventos((ev) => [...m.quadro.eventos.slice(-20).reverse(), ...ev].slice(0, 40));
      } else if (m.tipo === 'detalhe') setDetalhe(m.detalhe);
      else if (m.tipo === 'comparacao') {
        setComparacao(m.resultados);
        setComparando(false);
      }
    };
    return () => w.terminate();
  }, []);

  const iniciar = useCallback(async (config: ConfigCenario) => {
    if (!geojson.current) geojson.current = await (await fetch(REDE_URL)).json();
    worker.current?.postMessage({ tipo: 'iniciar', geojson: geojson.current, config });
    setEventos([]);
    setDetalhe(null);
  }, []);

  const rodar = useCallback(() => {
    worker.current?.postMessage({ tipo: 'rodar' });
    setRodando(true);
  }, []);
  const pausar = useCallback(() => {
    worker.current?.postMessage({ tipo: 'pausar' });
    setRodando(false);
  }, []);
  const setVelocidade = useCallback((fator: number) => {
    worker.current?.postMessage({ tipo: 'velocidade', fator });
    setVelocidadeEstado(fator);
  }, []);
  const aplicarIntervencoes = useCallback((lista: Intervencao[]) => {
    worker.current?.postMessage({ tipo: 'intervencoes', lista });
  }, []);
  const selecionar = useCallback((id: number | null) => {
    if (id === null) setDetalhe(null);
    else worker.current?.postMessage({ tipo: 'detalhe', id });
  }, []);
  const comparar = useCallback(async (cenarios: { nome: string; config: ConfigCenario }[], duracaoS = 1800) => {
    if (!geojson.current) geojson.current = await (await fetch(REDE_URL)).json();
    setComparando(true);
    setComparacao(null);
    worker.current?.postMessage({ tipo: 'comparar', cenarios, duracaoS });
  }, []);

  return {
    quadro,
    detalhe,
    eventos,
    rodando,
    velocidade,
    comparacao,
    comparando,
    iniciar,
    rodar,
    pausar,
    setVelocidade,
    aplicarIntervencoes,
    selecionar,
    comparar,
  };
}
