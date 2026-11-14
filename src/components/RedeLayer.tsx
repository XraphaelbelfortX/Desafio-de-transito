import React from 'react';
import { Source, Layer } from 'react-map-gl';

/** Arquivo gerado por scripts/gera-rede.mjs. */
export const REDE_URL = '/data/rede.geojson';

/** Ids das camadas clicáveis (passar para `interactiveLayerIds` do <Map>). */
export const REDE_LAYER_IDS = [
  'rede-movimentos',
  'rede-movimentos-proibidos',
  'rede-faixas',
  'rede-travessias',
  'rede-aberturas',
  'rede-caixas',
] as const;

/** Rótulos legíveis para as propriedades mostradas no popup. */
export const ROTULO_TIPO: Record<string, string> = {
  pista: 'Pista',
  canteiro: 'Canteiro central',
  abertura: 'Abertura do canteiro',
  caixa_amarela: 'Caixa amarela',
  faixa: 'Faixa de rolamento',
  movimento: 'Movimento (conversão)',
  travessia: 'Travessia de pedestre',
};

interface RedeLayerProps {
  visible: boolean;
}

/**
 * Desenha a rede de faixas sobre o mapa: pistas, canteiro com as aberturas,
 * caixas amarelas, eixos das faixas, movimentos de conversão e travessias.
 *
 * Cores dos movimentos:
 *  - laranja grosso: conflito principal (esquerda saindo da VV)
 *  - verde: permitido pela sinalização
 *  - vermelho tracejado: proibido pela sinalização mas fisicamente possível (infração)
 */
export const RedeLayer: React.FC<RedeLayerProps> = ({ visible }) => {
  const vis = visible ? 'visible' : 'none';
  return (
    <Source id="rede" type="geojson" data={REDE_URL}>
      <Layer
        id="rede-pistas"
        type="fill"
        filter={['==', ['get', 'tipo'], 'pista']}
        layout={{ visibility: vis }}
        paint={{ 'fill-color': '#0f172a', 'fill-opacity': 0.25 }}
      />
      <Layer
        id="rede-canteiro"
        type="fill"
        filter={['==', ['get', 'tipo'], 'canteiro']}
        layout={{ visibility: vis }}
        paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.55 }}
      />
      <Layer
        id="rede-aberturas"
        type="fill"
        filter={['==', ['get', 'tipo'], 'abertura']}
        layout={{ visibility: vis }}
        paint={{ 'fill-color': '#f97316', 'fill-opacity': 0.35 }}
      />
      <Layer
        id="rede-caixas"
        type="fill"
        filter={['==', ['get', 'tipo'], 'caixa_amarela']}
        layout={{ visibility: vis }}
        paint={{ 'fill-color': '#facc15', 'fill-opacity': 0.35, 'fill-outline-color': '#facc15' }}
      />
      <Layer
        id="rede-faixas"
        type="line"
        filter={['==', ['get', 'tipo'], 'faixa']}
        layout={{ visibility: vis, 'line-cap': 'round' }}
        paint={{
          'line-color': [
            'match',
            ['get', 'sentido'],
            'oeste', '#38bdf8',
            'leste', '#a78bfa',
            '#e2e8f0',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 16, 1.5, 19, 4],
          'line-opacity': 0.9,
        }}
      />
      {/* Dois layers porque line-dasharray não aceita expressão por feição no MapLibre 4. */}
      <Layer
        id="rede-movimentos-proibidos"
        type="line"
        filter={['all', ['==', ['get', 'tipo'], 'movimento'], ['==', ['get', 'permitido'], false]]}
        layout={{ visibility: vis, 'line-cap': 'butt' }}
        paint={{ 'line-color': '#ef4444', 'line-width': 2.5, 'line-dasharray': [1.5, 1.2] }}
      />
      <Layer
        id="rede-movimentos"
        type="line"
        filter={['all', ['==', ['get', 'tipo'], 'movimento'], ['==', ['get', 'permitido'], true]]}
        layout={{ visibility: vis, 'line-cap': 'round' }}
        paint={{
          'line-color': ['case', ['==', ['get', 'principal'], true], '#f97316', '#4ade80'],
          'line-width': ['case', ['==', ['get', 'principal'], true], 5, 2.5],
        }}
      />
      <Layer
        id="rede-travessias"
        type="line"
        filter={['==', ['get', 'tipo'], 'travessia']}
        layout={{ visibility: vis }}
        paint={{ 'line-color': '#ffffff', 'line-width': 6, 'line-dasharray': [0.4, 0.4] }}
      />
    </Source>
  );
};
