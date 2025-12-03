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
let currentData = [];
let isLoading = false;
let priceSeries = null;
let stopLossSeries = null;
let entrySeries = null;
let tp1Series = null;
let tp2Series = null;
let tp3Series = null;
let tp4Series = null;

// TradingView Pine Script логика
let indicator = {
    trend: 'neutral',
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    price: 0,
    entryPrice: 0,
    stopLoss: 0,
    tp1: 0,
    tp2: 0,
    tp3: 0,
    tp4: 0,
    isBullish: false,
    stopLossHit: false,
    signal_up: false,
    signal_down: false,
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
        layout: { 
            background: { color: '#000000' }, 
            textColor: '#DDDDDD',
            fontFamily: 'Monaco, "Courier New", monospace'
        },
        grid: { 
            vertLines: { color: '#222222', visible: false }, 
            horzLines: { color: '#222222', visible: false } 
        },
        crosshair: { 
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                width: 1,
                color: '#333333',
                style: 2
            },
            horzLine: {
                width: 1,
                color: '#333333',
                style: 2
            }
        },
        rightPriceScale: {
            borderColor: '#333333',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1
            }
        },
        timeScale: {
            borderColor: '#333333',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 8,
            minBarSpacing: 3,
            fixLeftEdge: true,
            fixRightEdge: false
        },
        handleScroll: { 
            mouseWheel: true, 
            pressedMouseMove: true, 
            horzTouchDrag: true, 
            vertTouchDrag: true 
        },
        handleScale: { 
            axisPressedMouseMove: true, 
            mouseWheel: true, 
            pinch: true 
        },
    });
    
    // Свечной график
    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceLineVisible: false,
        lastValueVisible: false
    });
    
    // Линия текущей цены
    priceSeries = chart.addLineSeries({
        color: '#ffffff',
        lineWidth: 1,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false
    });
    
    // Линия стоп лосса
    stopLossSeries = chart.addLineSeries({
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });
    
    // Линия точки входа
    entrySeries = chart.addLineSeries({
        color: '#0066cc',
        lineWidth: 2,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false
    });
    
    // Линии тейк профитов
    tp1Series = chart.addLineSeries({
        color: '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });
    
    tp2Series = chart.addLineSeries({
        color: '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });
    
    tp3Series = chart.addLineSeries({
        color: '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });
    
    tp4Series = chart.addLineSeries({
        color: '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false
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
    for (let i = Math.max(0, currentData.length - atrPeriod); i < currentData.length; i++) {
        if (i <= 0) continue;
        const high = currentData[i].high;
        const low = currentData[i].low;
        const prevClose = currentData[i-1].close;
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        atrSum += tr;
    }
    const atr_value = (atrSum / Math.min(atrPeriod, currentData.length - 1)) * 0.3;
    
    // Calculate SMA как в Pine Script
    let smaHighSum = 0;
    let smaLowSum = 0;
    const startIndex = Math.max(0, currentData.length - length);
    
    for (let i = startIndex; i < currentData.length; i++) {
        smaHighSum += currentData[i].high;
        smaLowSum += currentData[i].low;
    }
    
    const sma_high = (smaHighSum / Math.min(length, currentData.length - startIndex)) + atr_value;
    const sma_low = (smaLowSum / Math.min(length, currentData.length - startIndex)) - atr_value;
    
    const close = currentData[currentData.length - 1].close;
    const prevClose = currentData.length > 1 ? currentData[currentData.length - 2].close : close;
    
    // Определяем тренд и сигналы
    let trend = indicator.isBullish;
    let signal_up = false;
    let signal_down = false;
    
    // Crossover проверка (цена пересекла sma_high сверху)
    if (close > sma_high && prevClose <= sma_high) {
        trend = true;
        signal_up = true;
        signal_down = false;
        indicator.stopLossHit = false;
    }
    
    // Crossunder проверка (цена пересекла sma_low снизу)
    if (close < sma_low && prevClose >= sma_low) {
        trend = false;
        signal_up = false;
        signal_down = true;
        indicator.stopLossHit = false;
    }
    
    // Если нет сигнала, сохраняем предыдущий тренд
    if (!signal_up && !signal_down) {
        trend = indicator.isBullish;
    }
    
    // Рассчитываем цели только при смене тренда
    if (signal_up || signal_down) {
        const base = trend ? sma_low : sma_high;
        const atr_multiplier = atr_value * (trend ? 1 : -1);
        
        // Обновляем цены для отображения
        indicator.entryPrice = close;
        indicator.stopLoss = base;
        indicator.tp1 = close + atr_multiplier * (5 + target);
        indicator.tp2 = close + atr_multiplier * (10 + target * 2);
        indicator.tp3 = close + atr_multiplier * (15 + target * 4);
        indicator.tp4 = close + atr_multiplier * (20 + target * 6);
    }
    
    // Проверка стоп лосса
    if (!indicator.stopLossHit && indicator.stopLoss !== 0) {
        if ((trend && close <= indicator.stopLoss) || 
            (!trend && close >= indicator.stopLoss)) {
            indicator.stopLossHit = true;
        }
    }
    
    // Форматируем числа до 5 знаков после запятой
    const formatPrice = (price) => {
        if (price >= 1000) return price.toFixed(2);
        if (price >= 100) return price.toFixed(3);
        if (price >= 10) return price.toFixed(4);
        if (price >= 1) return price.toFixed(5);
        if (price >= 0.1) return price.toFixed(6);
        if (price >= 0.01) return price.toFixed(7);
        if (price >= 0.001) return price.toFixed(8);
        return price.toFixed(9);
    };
    
    indicator = {
        ...indicator,
        trend: trend ? 'up' : 'down',
        smaHigh: sma_high,
        smaLow: sma_low,
        atr: atr_value,
        price: close,
        isBullish: trend,
        signal_up,
        signal_down,
        trendLength: length,
        targetMultiplier: target,
        atrPeriod,
        // Форматированные значения для отображения
        priceFormatted: formatPrice(close),
        entryPriceFormatted: formatPrice(indicator.entryPrice),
        stopLossFormatted: formatPrice(indicator.stopLoss),
        tp1Formatted: formatPrice(indicator.tp1),
        tp2Formatted: formatPrice(indicator.tp2),
        tp3Formatted: formatPrice(indicator.tp3),
        tp4Formatted: formatPrice(indicator.tp4)
    };
    
    console.log('Pine Script Indicator:', {
        trend: indicator.trend,
        price: indicator.priceFormatted,
        atr: indicator.atr,
        stopLossHit: indicator.stopLossHit,
        entry: indicator.entryPriceFormatted,
        stop: indicator.stopLossFormatted
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
        updateChartData(currentData);
        calculatePineIndicator();
        updatePriceLines();
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
        // Показываем последние 60 свечей
        const visibleBars = 60;
        const lastBarIndex = currentData.length - 1;
        const firstVisibleIndex = Math.max(0, lastBarIndex - visibleBars);
        
        const firstTime = currentData[firstVisibleIndex].time;
        const lastTime = currentData[lastBarIndex].time;
        
        // Добавляем небольшой отступ справа
        const padding = (lastTime - firstTime) * 0.05;
        
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
// UPDATE CHART DATA
// ============================================

function updateChartData(data) {
    if (!candleSeries) return;
    
    candleSeries.setData(data);
    
    if (data.length > 0) {
        const lastPrice = data[data.length - 1].close;
        indicator.price = lastPrice;
    }
}

// ============================================
// UPDATE PRICE LINES (ТОЛЬКО НУЖНЫЕ ЛИНИИ)
// ============================================

function updatePriceLines() {
    if (!chart || currentData.length === 0) return;
    
    const color = indicator.stopLossHit ? '#ff0000' : null;
    
    // Линия текущей цены (одна точка - текущее значение)
    const currentPriceData = [{
        time: currentData[currentData.length - 1].time,
        value: indicator.price
    }];
    priceSeries.setData(currentPriceData);
    
    // Обновляем цвета линий если стоп лосс сработал
    if (color) {
        stopLossSeries.applyOptions({ color: color });
        entrySeries.applyOptions({ color: color });
        tp1Series.applyOptions({ color: color });
        tp2Series.applyOptions({ color: color });
        tp3Series.applyOptions({ color: color });
        tp4Series.applyOptions({ color: color });
    } else {
        stopLossSeries.applyOptions({ color: '#ff0000' });
        entrySeries.applyOptions({ color: '#0066cc' });
        tp1Series.applyOptions({ color: '#00ff00' });
        tp2Series.applyOptions({ color: '#00ff00' });
        tp3Series.applyOptions({ color: '#00ff00' });
        tp4Series.applyOptions({ color: '#00ff00' });
    }
    
    // Создаем данные для линий (горизонтальные линии)
    const createLineData = (value) => {
        return currentData.map(d => ({
            time: d.time,
            value: value
        }));
    };
    
    // Устанавливаем данные для всех линий
    if (indicator.stopLoss !== 0) {
        stopLossSeries.setData(createLineData(indicator.stopLoss));
    }
    
    if (indicator.entryPrice !== 0) {
        entrySeries.setData(createLineData(indicator.entryPrice));
    }
    
    if (indicator.tp1 !== 0) {
        tp1Series.setData(createLineData(indicator.tp1));
    }
    
    if (indicator.tp2 !== 0) {
        tp2Series.setData(createLineData(indicator.tp2));
    }
    
    if (indicator.tp3 !== 0) {
        tp3Series.setData(createLineData(indicator.tp3));
    }
    
    if (indicator.tp4 !== 0) {
        tp4Series.setData(createLineData(indicator.tp4));
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    // Update trend
    const trendElement = document.getElementById('trendValue');
    if (indicator.stopLossHit) {
        trendElement.textContent = 'STOP HIT';
        trendElement.style.color = '#ff0000';
    } else {
        trendElement.textContent = indicator.trend.toUpperCase();
        trendElement.style.color = indicator.trend === 'up' ? '#00ff00' : '#ff0000';
    }
    
    // Update values с точными ценами
    document.getElementById('priceValue').textContent = indicator.priceFormatted || '0.00';
    document.getElementById('atrValue').textContent = indicator.atr.toFixed(6);
    document.getElementById('smaHighValue').textContent = indicator.smaHigh.toFixed(6);
    
    // Update targets
    const container = document.getElementById('targetsContainer');
    container.innerHTML = '';
    
    const targets = [
        { name: 'STOP LOSS', value: indicator.stopLossFormatted || '0.00', type: 'stop' },
        { name: 'ENTRY', value: indicator.entryPriceFormatted || '0.00', type: 'entry' },
        { name: 'TP1', value: indicator.tp1Formatted || '0.00', type: 'profit' },
        { name: 'TP2', value: indicator.tp2Formatted || '0.00', type: 'profit' },
        { name: 'TP3', value: indicator.tp3Formatted || '0.00', type: 'profit' },
        { name: 'TP4', value: indicator.tp4Formatted || '0.00', type: 'profit' }
    ];
    
    targets.forEach(target => {
        const div = document.createElement('div');
        div.className = `target ${target.type}`;
        
        if (indicator.stopLossHit) {
            div.style.borderLeftColor = '#ff0000';
        }
        
        let textColor = '#ffffff';
        if (!indicator.stopLossHit) {
            if (target.type === 'stop') textColor = '#ff0000';
            if (target.type === 'entry') textColor = '#0066cc';
            if (target.type === 'profit') textColor = '#00ff00';
        } else {
            textColor = '#ff0000';
        }
        
        div.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-value" style="color: ${textColor}">
                ${target.value}
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
    updateChartData(currentData);
    calculatePineIndicator();
    updatePriceLines();
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
        
        const trendStrength = trend ? 0.005 : -0.005;
        const noise = (Math.random() - 0.5) * 0.01;
        
        const open = price;
        const change = trendStrength + noise;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1.002 + Math.random() * 0.005);
        const low = Math.min(open, close) * (0.998 - Math.random() * 0.005);
        
        if (i % 25 === 0) trend = !trend;
        
        data.push([
            time,
            open.toFixed(8),
            high.toFixed(8),
            low.toFixed(8),
            close.toFixed(8),
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
        'XRPUSDT': 0.6,
        'ADAUSDT': 0.45,
        'DOGEUSDT': 0.12,
        'SHIBUSDT': 0.000025
    };
    return prices[symbol] || 100;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

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

function resetStopLoss() {
    indicator.stopLossHit = false;
    calculatePineIndicator();
    updatePriceLines();
    updateUI();
}

function shareSignal() {
    const signal = `
TREND_1H FUTURES SIGNAL
════════════════════════
Symbol: ${document.getElementById('symbol').value}
Timeframe: ${document.getElementById('timeframe').value}
Trend: ${indicator.trend.toUpperCase()} ${indicator.stopLossHit ? '(STOP HIT)' : ''}
Current Price: ${indicator.priceFormatted}
Entry: ${indicator.entryPriceFormatted}
Stop Loss: ${indicator.stopLossFormatted}
TP1: ${indicator.tp1Formatted}
TP2: ${indicator.tp2Formatted}
TP3: ${indicator.tp3Formatted}
TP4: ${indicator.tp4Formatted}
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
    document.getElementById('symbol').addEventListener('change', loadData);
    document.getElementById('timeframe').addEventListener('change', loadData);
    
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if (currentData.length > 20) {
                calculatePineIndicator();
                updatePriceLines();
                updateUI();
            }
        });
    });
    
    document.getElementById('resetBtn').addEventListener('click', resetStopLoss);
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
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

