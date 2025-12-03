// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#1e293b');
tg.setBackgroundColor('#0f172a');

// Основные переменные
let chart = null;
let candleSeries = null;
let volumeSeries = null;
let trendLineSeries = null;
let targetLines = [];
let currentData = [];
let ws = null;

// Конфигурация
const config = {
    symbols: [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
        'XRPUSDT', 'ADAUSDT', 'DOTUSDT', 'DOGEUSDT'
    ],
    timeframes: {
        '5m': '5m',
        '15m': '15m', 
        '1h': '1h',
        '4h': '4h',
        '1d': '1d'
    },
    colors: {
        up: '#22c55e',
        down: '#ef4444',
        trendLine: '#3b82f6',
        target1: '#8b5cf6',
        target2: '#ec4899',
        target3: '#f59e0b',
        target4: '#10b981',
        stopLoss: '#ef4444'
    }
};

// Состояние индикатора
let indicatorState = {
    trend: null, // 'up', 'down', 'neutral'
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    currentPrice: 0,
    targets: [],
    lastSignal: null,
    signalTime: null
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Инициализация приложения...');
    
    // Инициализация элементов управления
    initControls();
    
    // Инициализация графика
    initChart();
    
    // Загрузка начальных данных
    await loadInitialData();
    
    // Расчет индикатора
    calculateIndicator();
    
    // Запуск обновлений
    startAutoUpdate();
    
    console.log('Приложение готово');
});

// Инициализация элементов управления
function initControls() {
    const symbolSelect = document.getElementById('symbol');
    const timeframeSelect = document.getElementById('timeframe');
    const updateBtn = document.getElementById('updateBtn');
    const shareBtn = document.getElementById('shareBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    // Обновление графика
    updateBtn.addEventListener('click', async () => {
        await updateChart();
    });
    
    // Поделиться сигналом
    shareBtn.addEventListener('click', () => {
        shareSignal();
    });
    
    // Полноэкранный режим
    fullscreenBtn.addEventListener('click', () => {
        if (chart) {
            const container = document.getElementById('chart');
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    console.error('Ошибка полноэкранного режима:', err);
                });
            } else {
                document.exitFullscreen();
            }
        }
    });
    
    // Изменение символа
    symbolSelect.addEventListener('change', async () => {
        await updateChart();
    });
    
    // Изменение таймфрейма
    timeframeSelect.addEventListener('change', async () => {
        await updateChart();
    });
    
    // Изменение настроек индикатора
    ['trendLength', 'targetMultiplier', 'atrPeriod', 'atrMultiplier'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            calculateIndicator();
        });
    });
}

// Инициализация графика
function initChart() {
    const chartContainer = document.getElementById('chart');
    
    // Создание графика
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
            background: { color: '#0f172a' },
            textColor: '#94a3b8',
        },
        grid: {
            vertLines: { color: '#1e293b' },
            horzLines: { color: '#1e293b' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#475569',
        },
        timeScale: {
            borderColor: '#475569',
            timeVisible: true,
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
    
    // Серия свечей
    candleSeries = chart.addCandlestickSeries({
        upColor: config.colors.up,
        downColor: config.colors.down,
        borderVisible: false,
        wickUpColor: config.colors.up,
        wickDownColor: config.colors.down,
    });
    
    // Серия объема
    volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });
    
    // Серия для линий тренда
    trendLineSeries = chart.addLineSeries({
        color: config.colors.trendLine,
        lineWidth: 2,
        lineStyle: 2, // dashed
    });
    
    // Адаптация к изменению размера окна
    new ResizeObserver(() => {
        chart.applyOptions({
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
        });
    }).observe(chartContainer);
    
    // Скрытие загрузки
    document.getElementById('loading').classList.add('hidden');
}

// Загрузка начальных данных
async function loadInitialData() {
    try {
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`Загрузка данных: ${symbol}, ${timeframe}`);
        
        // Получение данных с Binance
        const data = await fetchKlines(symbol, timeframe, 200);
        
        if (!data || data.length === 0) {
            throw new Error('Нет данных');
        }
        
        currentData = processKlineData(data);
        
        // Обновление графика
        candleSeries.setData(currentData);
        
        // Обновление объема
        const volumeData = currentData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close > d.open ? config.colors.up : config.colors.down,
        }));
        volumeSeries.setData(volumeData);
        
        // Обновление статуса
        updateStatus(symbol, currentData[currentData.length - 1].close);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showError('Не удалось загрузить данные');
    }
}

// Загрузка свечей с Binance
async function fetchKlines(symbol, interval, limit) {
    const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
}

// Обработка данных свечей
function processKlineData(klineData) {
    return klineData.map(k => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
    }));
}

