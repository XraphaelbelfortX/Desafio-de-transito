/**
 * Motor microscópico de trânsito (navegador, TypeScript puro, sem dependências).
 *
 * - Cada veículo segue uma rota (polilinha) com o modelo IDM (Intelligent Driver Model):
 *   acelera até a velocidade desejada e freia para o líder, para a linha de retenção,
 *   para a caixa amarela bloqueada, para o semáforo e para o gargalo a jusante.
 * - O líder é qualquer agente no "cone" à frente (inclusive quem cruza na frente),
 *   então bloqueios e conflitos surgem sozinhos.
 * - Entradas pelos lados (VV, Minerva, rua norte) e conversões pelo canteiro esperam
 *   brecha (aceitação de brecha), em dois tempos quando atravessam as duas pistas.
 * - A IA (ia.ts) decide as infrações; as intervenções (intervencoes.ts) mudam a chance
 *   de ser pego ou a própria geometria.
 *
 * Tudo é determinístico para a mesma semente.
 */
import { criarRng, Polilinha, Rng } from './geo';
import { brechaAceita, decidir, EfeitoManada, sortearPerfil } from './ia';
import { Intervencoes, FaseSemaforo } from './intervencoes';
import { limiteEm, Pista, Rede, Rota } from './rede';
import type {
  AgenteDetalhe,
  AgenteEstado,
  Aproximacao,
  ConfigCenario,
  Decisao,
  EventoSim,
  Intervencao,
  Metricas,
  Perfil,
  PontoCalor,
  Quadro,
  TipoAgente,
  TipoInfracao,
} from './tipos';
import { NOMES_INFRACAO } from './tipos';

const KMH = 1 / 3.6;
const APROX: Aproximacao[] = ['africanos_leste', 'africanos_oeste', 'vv', 'minerva', 'rua_norte'];
const INFRACOES = Object.keys(NOMES_INFRACAO) as TipoInfracao[];
/** Peso de cada infração no índice de risco (as que cortam fluxo de frente pesam mais). */
const GRAVIDADE: Record<TipoInfracao, number> = {
  caixa_amarela: 0.4,
  conversao_proibida: 1.2,
  retorno_proibido: 1.2,
  avanco_sinal: 1.5,
  excesso_velocidade: 0.4,
  moto_corredor: 0.2,
  parada_irregular: 0.2,
  pedestre_fora_faixa: 0.8,
};

// ------------------------------------------------------------------ DEMANDA

/** Veículos/hora por aproximação. pico_manha: pico no sentido oeste; pico_tarde: sentido leste. */
function demanda(h: ConfigCenario['horario']): Record<Aproximacao, number> & { pedestres: number } {
  if (h === 'fora_pico')
    return { africanos_oeste: 1000, africanos_leste: 1000, vv: 200, minerva: 110, rua_norte: 50, pedestres: 80 };
  const pesadoOeste = h === 'pico_manha';
  return {
    africanos_oeste: pesadoOeste ? 2050 : 1450,
    africanos_leste: pesadoOeste ? 1450 : 2050,
    vv: 290,
    minerva: 170,
    rua_norte: 80,
    pedestres: 150,
  };
}

/** Intenções de cada aproximação (a rota "desejada"; a IA decide se faz do jeito proibido). */
const INTENCOES: Record<Aproximacao, [string, number][]> = {
  africanos_oeste: [
    ['reto', 0.86],
    ['oeste_para_minerva', 0.04],
    ['oeste_para_norte', 0.03],
    ['oeste_para_vv', 0.03], // esquerda proibida
    ['retorno_oeste', 0.04], // retorno proibido
  ],
  africanos_leste: [
    ['reto', 0.85],
    ['leste_para_vv', 0.06],
    ['leste_para_minerva', 0.03], // esquerda proibida
    ['leste_para_norte', 0.02], // esquerda proibida
    ['retorno_leste', 0.04], // retorno proibido
  ],
  vv: [
    ['vv_dir_para_leste', 0.42],
    ['vv_esq_para_oeste', 0.48],
    ['vv_reto_para_minerva', 0.1],
  ],
  minerva: [
    ['minerva_dir_para_oeste', 0.5],
    ['minerva_esq_para_leste', 0.35],
    ['minerva_reto_para_vv', 0.15],
  ],
  rua_norte: [
    ['norte_dir_para_oeste', 0.6],
    ['norte_esq_para_leste', 0.4],
  ],
};

/** Retornos podem ser feitos em duas aberturas (VV e norte): se uma está fiscalizada, a pessoa tenta a outra. */
const RETORNOS: Record<string, string[]> = {
  retorno_leste: ['retorno_norte_leste_para_oeste', 'retorno_vv_leste_para_oeste'],
  retorno_oeste: ['retorno_vv_oeste_para_leste', 'retorno_norte_oeste_para_leste'],
};

/** Alternativa legal: rota + segundos de volta "fora do mapa". [rota sem gota, desvio, rota com gota, desvio] */
const ALTERNATIVA: Record<string, [string, number, string?, number?]> = {
  oeste_para_vv: ['africanos_oeste_0', 120],
  leste_para_minerva: ['africanos_leste_0', 120, 'leste_gota_para_oeste', 40],
  leste_para_norte: ['africanos_leste_0', 120, 'leste_gota_para_oeste', 55],
  retorno_leste: ['africanos_leste_0', 150, 'leste_gota_para_oeste', 0],
  retorno_oeste: ['africanos_oeste_0', 150],
  vv_esq_para_oeste: ['vv_dir_para_leste', 150, 'vv_gota_para_oeste', 0],
  vv_reto_para_minerva: ['vv_dir_para_leste', 160, 'vv_gota_para_oeste', 40],
  minerva_esq_para_leste: ['minerva_dir_para_oeste', 150],
  minerva_reto_para_vv: ['minerva_dir_para_oeste', 160],
  norte_esq_para_leste: ['norte_dir_para_oeste', 150],
};

const MIX_AFRICANOS: [TipoAgente, number][] = [
  ['carro', 0.58],
  ['moto', 0.22],
  ['app', 0.14],
  ['onibus', 0.04],
];
const MIX_TRANSVERSAL: [TipoAgente, number][] = [
  ['carro', 0.62],
  ['moto', 0.25],
  ['app', 0.13],
];

const DIM: Record<Exclude<TipoAgente, 'pedestre'>, { L: number; W: number; a: number; b: number; T: number; s0: number }> = {
  carro: { L: 4.5, W: 1.8, a: 1.6, b: 2.2, T: 1.3, s0: 2.0 },
  app: { L: 4.5, W: 1.8, a: 1.6, b: 2.2, T: 1.3, s0: 2.0 },
  moto: { L: 2.1, W: 0.8, a: 2.6, b: 3.0, T: 0.9, s0: 1.0 },
  onibus: { L: 12, W: 2.6, a: 0.9, b: 1.6, T: 1.6, s0: 2.5 },
};

// ------------------------------------------------------------------ AGENTES

interface Veiculo {
  id: number;
  rng: Rng;
  tipo: Exclude<TipoAgente, 'pedestre'>;
  rota: Rota;
  intencao: string;
  origem: Aproximacao;
  faixaIdx: number; // 0..2 na Africanos, -1 nas transversais
  s: number;
  v: number;
  L: number;
  W: number;
  a: number;
  b: number;
  T: number;
  s0: number;
  perfil: Perfil;
  frustracao: number; // sobe quando desiste por fiscalização (infrações "depois da câmera")
  vFator: number; // >1 = decidiu correr
  radarDecidido: boolean;
  radarSuprimido: boolean;
  excessoContado: boolean;
  off: number; // deslocamento lateral (m, + = para o canteiro)
  offAlvo: number;
  x: number;
  y: number;
  hx: number;
  hy: number;
  t0: number;
  esperaEntrada: number;
  desvioS: number;
  portao: number;
  liberadoAte: number; // índice do último portão liberado
  espera: number;
  caixas: Map<string, boolean>; // caixa -> vai invadir?
  infracao: TipoInfracao | null;
  desistiuAte: number;
  corredorDecidido: boolean;
  sinal: { ciclo: number; passa: boolean } | null;
  parada: { s: number; ate: number; dur: number; baia: boolean; feita: boolean } | null;
  decisoes: Decisao[];
  parado: number;
  liderId: number;
}

