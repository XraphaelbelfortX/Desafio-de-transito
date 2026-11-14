import { Incident, Intervention } from '../types';

/**
 * Coordenadas exatas do centro do círculo vermelho:
 * Cruzamento das duas pistas da Av. dos Africanos com a Av. Vicente Venâncio de Queiroga / Rua Minerva e retorno central
 */
export const INTERSECTION_CENTER = {
  lat: -2.55498,
  lng: -44.27049,
  zoom: 17.8,
  label: 'Av. dos Africanos × Av. Vicente Venâncio de Queiroga (São Luís - MA)',
};

/**
 * 5 incidentes iniciais posicionados exatamente dentro do perímetro do círculo vermelho
 * (Pista Sul, Canteiro Central, Pista Norte e Retorno Diagonal da Av. dos Africanos × Vicente Venâncio de Queiroga)
 */
export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
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
    id: 'inc-002',
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
    id: 'inc-003',
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
    id: 'inc-004',
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
    id: 'inc-005',
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
];

/**
 * Catálogo de Intervenções (Base SINAPI/NACTO) - Fixos no código conforme especificação
 */
export const INTERVENTIONS_CATALOG: Intervention[] = [
  {
    id: 'tachao',
    nome: 'Tachões Refletivos (Tartarugas)',
    custo: 4500,
    reducaoRisco: 45,
    tempoDias: 1,
    icon: 'ShieldAlert',
    codigoSinapi: 'SINAPI 102514',
    normaReferencia: 'CONTRAN 973/22 • Segregação Física',
    descricaoTatica:
      'Implantação de tachões bidirecionais refletivos na agulha de retorno e nas duas pistas do cruzamento com a Vicente Venâncio de Queiroga.',
  },
  {
    id: 'ciclofaixa',
    nome: 'Pintura Ciclofaixa Vermelha',
    custo: 12000,
    reducaoRisco: 60,
    tempoDias: 3,
    icon: 'Bike',
    codigoSinapi: 'SINAPI 92984',
    normaReferencia: 'NACTO Transit Street • Conflito Zero',
    descricaoTatica:
      'Demarcação termoplástica vermelha de alto contraste no canteiro central e na travessia da Av. dos Africanos × Vicente Venâncio de Queiroga.',
  },
  {
    id: 'neckdown',
    nome: 'Avanço de Calçada (Neckdown)',
    custo: 25000,
    reducaoRisco: 75,
    tempoDias: 15,
    icon: 'Snail',
    codigoSinapi: 'SINAPI 94273',
    normaReferencia: 'NACTO Urban Street Design Guide',
    descricaoTatica:
      'Ampliação geométrica das esquinas nas duas pistas da Av. dos Africanos com a Vicente Venâncio de Queiroga, encurtando a travessia em 42%.',
  },
];

export const CITIZEN_AUDIO_PRESETS = [
  '“Rapaz, quase todo dia tem acidente aqui no cruzamento da Av. dos Africanos com a Vicente Venâncio de Queiroga! Agora mesmo uma caminhonete quase levou um ciclista no retorno.”',
  '“Alô SMTT, os carros dobram rasgando da Av. dos Africanos pra Vicente Venâncio de Queiroga e Rua Minerva, não tem tartaruga nem calçada avançada, quase atropelaram um pedestre!”',
  '“Motoqueiro acabou de frear no limite aqui entre as duas pistas da Av. dos Africanos com a Vicente Venâncio de Queiroga, precisa pintar a ciclofaixa vermelha urgente!”',
];
