import React, { useEffect, useRef } from 'react';
import { Layer, Source, useMap } from 'react-map-gl';
import type { GeoJSONSource, HeatmapLayerSpecification } from 'maplibre-gl';
import { paraGeo, type QuadroLocal } from '../../sim/geometria';
import type { Agente, Evento } from '../../sim/motor';
import type { Simulacao } from '../../sim/useSimulacao';
import type { Mancha } from './SeletorMancha';

/** Camadas que o clique do mapa pode acertar. Só entram em interactiveLayerIds com o mapa pronto. */
export const CAMADAS_AGENTES = ['sim-veiculos-alvo', 'sim-veiculos', 'sim-pedestres'] as const;

const VAZIO = { type: 'FeatureCollection' as const, features: [] };

const LARGURA: Record<string, number> = { carro: 1.8, moto: 0.9, onibus: 2.5 };
const ALTURA: Record<string, number> = { carro: 1.5, moto: 1.3, onibus: 3.1 };
const COR: Record<string, string> = {
  carro: '#f8fafc',
  moto: '#7dd3fc',
  onibus: '#c4b5fd',
  pedestre: '#fde047',
};
const COR_INFRATOR = '#ef4444';
const COR_SELECIONADO = '#22d3ee';
const BASE = 0.2;
const PULSO_MS = 1600;

type Colecao = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: Record<string, string | number | boolean>;
    geometry: { type: 'Polygon' | 'Point' | 'LineString'; coordinates: unknown };
  }[];
};

const corDoAgente = (tipo: string, infrator: boolean, selecionado: boolean) => {
  if (selecionado) return COR_SELECIONADO;
  if (infrator) return COR_INFRATOR;
  return COR[tipo] ?? COR.carro;
};

/** Retângulo do veículo: a frente está em (x, y) e o centro fica comp/2 atrás. */
const retangulo = (q: QuadroLocal, a: Agente): [number, number][] => {
  const dirX = Math.cos(a.ang);
  const dirY = Math.sin(a.ang);
  const meio = a.comp / 2;
  const meiaL = (LARGURA[a.tipo] ?? 1.8) / 2;
  const cx = a.x - dirX * meio;
  const cy = a.y - dirY * meio;
  const canto = (aoLongo: number, aoLado: number): [number, number] =>
    paraGeo(q, {
      x: cx + dirX * aoLongo - dirY * aoLado,
      y: cy + dirY * aoLongo + dirX * aoLado,
    });
  return [canto(meio, meiaL), canto(meio, -meiaL), canto(-meio, -meiaL), canto(-meio, meiaL), canto(meio, meiaL)];
};

const anel = (q: QuadroLocal, x: number, y: number, raio: number): [number, number][] => {
  const pts: [number, number][] = [];
  const n = 22;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    pts.push(paraGeo(q, { x: x + raio * Math.cos(a), y: y + raio * Math.sin(a) }));
  }
  return pts;
};

const pontos = (q: QuadroLocal, eventos: Evento[], tipo: Evento['tipo']): Colecao => ({
  type: 'FeatureCollection',
  features: eventos
    .filter((e) => e.tipo === tipo)
    .map((e) => ({
      type: 'Feature' as const,
      properties: { peso: e.peso },
      geometry: { type: 'Point' as const, coordinates: paraGeo(q, { x: e.x, y: e.y }) },
    })),
});

const enviar = (mapa: { getSource: (id: string) => unknown }, id: string, dados: Colecao) => {
  const fonte = mapa.getSource(id) as GeoJSONSource | undefined;
  fonte?.setData(dados as never);
};

const pinturaCalor = (paradas: (number | string)[]) =>
  ({
    'heatmap-weight': ['get', 'peso'],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 15, 1.4, 18, 2.4],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 15, 20, 17, 42, 19, 72],
    'heatmap-opacity': 0.9,
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...paradas],
  }) as HeatmapLayerSpecification['paint'];

interface Props {
  sim: Simulacao;
  mancha: Mancha;
  onCamadas: (prontas: boolean) => void;
  onPontos: (conflitos: number, infracoes: number) => void;
}

/**
 * Agentes, semáforos, pulsos e mancha da simulação.
 * O GeoJSON vai direto para a fonte do mapa: nada disso entra no estado do React.
 */
