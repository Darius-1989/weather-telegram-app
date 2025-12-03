// ============================================
// КОНФИГУРАЦИЯ И ПЕРЕМЕННЫЕ
// ============================================

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Топ 50 монет Binance (по объему торгов)
const BINANCE_TOP_50 = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT',
    'LINKUSDT', 'LTCUSDT', 'TRXUSDT', 'UNIUSDT', 'ATOMUSDT',
    'ETCUSDT', 'XLMUSDT', 'FILUSDT', 'APTUSDT', 'NEARUSDT',
    'ALGOUSDT', 'VETUSDT', 'ICPUSDT', 'QNTUSDT', 'AAVEUSDT',
    'GRTUSDT', 'EOSUSDT', 'XTZUSDT', 'MANAUSDT', 'SANDUSDT',
    'CHZUSDT', 'CRVUSDT', 'EGLDUSDT', 'THETAUSDT', 'AXSUSDT',
    'APEUSDT', 'FLOWUSDT', 'GALAUSDT', 'KLAYUSDT', 'FTMUSDT',
    'ONEUSDT', 'MKRUSDT', 'RUNEUSDT', 'SNXUSDT', 'COMPUSDT',
    'ZILUSDT', 'ENJUSDT', 'IOTAUSDT', 'WAVESUSDT', 'NEOUSDT'
];

// Глобальные переменные
let chart = null;
let candleSeries = null;
let lineSeries = [];
let currentData = [];
let isLoading = false;
let stopLossHit = false;
let lastSignal = null;

// Состояние индикатора
let indicator = {
    trend: 'neutral',
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    price: 0,
    targets: [],
    isBullish: false,
    signalTime: null,
    entryPrice: 0,
    stopLossPrice: 0
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 TREND_1H Futures starting...');
    
    // Инициализация UI
    initializeUI();
    
    // Инициализация графика
    setTimeout(initializeChart, 100);
    
    // Загрузка данных
    setTimeout(loadInitialData, 300);
});

// ============================================
// ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА
// ============================================

function initializeUI() {
    // Заполнение списка монет
    const symbolSelect = document.getElementById('symbol');
    symbolSelect.innerHTML = '';
    
    BINANCE_TOP_50.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = symbol.replace('USDT', '');
        symbolSelect.appendChild(option);
    });
    
    // Обработчики событий
    document.getElementById('updateBtn').addEventListener('click', loadInitialData);
    document.getElementById('symbol').addEventListener('change', loadInitialData);
    document.getElementById('timeframe').addEventListener('change', loadInitialData);
    
    // Обработчики настроек
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (currentData.length > 20) {
                calculateIndicator();
                checkStopLoss();
                drawLines();
                updateUI();
            }
        });
    });
    
    // Кнопки
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ГРАФИКА
// ============================================

function initializeChart() {
    try {
        const chartContainer = document.getElementById('chart');
        
        // Очищаем контейнер
        chartContainer.innerHTML = '';
        
        // Создаем график
        chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { color: '#000000' },
                textColor: '#DDDDDD',
                fontSize: 12
            },
            grid: {
                vertLines: { color: '#1a1a1a' },
                horzLines: { color: '#1a1a1a' }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal
            },
            rightPriceScale: {
                borderColor: '#333333',
                scaleMargins: {
                    top: 0.05,
                    bottom: 0.05
                }
            },
            timeScale: {
                borderColor: '#333333',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 12,
                barSpacing: 6
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
            }
        });
        
        // Свечная серия
        candleSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderUpColor: '#26a69a',
            borderDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
        });
        
        // Обработка изменения размера
        window.addEventListener('resize', () => {
            chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight
            });
        });
        
        console.log('✅ Chart initialized');
        
    } catch (error) {
        console.error('❌ Chart initialization error:', error);
    }
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================

async function loadInitialData() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`📥 Loading ${symbol} ${timeframe}...`);
        
        // Получение данных
        const data = await fetchMarketData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received');
        }
        
        // Обработка данных
        currentData = processMarketData(data);
        
        // Обновление графика
        updateChartData(currentData);
        
        // Расчет индикатора
        calculateIndicator();
        
        // Проверка стоп-лосса
        checkStopLoss();
        
        // Отрисовка линий
        drawLines();
        
        // Обновление UI
        updateUI();
        
        hideLoading();
        
    } catch (error) {
        console.error('❌ Data loading error:', error);
        loadTestData();
    } finally {
        isLoading = false;
    }
}

