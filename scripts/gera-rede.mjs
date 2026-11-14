#!/usr/bin/env node
/**
 * Gera a rede de faixas do trecho da Av. dos Africanos (cruzamentos com a
 * Av. Vicente Venâncio de Queiroga e com a rua que chega pelo norte, ~140 m a oeste).
 *
 * A geometria é PARAMÉTRICA: tudo é desenhado em metros num sistema local
 * (x = ao longo da Africanos, positivo para leste; y = positivo para norte; origem
 * no centro da abertura do canteiro em frente à Vicente Venâncio) e depois
 * convertido para lon/lat a partir de uma ÂNCORA e do RUMO da avenida.
 *
 * Para calibrar sobre o satélite, ajuste só a ÂNCORA, o RUMO e as larguras abaixo
 * e rode:  node scripts/gera-rede.mjs
 * A saída vai para public/data/rede.geojson (o app carrega esse arquivo).
 *
 * Dimensões tiradas da planta do projeto de sinalização (escala 1:500):
 * 3 faixas por sentido, canteiro central, ~140 m entre os dois cruzamentos.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- PARÂMETROS
/** Centro da abertura do canteiro em frente à Vicente Venâncio. A CALIBRAR no satélite. */
export const ANCORA = { lat: -2.55498, lon: -44.27049 };
/** Rumo da Av. dos Africanos em graus, anti-horário a partir do leste. A CALIBRAR. */
export const RUMO_GRAUS = -32;

const LARG_FAIXA = 3.3; // m
const N_FAIXAS = 3; // por sentido
const MEIO_CANTEIRO = 3.5; // metade da largura do canteiro (canteiro ~7 m)
const DIST_CRUZAMENTOS = 140; // m entre a VV e a rua do norte
const X_MIN = -320; // extensão do trecho modelado
const X_MAX = 200;
const ABERTURA_VV = [-13, 13]; // trecho do canteiro aberto em frente à VV
const ABERTURA_NORTE = [-DIST_CRUZAMENTOS - 8, -DIST_CRUZAMENTOS + 8];
const COMPR_TRANSVERSAL = 80; // quanto das ruas transversais modelar

// --------------------------------------------------------- GEOMETRIA LOCAL
const BORDA = MEIO_CANTEIRO + N_FAIXAS * LARG_FAIXA; // y do meio-fio externo
/** y do eixo da faixa i (0 = junto ao canteiro / esquerda) da pista norte (sentido oeste). */
const yOeste = (i) => MEIO_CANTEIRO + LARG_FAIXA * (i + 0.5);
/** y do eixo da faixa i da pista sul (sentido leste). */
const yLeste = (i) => -yOeste(i);

const XN = -DIST_CRUZAMENTOS; // eixo da rua do norte
// Vicente Venâncio: 1 faixa entrando (sentido sul, lado oeste) + 2 saindo (esquerda e direita).
const VV = { entrada: -LARG_FAIXA / 2, saiEsq: LARG_FAIXA / 2, saiDir: LARG_FAIXA * 1.5 };
// Rua do norte: 1 faixa por sentido (mão dupla).
const NORTE = { descendo: XN - LARG_FAIXA / 2, subindo: XN + LARG_FAIXA / 2 };

const rad = (RUMO_GRAUS * Math.PI) / 180;
const M_POR_GRAU_LAT = 111320;
const M_POR_GRAU_LON = 111320 * Math.cos((ANCORA.lat * Math.PI) / 180);

/** Converte [x, y] em metros locais para [lon, lat]. */
const geo = ([x, y]) => {
  const xe = x * Math.cos(rad) - y * Math.sin(rad);
  const yn = x * Math.sin(rad) + y * Math.cos(rad);
  const r = (v) => Math.round(v * 1e7) / 1e7;
  return [r(ANCORA.lon + xe / M_POR_GRAU_LON), r(ANCORA.lat + yn / M_POR_GRAU_LAT)];
};