export const CamadaSimulacao: React.FC<Props> = ({ sim, mancha, onCamadas, onPontos }) => {
  const { current } = useMap();
  const selecionadoRef = useRef(sim.selecionadoId);
  const manchaRef = useRef(mancha);
  selecionadoRef.current = sim.selecionadoId;
  manchaRef.current = mancha;

  useEffect(() => {
    const mapa = current?.getMap();
    if (!mapa) return;
    let vivo = true;
    const verificar = () => {
      if (!vivo) return;
      onCamadas(Boolean(mapa.getLayer('sim-veiculos') && mapa.getLayer('sim-veiculos-alvo') && mapa.getLayer('sim-pedestres')));
    };
    verificar();
    mapa.on('idle', verificar);
    mapa.on('styledata', verificar);
    // o primeiro idle pode ocorrer antes da fonte existir; sem um novo idle o clique nunca é habilitado
    const id = window.setInterval(() => {
      verificar();
      if (mapa.getLayer('sim-veiculos') && mapa.getLayer('sim-pedestres')) window.clearInterval(id);
    }, 200);
    return () => {
      vivo = false;
      window.clearInterval(id);
      mapa.off('idle', verificar);
      mapa.off('styledata', verificar);
      onCamadas(false);
    };
  }, [current, onCamadas]);

  useEffect(() => {
    const mapa = current?.getMap();
    const rede = sim.rede;
    if (!mapa || !rede) return;
    const quadro = rede.quadro;
    let ultimoCalor = 0;
    let conflitosAntes = -1;
    let infracoesAntes = -1;

    const desenhar = () => {
      const motor = sim.motorRef.current;
      if (!motor) return;
      const agora = performance.now();
      const sel = selecionadoRef.current;
      const veiculos: Colecao = { type: 'FeatureCollection', features: [] };
      const pedestres: Colecao = { type: 'FeatureCollection', features: [] };
      // Alvo de clique invisível no centro de cada veículo (no 3D o prisma é difícil de acertar)
      const alvos: Colecao = { type: 'FeatureCollection', features: [] };

      for (const a of motor.agentes) {
        const cor = corDoAgente(a.tipo, a.infrator, a.id === sel);
        if (a.tipo === 'pedestre') {
          pedestres.features.push({
            type: 'Feature',
            properties: { id: a.id, cor },
            geometry: { type: 'Point', coordinates: paraGeo(quadro, { x: a.x, y: a.y }) },
          });
          continue;
        }
        veiculos.features.push({
          type: 'Feature',
          properties: { id: a.id, cor, altura: BASE + (ALTURA[a.tipo] ?? 1.5) },
          geometry: { type: 'Polygon', coordinates: [retangulo(quadro, a)] },
        });
        alvos.features.push({
          type: 'Feature',
          properties: { id: a.id },
          geometry: {
            type: 'Point',
            coordinates: paraGeo(quadro, { x: a.x - (Math.cos(a.ang) * a.comp) / 2, y: a.y - (Math.sin(a.ang) * a.comp) / 2 }),
          },
        });
      }

      const luzes: Colecao = {
        type: 'FeatureCollection',
        features: motor.luzes().map((l) => ({
          type: 'Feature' as const,
          properties: { cor: l.cor },
          geometry: { type: 'Point' as const, coordinates: paraGeo(quadro, { x: l.x, y: l.y }) },
        })),
      };

      const pulsos: Colecao = { type: 'FeatureCollection', features: [] };
      for (const p of sim.pulsos.current) {
        const idade = agora - p.realT;
        if (idade < 0 || idade >= PULSO_MS) continue;
        const t = idade / PULSO_MS;
        pulsos.features.push({
          type: 'Feature',
          properties: { opacidade: 1 - t, grave: p.grave },
          geometry: { type: 'LineString', coordinates: anel(quadro, p.x, p.y, 2.5 + t * 14) },
        });
      }

      enviar(mapa, 'sim-veiculos', veiculos);
      enviar(mapa, 'sim-veiculos-alvo', alvos);
      enviar(mapa, 'sim-pedestres', pedestres);
      enviar(mapa, 'sim-luzes', luzes);
      enviar(mapa, 'sim-pulsos', pulsos);

      if (agora - ultimoCalor > 500) {
        ultimoCalor = agora;
        const eventos = motor.eventos;
        const conflitos = pontos(quadro, eventos, 'conflito');
        const infracoes = pontos(quadro, eventos, 'infracao');
        enviar(mapa, 'sim-calor-conflitos', conflitos);
        enviar(mapa, 'sim-calor-infracoes', infracoes);
        if (conflitos.features.length !== conflitosAntes || infracoes.features.length !== infracoesAntes) {
          conflitosAntes = conflitos.features.length;
          infracoesAntes = infracoes.features.length;
          onPontos(conflitosAntes, infracoesAntes);
        }
      }
    };

    desenhar();
    return sim.assinar(desenhar);
  }, [current, onPontos, sim.assinar, sim.motorRef, sim.pulsos, sim.rede]);

  const visivel = (qual: Mancha) => (mancha === qual ? 'visible' : 'none') as 'visible' | 'none';

  return (
    <>
      <Source id="sim-calor-conflitos" type="geojson" data={VAZIO}>
        <Layer
          id="sim-calor-conflito"
          type="heatmap"
          layout={{ visibility: visivel('conflitos') }}
          paint={pinturaCalor([
            0, 'rgba(251, 146, 60, 0)',
            0.05, 'rgba(251, 146, 60, 0.55)',
            0.18, 'rgba(249, 115, 22, 0.75)',
            0.4, 'rgba(220, 38, 38, 0.9)',
            0.7, 'rgba(127, 29, 29, 0.96)',
            1, 'rgba(69, 10, 10, 1)',
          ])}
        />
      </Source>
      <Source id="sim-calor-infracoes" type="geojson" data={VAZIO}>
        <Layer
          id="sim-calor-infracao"
          type="heatmap"
          layout={{ visibility: visivel('infracoes') }}
          paint={pinturaCalor([
            0, 'rgba(244, 114, 182, 0)',
            0.05, 'rgba(244, 114, 182, 0.55)',
            0.2, 'rgba(219, 39, 119, 0.78)',
            0.45, 'rgba(147, 51, 234, 0.9)',
            0.75, 'rgba(88, 28, 135, 0.96)',
            1, 'rgba(59, 7, 100, 1)',
          ])}
        />
      </Source>

      <Source id="sim-veiculos" type="geojson" data={VAZIO}>
        <Layer
          id="sim-veiculos"
          type="fill-extrusion"
          paint={{
            'fill-extrusion-color': ['get', 'cor'],
            'fill-extrusion-height': ['get', 'altura'],
            'fill-extrusion-base': BASE,
            'fill-extrusion-opacity': 0.96,
          }}
        />
      </Source>

      <Source id="sim-veiculos-alvo" type="geojson" data={VAZIO}>
        <Layer
          id="sim-veiculos-alvo"
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-opacity': 0.01, 'circle-color': '#000000', 'circle-pitch-alignment': 'viewport' }}
        />
      </Source>
      <Source id="sim-pedestres" type="geojson" data={VAZIO}>
        <Layer
          id="sim-pedestres"
          type="circle"
          paint={{
            'circle-color': ['get', 'cor'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3.5, 18, 6.5, 20, 10],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#0f172a',
            'circle-pitch-alignment': 'map',
          }}
        />
      </Source>

      <Source id="sim-luzes" type="geojson" data={VAZIO}>
        <Layer
          id="sim-luzes"
          type="circle"
          paint={{
            'circle-color': ['match', ['get', 'cor'], 'verde', '#22c55e', 'amarelo', '#facc15', 'vermelho', '#ef4444', '#94a3b8'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 16, 3, 19, 6.5],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#0f172a',
            'circle-pitch-alignment': 'map',
          }}
        />
      </Source>

      <Source id="sim-pulsos" type="geojson" data={VAZIO}>
        <Layer
          id="sim-pulsos"
          type="line"
          paint={{
            'line-color': ['case', ['get', 'grave'], '#ef4444', '#fb923c'],
            'line-width': 2,
            'line-opacity': ['get', 'opacidade'],
          }}
        />
      </Source>
    </>
  );
};
