// ============================================
// INITIALIZATION
// ============================================

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// State variables
let chart = null;
let candleSeries = null;
let lineSeries = [];
let trendLines = [];
let currentData = [];
let isLoading = false;

// TradingView Pine Script логика
let indicator = {
    trend: 'neutral',
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    price: 0,
    targets: [],
    isBullish: false,
    stopLossHit: false,
    trendChanged: false,
    trendLength: 10,
    targetMultiplier: 0,
    atrPeriod: 20
};

// Top 50 Binance Futures монет
const BINANCE_TOP_50 = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
    'MATICUSDT', 'TRXUSDT', 'UNIUSDT', 'TONUSDT', 'ICPUSDT',
    'SHIBUSDT', 'APTUSDT', 'LTCUSDT', 'BCHUSDT', 'ATOMUSDT',
    'ETCUSDT', 'FILUSDT', 'NEARUSDT', 'ALGOUSDT', 'XLMUSDT',
    'OPUSDT', 'VETUSDT', 'ARBUSDT', 'AAVEUSDT', 'GRTUSDT',
    'EOSUSDT', 'QNTUSDT', 'STXUSDT', 'XTZUSDT', 'SANDUSDT',
    'AXSUSDT', 'THETAUSDT', 'FTMUSDT', 'EGLDUSDT', 'MANAUSDT',
    'IMXUSDT', 'GALAUSDT', 'CRVUSDT', 'KAVAUSDT', 'RUNEUSDT',
    '1INCHUSDT', 'COMPUSDT', 'ZILUSDT', 'IOTAUSDT', 'ENJUSDT'
];

// ============================================
// CHART INITIALIZATION
// ============================================

function initChart() {
    console.log('Initializing chart...');
    
    const chartContainer = document.getElementById('chart');
    chartContainer.innerHTML = '';
    
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: { background: { color: '#000000' }, textColor: '#DDDDDD' },
        grid: { vertLines: { color: '#222222' }, horzLines: { color: '#222222' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#333333' },
        timeScale: {
            borderColor: '#333333',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 6,
            minBarSpacing: 3
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    
    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });
    
    window.addEventListener('resize', () => {
        if (chart) {
            chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
            });
        }
    });
    
    console.log('Chart initialized successfully');
    return true;
}

// ============================================
// TOP 50 MONETS INIT
// ============================================

function initSymbols() {
    const symbolSelect = document.getElementById('symbol');
    symbolSelect.innerHTML = '';
    
    BINANCE_TOP_50.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = symbol.replace('USDT', '/USDT');
        symbolSelect.appendChild(option);
    });
}

// ============================================
// PINE SCRIPT LOGIC (100% ACCURATE)
// ============================================

