// ============================================
// INITIALIZATION
// ============================================

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Audio elements
const clickSound = document.getElementById('clickSound');
const notificationSound = document.getElementById('notificationSound');

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
    signal_down: false,
    lastSymbol: '',
    lastTimeframe: '',
    sma_high: 0,
    sma_low: 0,
    hasInitialSignal: false,
    lastSettings: {
        trendLength: 10,
        targetMultiplier: 0,
        atrPeriod: 20
    }
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
// UTILITY FUNCTIONS
// ============================================

// Звук клика
function playClickSound() {
    try {
        clickSound.currentTime = 0;
        clickSound.play();
    } catch (e) {
        console.log('Sound error:', e);
    }
}

// Звук уведомления
function playNotificationSound() {
    try {
        notificationSound.currentTime = 0;
        notificationSound.play();
    } catch (e) {
        console.log('Notification sound error:', e);
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    // Удаляем старые уведомления
    const oldNotifications = container.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // Разные цвета для разных типов
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #00cc66 0%, #00ff88 100%)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ff3366 0%, #ff6699 100%)';
    } else if (type === 'warning') {
        notification.style.background = 'linear-gradient(135deg, #ff9900 0%, #ffcc00 100%)';
    }
    
    notification.textContent = message;
    container.appendChild(notification);
    
    // Проигрываем звук
    playNotificationSound();
    
    // Автоматическое скрытие через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

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
            fontFamily: 'Orbitron, monospace'
        },
        grid: { 
            vertLines: { color: '#111111', visible: true }, 
            horzLines: { color: '#111111', visible: true } 
        },
        crosshair: { 
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                width: 1,
                color: '#222222',
                style: 2
            },
            horzLine: {
                width: 1,
                color: '#222222',
                style: 2
            }
        },
        rightPriceScale: {
            borderColor: '#222222',
            scaleMargins: {
                top: 0.05,
                bottom: 0.05
            },
            minimumWidth: 80,
            autoScale: true
        },
        timeScale: {
            borderColor: '#222222',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5,
            barSpacing: 8,
            minBarSpacing: 4,
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
    
    // Свечной график с зелеными/красными свечами
    candleSeries = chart.addCandlestickSeries({
        upColor: '#00ff88',
        downColor: '#ff3366',
        borderUpColor: '#00ff88',
        borderDownColor: '#ff3366',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff3366',
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: {
            type: 'price',
            precision: 4,
            minMove: 0.0001
        }
    });
    
    // Сбрасываем линии индикатора
    resetPriceLines();
    
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
// PINE SCRIPT LOGIC
// ============================================

function calculatePineIndicator(forceRecalculate = false) {
    if (currentData.length < 30) {
        console.log('Not enough data for indicator calculation');
        return;
    }
    
    const length = parseInt(document.getElementById('trendLength').value) || 10;
    const target = parseInt(document.getElementById('targetMultiplier').value) || 0;
    const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
    
    // Проверяем, изменились ли настройки
    const settingsChanged = 
        length !== indicator.lastSettings.trendLength ||
        target !== indicator.lastSettings.targetMultiplier ||
        atrPeriod !== indicator.lastSettings.atrPeriod;
    
    // Calculate ATR
    let atrSum = 0;
    
    for (let i = 1; i < Math.min(currentData.length, atrPeriod + 1); i++) {
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
    
    // Calculate SMA
    let smaHighSum = 0;
    let smaLowSum = 0;
    
    const startIdx = Math.max(0, currentData.length - length);
    for (let i = startIdx; i < currentData.length; i++) {
        smaHighSum += currentData[i].high;
        smaLowSum += currentData[i].low;
    }
    
    const smaCount = currentData.length - startIdx;
    const sma_high = (smaHighSum / smaCount) + atr_value;
    const sma_low = (smaLowSum / smaCount) - atr_value;
    
    const close = currentData[currentData.length - 1].close;
    
    // Проверяем смену символа или таймфрейма
    const currentSymbol = document.getElementById('symbol').value;
    const currentTimeframe = document.getElementById('timeframe').value;
    const symbolChanged = indicator.lastSymbol !== currentSymbol;
    const timeframeChanged = indicator.lastTimeframe !== currentTimeframe;
    
    if (symbolChanged || timeframeChanged || forceRecalculate) {
        console.log('Symbol/timeframe changed or force recalculate, resetting indicator');
        indicator = {
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
            signal_down: false,
            lastSymbol: currentSymbol,
            lastTimeframe: currentTimeframe,
            sma_high: 0,
            sma_low: 0,
            hasInitialSignal: false,
            lastSettings: {
                trendLength: length,
                targetMultiplier: target,
                atrPeriod: atrPeriod
            }
        };
        
        resetPriceLines();
    }
    
    // Сохраняем текущие SMA
    indicator.sma_high = sma_high;
    indicator.sma_low = sma_low;
    
    let trend = indicator.isBullish;
    let signal_up = false;
    let signal_down = false;
    let trendChanged = false;
    
    // Определяем тренд
    if (close > sma_high) {
        if (!indicator.hasInitialSignal || !trend || settingsChanged) {
            trend = true;
            signal_up = true;
            trendChanged = true;
        }
    } else if (close < sma_low) {
        if (!indicator.hasInitialSignal || trend || settingsChanged) {
            trend = false;
            signal_down = true;
            trendChanged = true;
        }
    }
    
    // Пересчитываем цели
    if (trendChanged || indicator.entryPrice === 0 || settingsChanged) {
        const base = trend ? sma_low : sma_high;
        const atr_multiplier = atr_value * (trend ? 1 : -1);
        
        indicator.entryPrice = close;
        indicator.stopLoss = base;
        indicator.tp1 = close + atr_multiplier * (5 + target);
        indicator.tp2 = close + atr_multiplier * (10 + target * 2);
        indicator.tp3 = close + atr_multiplier * (15 + target * 4);
        indicator.tp4 = close + atr_multiplier * (20 + target * 6);
        indicator.hasInitialSignal = true;
    }
    
    // Проверка стоп лосса
    if (!indicator.stopLossHit && indicator.stopLoss !== 0) {
        if ((trend && close <= indicator.stopLoss) || 
            (!trend && close >= indicator.stopLoss)) {
            indicator.stopLossHit = true;
            showNotification('STOP LOSS HIT!', 'warning');
        }
    }
    
    // Обновляем индикатор
    indicator.trend = trend ? 'up' : 'down';
    indicator.atr = atr_value;
    indicator.price = close;
    indicator.isBullish = trend;
    indicator.signal_up = signal_up;
    indicator.signal_down = signal_down;
    
    // Сохраняем последние настройки
    indicator.lastSymbol = currentSymbol;
    indicator.lastTimeframe = currentTimeframe;
    indicator.lastSettings = {
        trendLength: length,
        targetMultiplier: target,
        atrPeriod: atrPeriod
    };
}

// ============================================
// DRAW INDICATOR LINES (ТОНКИЕ ЛИНИИ)
// ============================================

function drawIndicatorLines() {
    if (!chart || !candleSeries) {
        console.log('Chart or candle series not available');
        return;
    }
    
    resetPriceLines();
    
    if (indicator.entryPrice === 0 || isNaN(indicator.entryPrice)) {
        return;
    }
    
    const color = indicator.stopLossHit ? '#ff3366' : null;
    
    try {
        // Очень тонкие линии
        priceLines.stopLoss = candleSeries.createPriceLine({
            price: indicator.stopLoss,
            color: color || '#ff3366',
            lineWidth: 1, // Более тонкая линия
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'SL'
        });
        
        priceLines.entry = candleSeries.createPriceLine({
            price: indicator.entryPrice,
            color: color || '#00ccff',
            lineWidth: 1, // Более тонкая линия
            lineStyle: 0,
            axisLabelVisible: true,
            title: 'ENTRY'
        });
        
        priceLines.tp1 = candleSeries.createPriceLine({
            price: indicator.tp1,
            color: color || '#00ff88',
            lineWidth: 1, // Более тонкая линия
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'TP1'
        });
        
        priceLines.tp2 = candleSeries.createPriceLine({
            price: indicator.tp2,
            color: color || '#00ff88',
            lineWidth: 1, // Более тонкая линия
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'TP2'
        });
        
        priceLines.tp3 = candleSeries.createPriceLine({
            price: indicator.tp3,
            color: color || '#00ff88',
            lineWidth: 1, // Более тонкая линия
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'TP3'
        });
        
        priceLines.tp4 = candleSeries.createPriceLine({
            price: indicator.tp4,
            color: color || '#00ff88',
            lineWidth: 1, // Более тонкая линия
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'TP4'
        });
        
    } catch (error) {
        console.error('Error drawing lines:', error);
    }
}

function resetPriceLines() {
    if (!candleSeries) return;
    
    Object.values(priceLines).forEach(line => {
        if (line) {
            try {
                candleSeries.removePriceLine(line);
            } catch (e) {
                console.log('Error removing price line:', e);
            }
        }
    });
    
    priceLines = {
        stopLoss: null,
        entry: null,
        tp1: null,
        tp2: null,
        tp3: null,
        tp4: null
    };
}

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
    if (isLoading) {
        console.log('Already loading, skipping');
        return;
    }
    
    try {
        isLoading = true;
        showLoading();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`Loading ${symbol} ${timeframe}...`);
        
        const data = await getChartData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received from API');
        }
        
        currentData = formatData(data);
        
        if (currentData.length < 30) {
            throw new Error(`Not enough data: ${currentData.length} bars`);
        }
        
        if (!chart) {
            initChart();
        }
        
        candleSeries.setData(currentData);
        
        calculatePineIndicator();
        
        drawIndicatorLines();
        
        updateUI();
        
        autoZoomToLatest();
        
        showNotification(`Chart updated: ${symbol} ${timeframe}`, 'success');
        
        console.log('Data loaded successfully');
        
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification(`Error loading data: ${error.message}`, 'error');
        loadTestData();
    } finally {
        isLoading = false;
        hideLoading();
    }
}

