import React from 'react';
import { Source, Layer } from 'react-map-gl';
import { PALETA } from './sim/paleta';
import { IMG } from './sim/sprites';

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
 * Pintura da rede: asfalto, grama, faixas tracejadas, zebra e caixa hachurada.
 * O movimento proibido fica vermelho e tracejado. Os demais são finos.
 */
export const RedeLayer: React.FC<RedeLayerProps> = ({ visible }) => {
  const vis = visible ? 'visible' : 'none';
  const largura = ['interpolate', ['linear'], ['zoom'], 15, 0.7, 17, 1.3, 19, 2.2];
  return (
    <Source id="rede" type="geojson" data={REDE_URL}>
      <Layer
        id="rede-pistas"
        type="fill"
        filter={['==', ['get', 'tipo'], 'pista']}
        layout={{ visibility: vis }}
        paint={{ 'fill-pattern': IMG.asfalto, 'fill-opacity': 0.92 }}
      />
      <Layer
        id="rede-meiofio"
        type="line"
        filter={['==', ['get', 'tipo'], 'pista']}
        layout={{ visibility: vis, 'line-join': 'round' }}
        paint={{
          'line-color': PALETA.meioFio,
          'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.2, 19, 3.2],
          'line-opacity': 0.95,
        }}
      />
      <Layer
        id="rede-canteiro"
        type="fill"
        filter={['==', ['get', 'tipo'], 'canteiro']}
        layout={{ visibility: vis }}
        paint={{ 'fill-pattern': IMG.grama, 'fill-opacity': 0.92 }}
      />
      <Layer
        id="rede-aberturas"
        type="fill"
        filter={['==', ['get', 'tipo'], 'abertura']}
        layout={{ visibility: vis }}
        paint={{ 'fill-pattern': IMG.asfalto, 'fill-opacity': 0.96 }}
      />
      <Layer
        id="rede-caixas"
        type="fill"
        filter={['==', ['get', 'tipo'], 'caixa_amarela']}
        layout={{ visibility: vis }}
        paint={{ 'fill-pattern': IMG.hachura, 'fill-opacity': 0.9 }}
      />
      <Layer
        id="rede-faixas"
        type="line"
        filter={['==', ['get', 'tipo'], 'faixa']}
        layout={{ visibility: vis, 'line-cap': 'butt' }}
        paint={{
          'line-color': PALETA.faixa,
          'line-width': largura as unknown as number,
          'line-dasharray': [2, 1.6],
          'line-opacity': 0.95,
        }}
      />
      <Layer
        id="rede-setas"
        type="symbol"
        filter={['==', ['get', 'tipo'], 'faixa']}
        layout={{
          visibility: vis,
          'symbol-placement': 'line',
          'symbol-spacing': 110,
          'icon-image': IMG.seta,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.35, 19, 0.7],
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-allow-overlap': true,
        }}
      />
      <Layer
        id="rede-movimentos-proibidos"
        type="line"
        filter={['all', ['==', ['get', 'tipo'], 'movimento'], ['==', ['get', 'permitido'], false]]}
        layout={{ visibility: vis, 'line-cap': 'butt' }}
        paint={{ 'line-color': PALETA.infracao, 'line-width': 1.4, 'line-dasharray': [1.4, 1.1], 'line-opacity': 0.95 }}
      />
      <Layer
        id="rede-movimentos"
        type="line"
        filter={['all', ['==', ['get', 'tipo'], 'movimento'], ['==', ['get', 'permitido'], true]]}
        layout={{ visibility: vis, 'line-cap': 'round' }}
        paint={{ 'line-color': PALETA.movimento, 'line-width': 1.15, 'line-opacity': 0.8 }}
      />
      <Layer
        id="rede-travessias"
        type="line"
        filter={['==', ['get', 'tipo'], 'travessia']}
        layout={{ visibility: vis, 'line-cap': 'butt' }}
        paint={{
          'line-pattern': IMG.zebra,
          'line-width': ['interpolate', ['linear'], ['zoom'], 15, 8, 17, 16, 19, 28],
        }}
      />
    </Source>
  );
};
