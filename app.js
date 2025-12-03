// ============================================
// ИНИЦИАЛИЗАЦИЯ ТЕЛЕГРАМ
// ============================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#000000');
tg.setBackgroundColor('#000000');

// ============================================
// КОНСТАНТЫ И НАСТРОЙКИ
// ============================================
const BINANCE_FUTURES = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT'
];

const TIMEFRAMES = {
    '1m': '1m', '5m': '5m', '15m': '15m',
    '30m': '30m', '1h': '1h', '4h': '4h'
};

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let chart = null;
let candleSeries = null;
let horizontalLines = [];
let currentData = [];
let isChartInitialized = false;
let isLoading = false;

// Состояние индикатора
let indicatorState = {
    trend: 'neutral',
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    currentPrice: 0,
    targets: [],
    isBullish: false,
    isBearish: false
};

// ============================================
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting TREND_1H Futures Indicator...');
    
    // Инициализация интерфейса
    initializeUI();
    
    // Инициализация графика
    initializeChart();
    
    // Загрузка начальных данных
    setTimeout(loadChartData, 100);
});

// ============================================
// ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА
// ============================================
function initializeUI() {
    // Заполнение списка символов
    const symbolSelect = document.getElementById('symbol');
    symbolSelect.innerHTML = '';
    BINANCE_FUTURES.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = symbol.replace('USDT', '');
        symbolSelect.appendChild(option);
    });
    
    // Обработчики событий
    document.getElementById('updateBtn').addEventListener('click', () => {
        console.log('🔄 Manual update requested');
        loadChartData();
    });
    
    document.getElementById('symbol').addEventListener('change', () => {
        console.log('📊 Symbol changed');
        loadChartData();
    });
    
    document.getElementById('timeframe').addEventListener('change', () => {
        console.log('⏰ Timeframe changed');
        loadChartData();
    });
    
    // Настройки индикатора
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (currentData.length > 20 && isChartInitialized) {
                calculateIndicator();
                drawIndicatorLines();
            }
        });
    });
    
    // Кнопки
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ГРАФИКА (ПРАВИЛЬНАЯ ВЕРСИЯ)
// ============================================
function initializeChart() {
    try {
        console.log('📈 Initializing Lightweight Charts...');
        
        const chartContainer = document.getElementById('chart');
        
        // Проверка доступности библиотеки
        if (typeof LightweightCharts === 'undefined') {
            throw new Error('Lightweight Charts library not loaded');
        }
        
        // Создание графика с правильными опциями
        chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { color: '#000000' },
                textColor: '#ffffff',
                fontSize: 12,
                fontFamily: 'Roboto, Arial, sans-serif'
            },
            grid: {
                vertLines: { 
                    color: '#1a1a1a',
                    visible: true
                },
                horzLines: { 
                    color: '#1a1a1a',
                    visible: true
                }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: {
                    color: '#333333',
                    width: 1,
                    style: 2 // Dashed
                },
                horzLine: {
                    color: '#333333',
                    width: 1,
                    style: 2 // Dashed
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
                barSpacing: 6,
                fixLeftEdge: false,
                fixRightEdge: false,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
                borderVisible: true
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true
            },
            handleScale: {
                axisPressedMouseMove: {
                    time: true,
                    price: true
                },
                mouseWheel: true,
                pinch: true
            }
        });
        
        // Создание свечной серии
        candleSeries = chart.addCandlestickSeries({
            upColor: '#00ff00',
            downColor: '#ff0000',
            borderUpColor: '#00ff00',
            borderDownColor: '#ff0000',
            wickUpColor: '#00ff00',
            wickDownColor: '#ff0000',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01
            }
        });
        
        // Обработчик изменения размера
        const resizeObserver = new ResizeObserver(() => {
            if (chart) {
                chart.applyOptions({
                    width: chartContainer.clientWidth,
                    height: chartContainer.clientHeight
                });
            }
        });
        resizeObserver.observe(chartContainer);
        
        // Подписка на события графика
        chart.subscribeCrosshairMove(param => {
            // Можно добавить обработку движения курсора
        });
        
        isChartInitialized = true;
        console.log('✅ Chart initialized successfully!');
        
    } catch (error) {
        console.error('❌ Chart initialization error:', error);
        showError(`Chart error: ${error.message}`);
    }
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================
async function loadChartData() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading();
        hideError();
        
        if (!isChartInitialized) {
            console.log('🔄 Chart not initialized, retrying...');
            initializeChart();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`📥 Fetching data for ${symbol} ${timeframe}...`);
        
        // Получение данных
        const rawData = await fetchMarketData(symbol, timeframe);
        
        if (!rawData || rawData.length === 0) {
            throw new Error('No market data received');
        }
        
        console.log(`📊 Processed ${rawData.length} candles`);
        
        // Обработка данных
        currentData = processMarketData(rawData);
        
        // Обновление графика
        updateChartWithData(currentData);
        
        // Расчет индикатора
        calculateIndicator();
        
        // Отрисовка линий
        drawIndicatorLines();
        
        // Обновление UI
        updateUI();
        
        console.log('✅ Chart data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading chart data:', error);
        showError(`Data loading failed: ${error.message}. Using test data...`);
        loadTestData();
        
    } finally {
        isLoading = false;
        hideLoading();
    }
}

