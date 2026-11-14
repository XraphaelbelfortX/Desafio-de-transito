import type { Rede } from './rede';
import type { Vec2 } from './geometria';

/**
 * Catálogo das 9 intervenções arrastáveis, com a regra de onde cada uma tem efeito
 * e o orçamento (SINAPI / SICRO quando há composição; estimativa sinalizada quando não há).
 */

export type TipoIntervencao =
  | 'camera'
  | 'semaforo'
  | 'fechar_canteiro'
  | 'retorno'
  | 'tachoes'
  | 'faixa_elevada'
  | 'refugio'
  | 'lombada'
  | 'agente';

export type Categoria = 'fiscalizacao' | 'controle' | 'geometria' | 'moderacao';

export interface TemposSemaforo {
  /** Verde da Av. dos Africanos (s). */
  verdeAvenida: number;
  /** Verde da rua transversal e dos pedestres (s). */
  verdeTransversal: number;
  amarelo: number;
  vermelhoGeral: number;
}

export const TEMPOS_PADRAO: TemposSemaforo = {
  verdeAvenida: 45,
  verdeTransversal: 20,
  amarelo: 4,
  vermelhoGeral: 2,
};

/** Intervenção colocada no mapa (coordenadas geográficas, como o mapa trabalha). */
export interface Intervencao {
  id: string;
  tipo: TipoIntervencao;
  lng: number;
  lat: number;
  tempos?: TemposSemaforo;
}

/** Mesma intervenção em metros locais, como o motor trabalha. */
export interface IntervencaoLocal {
  id: string;
  tipo: TipoIntervencao;
  p: Vec2;
  tempos?: TemposSemaforo;
}

export interface DefinicaoIntervencao {
  tipo: TipoIntervencao;
  nome: string;
  categoria: Categoria;
  /** O que faz na simulação, em uma frase. */
  resumo: string;
  /** Onde soltar para ter efeito. */
  ondeSoltar: string;
  raio: number;
  /** Observação técnica/normativa exibida no painel. */
  observacao?: string;
}

export const CATALOGO: DefinicaoIntervencao[] = [
  {
    tipo: 'camera',
    nome: 'Câmera de fiscalização',
    categoria: 'fiscalizacao',
    resumo: 'Motoristas no raio evitam excesso de velocidade, avanço de sinal e manobras proibidas.',
    ondeSoltar: 'Na pista ou na calçada; fiscaliza o sentido do lado em que for solta (no canteiro, os dois).',
    raio: 60,
  },
  {
    tipo: 'semaforo',
    nome: 'Semáforo',
    categoria: 'controle',
    resumo: 'Separa no tempo a avenida, a rua transversal e os pedestres. Tempos editáveis.',
    ondeSoltar: 'Perto de um dos cruzamentos (Vicente Venâncio ou rua norte).',
    raio: 45,
  },
  {
    tipo: 'fechar_canteiro',
    nome: 'Fechar canteiro',
    categoria: 'geometria',
    resumo: 'Fecha a abertura do canteiro: as conversões e retornos por ela deixam de existir.',
    ondeSoltar: 'Sobre uma das aberturas do canteiro.',
    raio: 15,
  },
  {
    tipo: 'retorno',
    nome: 'Retorno',
    categoria: 'geometria',
    resumo: 'Cria (ou regulariza) um retorno legal, encurtando o desvio de quem hoje infringe.',
    ondeSoltar: 'No canteiro central. Sobre uma abertura existente, regulariza o retorno dela.',
    raio: 15,
  },
  {
    tipo: 'tachoes',
    nome: 'Tachões',
    categoria: 'moderacao',
    resumo: 'Barreira física (linha de 10 tachões): inibe manobras proibidas por perto e reduz a velocidade.',
    ondeSoltar: 'Junto à abertura ou na faixa onde a manobra acontece.',
    raio: 15,
  },
  {
    tipo: 'faixa_elevada',
    nome: 'Faixa elevada',
    categoria: 'moderacao',
    resumo: 'Os veículos passam a 25 km/h na travessia e cedem mais a vez ao pedestre.',
    ondeSoltar: 'Sobre uma faixa de pedestres.',
    raio: 12,
    observacao: 'Em via arterial depende de estudo técnico e das resoluções do CONTRAN sobre faixa elevada.',
  },
  {
    tipo: 'refugio',
    nome: 'Refúgio de pedestre',
    categoria: 'geometria',
    resumo: 'O pedestre atravessa em duas etapas (3 faixas de cada vez), esperando no canteiro.',
    ondeSoltar: 'Sobre uma faixa de pedestres.',
    raio: 12,
  },
  {
    tipo: 'lombada',
    nome: 'Lombada',
    categoria: 'moderacao',
    resumo: 'Os veículos passam a 25 km/h na pista em que ela está.',
    ondeSoltar: 'Sobre uma das pistas da avenida.',
    raio: 30,
    observacao: 'Ondulação tipo A (CONTRAN 600/2016); em via arterial depende de estudo técnico.',
  },
  {
    tipo: 'agente',
    nome: 'Agente de trânsito',
    categoria: 'fiscalizacao',
    resumo: 'Fiscalização presencial forte no raio, das 6h às 20h. Custo mensal, sem obra.',
    ondeSoltar: 'Na calçada ou no canteiro, perto do ponto crítico.',
    raio: 45,
  },
];

