import { Incident } from '../types';

/**
 * Coordenadas exatas do cruzamento das duas pistas da Av. dos Africanos
 * com a Av. Vicente Venâncio de Queiroga / Rua Minerva e retorno central
 */
export const INTERSECTION_CENTER = {
  lat: -2.55498,
  lng: -44.27049,
  zoom: 18.0,
  label: 'Av. dos Africanos × Av. Vicente Venâncio de Queiroga (São Luís - MA)',
};

/**
 * Ocorrências registradas no cruzamento (exemplos para a demonstração): agente da SMTT,
 * câmera CAM-01 e registros oficiais. Não mudam com a simulação.
 */
export const OCORRENCIAS: Incident[] = [
  {
    id: 'oc-001',
    lat: -2.55498,
    lng: -44.27049,
    tipo: 'Quase-atropelamento de ciclista no cruzamento central',
    severidade: 'critica',
    resumo: 'Caminhão baú fechou ciclista na travessia central entre as duas pistas da Av. dos Africanos.',
    horario: 'Hoje, 07:18',
    origem: 'Câmera CAM-01',
    pesoHeatmap: 1.0,
  },
  {
    id: 'oc-002',
    lat: -2.55508,
    lng: -44.27058,
    tipo: 'Conflito veículo × pedestre (pista sul)',
    severidade: 'critica',
    resumo: 'Pedestre precisou correr ao atravessar a chegada da Vicente Venâncio na pista sul da Av. dos Africanos.',
    horario: 'Hoje, 07:45',
    origem: 'Agente SMTT',
    pesoHeatmap: 1.0,
  },
  {
    id: 'oc-003',
    lat: -2.55488,
    lng: -44.27039,
    tipo: 'Frenagem brusca na pista norte (acesso Rua Minerva)',
    severidade: 'critica',
    resumo: 'Motociclista derrapou ao desviar de carro que atravessava a pista norte em direção à Rua Minerva.',
    horario: 'Hoje, 08:12',
    origem: 'Câmera CAM-01',
    pesoHeatmap: 1.0,
  },
  {
    id: 'oc-004',
    lat: -2.55489,
    lng: -44.27065,
    tipo: 'Conflito na agulha de retorno',
    severidade: 'alta',
    resumo: 'Veículos fazendo retorno diagonal em alta velocidade entre as duas pistas, sem tachões.',
    horario: 'Ontem, 18:20',
    origem: 'Registro SMTT',
    pesoHeatmap: 0.95,
  },
  {
    id: 'oc-005',
    lat: -2.55507,
    lng: -44.27035,
    tipo: 'Excesso de velocidade no cruzamento',
    severidade: 'critica',
    resumo: 'Carros e motos cruzando acima de 60 km/h, sem segregação.',
    horario: 'Ontem, 19:05',
    origem: 'Câmera CAM-01',
    pesoHeatmap: 1.0,
  },
  {
    id: 'oc-006',
    lat: -2.55501,
    lng: -44.2706,
    tipo: 'Fechada em conversão à esquerda',
    severidade: 'alta',
    resumo: 'Van escolar freou bruscamente para evitar colisão lateral com carro saindo da Vicente Venâncio.',
    horario: 'Ontem, 17:40',
    origem: 'Agente SMTT',
    pesoHeatmap: 0.95,
  },
];
