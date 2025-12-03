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
    'FILUSDT', 'NEARUSDT', 'ALGOUSDT', 'VETUSDT', 'ICPUSDT'
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing TREND_1H indicator...');
    
    // Заполняем список символов
    populateSymbols();
    
    // Инициализация элементов управления
    initControls();
    
    // Инициализация графика
    initChart();
    
    // Загрузка начальных данных
    await loadInitialData();
    
    console.log('✅ App ready');
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
    document.getElementById('updateBtn').addEventListener('click', async () => {
        console.log('🔄 Manual update requested');
        await loadInitialData();
    });
    
    // Изменение символа
    document.getElementById('symbol').addEventListener('change', async () => {
        console.log('📊 Symbol changed');
        await loadInitialData();
    });
    
    // Изменение таймфрейма
    document.getElementById('timeframe').addEventListener('change', async () => {
        console.log('⏰ Timeframe changed');
        await loadInitialData();
    });
    
    // Изменение настроек индикатора
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            console.log('⚙️ Settings changed');
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
        const chartContainer = document.getElementById('chart');
        
        // Очищаем предыдущий график
        if (chart) {
            chart.remove();
        }
        
        // Создаем график
        chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { color: '#000000' },
                textColor: '#ffffff',
                fontSize: 12
            },
            grid: {
                vertLines: { color: '#1a1a1a' },
                horzLines: { color: '#1a1a1a' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#333333',
                scaleMargins: {
                    top: 0.05,
                    bottom: 0.05,
                },
            },
            timeScale: {
                borderColor: '#333333',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 10,
                barSpacing: 6,
                fixLeftEdge: false,
                fixRightEdge: false,
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
                axisDoubleClickReset: true,
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
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            }
        });
        
        // Настройка изменения размера окна
        const resizeObserver = new ResizeObserver(() => {
            chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
            });
        });
        resizeObserver.observe(chartContainer);
        
        isChartReady = true;
        console.log('✅ Chart initialized');
        
    } catch (error) {
        console.error('❌ Error initializing chart:', error);
        showError(`Chart initialization error: ${error.message}`);
    }
}

// Загрузка начальных данных
async function loadInitialData() {
    try {
        showLoading();
        hideError();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`📥 Loading data for ${symbol} ${timeframe}`);
        
        // Получение данных
        const data = await fetchChartData(symbol, timeframe, 150);
        
        if (!data || data.length === 0) {
            throw new Error('No data received from exchange');
        }
        
        console.log(`📊 Received ${data.length} candles`);
        
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
        console.log('✅ Data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showError(`Failed to load data: ${error.message}`);
        hideLoading();
        
        // Пробуем загрузить тестовые данные
        setTimeout(loadTestData, 1000);
    }
}

// Загрузка тестовых данных
async function loadTestData() {
    try {
        console.log('🔄 Loading test data...');
        const symbol = document.getElementById('symbol').value;
        const data = generateTestData(symbol);
        
        currentData = processChartData(data);
        updateChartData(currentData);
        calculateIndicator();
        drawIndicatorLines();
        updateStatus();
        
        hideError();
        console.log('✅ Test data loaded');
    } catch (error) {
        console.error('❌ Error loading test data:', error);
    }
}

// Получение данных с Binance
async function fetchChartData(symbol, interval, limit = 150) {
    try {
        console.log(`🌐 Fetching data from Binance API for ${symbol}...`);
        
        // Сначала пробуем спотовый API (он более стабильный)
        const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`✅ Got ${data.length} candles from Binance`);
        return data;
        
    } catch (error) {
        console.warn(`⚠️ Binance API failed: ${error.message}`);
        
        // Пробуем альтернативный источник
        return await fetchAlternativeData(symbol, interval, limit);
    }
}

