// ============================================================================
// SIMULADOR CONFLUÊNCIA MULTI-FATOR — CANDLES estilo TradingView
// Usa TradingView Lightweight Charts para velas japonesas + EMAs + RSI + ATR
// e um sistema de avisos de entrada com expiração (1m/5m/15m/30m/1h).
// ============================================================================

// Variáveis globais
let dados = [];              // candles: {time, open, high, low, close, volume}
let sinaisLong = [];         // [{index, preco}]
let sinaisShort = [];
let entradas = [];           // [{index, dir, ...}] avisos de entrada com expiração

// Instâncias dos gráficos (Lightweight Charts)
let chartPreco = null, chartRsi = null, chartAtr = null;
let serieVelas = null, serieEma9 = null, serieEma21 = null, serieEma200 = null;
let serieRsi = null, serieAtr = null, serieAtrMedia = null;

// ============================================================================
// BLOCO 1 — FUNÇÕES UTILITÁRIAS (indicadores)
// ============================================================================

function sma(array, period) {
    const result = [];
    for (let i = 0; i < array.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += array[j];
        result.push(sum / period);
    }
    return result;
}

function ema(array, period) {
    const result = [];
    const multiplier = 2 / (period + 1);
    let emaPrev = null;
    for (let i = 0; i < array.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        if (i === period - 1) {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += array[j];
            emaPrev = sum / period;
            result.push(emaPrev);
        } else {
            emaPrev = (array[i] - emaPrev) * multiplier + emaPrev;
            result.push(emaPrev);
        }
    }
    return result;
}

function rsi(array, period) {
    const result = [null]; // alinhado ao índice do array de preços (i=0 sem RSI)
    const changes = [];
    for (let i = 1; i < array.length; i++) changes.push(array[i] - array[i - 1]);
    for (let i = 0; i < changes.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        let gainSum = 0, lossSum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            if (changes[j] > 0) gainSum += changes[j];
            else lossSum += Math.abs(changes[j]);
        }
        const avgGain = gainSum / period;
        const avgLoss = lossSum / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
    }
    return result;
}

function atr(high, low, close, period) {
    const tr = [];
    for (let i = 0; i < close.length; i++) {
        if (i === 0) { tr.push(high[i] - low[i]); continue; }
        tr.push(Math.max(
            high[i] - low[i],
            Math.abs(high[i] - close[i - 1]),
            Math.abs(low[i] - close[i - 1])
        ));
    }
    return sma(tr, period);
}

function crossover(curr, prev, nivel) {
    if (prev === null || curr === null) return false;
    return prev <= nivel && curr > nivel;
}
function crossunder(curr, prev, nivel) {
    if (prev === null || curr === null) return false;
    return prev >= nivel && curr < nivel;
}

// ============================================================================
// BLOCO 2 — GERAÇÃO DE DADOS SIMULADOS (com timestamps reais)
// ============================================================================

function tfMinutes() { return parseInt(document.getElementById('timeframe').value); }
function expMinutes() { return parseInt(document.getElementById('expiracao').value); }

function gerarDadosSim(numCandles, volatilidade) {
    const out = [];
    let preco = 100;
    const stepSec = tfMinutes() * 60;
    // Alinha o último candle ao "agora" arredondado ao timeframe
    const agora = Math.floor(Date.now() / 1000);
    const baseTime = agora - (agora % stepSec);

    for (let i = 0; i < numCandles; i++) {
        const open = preco;
        const change = (Math.random() - 0.5) * volatilidade;
        const close = open + change;
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        out.push({
            time: baseTime - (numCandles - 1 - i) * stepSec,
            open: +open.toFixed(4),
            high: +high.toFixed(4),
            low: +low.toFixed(4),
            close: +close.toFixed(4),
            volume: Math.floor(Math.random() * 1000000) + 100000
        });
        preco = close;
    }
    return out;
}

// ============================================================================
// BLOCO 3 — CÁLCULO DO INDICADOR (mesma lógica de confluência do Pine Script)
// ============================================================================

