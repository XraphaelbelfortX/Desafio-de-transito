import { Aleatorio, sigmoide } from './aleatorio';
import { kmh, paraKmh, type Vec2 } from './geometria';
import type { Rede } from './rede';
import { type Desejo, DESEJOS, ehNoite, fatorPedestres, fatorVeiculos, FROTA, PEDESTRES_PICO } from './demanda';
import { AGENTE_FIM, AGENTE_INICIO, type IntervencaoLocal } from './intervencoes';
import { derivarConfig, type Malha, montarMalha, type PontoCedencia, type Rota, type Semaforo } from './rotas';

/**
 * Motor de simulação microscópica por agentes.
 *
 * Cada veículo segue uma rota (faixas e conectores da rede), acelera pelo modelo IDM,
 * para em semáforos, espera brecha para cruzar ou entrar na avenida e decide, com
 * fatores explícitos, se faz a manobra proibida, se avança o sinal e se cede a vez ao
 * pedestre. Conflitos (quase-acidentes) são medidos pelo PET: o tempo entre um agente
 * deixar um ponto de cruzamento e outro chegar a ele.
 */

export type TipoAgente = 'carro' | 'moto' | 'onibus' | 'pedestre';

export type TipoInfracao = 'conversao_proibida' | 'retorno_proibido' | 'avanco_sinal' | 'excesso_velocidade';

export const NOME_INFRACAO: Record<TipoInfracao, string> = {
  conversao_proibida: 'Conversão proibida',
  retorno_proibido: 'Retorno proibido',
  avanco_sinal: 'Avanço de sinal vermelho',
  excesso_velocidade: 'Excesso de velocidade',
};

export type TipoConflito = 'cruzamento' | 'pedestre' | 'traseira';

export const NOME_CONFLITO: Record<TipoConflito, string> = {
  cruzamento: 'Cruzamento de trajetórias',
  pedestre: 'Veículo × pedestre',
  traseira: 'Risco de colisão traseira',
};

export interface Fator {
  rotulo: string;
  /** Contribuição para a chance (escala logística: positivo aumenta a chance). */
  efeito: number;
}

export interface Decisao {
  t: number;
  tipo: 'rota' | 'brecha' | 'sinal' | 'velocidade' | 'pedestre' | 'travessia' | 'conflito';
  titulo: string;
  texto: string;
  fatores?: Fator[];
  probabilidade?: number;
  sorteio?: number;
  infracao?: boolean;
}

export interface Agente {
  id: number;
  tipo: TipoAgente;
  rota: Rota;
  desejo: Desejo | null;
  s: number;
  v: number;
  vDes: number;
  comp: number;
  aMax: number;
  b: number;
  T: number;
  s0: number;
  imp: number;
  nasc: number;
  espera: number;
  esperaTotal: number;
  peca: number;
  cedencia: number;
  retencao: Map<number, 'para' | 'avanca'>;
  cedePedestre: Map<string, boolean>;
  obedeceFiscalizacao: boolean;
  infrator: boolean;
  infracoes: TipoInfracao[];
  decisoes: Decisao[];
  estado: string;
  excesso: { v: number; x: number; y: number; limite: number } | null;
  x: number;
  y: number;
  ang: number;
  elem: string;
  sElem: number;
  ped?: {
    fase: 'aguardando' | 'atravessando' | 'refugio';
    travessiaId: string;
    vp: number;
    alvo: number;
    correu: boolean;
  };
}

export interface Evento {
  t: number;
  x: number;
  y: number;
  tipo: 'conflito' | 'infracao';
  subtipo: TipoConflito | TipoInfracao;
  grave: boolean;
  peso: number;
  agentes: number[];
  descricao: string;
}

export interface Metricas {
  /** Horas simuladas desde o último reinício. */
  horas: number;
  veiculos: number;
  atrasoMedio: number;
  infracoes: Record<TipoInfracao, number>;
  conflitos: Record<TipoConflito, number>;
  conflitosGraves: number;
  /** Índice de risco: conflitos ponderados por gravidade e vulnerabilidade. */
  risco: number;
  pedestres: number;
  esperaMediaPedestre: number;
}

interface Perfil {
  imp: number;
  vDes: number;
  comp: number;
  aMax: number;
  b: number;
  s0: number;
  T: number;
  obedece: boolean;
}

interface Passagem {
  t: number;
  ag: number;
  v: number;
  ped: boolean;
}

const LIMITE_TOLERANCIA = kmh(7);
const PET_VEICULO = 1.5;
const PET_PEDESTRE = 1.5;

const vazioInfr = (): Record<TipoInfracao, number> => ({
  conversao_proibida: 0,
  retorno_proibido: 0,
  avanco_sinal: 0,
  excesso_velocidade: 0,
});
const vazioConf = (): Record<TipoConflito, number> => ({ cruzamento: 0, pedestre: 0, traseira: 0 });

export const NOME_TIPO: Record<TipoAgente, string> = {
  carro: 'Carro',
  moto: 'Moto',
  onibus: 'Ônibus',
  pedestre: 'Pedestre',
};

/**
 * Tempo para um veículo percorrer dist, supondo que ele acelera até a velocidade desejada
 * (estimativa prudente: quem acabou de passar por uma lombada chega mais rápido do que parece).
 */
const tempoChegada = (o: { v: number; vDes: number; aMax: number }, dist: number) => {
  const a = 0.7 * o.aMax;
  const v = Math.max(0.5, o.v);
  if (v >= o.vDes) return dist / v;
  const t1 = (o.vDes - v) / a;
  const d1 = v * t1 + 0.5 * a * t1 * t1;
  if (dist <= d1) return (-v + Math.sqrt(v * v + 2 * a * dist)) / a;
  return t1 + (dist - d1) / o.vDes;
};

const fmt = (v: number, casas = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });

export class Motor {
  readonly rede: Rede;
  malha: Malha;
  t = 0;
  horaInicial = 7;
  agentes: Agente[] = [];
  eventos: Evento[] = [];
  /** Quem perdeu a conversão: desvio pelo bairro (fora do mapa) ou retorno legal, desde o último reinício. */
  fluxoRetorno = { desvioExterno: 0, retornoLegal: 0, kmDesvio: 0 };
  private rng: Aleatorio;
  private proxId = 1;
  private fila = new Map<string, (() => Agente | null)[]>();
  private passagens = new Map<number, { a?: Passagem; b?: Passagem }>();
  private pares = new Map<string, number>();
  private porElemento = new Map<string, Agente[]>();
  private porTravessia = new Map<string, Agente[]>();
  private tReset = 0;
  private acc = {
    veiculos: 0,
    atraso: 0,
    infracoes: vazioInfr(),
    conflitos: vazioConf(),
    graves: 0,
    risco: 0,
    pedestres: 0,
    esperaPed: 0,
  };