async function getChartData(symbol, interval) {
    try {
        let limit = 100;
        if (interval === '1m' || interval === '5m') limit = 150;
        
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || data.length === 0) {
            throw new Error('Empty response from API');
        }
        
        console.log(`Received ${data.length} bars`);
        return data;
        
    } catch (error) {
        console.error('API error:', error);
        return null;
    }
}

function formatData(rawData) {
    return rawData.map(item => {
        const time = item[0] / 1000;
        const open = parseFloat(item[1]);
        const high = parseFloat(item[2]);
        const low = parseFloat(item[3]);
        const close = parseFloat(item[4]);
        const volume = parseFloat(item[5]);
        
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
            console.warn('Invalid data point:', item);
            return null;
        }
        
        return {
            time,
            open,
            high,
            low,
            close,
            volume
        };
    }).filter(item => item !== null);
}

function autoZoomToLatest() {
    if (!chart || currentData.length < 10) return;
    
    try {
        const visibleBars = 50;
        const lastBarIndex = currentData.length - 1;
        const firstVisibleIndex = Math.max(0, lastBarIndex - visibleBars);
        
        const firstTime = currentData[firstVisibleIndex].time;
        const lastTime = currentData[lastBarIndex].time;
        
        chart.timeScale().setVisibleRange({
            from: firstTime,
            to: lastTime
        });
        
    } catch (error) {
        console.warn('Auto zoom error:', error);
        setTimeout(() => {
            chart.timeScale().fitContent();
        }, 100);
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    const formatPrice = (price) => {
        if (!price || isNaN(price)) return '0.0000';
        
        if (price >= 1000) return price.toFixed(2);
        if (price >= 100) return price.toFixed(2);
        if (price >= 10) return price.toFixed(3);
        if (price >= 1) return price.toFixed(4);
        if (price >= 0.1) return price.toFixed(5);
        if (price >= 0.01) return price.toFixed(6);
        if (price >= 0.001) return price.toFixed(6);
        return price.toFixed(8);
    };
    
    const trendElement = document.getElementById('trendValue');
    if (indicator.stopLossHit) {
        trendElement.textContent = 'STOP HIT';
        trendElement.style.color = '#ff3366';
    } else {
        trendElement.textContent = indicator.trend.toUpperCase();
        trendElement.style.color = indicator.trend === 'up' ? '#00ff88' : '#ff3366';
    }
    
    document.getElementById('priceValue').textContent = formatPrice(indicator.price);
    document.getElementById('atrValue').textContent = formatPrice(indicator.atr);
    document.getElementById('entryValue').textContent = formatPrice(indicator.entryPrice);
    
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
        if (!target.value || isNaN(target.value)) return;
        
        const div = document.createElement('div');
        div.className = `target ${target.type}`;
        
        let borderColor = '#333';
        let textColor = '#fff';
        
        if (!indicator.stopLossHit) {
            if (target.type === 'stop') {
                borderColor = '#ff3366';
                textColor = '#ff3366';
            } else if (target.type === 'entry') {
                borderColor = '#00ccff';
                textColor = '#00ccff';
            } else if (target.type === 'profit') {
                borderColor = '#00ff88';
                textColor = '#00ff88';
            }
        } else {
            borderColor = '#ff3366';
            textColor = '#ff3366';
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
// UPDATE INDICATOR SETTINGS
// ============================================

function updateIndicatorSettings() {
    console.log('Updating indicator settings...');
    
    playClickSound();
    
    if (currentData.length < 20) {
        showNotification('Not enough data to update settings', 'error');
        return;
    }
    
    const length = parseInt(document.getElementById('trendLength').value) || 10;
    const target = parseInt(document.getElementById('targetMultiplier').value) || 0;
    const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
    
    calculatePineIndicator(true);
    
    drawIndicatorLines();
    
    updateUI();
    
    showNotification(`Settings applied!\nTrend: ${length}, Target: ${target}, ATR: ${atrPeriod}`, 'success');
}

// ============================================
// TEST DATA (FALLBACK)
// ============================================

function loadTestData() {
    console.log('Loading test data...');
    
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    
    if (!chart) {
        initChart();
    }
    
    const data = generateTestData(symbol, timeframe);
    currentData = formatData(data);
    
    candleSeries.setData(currentData);
    
    indicator = {
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
        signal_down: false,
        lastSymbol: symbol,
        lastTimeframe: timeframe,
        sma_high: 0,
        sma_low: 0,
        hasInitialSignal: false,
        lastSettings: {
            trendLength: 10,
            targetMultiplier: 0,
            atrPeriod: 20
        }
    };
    
    calculatePineIndicator();
    drawIndicatorLines();
    updateUI();
    autoZoomToLatest();
    
    showNotification('Using test data', 'warning');
}

function generateTestData(symbol, timeframe) {
    const data = [];
    let basePrice = getTestPrice(symbol);
    let price = basePrice;
    let trend = Math.random() > 0.5;
    
    let bars = 100;
    if (timeframe === '1m' || timeframe === '5m') bars = 150;
    
    for (let i = 0; i < bars; i++) {
        const timeOffset = (bars - 1 - i) * getIntervalMs(timeframe);
        const time = Date.now() - timeOffset;
        
        const volatility = basePrice * 0.01;
        const randomMove = (Math.random() - 0.5) * 2 * volatility;
        
        const open = price;
        const close = open + randomMove;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;
        
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

function getIntervalMs(timeframe) {
    const intervals = {
        '1m': 60000,
        '5m': 300000,
        '15m': 900000,
        '30m': 1800000,
        '1h': 3600000,
        '4h': 14400000
    };
    return intervals[timeframe] || 60000;
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
    playClickSound();
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function resetAll() {
    playClickSound();
    console.log('Resetting indicator...');
    
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    
    indicator = {
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
        signal_down: false,
        lastSymbol: symbol,
        lastTimeframe: timeframe,
        sma_high: 0,
        sma_low: 0,
        hasInitialSignal: false,
        lastSettings: {
            trendLength: 10,
            targetMultiplier: 0,
            atrPeriod: 20
        }
    };
    
    resetPriceLines();
    
    if (currentData.length > 0) {
        calculatePineIndicator(true);
        drawIndicatorLines();
        updateUI();
    }
    
    showNotification('Indicator reset!', 'success');
}

// ============================================
// SHARE FUNCTION (ИСПРАВЛЕННАЯ)
// ============================================

function shareSignal() {
    playClickSound();
    
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    
    // Форматируем сигнал
    const signal = `
🚀 TREND_1H FUTURES SIGNAL
═══════════════════════════
📊 SYMBOL: ${symbol}
⏰ TIMEFRAME: ${timeframe}
📈 TREND: ${indicator.trend.toUpperCase()} ${indicator.stopLossHit ? '⛔ STOP HIT' : ''}
💰 CURRENT PRICE: ${document.getElementById('priceValue').textContent}
🎯 ENTRY: ${document.getElementById('entryValue').textContent}
🛑 STOP LOSS: ${indicator.stopLoss.toFixed(4)}
✅ TP1: ${indicator.tp1.toFixed(4)}
✅ TP2: ${indicator.tp2.toFixed(4)}
✅ TP3: ${indicator.tp3.toFixed(4)}
✅ TP4: ${indicator.tp4.toFixed(4)}
═══════════════════════════
📅 ${new Date().toLocaleString('ru-RU')}
    `;
    
    // Пробуем отправить в Telegram WebApp
    if (tg && tg.sendData) {
        try {
            tg.sendData(JSON.stringify({ 
                type: 'signal',
                symbol: symbol,
                timeframe: timeframe,
                trend: indicator.trend,
                price: indicator.price,
                entry: indicator.entryPrice,
                stopLoss: indicator.stopLoss,
                tp1: indicator.tp1,
                tp2: indicator.tp2,
                tp3: indicator.tp3,
                tp4: indicator.tp4,
                timestamp: new Date().toISOString()
            }));
            
            tg.showAlert('✅ Signal shared to Telegram!');
            showNotification('Signal shared to Telegram!', 'success');
            
        } catch (error) {
            console.error('Telegram sharing error:', error);
            fallbackShare(signal);
        }
    } else {
        fallbackShare(signal);
    }
}

function fallbackShare(signal) {
    // Fallback: копирование в буфер обмена
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(signal).then(() => {
            showNotification('✅ Signal copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Clipboard error:', err);
            showNotification('📋 Signal (check console for details)', 'info');
            console.log('Signal to share:', signal);
        });
    } else {
        // Старый метод
        const textArea = document.createElement('textarea');
        textArea.value = signal;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('✅ Signal copied to clipboard!', 'success');
        } catch (err) {
            console.error('Old clipboard error:', err);
            showNotification('📋 Signal (check console)', 'info');
            console.log('Signal to share:', signal);
        }
        document.body.removeChild(textArea);
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventListeners() {
    // Кнопка обновления
    document.getElementById('updateBtn').addEventListener('click', function() {
        playClickSound();
        loadData();
    });
    
    // Кнопка применения настроек
    document.getElementById('applyBtn').addEventListener('click', function() {
        updateIndicatorSettings();
    });
    
    // Смена символа
    document.getElementById('symbol').addEventListener('change', function() {
        playClickSound();
        loadData();
    });
    
    // Смена таймфрейма
    document.getElementById('timeframe').addEventListener('change', function() {
        playClickSound();
        loadData();
    });
    
    // Изменение настроек индикатора
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        const element = document.getElementById(id);
        
        element.addEventListener('change', function() {
            playClickSound();
        });
        
        element.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                playClickSound();
                updateIndicatorSettings();
            }
        });
    });
    
    // Кнопка сброса
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    
    // Кнопка шаринга
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    
    // Кнопка полноэкранного режима
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
}

// ============================================
// MAIN INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('App starting...');
    
    try {
        initSymbols();
        setupEventListeners();
        initChart();
        
        setTimeout(() => {
            loadData();
        }, 500);
        
        setInterval(() => {
            if (!document.hidden && !isLoading) {
                loadData();
            }
        }, 30000);
        
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => loadData(), 1000);
            }
        });
        
        console.log('App started successfully');
        
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        showNotification(`Initialization error: ${error.message}`, 'error');
    }
});
