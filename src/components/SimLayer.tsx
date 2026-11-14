import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl';
import type { AgenteEstado, Quadro } from '../sim';

/**
 * Desenha os agentes do motor (src/sim) sobre o mapa: cada veículo é um retângulo orientado
 * com o tamanho real (extrudado em 3D), pedestre é um ponto.
 * Vermelho = infração em andamento; amarelo = desistiu de infringir (viu fiscalização).
 */
export const SIM_LAYER_IDS = ['sim-veiculos', 'sim-pedestres'] as const;

const COR_TIPO: Record<string, string> = {
  carro: '#e2e8f0',
  app: '#a78bfa',
  moto: '#34d399',
  onibus: '#fb923c',
  pedestre: '#22d3ee',
};

const ALTURA: Record<string, number> = { carro: 1.5, app: 1.5, moto: 1.3, onibus: 3.2 };

function retangulo(a: AgenteEstado): [number, number][] {
  const [lon, lat] = a.pos;
  const r = (a.rumo * Math.PI) / 180;
  // vetores (leste, norte) da frente e da lateral
  const fx = Math.sin(r);
  const fy = Math.cos(r);
  const lx = Math.cos(r);
  const ly = -Math.sin(r);
  const mLat = 111320;
  const mLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const L = a.comprimento / 2;
  const W = a.largura / 2;
  const canto = (sl: number, sw: number): [number, number] => [lon + (fx * sl + lx * sw) / mLon, lat + (fy * sl + ly * sw) / mLat];
  return [canto(L, W), canto(L, -W), canto(-L, -W), canto(-L, W), canto(L, W)];
}

export const SimLayer: React.FC<{ quadro: Quadro | null; visible: boolean; selecionado: number | null }> = ({
  quadro,
  visible,
  selecionado,
}) => {
  const { veiculos, pedestres } = useMemo(() => {
    const ag = quadro?.agentes ?? [];
    const props = (a: AgenteEstado) => ({
      id: a.id,
      tipo: a.tipo,
      cor: a.infracao ? '#ef4444' : a.desistiu ? '#facc15' : COR_TIPO[a.tipo],
      altura: ALTURA[a.tipo] ?? 1.5,
      sel: a.id === selecionado ? 1 : 0,
    });
    return {
      veiculos: {
        type: 'FeatureCollection' as const,
        features: ag
          .filter((a) => a.tipo !== 'pedestre')
          .map((a) => ({ type: 'Feature' as const, id: a.id, properties: props(a), geometry: { type: 'Polygon' as const, coordinates: [retangulo(a)] } })),
      },
      pedestres: {
        type: 'FeatureCollection' as const,
        features: ag
          .filter((a) => a.tipo === 'pedestre')
          .map((a) => ({ type: 'Feature' as const, id: a.id, properties: props(a), geometry: { type: 'Point' as const, coordinates: a.pos } })),
      },
    };
  }, [quadro, selecionado]);

  const vis = visible ? 'visible' : 'none';
  return (
    <>
      <Source id="sim-veiculos-src" type="geojson" data={veiculos}>
        <Layer
          id="sim-veiculos"
          type="fill-extrusion"
          layout={{ visibility: vis }}
          paint={{
            'fill-extrusion-color': ['case', ['==', ['get', 'sel'], 1], '#38bdf8', ['get', 'cor']] as unknown as string,
            'fill-extrusion-height': ['get', 'altura'] as unknown as number,
            'fill-extrusion-base': 0.2,
            'fill-extrusion-opacity': 0.95,
          }}
        />
      </Source>
      <Source id="sim-pedestres-src" type="geojson" data={pedestres}>
        <Layer
          id="sim-pedestres"
          type="circle"
          layout={{ visibility: vis }}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 16, 2, 19, 5] as unknown as number,
            'circle-color': ['get', 'cor'] as unknown as string,
            'circle-stroke-color': '#0f172a',
            'circle-stroke-width': 1,
          }}
        />
      </Source>
    </>
  );
};