/** Bézier cúbica de p0 a p3, amostrada; t0/t1 = tangentes de saída/chegada (vetores unitários). */
const curva = (p0, t0, p3, t1, n = 16) => {
  // Comprimento das alças: ~0,55 do deslocamento na direção de cada tangente (aproxima um
  // arco de círculo nas conversões de 90°); nos retornos usa uma fração da distância total.
  const dx = p3[0] - p0[0], dy = p3[1] - p0[1];
  const reserva = Math.hypot(dx, dy) * 0.45;
  const alca = (t) => {
    const proj = Math.abs(dx * t[0] + dy * t[1]);
    return proj > 1 ? 0.55 * proj : reserva;
  };
  const d0 = alca(t0), d1 = alca(t1);
  const p1 = [p0[0] + t0[0] * d0, p0[1] + t0[1] * d0];
  const p2 = [p3[0] - t1[0] * d1, p3[1] - t1[1] * d1];
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t ** 2, e = t ** 3;
    pts.push([
      a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
    ]);
  }
  return pts;
};

const LESTE = [1, 0], OESTE = [-1, 0], NORTE_V = [0, 1], SUL = [0, -1];
const ret = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

const features = [];
const add = (geomType, coordsLocal, properties) => {
  const coordinates =
    geomType === 'Polygon' ? coordsLocal.map((anel) => anel.map(geo)) : coordsLocal.map(geo);
  features.push({ type: 'Feature', properties, geometry: { type: geomType, coordinates } });
};

// ------------------------------------------------------------------ PISTAS
add('Polygon', [ret(X_MIN, MEIO_CANTEIRO, X_MAX, BORDA)], {
  tipo: 'pista', id: 'pista_africanos_oeste', nome: 'Av. dos Africanos, pista norte (sentido oeste)',
});
add('Polygon', [ret(X_MIN, -BORDA, X_MAX, -MEIO_CANTEIRO)], {
  tipo: 'pista', id: 'pista_africanos_leste', nome: 'Av. dos Africanos, pista sul (sentido leste)',
});
add('Polygon', [ret(-LARG_FAIXA, -BORDA - COMPR_TRANSVERSAL, LARG_FAIXA * 2, -BORDA)], {
  tipo: 'pista', id: 'pista_vv', nome: 'Av. Vicente Venâncio de Queiroga',
});
add('Polygon', [ret(XN - LARG_FAIXA, BORDA, XN + LARG_FAIXA, BORDA + COMPR_TRANSVERSAL)], {
  tipo: 'pista', id: 'pista_norte', nome: 'Rua do cruzamento norte',
});

// ---------------------------------------------- CANTEIRO (com as aberturas)
const trechos = [
  [X_MIN, ABERTURA_NORTE[0]],
  [ABERTURA_NORTE[1], ABERTURA_VV[0]],
  [ABERTURA_VV[1], X_MAX],
];
trechos.forEach(([a, b], i) =>
  add('Polygon', [ret(a, -MEIO_CANTEIRO, b, MEIO_CANTEIRO)], {
    tipo: 'canteiro', id: `canteiro_${i + 1}`, nome: 'Canteiro central',
  })
);
add('Polygon', [ret(ABERTURA_VV[0], -MEIO_CANTEIRO, ABERTURA_VV[1], MEIO_CANTEIRO)], {
  tipo: 'abertura', id: 'abertura_vv', nome: 'Abertura do canteiro em frente à Vicente Venâncio',
  intervencao_fecha: 'fechar_abertura_vv',
});
add('Polygon', [ret(ABERTURA_NORTE[0], -MEIO_CANTEIRO, ABERTURA_NORTE[1], MEIO_CANTEIRO)], {
  tipo: 'abertura', id: 'abertura_norte', nome: 'Abertura do canteiro no cruzamento norte',
  intervencao_fecha: 'fechar_abertura_norte',
});

// ------------------------------------------------------------ CAIXAS AMARELAS
for (const [id, [a, b], nome] of [
  ['vv', ABERTURA_VV, 'Vicente Venâncio'],
  ['norte', ABERTURA_NORTE, 'cruzamento norte'],
]) {
  add('Polygon', [ret(a, MEIO_CANTEIRO, b, BORDA)], {
    tipo: 'caixa_amarela', id: `caixa_${id}_pista_norte`, nome: `Caixa "Não feche o cruzamento" (${nome}, pista norte)`,
  });
  add('Polygon', [ret(a, -BORDA, b, -MEIO_CANTEIRO)], {
    tipo: 'caixa_amarela', id: `caixa_${id}_pista_sul`, nome: `Caixa "Não feche o cruzamento" (${nome}, pista sul)`,
  });
}