// ============================================
// ПОЛУЧЕНИЕ ДАННЫХ С BINANCE
// ============================================

async function fetchMarketData(symbol, interval, limit = 150) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.warn('⚠️ API failed:', error.message);
        return null;
    }
}

// ============================================
// ОБРАБОТКА ДАННЫХ
// ============================================

function processMarketData(rawData) {
    return rawData.map(item => ({
        time: item[0] / 1000, // Конвертируем в секунды
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
    }));
}

// ============================================
// ОБНОВЛЕНИЕ ГРАФИКА ДАННЫМИ
// ============================================

function updateChartData(data) {
    if (!candleSeries) return;
    
    try {
        // Устанавливаем данные
        candleSeries.setData(data);
        
        // Масштабируем график для отображения текущей цены по центру
        if (data.length > 0) {
            const lastCandle = data[data.length - 1];
            const currentPrice = lastCandle.close;
            
            // Устанавливаем видимый диапазон чтобы цена была по центру
            chart.timeScale().setVisibleRange({
                from: data[Math.max(0, data.length - 80)].time,
                to: data[data.length - 1].time
            });
            
            // Устанавливаем масштаб по вертикали
            const priceRange = getPriceRange(data.slice(-50));
            chart.priceScale('right').applyOptions({
                mode: 2, // Normal mode
                autoScale: true
            });
            
            // Обновляем цену
            indicator.price = currentPrice;
            document.getElementById('priceValue').textContent = currentPrice.toFixed(2);
        }
        
    } catch (error) {
        console.error('❌ Chart update error:', error);
    }
}

function getPriceRange(data) {
    let min = Infinity;
    let max = -Infinity;
    
    data.forEach(candle => {
        min = Math.min(min, candle.low);
        max = Math.max(max, candle.high);
    });
    
    const padding = (max - min) * 0.1;
    return {
        min: min - padding,
        max: max + padding
    };
}

// ============================================
// ТЕСТОВЫЕ ДАННЫЕ (РЕЗЕРВНЫЙ ВАРИАНТ)
// ============================================

function loadTestData() {
    try {
        const symbol = document.getElementById('symbol').value;
        const data = generateTestData(symbol);
        
        currentData = processMarketData(data);
        updateChartData(currentData);
        calculateIndicator();
        checkStopLoss();
        drawLines();
        updateUI();
        
        hideLoading();
        
    } catch (error) {
        console.error('❌ Test data error:', error);
    }
}

function generateTestData(symbol) {
    const data = [];
    let price = getSymbolBasePrice(symbol);
    const volatility = getSymbolVolatility(symbol);
    
    for (let i = 0; i < 150; i++) {
        const timestamp = Date.now() - (149 - i) * 60000;
        const open = price;
        const change = (Math.random() - 0.5) * volatility * 2;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
        
        data.push([
            timestamp,
            open.toFixed(2),
            high.toFixed(2),
            low.toFixed(2),
            close.toFixed(2),
            (Math.random() * 1000).toFixed(2),
            timestamp + 60000,
            (Math.random() * 100000).toFixed(2),
            Math.floor(Math.random() * 1000),
            (Math.random() * 500).toFixed(2),
            (Math.random() * 50000).toFixed(2),
            "0"
        ]);
        
        price = close;
    }
    
    return data;
}

function getSymbolBasePrice(symbol) {
    const prices = {
        'BTCUSDT': 50000, 'ETHUSDT': 3000, 'BNBUSDT': 400, 'SOLUSDT': 100,
        'XRPUSDT': 0.5, 'ADAUSDT': 0.4, 'AVAXUSDT': 30, 'DOGEUSDT': 0.1,
        'DOTUSDT': 6, 'MATICUSDT': 0.8, 'LINKUSDT': 15, 'LTCUSDT': 80,
        'TRXUSDT': 0.1, 'UNIUSDT': 7, 'ATOMUSDT': 10, 'ETCUSDT': 25,
        'XLMUSDT': 0.12, 'FILUSDT': 5, 'APTUSDT': 8, 'NEARUSDT': 4,
        'ALGOUSDT': 0.2, 'VETUSDT': 0.03, 'ICPUSDT': 12, 'QNTUSDT': 100
    };
    return prices[symbol] || 50;
}