// ============================================
// ПОЛУЧЕНИЕ ДАННЫХ С БИРЖИ
// ============================================
async function fetchMarketData(symbol, interval, limit = 100) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        
        console.log(`🌐 Fetching: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000) // 10 секунд таймаут
        });
        
        if (!response.ok) {
            throw new Error(`API response: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.warn('⚠️ Market API failed:', error.message);
        return null;
    }
}

// ============================================
// ОБРАБОТКА ДАННЫХ
// ============================================
function processMarketData(rawData) {
    return rawData.map(item => ({
        time: Math.floor(item[0] / 1000), // Конвертируем в секунды
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
function updateChartWithData(data) {
    if (!candleSeries || !isChartInitialized) {
        console.error('Chart not ready for update');
        return;
    }
    
    try {
        // Очищаем старые данные
        candleSeries.setData([]);
        
        // Устанавливаем новые данные
        candleSeries.setData(data);
        
        // Автоматическое масштабирование
        chart.timeScale().fitContent();
        
        // Обновляем текущую цену
        if (data.length > 0) {
            const lastCandle = data[data.length - 1];
            const currentPrice = lastCandle.close;
            document.getElementById('priceStatus').textContent = currentPrice.toFixed(2);
            indicatorState.currentPrice = currentPrice;
        }
        
    } catch (error) {
        console.error('❌ Error updating chart:', error);
    }
}

// ============================================
// ТЕСТОВЫЕ ДАННЫЕ
// ============================================
function loadTestData() {
    try {
        const symbol = document.getElementById('symbol').value;
        console.log('🔧 Generating test data...');
        
        const testData = generateTestCandles(symbol);
        currentData = processMarketData(testData);
        
        updateChartWithData(currentData);
        calculateIndicator();
        drawIndicatorLines();
        updateUI();
        
    } catch (error) {
        console.error('❌ Test data error:', error);
    }
}

function generateTestCandles(symbol) {
    const candles = [];
    let price = getSymbolBasePrice(symbol);
    const volatility = 0.02;
    
    for (let i = 0; i < 100; i++) {
        const timestamp = Date.now() - (100 - i) * 60000;
        const open = price;
        const change = (Math.random() - 0.5) * volatility * 2;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
        
        candles.push([
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
    
    return candles;
}

function getSymbolBasePrice(symbol) {
    const prices = {
        'BTCUSDT': 50000,
        'ETHUSDT': 3000,
        'BNBUSDT': 400,
        'SOLUSDT': 100,
        'XRPUSDT': 0.5,
        'ADAUSDT': 0.4,
        'DOGEUSDT': 0.1,
        'DOTUSDT': 6,
        'MATICUSDT': 0.8,
        'AVAXUSDT': 30
    };
    return prices[symbol] || 50;
}

// ============================================
// РАСЧЕТ ИНДИКАТОРА TREND_1H
// ============================================
function calculateIndicator() {
    if (currentData.length < 30) {
        console.warn('⚠️ Not enough data for indicator calculation');
        return;
    }
    
    try {
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        
        // Получаем ценовые массивы
        const closes = currentData.map(d => d.close);
        const highs = currentData.map(d => d.high);
        const lows = currentData.map(d => d.low);
        
        // Расчет ATR (по логике Pine Script)
        const atrValue = calculateATRValue(currentData, atrPeriod) * 0.3;
        
        // Расчет SMA High/Low
        const smaHigh = calculateSMAValue(highs, trendLength) + atrValue;
        const smaLow = calculateSMAValue(lows, trendLength) - atrValue;
        
        // Определение тренда
        const lastClose = closes[closes.length - 1];
        let trend = 'neutral';
        let isBullish = false;
        
        if (lastClose > smaHigh) {
            trend = 'up';
            isBullish = true;
        } else if (lastClose < smaLow) {
            trend = 'down';
            isBullish = false;
        }
        
        // Расчет целей
        const targets = calculateTargetLevels(lastClose, atrValue, targetMultiplier, isBullish);
        
        // Обновление состояния
        indicatorState = {
            trend,
            smaHigh,
            smaLow,
            atr: atrValue,
            currentPrice: lastClose,
            targets,
            isBullish,
            isBearish: trend === 'down'
        };
        
        console.log('📊 Indicator calculated:', {
            trend,
            price: lastClose.toFixed(2),
            smaHigh: smaHigh.toFixed(2),
            smaLow: smaLow.toFixed(2),
            atr: atrValue.toFixed(4)
        });
        
    } catch (error) {
        console.error('❌ Indicator calculation error:', error);
    }
}

function calculateATRValue(data, period) {
    if (data.length < period + 1) return 0;
    
    const trValues = [];
    
    for (let i = 1; i < data.length; i++) {
        const tr = Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i-1].close),
            Math.abs(data[i].low - data[i-1].close)
        );
        trValues.push(tr);
    }
    
    // Сглаженное ATR
    let atr = 0;
    for (let i = 0; i < period; i++) {
        atr += trValues[i];
    }
    atr /= period;
    
    return atr;
}

function calculateSMAValue(data, period) {
    if (data.length < period) return 0;
    
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / period;
}

function calculateTargetLevels(entryPrice, atr, multiplier, isBullish) {
    const sign = isBullish ? 1 : -1;
    
    return [
        {
            name: 'Stop Loss',
            value: entryPrice - atr * 2 * sign,
            type: 'stop',
            color: '#ff0000'
        },
        {
            name: 'Entry',
            value: entryPrice,
            type: 'entry',
            color: '#0088ff'
        },
        {
            name: 'TP1',
            value: entryPrice + atr * (5 + multiplier) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP2',
            value: entryPrice + atr * (10 + multiplier * 2) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP3',
            value: entryPrice + atr * (15 + multiplier * 4) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP4',
            value: entryPrice + atr * (20 + multiplier * 6) * sign,
            type: 'profit',
            color: '#00ff00'
        }
    ];
}

// ============================================
// ОТРИСОВКА ЛИНИЙ ИНДИКАТОРА
// ============================================
function drawIndicatorLines() {
    if (!chart || !isChartInitialized || indicatorState.targets.length === 0) {
        return;
    }
    
    try {
        // Удаляем старые линии
        horizontalLines.forEach(line => {
            try {
                chart.removeSeries(line);
            } catch (e) {
                // Игнорируем ошибки удаления
            }
        });
        horizontalLines = [];
        
        // Рисуем линии целей
        indicatorState.targets.forEach(target => {
            const lineSeries = chart.addLineSeries({
                color: target.color,
                lineWidth: 2,
                lineStyle: target.type === 'profit' ? 1 : 0, // 0 = solid, 1 = dotted
                lastValueVisible: true,
                priceLineVisible: false,
                title: target.name
            });
            
            // Создаем данные для линии
            const lineData = currentData.map(candle => ({
                time: candle.time,
                value: target.value
            }));
            
            lineSeries.setData(lineData);
            horizontalLines.push(lineSeries);
        });
        
        // Линии SMA
        const smaHighSeries = chart.addLineSeries({
            color: '#00ff00',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            lastValueVisible: false,
            priceLineVisible: false,
            title: 'SMA High'
        });
        
        const smaLowSeries = chart.addLineSeries({
            color: '#ff0000',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            lastValueVisible: false,
            priceLineVisible: false,
            title: 'SMA Low'
        });
        
        const smaHighData = currentData.map(candle => ({
            time: candle.time,
            value: indicatorState.smaHigh
        }));
        
        const smaLowData = currentData.map(candle => ({
            time: candle.time,
            value: indicatorState.smaLow
        }));
        
        smaHighSeries.setData(smaHighData);
        smaLowSeries.setData(smaLowData);
        
        horizontalLines.push(smaHighSeries, smaLowSeries);
        
    } catch (error) {
        console.error('❌ Error drawing indicator lines:', error);
    }
}

// ============================================
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
// ============================================
function updateUI() {
    // Обновление тренда
    const trendElement = document.getElementById('trendStatus');
    let trendText = '';
    let trendClass = '';
    
    switch (indicatorState.trend) {
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
    
    // Обновление ATR
    document.getElementById('atrStatus').textContent = indicatorState.atr.toFixed(4);
    
    // Обновление SMA High
    document.getElementById('smaHighStatus').textContent = indicatorState.smaHigh.toFixed(2);
    
    // Обновление целей
    const targetsGrid = document.getElementById('targetsGrid');
    targetsGrid.innerHTML = '';
    
    indicatorState.targets.forEach(target => {
        const targetCard = document.createElement('div');
        targetCard.className = `target-card ${target.type}`;
        
        targetCard.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-price price-${target.type}">
                ${target.value.toFixed(2)}
            </div>
        `;
        
        targetsGrid.appendChild(targetCard);
    });
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

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

function hideError() {
    const errors = document.querySelectorAll('.error-message');
    errors.forEach(error => error.remove());
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(console.error);
    } else {
        document.exitFullscreen();
    }
}

function shareSignal() {
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    const trend = indicatorState.trend.toUpperCase();
    const price = indicatorState.currentPrice.toFixed(2);
    const atr = indicatorState.atr.toFixed(4);
    
    const message = `
📈 TREND_1H SIGNAL

Symbol: ${symbol.replace('USDT', '')}/USDT
Timeframe: ${timeframe}
Trend: ${trend}
Price: $${price}
ATR: ${atr}

Signal generated: ${new Date().toLocaleString()}
    `.trim();
    
    tg.sendData(JSON.stringify({
        action: 'share_signal',
        message: message
    }));
    
    tg.showAlert('✅ Signal shared successfully!');
}

// ============================================
// АВТООБНОВЛЕНИЕ
// ============================================
setInterval(() => {
    if (!document.hidden && isChartInitialized && !isLoading) {
        loadChartData();
    }
}, 30000); // Обновление каждые 30 секунд

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadChartData();
    }
});

// ============================================
// ДЕБАГ ИНФОРМАЦИЯ
// ============================================
window.app = {
    version: '1.0.0',
    reload: loadChartData,
    getState: () => ({
        chartInitialized: isChartInitialized,
        dataCount: currentData.length,
        symbol: document.getElementById('symbol').value,
        indicator: indicatorState
    }),
    test: () => {
        console.log('Testing chart functionality...');
        loadTestData();
    }
};

console.log('✅ TREND_1H Futures Indicator loaded successfully!');