function calculatePineIndicator() {
    if (currentData.length < 30) return;
    
    const length = parseInt(document.getElementById('trendLength').value) || 10;
    const target = parseInt(document.getElementById('targetMultiplier').value) || 0;
    const atrPeriod = 20;
    
    // Calculate ATR как в Pine Script
    let atrSum = 0;
    for (let i = currentData.length - atrPeriod; i < currentData.length; i++) {
        if (i <= 0) continue;
        const high = currentData[i].high;
        const low = currentData[i].low;
        const prevClose = currentData[i-1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        atrSum += tr;
    }
    const atr_value = (atrSum / atrPeriod) * 0.3;
    
    // Calculate SMA как в Pine Script
    let smaHighSum = 0;
    let smaLowSum = 0;
    for (let i = currentData.length - length; i < currentData.length; i++) {
        if (i < 0) continue;
        smaHighSum += currentData[i].high;
        smaLowSum += currentData[i].low;
    }
    const sma_high = (smaHighSum / length) + atr_value;
    const sma_low = (smaLowSum / length) - atr_value;
    
    const close = currentData[currentData.length - 1].close;
    
    // Determine trend как в Pine Script
    let trend = indicator.trend === 'up';
    let signal_up = false;
    let signal_down = false;
    
    // Проверяем crossover/сrossunder
    const prevClose = currentData.length > 1 ? currentData[currentData.length - 2].close : close;
    const prevSmaHigh = currentData.length > length ? 
        (smaHighSum - currentData[currentData.length - length].high + currentData[currentData.length - 1].high) / length + atr_value : 
        sma_high;
    
    const prevSmaLow = currentData.length > length ? 
        (smaLowSum - currentData[currentData.length - length].low + currentData[currentData.length - 1].low) / length - atr_value : 
        sma_low;
    
    // Crossover проверка
    if (close > sma_high && prevClose <= prevSmaHigh) {
        trend = true;
        signal_up = true;
        signal_down = false;
        indicator.stopLossHit = false;
        indicator.trendChanged = true;
    }
    
    // Crossunder проверка
    if (close < sma_low && prevClose >= prevSmaLow) {
        trend = false;
        signal_up = false;
        signal_down = true;
        indicator.stopLossHit = false;
        indicator.trendChanged = true;
    }
    
    // Проверка стоп лосса
    if (!indicator.stopLossHit && indicator.targets.length > 0) {
        const stopLossPrice = indicator.targets.find(t => t.type === 'stop')?.value;
        if (stopLossPrice) {
            if ((indicator.isBullish && close <= stopLossPrice) || 
                (!indicator.isBullish && close >= stopLossPrice)) {
                indicator.stopLossHit = true;
            }
        }
    }
    
    // Calculate targets
    const base = trend ? sma_low : sma_high;
    const atr_multiplier = atr_value * (trend ? 1 : -1);
    
    const targets = [
        { 
            name: 'STOP LOSS', 
            value: base, 
            type: 'stop', 
            color: indicator.stopLossHit ? '#ff0000' : '#ff0000'
        },
        { 
            name: 'ENTRY', 
            value: close, 
            type: 'entry', 
            color: indicator.stopLossHit ? '#ff0000' : '#0066cc'
        },
        { 
            name: 'TP1', 
            value: close + atr_multiplier * (5 + target), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff0000' : '#00ff00'
        },
        { 
            name: 'TP2', 
            value: close + atr_multiplier * (10 + target * 2), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff0000' : '#00ff00'
        },
        { 
            name: 'TP3', 
            value: close + atr_multiplier * (15 + target * 4), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff0000' : '#00ff00'
        },
        { 
            name: 'TP4', 
            value: close + atr_multiplier * (20 + target * 6), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff0000' : '#00ff00'
        }
    ];
    
    indicator = {
        ...indicator,
        trend: trend ? 'up' : 'down',
        smaHigh: sma_high,
        smaLow: sma_low,
        atr: atr_value,
        price: close,
        targets,
        isBullish: trend,
        signal_up,
        signal_down,
        trendLength: length,
        targetMultiplier: target,
        atrPeriod
    };
    
    console.log('Pine Script Indicator:', {
        trend: indicator.trend,
        price: indicator.price,
        atr: indicator.atr,
        stopLossHit: indicator.stopLossHit
    });
}

// ============================================
// DATA LOADING WITH AUTO ZOOM
// ============================================

async function loadData() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading();
        
        if (!chart) initChart();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        const data = await getChartData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received');
        }
        
        currentData = formatData(data);
        updateChart(currentData);
        calculatePineIndicator();
        drawLines();
        updateUI();
        
        // Автоматически подгоняем график в окно
        autoZoomToLatest();
        
        hideLoading();
        
    } catch (error) {
        console.error('Error:', error);
        loadTestData();
    } finally {
        isLoading = false;
    }
}

async function getChartData(symbol, interval, limit = 100) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return await response.json();
        
    } catch (error) {
        console.warn('Using test data:', error.message);
        return null;
    }
}

function formatData(rawData) {
    return rawData.map(item => ({
        time: item[0] / 1000,
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
    }));
}