  constructor(rede: Rede, intervencoes: IntervencaoLocal[] = [], semente = 1) {
    this.rede = rede;
    this.rng = new Aleatorio(semente);
    this.malha = montarMalha(rede, derivarConfig(rede, intervencoes));
  }

  hora(): number {
    return this.horaInicial + this.t / 3600;
  }

  definirHora(h: number) {
    this.horaInicial = h - this.t / 3600;
  }

  /** Troca as intervenções. Agentes que dependiam de um movimento que deixou de existir saem. */
  configurar(intervencoes: IntervencaoLocal[]) {
    const fases = new Map(this.malha.config.semaforos.map((s) => [s.cruzamento, s.fase0]));
    this.malha = montarMalha(this.rede, derivarConfig(this.rede, intervencoes));
    for (const s of this.malha.config.semaforos) s.fase0 = fases.get(s.cruzamento) ?? this.t;
    const existe = this.malha.elementos;
    this.agentes = this.agentes.filter((a) =>
      a.rota.pecas.every((p) => existe.has(p.elem.id) || p.sRota0 + (p.sElem1 - p.sElem0) <= a.s)
    );
    this.passagens.clear();
    this.fila.clear();
    this.reiniciarMetricas();
  }

  reiniciarMetricas() {
    this.tReset = this.t;
    this.fluxoRetorno = { desvioExterno: 0, retornoLegal: 0, kmDesvio: 0 };
    this.eventos = [];
    this.pares.clear();
    this.acc = {
      veiculos: 0,
      atraso: 0,
      infracoes: vazioInfr(),
      conflitos: vazioConf(),
      graves: 0,
      risco: 0,
      pedestres: 0,
      esperaPed: 0,
    };
  }