export const DEFINICAO: Record<TipoIntervencao, DefinicaoIntervencao> = Object.fromEntries(
  CATALOGO.map((d) => [d.tipo, d])
) as Record<TipoIntervencao, DefinicaoIntervencao>;

/** Horário de serviço do agente de trânsito. */
export const AGENTE_INICIO = 6;
export const AGENTE_FIM = 20;

// ---------------------------------------------------------------- ANÁLISE
export type Lado = 'oeste' | 'leste' | 'ambos';

export interface AnaliseIntervencao {
  valida: boolean;
  /** Frase curta do que a intervenção faz onde está. */
  efeito: string;
  /** Abertura, travessia ou cruzamento a que se prende. */
  alvo?: string;
  cruzamento?: 'vv' | 'norte';
  lado?: Lado;
  /** Retorno sobre abertura existente (só regulariza). */
  regulariza?: boolean;
  /** Posição efetiva (encaixada no alvo), em metros locais. */
  p: Vec2;
}

const distTexto = (rede: Rede, x: number) => {
  const vv = rede.cruzamentos.find((c) => c.id === 'vv');
  const ref = vv ? vv.x : 0;
  const d = Math.round(Math.abs(x - ref) / 10) * 10;
  if (d < 15) return 'em frente à Vicente Venâncio';
  return `a ${d} m ${x < ref ? 'a oeste' : 'a leste'} da Vicente Venâncio`;
};

const NOME_ABERTURA: Record<string, string> = {
  abertura_vv: 'abertura do canteiro em frente à Vicente Venâncio',
  abertura_norte: 'abertura do canteiro no cruzamento norte',
};
const NOME_TRAVESSIA: Record<string, string> = {
  travessia_vv: 'faixa de pedestres junto à Vicente Venâncio',
  travessia_norte: 'faixa de pedestres junto à rua norte',
};
const nomeAbertura = (id: string) => NOME_ABERTURA[id] ?? 'abertura do canteiro';
const nomeTravessia = (id: string) => NOME_TRAVESSIA[id] ?? 'faixa de pedestres';

const ladoPorY = (rede: Rede, y: number): Lado =>
  Math.abs(y) <= rede.meioCanteiro + 0.5 ? 'ambos' : y > 0 ? 'oeste' : 'leste';

const nomeLado = (l: Lado) =>
  l === 'ambos' ? 'nos dois sentidos' : l === 'oeste' ? 'no sentido oeste (pista norte)' : 'no sentido leste (pista sul)';