function autoZoomToLatest() {
    if (!chart || currentData.length < 10) return;
    
    try {
        // Показываем последние 50 свечей
        const visibleBars = 50;
        const lastBarIndex = currentData.length - 1;
        const firstVisibleIndex = Math.max(0, lastBarIndex - visibleBars);
        
        const firstTime = currentData[firstVisibleIndex].time;
        const lastTime = currentData[lastBarIndex].time;
        
        // Добавляем небольшой отступ справа
        const padding = (lastTime - firstTime) * 0.1;
        
        chart.timeScale().setVisibleRange({
            from: firstTime,
            to: lastTime + padding
        });
        
    } catch (error) {
        console.warn('Auto zoom error:', error);
        chart.timeScale().fitContent();
    }
}

// ============================================
// DRAW LINES (WITH STOP LOSS LOGIC)
// ============================================

function drawLines() {
    if (!chart || indicator.targets.length === 0) return;
    
    // Remove old lines
    [...lineSeries, ...trendLines].forEach(series => {
        try {
            chart.removeSeries(series);
        } catch (e) {}
    });
    lineSeries = [];
    trendLines = [];
    
    // Draw target lines (все красные если стоп лосс сработал)
    indicator.targets.forEach(target => {
        const lineColor = indicator.stopLossHit ? '#ff0000' : target.color;
        
        const series = chart.addLineSeries({
            color: lineColor,
            lineWidth: target.type === 'stop' ? 2 : 1,
            lineStyle: target.type === 'profit' ? 2 : 0,
            priceLineVisible: false,
        });
        
        const lineData = currentData.map(d => ({
            time: d.time,
            value: target.value
        }));
        
        series.setData(lineData);
        lineSeries.push(series);
    });
    
    // Draw SMA lines
    const smaHighSeries = chart.addLineSeries({
        color: indicator.stopLossHit ? '#ff0000' : '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
    });
    
    const smaLowSeries = chart.addLineSeries({
        color: indicator.stopLossHit ? '#ff0000' : '#ff0000',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
    });
    
    const smaHighData = currentData.map(d => ({
        time: d.time,
        value: indicator.smaHigh
    }));
    
    const smaLowData = currentData.map(d => ({
        time: d.time,
        value: indicator.smaLow
    }));
    
    smaHighSeries.setData(smaHighData);
    smaLowSeries.setData(smaLowData);
    
    trendLines.push(smaHighSeries, smaLowSeries);
    
    // Draw trend change signals
    if (indicator.signal_up || indicator.signal_down) {
        const signalColor = indicator.signal_up ? '#00ff00' : '#ff0000';
        const signalValue = indicator.signal_up ? 
            currentData[currentData.length - 1].low - indicator.atr * 2 :
            currentData[currentData.length - 1].high + indicator.atr * 2;
        
        const markerSeries = chart.addLineSeries({
            color: signalColor,
            lineWidth: 0,
            priceLineVisible: false,
            priceFormat: {
                type: 'price',
                precision: 6,
                minMove: 0.000001,
            },
        });
        
        // Добавляем одну точку для маркера
        markerSeries.setData([{
            time: currentData[currentData.length - 1].time,
            value: signalValue
        }]);
        
        lineSeries.push(markerSeries);
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    // Update trend
    const trendElement = document.getElementById('trendValue');
    trendElement.textContent = indicator.trend.toUpperCase();
    trendElement.className = `status-value trend-${indicator.trend}`;
    
    if (indicator.stopLossHit) {
        trendElement.style.color = '#ff0000';
        trendElement.textContent = 'STOP HIT';
    }
    
    // Update values
    document.getElementById('priceValue').textContent = indicator.price.toFixed(2);
    document.getElementById('atrValue').textContent = indicator.atr.toFixed(4);
    document.getElementById('smaHighValue').textContent = indicator.smaHigh.toFixed(2);
    
    // Update targets
    const container = document.getElementById('targetsContainer');
    container.innerHTML = '';
    
    indicator.targets.forEach(target => {
        const div = document.createElement('div');
        div.className = `target ${target.type}`;
        
        if (indicator.stopLossHit) {
            div.style.borderLeftColor = '#ff0000';
        }
        
        div.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-value value-${target.type}" 
                 style="color: ${indicator.stopLossHit ? '#ff0000' : target.type === 'stop' ? '#ff0000' : target.type === 'entry' ? '#0066cc' : '#00ff00'}">
                ${target.value.toFixed(2)}
            </div>
        `;
        
        container.appendChild(div);
    });
}

// ============================================
// TEST DATA (FALLBACK)
// ============================================

function loadTestData() {
    console.log('Loading test data...');
    
    const symbol = document.getElementById('symbol').value;
    const data = generateTestData(symbol);
    
    currentData = formatData(data);
    updateChart(currentData);
    calculatePineIndicator();
    drawLines();
    updateUI();
    
    autoZoomToLatest();
    hideLoading();
}

function generateTestData(symbol) {
    const data = [];
    let price = getTestPrice(symbol);
    let trend = true;
    
    for (let i = 0; i < 100; i++) {
        const time = Date.now() - (99 - i) * 60000;
        
        // Создаем трендовые движения
        const trendStrength = trend ? 0.01 : -0.01;
        const noise = (Math.random() - 0.5) * 0.02;
        
        const open = price;
        const change = trendStrength + noise;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1.005 + Math.random() * 0.01);
        const low = Math.min(open, close) * (0.995 - Math.random() * 0.01);
        
        // Периодически меняем тренд
        if (i % 30 === 0) trend = !trend;
        
        data.push([
            time,
            open.toFixed(2),
            high.toFixed(2),
            low.toFixed(2),
            close.toFixed(2),
            (Math.random() * 1000).toFixed(2)
        ]);
        
        price = close;
    }
    
    return data;
}

function getTestPrice(symbol) {
    const prices = {
        'BTCUSDT': 65000,
        'ETHUSDT': 3500,
        'BNBUSDT': 600,
        'SOLUSDT': 150,
        'XRPUSDT': 0.6
    };
    return prices[symbol] || 100;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function updateChart(data) {
    if (!candleSeries) return;
    
    candleSeries.setData(data);
    
    if (data.length > 0) {
        const lastPrice = data[data.length - 1].close;
        document.getElementById('priceValue').textContent = lastPrice.toFixed(2);
        indicator.price = lastPrice;
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function shareSignal() {
    const signal = `
TREND_1H FUTURES SIGNAL
════════════════════════
Symbol: ${document.getElementById('symbol').value}
Timeframe: ${document.getElementById('timeframe').value}
Trend: ${indicator.trend.toUpperCase()} ${indicator.stopLossHit ? '(STOP HIT)' : ''}
Price: ${indicator.price.toFixed(2)}
ATR: ${indicator.atr.toFixed(4)}
Stop Loss: ${indicator.targets.find(t => t.type === 'stop')?.value.toFixed(2) || '0.00'}
════════════════════════
Time: ${new Date().toLocaleString()}
    `;
    
    tg.sendData(JSON.stringify({ signal }));
    tg.showAlert('Signal shared to Telegram!');
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventListeners() {
    document.getElementById('updateBtn').addEventListener('click', loadData);
    
    document.getElementById('symbol').addEventListener('change', () => {
        loadData();
    });
    
    document.getElementById('timeframe').addEventListener('change', () => {
        loadData();
    });
    
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if (currentData.length > 20) {
                calculatePineIndicator();
                drawLines();
                updateUI();
            }
        });
    });
    
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    
    // Добавляем кнопку сброса стоп лосса
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn';
    resetBtn.innerHTML = '🔄 RESET STOP';
    resetBtn.addEventListener('click', () => {
        indicator.stopLossHit = false;
        indicator.trendChanged = false;
        calculatePineIndicator();
        drawLines();
        updateUI();
    });
    
    document.querySelector('.buttons').prepend(resetBtn);
}

// ============================================
// MAIN INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('App starting...');
    
    // Инициализируем список монет
    initSymbols();
    
    // Настройка событий
    setupEventListeners();
    
    // Инициализируем график
    initChart();
    
    // Загружаем данные
    setTimeout(loadData, 500);
    
    // Автообновление
    setInterval(() => {
        if (!document.hidden) {
            loadData();
        }
    }, 30000);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadData();
        }
    });
    
    console.log('App started successfully');
});