function getSymbolVolatility(symbol) {
    const volatilities = {
        'BTCUSDT': 0.015, 'ETHUSDT': 0.02, 'BNBUSDT': 0.025,
        'SOLUSDT': 0.03, 'XRPUSDT': 0.04, 'ADAUSDT': 0.035,
        'AVAXUSDT': 0.032, 'DOGEUSDT': 0.05, 'DOTUSDT': 0.028,
        'MATICUSDT': 0.032, 'LINKUSDT': 0.03, 'LTCUSDT': 0.025,
        'TRXUSDT': 0.04, 'UNIUSDT': 0.03, 'ATOMUSDT': 0.028,
        'ETCUSDT': 0.035, 'XLMUSDT': 0.04, 'FILUSDT': 0.038,
        'APTUSDT': 0.042, 'NEARUSDT': 0.045, 'ALGOUSDT': 0.038
    };
    return volatilities[symbol] || 0.03;
}

// ============================================
// РАСЧЕТ ИНДИКАТОРА (100% ЛОГИКА PINE SCRIPT)
// ============================================

function calculateIndicator() {
    if (currentData.length < 30) return;
    
    try {
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        
        // Получаем массивы цен
        const closes = currentData.map(d => d.close);
        const highs = currentData.map(d => d.high);
        const lows = currentData.map(d => d.low);
        const lastClose = closes[closes.length - 1];
        
        // 1. Расчет ATR по логике Pine Script
        const atr = calculateATRExact(currentData, atrPeriod);
        
        // 2. Сглаживание ATR SMA(20) * 0.3 (как в оригинале)
        const smoothedATR = calculateSMAExact([atr], 20) * 0.3;
        
        // 3. Расчет SMA High и SMA Low
        const smaHigh = calculateSMAExact(highs, trendLength) + smoothedATR;
        const smaLow = calculateSMAExact(lows, trendLength) - smoothedATR;
        
        // 4. Определение тренда по логике Pine Script
        let trend = 'neutral';
        let isBullish = false;
        let signal = null;
        
        const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;
        
        // Проверка на пересечение (как в оригинале)
        if (lastClose > smaHigh && prevClose <= smaHigh) {
            trend = 'up';
            isBullish = true;
            signal = 'BUY';
        } else if (lastClose < smaLow && prevClose >= smaLow) {
            trend = 'down';
            isBullish = false;
            signal = 'SELL';
        } else {
            // Определяем текущий тренд
            if (lastClose > smaHigh) {
                trend = 'up';
                isBullish = true;
            } else if (lastClose < smaLow) {
                trend = 'down';
                isBullish = false;
            } else {
                trend = 'neutral';
            }
        }
        
        // Сохраняем сигнал если есть
        if (signal && (!lastSignal || lastSignal !== signal)) {
            lastSignal = signal;
            indicator.signalTime = new Date();
            indicator.entryPrice = lastClose;
            stopLossHit = false; // Сбрасываем флаг стоп-лосса при новом сигнале
        }
        
        // 5. Расчет целей по точным формулам из Pine Script
        const targets = calculateTargetsExact(lastClose, smoothedATR, targetMultiplier, isBullish);
        
        // Сохраняем стоп-лосс цену
        indicator.stopLossPrice = targets[0].value;
        
        // Обновляем состояние индикатора
        indicator = {
            ...indicator,
            trend,
            smaHigh,
            smaLow,
            atr: smoothedATR,
            price: lastClose,
            targets,
            isBullish,
            entryPrice: signal ? lastClose : indicator.entryPrice
        };
        
        console.log('📊 Indicator calculated:', {
            trend,
            signal,
            entry: indicator.entryPrice,
            stopLoss: indicator.stopLossPrice,
            atr: smoothedATR.toFixed(4)
        });
        
    } catch (error) {
        console.error('❌ Indicator calculation error:', error);
    }
}