export function analisar(rede: Rede, int: IntervencaoLocal): AnaliseIntervencao {
  const { x, y } = int.p;
  const naAvenida = Math.abs(y) <= rede.borda + 25 && x >= rede.xMin && x <= rede.xMax;
  const invalida = (efeito: string): AnaliseIntervencao => ({ valida: false, efeito, p: int.p });
  const travessiaPerto = () => {
    let melhor: { id: string; nome: string; x: number; cruzamento: 'vv' | 'norte' } | null = null;
    for (const t of rede.travessias) {
      if (Math.abs(t.x - x) <= 15 && Math.abs(y) <= rede.borda + 6 && (!melhor || Math.abs(t.x - x) < Math.abs(melhor.x - x))) {
        melhor = t;
      }
    }
    return melhor;
  };
  const aberturaPerto = (folga: number) =>
    rede.aberturas.find((a) => x >= a.x0 - folga && x <= a.x1 + folga && Math.abs(y) <= rede.borda + 4);

  switch (int.tipo) {
    case 'camera': {
      if (!naAvenida) return invalida('Fora da avenida: solte na pista, na calçada ou no canteiro.');
      const lado = ladoPorY(rede, y);
      return { valida: true, lado, efeito: `Fiscaliza ${nomeLado(lado)}, raio de 60 m, ${distTexto(rede, x)}.`, p: int.p };
    }
    case 'semaforo': {
      const c = rede.cruzamentos
        .map((k) => ({ k, d: Math.abs(k.x - x) }))
        .sort((a, b) => a.d - b.d)[0];
      if (!c || c.d > 45 || Math.abs(y) > rede.borda + 30) {
        return invalida('Solte perto de um cruzamento (Vicente Venâncio ou rua norte).');
      }
      return {
        valida: true,
        cruzamento: c.k.id,
        alvo: c.k.id,
        efeito: `Controla o cruzamento da ${c.k.nome}.`,
        p: { x: c.k.x, y: -rede.borda - 3 },
      };
    }
    case 'fechar_canteiro': {
      const a = aberturaPerto(8);
      if (!a) return invalida('Solte sobre uma abertura do canteiro.');
      const n = Object.values(rede.movimentos).filter((m) => m.fechadoPor === a.intervencaoFecha).length;
      return {
        valida: true,
        alvo: a.id,
        cruzamento: a.cruzamento,
        efeito: `Fecha a ${nomeAbertura(a.id)}: ${n} movimentos deixam de existir.`,
        p: { x: a.xc, y: 0 },
      };
    }
    case 'retorno': {
      if (Math.abs(y) > rede.meioCanteiro + 4 || x < rede.xMin + 40 || x > rede.xMax - 40) {
        return invalida('Solte no canteiro central, longe das pontas do trecho.');
      }
      const a = aberturaPerto(6);
      if (a) {
        return {
          valida: true,
          regulariza: true,
          alvo: a.id,
          cruzamento: a.cruzamento,
          efeito: `Regulariza o retorno na ${nomeAbertura(a.id)} (só sinalização).`,
          p: { x: a.xc, y: 0 },
        };
      }
      const conflita = rede.aberturas.find((ab) => x > ab.x0 - 20 && x < ab.x1 + 20);
      if (conflita) return invalida('Muito perto de uma abertura: solte sobre ela (regulariza) ou a 20 m dela.');
      return { valida: true, regulariza: false, efeito: `Novo retorno ${distTexto(rede, x)}.`, p: { x, y: 0 } };
    }
    case 'tachoes': {
      if (!naAvenida) return invalida('Fora da avenida.');
      const a = aberturaPerto(15);
      return {
        valida: true,
        alvo: a?.id,
        efeito: a ? `Barreira junto à ${nomeAbertura(a.id)}.` : `Linha de tachões ${distTexto(rede, x)}.`,
        p: int.p,
      };
    }
    case 'faixa_elevada':
    case 'refugio': {
      const t = travessiaPerto();
      if (!t) return invalida('Solte sobre uma faixa de pedestres.');
      return {
        valida: true,
        alvo: t.id,
        cruzamento: t.cruzamento,
        efeito: int.tipo === 'faixa_elevada' ? `Eleva a ${nomeTravessia(t.id)}.` : `Refúgio no canteiro, na ${nomeTravessia(t.id)}.`,
        p: { x: t.x, y: int.tipo === 'refugio' ? 0 : int.p.y },
      };
    }
    case 'lombada': {
      if (!naAvenida || Math.abs(y) > rede.borda + 2) return invalida('Solte sobre uma das pistas da avenida.');
      const lado = ladoPorY(rede, y);
      if (lado === 'ambos') return invalida('No canteiro não tem efeito: solte sobre uma pista.');
      const yc = lado === 'oeste' ? (rede.meioCanteiro + rede.borda) / 2 : -(rede.meioCanteiro + rede.borda) / 2;
      return { valida: true, lado, efeito: `Lombada ${nomeLado(lado)}, ${distTexto(rede, x)}.`, p: { x, y: yc } };
    }
    case 'agente': {
      if (!naAvenida) return invalida('Fora da avenida: solte na calçada ou no canteiro.');
      return { valida: true, efeito: `Agente ${distTexto(rede, x)}, das ${AGENTE_INICIO}h às ${AGENTE_FIM}h.`, p: int.p };
    }
  }
}