interface Pedestre {
  id: number;
  rng: Rng;
  perfil: Perfil;
  x: number;
  y: number;
  lado: 1 | -1; // lado de partida (sinal de y)
  xTravessia: number;
  naFaixa: boolean;
  refugio: boolean;
  estado: 'calcada' | 'meio_fio' | 'pista1' | 'canteiro' | 'pista2' | 'chegou';
  vel: number;
  hx: number;
  hy: number;
  t0: number;
  espera: number;
  infracao: TipoInfracao | null;
  desistiuAte: number;
  decisoes: Decisao[];
  semaforo: boolean;
}

type Ente =
  | { k: 'v'; id: number; x: number; y: number; hx: number; hy: number; v: number; L: number; W: number; ref: Veiculo }
  | { k: 'p'; id: number; x: number; y: number; hx: number; hy: number; v: number; L: number; W: number; ref: Pedestre };

const CEL = 12;

// --------------------------------------------------------------- SIMULAÇÃO

export class Simulacao {
  readonly rede: Rede;
  readonly config: ConfigCenario;
  t = 0;
  private rng: Rng;
  private manada: EfeitoManada;
  private iv: Intervencoes;
  private rotas: Map<string, Rota>;
  private veiculos: Veiculo[] = [];
  private pedestres: Pedestre[] = [];
  private proxId = 1;
  private proxChegada = new Map<string, number>();
  private pendentes = new Map<string, { rota: Rota; v: Veiculo; t: number }[]>();
  private grade = new Map<number, Ente[]>();
  private fase: FaseSemaforo | null = null;
  private eventos: EventoSim[] = [];
  private calor: PontoCalor[] = [];
  private paresConflito = new Map<string, number>();
  private passos = 0;
  private pico: boolean;
  private dem: ReturnType<typeof demanda>;
  private jusante: Record<Pista, { ciclo: number; verde: number; offset: number }>;

  // acumuladores de métricas
  private m = Simulacao.metricasZeradas();
  private tInicioMetricas = 0;

  private static metricasZeradas() {
    return {
    concluidos: 0,
    somaTempo: 0,
    porAprox: Object.fromEntries(APROX.map((a) => [a, { n: 0, soma: 0 }])) as Record<Aproximacao, { n: number; soma: number }>,
    infracoes: Object.fromEntries(INFRACOES.map((k) => [k, 0])) as Record<TipoInfracao, number>,
    desistencias: 0,
    conflitos: 0,
    graves: 0,
    filaMaxima: 0,
    pedConcluidos: 0,
    pedSoma: 0,
    };
  }

  /** Zera as métricas (usado depois do aquecimento, para medir só o regime). */
  zerarMetricas() {
    this.m = Simulacao.metricasZeradas();
    this.calor = [];
    this.tInicioMetricas = this.t;
  }

