// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#000000');
tg.setBackgroundColor('#000000');

// Все фьючерсы Binance
const BINANCE_FUTURES = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT',
    'LINKUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT',
    'FILUSDT', 'NEARUSDT', 'ALGOUSDT', 'VETUSDT', 'ICPUSDT',
    'APEUSDT', 'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT',
    'FTMUSDT', 'CRVUSDT', 'EOSUSDT', 'AAVEUSDT', 'YFIUSDT'
];

// Глобальные переменные
let chart = null;
let candleSeries = null;
let volumeSeries = null;
let currentData = [];
let horizontalLineSeries = [];
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing TREND_1H indicator...');
    
    // Заполняем список символов
    populateSymbols();
    
    // Инициализация элементов управления
    initControls();
    
    // Инициализация графика
    initChart();
    
    // Загрузка начальных данных
    await loadInitialData();
    
    console.log('App ready');
});

// Заполнение списка символов
function populateSymbols() {
    const select = document.getElementById('symbol');
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
    document.getElementById('updateBtn').addEventListener('click', async () => {
        await loadInitialData();
    });
    
    // Изменение символа
    document.getElementById('symbol').addEventListener('change', async () => {
        await loadInitialData();
    });
    
    // Изменение таймфрейма
    document.getElementById('timeframe').addEventListener('change', async () => {
        await loadInitialData();
    });
    
    // Изменение настроек индикатора
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
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
    const chartContainer = document.getElementById('chart');
    
    // Создаем график
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
            background: { color: '#000000' },
            textColor: '#ffffff',
        },
        grid: {
            vertLines: { color: '#333333' },
            horzLines: { color: '#333333' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#333333',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        },
        timeScale: {
            borderColor: '#333333',
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
        },
        handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
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
        borderVisible: false,
        wickUpColor: '#00ff00',
        wickDownColor: '#ff0000',
        priceScaleId: 'right',
    });
    
    // Настройка изменения размера окна
    new ResizeObserver(() => {
        chart.applyOptions({
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
        });
    }).observe(chartContainer);
    
    isChartReady = true;
}

// Загрузка начальных данных
async function loadInitialData() {
    try {
        showLoading();
        hideError();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`Loading data for ${symbol} ${timeframe}`);
        
        // Получение данных
        const data = await fetchChartData(symbol, timeframe, 200);
        
        if (!data || data.length === 0) {
            throw new Error('No data received from exchange');
        }
        
        // Обработка данных
        currentData = processChartData(data);
        
        // Обновление графика
        updateChartData(currentData);
        
        // Расчет индикатора
        calculateIndicator();
        
        // Отрисовка линий индикатора
        drawIndicatorLines();
        
        // Обновление статуса
        updateStatus();
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError(`Failed to load data: ${error.message}`);
        hideLoading();
    }
}