// ------------------------------------------------------------------ FAIXAS
for (let i = 0; i < N_FAIXAS; i++) {
  const pos = ['esquerda', 'central', 'direita'][i];
  add('LineString', [[X_MAX, yOeste(i)], [X_MIN, yOeste(i)]], {
    tipo: 'faixa', id: `africanos_oeste_${i}`, via: 'africanos', sentido: 'oeste', indice: i,
    nome: `Africanos sentido oeste, faixa ${pos}`, vel_max_kmh: 60,
  });
  add('LineString', [[X_MIN, yLeste(i)], [X_MAX, yLeste(i)]], {
    tipo: 'faixa', id: `africanos_leste_${i}`, via: 'africanos', sentido: 'leste', indice: i,
    nome: `Africanos sentido leste, faixa ${pos}`, vel_max_kmh: 60,
  });
}
add('LineString', [[VV.entrada, -BORDA], [VV.entrada, -BORDA - COMPR_TRANSVERSAL]], {
  tipo: 'faixa', id: 'vv_entrada', via: 'vicente_venancio', sentido: 'sul', nome: 'Vicente Venâncio, entrando (sentido sul)', vel_max_kmh: 40,
});
add('LineString', [[VV.saiEsq, -BORDA - COMPR_TRANSVERSAL], [VV.saiEsq, -BORDA]], {
  tipo: 'faixa', id: 'vv_saida_esq', via: 'vicente_venancio', sentido: 'norte', nome: 'Vicente Venâncio, saída à esquerda', vel_max_kmh: 40,
});
add('LineString', [[VV.saiDir, -BORDA - COMPR_TRANSVERSAL], [VV.saiDir, -BORDA]], {
  tipo: 'faixa', id: 'vv_saida_dir', via: 'vicente_venancio', sentido: 'norte', nome: 'Vicente Venâncio, saída à direita', vel_max_kmh: 40,
});
add('LineString', [[NORTE.descendo, BORDA + COMPR_TRANSVERSAL], [NORTE.descendo, BORDA]], {
  tipo: 'faixa', id: 'norte_chegada', via: 'rua_norte', sentido: 'sul', nome: 'Rua do norte, chegando à Africanos', vel_max_kmh: 40,
});
add('LineString', [[NORTE.subindo, BORDA], [NORTE.subindo, BORDA + COMPR_TRANSVERSAL]], {
  tipo: 'faixa', id: 'norte_saida', via: 'rua_norte', sentido: 'norte', nome: 'Rua do norte, saindo da Africanos', vel_max_kmh: 40,
});

// --------------------------------------------------------------- MOVIMENTOS
/**
 * Conectores entre faixas. Campos:
 *  - permitido: a sinalização permite (placas de proibido virar/retorno da planta => false)
 *  - possivel: a geometria deixa fazer (é o que a IA dos motoristas usa para infringir)
 *  - fechado_por: id da intervenção que torna o movimento fisicamente impossível
 *  - conflito: rótulo do conflito que o movimento gera
 */
const mov = (id, nome, pts, extra) =>
  add('LineString', pts, { tipo: 'movimento', id, nome, possivel: true, fechado_por: null, conflito: null, ...extra });

const D = 18; // recuo, em metros, de onde o movimento sai/entra na faixa da avenida

// Cruzamento da Vicente Venâncio (x = 0)
mov('vv_dir_para_leste', 'VV → Africanos leste (direita)',
  curva([VV.saiDir, -BORDA], NORTE_V, [D, yLeste(2)], LESTE), { de: 'vv_saida_dir', para: 'africanos_leste_2', permitido: true });
mov('vv_esq_para_oeste', 'VV → Africanos oeste (esquerda, cruza 3 faixas + abertura)',
  curva([VV.saiEsq, -BORDA], NORTE_V, [-D, yOeste(0)], OESTE),
  { de: 'vv_saida_esq', para: 'africanos_oeste_0', permitido: true, fechado_por: 'fechar_abertura_vv',
    conflito: 'colisao_lateral', principal: true });
mov('leste_para_vv', 'Africanos leste → VV (direita)',
  curva([-D, yLeste(2)], LESTE, [VV.entrada, -BORDA], SUL), { de: 'africanos_leste_2', para: 'vv_entrada', permitido: true });
mov('oeste_para_vv', 'Africanos oeste → VV (esquerda pela abertura)',
  curva([D, yOeste(0)], OESTE, [VV.entrada, -BORDA], SUL),
  { de: 'africanos_oeste_0', para: 'vv_entrada', permitido: false, fechado_por: 'fechar_abertura_vv', conflito: 'conversao_proibida' });