// Расчет индикатора Trend_1H
function calculateIndicator() {
    if (currentData.length < 50) {
        console.warn('Недостаточно данных для расчета');
        return;
    }
    
    try {
        // Получение параметров
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        const atrMultiplier = parseFloat(document.getElementById('atrMultiplier').value) || 0.3;
        
        // Расчет ATR
        const atr = calculateATR(currentData, atrPeriod) * atrMultiplier;
        
        // Получение массивов цен
        const highs = currentData.map(d => d.high);
        const lows = currentData.map(d => d.low);
        const closes = currentData.map(d => d.close);
        
        // Расчет SMA
        const smaHighArray = calculateSMA(highs, trendLength);
        const smaLowArray = calculateSMA(lows, trendLength);
        
        const lastIndex = currentData.length - 1;
        const smaHigh = smaHighArray[lastIndex] + atr;
        const smaLow = smaLowArray[lastIndex] - atr;
        const lastClose = closes[lastIndex];
        
        // Определение тренда
        let trend = 'neutral';
        let signal = null;
        
        if (lastClose > smaHigh) {
            trend = 'up';
            if (indicatorState.trend !== 'up') {
                signal = 'UP';
            }
        } else if (lastClose < smaLow) {
            trend = 'down';
            if (indicatorState.trend !== 'down') {
                signal = 'DOWN';
            }
        }
        
        // Расчет целей
        const targets = calculateTargets(lastClose, atr, targetMultiplier, trend === 'up');
        
        // Обновление состояния
        indicatorState = {
            trend,
            smaHigh,
            smaLow,
            atr,
            currentPrice: lastClose,
            targets,
            lastSignal: signal,
            signalTime: signal ? new Date() : indicatorState.signalTime
        };
        
        // Обновление интерфейса
        updateIndicatorDisplay();
        drawIndicatorOnChart();
        
        // Показать сигнал
        if (signal) {
            showSignalAlert(signal, lastClose);
        }
        
    } catch (error) {
        console.error('Ошибка расчета индикатора:', error);
    }
}

// Расчет SMA
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(NaN);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            const sum = slice.reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
    }
    return sma;
}

// Расчет ATR
function calculateATR(data, period) {
    const trValues = [];
    
    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];
        
        const tr = Math.max(
            curr.high - curr.low,
            Math.abs(curr.high - prev.close),
            Math.abs(curr.low - prev.close)
        );
        trValues.push(tr);
    }
    
    if (trValues.length < period) return 0;
    
    // Первое значение ATR - среднее TR за период
    let atr = 0;
    for (let i = 0; i < period; i++) {
        atr += trValues[i];
    }
    atr /= period;
    
    // Последующие значения ATR
    for (let i = period; i < trValues.length; i++) {
        atr = (atr * (period - 1) + trValues[i]) / period;
    }
    
    return atr;
}

// Расчет целей
function calculateTargets(entryPrice, atr, multiplier, isUpTrend) {
    const sign = isUpTrend ? 1 : -1;
    const atrMultiplied = atr * (1 + multiplier * 0.1);
    
    return [
        {
            name: "Стоп-лосс",
            value: entryPrice - atrMultiplied * 2 * sign,
            type: "stop",
            color: config.colors.stopLoss
        },
        {
            name: "Цель 1",
            value: entryPrice + atrMultiplied * (5 + multiplier) * sign,
            type: "target",
            color: config.colors.target1
        },
        {
            name: "Цель 2",
            value: entryPrice + atrMultiplied * (10 + multiplier * 2) * sign,
            type: "target",
            color: config.colors.target2
        },
        {
            name: "Цель 3",
            value: entryPrice + atrMultiplied * (15 + multiplier * 4) * sign,
            type: "target",
            color: config.colors.target3
        },
        {
            name: "Цель 4",
            value: entryPrice + atrMultiplied * (20 + multiplier * 6) * sign,
            type: "target",
            color: config.colors.target4
        }
    ];
}

// Отрисовка индикатора на графике
function drawIndicatorOnChart() {
    // Очистка предыдущих линий
    targetLines.forEach(line => {
        chart.removeLineSeries(line);
    });
    targetLines = [];
    
    // Линия тренда
    const trendLineData = currentData.map((d, i) => ({
        time: d.time,
        value: indicatorState.trend === 'up' ? indicatorState.smaLow : indicatorState.smaHigh
    }));
    trendLineSeries.setData(trendLineData);
    
    // Линии целей
    indicatorState.targets.forEach((target, index) => {
        const lineSeries = chart.addLineSeries({
            color: target.color,
            lineWidth: 1,
            lineStyle: target.type === 'stop' ? 1 : 2,
            priceLineVisible: true,
            lastValueVisible: true,
        });
        
        const lineData = currentData.map(d => ({
            time: d.time,
            value: target.value
        }));
        
        lineSeries.setData(lineData);
        targetLines.push(lineSeries);
    });
    
    // Область между линиями
    drawTrendAreas();
}

// Отрисовка областей тренда
function drawTrendAreas() {
    // Здесь можно добавить логику для заливки областей между целями
    // Для Lightweight Charts потребуется дополнительная реализация
}