// Альтернативный источник данных
async function fetchAlternativeData(symbol, interval, limit) {
    try {
        console.log(`🌐 Trying alternative API...`);
        
        // Используем CoinGecko для основных монет
        const coinMap = {
            'BTCUSDT': 'bitcoin',
            'ETHUSDT': 'ethereum', 
            'BNBUSDT': 'binancecoin',
            'SOLUSDT': 'solana',
            'XRPUSDT': 'ripple',
            'ADAUSDT': 'cardano',
            'DOGEUSDT': 'dogecoin',
            'DOTUSDT': 'polkadot',
            'MATICUSDT': 'matic-network'
        };
        
        const coinId = coinMap[symbol];
        if (!coinId) {
            throw new Error('Symbol not supported in alternative API');
        }
        
        // Получаем данные из CoinGecko
        const days = interval === '1m' ? 1 : 
                     interval === '5m' ? 2 :
                     interval === '15m' ? 3 :
                     interval === '30m' ? 4 :
                     interval === '1h' ? 7 : 30;
        
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Конвертируем формат CoinGecko в формат Binance
        return data.map(item => [
            item[0],           // timestamp
            item[1].toString(), // open
            item[2].toString(), // high
            item[3].toString(), // low
            item[4].toString(), // close
            "1000",            // volume
            item[0],           // close time
            "1000",            // quote asset volume
            0,                 // number of trades
            "0",              // taker buy base asset volume
            "0",              // taker buy quote asset volume
            "0"               // ignore
        ]);
        
    } catch (error) {
        console.warn(`⚠️ Alternative API failed: ${error.message}`);
        return null; // Вернем null, чтобы сгенерировать тестовые данные
    }
}

