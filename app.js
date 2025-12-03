// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#000000');
tg.setBackgroundColor('#000000');

// Все фьючерсы Binance
const BINANCE_FUTURES = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT'
];

// Глобальные переменные
let chart = null;
let candleSeries = null;
let lineSeries = [];
let currentData = [];
let isChartReady = false;

// Состояние индикатора
let indicatorState = {
    trend: null,
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    currentPrice: 0,
    targets: [],
    isBullish: false,
    isBearish: false
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting app...');
    
    // Заполняем список символов
    populateSymbols();
    
    // Инициализация элементов управления
    initControls();
    
    // Инициализация графика
    setTimeout(initChart, 100);
    
    // Загрузка данных через секунду
    setTimeout(loadInitialData, 500);
});

// Заполнение списка символов
function populateSymbols() {
    const select = document.getElementById('symbol');
    select.innerHTML = '';
    
    BINANCE_FUTURES.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = symbol.replace('USDT', '');
        select.appendChild(option);
    });
}

// Инициализация элементов управления
function initControls() {
    // Кнопка обновления
    document.getElementById('updateBtn').addEventListener('click', function() {
        console.log('🔄 Update clicked');
        loadInitialData();
    });
    
    // Изменение символа
    document.getElementById('symbol').addEventListener('change', function() {
        console.log('📊 Symbol changed');
        loadInitialData();
    });
    
    // Изменение таймфрейма
    document.getElementById('timeframe').addEventListener('change', function() {
        console.log('⏰ Timeframe changed');
        loadInitialData();
    });
    
    // Изменение настроек индикатора
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', function() {
            console.log('⚙️ Setting changed:', id);
            if (currentData.length > 20) {
                calculateIndicator();
                drawIndicatorLines();
            }
        });
    });
    
    // Кнопка поделиться
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    
    // Кнопка полноэкранного режима
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
}

// Инициализация графика Lightweight Charts
function initChart() {
    try {
        console.log('📈 Initializing chart...');
        
        const chartContainer = document.getElementById('chart');
        
        // Проверяем, что контейнер существует
        if (!chartContainer) {
            console.error('❌ Chart container not found!');
            return;
        }
        
        // Очищаем контейнер
        chartContainer.innerHTML = '';
        
        // Создаем график
        chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { color: '#000000' },
                textColor: '#ffffff',
            },
            grid: {
                vertLines: { color: '#222222' },
                horzLines: { color: '#222222' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#333333',
            },
            timeScale: {
                borderColor: '#333333',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
            },
        });
        
        // Создаем свечную серию
        candleSeries = chart.addCandlestickSeries({
            upColor: '#00ff00',
            downColor: '#ff0000',
            borderUpColor: '#00ff00',
            borderDownColor: '#ff0000',
            wickUpColor: '#00ff00',
            wickDownColor: '#ff0000',
        });
        
        // Настраиваем изменение размера
        window.addEventListener('resize', function() {
            if (chart) {
                chart.applyOptions({
                    width: chartContainer.clientWidth,
                    height: chartContainer.clientHeight,
                });
            }
        });
        
        isChartReady = true;
        console.log('✅ Chart initialized successfully!');
        
    } catch (error) {
        console.error('❌ Chart initialization error:', error);
        showError('Chart error: ' + error.message);
    }
}

// Загрузка начальных данных
async function loadInitialData() {
    try {
        showLoading();
        hideError();
        
        if (!isChartReady) {
            console.log('⚠️ Chart not ready, initializing...');
            initChart();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`📥 Loading ${symbol} ${timeframe}...`);
        
        // Получение данных
        const data = await getChartData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received');
        }
        
        console.log(`📊 Received ${data.length} candles`);
        
        // Обработка данных
        currentData = processData(data);
        
        // Обновление графика
        updateChart(currentData);
        
        // Расчет индикатора
        calculateIndicator();
        
        // Отрисовка линий
        drawIndicatorLines();
        
        // Обновление статуса
        updateStatus();
        
        hideLoading();
        console.log('✅ Data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showError('Data error: ' + error.message);
        hideLoading();
        
        // Пробуем загрузить тестовые данные
        setTimeout(loadTestData, 1000);
    }
}

