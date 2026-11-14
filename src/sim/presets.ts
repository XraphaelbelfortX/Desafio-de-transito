/**
 * Intervenções prontas, com posição no cruzamento (para testar sem arrastar nada no mapa).
 * A tela pode oferecer estas e também deixar o usuário soltar câmera/radar/lombada onde quiser.
 */
import { criarProjecao } from './geo';
import type { ConfigCenario, Intervencao } from './tipos';

// mesma âncora e rumo de scripts/gera-rede.mjs
const proj = criarProjecao({ lat: -2.55498, lon: -44.27049 }, -32);
const P = (x: number, y: number) => proj.paraGeo([x, y]);

export interface Preset {
  id: string;
  nome: string;
  descricao: string;
  intervencao: Intervencao;
}

export const PRESETS: Preset[] = [
  { id: 'camera_vv', nome: 'Câmera na VV', descricao: 'Fiscaliza caixa, conversão, retorno e sinal num raio de 60 m', intervencao: { id: 'camera_vv', tipo: 'camera', pos: P(0, 0), raio: 60 } },
  { id: 'agente_vv', nome: 'Agente de trânsito', descricao: 'Fiscalização humana por 15 min', intervencao: { id: 'agente_vv', tipo: 'agente_transito', pos: P(0, 0), raio: 60, duracao: 900 } },
  { id: 'radar', nome: 'Radar', descricao: 'Velocidade, 80 m a oeste da VV', intervencao: { id: 'radar', tipo: 'radar', pos: P(-80, 0), raio: 60 } },
  { id: 'semaforo', nome: 'Semáforo na VV', descricao: 'Ciclo 90 s, 50 s de verde para a Africanos', intervencao: { id: 'semaforo', tipo: 'semaforo', semaforo: { ciclo: 90, verdePrincipal: 50, amarelo: 3, botoeira: true } } },
  { id: 'fechar_vv', nome: 'Fechar canteiro (VV)', descricao: 'Ninguém mais cruza ou retorna em frente à VV', intervencao: { id: 'fechar_vv', tipo: 'fechar_abertura_vv' } },
  { id: 'fechar_norte', nome: 'Fechar canteiro (norte)', descricao: 'Fecha a abertura 140 m a oeste', intervencao: { id: 'fechar_norte', tipo: 'fechar_abertura_norte' } },
  { id: 'gota', nome: 'Retorno em gota', descricao: 'Retorno protegido 150 m a leste', intervencao: { id: 'gota', tipo: 'retorno_gota' } },
  { id: 'tachoes_vv', nome: 'Tachões na VV', descricao: 'Canalização: impede retorno, conversão e corredor ali', intervencao: { id: 'tachoes_vv', tipo: 'tachoes', pos: P(0, 0), raio: 30 } },
  { id: 'faixa_elevada', nome: 'Faixa elevada', descricao: 'Travessia elevada na VV (carros a 30 km/h)', intervencao: { id: 'faixa_elevada', tipo: 'faixa_elevada', pos: P(0, 0) } },
  { id: 'refugio', nome: 'Refúgio no canteiro', descricao: 'Pedestre atravessa em dois tempos na VV', intervencao: { id: 'refugio', tipo: 'refugio_pedestre', pos: P(0, 0) } },
  { id: 'lombada_vv', nome: 'Lombada na VV', descricao: 'Na Vicente Venâncio, 50 m antes do cruzamento', intervencao: { id: 'lombada_vv', tipo: 'lombada', pos: P(0, -50) } },
  { id: 'pintura', nome: 'Pintura e placas', descricao: 'Sinalização reforçada (efeito moderado)', intervencao: { id: 'pintura', tipo: 'pintura' } },
  { id: 'baia', nome: 'Baia de ônibus', descricao: 'No ponto 60 m a leste da VV', intervencao: { id: 'baia', tipo: 'baia_onibus', pos: P(60, -13) } },
];

export const intervencaoDe = (id: string) => PRESETS.find((p) => p.id === id)!.intervencao;

/** Cenários do roteiro da demonstração (todos com a mesma semente). */
export function cenariosDemo(base: Omit<ConfigCenario, 'intervencoes'>, atual?: Intervencao[]) {
  const c = (nome: string, ids: string[]) => ({ nome, config: { ...base, intervencoes: ids.map(intervencaoDe) } });
  const lista = [
    c('Hoje (sem nada)', []),
    c('Câmera na VV', ['camera_vv']),
    c('Canteiro fechado + retorno em gota', ['fechar_vv', 'gota']),
    c('Semáforo na VV', ['semaforo']),
    c('Tachões + pintura', ['tachoes_vv', 'pintura']),
  ];
  if (atual && atual.length) lista.push({ nome: 'Configuração atual', config: { ...base, intervencoes: atual } });
  return lista;
}