// Генерация тестовых данных
function generateTestData(symbol) {
    console.log(`🔧 Generating test data for ${symbol}...`);
    
    const data = [];
    let price = getBasePrice(symbol);
    const volatility = getVolatility(symbol);
    
    for (let i = 0; i < 150; i++) {
        const timestamp = Date.now() - (150 - i) * 60000; // 1 минута интервал
        
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

function getVolatility(symbol) {
    const volatilities = {
        'BTCUSDT': 0.015,
        'ETHUSDT': 0.02,
        'BNBUSDT': 0.025,
        'SOLUSDT': 0.03,
        'XRPUSDT': 0.04,
        'ADAUSDT': 0.035,
        'DOGEUSDT': 0.05,
        'DOTUSDT': 0.028,
        'MATICUSDT': 0.032
    };
    return volatilities[symbol] || 0.02;
}

// Обработка данных графика
function processChartData(rawData) {
    return rawData.map(item => ({
        time: Math.floor(item[0] / 1000), // Конвертируем в секунды
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
        // Очищаем старые данные
        candleSeries.setData([]);
        
        // Устанавливаем новые данные
        candleSeries.setData(data);
        
        // Обновляем масштаб времени
        if (data.length > 0) {
            chart.timeScale().fitContent();
        }
        
        // Обновляем цену в статусе
        if (data.length > 0) {
            const lastPrice = data[data.length - 1].close;
            document.getElementById('priceStatus').textContent = lastPrice.toFixed(2);
            indicatorState.currentPrice = lastPrice;
            console.log(`💰 Current price: ${lastPrice.toFixed(2)}`);
        }
        
    } catch (error) {
        console.error('❌ Error updating chart data:', error);
    }
}

// Расчет индикатора Trend_1H
function calculateIndicator() {
    if (currentData.length < 30) {
        console.warn('⚠️ Not enough data for indicator calculation');
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
        const atrValue = calculateATR(currentData, atrPeriod) * 0.3;
        
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
            console.log('📈 Bullish trend detected');
        } else if (lastClose < smaLow) {
            trend = 'down';
            isBearish = true;
            console.log('📉 Bearish trend detected');
        }
        
        // 4. Расчет целей
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
        
        console.log('✅ Indicator calculated:', {
            trend,
            price: lastClose,
            smaHigh,
            smaLow,
            atr: atrValue,
            targetsCount: targets.length
        });
        
        // Обновляем отображение статуса
        updateIndicatorDisplay();
        
    } catch (error) {
        console.error('❌ Error calculating indicator:', error);
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
    
    // Первое значение ATR
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

// Расчет целей
function calculateTargetsExact(entryPrice, atrValue, multiplier, isBullish) {
    const sign = isBullish ? 1 : -1;
    
    // Формулы из индикатора
    const target1 = entryPrice + atrValue * (5 + multiplier) * sign;
    const target2 = entryPrice + atrValue * (10 + multiplier * 2) * sign;
    const target3 = entryPrice + atrValue * (15 + multiplier * 4) * sign;
    const target4 = entryPrice + atrValue * (20 + multiplier * 6) * sign;
    const stopLoss = entryPrice - atrValue * 2 * sign;
    
    console.log('🎯 Targets calculated:', {
        entry: entryPrice,
        stopLoss,
        tp1: target1,
        tp2: target2,
        tp3: target3,
        tp4: target4,
        atr: atrValue,
        multiplier,
        isBullish
    });
    
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
    try {
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
        
    } catch (error) {
        console.error('❌ Error updating indicator display:', error);
    }
}

// Отрисовка линий индикатора на графике
function drawIndicatorLines() {
    try {
        // Удаляем старые линии
        lineSeries.forEach(series => {
            try {
                chart.removeSeries(series);
            } catch (e) {
                // Игнорируем ошибки удаления
            }
        });
        lineSeries = [];
        
        // Рисуем линии только если есть данные
        if (indicatorState.targets.length === 0 || !isChartReady) {
            return;
        }
        
        console.log('📐 Drawing indicator lines...');
        
        // Добавляем линии для каждого уровня
        indicatorState.targets.forEach(target => {
            try {
                const series = chart.addLineSeries({
                    color: target.color,
                    lineWidth: 2,
                    lineStyle: target.type === 'profit' ? 1 : 0,
                    lastValueVisible: true,
                    priceLineVisible: false,
                    title: target.name,
                });
                
                // Создаем данные для линии
                const lineData = currentData.map(item => ({
                    time: item.time,
                    value: target.value
                }));
                
                series.setData(lineData);
                lineSeries.push(series);
                
            } catch (error) {
                console.error(`❌ Error drawing ${target.name} line:`, error);
            }
        });
        
        // Линии SMA High и SMA Low
        try {
            const smaHighSeries = chart.addLineSeries({
                color: '#00ff00',
                lineWidth: 1,
                lineStyle: 2,
                lastValueVisible: false,
                priceLineVisible: false,
                title: 'SMA High'
            });
            
            const smaLowSeries = chart.addLineSeries({
                color: '#ff0000',
                lineWidth: 1,
                lineStyle: 2,
                lastValueVisible: false,
                priceLineVisible: false,
                title: 'SMA Low'
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
            console.error('❌ Error drawing SMA lines:', error);
        }
        
        console.log(`✅ Drawn ${lineSeries.length} indicator lines`);
        
    } catch (error) {
        console.error('❌ Error drawing indicator lines:', error);
    }
}

// Обновление статуса
function updateStatus() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    console.log(`🕒 Last update: ${timeString}`);
}

// Переключение полноэкранного режима
function toggleFullscreen() {
    const container = document.querySelector('.container');
    
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.error('❌ Fullscreen error:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Поделиться сигналом
function shareSignal() {
    try {
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
        
        tg.showAlert('✅ Signal shared!');
        
    } catch (error) {
        console.error('❌ Error sharing signal:', error);
        tg.showAlert('Error sharing signal');
    }
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
            <small>Loading test data...</small>
        </div>
    `;
    errorContainer.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorContainer').classList.add('hidden');
}

// Запускаем автообновление
setInterval(async () => {
    if (!document.hidden && isChartReady && currentData.length > 0) {
        console.log('🔄 Auto-updating data...');
        await loadInitialData();
    }
}, 60000); // Обновляем каждую минуту

// Обновление при возвращении на вкладку
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isChartReady) {
        console.log('👀 Tab became visible, updating data...');
        setTimeout(loadInitialData, 1000);
    }
});