function calcularIndicador(dados) {
    const useTendencia = document.getElementById('useTendencia').checked;
    const emaRapidaLen = parseInt(document.getElementById('emaRapida').value);
    const emaLentaLen = parseInt(document.getElementById('emaLenta').value);
    const useEma200 = document.getElementById('useEma200').checked;

    const useMomentum = document.getElementById('useMomentum').checked;
    const rsiLen = parseInt(document.getElementById('rsiLen').value);
    const rsiSobrevenda = parseInt(document.getElementById('rsiSobrevenda').value);
    const rsiSobrecompra = parseInt(document.getElementById('rsiSobrecompra').value);

    const useVolatilidade = document.getElementById('useVolatilidade').checked;
    const atrLen = parseInt(document.getElementById('atrLen').value);
    const atrMediaLen = parseInt(document.getElementById('atrMediaLen').value);

    const useEstrutura = document.getElementById('useEstrutura').checked;
    const estruturaLookback = parseInt(document.getElementById('estruturaLookback').value);

    const cooldownVelas = parseInt(document.getElementById('cooldownVelas').value);

    const closes = dados.map(d => d.close);
    const highs = dados.map(d => d.high);
    const lows = dados.map(d => d.low);

    const emaR = ema(closes, emaRapidaLen);
    const emaL = ema(closes, emaLentaLen);
    const ema200 = ema(closes, 200);
    const rsiValues = rsi(closes, rsiLen);
    const atrValues = atr(highs, lows, closes, atrLen);
    const atrMedia = sma(atrValues, atrMediaLen);

    // Máxima/mínima recente (excluindo a vela atual)
    const maxRec = [], minRec = [];
    for (let i = 0; i < closes.length; i++) {
        if (i === 0) { maxRec.push(highs[0]); minRec.push(lows[0]); continue; }
        let mx = -Infinity, mn = Infinity;
        const start = Math.max(0, i - estruturaLookback);
        for (let j = start; j < i; j++) { mx = Math.max(mx, highs[j]); mn = Math.min(mn, lows[j]); }
        maxRec.push(mx); minRec.push(mn);
    }

    sinaisLong = [];
    sinaisShort = [];
    let barras = 999999;

    for (let i = 1; i < closes.length; i++) {
        barras++;

        const rawTendLong = emaR[i] !== null && emaL[i] !== null && emaR[i] > emaL[i];
        const rawTendShort = emaR[i] !== null && emaL[i] !== null && emaR[i] < emaL[i];
        const rawMacroLong = ema200[i] !== null && closes[i] > ema200[i];
        const rawMacroShort = ema200[i] !== null && closes[i] < ema200[i];
        const rawMomLong = crossover(rsiValues[i], rsiValues[i - 1], rsiSobrevenda);
        const rawMomShort = crossunder(rsiValues[i], rsiValues[i - 1], rsiSobrecompra);
        const rawVol = atrValues[i] !== null && atrMedia[i] !== null && atrValues[i] > atrMedia[i];
        const rawEstrLong = closes[i] > maxRec[i - 1];
        const rawEstrShort = closes[i] < minRec[i - 1];

        const cTendLong = !useTendencia || rawTendLong;
        const cTendShort = !useTendencia || rawTendShort;
        const cMacroLong = !useEma200 || rawMacroLong;
        const cMacroShort = !useEma200 || rawMacroShort;
        const cMomLong = !useMomentum || rawMomLong;
        const cMomShort = !useMomentum || rawMomShort;
        const cVol = !useVolatilidade || rawVol;
        const cEstrLong = !useEstrutura || rawEstrLong;
        const cEstrShort = !useEstrutura || rawEstrShort;

        const longBruto = cTendLong && cMacroLong && cMomLong && cVol && cEstrLong;
        const shortBruto = cTendShort && cMacroShort && cMomShort && cVol && cEstrShort;
        const cCooldown = barras >= cooldownVelas;

        if (longBruto && cCooldown) {
            sinaisLong.push({ index: i, preco: closes[i] });
            barras = 0;
        } else if (shortBruto && cCooldown) {
            sinaisShort.push({ index: i, preco: closes[i] });
            barras = 0;
        }
    }

    return { closes, emaR, emaL, ema200, rsiValues, atrValues, atrMedia };
}

// ============================================================================
// BLOCO 4 — AVISOS DE ENTRADA COM EXPIRAÇÃO (avaliação WIN/LOSS)
// ============================================================================