// Получение данных
async function getChartData(symbol, interval) {
    try {
        // Используем публичный Binance API
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`;
        console.log(`🌐 Fetching: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.warn('⚠️ API failed:', error.message);
        // Возвращаем тестовые данные
        return generateTestData(symbol);
    }
}

// Генерация тестовых данных
function generateTestData(symbol) {
    console.log('🔧 Generating test data...');
    
    const data = [];
    let price = getBasePrice(symbol);
    
    for (let i = 0; i < 100; i++) {
        const timestamp = Date.now() - (100 - i) * 60000;
        const open = price;
        const change = (Math.random() - 0.5) * 0.02;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = Math.random() * 1000;
        
        data.push([
            timestamp,
            open.toFixed(2),
            high.toFixed(2),
            low.toFixed(2),
            close.toFixed(2),
            volume.toFixed(2)
        ]);
        
        price = close;
    }
    
    return data;
}

function getBasePrice(symbol) {
    const prices = {
        'BTCUSDT': 50000,
        'ETHUSDT': 3000,
        'BNBUSDT': 400,
        'SOLUSDT': 100,
        'XRPUSDT': 0.5,
        'ADAUSDT': 0.4,
        'DOGEUSDT': 0.1,
        'DOTUSDT': 6,
        'MATICUSDT': 0.8
    };
    return prices[symbol] || 50;
}

// Обработка данных
function processData(rawData) {
    return rawData.map(item => ({
        time: Math.floor(item[0] / 1000),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
    }));
}

// Обновление графика
function updateChart(data) {
    if (!candleSeries || !isChartReady) {
        console.error('Chart not ready');
        return;
    }
    
    try {
        // Устанавливаем данные
        candleSeries.setData(data);
        
        // Масштабируем по времени
        chart.timeScale().fitContent();
        
        // Обновляем цену
        if (data.length > 0) {
            const lastPrice = data[data.length - 1].close;
            document.getElementById('priceStatus').textContent = lastPrice.toFixed(2);
            indicatorState.currentPrice = lastPrice;
        }
        
    } catch (error) {
        console.error('Update chart error:', error);
    }
}

// Загрузка тестовых данных
function loadTestData() {
    try {
        const symbol = document.getElementById('symbol').value;
        const data = generateTestData(symbol);
        
        currentData = processData(data);
        updateChart(currentData);
        calculateIndicator();
        drawIndicatorLines();
        updateStatus();
        
        hideError();
        
    } catch (error) {
        console.error('Test data error:', error);
    }
}

// Расчет индикатора
function calculateIndicator() {
    if (currentData.length < 20) return;
    
    try {
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        
        const closes = currentData.map(d => d.close);
        const highs = currentData.map(d => d.high);
        const lows = currentData.map(d => d.low);
        
        // Расчет ATR
        const atr = calculateATR(currentData, atrPeriod) * 0.3;
        
        // Расчет SMA
        const smaHigh = calculateSMA(highs, trendLength) + atr;
        const smaLow = calculateSMA(lows, trendLength) - atr;
        
        // Определение тренда
        const lastClose = closes[closes.length - 1];
        
        let trend = 'neutral';
        let isBullish = false;
        
        if (lastClose > smaHigh) {
            trend = 'up';
            isBullish = true;
        } else if (lastClose < smaLow) {
            trend = 'down';
        }
        
        // Расчет целей
        const targets = calculateTargets(lastClose, atr, targetMultiplier, isBullish);
        
        // Сохраняем состояние
        indicatorState = {
            trend,
            smaHigh,
            smaLow,
            atr,
            currentPrice: lastClose,
            targets,
            isBullish,
            isBearish: !isBullish && trend === 'down'
        };
        
        updateIndicatorDisplay();
        
    } catch (error) {
        console.error('Indicator error:', error);
    }
}

