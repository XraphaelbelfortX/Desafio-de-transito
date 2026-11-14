/**
 * CONTRATO DO MOTOR DE SIMULAÇÃO (src/sim)
 * ========================================
 * Este arquivo é a fronteira entre o motor (Elias) e a tela (Raphael).
 * A tela só precisa destes tipos e de `criarSimulacao` / `rodarCenario` (ver index.ts).
 * Um motor futuro em SUMO + TraCI (via FastAPI/WebSocket) deve devolver exatamente
 * estas mesmas estruturas, para a tela não mudar.
 *
 * Unidades: tempo em segundos de simulação, distâncias em metros, velocidades em m/s
 * (exceto onde o nome diz km/h). Posições para desenhar vêm em [lon, lat].
 */

// ------------------------------------------------------------------ AGENTES

export type TipoAgente = 'carro' | 'moto' | 'onibus' | 'app' | 'pedestre';

/** As infrações que a IA dos motoristas pode tentar. */
export type TipoInfracao =
  | 'caixa_amarela' // entrar na caixa "não feche o cruzamento" sem espaço para sair
  | 'conversao_proibida' // esquerda proibida pela abertura do canteiro
  | 'retorno_proibido' // retorno pela abertura do canteiro (furar o canteiro)
  | 'avanco_sinal' // passar no amarelo/vermelho
  | 'excesso_velocidade'
  | 'moto_corredor' // moto entre as faixas (corredor)
  | 'parada_irregular' // ônibus/app parando na faixa, fora da baia
  | 'pedestre_fora_faixa';

export const NOMES_INFRACAO: Record<TipoInfracao, string> = {
  caixa_amarela: 'Fechou a caixa amarela',
  conversao_proibida: 'Conversão à esquerda proibida',
  retorno_proibido: 'Retorno proibido pelo canteiro',
  avanco_sinal: 'Avançou o sinal',
  excesso_velocidade: 'Excesso de velocidade',
  moto_corredor: 'Moto no corredor',
  parada_irregular: 'Parada fora da baia',
  pedestre_fora_faixa: 'Pedestre fora da faixa',
};

/** Perfil de cada motorista/pedestre (0 a 1). */
export interface Perfil {
  pressa: number; // quanto valoriza ganhar tempo
  obediencia: number; // tendência a seguir a regra mesmo sem fiscalização
  aversaoRisco: number; // quanto evita manobras perigosas
}

/** Explicação da última decisão relevante do agente (para o painel ao clicar). */
export interface Decisao {
  tempo: number; // instante da simulação
  infracao: TipoInfracao;
  infringiu: boolean;
  ganhoTempoS: number; // segundos que ganharia infringindo
  chanceFiscalizacao: number; // 0..1 no local
  risco: number; // 0..1 risco físico percebido
  pressaoSocial: number; // 0..1 efeito manada naquele tipo de infração
  probabilidade: number; // 0..1 chance final de infringir
  motivo: string; // frase pronta em português
}

/** Estado de um agente num instante (o que a tela desenha). */
export interface AgenteEstado {
  id: number;
  tipo: TipoAgente;
  pos: [number, number]; // [lon, lat]
  rumo: number; // graus, sentido horário a partir do norte (para girar o ícone)
  velKmh: number;
  comprimento: number; // m
  largura: number; // m
  /** Infração em andamento (desenhar em vermelho) ou null. */
  infracao: TipoInfracao | null;
  /** Tentou infringir e desistiu (ex.: viu a câmera) — destacar em amarelo por alguns segundos. */
  desistiu: boolean;
  parado: boolean;
  origem: string; // ex.: 'vv', 'africanos_leste'
  destino: string;
}

/** Detalhe completo de um agente (pedido sob demanda ao clicar). */
export interface AgenteDetalhe extends AgenteEstado {
  perfil: Perfil;
  decisoes: Decisao[]; // mais recente primeiro
  tempoNaRede: number;
  movimento: string; // id do movimento/rota
}

// ------------------------------------------------------------- INTERVENÇÕES