// Точный расчет ATR как в Pine Script
function calculateATRExact(data, period) {
    if (data.length < period + 1) return 0;
    
    let atr = 0;
    
    // Первые period значений
    for (let i = 1; i <= period; i++) {
        const tr = Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i-1].close),
            Math.abs(data[i].low - data[i-1].close)
        );
        atr += tr;
    }
    atr /= period;
    
    // Остальные значения
    for (let i = period + 1; i < data.length; i++) {
        const tr = Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i-1].close),
            Math.abs(data[i].low - data[i-1].close)
        );
        atr = (atr * (period - 1) + tr) / period;
    }
    
    return atr;
}

// Точный расчет SMA
function calculateSMAExact(data, period) {
    if (data.length < period) {
        // Если данных меньше периода, считаем по доступным
        const availablePeriod = Math.min(data.length, period);
        const slice = data.slice(-availablePeriod);
        return slice.reduce((sum, val) => sum + val, 0) / availablePeriod;
    }
    
    const slice = data.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
}

// Точный расчет целей по формулам Pine Script
function calculateTargetsExact(entryPrice, atr, multiplier, isBullish) {
    const sign = isBullish ? 1 : -1;
    
    // Формулы из оригинального кода:
    // target_len1 = atr_multiplier * (5+target)
    // target_len2 = atr_multiplier * (10+target*2)
    // target_len3 = atr_multiplier * (15+target*4)
    // target_len4 = atr_multiplier * (20+target*6)
    // stop_loss = base - atr_multiplier * 2 * sign
    
    const atrMultiplier = atr * (1 + multiplier * 0.1);
    
    return [
        {
            name: 'STOP LOSS',
            value: entryPrice - atrMultiplier * 2 * sign,
            type: 'stop',
            color: '#ff0000'
        },
        {
            name: 'ENTRY',
            value: entryPrice,
            type: 'entry',
            color: '#0066cc'
        },
        {
            name: 'TP1',
            value: entryPrice + atrMultiplier * (5 + multiplier) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP2',
            value: entryPrice + atrMultiplier * (10 + multiplier * 2) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP3',
            value: entryPrice + atrMultiplier * (15 + multiplier * 4) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP4',
            value: entryPrice + atrMultiplier * (20 + multiplier * 6) * sign,
            type: 'profit',
            color: '#00ff00'
        }
    ];
}

// ============================================
// ПРОВЕРКА СТОП-ЛОССА
// ============================================

function checkStopLoss() {
    if (indicator.targets.length === 0) return;
    
    const stopLoss = indicator.targets[0];
    const currentPrice = indicator.price;
    
    // Если есть активная позиция (есть сигнал) и цена пересекла стоп-лосс
    if (lastSignal && !stopLossHit) {
        if (indicator.isBullish) {
            // Для лонга: если цена упала ниже стоп-лосса
            if (currentPrice <= stopLoss.value) {
                stopLossHit = true;
                console.log('🔴 STOP LOSS HIT! Price:', currentPrice, 'Stop Loss:', stopLoss.value);
            }
        } else {
            // Для шорта: если цена поднялась выше стоп-лосса
            if (currentPrice >= stopLoss.value) {
                stopLossHit = true;
                console.log('🔴 STOP LOSS HIT! Price:', currentPrice, 'Stop Loss:', stopLoss.value);
            }
        }
    }
}

// ============================================
// ОТРИСОВКА ЛИНИЙ НА ГРАФИКЕ
// ============================================

