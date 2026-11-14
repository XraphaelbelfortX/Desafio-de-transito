# Guardião Viário — MVP Hackathon de Mobilidade Urbana (GovTech)

Plataforma inteligente que conecta a **captação descentralizada de relatos de "quase-acidentes" via WhatsApp da população** a um **Dashboard de Decisão Tática (estilo SimCity)** para gestores públicos da **SMTT São Luís/MA**.

## Stack Tecnológica
- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (Grid 12 colunas, tema corporativo GovTech)
- **Lucide-React** (`ShieldAlert`, `Bike`, `Snail`, etc.)
- **react-map-gl** (`Map`, `Source`, `Layer` Heatmap nativo, `Marker`, `Popup`)

## Estrutura da Aplicação
- [src/App.tsx](src/App.tsx): Single Page Application integrando o estado global (`incidents`, `activeInterventions`), cálculo instantâneo de KPIs via `useMemo` (Orçamento Total, Redução de Risco travada em máx. 90%, Tempo de Obra), sistema de Toasts e emissão da Ordem de Obra.
- [src/components/TacticalMap.tsx](src/components/TacticalMap.tsx): Mapa centrado na intersecção da **Av. dos Africanos com Rua Vicente Venâncio (Lat: -2.5455, Lng: -44.2700, Zoom 17)** com Heatmap nativo e botão flutuante **"Simular Street View"**.
- [src/components/StreetViewModal.tsx](src/components/StreetViewModal.tsx): Simulação visual em nível de rua (Antes × Depois) com projeção da **Pintura de Ciclofaixa Vermelha**, **Tachões Refletivos** e **Avanço de Calçada (Neckdown)**.
- [src/components/WhatsAppSimulator.tsx](src/components/WhatsAppSimulator.tsx): Simulador de entrada do cidadão (WhatsApp + OpenAI) com delay de `1000ms` (`setTimeout`), classificação automática do relato e atualização imediata do mapa de calor.
- [src/data/mockData.ts](src/data/mockData.ts): Os 5 incidentes iniciais georreferenciados e o Catálogo de Intervenções Base SINAPI/NACTO.

## Configuração do Token Mapbox
No arquivo [src/components/TacticalMap.tsx](src/components/TacticalMap.tsx), substitua a constante `MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN'` pelo seu token Mapbox real (ou cole-o diretamente pelo botão **"Token"** no canto superior direito do mapa). Enquanto estiver com `YOUR_MAPBOX_TOKEN`, o mapa utiliza automaticamente um estilo vetorial integrado para que o Heatmap funcione imediatamente na apresentação sem precisar de chave.

## Como Executar
```bash
npm install
npm run dev
```

## Rede de faixas (branch `feat/rede-de-faixas`)
- O mapa usa satélite Esri World Imagery (sem token) e desenha a rede de faixas do trecho: Africanos 3+3 faixas, canteiro com as duas aberturas, caixas amarelas, Vicente Venâncio, rua do cruzamento norte (~140 m a oeste), travessias e os 12 movimentos de conversão.
- Movimentos: laranja = conflito principal (esquerda saindo da VV), verde = permitido, vermelho tracejado = proibido pela placa mas fisicamente possível. Clique numa feição para ver id, sentido e qual intervenção a elimina (`fechado_por`).
- A geometria é gerada por `scripts/gera-rede.mjs` em metros locais e convertida para lat/lon. **Âncora e rumo da avenida ainda precisam ser calibrados no satélite**: ajuste `ANCORA` e `RUMO_GRAUS` no script e rode `node scripts/gera-rede.mjs` (gera `public/data/rede.geojson`).