// ---------------------------------------------------------------- CUSTOS
export type FonteCusto = 'SINAPI' | 'SICRO' | 'SCO-RJ' | 'Contrato público' | 'Edital SMTT' | 'Estimativa';

export interface ItemCusto {
  descricao: string;
  fonte: FonteCusto;
  codigo?: string;
  referencia?: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
}

export interface Orcamento {
  implantacao: ItemCusto[];
  mensal: ItemCusto[];
  totalImplantacao: number;
  totalMensal: number;
  prazoDias: number;
}

/**
 * Preços de referência. Os itens SINAPI são média nacional não desonerada (05/2026);
 * o tachão usa o preço do material SICRO no MA (07/2026) mais a colocação estimada.
 * Itens "Estimativa" não têm composição pública conferida: trocar pela cotação da SMTT.
 */
const P = {
  tachao: {
    descricao: 'Tachão refletivo bidirecional, fornecimento e colocação',
    fonte: 'SICRO' as const,
    codigo: '5213362',
    referencia: 'material M3867 MA R$ 65,45 (07/2026) + colocação estimada',
    unidade: 'un',
    preco: 78.95,
  },
  meioFio: {
    descricao: 'Meio-fio de concreto pré-fabricado, assentamento em trecho reto',
    fonte: 'SINAPI' as const,
    codigo: '94273',
    referencia: '05/2026',
    unidade: 'm',
    preco: 46.84,
  },
  pinturaFaixa: {
    descricao: 'Pintura de faixa de pedestre ou zebrado, tinta retrorrefletiva',
    fonte: 'SINAPI' as const,
    codigo: '102509',
    referencia: '05/2026',
    unidade: 'm²',
    preco: 39.35,
  },
  pinturaSimbolo: {
    descricao: 'Pintura de setas, símbolos e textos no pavimento',
    fonte: 'SINAPI' as const,
    codigo: '102513',
    referencia: '05/2026',
    unidade: 'm²',
    preco: 60.8,
  },
  cbuq: {
    descricao: 'Concreto asfáltico, camada de rolamento (sem transporte)',
    fonte: 'SINAPI' as const,
    codigo: '95995',
    referencia: '05/2026',
    unidade: 'm³',
    preco: 1532.31,
  },
  coluna: {
    descricao: 'Coluna de aço galvanizado para braço projetado de semáforo',
    fonte: 'SCO-RJ' as const,
    codigo: 'ST 64.05.0600',
    referencia: 'dez/2022',
    unidade: 'un',
    preco: 3110.35,
  },
  manutSemaforo: {
    descricao: 'Manutenção de cruzamento semaforizado',
    fonte: 'Contrato público' as const,
    referencia: 'Joinville, Dispensa 482/2025',
    unidade: 'cruz./mês',
    preco: 493.55,
  },
  agente: {
    descricao: 'Agente de trânsito em posto fixo (remuneração × 1,5 de encargos)',
    fonte: 'Edital SMTT' as const,
    referencia: 'Edital SMTT São Luís 001/2024: até R$ 3.671,20',
    unidade: 'agente/mês',
    preco: 3671.2 * 1.5,
  },
};

const E = (descricao: string, unidade: string, quantidade: number, precoUnitario: number): ItemCusto => ({
  descricao,
  fonte: 'Estimativa',
  unidade,
  quantidade,
  precoUnitario,
});

const item = (ref: (typeof P)[keyof typeof P], quantidade: number): ItemCusto => ({
  descricao: ref.descricao,
  fonte: ref.fonte,
  codigo: 'codigo' in ref ? ref.codigo : undefined,
  referencia: ref.referencia,
  unidade: ref.unidade,
  quantidade,
  precoUnitario: ref.preco,
});

const PLACA = 650;

