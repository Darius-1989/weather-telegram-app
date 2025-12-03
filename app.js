// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#000000');
tg.setBackgroundColor('#000000');

// Все фьючерсы Binance (топ 30)
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
let chartData = [];
let updateInterval = null;
let lastUpdateTime = null;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    console.log('⚡ TREND_1H FUTURES INITIALIZING...');
    
    // Заполняем список фьючерсов
    populateSymbols();
    
    // Инициализация элементов управления
    initControls();
    
    // Инициализация графика
    initChart();
    
    // Загрузка начальных данных
    await updateChart();
    
    // Запуск автообновления (каждую секунду)
    startAutoUpdate();
    
    // Обновляем время последнего обновления
    updateLastUpdateTime();
    
    console.log('✅ APP READY');
});

// Заполнение списка символов
function populateSymbols() {
    const select = document.getElementById('symbol');
    BINANCE_FUTURES.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = `${symbol.replace('USDT', '')}/USDT`;
        select.appendChild(option);
    });
}

// Инициализация элементов управления
function initControls() {
    // Кнопка обновления
    document.getElementById('updateBtn').addEventListener('click', async () => {
        await updateChart();
        tg.HapticFeedback.impactOccurred('light');
    });
    
    // Изменение символа
    document.getElementById('symbol').addEventListener('change', async () => {
        await updateChart();
    });
    
    // Изменение таймфрейма
    document.getElementById('timeframe').addEventListener('change', async () => {
        await updateChart();
    });
    
    // Кнопка поделиться
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    
    // Кнопка полноэкранного режима
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    
    // Изменение настроек в реальном времени
    ['trendLength', 'targetMult', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (chartData.length > 0) {
                calculateIndicator();
            }
        });
    });
}

// Инициализация графика Chart.js с киберпанк стилем
function initChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    
    // Регистрируем кастомный свечной график
    Chart.register({
        id: 'candlestick',
        beforeDraw: function(chart) {
            const ctx = chart.ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    });
    
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [{
                label: 'PRICE',
                data: [],
                borderColor: '#00ff00',
                backgroundColor: '#00ff00',
                borderWidth: 1,
                barPercentage: 0.9,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Убираем анимацию для скорости
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    borderColor: '#00ff00',
                    borderWidth: 1,
                    titleColor: '#00ff00',
                    bodyColor: '#00ff00',
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `O: ${point.o.toFixed(2)}`,
                                `H: ${point.h.toFixed(2)}`,
                                `L: ${point.l.toFixed(2)}`,
                                `C: ${point.c.toFixed(2)}`
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
                        color: 'rgba(0, 255, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#00ff00',
                        font: {
                            family: 'Orbitron',
                            size: 10
                        },
                        maxRotation: 0
                    }
                },
                y: {
                    position: 'right',
                    grid: {
                        color: 'rgba(0, 255, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#00ff00',
                        font: {
                            family: 'Orbitron',
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
}

// Получение данных с Binance Futures
async function fetchFuturesData(symbol, interval, limit = 100) {
    try {
        // Прямой запрос к Binance Futures API
        const response = await fetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.log('Futures API недоступен, используем спотовые данные...');
        
        // Запасной вариант: спотовые данные
        const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) {
            throw new Error(`Оба API недоступны: ${error.message}`);
        }
        
        return await response.json();
    }
}

// Обновление графика
async function updateChart() {
    try {
        showLoading();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`📊 Загрузка данных: ${symbol} ${timeframe}`);
        
        // Получение данных
        const data = await fetchFuturesData(symbol, timeframe, 100);
        
        if (!data || data.length === 0) {
            throw new Error('Нет данных');
        }
        
        // Обработка данных
        chartData = processData(data);
        
        // Обновление графика
        updateChartData(chartData);
        
        // Расчет индикатора
        calculateIndicator();
        
        // Обновление статуса
        updateStatus(symbol);
        
        hideLoading();
        
        // Вибрация при успешном обновлении
        tg.HapticFeedback.impactOccurred('light');
        
    } catch (error) {
        console.error('❌ Ошибка обновления:', error);
        showError(`Ошибка: ${error.message}`);
        hideLoading();
    }
}

// Обработка данных
function processData(rawData) {
    return rawData.map(item => ({
        x: new Date(item[0]),
        o: parseFloat(item[1]),
        h: parseFloat(item[2]),
        l: parseFloat(item[3]),
        c: parseFloat(item[4]),
        v: parseFloat(item[5])
    }));
}

// Обновление данных графика
function updateChartData(data) {
    // Обновляем основную серию
    chart.data.datasets[0].data = data.map(d => ({
        x: d.x,
        y: d.c,
        o: d.o,
        h: d.h,
        l: d.l,
        c: d.c
    }));
    
    // Обновляем цвета свечей
    chart.data.datasets[0].backgroundColor = data.map(d => 
        d.c >= d.o ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'
    );
    chart.data.datasets[0].borderColor = data.map(d => 
        d.c >= d.o ? '#00ff00' : '#ff0000'
    );
    
    chart.update('none');
    
    // Обновляем цену в статусе
    if (data.length > 0) {
        const lastPrice = data[data.length - 1].c;
        document.getElementById('priceStatus').textContent = lastPrice.toFixed(2);
    }
}

// Расчет индикатора Trend_1H
function calculateIndicator() {
    if (chartData.length < 30) return;
    
    try {
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMult = parseInt(document.getElementById('targetMult').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        
        // Получение массивов цен
        const prices = chartData.map(d => d.c);
        const highs = chartData.map(d => d.h);
        const lows = chartData.map(d => d.l);
        
        // Расчет ATR
        const atr = calculateATR(chartData, atrPeriod) * 0.3;
        
        // Расчет SMA
        const smaHigh = calculateSMA(highs, trendLength);
        const smaLow = calculateSMA(lows, trendLength);
        
        const lastIndex = chartData.length - 1;
        const smaHighLast = smaHigh[lastIndex] + atr;
        const smaLowLast = smaLow[lastIndex] - atr;
        const lastPrice = prices[lastIndex];
        
        // Определение тренда
        let trend = 'neutral';
        
        if (lastPrice > smaHighLast) {
            trend = 'up';
        } else if (lastPrice < smaLowLast) {
            trend = 'down';
        }
        
        // Расчет целей
        const targets = calculateTargets(lastPrice, atr, targetMult, trend === 'up');
        
        // Обновление отображения
        updateIndicatorDisplay(trend, atr, targets);
        
        // Отрисовка линий на графике
        drawIndicatorLines(smaHighLast, smaLowLast, targets, trend);
        
        // Проверка сигнала
        checkSignal(trend, lastPrice);
        
    } catch (error) {
        console.error('Ошибка расчета индикатора:', error);
    }
}

// Расчет SMA
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(data[i]); // Используем текущую цену пока нет достаточных данных
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            sma.push(sum / period);
        }
    }
    return sma;
}