function calcularEntradas() {
    const tf = tfMinutes();
    const exp = expMinutes();
    // Nº de velas até a expiração (mínimo 1). Ex.: TF M5, exp 15m -> 3 velas.
    const N = Math.max(1, Math.round(exp / tf));

    const brutos = [
        ...sinaisLong.map(s => ({ index: s.index, dir: 'CALL' })),
        ...sinaisShort.map(s => ({ index: s.index, dir: 'PUT' }))
    ].sort((a, b) => a.index - b.index);

    entradas = brutos.map(s => {
        const c = dados[s.index];
        const entryPrice = c.close;
        const expIdx = s.index + N;
        const expTime = c.time + exp * 60;
        let resultado = 'pendente';
        let expPrice = null;
        if (expIdx < dados.length) {
            expPrice = dados[expIdx].close;
            if (expPrice === entryPrice) resultado = 'EMPATE';
            else if (s.dir === 'CALL') resultado = expPrice > entryPrice ? 'WIN' : 'LOSS';
            else resultado = expPrice < entryPrice ? 'WIN' : 'LOSS';
        }
        return {
            index: s.index, dir: s.dir, entryTime: c.time, entryPrice,
            expMin: exp, expTime, resultado, expPrice
        };
    });
    return { N, tf, exp };
}