export function orcar(rede: Rede, int: IntervencaoLocal, a: AnaliseIntervencao): Orcamento {
  const imp: ItemCusto[] = [];
  const men: ItemCusto[] = [];
  let prazo = 1;
  const larguraCanteiro = 2 * rede.meioCanteiro;
  const larguraPista = 3 * rede.largFaixa;
  const r2 = (v: number) => Math.round(v * 100) / 100;

  switch (int.tipo) {
    case 'camera': {
      const faixas = a.lado === 'ambos' ? 6 : 3;
      imp.push(E('Placa "fiscalização eletrônica" com suporte', 'un', 2, PLACA));
      men.push(E('Locação de equipamento fixo de fiscalização (por faixa monitorada)', 'faixa/mês', faixas, 3500));
      prazo = 15;
      break;
    }
    case 'semaforo':
      imp.push(item(P.coluna, 4));
      imp.push(E('Braço projetado para grupo focal', 'un', 4, 2200));
      imp.push(E('Grupo focal veicular LED (3 focos)', 'un', 6, 1400));
      imp.push(E('Grupo focal de pedestre LED', 'un', 4, 900));
      imp.push(E('Controlador semafórico de 2 fases', 'un', 1, 28000));
      imp.push(E('Fundações, cabeamento e instalação', 'vb', 1, 18000));
      imp.push(item(P.pinturaFaixa, r2(6 * rede.largFaixa * 0.4)));
      men.push(item(P.manutSemaforo, 1));
      men.push(E('Energia elétrica do cruzamento', 'mês', 1, 150));
      prazo = 30;
      break;
    case 'fechar_canteiro': {
      const ab = rede.aberturas.find((x) => x.id === a.alvo);
      const L = ab ? ab.x1 - ab.x0 : 26;
      imp.push(item(P.meioFio, r2(2 * L)));
      imp.push(E('Aterro e plantio de grama no canteiro', 'm²', r2(L * larguraCanteiro), 25));
      imp.push(item(P.tachao, 10));
      imp.push(E('Placa de "proibido retorno/conversão" com suporte', 'un', 2, PLACA));
      prazo = 7;
      break;
    }
    case 'retorno':
      if (a.regulariza) {
        imp.push(item(P.pinturaSimbolo, 12));
        imp.push(item(P.tachao, 8));
        imp.push(E('Placa de "retorno permitido" com suporte', 'un', 2, PLACA));
        prazo = 2;
      } else {
        const area = 20 * larguraCanteiro;
        imp.push(E('Demolição do canteiro e remoção de meio-fio', 'm²', r2(area), 45));
        imp.push(E('Base e sub-base do novo pavimento', 'm²', r2(area), 80));
        imp.push(item(P.cbuq, r2(area * 0.05)));
        imp.push(item(P.meioFio, r2(2 * larguraCanteiro)));
        imp.push(item(P.pinturaSimbolo, 12));
        imp.push(E('Placa de "retorno permitido" com suporte', 'un', 2, PLACA));
        prazo = 20;
      }
      break;
    case 'tachoes':
      imp.push(item(P.tachao, 10));
      prazo = 1;
      break;
    case 'faixa_elevada': {
      const largura = 2 * larguraPista;
      // plataforma de 5 m + duas rampas de 1,5 m, 15 cm de altura
      const secao = 5 * 0.15 + 2 * (1.5 * 0.15) / 2;
      imp.push(item(P.cbuq, r2(secao * largura)));
      imp.push(item(P.pinturaFaixa, r2(4 * largura * 0.5)));
      imp.push(E('Placa de "faixa elevada" com suporte', 'un', 4, PLACA));
      prazo = 10;
      break;
    }
    case 'refugio':
      imp.push(E('Piso de concreto no canteiro (refúgio)', 'm²', r2(4 * larguraCanteiro), 95));
      imp.push(E('Rampa acessível com meio-fio rebaixado', 'un', 2, 800));
      imp.push(E('Balizador de proteção', 'un', 4, 350));
      imp.push(E('Placa de travessia de pedestres com suporte', 'un', 1, PLACA));
      prazo = 7;
      break;
    case 'lombada': {
      // ondulação tipo A: 3,70 m x 8 cm, seção parabólica (2/3 do retângulo)
      const secao = (2 / 3) * 3.7 * 0.08;
      imp.push(item(P.cbuq, r2(secao * larguraPista)));
      imp.push(item(P.pinturaFaixa, r2(3.7 * larguraPista * 0.5)));
      imp.push(E('Placa de "lombada" com suporte', 'un', 2, PLACA));
      prazo = 3;
      break;
    }
    case 'agente':
      men.push(item(P.agente, 1));
      prazo = 0;
      break;
  }

  const soma = (xs: ItemCusto[]) => xs.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0);
  return { implantacao: imp, mensal: men, totalImplantacao: soma(imp), totalMensal: soma(men), prazoDias: prazo };
}