mov('retorno_vv_leste_para_oeste', 'Retorno na abertura da VV (leste → oeste)',
  curva([-D, yLeste(0)], LESTE, [-D, yOeste(0)], OESTE),
  { de: 'africanos_leste_0', para: 'africanos_oeste_0', permitido: false, fechado_por: 'fechar_abertura_vv', conflito: 'retorno_proibido' });
mov('retorno_vv_oeste_para_leste', 'Retorno na abertura da VV (oeste → leste)',
  curva([D, yOeste(0)], OESTE, [D, yLeste(0)], LESTE),
  { de: 'africanos_oeste_0', para: 'africanos_leste_0', permitido: false, fechado_por: 'fechar_abertura_vv', conflito: 'retorno_proibido' });

// Cruzamento norte (x = -140)
mov('norte_dir_para_oeste', 'Rua norte → Africanos oeste (direita)',
  curva([NORTE.descendo, BORDA], SUL, [XN - D, yOeste(2)], OESTE), { de: 'norte_chegada', para: 'africanos_oeste_2', permitido: true });
mov('norte_esq_para_leste', 'Rua norte → Africanos leste (esquerda, cruza 3 faixas + abertura)',
  curva([NORTE.descendo, BORDA], SUL, [XN + D, yLeste(0)], LESTE),
  { de: 'norte_chegada', para: 'africanos_leste_0', permitido: true, fechado_por: 'fechar_abertura_norte', conflito: 'colisao_lateral' });
mov('oeste_para_norte', 'Africanos oeste → rua norte (direita)',
  curva([XN + D, yOeste(2)], OESTE, [NORTE.subindo, BORDA], NORTE_V), { de: 'africanos_oeste_2', para: 'norte_saida', permitido: true });
mov('leste_para_norte', 'Africanos leste → rua norte (esquerda pela abertura)',
  curva([XN - D, yLeste(0)], LESTE, [NORTE.subindo, BORDA], NORTE_V),
  { de: 'africanos_leste_0', para: 'norte_saida', permitido: false, fechado_por: 'fechar_abertura_norte', conflito: 'conversao_proibida' });
mov('retorno_norte_leste_para_oeste', 'Retorno na abertura norte (leste → oeste)',
  curva([XN - D, yLeste(0)], LESTE, [XN - D, yOeste(0)], OESTE),
  { de: 'africanos_leste_0', para: 'africanos_oeste_0', permitido: false, fechado_por: 'fechar_abertura_norte', conflito: 'retorno_proibido' });
mov('retorno_norte_oeste_para_leste', 'Retorno na abertura norte (oeste → leste)',
  curva([XN + D, yOeste(0)], OESTE, [XN + D, yLeste(0)], LESTE),
  { de: 'africanos_oeste_0', para: 'africanos_leste_0', permitido: false, fechado_por: 'fechar_abertura_norte', conflito: 'retorno_proibido' });

// -------------------------------------------------------- FAIXAS DE PEDESTRE
for (const [id, x, nome] of [
  ['travessia_vv', ABERTURA_VV[1] + 4, 'Travessia da Africanos junto à VV'],
  ['travessia_norte', ABERTURA_NORTE[0] - 4, 'Travessia da Africanos junto à rua norte'],
]) {
  add('LineString', [[x, -BORDA], [x, BORDA]], {
    tipo: 'travessia', id, nome, faixas_a_cruzar: 2 * N_FAIXAS, refugio_no_canteiro: false,
  });
}

// ------------------------------------------------------------------- SAÍDA
const rede = {
  type: 'FeatureCollection',
  metadata: {
    descricao: 'Rede de faixas paramétrica, Av. dos Africanos x Av. Vicente Venâncio (São Luís-MA)',
    ancora: ANCORA,
    rumo_graus: RUMO_GRAUS,
    calibrado: false,
    observacao: 'Âncora e rumo ainda não conferidos no satélite; ajuste em scripts/gera-rede.mjs.',
  },
  features,
};

const aqui = dirname(fileURLToPath(import.meta.url));
const saida = resolve(aqui, '../public/data/rede.geojson');
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify(rede, null, 1) + '\n');
const porTipo = features.reduce((acc, f) => ((acc[f.properties.tipo] = (acc[f.properties.tipo] || 0) + 1), acc), {});
console.log(`rede.geojson: ${features.length} feições`, porTipo);