// Расчет ATR
function calculateATR(data, period) {
    if (data.length < period + 1) return 0;
    
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
    
    // Первое значение ATR
    let atr = 0;
    for (let i = 0; i < period; i++) {
        atr += trValues[i];
    }
    atr /= period;
    
    // Последующие значения
    for (let i = period; i < trValues.length; i++) {
        atr = (atr * (period - 1) + trValues[i]) / period;
    }
    
    return atr;
}

// Расчет целей
function calculateTargets(price, atr, mult, isUp) {
    const sign = isUp ? 1 : -1;
    const atrMultiplied = atr * (1 + mult * 0.1);
    
    return [
        {
            name: 'STOP LOSS',
            value: price - atrMultiplied * 2 * sign,
            type: 'stop',
            color: '#ff0000'
        },
        {
            name: 'ENTRY POINT',
            value: price,
            type: 'entry',
            color: '#0088ff'
        },
        {
            name: 'TAKE PROFIT 1',
            value: price + atrMultiplied * (5 + mult) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TAKE PROFIT 2',
            value: price + atrMultiplied * (10 + mult * 2) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TAKE PROFIT 3',
            value: price + atrMultiplied * (15 + mult * 4) * sign,
            type: 'profit',
            color: '#00ff00'
        },
        {
            name: 'TAKE PROFIT 4',
            value: price + atrMultiplied * (20 + mult * 6) * sign,
            type: 'profit',
            color: '#00ff00'
        }
    ];
}

// Отрисовка линий индикатора
function drawIndicatorLines(smaHigh, smaLow, targets, trend) {
    // Удаляем старые линии
    while (chart.data.datasets.length > 1) {
        chart.data.datasets.pop();
    }
    
    // Линия SMA High
    chart.data.datasets.push({
        type: 'line',
        label: 'SMA HIGH',
        data: chartData.map(d => ({ x: d.x, y: smaHigh })),
        borderColor: '#00ff00',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
    });
    
    // Линия SMA Low
    chart.data.datasets.push({
        type: 'line',
        label: 'SMA LOW',
        data: chartData.map(d => ({ x: d.x, y: smaLow })),
        borderColor: '#ff0000',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
    });
    
    // Линии целей
    targets.forEach((target, index) => {
        chart.data.datasets.push({
            type: 'line',
            label: target.name,
            data: chartData.map(d => ({ x: d.x, y: target.value })),
            borderColor: target.color,
            borderWidth: 2,
            borderDash: target.type === 'profit' ? [3, 3] : [],
            pointRadius: 0,
            fill: false
        });
    });
    
    // Область между SMA High и SMA Low
    if (trend === 'up') {
        chart.data.datasets.push({
            type: 'line',
            label: 'TREND AREA',
            data: chartData.map(d => ({ x: d.x, y: smaHigh })),
            borderColor: 'rgba(0, 255, 0, 0.1)',
            backgroundColor: 'rgba(0, 255, 0, 0.05)',
            borderWidth: 0,
            pointRadius: 0,
            fill: {
                target: { value: smaLow },
                above: 'rgba(0, 255, 0, 0.05)',
                below: 'rgba(0, 255, 0, 0.05)'
            }
        });
    } else if (trend === 'down') {
        chart.data.datasets.push({
            type: 'line',
            label: 'TREND AREA',
            data: chartData.map(d => ({ x: d.x, y: smaLow })),
            borderColor: 'rgba(255, 0, 0, 0.1)',
            backgroundColor: 'rgba(255, 0, 0, 0.05)',
            borderWidth: 0,
            pointRadius: 0,
            fill: {
                target: { value: smaHigh },
                above: 'rgba(255, 0, 0, 0.05)',
                below: 'rgba(255, 0, 0, 0.05)'
            }
        });
    }
    
    chart.update('none');
}