  constructor(rede: Rede, config: ConfigCenario) {
    this.rede = rede;
    this.config = config;
    this.rng = criarRng(config.semente);
    this.pico = config.horario !== 'fora_pico';
    this.manada = new EfeitoManada(this.pico);
    this.iv = new Intervencoes(config.intervencoes, rede.proj);
    this.rotas = rede.montarRotas({ fechadas: this.iv.fechadas, comGota: this.iv.comGota });
    const d = demanda(config.horario);
    const f = config.fatorDemanda ?? 1;
    this.dem = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v * f])) as typeof d;
    // Semáforos a jusante (fora da área): é o que forma a fila que volta até o cruzamento.
    const gOeste = config.horario === 'pico_manha' ? 0.44 : config.horario === 'pico_tarde' ? 0.5 : 0.5;
    const gLeste = config.horario === 'pico_tarde' ? 0.44 : config.horario === 'pico_manha' ? 0.5 : 0.5;
    this.jusante = {
      oeste: { ciclo: 100, verde: 100 * gOeste, offset: 37 },
      leste: { ciclo: 100, verde: 100 * gLeste, offset: 0 },
    };
    for (const a of [...APROX, 'pedestres']) this.proxChegada.set(a, this.rng.proximaChegada(this.taxa(a)));
  }

  /** Troca as intervenções no meio da simulação (os agentes já na rede mantêm a rota). */
  aplicarIntervencoes(lista: Intervencao[]) {
    this.config.intervencoes = lista;
    this.iv = new Intervencoes(lista, this.rede.proj);
    this.rotas = this.rede.montarRotas({ fechadas: this.iv.fechadas, comGota: this.iv.comGota });
  }

  get custoIntervencoes() {
    return this.iv.custoTotal;
  }

  private taxa(a: string) {
    return (this.dem as Record<string, number>)[a] ?? 0;
  }

  // ---------------------------------------------------------------- PASSO

  avancar(segundos: number, dt = 0.25) {
    const n = Math.max(1, Math.round(segundos / dt));
    for (let i = 0; i < n; i++) this.passo(dt);
  }

  passo(dt = 0.25) {
    this.t += dt;
    this.passos++;
    this.gerarChegadas();
    this.montarGrade();
    const pedEsperando = this.pedestres.some((p) => p.semaforo && p.estado === 'meio_fio');
    this.fase = this.iv.fase(this.t, pedEsperando);
    this.inserirPendentes();

    // 0) troca de faixa (só quem segue reto pela Africanos), uma vez por segundo
    for (const v of this.veiculos) if ((this.passos + v.id) % 4 === 0) this.mudarFaixa(v);
    // 1) aceleração de cada veículo (com o estado do passo anterior)
    const acc = new Map<number, number>();
    for (const v of this.veiculos) acc.set(v.id, this.aceleracao(v));
    // 2) impasse em ciclo (A espera B, que espera C, ... que espera A): o de menor id passa
    const porId = new Map(this.veiculos.map((v) => [v.id, v]));
    const resolvidos = new Set<number>();
    for (const v of this.veiculos) {
      if (v.parado < 3 || v.liderId < 0 || resolvidos.has(v.id)) continue;
      const ciclo: Veiculo[] = [v];
      let c = porId.get(v.liderId);
      while (c && ciclo.length < 10 && c !== v) {
        ciclo.push(c);
        c = porId.get(c.liderId);
      }
      if (c !== v) continue;
      for (const w of ciclo) resolvidos.add(w.id);
      const quem = ciclo.reduce((a, b) => (a.id < b.id ? a : b));
      acc.set(quem.id, this.aceleracao(quem, quem.liderId));
    }
    // 3) integra
    const sairam: Veiculo[] = [];
    for (const v of this.veiculos) {
      const a = acc.get(v.id)!;
      const vn = Math.max(0, v.v + a * dt);
      v.s += ((v.v + vn) / 2) * dt;
      v.v = vn;
      v.parado = v.v < 0.3 ? v.parado + dt : 0;
      const dOff = v.offAlvo - v.off;
      v.off += Math.sign(dOff) * Math.min(Math.abs(dOff), 1.2 * dt);
      this.posicionar(v);
      if (v.s >= v.rota.linha.comprimento - 0.5) sairam.push(v);
    }
    for (const v of sairam) this.concluir(v);

    this.passoPedestres(dt);
    if (this.passos % 2 === 0) this.detectarConflitos();
    this.atualizarFilaMaxima();
  }

  // ------------------------------------------------------------- CHEGADAS

  private gerarChegadas() {
    for (const a of [...APROX, 'pedestres']) {
      let prox = this.proxChegada.get(a)!;
      while (prox <= this.t) {
        if (a === 'pedestres') this.criarPedestre();
        else this.criarVeiculo(a as Aproximacao);
        prox += this.rng.proximaChegada(this.taxa(a));
      }
      this.proxChegada.set(a, prox);
    }
  }

  private criarVeiculo(origem: Aproximacao) {
    const africanos = origem.startsWith('africanos');
    // cada agente tem o próprio gerador: o mesmo motorista decide com os mesmos sorteios em
    // todos os cenários, então a diferença entre cenários vem só das intervenções
    const rng = criarRng(Math.floor(this.rng.rnd() * 4294967296));
    let tipo = rng.escolher(africanos ? MIX_AFRICANOS : MIX_TRANSVERSAL) as Veiculo['tipo'];
    let intencao = rng.escolher(INTENCOES[origem]);
    if (tipo === 'onibus' && intencao !== 'reto') intencao = 'reto';
    const perfil = sortearPerfil(rng, tipo, this.pico);
    const d = DIM[tipo];
    const v: Veiculo = {
      id: this.proxId++,
      tipo,
      rng,
      rota: null as unknown as Rota,
      intencao,
      origem,
      faixaIdx: -1,
      s: 0,
      v: 0,
      L: d.L,
      W: d.W,
      a: d.a * (0.85 + 0.3 * perfil.pressa),
      b: d.b,
      T: d.T * (1.2 - 0.4 * perfil.pressa),
      s0: d.s0,
      perfil,
      frustracao: 0,
      vFator: 1,
      radarDecidido: false,
      radarSuprimido: false,
      excessoContado: false,
      off: 0,
      offAlvo: 0,
      x: 0,
      y: 0,
      hx: 1,
      hy: 0,
      t0: this.t,
      esperaEntrada: 0,
      desvioS: 0,
      portao: 0,
      liberadoAte: -1,
      espera: 0,
      caixas: new Map(),
      infracao: null,
      desistiuAte: 0,
      corredorDecidido: false,
      sinal: null,
      parada: null,
      decisoes: [],
      parado: 0,
      liderId: -1,
    };
    const rota = this.escolherRota(v);
    if (!rota) return;
    v.rota = rota;
    const y0 = Math.abs(rota.linha.pts[0][1]);
    if (rota.origem.startsWith('africanos')) v.faixaIdx = y0 < 6.5 ? 0 : y0 < 10 ? 1 : 2;

    // excesso de velocidade: decidido na entrada (chance de ser pego "normal" da via)
    if (africanos) {
      const p0 = rota.linha.em(0);
      const f = this.iv.fiscalizacao('excesso_velocidade', p0.x, p0.y, this.t);
      const dec = this.decidir(v, 'excesso_velocidade', p0.x, p0.y, 4, 0.35, true, f);
      if (dec.infringiu) v.vFator = 1.22 + 0.2 * rng.rnd();
    }
    // ônibus e parte dos apps param na pista da direita
    if (tipo === 'onibus' && v.faixaIdx === 2 && rng.rnd() < 0.6) {
      const xParada = rota.origem === 'africanos_oeste' ? -60 : 60;
      const sP = rota.linha.sMaisProximo(xParada, rota.linha.pts[0][1]);
      const baia = this.iv.baiaPerto(xParada, rota.linha.pts[0][1]);
      let naBaia = baia;
      if (baia) {
        const dec = this.decidir(v, 'parada_irregular', xParada, rota.linha.pts[0][1], 8, 0.1, true);
        naBaia = !dec.infringiu;
      }
      v.parada = { s: sP, ate: 0, dur: rng.entre(12, 25), baia: naBaia, feita: false };
    } else if (tipo === 'app' && v.faixaIdx === 2 && rng.rnd() < 0.35) {
      const xP = rng.entre(-120, 120);
      const yP = rota.linha.pts[0][1];
      const sP = rota.linha.sMaisProximo(xP, yP);
      if (this.iv.baiaPerto(xP, yP)) v.parada = { s: sP, ate: 0, dur: rng.entre(15, 30), baia: true, feita: false };
      else {
        const dec = this.decidir(v, 'parada_irregular', xP, yP, 35, 0.15, true);
        if (dec.infringiu) v.parada = { s: sP, ate: 0, dur: rng.entre(15, 30), baia: false, feita: false };
        else v.desvioS += 35;
      }
    }
    const chave = this.chaveEntrada(rota);
    if (!this.pendentes.has(chave)) this.pendentes.set(chave, []);
    this.pendentes.get(chave)!.push({ rota, v, t: this.t });
  }

  /** Transforma a intenção em rota, com a decisão de fazer a manobra proibida ou dar a volta. */
  private escolherRota(v: Veiculo): Rota | null {
    const r = this.rotas;
    const it = v.intencao;
    const alt = (chave: string): Rota | null => {
      const a = ALTERNATIVA[chave];
      if (!a) return null;
      if (this.iv.comGota && a[2] && r.has(a[2])) {
        v.desvioS += a[3] ?? 0;
        return r.get(a[2])!;
      }
      v.desvioS += a[1];
      return r.get(a[0]) ?? null;
    };
    const ganhoAlt = (chave: string) => {
      const a = ALTERNATIVA[chave];
      if (!a) return 60;
      return this.iv.comGota && a[2] && r.has(a[2]) ? (a[3] ?? 0) + 25 : a[1];
    };

    if (it === 'reto') {
      // ônibus na faixa da direita; os demais escolhem a faixa com menos gente esperando
      const pista = v.origem === 'africanos_oeste' ? 'africanos_oeste' : 'africanos_leste';
      if (v.tipo === 'onibus') return r.get(`${pista}_2`)!;
      let melhor = v.rng.escolher<number>([
        [0, 0.3],
        [1, 0.4],
        [2, 0.3],
      ]);
      const fila = (i: number) => this.pendentes.get(this.chaveEntrada(r.get(`${pista}_${i}`)!))?.length ?? 0;
      for (let i = 0; i < 3; i++) if (fila(i) + 1 < fila(melhor)) melhor = i;
      return r.get(`${pista}_${melhor}`)!;
    }

    const proibidas: Record<string, TipoInfracao> = {
      oeste_para_vv: 'conversao_proibida',
      leste_para_minerva: 'conversao_proibida',
      leste_para_norte: 'conversao_proibida',
      retorno_leste: 'retorno_proibido',
      retorno_oeste: 'retorno_proibido',
    };
    const infr = proibidas[it];
    if (infr) {
      const candidatas = RETORNOS[it] ?? [it];
      const ganho = ganhoAlt(it);
      let ordem = candidatas;
      if (candidatas.length > 1 && v.rng.rnd() < 0.4) ordem = [...candidatas].reverse();
      for (const id of ordem) {
        const rota = r.get(id);
        // ponto da manobra
        const mov = this.rede.movimentos.get(id);
        const pm = mov ? mov.pts[Math.floor(mov.pts.length / 2)] : [0, 0];
        const possivel = !!rota && !this.iv.bloqueadoPorTachoes(pm[0], pm[1]);
        const dec = this.decidir(v, infr, pm[0], pm[1], ganho, this.pico ? 0.55 : 0.45, possivel);
        if (dec.infringiu && rota) {
          this.iniciarInfracao(v, infr, pm[0], pm[1]);
          return rota;
        }
        // só tenta a outra abertura se desistiu por causa da fiscalização/geometria
        if (!dec.desistiu) break;
      }
      return alt(it);
    }

    // movimentos legais que podem ter sido fechados (abertura do canteiro)
    const rota = r.get(it);
    if (rota) return rota;
    return alt(it);
  }

  private chaveEntrada(r: Rota) {
    const p = r.linha.pts[0];
    return `${Math.round(p[0])},${Math.round(p[1])}`;
  }

  private inserirPendentes() {
    for (const [, fila] of this.pendentes) {
      while (fila.length) {
        const { rota, v } = fila[0];
        const p = rota.linha.em(0);
        const lider = this.obstaculo(p.x - p.hx * 3, p.y - p.hy * 3, p.hx, p.hy, 60, -1, v.W, 0);
        if (lider && lider.gap < v.L + 4) break;
        fila.shift();
        v.esperaEntrada = this.t - v.t0;
        v.s = 0;
        const vmax = limiteEm(rota, 0) * v.vFator;
        v.v = lider ? Math.min(vmax, lider.v, Math.sqrt(Math.max(0, 2 * v.b * (lider.gap - v.s0)))) : vmax * 0.9;
        this.posicionar(v);
        this.veiculos.push(v);
        this.inserirNaGrade({ k: 'v', id: v.id, x: v.x, y: v.y, hx: v.hx, hy: v.hy, v: v.v, L: v.L, W: v.W, ref: v });
      }
    }
  }

  // --------------------------------------------------------------- DECISÃO

  private decidir(
    v: Veiculo | Pedestre,
    infr: TipoInfracao,
    x: number,
    y: number,
    ganho: number,
    risco: number,
    possivel: boolean,
    fisc?: { com: number; base: number; fonte: string | null }
  ) {
    const f = fisc ?? this.iv.fiscalizacao(infr, x, y, this.t);
    const frust = 'frustracao' in v ? v.frustracao : 0;
    const perfil = frust ? { ...v.perfil, pressa: Math.min(1, v.perfil.pressa + frust) } : v.perfil;
    const dec = decidir(v.rng, perfil, {
      tempo: this.t,
      infracao: infr,
      ganhoTempoS: ganho,
      chanceFiscalizacao: f.com,
      chanceFiscalizacaoBase: f.base,
      risco,
      bonusObediencia: this.iv.bonusObediencia(x, y),
      possivel,
      manada: this.manada.nivel[infr],
    });
    this.manada.observar(infr, dec.infringiu);
    v.decisoes.unshift(dec);
    if (v.decisoes.length > 8) v.decisoes.pop();
    const pos = this.rede.proj.paraGeo([x, y]);
    if (dec.desistiu) {
      this.m.desistencias++;
      v.desistiuAte = this.t + 8;
      if ('frustracao' in v && f.com > f.base + 0.05) v.frustracao = Math.min(0.3, v.frustracao + 0.12);
      this.eventos.push({ tempo: this.t, tipo: 'desistencia', agenteId: v.id, infracao: infr, pos, texto: dec.motivo });
    }
    return dec;
  }

  /** Marca a infração, conta, sorteia o flagrante e alimenta o efeito manada. */
  private iniciarInfracao(v: Veiculo | Pedestre, infr: TipoInfracao, x: number, y: number) {
    v.infracao = infr;
    this.m.infracoes[infr]++;
    const f = this.iv.fiscalizacao(infr, x, y, this.t);
    const flagrado = v.rng.rnd() < f.com;
    if (flagrado) this.manada.flagrante(infr);
    const pos = this.rede.proj.paraGeo([x, y]);
    this.eventos.push({ tempo: this.t, tipo: 'infracao', agenteId: v.id, infracao: infr, pos, texto: NOMES_INFRACAO[infr] });
    if (flagrado && f.fonte)
      this.eventos.push({ tempo: this.t, tipo: 'flagrante', agenteId: v.id, infracao: infr, pos, texto: `Flagrado por ${f.fonte.replace('_', ' ')}` });
    this.addCalor(x, y, 'infracao', 0.5, infr);
  }

  // ------------------------------------------------------------------ IDM

  private aceleracao(v: Veiculo, ignorar = -1): number {
    const r = v.rota;
    const L2 = v.L / 2;
    const frente = v.s + L2;
    // velocidade desejada
    let v0 = limiteEm(r, v.s);
    const eAfricanos = v0 >= 50 * KMH;
    if (eAfricanos && !v.radarSuprimido) v0 *= v.vFator;
    v0 = Math.min(v0, this.iv.limiteFisico(v.x + v.hx * 8, v.y + v.hy * 8));
    v0 = Math.max(v0, 2);

    let livre = v.v <= v0 ? v.a * (1 - (v.v / v0) ** 4) : -Math.min(3.5, (v.v - v0) * 1.5);
    // freia antes de trechos mais lentos (curvas)
    for (const [s0, , vl] of r.limites) {
      const d = s0 - frente;
      if (d > 0 && d < 90 && v.v > vl) livre = Math.min(livre, -((v.v ** 2 - vl ** 2) / (2 * Math.max(1, d))) * 1.2);
    }

    let inter = 0; // max (s*/s)^2
    const restr = (gap: number, vLider: number) => {
      const dv = v.v - vLider;
      const sStar = v.s0 + Math.max(0, v.v * v.T + (v.v * dv) / (2 * Math.sqrt(v.a * v.b)));
      inter = Math.max(inter, (sStar / Math.max(0.1, gap)) ** 2);
    };
    const parar = (sLinha: number) => {
      const gap = sLinha - frente;
      if (gap < -1) return; // já passou
      restr(Math.max(0.1, gap + v.s0 * 0.8), 0);
    };

    // líder físico
    const look = Math.max(35, v.v * 5 + 15);
    const lider = this.obstaculo(v.x, v.y, v.hx, v.hy, look, v.id, v.W, L2, ignorar, { linha: r.linha, s: v.s, off: v.off });
    v.liderId = lider ? lider.id : -1;
    if (lider) restr(lider.gap, lider.v);

    // gargalo a jusante (semáforo virtual fora da área)
    if (r.sJusante !== null && r.pistaJusante) {
      const j = this.jusante[r.pistaJusante];
      const c = (this.t + j.offset) % j.ciclo;
      if (c >= j.verde && frente < r.sJusante - (v.v * v.v) / (2 * 4)) parar(r.sJusante);
    }

    // caixas amarelas
    for (const c of r.caixas) {
      if (frente > c.s0 + 0.5 || frente < c.s0 - 35) continue;
      const bloqueada = this.caixaBloqueada(v, c.s0, c.s1);
      if (!v.caixas.has(c.id)) {
        if (!bloqueada) continue;
        if (frente > c.s0 - 1.5 && (v.v * v.v) / (2 * (c.s0 + 0.5 - frente + 0.01)) > 5) continue; // não dá mais para parar
        const p = r.linha.em(c.s0);
        const dec = this.decidir(v, 'caixa_amarela', p.x, p.y, this.pico ? 20 : 12, 0.2, true);
        v.caixas.set(c.id, dec.infringiu);
        if (dec.infringiu) this.iniciarInfracao(v, 'caixa_amarela', p.x, p.y);
      }
      if (!v.caixas.get(c.id) && bloqueada) parar(c.s0 - 0.5);
    }
    if (v.infracao === 'caixa_amarela' && !r.caixas.some((c) => v.s + L2 >= c.s0 - 1 && v.s - L2 <= c.s1)) {
      if (r.caixas.every((c) => v.s - L2 > c.s1)) v.infracao = null;
    }

    // semáforo da VV
    if (this.fase && r.sSinal !== null && r.grupoSinal && frente < r.sSinal + 0.5) {
      const cor = r.grupoSinal === 'principal' ? this.fase.principal : this.fase.secundaria;
      const ciclo = Math.floor(this.t / (this.iv.semaforo!.ciclo || 90));
      const dist = r.sSinal - frente;
      if (cor !== 'verde' && dist < 70) {
        if (!v.sinal || v.sinal.ciclo !== ciclo) {
          const freioNec = (v.v * v.v) / (2 * Math.max(0.5, dist));
          if (cor === 'amarelo' && freioNec > 3.5) v.sinal = { ciclo, passa: true }; // zona de dilema: passa legalmente
          else if (v.v > 4 && dist < Math.max(25, v.v * 2.5) && (!lider || lider.gap > dist + 2)) {
            const p = r.linha.em(r.sSinal);
            const ganho = r.grupoSinal === 'principal' ? this.fase.restanteVermelhoPrincipal : 30;
            const dec = this.decidir(v, 'avanco_sinal', p.x, p.y, ganho, cor === 'amarelo' ? 0.3 : 0.65, true);
            v.sinal = { ciclo, passa: dec.infringiu };
            if (dec.infringiu) this.iniciarInfracao(v, 'avanco_sinal', p.x, p.y);
          }
        }
        if (!v.sinal || !v.sinal.passa) parar(r.sSinal);
      }
    } else if (v.infracao === 'avanco_sinal' && r.sSinal !== null && v.s - L2 > r.sSinal + 15) v.infracao = null;

    // portões: brecha para entrar/atravessar a Africanos
    while (v.portao < r.portoes.length && frente > r.portoes[v.portao].s + 1.5) v.portao++;
    if (v.portao < r.portoes.length) {
      const p = r.portoes[v.portao];
      const dist = p.s - frente;
      if (v.liberadoAte < v.portao && dist < 40) {
        if (dist < 12 && v.v < 8) {
          if (v.v < 0.5) v.espera += 0.25;
          const brecha = brechaAceita(v.perfil, v.espera, p.entraNaPista, false);
          // só vai se couber inteiro do outro lado (não parar atravessado na pista)
          const precisa = p.entraNaPista ? v.L + 2 : p.sSaida - p.s + v.L + 1;
          const espaco = !lider || lider.gap > precisa || lider.v > 3;
          const sinalOk = !this.fase || r.grupoSinal !== 'secundaria' || v.portao > 0 || this.fase.secundaria === 'verde' || (v.sinal?.passa ?? false);
          if (espaco && sinalOk && this.brechaLivre(p.pista, p.xc, p.entraNaPista ? p.yEntrada : null, brecha, v)) {
            v.liberadoAte = v.portao;
            v.espera = 0;
          }
        }
        if (v.liberadoAte < v.portao) parar(p.s);
      }
    }

    // infrações de rota (conversão/retorno): termina quando completa a manobra
    if ((v.infracao === 'conversao_proibida' || v.infracao === 'retorno_proibido') && v.s > r.sMovFim + 10) v.infracao = null;

    // parada de ônibus/app
    if (v.parada && !v.parada.feita) {
      const pa = v.parada;
      if (pa.baia) v.offAlvo = frente > pa.s - 30 && (pa.ate === 0 || this.t < pa.ate) ? -3.3 : 0;
      if (pa.ate === 0) {
        parar(pa.s);
        if (frente > pa.s - 2 && v.v < 0.5) {
          pa.ate = this.t + pa.dur;
          if (!pa.baia && v.tipo === 'app') this.iniciarInfracao(v, 'parada_irregular', v.x, v.y);
          else if (!pa.baia && v.decisoes.some((d) => d.infracao === 'parada_irregular' && d.infringiu))
            this.iniciarInfracao(v, 'parada_irregular', v.x, v.y);
        }
      } else if (this.t < pa.ate) {
        restr(0.1, 0);
      } else {
        pa.feita = true;
        if (v.infracao === 'parada_irregular') v.infracao = null;
      }
    }

    // moto no corredor
    if (v.tipo === 'moto' && v.faixaIdx >= 0) {
      const antesDaConversao = v.s < r.sMovIni - 25;
      if (!v.corredorDecidido && antesDaConversao && lider && lider.gap < 12 && lider.v < 4 && v.v < 6) {
        v.corredorDecidido = true;
        const possivel = !this.iv.bloqueadoPorTachoes(v.x, v.y);
        const dec = this.decidir(v, 'moto_corredor', v.x, v.y, 40, 0.25, possivel);
        if (dec.infringiu) {
          v.offAlvo = v.faixaIdx === 0 ? -1.65 : 1.65;
          this.iniciarInfracao(v, 'moto_corredor', v.x, v.y);
        }
      }
      if (v.offAlvo !== 0 && (v.v > 11 || !antesDaConversao || this.iv.bloqueadoPorTachoes(v.x, v.y))) {
        v.offAlvo = 0;
        if (v.infracao === 'moto_corredor') v.infracao = null;
      }
    }

    // radar: quem decidiu correr reavalia perto da fiscalização (e volta a correr depois)
    if (v.vFator > 1 && eAfricanos) {
      const fa = this.iv.fiscalizacao('excesso_velocidade', v.x + v.hx * 60, v.y + v.hy * 60, this.t);
      const fq = this.iv.fiscalizacao('excesso_velocidade', v.x, v.y, this.t);
      if (!v.radarDecidido && fa.com > fa.base + 0.1) {
        v.radarDecidido = true;
        const dec = this.decidir(v, 'excesso_velocidade', v.x + v.hx * 60, v.y + v.hy * 60, 4, 0.35, true, fa);
        v.radarSuprimido = !dec.infringiu;
      } else if (v.radarSuprimido && fa.com <= fa.base + 0.05 && fq.com <= fq.base + 0.05) v.radarSuprimido = false;
      const acima = v.v > limiteEm(r, v.s) * 1.12;
      if (acima && !v.infracao) {
        if (!v.excessoContado) {
          v.excessoContado = true;
          this.iniciarInfracao(v, 'excesso_velocidade', v.x, v.y);
        } else v.infracao = 'excesso_velocidade';
      } else if (!acima && v.infracao === 'excesso_velocidade') v.infracao = null;
    }

    const a = livre - v.a * inter;
    return Math.max(-9, Math.min(v.a, a));
  }

  /**
   * Troca de faixa simplificada (estilo MOBIL): quem segue reto pela Africanos e está preso
   * atrás de alguém lento (ônibus no ponto, app parado, quem espera para converter) passa
   * para a faixa vizinha se lá houver mais espaço à frente e folga segura atrás.
   */
  private mudarFaixa(v: Veiculo) {
    const m = /^(africanos_(?:leste|oeste))_(\d)$/.exec(v.rota.id);
    if (!m || v.offAlvo !== 0 || Math.abs(v.off) > 0.2 || v.parada) return;
    if (v.s < 10 || v.s > v.rota.linha.comprimento - 40) return;
    if (v.rota.caixas.some((c) => v.s + v.L / 2 > c.s0 - 3 && v.s - v.L / 2 < c.s1 + 2)) return;
    const atual = this.obstaculo(v.x, v.y, v.hx, v.hy, 60, v.id, v.W, v.L / 2);
    if (!atual || atual.gap > 30 || atual.v > v.v + 1) return;
    let melhor: { rota: Rota; s: number; k: number; ganho: number } | null = null;
    const k0 = Number(m[2]);
    for (const k of [k0 - 1, k0 + 1]) {
      if (k < 0 || k > 2) continue;
      const nova = this.rotas.get(`${m[1]}_${k}`);
      if (!nova) continue;
      const sN = nova.linha.sMaisProximoReta(v.x, v.y);
      const p = nova.linha.em(sN);
      const frente = this.obstaculo(p.x - p.hx * 0.5, p.y - p.hy * 0.5, p.hx, p.hy, 60, v.id, v.W, v.L / 2);
      const tras = this.obstaculo(p.x + p.hx * 0.5, p.y + p.hy * 0.5, -p.hx, -p.hy, 40, v.id, v.W, v.L / 2);
      const gapF = frente ? frente.gap : 60;
      if (gapF < v.L + 4 || gapF < atual.gap + 8) continue;
      if (tras && (tras.gap < 3 || tras.gap < 2 + tras.vBruta * 1.0 - v.v * 0.5)) continue;
      const ganho = gapF - atual.gap + (frente ? (frente.v - atual.v) * 3 : 20);
      if (!melhor || ganho > melhor.ganho) melhor = { rota: nova, s: sN, k, ganho };
    }
    if (!melhor) return;
    const p = melhor.rota.linha.em(melhor.s);
    // deslocamento lateral para a troca ficar suave (normal à esquerda = (-hy, hx))
    v.off = (v.x - p.x) * -p.hy + (v.y - p.y) * p.hx;
    v.offAlvo = 0;
    v.rota = melhor.rota;
    v.s = melhor.s;
    v.faixaIdx = melhor.k;
    v.portao = 0;
    this.posicionar(v);
  }

  /**
   * A caixa está bloqueada se não há espaço para sair dela: alguém parado logo depois do fim
   * da caixa (menos que um carro de folga) ou parado dentro dela.
   */
  private caixaBloqueada(v: Veiculo, s0: number, s1: number): boolean {
    const linha = v.rota.linha;
    const p1 = linha.em(s1);
    const depois = this.obstaculo(p1.x, p1.y, p1.hx, p1.hy, v.L + 2, v.id, v.W, 0, -1, { linha, s: s1, off: 0 });
    if (depois && depois.v < 1.5) return true;
    const p0 = linha.em(s0);
    const dentro = this.obstaculo(p0.x - p0.hx * 0.5, p0.y - p0.hy * 0.5, p0.hx, p0.hy, s1 - s0, v.id, v.W, 0, -1, {
      linha,
      s: s0 - 0.5,
      off: 0,
    });
    return !!dentro && dentro.v < 0.5;
  }

  /**
   * Primeiro agente à frente. Em reta usa um "cone" na direção (hx, hy); se a trajetória faz
   * curva dentro do alcance, segue a própria polilinha (amostras a cada 2 m), para não
   * confundir carros de faixas vizinhas ou do sentido oposto com o líder.
   * Veículos no sentido oposto são ignorados (não são líder; viram conflito se cruzarem).
   */
  private obstaculo(
    x: number,
    y: number,
    hx: number,
    hy: number,
    look: number,
    meuId: number,
    meuW: number,
    meuL2: number,
    ignorar = -1,
    traj?: { linha: Polilinha; s: number; off: number }
  ) {
    let melhor: { gap: number; v: number; vBruta: number; id: number } | null = null;
    // amostras da trajetória quando há curva
    let amostras: { x: number; y: number; hx: number; hy: number; d: number }[] | null = null;
    if (traj) {
      const fim = traj.linha.em(traj.s + look);
      if (fim.hx * hx + fim.hy * hy < 0.995 || traj.s + look > traj.linha.comprimento) {
        amostras = [];
        for (let d = 0; d <= look; d += 2) {
          const q = traj.linha.em(traj.s + d);
          let qx = q.x - q.hy * traj.off;
          let qy = q.y + q.hx * traj.off;
          const alem = traj.s + d - traj.linha.comprimento;
          if (alem > 0) {
            qx += q.hx * alem;
            qy += q.hy * alem;
          }
          amostras.push({ x: qx, y: qy, hx: q.hx, hy: q.hy, d });
        }
      }
    }
    let bx0: number, bx1: number, by0: number, by1: number;
    if (amostras) {
      bx0 = Math.min(...amostras.map((a) => a.x));
      bx1 = Math.max(...amostras.map((a) => a.x));
      by0 = Math.min(...amostras.map((a) => a.y));
      by1 = Math.max(...amostras.map((a) => a.y));
    } else {
      bx0 = Math.min(x, x + hx * look);
      bx1 = Math.max(x, x + hx * look);
      by0 = Math.min(y, y + hy * look);
      by1 = Math.max(y, y + hy * look);
    }
    const cx0 = Math.floor((bx0 - 4) / CEL);
    const cx1 = Math.floor((bx1 + 4) / CEL);
    const cy0 = Math.floor((by0 - 4) / CEL);
    const cy1 = Math.floor((by1 + 4) / CEL);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cy = cy0; cy <= cy1; cy++) {
        const cel = this.grade.get(cx * 100003 + cy);
        if (!cel) continue;
        for (const o of cel) {
          if (o.id === meuId || o.id === ignorar) continue;
          let d: number;
          let lat: number;
          let rhx = hx;
          let rhy = hy;
          if (amostras) {
            let iMin = -1;
            let dMin = Infinity;
            for (let i = 0; i < amostras.length; i++) {
              const a = amostras[i];
              const q = (o.x - a.x) ** 2 + (o.y - a.y) ** 2;
              if (q < dMin) {
                dMin = q;
                iMin = i;
              }
            }
            const a = amostras[iMin];
            rhx = a.hx;
            rhy = a.hy;
            const dx = o.x - a.x;
            const dy = o.y - a.y;
            d = a.d + dx * rhx + dy * rhy;
            lat = Math.abs(-dx * rhy + dy * rhx);
          } else {
            const dx = o.x - x;
            const dy = o.y - y;
            d = dx * hx + dy * hy;
            lat = Math.abs(-dx * hy + dy * hx);
          }
          if (d <= 0 || d > look + o.L) continue;
          const dot = o.hx * rhx + o.hy * rhy;
          if (o.k === 'v' && dot < -0.3) continue; // sentido oposto
          // largura efetiva do outro na direção transversal
          const meiaLarg = Math.abs(dot) > 0.7 ? o.W / 2 : o.L / 2;
          if (lat > meuW / 2 + meiaLarg + 0.25) continue;
          const meioComp = Math.abs(dot) > 0.7 ? o.L / 2 : o.W / 2;
          const gap = d - meuL2 - meioComp;
          if (!melhor || gap < melhor.gap) melhor = { gap, v: Math.max(0, o.v * dot), vBruta: o.v, id: o.id };
        }
      }
    return melhor;
  }

  /** Há brecha na pista para quem precisa de `brecha` segundos? (yAlvo = só a faixa em que vai entrar) */
  private brechaLivre(pista: Pista, xc: number, yAlvo: number | null, brecha: number, eu: Veiculo | null): boolean {
    const g = this.rede.geo;
    const sinal = pista === 'leste' ? 1 : -1;
    const yMin = pista === 'leste' ? -g.borda : g.meio_canteiro;
    const yMax = pista === 'leste' ? -g.meio_canteiro : g.borda;
    const L = eu ? eu.L : 0.6;
    for (const o of this.veiculos) {
      if (eu && o.id === eu.id) continue;
      if (o.y < yMin - 0.5 || o.y > yMax + 0.5) continue;
      if (yAlvo !== null && Math.abs(o.y - yAlvo) > 2.4) continue;
      // Área de cruzamento ocupada. Em movimento: margem de segurança. Parado: só se está de fato
      // no corredor por onde vou passar (o pedestre passa entre carros parados).
      const dx = Math.abs(o.x - xc);
      const ocupa = o.v > 1 ? dx < 2.5 + L / 2 + o.L / 2 : eu !== null && dx < o.L / 2 + eu.W / 2 + 0.4;
      if (ocupa) return false;
      const alinhado = o.hx * sinal > 0.6;
      if (!alinhado) continue;
      if (eu === null && o.v < 3) continue; // pedestre passa entre carros lentos
      const dist = (xc - o.x) * sinal - o.L / 2;
      if (dist <= 0) continue;
      if (dist / Math.max(o.v, 0.5) < brecha) return false;
    }
    for (const p of this.pedestres) {
      if (p.estado !== 'pista1' && p.estado !== 'pista2') continue;
      if (p.y < yMin || p.y > yMax) continue;
      if (Math.abs(p.x - xc) < 3 + L / 2) return false;
    }
    return true;
  }

  private posicionar(v: Veiculo) {
    const p = v.rota.linha.em(v.s);
    v.hx = p.hx;
    v.hy = p.hy;
    v.x = p.x - p.hy * v.off;
    v.y = p.y + p.hx * v.off;
  }

  private concluir(v: Veiculo) {
    this.veiculos.splice(this.veiculos.indexOf(v), 1);
    const tempo = this.t - v.t0 + v.desvioS;
    this.m.concluidos++;
    this.m.somaTempo += tempo;
    const pa = this.m.porAprox[v.origem];
    pa.n++;
    pa.soma += tempo;
  }

  // ------------------------------------------------------------ PEDESTRES

  private travessiasDisponiveis(): { x: number; elevada: boolean }[] {
    const t = this.rede.travessias.map((tr) => ({ x: tr.x, elevada: false }));
    for (const x of this.iv.faixasElevadas()) {
      const perto = t.find((tr) => Math.abs(tr.x - x) < 15);
      if (perto) perto.elevada = true;
      else t.push({ x, elevada: true });
    }
    return t;
  }

  private criarPedestre() {
    const g = this.rede.geo;
    const rng = criarRng(Math.floor(this.rng.rnd() * 4294967296));
    const perfil = sortearPerfil(rng, 'pedestre', this.pico);
    const x = rng.entre(-220, 130);
    const lado = (rng.rnd() < 0.5 ? 1 : -1) as 1 | -1;
    const p: Pedestre = {
      id: this.proxId++,
      rng,
      perfil,
      x,
      y: lado * (g.borda + 2),
      lado,
      xTravessia: x,
      naFaixa: false,
      refugio: true,
      estado: 'calcada',
      vel: rng.entre(1.1, 1.5),
      hx: 1,
      hy: 0,
      t0: this.t,
      espera: 0,
      infracao: null,
      desistiuAte: 0,
      decisoes: [],
      semaforo: false,
    };
    const trs = this.travessiasDisponiveis();
    let tr = trs[0];
    for (const c of trs) if (Math.abs(c.x - x) < Math.abs(tr.x - x)) tr = c;
    const desvio = (2 * Math.abs(tr.x - x)) / p.vel;
    let naFaixa = true;
    if (desvio > 15) {
      const risco = (this.pico ? 0.55 : 0.4) - (tr.elevada ? 0 : 0.1);
      const dec = this.decidir(p, 'pedestre_fora_faixa', x, 0, desvio, risco, true);
      naFaixa = !dec.infringiu;
    }
    p.naFaixa = naFaixa;
    p.xTravessia = naFaixa ? tr.x : x;
    const naAbertura = (xx: number) =>
      (xx > g.abertura_vv[0] && xx < g.abertura_vv[1]) || (xx > g.abertura_norte[0] && xx < g.abertura_norte[1]);
    // fora das aberturas o canteiro serve de refúgio; nas aberturas só com refúgio construído
    p.refugio = !naAbertura(p.xTravessia) || this.iv.temRefugioPerto(p.xTravessia);
    p.semaforo = naFaixa && !!this.iv.semaforo && Math.abs(p.xTravessia - g.x_vv) < 15;
    (p as Pedestre & { elevada?: boolean }).elevada = naFaixa && tr.elevada;
    this.pedestres.push(p);
  }

  private passoPedestres(dt: number) {
    const g = this.rede.geo;
    const terminados: Pedestre[] = [];
    for (const p of this.pedestres) {
      const elevada = (p as Pedestre & { elevada?: boolean }).elevada ?? false;
      const pistaPerto: Pista = p.lado < 0 ? 'leste' : 'oeste';
      const pistaLonge: Pista = p.lado < 0 ? 'oeste' : 'leste';
      const brecha = elevada ? 2.5 : brechaAceita(p.perfil, p.espera, false, true);
      const tempoPista = (g.borda - g.meio_canteiro) / p.vel;
      const pode = (pista: Pista, extra = 0) => {
        if (p.semaforo && this.fase) return this.fase.pedestre;
        return this.brechaLivre(pista, p.x, null, brecha + extra, null);
      };
      switch (p.estado) {
        case 'calcada': {
          const d = p.xTravessia - p.x;
          if (Math.abs(d) < 0.5) {
            p.estado = 'meio_fio';
            p.y = p.lado * g.borda;
          } else {
            const passo = Math.sign(d) * Math.min(Math.abs(d), p.vel * dt);
            p.x += passo;
            p.hx = Math.sign(d);
            p.hy = 0;
          }
          break;
        }
        case 'meio_fio': {
          p.espera += dt;
          const ok = p.refugio ? pode(pistaPerto) : pode(pistaPerto) && pode(pistaLonge, tempoPista + 2);
          if (ok) {
            p.estado = 'pista1';
            p.espera = 0;
            if (!p.naFaixa) this.iniciarInfracao(p, 'pedestre_fora_faixa', p.x, 0);
          }
          break;
        }
        case 'pista1':
        case 'pista2': {
          const alvo = p.estado === 'pista1' ? (p.refugio ? p.lado * g.meio_canteiro : -p.lado * g.borda) : -p.lado * g.borda;
          const d = alvo - p.y;
          p.hx = 0;
          p.hy = Math.sign(d);
          p.y += Math.sign(d) * Math.min(Math.abs(d), p.vel * (p.semaforo ? 1.1 : 1.15) * dt);
          if (Math.abs(alvo - p.y) < 0.05) {
            if (p.estado === 'pista1' && p.refugio) p.estado = 'canteiro';
            else p.estado = 'chegou';
          }
          break;
        }
        case 'canteiro': {
          p.espera += dt;
          if (pode(pistaLonge)) {
            p.estado = 'pista2';
            p.y = -p.lado * g.meio_canteiro;
            p.espera = 0;
          }
          break;
        }
        case 'chegou':
          terminados.push(p);
          break;
      }
    }
    for (const p of terminados) {
      this.pedestres.splice(this.pedestres.indexOf(p), 1);
      this.m.pedConcluidos++;
      this.m.pedSoma += this.t - p.t0;
    }
  }

  // ------------------------------------------------------------- GRADE

  private montarGrade() {
    this.grade.clear();
    for (const v of this.veiculos) this.inserirNaGrade({ k: 'v', id: v.id, x: v.x, y: v.y, hx: v.hx, hy: v.hy, v: v.v, L: v.L, W: v.W, ref: v });
    for (const p of this.pedestres) {
      if (p.estado === 'pista1' || p.estado === 'pista2' || p.estado === 'meio_fio' || p.estado === 'canteiro') {
        const naPista = p.estado === 'pista1' || p.estado === 'pista2';
        if (!naPista) continue;
        this.inserirNaGrade({ k: 'p', id: p.id, x: p.x, y: p.y, hx: p.hx, hy: p.hy, v: p.vel, L: 0.8, W: 0.8, ref: p });
      }
    }
  }

  private inserirNaGrade(e: Ente) {
    const k = Math.floor(e.x / CEL) * 100003 + Math.floor(e.y / CEL);
    let c = this.grade.get(k);
    if (!c) this.grade.set(k, (c = []));
    c.push(e);
  }

  // ------------------------------------------------------------ CONFLITOS

  private detectarConflitos() {
    const vistos = new Set<string>();
    for (const cel of this.grade.values()) {
      for (const a of cel) {
        const vizinhos: Ente[] = [];
        const ax = Math.floor(a.x / CEL);
        const ay = Math.floor(a.y / CEL);
        for (let i = -1; i <= 1; i++)
          for (let j = -1; j <= 1; j++) {
            const c = this.grade.get((ax + i) * 100003 + (ay + j));
            if (c) vizinhos.push(...c);
          }
        for (const b of vizinhos) {
          if (b.id <= a.id) continue;
          const chave = `${a.id}-${b.id}`;
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 14) continue;
          const dot = a.hx * b.hx + a.hy * b.hy;
          const temPed = a.k === 'p' || b.k === 'p';
          if (!temPed && dot > 0.9) continue; // mesmo sentido (seguindo): a IDM cuida
          if (!temPed && dot < -0.5) continue; // sentidos opostos em faixas vizinhas: só passam
          if (a.v < 0.5 && b.v < 0.5) continue;
          // previsão ao longo da trajetória de cada um (não em linha reta), a cada 0,25 s
          const lim = temPed ? 1.5 : (a.W + b.W) / 2 + 0.6;
          let tc = -1;
          for (let t = 0; t <= 1.5; t += 0.25) {
            const pa = this.prever(a, t);
            const pb = this.prever(b, t);
            if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < lim) {
              tc = t;
              break;
            }
          }
          if (tc < 0) continue;
          const ultima = this.paresConflito.get(chave) ?? -99;
          if (this.t - ultima < 10) continue;
          this.paresConflito.set(chave, this.t);
          const grave = tc < 0.75;
          const px = (a.x + b.x) / 2;
          const py = (a.y + b.y) / 2;
          if (grave) this.m.graves++;
          this.m.conflitos++;
          this.addCalor(px, py, grave ? 'conflito_grave' : 'conflito', grave ? 1 : 0.6);
          const pos = this.rede.proj.paraGeo([px, py]);
          this.eventos.push({
            tempo: this.t,
            tipo: grave ? 'conflito_grave' : 'conflito',
            agenteId: a.id,
            pos,
            texto: `${grave ? 'Conflito grave' : 'Conflito'} entre #${a.id} e #${b.id} (TTC ${tc.toFixed(1)} s)`,
          });
        }
      }
    }
    if (this.paresConflito.size > 5000) {
      for (const [k, t] of this.paresConflito) if (this.t - t > 20) this.paresConflito.delete(k);
    }
  }

  /** Posição prevista de um agente daqui a t segundos, seguindo a própria rota. */
  private prever(e: Ente, t: number): [number, number] {
    if (e.k === 'p') return [e.x + e.hx * e.v * t, e.y + e.hy * e.v * t];
    const v = e.ref;
    const q = v.rota.linha.em(v.s + v.v * t);
    return [q.x - q.hy * v.off, q.y + q.hx * v.off];
  }

  private addCalor(x: number, y: number, tipo: PontoCalor['tipo'], peso: number, infracao?: TipoInfracao) {
    if (this.calor.length > 20000) return;
    this.calor.push({ pos: this.rede.proj.paraGeo([x, y]), peso, tipo, infracao, tempo: this.t });
  }

  // -------------------------------------------------------------- MÉTRICAS

  private filas(): Record<Aproximacao, number> {
    const f = Object.fromEntries(APROX.map((a) => [a, 0])) as Record<Aproximacao, number>;
    for (const v of this.veiculos) if (v.v < 2) f[v.origem]++;
    for (const [, fila] of this.pendentes) for (const p of fila) f[p.v.origem]++;
    return f;
  }

  private atualizarFilaMaxima() {
    if (this.passos % 8) return;
    const f = this.filas();
    for (const a of APROX) this.m.filaMaxima = Math.max(this.m.filaMaxima, f[a]);
  }

  metricas(): Metricas {
    const m = this.m;
    const horas = Math.max(this.t - this.tInicioMetricas, 60) / 3600;
    const infrTotal = INFRACOES.reduce((acc, k) => acc + m.infracoes[k], 0);
    const pesoInfr = INFRACOES.reduce((acc, k) => acc + m.infracoes[k] * GRAVIDADE[k], 0);
    const bruto = (m.graves * 8 + m.conflitos * 2 + pesoInfr) / horas;
    const tempoMedioPorAproximacao = Object.fromEntries(
      APROX.map((a) => [a, m.porAprox[a].n ? m.porAprox[a].soma / m.porAprox[a].n : 0])
    ) as Record<Aproximacao, number>;
    return {
      tempo: this.t,
      veiculosNaRede: this.veiculos.length,
      pedestresNaRede: this.pedestres.length,
      concluidos: m.concluidos,
      filaPorAproximacao: this.filas(),
      filaMaxima: m.filaMaxima,
      tempoMedioTravessiaS: m.concluidos ? m.somaTempo / m.concluidos : 0,
      tempoMedioPorAproximacao,
      infracoes: { ...m.infracoes },
      infracoesTotal: infrTotal,
      desistencias: m.desistencias,
      conflitos: m.conflitos,
      conflitosGraves: m.graves,
      indiceRisco: Math.round(100 * (1 - Math.exp(-bruto / 1500))),
    };
  }

  /** Tempo médio de travessia dos pedestres (s). */
  get tempoMedioPedestreS() {
    return this.m.pedConcluidos ? this.m.pedSoma / this.m.pedConcluidos : 0;
  }

  pontosCalor(): PontoCalor[] {
    return this.calor;
  }

  // ------------------------------------------------------------------ SAÍDA

  private estado(v: Veiculo): AgenteEstado {
    return {
      id: v.id,
      tipo: v.tipo,
      pos: this.rede.proj.paraGeo([v.x, v.y]),
      rumo: this.rede.proj.rumo(v.hx, v.hy),
      velKmh: v.v * 3.6,
      comprimento: v.L,
      largura: v.W,
      infracao: v.infracao,
      desistiu: this.t < v.desistiuAte,
      parado: v.v < 0.5,
      origem: v.origem,
      destino: v.rota.destino,
    };
  }

  private estadoPed(p: Pedestre): AgenteEstado {
    return {
      id: p.id,
      tipo: 'pedestre',
      pos: this.rede.proj.paraGeo([p.x, p.y]),
      rumo: this.rede.proj.rumo(p.hx, p.hy),
      velKmh: p.estado === 'meio_fio' || p.estado === 'canteiro' ? 0 : p.vel * 3.6,
      comprimento: 0.6,
      largura: 0.6,
      infracao: p.estado === 'pista1' || p.estado === 'pista2' || p.estado === 'canteiro' ? p.infracao : null,
      desistiu: this.t < p.desistiuAte,
      parado: p.estado === 'meio_fio' || p.estado === 'canteiro',
      origem: p.lado > 0 ? 'calcada_norte' : 'calcada_sul',
      destino: p.lado > 0 ? 'calcada_sul' : 'calcada_norte',
    };
  }

  quadro(): Quadro {
    const eventos = this.eventos;
    this.eventos = [];
    return {
      tempo: this.t,
      agentes: [...this.veiculos.map((v) => this.estado(v)), ...this.pedestres.map((p) => this.estadoPed(p))],
      eventos,
      metricas: this.metricas(),
      semaforo: this.fase ? { principal: this.fase.principal, secundaria: this.fase.secundaria, pedestre: this.fase.pedestre } : undefined,
    };
  }

  detalhe(id: number): AgenteDetalhe | null {
    const v = this.veiculos.find((a) => a.id === id);
    if (v)
      return {
        ...this.estado(v),
        perfil: v.perfil,
        decisoes: v.decisoes,
        tempoNaRede: this.t - v.t0,
        movimento: v.rota.id,
      };
    const p = this.pedestres.find((a) => a.id === id);
    if (p)
      return {
        ...this.estadoPed(p),
        perfil: p.perfil,
        decisoes: p.decisoes,
        tempoNaRede: this.t - p.t0,
        movimento: p.naFaixa ? 'travessia_na_faixa' : 'travessia_fora_da_faixa',
      };
    return null;
  }
}