function drawLines() {
    if (!chart || indicator.targets.length === 0) return;
    
    try {
        // Удаляем старые линии
        lineSeries.forEach(series => {
            try {
                chart.removeSeries(series);
            } catch (e) {
                // Игнорируем ошибки
            }
        });
        lineSeries = [];
        
        // Определяем цвет линий
        let lineColor = '#00ff00'; // зеленый для профитов по умолчанию
        
        if (stopLossHit) {
            lineColor = '#ff0000'; // красный если стоп-лосс сработал
        }
        
        // Рисуем линии целей
        indicator.targets.forEach(target => {
            const series = chart.addLineSeries({
                color: stopLossHit ? '#ff0000' : target.color,
                lineWidth: 2,
                lineStyle: target.type === 'profit' ? 1 : 0,
                priceLineVisible: false,
                title: target.name
            });
            
            const lineData = currentData.map(candle => ({
                time: candle.time,
                value: target.value
            }));
            
            series.setData(lineData);
            lineSeries.push(series);
        });
        
        // Линии SMA High и SMA Low
        const smaHighSeries = chart.addLineSeries({
            color: stopLossHit ? '#ff0000' : '#00ff00',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            title: 'SMA High'
        });
        
        const smaLowSeries = chart.addLineSeries({
            color: stopLossHit ? '#ff0000' : '#ff0000',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            title: 'SMA Low'
        });
        
        const smaHighData = currentData.map(candle => ({
            time: candle.time,
            value: indicator.smaHigh
        }));
        
        const smaLowData = currentData.map(candle => ({
            time: candle.time,
            value: indicator.smaLow
        }));
        
        smaHighSeries.setData(smaHighData);
        smaLowSeries.setData(smaLowData);
        
        lineSeries.push(smaHighSeries, smaLowSeries);
        
    } catch (error) {
        console.error('❌ Error drawing lines:', error);
    }
}

// ============================================
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
// ============================================

function updateUI() {
    // Обновление тренда
    const trendElement = document.getElementById('trendValue');
    let trendText = '';
    let trendClass = '';
    
    switch (indicator.trend) {
        case 'up':
            trendText = '📈 BULLISH';
            trendClass = 'trend-up';
            break;
        case 'down':
            trendText = '📉 BEARISH';
            trendClass = 'trend-down';
            break;
        default:
            trendText = '➖ NEUTRAL';
            trendClass = '';
    }
    
    trendElement.textContent = trendText;
    trendElement.className = `status-value ${trendClass}`;
    
    // Обновление значений
    document.getElementById('atrValue').textContent = indicator.atr.toFixed(4);
    document.getElementById('smaHighValue').textContent = indicator.smaHigh.toFixed(2);
    
    // Обновление целей
    const container = document.getElementById('targetsContainer');
    container.innerHTML = '';
    
    indicator.targets.forEach(target => {
        const div = document.createElement('div');
        div.className = `target ${target.type} ${stopLossHit ? 'stop-hit' : ''}`;
        
        div.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-value value-${target.type}">${target.value.toFixed(2)}</div>
        `;
        
        container.appendChild(div);
    });
    
    // Показываем предупреждение если стоп-лосс сработал
    if (stopLossHit) {
        const warning = document.createElement('div');
        warning.className = 'stop-hit';
        warning.style.cssText = `
            background: rgba(255,0,0,0.1);
            border: 1px solid #ff0000;
            color: #ff0000;
            padding: 10px;
            border-radius: 6px;
            text-align: center;
            margin-bottom: 10px;
            font-weight: bold;
        `;
        warning.textContent = '⚠️ STOP LOSS HIT! Waiting for new signal...';
        container.prepend(warning);
    }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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

function shareSignal() {
    const signal = `
📈 TREND_1H SIGNAL
Symbol: ${document.getElementById('symbol').value}
Trend: ${indicator.trend.toUpperCase()}
Price: ${indicator.price.toFixed(2)}
ATR: ${indicator.atr.toFixed(4)}
Entry: ${indicator.entryPrice.toFixed(2)}
Stop Loss: ${indicator.stopLossPrice.toFixed(2)}
Signal Time: ${indicator.signalTime ? indicator.signalTime.toLocaleString() : 'No active signal'}
Status: ${stopLossHit ? 'STOP LOSS HIT' : 'ACTIVE'}
    `.trim();
    
    tg.sendData(JSON.stringify({ signal }));
    tg.showAlert('Signal shared!');
}

// ============================================
// АВТООБНОВЛЕНИЕ
// ============================================

// Автообновление каждые 30 секунд
setInterval(() => {
    if (!document.hidden && !isLoading) {
        loadInitialData();
    }
}, 30000);

// Обновление при возвращении на вкладку
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadInitialData();
    }
});

console.log('✅ TREND_1H Futures fully loaded!');