// Расчет ATR
function calculateATR(data, period) {
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
    
    let atr = 0;
    for (let i = 0; i < period; i++) {
        atr += trValues[i];
    }
    atr /= period;
    
    return atr;
}

// Расчет SMA
function calculateSMA(data, period) {
    if (data.length < period) return 0;
    
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

// Расчет целей
function calculateTargets(entryPrice, atr, multiplier, isBullish) {
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

// Обновление отображения индикатора
function updateIndicatorDisplay() {
    const trendElement = document.getElementById('trendStatus');
    const atrElement = document.getElementById('atrStatus');
    const smaHighElement = document.getElementById('smaHighStatus');
    const targetsGrid = document.getElementById('targetsGrid');
    
    // Тренд
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
    
    // ATR
    atrElement.textContent = indicatorState.atr.toFixed(4);
    
    // SMA High
    smaHighElement.textContent = indicatorState.smaHigh.toFixed(2);
    
    // Цели
    targetsGrid.innerHTML = '';
    
    indicatorState.targets.forEach(target => {
        const targetCard = document.createElement('div');
        targetCard.className = `target-card ${target.type}`;
        
        const priceClass = `price-${target.type}`;
        
        targetCard.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-price ${priceClass}">${target.value.toFixed(2)}</div>
        `;
        
        targetsGrid.appendChild(targetCard);
    });
}

// Отрисовка линий индикатора
function drawIndicatorLines() {
    try {
        // Удаляем старые линии
        lineSeries.forEach(series => {
            try {
                chart.removeSeries(series);
            } catch (e) {}
        });
        lineSeries = [];
        
        if (indicatorState.targets.length === 0) return;
        
        // Линии целей
        indicatorState.targets.forEach(target => {
            const series = chart.addLineSeries({
                color: target.color,
                lineWidth: 2,
                lineStyle: target.type === 'profit' ? 1 : 0,
                priceLineVisible: false,
            });
            
            const lineData = currentData.map(item => ({
                time: item.time,
                value: target.value
            }));
            
            series.setData(lineData);
            lineSeries.push(series);
        });
        
        // Линии SMA
        const smaHighSeries = chart.addLineSeries({
            color: '#00ff00',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
        });
        
        const smaLowSeries = chart.addLineSeries({
            color: '#ff0000',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
        });
        
        const smaHighData = currentData.map(item => ({
            time: item.time,
            value: indicatorState.smaHigh
        }));
        
        const smaLowData = currentData.map(item => ({
            time: item.time,
            value: indicatorState.smaLow
        }));
        
        smaHighSeries.setData(smaHighData);
        smaLowSeries.setData(smaLowData);
        
        lineSeries.push(smaHighSeries, smaLowSeries);
        
    } catch (error) {
        console.error('Draw lines error:', error);
    }
}

// Обновление статуса
function updateStatus() {
    // Можно добавить время обновления
}

// Переключение полноэкранного режима
function toggleFullscreen() {
    const container = document.querySelector('.container');
    
    if (!document.fullscreenElement) {
        container.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Поделиться сигналом
function shareSignal() {
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    const trend = document.getElementById('trendStatus').textContent;
    const price = document.getElementById('priceStatus').textContent;
    const atr = document.getElementById('atrStatus').textContent;
    
    const message = `
📈 TREND_1H SIGNAL

Symbol: ${symbol.replace('USDT', '')}/USDT
Timeframe: ${timeframe}
Trend: ${trend}
Price: ${price}
ATR: ${atr}

${new Date().toLocaleString()}
    `.trim();
    
    tg.sendData(JSON.stringify({
        action: 'share_signal',
        message: message
    }));
    
    tg.showAlert('Signal shared!');
}

// Вспомогательные функции
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `
        <div class="error-message">
            ❌ ${message}
        </div>
    `;
    errorContainer.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorContainer').classList.add('hidden');
}

// Автообновление каждые 30 секунд
setInterval(() => {
    if (!document.hidden && isChartReady) {
        loadInitialData();
    }
}, 30000);

// Обновление при возвращении на вкладку
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadInitialData();
    }
});
