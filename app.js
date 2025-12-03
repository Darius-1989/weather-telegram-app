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

// Линии индикатора
let priceLines = {
    stopLoss: null,
    entry: null,
    tp1: null,
    tp2: null,
    tp3: null,
    tp4: null
};

// TradingView Pine Script логика
let indicator = {
    trend: 'neutral',
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
    signal_down: false
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

// Определяем точность для разных монет
const PRICE_PRECISION = {
    'BTCUSDT': 2,
    'ETHUSDT': 2,
    'BNBUSDT': 2,
    'SOLUSDT': 3,
    'XRPUSDT': 4,
    'ADAUSDT': 4,
    'DOGEUSDT': 5,
    'SHIBUSDT': 8,
    // Остальные монеты по умолчанию
    'default': 4
};

// ============================================
// CHART INITIALIZATION
// ============================================

function initChart() {
    console.log('Initializing chart...');
    
    const chartContainer = document.getElementById('chart');
    chartContainer.innerHTML = '';
    
    // Определяем символ для настройки точности
    const symbol = document.getElementById('symbol').value;
    const precision = getPricePrecision(symbol);
    
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: { 
            background: { color: '#000000' }, 
            textColor: '#DDDDDD',
            fontFamily: 'Monaco, "Courier New", monospace'
        },
        grid: { 
            vertLines: { color: '#222222', visible: true }, 
            horzLines: { color: '#222222', visible: true } 
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
                top: 0.05,
                bottom: 0.05
            },
            minimumWidth: 80
        },
        timeScale: {
            borderColor: '#333333',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5,
            barSpacing: 6,
            minBarSpacing: 3,
            fixLeftEdge: true,
            fixRightEdge: false,
            borderVisible: false
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
        lastValueVisible: false,
        priceFormat: {
            type: 'price',
            precision: precision,
            minMove: Math.pow(10, -precision)
        }
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

function getPricePrecision(symbol) {
    return PRICE_PRECISION[symbol] || PRICE_PRECISION.default;
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
// PINE SCRIPT LOGIC
// ============================================

function calculatePineIndicator() {
    if (currentData.length < 30) return;
    
    const length = parseInt(document.getElementById('trendLength').value) || 10;
    const target = parseInt(document.getElementById('targetMultiplier').value) || 0;
    const atrPeriod = 20;
    
    // Calculate ATR
    let atrSum = 0;
    const startATR = Math.max(1, currentData.length - atrPeriod);
    
    for (let i = startATR; i < currentData.length; i++) {
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
    
    const atr_value = (atrSum / (currentData.length - startATR)) * 0.3;
    
    // Calculate SMA
    let smaHighSum = 0;
    let smaLowSum = 0;
    const startSMA = Math.max(0, currentData.length - length);
    
    for (let i = startSMA; i < currentData.length; i++) {
        smaHighSum += currentData[i].high;
        smaLowSum += currentData[i].low;
    }
    
    const sma_high = (smaHighSum / (currentData.length - startSMA)) + atr_value;
    const sma_low = (smaLowSum / (currentData.length - startSMA)) - atr_value;
    
    const close = currentData[currentData.length - 1].close;
    const prevClose = currentData.length > 1 ? currentData[currentData.length - 2].close : close;
    
    // Определяем тренд
    let trend = indicator.isBullish;
    let signal_up = false;
    let signal_down = false;
    
    // Crossover проверка
    if (close > sma_high && prevClose <= sma_high) {
        trend = true;
        signal_up = true;
        signal_down = false;
        indicator.stopLossHit = false;
        console.log('BUY SIGNAL triggered');
    }
    
    // Crossunder проверка
    if (close < sma_low && prevClose >= sma_low) {
        trend = false;
        signal_up = false;
        signal_down = true;
        indicator.stopLossHit = false;
        console.log('SELL SIGNAL triggered');
    }
    
    // Рассчитываем цели только при смене тренда или если они еще не установлены
    if (signal_up || signal_down || indicator.entryPrice === 0) {
        const base = trend ? sma_low : sma_high;
        const atr_multiplier = atr_value * (trend ? 1 : -1);
        
        indicator.entryPrice = close;
        indicator.stopLoss = base;
        indicator.tp1 = close + atr_multiplier * (5 + target);
        indicator.tp2 = close + atr_multiplier * (10 + target * 2);
        indicator.tp3 = close + atr_multiplier * (15 + target * 4);
        indicator.tp4 = close + atr_multiplier * (20 + target * 6);
        
        console.log('Targets calculated:', {
            entry: indicator.entryPrice,
            stop: indicator.stopLoss,
            tp1: indicator.tp1,
            tp2: indicator.tp2,
            tp3: indicator.tp3,
            tp4: indicator.tp4
        });
    }
    
    // Проверка стоп лосса
    if (!indicator.stopLossHit && indicator.stopLoss !== 0) {
        if ((trend && close <= indicator.stopLoss) || 
            (!trend && close >= indicator.stopLoss)) {
            indicator.stopLossHit = true;
            console.log('STOP LOSS HIT!');
        }
    }
    
    // Форматируем числа
    const symbol = document.getElementById('symbol').value;
    const precision = getPricePrecision(symbol);
    
    indicator = {
        ...indicator,
        trend: trend ? 'up' : 'down',
        atr: atr_value,
        price: close,
        isBullish: trend,
        signal_up,
        signal_down
    };
}

// ============================================
// DRAW INDICATOR LINES
// ============================================

function drawIndicatorLines() {
    if (!chart || !candleSeries || indicator.entryPrice === 0) return;
    
    console.log('Drawing indicator lines...');
    
    // Удаляем старые линии
    Object.values(priceLines).forEach(line => {
        if (line) {
            candleSeries.removePriceLine(line);
        }
    });
    
    const color = indicator.stopLossHit ? '#ff0000' : null;
    
    // Создаем новые линии
    priceLines.stopLoss = candleSeries.createPriceLine({
        price: indicator.stopLoss,
        color: color || '#ff0000',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'STOP'
    });
    
    priceLines.entry = candleSeries.createPriceLine({
        price: indicator.entryPrice,
        color: color || '#0066cc',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'ENTRY'
    });
    
    priceLines.tp1 = candleSeries.createPriceLine({
        price: indicator.tp1,
        color: color || '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP1'
    });
    
    priceLines.tp2 = candleSeries.createPriceLine({
        price: indicator.tp2,
        color: color || '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP2'
    });
    
    priceLines.tp3 = candleSeries.createPriceLine({
        price: indicator.tp3,
        color: color || '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP3'
    });
    
    priceLines.tp4 = candleSeries.createPriceLine({
        price: indicator.tp4,
        color: color || '#00ff00',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP4'
    });
    
    console.log('Lines drawn successfully');
}

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        // Переинициализируем график с новой точностью
        if (chart) {
            const chartContainer = document.getElementById('chart');
            chartContainer.innerHTML = '';
            chart = null;
        }
        
        initChart();
        
        console.log(`Loading ${symbol} ${timeframe}...`);
        const data = await getChartData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received');
        }
        
        currentData = formatData(data);
        
        // Обновляем данные на графике
        if (candleSeries) {
            candleSeries.setData(currentData);
        }
        
        // Рассчитываем индикаторы
        calculatePineIndicator();
        
        // Рисуем линии
        drawIndicatorLines();
        
        // Обновляем UI
        updateUI();
        
        // Автоматически подгоняем график
        autoZoomToLatest();
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading data:', error);
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
        
        // Добавляем отступ
        const padding = (lastTime - firstTime) * 0.05;
        
        chart.timeScale().setVisibleRange({
            from: firstTime,
            to: lastTime + padding
        });
        
        // Также подгоняем масштаб по вертикали
        const visibleData = currentData.slice(firstVisibleIndex);
        let maxPrice = Math.max(...visibleData.map(d => d.high), indicator.tp4 || 0);
        let minPrice = Math.min(...visibleData.map(d => d.low), indicator.stopLoss || 0);
        
        // Добавляем отступ сверху и снизу
        const priceRange = maxPrice - minPrice;
        const paddingPercent = 0.1;
        
        maxPrice += priceRange * paddingPercent;
        minPrice -= priceRange * paddingPercent;
        
        // Устанавливаем видимый диапазон цен
        chart.priceScale('right').applyOptions({
            autoScale: false
        });
        
        setTimeout(() => {
            chart.timeScale().fitContent();
        }, 100);
        
    } catch (error) {
        console.warn('Auto zoom error:', error);
        chart.timeScale().fitContent();
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    // Форматируем цены до 4 знаков после запятой
    const formatPrice = (price) => {
        if (!price || isNaN(price)) return '0.0000';
        
        const symbol = document.getElementById('symbol').value;
        const precision = getPricePrecision(symbol);
        
        // Для очень маленьких цен показываем больше знаков
        if (price < 0.0001) {
            return price.toFixed(8);
        } else if (price < 0.01) {
            return price.toFixed(6);
        } else if (price < 1) {
            return price.toFixed(5);
        } else if (price < 10) {
            return price.toFixed(4);
        } else if (price < 100) {
            return price.toFixed(3);
        } else if (price < 1000) {
            return price.toFixed(2);
        } else {
            return price.toFixed(2);
        }
    };
    
    // Update trend
    const trendElement = document.getElementById('trendValue');
    if (indicator.stopLossHit) {
        trendElement.textContent = 'STOP HIT';
        trendElement.style.color = '#ff0000';
    } else {
        trendElement.textContent = indicator.trend.toUpperCase();
        trendElement.style.color = indicator.trend === 'up' ? '#00ff00' : '#ff0000';
    }
    
    // Update values
    document.getElementById('priceValue').textContent = formatPrice(indicator.price);
    document.getElementById('atrValue').textContent = formatPrice(indicator.atr);
    document.getElementById('entryValue').textContent = formatPrice(indicator.entryPrice);
    
    // Update targets
    const container = document.getElementById('targetsContainer');
    container.innerHTML = '';
    
    const targets = [
        { name: 'STOP LOSS', value: indicator.stopLoss, type: 'stop' },
        { name: 'ENTRY', value: indicator.entryPrice, type: 'entry' },
        { name: 'TP1', value: indicator.tp1, type: 'profit' },
        { name: 'TP2', value: indicator.tp2, type: 'profit' },
        { name: 'TP3', value: indicator.tp3, type: 'profit' },
        { name: 'TP4', value: indicator.tp4, type: 'profit' }
    ];
    
    targets.forEach(target => {
        const div = document.createElement('div');
        div.className = `target ${target.type}`;
        
        let borderColor = '#333';
        let textColor = '#fff';
        
        if (!indicator.stopLossHit) {
            if (target.type === 'stop') {
                borderColor = '#ff0000';
                textColor = '#ff0000';
            } else if (target.type === 'entry') {
                borderColor = '#0066cc';
                textColor = '#0066cc';
            } else if (target.type === 'profit') {
                borderColor = '#00ff00';
                textColor = '#00ff00';
            }
        } else {
            borderColor = '#ff0000';
            textColor = '#ff0000';
        }
        
        div.style.borderLeftColor = borderColor;
        
        div.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-value" style="color: ${textColor}">
                ${formatPrice(target.value)}
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
    
    // Переинициализируем график
    if (chart) {
        const chartContainer = document.getElementById('chart');
        chartContainer.innerHTML = '';
        chart = null;
    }
    
    initChart();
    
    // Генерируем тестовые данные
    const data = generateTestData(symbol);
    currentData = formatData(data);
    
    // Обновляем график
    if (candleSeries) {
        candleSeries.setData(currentData);
    }
    
    // Рассчитываем индикаторы
    calculatePineIndicator();
    
    // Рисуем линии
    drawIndicatorLines();
    
    // Обновляем UI
    updateUI();
    
    // Автоматически подгоняем график
    autoZoomToLatest();
    
    hideLoading();
}

function generateTestData(symbol) {
    const data = [];
    const basePrice = getTestPrice(symbol);
    let price = basePrice;
    let trend = Math.random() > 0.5;
    
    for (let i = 0; i < 100; i++) {
        const time = Date.now() - (99 - i) * 60000;
        
        const trendStrength = trend ? 0.003 : -0.003;
        const noise = (Math.random() - 0.5) * 0.01;
        
        const open = price;
        const change = trendStrength + noise;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.005);
        const low = Math.min(open, close) * (1 - Math.random() * 0.005);
        
        // Периодически меняем тренд
        if (i % 30 === 0) trend = !trend;
        
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
        'DOGEUSDT': 0.14926,
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
    indicator.signal_up = false;
    indicator.signal_down = false;
    
    // Пересчитываем индикаторы
    calculatePineIndicator();
    
    // Перерисовываем линии
    drawIndicatorLines();
    
    // Обновляем UI
    updateUI();
    
    console.log('Stop loss reset');
}

function shareSignal() {
    const signal = `
TREND_1H FUTURES SIGNAL
════════════════════════
Symbol: ${document.getElementById('symbol').value}
Timeframe: ${document.getElementById('timeframe').value}
Trend: ${indicator.trend.toUpperCase()} ${indicator.stopLossHit ? '(STOP HIT)' : ''}
Price: ${document.getElementById('priceValue').textContent}
Entry: ${document.getElementById('entryValue').textContent}
Stop Loss: ${indicator.stopLoss.toFixed(4)}
TP1: ${indicator.tp1.toFixed(4)}
TP2: ${indicator.tp2.toFixed(4)}
TP3: ${indicator.tp3.toFixed(4)}
TP4: ${indicator.tp4.toFixed(4)}
════════════════════════
Time: ${new Date().toLocaleString()}
    `;
    
    tg.sendData(JSON.stringify({ signal }));
    tg.showAlert('Signal shared!');
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
                drawIndicatorLines();
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
    
    // Загружаем данные
    setTimeout(loadData, 100);
    
    // Автообновление
    setInterval(() => {
        if (!document.hidden && !isLoading) {
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