  metricas(): Metricas {
    const horas = Math.max(1e-6, (this.t - this.tReset) / 3600);
    const porHora = <K extends string>(r: Record<K, number>) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v as number) / horas])) as Record<K, number>;
    return {
      horas,
      veiculos: this.acc.veiculos / horas,
      atrasoMedio: this.acc.veiculos ? this.acc.atraso / this.acc.veiculos : 0,
      infracoes: porHora(this.acc.infracoes),
      conflitos: porHora(this.acc.conflitos),
      conflitosGraves: this.acc.graves / horas,
      risco: this.acc.risco / horas,
      pedestres: this.acc.pedestres / horas,
      esperaMediaPedestre: this.acc.pedestres ? this.acc.esperaPed / this.acc.pedestres : 0,
    };
  }

  // ------------------------------------------------------------- semáforos
  estadoSemaforo(sem: Semaforo, grupo: 'avenida' | 'transversal' | 'pedestre') {
    const { verdeAvenida: vA, verdeTransversal: vT, amarelo: am, vermelhoGeral: rg } = sem.tempos;
    const ciclo = vA + vT + 2 * (am + rg);
    const tc = (((this.t - sem.fase0) % ciclo) + ciclo) % ciclo;
    const ini = grupo === 'avenida' ? 0 : vA + am + rg;
    const verde = grupo === 'avenida' ? vA : vT;
    const rel = (((tc - ini) % ciclo) + ciclo) % ciclo;
    if (rel < verde) return { cor: 'verde' as const, restante: verde - rel, ateVerde: 0 };
    if (rel < verde + am && grupo !== 'pedestre') return { cor: 'amarelo' as const, restante: verde + am - rel, ateVerde: ciclo - rel };
    return { cor: 'vermelho' as const, restante: ciclo - rel, ateVerde: ciclo - rel };
  }

  private semaforo(id: string) {
    return this.malha.config.semaforos.find((s) => s.id === id);
  }

  // ------------------------------------------------------------- fiscalização
  agenteEmServico(): boolean {
    const h = ((this.hora() % 24) + 24) % 24;
    return h >= AGENTE_INICIO && h < AGENTE_FIM;
  }

  /** Fiscalização percebida num ponto (0 a 1) e a frase que explica. */
  fiscalizacao(p: Vec2): { F: number; texto: string[] } {
    const cfg = this.malha.config;
    let resto = 1;
    const texto: string[] = [];
    for (const c of cfg.cameras) {
      const d = Math.hypot(c.p.x - p.x, c.p.y - p.y);
      if (d >= 60) continue;
      const f = 0.6 * (d < 36 ? 1 : (60 - d) / 24);
      resto *= 1 - f;
      texto.push(`câmera a ${fmt(d)} m`);
    }
    if (this.agenteEmServico()) {
      for (const g of cfg.agentes) {
        const d = Math.hypot(g.p.x - p.x, g.p.y - p.y);
        if (d >= 45) continue;
        const f = 0.9 * (d < 27 ? 1 : (45 - d) / 18);
        resto *= 1 - f;
        texto.push(`agente a ${fmt(d)} m`);
      }
    } else if (cfg.agentes.length) {
      texto.push(`agente fora do horário (${AGENTE_INICIO}h–${AGENTE_FIM}h)`);
    }
    return { F: 1 - resto, texto };
  }

  private barreira(p: Vec2): { B: number; n: number } {
    const n = this.malha.config.tachoes.filter((t) => Math.hypot(t.p.x - p.x, t.p.y - p.y) < 15).length;
    return { B: n === 0 ? 0 : n === 1 ? 0.75 : 0.9, n };
  }

  // ------------------------------------------------------------- criação
  private perfilVeiculo(tipo: Exclude<TipoAgente, 'pedestre'>): Perfil {
    const noite = ehNoite(this.hora());
    const imp = Math.min(1, Math.max(0, this.rng.normal(0.45, 0.22)));
    const base = { carro: [56, 8, 35, 95], moto: [61, 10, 35, 110], onibus: [47, 5, 30, 65] }[tipo];
    const vKmh = Math.min(base[3], Math.max(base[2], this.rng.normal(base[0] + (noite ? 7 : 0) + (imp - 0.45) * 12, base[1])));
    const din = {
      carro: { comp: 4.5, aMax: 1.6, b: 2.2, s0: 2 },
      moto: { comp: 2.2, aMax: 2.4, b: 2.8, s0: 1 },
      onibus: { comp: 12, aMax: 0.9, b: 1.6, s0: 3 },
    }[tipo];
    return {
      imp,
      vDes: kmh(vKmh),
      ...din,
      T: tipo === 'moto' ? 0.9 : 1.45 - 0.55 * imp,
      obedece: this.rng.proximo() < (tipo === 'moto' ? 0.85 : 0.93),
    };
  }

  private novoAgente(tipo: TipoAgente, rota: Rota, desejo: Desejo | null, perfilDado?: Perfil): Agente {
    const p = rota.linha.ponto(0);
    const perfil: Perfil =
      perfilDado ??
      (tipo === 'pedestre'
        ? { imp: Math.min(1, Math.max(0, this.rng.normal(0.45, 0.22))), vDes: 1.3, comp: 0.5, aMax: 1, b: 1, s0: 0.5, T: 1, obedece: true }
        : this.perfilVeiculo(tipo));
    return {
      id: this.proxId++,
      tipo,
      rota,
      desejo,
      s: 0,
      v: tipo === 'pedestre' ? 0 : Math.min(perfil.vDes, kmh(40)),
      vDes: perfil.vDes,
      comp: perfil.comp,
      aMax: perfil.aMax,
      b: perfil.b,
      T: perfil.T,
      s0: perfil.s0,
      imp: perfil.imp,
      nasc: this.t,
      espera: 0,
      esperaTotal: 0,
      peca: 0,
      cedencia: 0,
      retencao: new Map(),
      cedePedestre: new Map(),
      obedeceFiscalizacao: perfil.obedece,
      infrator: false,
      infracoes: [],
      decisoes: [],
      estado: 'em movimento',
      excesso: null,
      x: p.x,
      y: p.y,
      ang: p.ang,
      elem: rota.pecas[0].elem.id,
      sElem: rota.pecas[0].sElem0,
    };
  }

  private registrar(a: Agente, d: Omit<Decisao, 't'>) {
    a.decisoes.unshift({ t: this.t, ...d });
    if (a.decisoes.length > 10) a.decisoes.length = 10;
  }

  /** Escolhe a rota do desejo, com a decisão de infringir explicada fator a fator. */
  private escolherRota(desejo: Desejo, tipo: Exclude<TipoAgente, 'pedestre'>, a: Pick<Agente, 'imp'>): { rota: Rota; decisao: Omit<Decisao, 't'> } {
    const opcoes = this.malha.opcoes.get(desejo.id) ?? [];
    const legais = opcoes.filter((o) => o.opcao !== 'infracao').sort((x, y) => x.tempoEstimado - y.tempoEstimado);
    const infr = opcoes.filter((o) => o.opcao === 'infracao').sort((x, y) => x.tempoEstimado - y.tempoEstimado);
    const legal = legais[0];
    const ilegal = infr[0];
    const textoLegal = (r: Rota) =>
      r.opcao === 'desvio_externo'
        ? `${r.descricao} Desvio estimado de ${fmt(r.desvioExterno / 1000, 1)} km.`
        : r.descricao;
    if (!ilegal) {
      return {
        rota: legal,
        decisao: { tipo: 'rota', titulo: 'Rota legal', texto: `Quer ${desejo.descricao}. ${textoLegal(legal)}` },
      };
    }
    if (!legal) {
      return {
        rota: ilegal,
        decisao: { tipo: 'rota', titulo: 'Única rota possível', texto: ilegal.descricao, infracao: true },
      };
    }
    const ganhoMin = (legal.tempoEstimado - ilegal.tempoEstimado) / 60;
    const ponto = ilegal.manobra?.ponto ?? ilegal.linha.ponto(ilegal.comprimento / 2);
    const fisc = this.fiscalizacao(ponto);
    const bar = this.barreira(ponto);
    const noite = ehNoite(this.hora());
    const fatores: Fator[] = [
      { rotulo: 'Tendência a respeitar a placa', efeito: -1.8 },
      {
        rotulo:
          ganhoMin >= 0
            ? `Economiza ${fmt(ganhoMin, 1)} min em relação à rota legal`
            : `A rota legal é ${fmt(-ganhoMin, 1)} min mais curta`,
        efeito: 1.0 * ganhoMin,
      },
      { rotulo: `Perfil do motorista (impaciência ${fmt(a.imp * 100)}%)`, efeito: 1.2 * (a.imp - 0.5) * 2 },
    ];
    if (tipo === 'moto') fatores.push({ rotulo: 'Motociclista', efeito: 0.5 });
    if (noite) fatores.push({ rotulo: 'Noite (menos fiscalização percebida)', efeito: 0.4 });
    if (fisc.F > 0) fatores.push({ rotulo: `Fiscalização: ${fisc.texto.filter((t) => !t.includes('fora')).join(', ')}`, efeito: -3.5 * fisc.F });
    if (bar.B > 0) fatores.push({ rotulo: `Tachões no caminho (${bar.n} linha${bar.n > 1 ? 's' : ''})`, efeito: -2.2 * bar.B });
    const z = fatores.reduce((acc, f) => acc + f.efeito, 0);
    const p = sigmoide(z);
    const sorteio = this.rng.proximo();
    const infringe = sorteio < p;
    const rota = infringe ? ilegal : legal;
    return {
      rota,
      decisao: {
        tipo: 'rota',
        titulo: infringe ? (ilegal.infracao === 'retorno_proibido' ? 'Decidiu fazer retorno proibido' : 'Decidiu fazer conversão proibida') : 'Decidiu seguir a rota legal',
        texto: `Quer ${desejo.descricao}. ${infringe ? ilegal.descricao : textoLegal(legal)}`,
        fatores,
        probabilidade: p,
        sorteio,
        infracao: infringe,
      },
    };
  }

  private gerar(dt: number) {
    const h = this.hora();
    const fv = fatorVeiculos(h);
    const tipoVeiculo = () => this.rng.escolher(FROTA);
    const enfileirar = (entrada: string, fab: () => Agente | null) => {
      const l = this.fila.get(entrada) ?? [];
      if (l.length < 40) l.push(fab);
      this.fila.set(entrada, l);
    };
    for (const d of DESEJOS) {
      const lambda = (d.volumePico * fv) / 3600;
      if (this.rng.proximo() >= lambda * dt) continue;
      const tipo = tipoVeiculo();
      if (d.id === 'oeste_reto' || d.id === 'leste_reto') {
        const pesos = tipo === 'onibus' ? { 0: 0.05, 1: 0.25, 2: 0.7 } : { 0: 0.3, 1: 0.37, 2: 0.33 };
        const i = Number(this.rng.escolher(pesos as Record<'0' | '1' | '2', number>));
        const rota = (d.id === 'oeste_reto' ? this.malha.retas.oeste : this.malha.retas.leste)[i];
        const perfil = this.perfilVeiculo(tipo);
        enfileirar(rota.pecas[0].elem.id, () => {
          const ag = this.novoAgente(tipo, rota, d, perfil);
          this.registrar(ag, { tipo: 'rota', titulo: 'Rota legal', texto: `Quer ${d.descricao}.` });
          return ag;
        });
      } else {
        const perfil = this.perfilVeiculo(tipo);
        const escolha = this.escolherRota(d, tipo, perfil);
        if (escolha.rota.opcao === 'desvio_externo') {
          this.fluxoRetorno.desvioExterno++;
          this.fluxoRetorno.kmDesvio += escolha.rota.desvioExterno / 1000;
        } else if (escolha.rota.opcao === 'legal' && escolha.rota.pecas.some((pc) => pc.elem.ehRetorno)) this.fluxoRetorno.retornoLegal++;
        enfileirar(escolha.rota.pecas[0].elem.id, () => {
          const ag = this.novoAgente(tipo, escolha.rota, d, perfil);
          this.registrar(ag, escolha.decisao);
          return ag;
        });
      }
    }
    // pedestres
    const fp = fatorPedestres(h);
    for (const t of this.rede.travessias) {
      const lambda = ((PEDESTRES_PICO[t.id] ?? 0) * fp) / 3600;
      if (this.rng.proximo() >= lambda * dt) continue;
      const rotas = this.malha.pedestres.get(t.id);
      if (!rotas) continue;
      const rota = this.rng.proximo() < 0.5 ? rotas.sn : rotas.ns;
      const ag = this.novoAgente('pedestre', rota, null);
      const idoso = this.rng.proximo() < 0.12;
      ag.ped = {
        fase: 'aguardando',
        travessiaId: t.id,
        vp: idoso ? this.rng.entre(0.75, 0.95) : Math.min(1.6, Math.max(1, this.rng.normal(1.3, 0.15))),
        alvo: 1.6,
        correu: false,
      };
      ag.s = 1.6;
      ag.estado = 'esperando para atravessar';
      this.registrar(ag, { tipo: 'travessia', titulo: idoso ? 'Pedestre idoso' : 'Pedestre', texto: rota.descricao });
      this.agentes.push(ag);
    }
    // libera a fila de cada entrada quando o início da faixa está livre
    for (const [entrada, l] of this.fila) {
      if (!l.length) continue;
      const naFaixa = this.porElemento.get(entrada) ?? [];
      if (naFaixa.some((o) => o.sElem < o.comp + 10)) continue;
      const ag = l.shift()!();
      if (!ag) continue;
      // entra numa velocidade compatível com o veículo à frente
      const lider = naFaixa.find((o) => o.sElem > 0);
      if (lider) {
        const gap = lider.sElem - lider.comp - ag.s0;
        ag.v = Math.min(ag.v, lider.v + Math.sqrt(Math.max(0, 2 * ag.b * 0.5 * gap)));
      }
      this.agentes.push(ag);
    }
  }

  // ------------------------------------------------------------- passo
  passo(dt: number) {
    this.indexar();
    this.gerar(dt);
    this.indexar();
    const sairam: Agente[] = [];
    for (const a of this.agentes) {
      const sAntes = a.s;
      if (a.tipo === 'pedestre') this.moverPedestre(a, dt);
      else this.moverVeiculo(a, dt);
      this.passagensZonas(a, sAntes);
      this.atualizarPosicao(a);
      if (a.s >= a.rota.comprimento - 0.05) sairam.push(a);
    }
    for (const a of sairam) this.concluir(a);
    if (sairam.length) {
      const fora = new Set(sairam);
      this.agentes = this.agentes.filter((a) => !fora.has(a));
    }
    this.t += dt;
    if (this.eventos.length > 5000) this.eventos.splice(0, this.eventos.length - 5000);
  }

  private indexar() {
    this.porElemento.clear();
    this.porTravessia.clear();
    for (const a of this.agentes) {
      if (a.tipo === 'pedestre') {
        const l = this.porTravessia.get(a.ped!.travessiaId) ?? [];
        l.push(a);
        this.porTravessia.set(a.ped!.travessiaId, l);
        continue;
      }
      const l = this.porElemento.get(a.elem) ?? [];
      l.push(a);
      this.porElemento.set(a.elem, l);
    }
    for (const l of this.porElemento.values()) l.sort((x, y) => x.sElem - y.sElem);
  }

  private pecaEm(rota: Rota, s: number, dica = 0) {
    let k = Math.min(dica, rota.pecas.length - 1);
    while (k < rota.pecas.length - 1 && s > rota.pecas[k].sRota0 + (rota.pecas[k].sElem1 - rota.pecas[k].sElem0)) k++;
    while (k > 0 && s < rota.pecas[k].sRota0) k--;
    return k;
  }

  private atualizarPosicao(a: Agente) {
    const p = a.rota.linha.ponto(a.s);
    a.x = p.x;
    a.y = p.y;
    a.ang = p.ang;
    if (a.tipo === 'pedestre') {
      a.elem = a.rota.pecas[0].elem.id;
      a.sElem = a.s;
      return;
    }
    a.peca = this.pecaEm(a.rota, a.s, a.peca);
    const pc = a.rota.pecas[a.peca];
    a.elem = pc.elem.id;
    a.sElem = pc.sElem0 + (a.s - pc.sRota0);
  }

  /** Velocidade desejada no ponto s, com o envelope de frenagem para limites à frente. */
  private velocidadeDesejada(a: Agente, s: number): { v: number; motivo: string | null } {
    let v = a.vDes;
    let motivo: string | null = null;
    const considera = (s0: number, s1: number, vc: number, m: string) => {
      if (s1 < s) return;
      const d = Math.max(0, s0 - s);
      if (d > 120) return;
      const ve = d === 0 ? vc : Math.sqrt(vc * vc + 2 * a.b * 0.8 * d);
      if (ve < v) {
        v = ve;
        motivo = m;
      }
    };
    for (const l of a.rota.limites) considera(l.s0, l.s1, l.v, l.motivo);
    if (a.obedeceFiscalizacao) {
      for (const f of a.rota.fiscalizacoes) {
        if (f.tipo === 'agente' && !this.agenteEmServico()) continue;
        const janela = f.tipo === 'camera' ? 100 : 60;
        considera(f.sRota - janela, f.sRota + 30, kmh(57), f.tipo === 'camera' ? 'câmera' : 'agente de trânsito');
      }
    }
    return { v: Math.max(1, v), motivo };
  }

  private moverVeiculo(a: Agente, dt: number) {
    const rota = a.rota;
    let gapLider = Infinity;
    let vLider = 0;
    let liderId = -1;
    let motivoParada: string | null = null;
    const obstaculo = (sPare: number, motivo: string) => {
      const g = sPare - a.s;
      if (g < gapLider) {
        gapLider = Math.max(0.01, g);
        vLider = 0;
        liderId = -1;
        motivoParada = motivo;
      }
    };

    // 1. veículo à frente (no elemento atual e no próximo da rota)
    const pc = rota.pecas[a.peca];
    const fimPeca = pc.sElem1;
    const lista = this.porElemento.get(a.elem) ?? [];
    for (const o of lista) {
      if (o === a || o.sElem <= a.sElem) continue;
      if (o.sElem - o.comp > fimPeca + 1) break;
      const g = o.sElem - o.comp - a.sElem;
      if (g < gapLider) {
        gapLider = g;
        vLider = o.v;
        liderId = o.id;
        motivoParada = null;
      }
      break;
    }
    const restante = fimPeca - a.sElem;
    if (restante < 60 && a.peca + 1 < rota.pecas.length) {
      const prox = rota.pecas[a.peca + 1];
      for (const o of this.porElemento.get(prox.elem.id) ?? []) {
        if (o === a || o.sElem < prox.sElem0 - 0.5) continue;
        const g = restante + (o.sElem - prox.sElem0) - o.comp;
        if (g < gapLider) {
          gapLider = g;
          vLider = o.v;
          liderId = o.id;
          motivoParada = null;
        }
        break;
      }
    }
    // risco de colisão traseira (TTC curto)
    if (liderId >= 0 && a.s > 40 && gapLider < 20 && a.v - vLider > 3 && gapLider / (a.v - vLider) < 0.9) {
      const ttc = gapLider / (a.v - vLider);
      this.conflito(a.id, liderId, a.x, a.y, 'traseira', ttc < 0.5, `TTC ${fmt(ttc, 1)} s`, Math.max(a.v, vLider));
    }

    // 2. semáforos
    rota.retencoes.forEach((r, i) => {
      if (r.sRota < a.s - 0.2 || r.sRota - a.s > 150) return;
      const sem = this.semaforo(r.semaforoId);
      if (!sem) return;
      const est = this.estadoSemaforo(sem, r.grupo);
      const d = r.sRota - a.s;
      let dec = a.retencao.get(i);
      if (est.cor === 'verde') {
        a.retencao.delete(i);
        return;
      }
      if (!dec) {
        const distParada = (a.v * a.v) / (2 * 3) + a.v * 0.6;
        if (est.cor === 'amarelo') {
          dec = d < distParada ? 'avanca' : 'para';
        } else if (d < (a.v * a.v) / (2 * 6)) {
          dec = 'avanca';
        } else if (d < 30) {
          const fisc = this.fiscalizacao({ x: a.x, y: a.y });
          const noite = ehNoite(this.hora());
          const fatores: Fator[] = [
            { rotulo: 'Tendência a respeitar o vermelho', efeito: -3.6 },
            { rotulo: `Vermelho ainda dura ${fmt(est.restante)} s`, efeito: 0.025 * (est.restante - 20) },
            { rotulo: `Perfil (impaciência ${fmt(a.imp * 100)}%)`, efeito: 1.0 * (a.imp - 0.5) * 2 },
          ];
          if (a.tipo === 'moto') fatores.push({ rotulo: 'Motociclista', efeito: 0.6 });
          if (noite) fatores.push({ rotulo: 'Noite, pouco movimento', efeito: 0.9 });
          if (fisc.F > 0) fatores.push({ rotulo: `Fiscalização: ${fisc.texto.join(', ')}`, efeito: -3.2 * fisc.F });
          const p = sigmoide(fatores.reduce((acc, f) => acc + f.efeito, 0));
          const sorteio = this.rng.proximo();
          dec = sorteio < p ? 'avanca' : 'para';
          this.registrar(a, {
            tipo: 'sinal',
            titulo: dec === 'avanca' ? 'Decidiu avançar o vermelho' : 'Parou no vermelho',
            texto: `Chegou ao semáforo fechado.`,
            fatores,
            probabilidade: p,
            sorteio,
            infracao: dec === 'avanca',
          });
        } else {
          dec = 'para';
        }
        if (d < 30 || est.cor === 'amarelo') a.retencao.set(i, dec);
      } else if (dec === 'para' && est.cor === 'vermelho' && a.v < 0.3 && a.espera > 40) {
        const fisc = this.fiscalizacao({ x: a.x, y: a.y });
        const h = 0.0015 * (1 + 2 * a.imp) * (1 - fisc.F) * (ehNoite(this.hora()) ? 4 : 1);
        if (this.rng.proximo() < h * dt) {
          dec = 'avanca';
          a.retencao.set(i, dec);
          this.registrar(a, {
            tipo: 'sinal',
            titulo: 'Cansou de esperar e avançou o vermelho',
            texto: `Esperou ${fmt(a.espera)} s parado no vermelho.`,
            infracao: true,
          });
        }
      }
      if (dec === 'para') obstaculo(r.sRota, 'semáforo fechado');
    });

    // 3. cedência (pare, conversão, retorno)
    const ced: PontoCedencia | undefined = rota.cedencias[a.cedencia];
    if (ced && ced.sRota >= a.s - 0.5) {
      const d = ced.sRota - a.s;
      if (d < 80) {
        if (d < 3 && a.v < 2.5) {
          const gap = this.brecha(a, ced);
          if (gap.ok) {
            a.cedencia++;
            const margem = gap.margem;
            if (a.espera > 3 || margem < 1.5) {
              const arriscada = margem < 1.2;
              this.registrar(a, {
                tipo: 'brecha',
                titulo: arriscada ? 'Aceitou uma brecha arriscada' : 'Encontrou brecha e seguiu',
                texto:
                  `Esperou ${fmt(a.espera)} s. ` +
                  (Number.isFinite(margem)
                    ? `Folga até o próximo veículo: ${fmt(margem, 1)} s (exigia ${fmt(gap.exigida, 1)} s; a espera e a impaciência baixam essa exigência).`
                    : 'Nenhum veículo se aproximando.'),
              });
            }
          } else obstaculo(ced.sRota, ced.tipo === 'pare' ? 'esperando brecha (PARE)' : 'esperando brecha no fluxo');
        } else obstaculo(ced.sRota, ced.tipo === 'pare' ? 'parando no PARE' : 'reduzindo para a manobra');
      }
    }

    // 4. pedestres na travessia
    for (const tp of rota.travessias) {
      const d = tp.sRota - a.s;
      if (d < -1 || d > 40) continue;
      const peds = (this.porTravessia.get(tp.travessiaId) ?? []).filter((p) => {
        if (!p.ped || p.ped.fase === 'aguardando') return false;
        const sp = p.rota.pecas[0].elem.id.endsWith(':SN') ? p.s : p.rota.comprimento - p.s;
        const indo = p.rota.pecas[0].elem.id.endsWith(':SN') ? 1 : -1;
        const rel = (tp.sPed - sp) * indo;
        return rel > -2.5 && rel < 6 && (p.ped.fase === 'atravessando' || Math.abs(rel) < 2.5);
      });
      if (!peds.length) {
        a.cedePedestre.delete(tp.travessiaId);
        continue;
      }
      let cede = a.cedePedestre.get(tp.travessiaId);
      if (cede === undefined) {
        const cfg = this.malha.config;
        const fatores: string[] = [];
        let p = 0.35;
        if (cfg.faixasElevadas.has(tp.travessiaId)) {
          p = 0.85;
          fatores.push('faixa elevada');
        }
        const fisc = this.fiscalizacao({ x: a.x, y: a.y });
        if (fisc.texto.some((t) => t.startsWith('agente a'))) {
          p = Math.max(p, 0.9);
          fatores.push('agente por perto');
        } else if (fisc.texto.some((t) => t.startsWith('câmera'))) {
          p = Math.max(p, 0.5);
          fatores.push('câmera por perto');
        }
        const ret = rota.retencoes.find((r) => Math.abs(r.sRota - tp.sRota) < 30);
        if (ret) {
          const sem = this.semaforo(ret.semaforoId);
          if (sem && this.estadoSemaforo(sem, ret.grupo).cor === 'verde') {
            p = Math.min(p, 0.3);
            fatores.push('o sinal está verde para o carro');
          }
        }
        const sorteio = this.rng.proximo();
        cede = d < (a.v * a.v) / (2 * 5) ? false : sorteio < p;
        a.cedePedestre.set(tp.travessiaId, cede);
        this.registrar(a, {
          tipo: 'pedestre',
          titulo: cede ? 'Parou para o pedestre' : 'Não cedeu a vez ao pedestre',
          texto: `Chance de ceder: ${fmt(p * 100)}%${fatores.length ? ` (${fatores.join(', ')})` : ' (sem faixa elevada nem fiscalização)'}.`,
          probabilidade: p,
          sorteio,
        });
      }
      if (cede) obstaculo(tp.sRota - 3, 'cedendo a vez ao pedestre');
    }

    // 5. quem segue reto e está preso atrás de quem espera para virar troca de faixa
    if (liderId >= 0 && a.v < 1 && a.espera > 2.5 && (a.desejo?.id === 'oeste_reto' || a.desejo?.id === 'leste_reto')) {
      const lider = this.agentes.find((g) => g.id === liderId);
      const liderVira = lider && lider.v < 0.5 && lider.desejo?.id !== a.desejo.id;
      if (liderVira && this.trocarFaixa(a)) return;
    }

    // 6. IDM
    const des = this.velocidadeDesejada(a, a.s);
    const v0 = des.v;
    let acel = a.aMax * (1 - Math.pow(a.v / v0, 4));
    if (Number.isFinite(gapLider)) {
      const dv = a.v - vLider;
      const sEst = a.s0 + Math.max(0, a.v * a.T + (a.v * dv) / (2 * Math.sqrt(a.aMax * a.b)));
      acel -= a.aMax * Math.pow(sEst / Math.max(0.1, gapLider), 2);
    }
    acel = Math.max(-8, Math.min(a.aMax, acel));
    const vNovo = Math.max(0, a.v + acel * dt);
    let ds = vNovo * dt;
    if (liderId < 0 && Number.isFinite(gapLider) && ds > gapLider - 0.05) {
      ds = Math.max(0, gapLider - 0.05);
      a.v = 0;
    } else a.v = vNovo;
    a.s += ds;

    if (a.v < 0.5) {
      a.espera += dt;
      a.esperaTotal += dt;
    } else if (a.v > 2) a.espera = 0;
    a.estado =
      a.v < 0.5 ? (motivoParada ?? 'parado na fila') : des.motivo && v0 < a.vDes - 1 ? `reduzindo (${des.motivo})` : 'em movimento';

    // 7. infrações que acontecem ao passar por um ponto
    if (rota.manobra && a.s >= rota.manobra.sRota && a.s - ds < rota.manobra.sRota) {
      this.infracao(a, rota.infracao ?? 'conversao_proibida', rota.manobra.ponto, rota.manobra.nome);
    }
    rota.retencoes.forEach((r, i) => {
      if (!(a.s >= r.sRota && a.s - ds < r.sRota)) return;
      const sem = this.semaforo(r.semaforoId);
      if (sem && this.estadoSemaforo(sem, r.grupo).cor === 'vermelho') {
        const p = rota.linha.ponto(r.sRota);
        this.infracao(a, 'avanco_sinal', p, 'Passou com o semáforo vermelho');
      }
      a.retencao.delete(i);
    });
    this.verificarVelocidade(a);
  }

  /** Passa para a faixa vizinha (só quem segue reto), se houver espaço nela. */
  private trocarFaixa(a: Agente): boolean {
    const sentido = a.desejo?.id === 'oeste_reto' ? 'oeste' : 'leste';
    const retas = sentido === 'oeste' ? this.malha.retas.oeste : this.malha.retas.leste;
    const atual = retas.findIndex((r) => r.pecas[0].elem.id === a.elem);
    if (atual < 0) return false;
    for (const i of [atual + 1, atual - 1]) {
      const rota = retas[i];
      if (!rota) continue;
      const vizinhos = this.porElemento.get(rota.pecas[0].elem.id) ?? [];
      // atrás precisa caber a frenagem de quem vem na faixa vizinha
      const livre = vizinhos.every((o) =>
        o.sElem < a.sElem ? a.sElem - a.comp - o.sElem > 6 + o.v * 1.8 : o.sElem - o.comp > a.sElem + 4
      );
      if (!livre) continue;
      a.rota = rota;
      a.peca = 0;
      a.espera = 0;
      a.cedencia = 0;
      a.retencao.clear();
      a.cedePedestre.clear();
      this.registrar(a, {
        tipo: 'rota',
        titulo: 'Trocou de faixa',
        texto: `Desviou de um veículo parado esperando para virar (faixa ${['da esquerda', 'do meio', 'da direita'][i]}).`,
      });
      return true;
    }
    return false;
  }

  /** Brecha para atravessar ou entrar no fluxo: compara o tempo de chegada dos outros com o próprio. */
  private brecha(a: Agente, ced: PontoCedencia): { ok: boolean; margem: number; exigida: number } {
    const exigida = Math.max(0.8, 2.6 * (1 - 0.35 * a.imp) - 0.03 * a.espera);
    let margem = Infinity;
    for (const f of ced.fluxos) {
      const d = Math.max(0, f.sRota - a.s);
      const acc = a.aMax;
      const tIn = (-a.v + Math.sqrt(a.v * a.v + 2 * acc * d)) / acc;
      const vNoPonto = Math.sqrt(a.v * a.v + 2 * acc * d);
      const tOut = tIn + (a.comp + 3) / Math.max(3, vNoPonto);
      for (const o of this.porElemento.get(f.elemId) ?? []) {
        if (o.sElem - o.comp > f.sElem + 1) break;
        // veículo em cima do ponto de cruzamento
        if (o.sElem >= f.sElem - 1) return { ok: false, margem: 0, exigida };
        const dist = f.sElem - o.sElem;
        if (dist > 160) continue;
        // parado na fila antes do ponto: deixa passar (é assim que a fila se desfaz)
        if (o.v < 0.5) continue;
        const tta = tempoChegada(o, dist);
        if (tta < tIn - 1.2) continue;
        const m = tta - tOut;
        if (m < margem) margem = m;
      }
    }
    return { ok: margem >= exigida, margem, exigida };
  }

  private verificarVelocidade(a: Agente) {
    const pc = a.rota.pecas[a.peca];
    if (pc.elem.tipo === 'faixa_avenida') {
      const lim = pc.elem.velMax;
      if (a.v > lim + LIMITE_TOLERANCIA && (!a.excesso || a.v > a.excesso.v)) {
        a.excesso = { v: a.v, x: a.x, y: a.y, limite: lim };
      }
    } else this.fecharExcesso(a);
  }

  private fecharExcesso(a: Agente) {
    if (!a.excesso) return;
    const { v, limite, x, y } = a.excesso;
    a.excesso = null;
    const considerada = v - LIMITE_TOLERANCIA;
    const pct = (considerada - limite) / limite;
    const grav = pct <= 0.2 ? 'média' : pct <= 0.5 ? 'grave' : 'gravíssima';
    const motivos: string[] = [`velocidade desejada ${fmt(paraKmh(a.vDes))} km/h`];
    if (ehNoite(this.hora())) motivos.push('noite');
    const temFisc = a.rota.fiscalizacoes.some((f) => f.tipo === 'camera' || this.agenteEmServico());
    if (temFisc && !a.obedeceFiscalizacao) motivos.push('ignorou a fiscalização do trecho');
    else if (!temFisc) motivos.push('sem câmera nem agente no trecho');
    this.registrar(a, {
      tipo: 'velocidade',
      titulo: `Excesso de velocidade (${grav})`,
      texto: `Passou a ${fmt(paraKmh(v))} km/h numa via de ${fmt(paraKmh(limite))} (CTB art. 218, ${fmt(pct * 100)}% acima após a tolerância). Por quê: ${motivos.join(', ')}.`,
      infracao: true,
    });
    this.infracao(a, 'excesso_velocidade', { x, y }, `${fmt(paraKmh(v))} km/h`, false);
  }

  private moverPedestre(a: Agente, dt: number) {
    const ped = a.ped!;
    const rede = this.rede;
    const len = a.rota.comprimento;
    const sRefIni = 2 + 3 * rede.largFaixa;
    const refugio = this.malha.config.refugios.has(ped.travessiaId);
    const sentidoSN = a.rota.pecas[0].elem.id.endsWith(':SN');
    const yEm = (s: number) => (sentidoSN ? -rede.borda - 2 + s : rede.borda + 2 - s);
    const xT = rede.travessias.find((t) => t.id === ped.travessiaId)!.x;
    const sem = this.malha.config.semaforos.find((s) => s.cruzamento === rede.travessias.find((t) => t.id === ped.travessiaId)!.cruzamento);

    /** Há brecha para atravessar de sDe até sAte? */
    const brecha = (sDe: number, sAte: number) => {
      const margem = Math.max(0.3, 2.0 * (1 - 0.4 * a.imp) - 0.03 * a.espera);
      let pior = Infinity;
      for (const [id, y] of [
        ...rede.yOeste.map((y, i) => [`O${i}`, y] as const),
        ...rede.yLeste.map((y, i) => [`L${i}`, y] as const),
      ]) {
        const yIni = yEm(sDe);
        const yFim = yEm(sAte);
        if ((y - yIni) * (y - yFim) > 0) continue;
        const dPed = Math.abs(y - yIni);
        const tA = Math.max(0, (dPed - 1.6) / ped.vp);
        const tL = (dPed + 1.6) / ped.vp;
        const sCruz = id.startsWith('O') ? rede.xMax - xT : xT - rede.xMin;
        for (const o of this.porElemento.get(id) ?? []) {
          if (o.sElem > sCruz + 1) break;
          const dist = sCruz - o.sElem;
          if (dist > 160) continue;
          if (o.v < 0.5 && dist < 8) continue;
          if (o.v < 0.3) continue;
          const tta = tempoChegada(o, dist);
          if (tta >= tA - 0.5 && tta <= tL + margem) return { ok: false, pior: 0, margem };
          if (tta > tL) pior = Math.min(pior, tta - tL);
        }
      }
      return { ok: true, pior, margem };
    };

    const tentar = (sAte: number, etapa: string) => {
      let pode = false;
      let texto = '';
      if (sem) {
        const est = this.estadoSemaforo(sem, 'pedestre');
        if (est.cor === 'verde') {
          pode = true;
          texto = 'Atravessou no verde do pedestre.';
        } else if (a.espera > 60) {
          const b = brecha(a.s, sAte);
          if (b.ok) {
            pode = true;
            texto = `Cansou de esperar (${fmt(a.espera)} s) e atravessou no vermelho.`;
          }
        }
      } else {
        const b = brecha(a.s, sAte);
        if (b.ok) {
          pode = true;
          texto =
            a.espera > 2
              ? `Esperou ${fmt(a.espera)} s por uma brecha ${etapa}. ` +
                (Number.isFinite(b.pior) ? `Folga aceita: ${fmt(b.pior, 1)} s (exigia ${fmt(b.margem, 1)} s).` : '')
              : `Atravessou ${etapa} sem esperar.`;
        }
      }
      if (pode) {
        ped.fase = 'atravessando';
        ped.alvo = sAte;
        this.registrar(a, { tipo: 'travessia', titulo: etapa === 'até o canteiro' ? 'Atravessou até o refúgio' : 'Começou a atravessar', texto });
        a.estado = 'atravessando';
      }
    };

    if (ped.fase === 'aguardando') {
      a.espera += dt;
      a.esperaTotal += dt;
      a.estado = 'esperando para atravessar';
      tentar(refugio ? sRefIni + 1 : len, refugio ? 'até o canteiro' : 'pelas 6 faixas');
      return;
    }
    if (ped.fase === 'refugio') {
      a.espera += dt;
      a.esperaTotal += dt;
      a.estado = 'esperando no refúgio';
      tentar(len, 'na segunda metade');
      return;
    }
    // atravessando: apressa o passo se um veículo se aproxima da faixa em que está
    let vp = ped.vp;
    const yAtual = yEm(a.s);
    for (const [id, y] of [
      ...rede.yOeste.map((y, i) => [`O${i}`, y] as const),
      ...rede.yLeste.map((y, i) => [`L${i}`, y] as const),
    ]) {
      if (Math.abs(y - yAtual) > 2.5) continue;
      const sCruz = id.startsWith('O') ? rede.xMax - xT : xT - rede.xMin;
      const perto = (this.porElemento.get(id) ?? []).some((o) => {
        const dist = sCruz - o.sElem;
        return dist > 0 && dist < 40 && o.v > 3 && dist / o.v < 2.5;
      });
      if (perto) {
        vp = ped.vp * 1.6;
        if (!ped.correu) {
          ped.correu = true;
          this.registrar(a, { tipo: 'travessia', titulo: 'Precisou correr', texto: 'Um veículo se aproximou sem reduzir enquanto atravessava.' });
        }
      }
    }
    a.v = vp;
    a.s = Math.min(ped.alvo, a.s + vp * dt);
    if (a.s >= ped.alvo - 1e-6) {
      if (ped.alvo < len - 0.01) {
        ped.fase = 'refugio';
        a.espera = 0;
        a.v = 0;
      } else a.s = len;
    }
  }

  /** Detecta passagens por zonas de conflito entre sAntes e o s atual. */
  private passagensZonas(a: Agente, sAntes: number) {
    if (a.s <= sAntes) return;
    const rota = a.rota;
    for (let k = this.pecaEm(rota, sAntes, a.peca); k < rota.pecas.length; k++) {
      const pc = rota.pecas[k];
      const len = pc.sElem1 - pc.sElem0;
      if (pc.sRota0 > a.s) break;
      const e0 = pc.sElem0 + Math.max(0, sAntes - pc.sRota0);
      const e1 = pc.sElem0 + Math.min(len, a.s - pc.sRota0);
      const zonas = this.malha.zonasPorElemento.get(pc.elem.id);
      if (!zonas) continue;
      for (const z of zonas) {
        if (z.s <= e0 || z.s > e1) continue;
        const zona = this.malha.zonas[z.zona];
        const lado = zona.a === pc.elem.id ? 'a' : 'b';
        const reg = this.passagens.get(z.zona) ?? {};
        const outro = lado === 'a' ? reg.b : reg.a;
        const ped = a.tipo === 'pedestre';
        // com pedestre, só conta quando o veículo chega depois (passou rente a quem já atravessava)
        if (outro && outro.ag !== a.id && !(outro.ped && ped) && !(ped && !outro.ped)) {
          const pet = this.t - outro.t;
          const envolvePed = outro.ped || ped;
          const limite = envolvePed ? PET_PEDESTRE : PET_VEICULO;
          if (pet < limite) {
            const vMax = Math.max(a.v, outro.v);
            const grave = envolvePed ? pet < 0.8 : pet < 0.8 || (vMax > kmh(40) && pet < 1.2);
            this.conflito(a.id, outro.ag, zona.x, zona.y, envolvePed ? 'pedestre' : 'cruzamento', grave, `PET ${fmt(pet, 1)} s`, vMax);
          }
        }
        reg[lado] = { t: this.t, ag: a.id, v: a.v, ped };
        this.passagens.set(z.zona, reg);
      }
    }
  }

  private conflito(idA: number, idB: number, x: number, y: number, tipo: TipoConflito, grave: boolean, medida: string, v: number) {
    const chave = idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
    const ultimo = this.pares.get(chave);
    if (ultimo !== undefined && this.t - ultimo < 20) return;
    this.pares.set(chave, this.t);
    const A = this.agentes.find((g) => g.id === idA);
    const B = this.agentes.find((g) => g.id === idB);
    const nome = (g?: Agente) => (g ? `${NOME_TIPO[g.tipo].toLowerCase()} #${g.id}` : 'outro agente');
    const peso = (grave ? 3 : 1) * (tipo === 'pedestre' ? 2 : tipo === 'traseira' ? 0.7 : 1);
    const descricao = `${NOME_CONFLITO[tipo]}: ${nome(A)} e ${nome(B)} (${medida}, ${fmt(paraKmh(v))} km/h)`;
    this.eventos.push({ t: this.t, x, y, tipo: 'conflito', subtipo: tipo, grave, peso, agentes: [idA, idB], descricao });
    this.acc.conflitos[tipo]++;
    if (grave) this.acc.graves++;
    this.acc.risco += peso;
    for (const g of [A, B]) {
      if (!g) continue;
      const outro = g === A ? B : A;
      this.registrar(g, {
        tipo: 'conflito',
        titulo: grave ? 'Quase-acidente grave' : 'Quase-acidente',
        texto: `${NOME_CONFLITO[tipo]} com ${nome(outro)}: ${medida}.`,
      });
    }
  }

  private infracao(a: Agente, tipo: TipoInfracao, p: Vec2, detalhe: string, registrar = true) {
    a.infrator = true;
    a.infracoes.push(tipo);
    this.acc.infracoes[tipo]++;
    this.eventos.push({
      t: this.t,
      x: p.x,
      y: p.y,
      tipo: 'infracao',
      subtipo: tipo,
      grave: tipo !== 'excesso_velocidade',
      peso: 1,
      agentes: [a.id],
      descricao: `${NOME_INFRACAO[tipo]}: ${NOME_TIPO[a.tipo].toLowerCase()} #${a.id} (${detalhe})`,
    });
    if (registrar && tipo !== 'avanco_sinal') {
      // a decisão de rota já explica a manobra; aqui só marca o momento
      a.estado = NOME_INFRACAO[tipo].toLowerCase();
    }
  }

  private concluir(a: Agente) {
    if (a.tipo === 'pedestre') {
      this.acc.pedestres++;
      this.acc.esperaPed += a.esperaTotal;
      return;
    }
    this.fecharExcesso(a);
    const viagem = this.t - a.nasc;
    const atraso = Math.max(0, viagem - a.rota.tempoLivre) + a.rota.desvioExterno / kmh(30);
    this.acc.veiculos++;
    this.acc.atraso += atraso;
  }

  /** Luzes dos semáforos para desenhar no mapa. */
  luzes(): { x: number; y: number; cor: 'verde' | 'amarelo' | 'vermelho' }[] {
    const res: { x: number; y: number; cor: 'verde' | 'amarelo' | 'vermelho' }[] = [];
    for (const sem of this.malha.config.semaforos) {
      const ab = this.rede.aberturas.find((a) => a.cruzamento === sem.cruzamento)!;
      const trav = this.rede.travessias.find((t) => t.cruzamento === sem.cruzamento);
      const xL = Math.min(ab.x0 - 6, trav && trav.x < ab.x0 ? trav.x - 4 : Infinity);
      const xO = Math.max(ab.x1 + 6, trav && trav.x > ab.x1 ? trav.x + 4 : -Infinity);
      const av = this.estadoSemaforo(sem, 'avenida').cor;
      const tr = this.estadoSemaforo(sem, 'transversal').cor;
      res.push({ x: xL, y: -this.rede.borda - 1.2, cor: av });
      res.push({ x: xO, y: this.rede.borda + 1.2, cor: av });
      res.push({ x: ab.xc + (sem.cruzamento === 'vv' ? 6 : -6), y: (sem.cruzamento === 'vv' ? -1 : 1) * (this.rede.borda + 1.5), cor: tr });
    }
    return res;
  }
}
