import { Incident, Intervention } from '../types';

/**
 * Coordenadas exatas do cruzamento real da Av. dos Africanos com a Av. Vicente Venâncio de Queiroga
 * (Coroado / Parque Timbiras, São Luís - MA)
 */
export const INTERSECTION_CENTER = {
  lat: -2.55556,
  lng: -44.27128,
  zoom: 17.5,
  label: 'Av. dos Africanos × Av. Vicente Venâncio de Queiroga (São Luís - MA)',
};

/**
 * Incidentes concentrados exatamente no entroncamento da Av. dos Africanos
 * com a Av. Vicente Venâncio de Queiroga para formar o núcleo crítico do Heatmap na intersecção
 */
export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    lat: -2.55556,
    lng: -44.27128,
    tipo: 'Quase-Atropelamento de Ciclista',
    severidade: 'critica',
    resumo:
      'Caminhão baú fechou ciclista ao fazer conversão rápida da Av. dos Africanos para a Av. Vicente Venâncio de Queiroga sem segregação física.',
    horario: 'Hoje, 07:18',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 1.0,
  },
  {
    id: 'inc-002',
    lat: -2.55561,
    lng: -44.27125,
    tipo: 'Conflito Veículo × Pedestre na Esquina',
    severidade: 'critica',
    resumo:
      'Pedestre precisou correr no meio da travessia na boca da Av. Vicente Venâncio de Queiroga devido ao raio de giro aberto e alta velocidade.',
    horario: 'Hoje, 07:45',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 1.0,
  },
  {
    id: 'inc-003',
    lat: -2.55552,
    lng: -44.27133,
    tipo: 'Frenagem Brusca / Quase-Colisão Traseira',
    severidade: 'alta',
    resumo:
      'Motociclista derrapou ao desviar de carro dobrando repentinamente da Av. dos Africanos para a Vicente Venâncio de Queiroga.',
    horario: 'Hoje, 08:12',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 0.95,
  },
  {
    id: 'inc-004',
    lat: -2.55558,
    lng: -44.27121,
    tipo: 'Invasão de Bordo de Pista no Cruzamento',
    severidade: 'alta',
    resumo:
      'Vans e carros cortando pelo bordo direito na entrada da Vicente Venâncio de Queiroga, gerando risco direto a ciclistas e moradores.',
    horario: 'Ontem, 18:20',
    origem: 'WhatsApp Cidadão',
    pesoHeatmap: 0.9,
  },
  {
    id: 'inc-005',
    lat: -2.55566,
    lng: -44.27123,
    tipo: 'Excesso de Velocidade em Conversão',
    severidade: 'critica',
    resumo:
      'Veículos entram na Av. Vicente Venâncio de Queiroga acima de 60 km/h por falta de estreitamento físico (neckdown) ou tachões redutores.',
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
      'Implantação de tachões bidirecionais refletivos na linha de aproximação e bordo de conversão para a Vicente Venâncio de Queiroga.',
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
      'Demarcação termoplástica vermelha de alto contraste cruzando o entroncamento da Av. dos Africanos × Vicente Venâncio de Queiroga.',
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
      'Ampliação geométrica das esquinas na entrada da Av. Vicente Venâncio de Queiroga, reduzindo o raio de giro e encurtando a travessia em 42%.',
  },
];

export const CITIZEN_AUDIO_PRESETS = [
  '“Rapaz, quase todo dia tem acidente aqui no cruzamento da Av. dos Africanos com a Vicente Venâncio de Queiroga! Agora mesmo uma caminhonete quase levou um ciclista.”',
  '“Alô SMTT, os carros dobram rasgando da Av. dos Africanos pra Vicente Venâncio de Queiroga, não tem tartaruga nem calçada avançada, quase atropelaram um pedestre!”',
  '“Motoqueiro acabou de frear no limite aqui na esquina da Vicente Venâncio de Queiroga com os Africanos, precisa pintar a ciclofaixa vermelha urgente!”',
];