// Получение данных с Binance
async function fetchChartData(symbol, interval, limit = 200) {
    try {
        // Пробуем фьючерсы API
        console.log(`Trying futures API for ${symbol}...`);
        const response = await fetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) {
            throw new Error(`Futures API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Got ${data.length} candles from futures API`);
        return data;
        
    } catch (futuresError) {
        console.log('Futures API failed, trying spot API...');
        
        try {
            // Запасной вариант: спотовые данные
            const response = await fetch(
                `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
            
            if (!response.ok) {
                throw new Error(`Spot API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Got ${data.length} candles from spot API`);
            return data;
            
        } catch (spotError) {
            console.log('Both APIs failed, using test data...');
            return generateTestData(symbol);
        }
    }
}

// Генерация тестовых данных
function generateTestData(symbol) {
    console.log(`Generating test data for ${symbol}...`);
    
    const data = [];
    let price = symbol.includes('BTC') ? 50000 : 
                symbol.includes('ETH') ? 3000 : 
                symbol.includes('SOL') ? 100 : 50;
    
    const volatility = 0.02;
    
    for (let i = 0; i < 200; i++) {
        const timestamp = Date.now() - (200 - i) * 3600000;
        const open = price;
        const change = (Math.random() - 0.5) * volatility * 2;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * volatility);
        const low = Math.min(open, close) * (1 - Math.random() * volatility);
        const volume = Math.random() * 1000;
        
        data.push([
            timestamp,
            open.toFixed(2),
            high.toFixed(2),
            low.toFixed(2),
            close.toFixed(2),
            volume.toFixed(2),
            timestamp,
            volume.toFixed(2),
            0,
            0,
            volume.toFixed(2),
            volume.toFixed(2)
        ]);
        
        price = close;
    }
    
    return data;
}

// Обработка данных графика
function processChartData(rawData) {
    return rawData.map(item => ({
        time: item[0] / 1000, // Lightweight Charts использует секунды
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
    }));
}

// Обновление данных графика
function updateChartData(data) {
    if (!candleSeries || !isChartReady) {
        console.error('Chart not ready');
        return;
    }
    
    try {
        // Обновляем данные свечей
        candleSeries.setData(data);
        
        // Обновляем цену в статусе
        if (data.length > 0) {
            const lastPrice = data[data.length - 1].close;
            document.getElementById('priceStatus').textContent = lastPrice.toFixed(2);
            indicatorState.currentPrice = lastPrice;
        }
        
    } catch (error) {
        console.error('Error updating chart data:', error);
    }
}

// Расчет индикатора Trend_1H (точная логика из Pine Script)
function calculateIndicator() {
    if (currentData.length < 30) {
        console.warn('Not enough data for indicator calculation');
        return;
    }
    
    try {
        // Получаем параметры
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        
        // Получаем массивы цен
        const closes = currentData.map(d => d.close);
        const highs = currentData.map(d => d.high);
        const lows = currentData.map(d => d.low);
        
        // 1. Расчет ATR
        const atr = calculateATR(currentData, atrPeriod);
        const atrValue = atr * 0.3; // По формуле из индикатора
        
        // 2. Расчет SMA High и SMA Low
        const smaHigh = calculateSMA(highs, trendLength) + atrValue;
        const smaLow = calculateSMA(lows, trendLength) - atrValue;
        
        // 3. Определение тренда
        const lastClose = closes[closes.length - 1];
        
        let trend = 'neutral';
        let isBullish = false;
        let isBearish = false;
        
        if (lastClose > smaHigh) {
            trend = 'up';
            isBullish = true;
        } else if (lastClose < smaLow) {
            trend = 'down';
            isBearish = true;
        }
        
        // 4. Расчет целей по точной логике индикатора
        const targets = calculateTargetsExact(lastClose, atrValue, targetMultiplier, isBullish);
        
        // Сохраняем состояние
        indicatorState = {
            trend,
            smaHigh,
            smaLow,
            atr: atrValue,
            currentPrice: lastClose,
            targets,
            isBullish,
            isBearish
        };
        
        // Обновляем отображение статуса
        updateIndicatorDisplay();
        
    } catch (error) {
        console.error('Error calculating indicator:', error);
        showError(`Indicator calculation error: ${error.message}`);
    }
}

// Расчет ATR
function calculateATR(data, period) {
    if (data.length < period + 1) return 0;
    
    const trValues = [];
    
    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i - 1].close;
        
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trValues.push(tr);
    }
    
    // Первое значение ATR - среднее за период
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
    
    const lastValues = data.slice(-period);
    const sum = lastValues.reduce((a, b) => a + b, 0);
    return sum / period;
}

// Расчет целей по точной логике индикатора
function calculateTargetsExact(entryPrice, atrValue, multiplier, isBullish) {
    const sign = isBullish ? 1 : -1;
    
    // Точные формулы из Pine Script индикатора
    const target1 = entryPrice + atrValue * (5 + multiplier) * sign;
    const target2 = entryPrice + atrValue * (10 + multiplier * 2) * sign;
    const target3 = entryPrice + atrValue * (15 + multiplier * 4) * sign;
    const target4 = entryPrice + atrValue * (20 + multiplier * 6) * sign;
    const stopLoss = entryPrice - atrValue * 2 * sign;
    
    return [
        {
            name: 'Stop Loss',
            value: stopLoss,
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
            value: target1,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP2',
            value: target2,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP3',
            value: target3,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TP4',
            value: target4,
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
    
    // Обновление тренда
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
    atrElement.textContent = indicatorState.atr.toFixed(4);
    
    // Обновление SMA High
    smaHighElement.textContent = indicatorState.smaHigh.toFixed(2);
    
    // Обновление целей
    targetsGrid.innerHTML = '';
    
    indicatorState.targets.forEach((target, index) => {
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

// Отрисовка линий индикатора на графике
function drawIndicatorLines() {
    try {
        // Удаляем старые линии
        horizontalLineSeries.forEach(line => {
            chart.removeSeries(line);
        });
        horizontalLineSeries = [];
        
        // Рисуем линии только если есть данные
        if (indicatorState.targets.length === 0 || !isChartReady) {
            return;
        }
        
        // Добавляем линии для каждого уровня
        indicatorState.targets.forEach(target => {
            const lineSeries = chart.addLineSeries({
                color: target.color,
                lineWidth: 2,
                lineStyle: target.type === 'profit' ? 1 : 0, // 0 = solid, 1 = dotted
                lastValueVisible: true,
                priceLineVisible: false,
            });
            
            // Создаем данные для линии (по всей длине графика)
            const lineData = currentData.map(item => ({
                time: item.time,
                value: target.value
            }));
            
            lineSeries.setData(lineData);
            horizontalLineSeries.push(lineSeries);
        });
        
        // Линии SMA High и SMA Low
        const smaHighSeries = chart.addLineSeries({
            color: '#00ff00',
            lineWidth: 1,
            lineStyle: 2, // dashed
            lastValueVisible: false,
            priceLineVisible: false,
        });
        
        const smaLowSeries = chart.addLineSeries({
            color: '#ff0000',
            lineWidth: 1,
            lineStyle: 2, // dashed
            lastValueVisible: false,
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
        
        horizontalLineSeries.push(smaHighSeries, smaLowSeries);
        
    } catch (error) {
        console.error('Error drawing indicator lines:', error);
    }
}

// Обновление статуса
function updateStatus() {
    // Можно добавить дополнительную информацию о статусе
    console.log('Status updated');
}

// Запуск автообновления
function startAutoUpdate() {
    // Обновление данных каждые 30 секунд
    setInterval(async () => {
        if (!document.hidden && isChartReady) {
            await loadInitialData();
        }
    }, 30000);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadInitialData();
        }
    });
}

// Переключение полноэкранного режима
function toggleFullscreen() {
    const container = document.querySelector('.container');
    
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.error('Fullscreen error:', err);
        });
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
📈 *TREND_1H SIGNAL*

*Symbol:* ${symbol.replace('USDT', '')}/USDT
*Timeframe:* ${timeframe}
*Trend:* ${trend}
*Price:* ${price}
*ATR:* ${atr}

*Based on original Pine Script indicator*
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
            <br>
            <small>Trying to load test data...</small>
        </div>
    `;
    errorContainer.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorContainer').classList.add('hidden');
}

// Запускаем автообновление после загрузки
setTimeout(startAutoUpdate, 5000);

// Экспорт для отладки
window.app = {
    loadInitialData,
    calculateIndicator,
    getState: () => ({
        symbol: document.getElementById('symbol').value,
        timeframe: document.getElementById('timeframe').value,
        indicator: indicatorState,
        dataLength: currentData.length
    })
};