// Обновление отображения индикатора
function updateIndicatorDisplay(trend, atr, targets) {
    const trendElement = document.getElementById('trendStatus');
    const atrElement = document.getElementById('atrStatus');
    const targetsGrid = document.getElementById('targetsGrid');
    
    // Обновление тренда
    let trendText = '';
    let trendClass = '';
    
    switch (trend) {
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
    atrElement.textContent = atr.toFixed(4);
    
    // Обновление целей
    targetsGrid.innerHTML = '';
    
    targets.forEach((target, index) => {
        const targetCard = document.createElement('div');
        targetCard.className = `target-card ${target.type}`;
        
        const priceClass = `price-${target.type}`;
        
        targetCard.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-price ${priceClass}">${target.value.toFixed(4)}</div>
        `;
        
        targetsGrid.appendChild(targetCard);
    });
}

// Обновление статуса
function updateStatus(symbol) {
    const displaySymbol = symbol.replace('USDT', '');
    document.title = `⚡ ${displaySymbol} | TREND_1H`;
}

// Проверка сигнала
function checkSignal(trend, price) {
    const lastSignal = localStorage.getItem('lastSignal');
    const lastSignalTrend = localStorage.getItem('lastSignalTrend');
    
    if (trend !== 'neutral' && lastSignalTrend !== trend) {
        showSignalAlert(trend, price);
        localStorage.setItem('lastSignal', Date.now());
        localStorage.setItem('lastSignalTrend', trend);
    }
}

// Показать сигнал
function showSignalAlert(trend, price) {
    const symbol = document.getElementById('symbol').value;
    const displaySymbol = symbol.replace('USDT', '');
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'signal-alert';
    
    alertDiv.innerHTML = `
        <div>${trend === 'up' ? '🚀 BUY SIGNAL' : '🔻 SELL SIGNAL'}</div>
        <div style="font-size: 12px; margin-top: 5px;">
            ${displaySymbol} @ ${price.toFixed(2)}
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Вибрация
    tg.HapticFeedback.impactOccurred('heavy');
    
    // Звуковое уведомление (если поддерживается)
    if (window.AudioContext || window.webkitAudioContext) {
        playSignalSound(trend);
    }
    
    // Удалить через 5 секунд
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Воспроизведение звука сигнала
function playSignalSound(trend) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = trend === 'up' ? 800 : 400;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
        
    } catch (error) {
        console.log('Звук недоступен:', error);
    }
}

// Запуск автообновления
function startAutoUpdate() {
    // Очищаем предыдущий интервал
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    // Обновление каждую секунду
    updateInterval = setInterval(() => {
        if (!document.hidden) {
            updateLastUpdateTime();
            // Обновляем данные каждые 30 секунд
            if (Date.now() - lastUpdateTime > 30000) {
                updateChart();
            }
        }
    }, 1000);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            updateChart();
        }
    });
}

// Обновление времени последнего обновления
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    document.getElementById('updateStatus').textContent = timeString;
    lastUpdateTime = Date.now();
}

// Переключение полноэкранного режима
function toggleFullscreen() {
    const container = document.querySelector('.container');
    
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.error('Ошибка полноэкранного режима:', err);
        });
    } else {
        document.exitFullscreen();
    }
    
    tg.HapticFeedback.impactOccurred('light');
}

// Поделиться сигналом
function shareSignal() {
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    const trend = document.getElementById('trendStatus').textContent;
    const price = document.getElementById('priceStatus').textContent;
    const atr = document.getElementById('atrStatus').textContent;
    
    const message = `
⚡ *TREND_1H SIGNAL* ⚡

*Symbol:* ${symbol.replace('USDT', '')}/USDT
*Timeframe:* ${timeframe}
*Trend:* ${trend}
*Price:* ${price}
*ATR:* ${atr}

*Signal generated by Trend_1H Futures System*
${new Date().toLocaleString()}

#Trading #Futures #${symbol.replace('USDT', '')}
    `.trim();
    
    tg.sendData(JSON.stringify({
        action: 'share_signal',
        message: message
    }));
    
    tg.showAlert('Signal shared to Telegram!');
    tg.HapticFeedback.impactOccurred('medium');
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
    alertDiv.style.background = 'linear-gradient(45deg, #000000, #ff0000)';
    alertDiv.style.borderColor = '#ff0000';
    alertDiv.textContent = `❌ ${message}`;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Экспорт для отладки
window.app = {
    updateChart,
    calculateIndicator,
    getState: () => ({
        symbol: document.getElementById('symbol').value,
        timeframe: document.getElementById('timeframe').value,
        dataLength: chartData.length
    })
};

console.log('🚀 Trend_1H Futures System Loaded');