export type TipoIntervencao =
  | 'camera' // fiscalização eletrônica de infrações (caixa, conversão, sinal, parada)
  | 'radar' // fiscalização de velocidade
  | 'agente_transito' // fiscalização humana temporária (todas as infrações)
  | 'semaforo' // semáforo no cruzamento da VV
  | 'fechar_abertura_vv' // fecha a abertura do canteiro em frente à VV
  | 'fechar_abertura_norte'
  | 'retorno_gota' // retorno protegido a leste (Africanos Livre)
  | 'tachoes' // canalização: impede o corredor e os retornos no ponto
  | 'lombada'
  | 'faixa_elevada' // travessia elevada (reduz velocidade e dá prioridade ao pedestre)
  | 'refugio_pedestre' // refúgio no canteiro: travessia em 2 tempos
  | 'pintura' // sinalização/pintura: efeito moderado na obediência
  | 'baia_onibus'; // baia para ônibus/app parar fora da faixa

export interface Intervencao {
  id: string; // único, definido pela tela
  tipo: TipoIntervencao;
  /** Onde foi solta no mapa ([lon, lat]). Obrigatório para as pontuais (câmera, radar, agente, lombada...). */
  pos?: [number, number];
  /** Raio de efeito em metros (câmera, radar, agente). Padrão: 60. */
  raio?: number;
  /** Agente de trânsito: por quanto tempo fica (s). Padrão: 900. */
  duracao?: number;
  /** Semáforo: tempos em segundos. */
  semaforo?: {
    ciclo: number; // padrão 90
    verdePrincipal: number; // Africanos; padrão 50
    amarelo: number; // padrão 3
    botoeira: boolean; // fase de pedestre sob demanda
  };
}

// ------------------------------------------------------------------ CENÁRIO

export type Horario = 'pico_manha' | 'pico_tarde' | 'fora_pico';

export interface ConfigCenario {
  semente: number;
  horario: Horario;
  intervencoes: Intervencao[];
  /** Multiplica a demanda do horário (1 = normal). */
  fatorDemanda?: number;
}

// ----------------------------------------------------------------- MÉTRICAS

export type Aproximacao = 'africanos_leste' | 'africanos_oeste' | 'vv' | 'minerva' | 'rua_norte';

export interface PontoCalor {
  pos: [number, number]; // [lon, lat]
  peso: number; // 0..1
  tipo: 'conflito' | 'conflito_grave' | 'infracao';
  infracao?: TipoInfracao;
  tempo: number;
}

export interface Metricas {
  tempo: number; // s simulados
  veiculosNaRede: number;
  pedestresNaRede: number;
  concluidos: number; // agentes que saíram da área
  filaPorAproximacao: Record<Aproximacao, number>; // veículos parados/lentos
  filaMaxima: number;
  tempoMedioTravessiaS: number; // média de todos que saíram
  tempoMedioPorAproximacao: Record<Aproximacao, number>;
  infracoes: Record<TipoInfracao, number>;
  infracoesTotal: number;
  desistencias: number; // tentou, mas desistiu (fiscalização/geometria)
  conflitos: number; // quase-colisões (TTC < 1,5 s)
  conflitosGraves: number; // TTC < 0,7 s ou contato
  /** Índice 0..100 combinando conflitos graves, conflitos e infrações por hora. */
  indiceRisco: number;
}

/** Evento pontual para a tela (toast, som, destaque). */
export interface EventoSim {
  tempo: number;
  tipo: 'infracao' | 'desistencia' | 'conflito' | 'conflito_grave' | 'flagrante';
  agenteId: number;
  infracao?: TipoInfracao;
  pos: [number, number];
  texto: string;
}

/** O que o motor entrega a cada quadro. */
export interface Quadro {
  tempo: number;
  agentes: AgenteEstado[];
  eventos: EventoSim[]; // eventos desde o quadro anterior
  metricas: Metricas;
  /** Semáforo da VV, se existir. */
  semaforo?: { principal: 'verde' | 'amarelo' | 'vermelho'; secundaria: 'verde' | 'amarelo' | 'vermelho'; pedestre: boolean };
}

/** Resultado de um cenário rodado do início ao fim (comparação lado a lado). */
export interface ResultadoCenario {
  config: ConfigCenario;
  duracaoS: number;
  metricas: Metricas;
  calor: PontoCalor[];
}