// Обновление отображения индикатора
function updateIndicatorDisplay() {
    const trendStatus = document.getElementById('trendStatus');
    const atrValue = document.getElementById('atrValue');
    const priceValue = document.getElementById('priceValue');
    const targetsGrid = document.getElementById('targetsGrid');
    
    // Тренд
    let trendText = '';
    let trendClass = '';
    
    switch (indicatorState.trend) {
        case 'up':
            trendText = '📈 ВОСХОДЯЩИЙ';
            trendClass = 'trend-up';
            break;
        case 'down':
            trendText = '📉 НИСХОДЯЩИЙ';
            trendClass = 'trend-down';
            break;
        default:
            trendText = '➖ НЕЙТРАЛЬНЫЙ';
            trendClass = 'trend-neutral';
    }
    
    trendStatus.textContent = trendText;
    trendStatus.className = `status-value ${trendClass}`;
    
    // ATR
    atrValue.textContent = indicatorState.atr.toFixed(4);
    
    // Цена
    priceValue.textContent = indicatorState.currentPrice.toFixed(4);
    
    // Цели
    targetsGrid.innerHTML = '';
    
    indicatorState.targets.forEach(target => {
        const targetItem = document.createElement('div');
        targetItem.className = 'target-item';
        targetItem.style.borderLeftColor = target.color;
        
        targetItem.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-price" style="color: ${target.color}">
                ${target.value.toFixed(4)}
            </div>
        `;
        
        targetsGrid.appendChild(targetItem);
    });
}

// Обновление статуса
function updateStatus(symbol, price) {
    const symbolStatus = document.getElementById('symbolStatus');
    const displaySymbol = symbol.replace('USDT', '/USDT');
    symbolStatus.textContent = displaySymbol;
    
    if (price) {
        document.getElementById('priceValue').textContent = price.toFixed(4);
    }
}

// Обновление графика
async function updateChart() {
    try {
        document.getElementById('loading').classList.remove('hidden');
        
        await loadInitialData();
        calculateIndicator();
        
        document.getElementById('loading').classList.add('hidden');
        
        // Обновление статуса в Telegram
        tg.HapticFeedback.impactOccurred('light');
        
    } catch (error) {
        console.error('Ошибка обновления графика:', error);
        document.getElementById('loading').classList.add('hidden');
        showError('Ошибка обновления графика');
    }
}

// Показать сигнал
function showSignalAlert(signal, price) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `signal-alert ${signal === 'DOWN' ? 'down' : ''}`;
    
    const symbol = document.getElementById('symbol').value;
    const displaySymbol = symbol.replace('USDT', '/USDT');
    
    alertDiv.innerHTML = `
        <strong>${signal === 'UP' ? '📈 ПОКУПКА' : '📉 ПРОДАЖА'}</strong>
        <div style="font-size: 12px; margin-top: 5px;">
            ${displaySymbol} по ${price.toFixed(4)}
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Вибрация
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }
    
    // Удалить через 5 секунд
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
    
    // Отправить уведомление в Telegram
    if (tg && tg.showAlert) {
        tg.showAlert(`${signal} сигнал на ${displaySymbol}`);
    }
}

// Поделиться сигналом
function shareSignal() {
    if (!indicatorState.trend) {
        showMessage('Нет активного сигнала');
        return;
    }
    
    const symbol = document.getElementById('symbol').value;
    const displaySymbol = symbol.replace('USDT', '/USDT');
    const signalText = indicatorState.trend === 'up' ? 'ПОКУПКА' : 'ПРОДАЖА';
    
    const message = `
🎯 *Trend_1H Сигнал* 🎯

*Пара:* ${displaySymbol}
*Сигнал:* ${signalText}
*Цена:* ${indicatorState.currentPrice.toFixed(4)}
*Тренд:* ${indicatorState.trend === 'up' ? 'Восходящий' : 'Нисходящий'}

*Цели:*
${indicatorState.targets.map(t => `${t.name}: ${t.value.toFixed(4)}`).join('\n')}

📊 *Trend_1H [☆GREAT ANNA☆]*
    `.trim();
    
    // Отправка через Telegram
    tg.sendData(JSON.stringify({
        type: 'signal',
        symbol: symbol,
        signal: signalText,
        price: indicatorState.currentPrice,
        trend: indicatorState.trend,
        targets: indicatorState.targets
    }));
    
    tg.showAlert('Сигнал отправлен!');
}

// Показать сообщение
function showMessage(text, type = 'info') {
    if (tg && tg.showAlert) {
        tg.showAlert(text);
    } else {
        alert(text);
    }
}

// Показать ошибку
function showError(text) {
    showMessage(`Ошибка: ${text}`);
}

// Автоматическое обновление
function startAutoUpdate() {
    // Обновление каждые 30 секунд
    setInterval(async () => {
        if (document.visibilityState === 'visible') {
            await updateChart();
        }
    }, 30000);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateChart();
        }
    });
}

// WebSocket для реального времени (опционально)
function startWebSocket() {
    const symbol = document.getElementById('symbol').value;
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1h`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.k && data.k.x) { // Если свеча закрылась
            updateChart();
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
    };
}

// Экспорт для отладки
window.app = {
    updateChart,
    calculateIndicator,
    getState: () => indicatorState
};