function fmtHora(unixSec) {
    const d = new Date(unixSec * 1000);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ============================================================================
// BLOCO 5 — RENDERIZAÇÃO DOS GRÁFICOS (Lightweight Charts)
// ============================================================================

function opcoesBase(alturaSub) {
    return {
        layout: { background: { color: '#ffffff' }, textColor: '#2c3e50' },
        grid: { vertLines: { color: '#eef2f5' }, horzLines: { color: '#eef2f5' } },
        rightPriceScale: { borderColor: '#d5dbdf' },
        timeScale: {
            borderColor: '#d5dbdf',
            timeVisible: true,
            secondsVisible: false
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        localization: {
            timeFormatter: t => fmtHora(t)
        }
    };
}

function destruirGraficos() {
    [chartPreco, chartRsi, chartAtr].forEach(c => { if (c) c.remove(); });
    chartPreco = chartRsi = chartAtr = null;
}

function toLine(times, valores) {
    // Constrói dados {time, value} pulando nulls
    const out = [];
    for (let i = 0; i < valores.length; i++) {
        if (valores[i] !== null && valores[i] !== undefined) {
            out.push({ time: times[i], value: valores[i] });
        }
    }
    return out;
}

function renderizarGraficos(resultado) {
    destruirGraficos();
    const times = dados.map(d => d.time);

    // ---- Gráfico principal: VELAS ----
    chartPreco = LightweightCharts.createChart(document.getElementById('chartPreco'), {
        ...opcoesBase(),
        height: 340
    });
    serieVelas = chartPreco.addCandlestickSeries({
        upColor: '#26a69a', downColor: '#ef5350',
        borderUpColor: '#26a69a', borderDownColor: '#ef5350',
        wickUpColor: '#26a69a', wickDownColor: '#ef5350'
    });
    serieVelas.setData(dados.map(d => ({
        time: d.time, open: d.open, high: d.high, low: d.low, close: d.close
    })));

    // EMAs sobrepostas
    serieEma9 = chartPreco.addLineSeries({ color: '#3498db', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    serieEma9.setData(toLine(times, resultado.emaR));
    serieEma21 = chartPreco.addLineSeries({ color: '#f39c12', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    serieEma21.setData(toLine(times, resultado.emaL));
    if (document.getElementById('useEma200').checked) {
        serieEma200 = chartPreco.addLineSeries({ color: '#9b59b6', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        serieEma200.setData(toLine(times, resultado.ema200));
    }

    // Marcadores de entrada (setas com direção + expiração)
    const marcadores = entradas.map(e => ({
        time: dados[e.index].time,
        position: e.dir === 'CALL' ? 'belowBar' : 'aboveBar',
        color: e.dir === 'CALL' ? '#26a69a' : '#ef5350',
        shape: e.dir === 'CALL' ? 'arrowUp' : 'arrowDown',
        text: `${e.dir} • exp ${e.expMin}m`
    })).sort((a, b) => a.time - b.time);
    serieVelas.setMarkers(marcadores);

    // ---- RSI ----
    chartRsi = LightweightCharts.createChart(document.getElementById('chartRsi'), {
        ...opcoesBase(), height: 180
    });
    serieRsi = chartRsi.addLineSeries({ color: '#e74c3c', lineWidth: 2, priceLineVisible: false });
    serieRsi.setData(toLine(times, resultado.rsiValues));
    const sobrec = parseInt(document.getElementById('rsiSobrecompra').value);
    const sobrev = parseInt(document.getElementById('rsiSobrevenda').value);
    serieRsi.createPriceLine({ price: sobrec, color: 'rgba(0,0,0,0.25)', lineStyle: LightweightCharts.LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: String(sobrec) });
    serieRsi.createPriceLine({ price: sobrev, color: 'rgba(0,0,0,0.25)', lineStyle: LightweightCharts.LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: String(sobrev) });

    // ---- ATR ----
    chartAtr = LightweightCharts.createChart(document.getElementById('chartAtr'), {
        ...opcoesBase(), height: 180
    });
    serieAtr = chartAtr.addLineSeries({ color: '#27ae60', lineWidth: 2, priceLineVisible: false });
    serieAtr.setData(toLine(times, resultado.atrValues));
    serieAtrMedia = chartAtr.addLineSeries({ color: '#16a085', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
    serieAtrMedia.setData(toLine(times, resultado.atrMedia));

    // Sincroniza pan/zoom entre os três painéis (estilo TradingView)
    sincronizarTempo([chartPreco, chartRsi, chartAtr]);

    chartPreco.timeScale().fitContent();
    chartRsi.timeScale().fitContent();
    chartAtr.timeScale().fitContent();

    atualizarPaineis(resultado);
    atualizarLegenda(resultado);
}

let sincronizando = false;
function sincronizarTempo(charts) {
    charts.forEach(src => {
        src.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (sincronizando || !range) return;
            sincronizando = true;
            charts.forEach(t => { if (t !== src) t.timeScale().setVisibleLogicalRange(range); });
            sincronizando = false;
        });
    });
}

function atualizarLegenda(resultado) {
    const last = dados.length - 1;
    const el = document.getElementById('legendPreco');
    const fmt = v => (v === null || v === undefined) ? '–' : v.toFixed(4);
    el.innerHTML =
        `<span class="lg lg-close">O ${dados[last].open.toFixed(4)} · H ${dados[last].high.toFixed(4)} · L ${dados[last].low.toFixed(4)} · C ${dados[last].close.toFixed(4)}</span>` +
        `<span class="lg lg-ema9">EMA ${document.getElementById('emaRapida').value}: ${fmt(resultado.emaR[last])}</span>` +
        `<span class="lg lg-ema21">EMA ${document.getElementById('emaLenta').value}: ${fmt(resultado.emaL[last])}</span>` +
        (document.getElementById('useEma200').checked ? `<span class="lg lg-ema200">EMA 200: ${fmt(resultado.ema200[last])}</span>` : '');
}

// ============================================================================
// BLOCO 6 — PAINÉIS: STATUS + TABELA DE ENTRADAS
// ============================================================================

function atualizarPaineis(resultado) {
    document.getElementById('countLong').textContent = sinaisLong.length;
    document.getElementById('countShort').textContent = sinaisShort.length;

    // Viés atual
    const last = resultado.closes.length - 1;
    let bias = 'NEUTRO';
    const er = resultado.emaR[last], el = resultado.emaL[last], e2 = resultado.ema200[last], cl = resultado.closes[last];
    if (er !== null && el !== null && e2 !== null) {
        if (er > el && cl > e2) bias = '🟢 ALTA';
        else if (er < el && cl < e2) bias = '🔴 BAIXA';
    }
    document.getElementById('currentBias').textContent = bias;

    // Status dos filtros
    const filtersStatus = document.getElementById('filtersStatus');
    filtersStatus.innerHTML = '';
    const filters = [
        { name: 'Tendência (EMA)', enabled: document.getElementById('useTendencia').checked },
        { name: 'Macro (EMA200)', enabled: document.getElementById('useEma200').checked },
        { name: 'Momentum (RSI)', enabled: document.getElementById('useMomentum').checked },
        { name: 'Volatilidade (ATR)', enabled: document.getElementById('useVolatilidade').checked },
        { name: 'Estrutura', enabled: document.getElementById('useEstrutura').checked }
    ];
    filters.forEach(f => {
        const div = document.createElement('div');
        div.className = 'filter-item';
        div.innerHTML = `<span>${f.name}</span><span class="filter-status-icon ${f.enabled ? 'filter-status-ok' : 'filter-status-disabled'}">${f.enabled ? '✓' : '–'}</span>`;
        filtersStatus.appendChild(div);
    });

    // Tabela de entradas
    const tbody = document.getElementById('entryTableBody');
    tbody.innerHTML = '';
    // Mostra as últimas 30 entradas (mais recentes primeiro)
    const lista = [...entradas].reverse().slice(0, 30);
    lista.forEach((e, idx) => {
        const tr = document.createElement('tr');
        const dirClass = e.dir === 'CALL' ? 'dir-call' : 'dir-put';
        const resClass = e.resultado === 'WIN' ? 'res-win' : e.resultado === 'LOSS' ? 'res-loss' : 'res-pend';
        tr.innerHTML =
            `<td>${entradas.length - idx}</td>` +
            `<td>${fmtHora(e.entryTime)}</td>` +
            `<td class="${dirClass}">${e.dir === 'CALL' ? '▲ CALL' : '▼ PUT'}</td>` +
            `<td>${e.entryPrice.toFixed(4)}</td>` +
            `<td>${e.expMin} min</td>` +
            `<td>${fmtHora(e.expTime)}</td>` +
            `<td class="${resClass}">${e.resultado}</td>`;
        tbody.appendChild(tr);
    });

    // Resumo (win rate)
    const avaliadas = entradas.filter(e => e.resultado === 'WIN' || e.resultado === 'LOSS');
    const wins = entradas.filter(e => e.resultado === 'WIN').length;
    const losses = entradas.filter(e => e.resultado === 'LOSS').length;
    const pend = entradas.filter(e => e.resultado === 'pendente').length;
    const winRate = avaliadas.length ? ((wins / avaliadas.length) * 100).toFixed(1) : '–';
    document.getElementById('entrySummary').innerHTML =
        `<span class="sum-item">Total entradas: <strong>${entradas.length}</strong></span>` +
        `<span class="sum-item sum-win">WIN: <strong>${wins}</strong></span>` +
        `<span class="sum-item sum-loss">LOSS: <strong>${losses}</strong></span>` +
        `<span class="sum-item sum-pend">Pendentes: <strong>${pend}</strong></span>` +
        `<span class="sum-item sum-rate">Win rate: <strong>${winRate}${winRate === '–' ? '' : '%'}</strong></span>`;

    // Dica quando não há entradas
    const hint = document.getElementById('entryHint');
    if (entradas.length === 0) {
        const poucas = dados.length < 200 && document.getElementById('useEma200').checked;
        hint.textContent = poucas
            ? '💡 Filtro EMA 200 ativo com menos de 200 velas — gere mais velas ou desligue a EMA 200.'
            : '💡 Nenhuma entrada com estes filtros. A confluência estrita gera poucos sinais (por design) — afrouxe um filtro (ex.: Estrutura ou Momentum) ou gere novos dados.';
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

// ============================================================================
// BLOCO 7 — ORQUESTRAÇÃO
// ============================================================================

function recalcularTudo() {
    const resultado = calcularIndicador(dados);
    calcularEntradas();
    renderizarGraficos(resultado);
}

function gerarErenderizar() {
    const numCandles = parseInt(document.getElementById('numCandles').value);
    const volatilidade = parseFloat(document.getElementById('volatility').value);
    dados = gerarDadosSim(numCandles, volatilidade);
    recalcularTudo();
}

// ============================================================================
// BLOCO 8 — EVENT LISTENERS
// ============================================================================

document.getElementById('btnGerar').addEventListener('click', gerarErenderizar);
document.getElementById('btnRecalcular').addEventListener('click', function () {
    if (dados.length === 0) { alert('Gere dados primeiro clicando em "Gerar Dados"'); return; }
    recalcularTudo();
});
// Mudar timeframe regenera os dados (timestamps mudam); expiração só recalcula
document.getElementById('timeframe').addEventListener('change', gerarErenderizar);
document.getElementById('expiracao').addEventListener('change', function () {
    if (dados.length === 0) { gerarErenderizar(); return; }
    recalcularTudo();
});

// Redimensionar gráficos com a janela
window.addEventListener('resize', function () {
    const w = document.getElementById('chartPreco').clientWidth;
    if (chartPreco) chartPreco.applyOptions({ width: w });
    if (chartRsi) chartRsi.applyOptions({ width: document.getElementById('chartRsi').clientWidth });
    if (chartAtr) chartAtr.applyOptions({ width: document.getElementById('chartAtr').clientWidth });
});

// Inicializar ao carregar
window.addEventListener('load', gerarErenderizar);
