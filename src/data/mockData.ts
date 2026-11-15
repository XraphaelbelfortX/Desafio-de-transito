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
 * Alertas (quase-acidentes) posicionados exclusivamente no cruzamento da
 * Av. dos Africanos com a Av. Vicente Venâncio de Queiroga / Rua Minerva
 */
export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-v2-001',
    lat: -2.55498,
    lng: -44.27049,
    tipo: 'Quase-Atropelamento de Ciclista no Cruzamento Central',
    severidade: 'critica',
    resumo:
      'Caminhão baú fechou ciclista na travessia central entre as duas pistas da Av. dos Africanos com a Av. Vicente Venâncio de Queiroga.',
    horario: 'Hoje, 07:18',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 1.0,
  },
  {
    id: 'inc-v2-002',
    lat: -2.55508,
    lng: -44.27058,
    tipo: 'Conflito Veículo × Pedestre (Pista Sul)',
    severidade: 'critica',
    resumo:
      'Pedestre precisou correr ao atravessar a chegada da Av. Vicente Venâncio de Queiroga na pista sul da Av. dos Africanos.',
    horario: 'Hoje, 07:45',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 1.0,
  },
  {
    id: 'inc-v2-003',
    lat: -2.55488,
    lng: -44.27039,
    tipo: 'Frenagem Brusca na Pista Norte (Acesso Rua Minerva)',
    severidade: 'critica',
    resumo:
      'Motociclista derrapou ao desviar de carro atravessando a pista norte da Av. dos Africanos em direção à Rua Minerva.',
    horario: 'Hoje, 08:12',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 1.0,
  },
  {
    id: 'inc-v2-004',
    lat: -2.55489,
    lng: -44.27065,
    tipo: 'Conflito Crítico na Agulha de Retorno',
    severidade: 'alta',
    resumo:
      'Veículos fazendo retorno diagonal em alta velocidade entre as duas pistas da Av. dos Africanos sem tachões redutores.',
    horario: 'Ontem, 18:20',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 0.95,
  },
  {
    id: 'inc-v2-005',
    lat: -2.55507,
    lng: -44.27035,
    tipo: 'Excesso de Velocidade e Invasão do Canteiro/Ciclovia',
    severidade: 'critica',
    resumo:
      'Carros e motos cortando o cruzamento da Av. dos Africanos com a Vicente Venâncio de Queiroga acima de 60 km/h sem segregação.',
    horario: 'Ontem, 19:05',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 1.0,
  },
  {
    id: 'inc-v2-006',
    lat: -2.55501,
    lng: -44.27060,
    tipo: 'Fechada em Conversão à Esquerda',
    severidade: 'alta',
    resumo:
      'Van escolar precisou frear bruscamente para evitar colisão lateral com carro saindo da Vicente Venâncio de Queiroga.',
    horario: 'Ontem, 17:40',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 0.95,
  },
];


export const CITIZEN_AUDIO_PRESETS = [
  '“Rapaz, quase todo dia tem acidente aqui no cruzamento da Av. dos Africanos com a Vicente Venâncio de Queiroga! Agora mesmo uma caminhonete quase levou um ciclista no retorno.”',
  '“Alô SMTT, os carros dobram rasgando da Av. dos Africanos pra Vicente Venâncio de Queiroga e Rua Minerva, não tem tartaruga nem calçada avançada, quase atropelaram um pedestre!”',
  '“Motoqueiro acabou de frear no limite aqui entre as duas pistas da Av. dos Africanos com a Vicente Venâncio de Queiroga, precisa pintar a ciclofaixa vermelha urgente!”',
];
