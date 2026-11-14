import React from 'react';
import { Source, Layer } from 'react-map-gl';

/**
 * Prédios em 3D a partir do OpenStreetMap, com tiles vetoriais gratuitos do OpenFreeMap
 * (esquema OpenMapTiles, sem chave e sem faturamento).
 *
 * - Altura: `render_height` do OSM; sem altura informada, 6 m (casa térrea ou sobrado,
 *   o padrão do entorno da Av. dos Africanos).
 * - Cor: varia por prédio entre telha cerâmica, fibrocimento e laje clara, como na foto aérea
 *   do bairro, para não virar um bloco de cor única.
 * - Os prédios ficam semitransparentes e surgem com o zoom, para não esconder a rede de faixas.
 *
 * Limite: só aparecem os prédios que estão mapeados no OSM.
 */
const COR_POR_PREDIO = [
  'match',
  ['%', ['to-number', ['id'], 0], 6],
  0, '#c8704a', // telha cerâmica
  1, '#d38457', // telha cerâmica clara
  2, '#9aa1a8', // fibrocimento
  3, '#e8e2d6', // laje clara
  4, '#b9654a', // telha escura
  '#cfc6b8', // reboco
] as unknown as string;

const ALTURA = ['coalesce', ['get', 'render_height'], 6] as unknown as number;

export const Predios3DLayer: React.FC<{ visible: boolean }> = ({ visible }) => (
  <Source id="osm-predios" type="vector" url="https://tiles.openfreemap.org/planet">
    <Layer
      id="predios-3d"
      type="fill-extrusion"
      source-layer="building"
      minzoom={15}
      layout={{ visibility: visible ? 'visible' : 'none' }}
      paint={{
        // Prédios altos ficam um pouco mais acinzentados
        'fill-extrusion-color': [
          'case',
          ['>', ALTURA, 15],
          '#c3c9d4',
          COR_POR_PREDIO,
        ] as unknown as string,
        // "Cresce" do chão ao aproximar, como no Google Earth
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ALTURA] as unknown as number,
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] as unknown as number,
        'fill-extrusion-opacity': 0.88,
        'fill-extrusion-vertical-gradient': true,
      }}
    />
  </Source>
);
