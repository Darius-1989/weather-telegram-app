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
let chartData = [];
let trendLines = [];
let targetLines = [];

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
    await updateChart();
    
    // Автообновление
    startAutoUpdate();
    
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
        await updateChart();
    });
    
    // Изменение символа
    document.getElementById('symbol').addEventListener('change', async () => {
        await updateChart();
    });
    
    // Изменение таймфрейма
    document.getElementById('timeframe').addEventListener('change', async () => {
        await updateChart();
    });
    
    // Изменение настроек индикатора
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (chartData.length > 20) {
                calculateIndicator();
                updateChartWithIndicators();
            }
        });
    });
    
    // Кнопка поделиться
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    
    // Кнопка полноэкранного режима
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
}

// Инициализация графика Chart.js
function initChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    
    // Уничтожаем старый график если есть
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(ctx, {
        type: 'candlestick',
        data: {
            datasets: [{
                label: 'Price',
                data: [],
                color: {
                    up: '#00ff00',
                    down: '#ff0000',
                    unchanged: '#cccccc'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `Open: ${point.o.toFixed(2)}`,
                                `High: ${point.h.toFixed(2)}`,
                                `Low: ${point.l.toFixed(2)}`,
                                `Close: ${point.c.toFixed(2)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm'
                        }
                    },
                    grid: {
                        color: '#333333',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 10
                        },
                        maxRotation: 0
                    }
                },
                y: {
                    position: 'right',
                    grid: {
                        color: '#333333',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    // Кастомный рендерер для свечей
    Chart.register({
        id: 'candlestick',
        beforeDraw: function(chart) {
            const ctx = chart.ctx;
            ctx.save();
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    });
}

// Обновление графика
async function updateChart() {
    try {
        showLoading();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`Loading data for ${symbol} ${timeframe}`);
        
        // Получение данных
        const data = await fetchChartData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received');
        }
        
        // Обработка данных
        chartData = processChartData(data);
        
        // Обновление данных графика
        updateChartData(chartData);
        
        // Расчет индикатора
        calculateIndicator();
        
        // Обновление графика с индикаторами
        updateChartWithIndicators();
        
        // Обновление статуса
        updateStatus();
        
        hideLoading();
        
    } catch (error) {
        console.error('Error updating chart:', error);
        showError(`Error: ${error.message}`);
        hideLoading();
    }
}

// Получение данных с Binance
async function fetchChartData(symbol, interval, limit = 100) {
    try {
        // Пробуем фьючерсы API
        const response = await fetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.log('Trying spot API...');
        
        // Запасной вариант: спотовые данные
        const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) {
            // Генерация тестовых данных
            return generateTestData();
        }
        
        return await response.json();
    }
}

// Генерация тестовых данных
function generateTestData() {
    const data = [];
    let price = 50000;
    const volatility = 0.02;
    
    for (let i = 0; i < 100; i++) {
        const timestamp = Date.now() - (100 - i) * 3600000;
        const open = price;
        const change = (Math.random() - 0.5) * volatility * 2;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * volatility);
        const low = Math.min(open, close) * (1 - Math.random() * volatility);
        
        data.push([
            timestamp,
            open.toFixed(2),
            high.toFixed(2),
            low.toFixed(2),
            close.toFixed(2),
            "0"
        ]);
        
        // Трендовая составляющая
        price = close;
    }
    
    return data;
}

// Обработка данных графика
function processChartData(rawData) {
    return rawData.map(item => ({
        time: item[0],
        x: new Date(item[0]),
        o: parseFloat(item[1]),
        h: parseFloat(item[2]),
        l: parseFloat(item[3]),
        c: parseFloat(item[4])
    }));
}

// Обновление данных графика
function updateChartData(data) {
    // Конвертируем данные для Chart.js
    const chartJsData = data.map(d => ({
        x: d.x,
        o: d.o,
        h: d.h,
        l: d.l,
        c: d.c
    }));
    
    chart.data.datasets[0].data = chartJsData;
    
    // Обновляем цену в статусе
    if (data.length > 0) {
        const lastPrice = data[data.length - 1].c;
        document.getElementById('priceStatus').textContent = lastPrice.toFixed(2);
        indicatorState.currentPrice = lastPrice;
    }
    
    // Обновляем график без индикаторов
    chart.update('none');
}

// Расчет индикатора Trend_1H (точная логика из Pine Script)
function calculateIndicator() {
    if (chartData.length < 30) return;
    
    try {
        // Получаем параметры
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        
        // Получаем массивы цен
        const closes = chartData.map(d => d.c);
        const highs = chartData.map(d => d.h);
        const lows = chartData.map(d => d.l);
        
        // 1. Расчет ATR по логике индикатора
        const atr = calculateATR(chartData, atrPeriod);
        const atrValue = calculateSMAValue(atr, atrPeriod) * 0.3;
        
        // 2. Расчет SMA High и SMA Low по логике индикатора
        const smaHigh = calculateSMAValue(highs, trendLength) + atrValue;
        const smaLow = calculateSMAValue(lows, trendLength) - atrValue;
        
        // 3. Определение тренда по логике индикатора
        const lastClose = closes[closes.length - 1];
        const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;
        
        let trend = 'neutral';
        let isBullish = false;
        let isBearish = false;
        
        // Логика определения тренда из Pine Script
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
        
        // Обновляем статус
        updateIndicatorDisplay();
        
    } catch (error) {
        console.error('Error calculating indicator:', error);
    }
}

// Расчет ATR по логике Pine Script
function calculateATR(data, period) {
    if (data.length < period + 1) return [];
    
    const trValues = [];
    
    for (let i = 1; i < data.length; i++) {
        const high = data[i].h;
        const low = data[i].l;
        const prevClose = data[i - 1].c;
        
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trValues.push(tr);
    }
    
    // SMA для ATR
    const atr = [];
    for (let i = period - 1; i < trValues.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += trValues[i - j];
        }
        atr.push(sum / period);
    }
    
    return atr;
}

// Расчет SMA значения
function calculateSMAValue(data, period) {
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

// Обновление графика с индикаторами
function updateChartWithIndicators() {
    // Удаляем старые линии индикаторов
    while (chart.data.datasets.length > 1) {
        chart.data.datasets.pop();
    }
    
    // Добавляем линии индикаторов если есть данные
    if (chartData.length > 0 && indicatorState.targets.length > 0) {
        const lastTime = chartData[chartData.length - 1].x;
        const firstTime = chartData[0].x;
        
        // Линия SMA High
        chart.data.datasets.push({
            type: 'line',
            label: 'SMA High',
            data: [
                { x: firstTime, y: indicatorState.smaHigh },
                { x: lastTime, y: indicatorState.smaHigh }
            ],
            borderColor: '#00ff00',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        // Линия SMA Low
        chart.data.datasets.push({
            type: 'line',
            label: 'SMA Low',
            data: [
                { x: firstTime, y: indicatorState.smaLow },
                { x: lastTime, y: indicatorState.smaLow }
            ],
            borderColor: '#ff0000',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        // Линии целей и стоп-лосса
        indicatorState.targets.forEach(target => {
            chart.data.datasets.push({
                type: 'line',
                label: target.name,
                data: [
                    { x: firstTime, y: target.value },
                    { x: lastTime, y: target.value }
                ],
                borderColor: target.color,
                borderWidth: 2,
                borderDash: target.type === 'profit' ? [3, 3] : [],
                pointRadius: 0,
                fill: false
            });
        });
        
        // Заливка области между SMA High и SMA Low
        if (indicatorState.isBullish) {
            chart.data.datasets.push({
                type: 'line',
                label: 'Bullish Area',
                data: [
                    { x: firstTime, y: indicatorState.smaHigh },
                    { x: lastTime, y: indicatorState.smaHigh }
                ],
                borderColor: 'rgba(0, 255, 0, 0.1)',
                backgroundColor: 'rgba(0, 255, 0, 0.05)',
                borderWidth: 0,
                pointRadius: 0,
                fill: {
                    target: { value: indicatorState.smaLow },
                    above: 'rgba(0, 255, 0, 0.05)',
                    below: 'rgba(0, 255, 0, 0.05)'
                }
            });
        } else if (indicatorState.isBearish) {
            chart.data.datasets.push({
                type: 'line',
                label: 'Bearish Area',
                data: [
                    { x: firstTime, y: indicatorState.smaLow },
                    { x: lastTime, y: indicatorState.smaLow }
                ],
                borderColor: 'rgba(255, 0, 0, 0.1)',
                backgroundColor: 'rgba(255, 0, 0, 0.05)',
                borderWidth: 0,
                pointRadius: 0,
                fill: {
                    target: { value: indicatorState.smaHigh },
                    above: 'rgba(255, 0, 0, 0.05)',
                    below: 'rgba(255, 0, 0, 0.05)'
                }
            });
        }
    }
    
    // Обновляем график
    chart.update('none');
}

// Обновление статуса
function updateStatus() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Запуск автообновления
function startAutoUpdate() {
    // Обновление данных каждые 30 секунд
    setInterval(() => {
        if (!document.hidden) {
            updateChart();
        }
    }, 30000);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            updateChart();
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
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'signal-alert';
    alertDiv.style.borderColor = '#ff0000';
    alertDiv.textContent = `❌ ${message}`;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}

// Адаптация графика при изменении размера
window.addEventListener('resize', () => {
    if (chart) {
        chart.resize();
    }
});
