// ============================================
// ИНИЦИАЛИЗАЦИЯ TELEGRAM WEB APP
// ============================================
const tg = window.Telegram.WebApp;

// Инициализация Telegram WebApp
function initTelegramApp() {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#1e293b');
    tg.setBackgroundColor('#0f172a');
    
    // Настройка основной кнопки
    tg.MainButton.setText("📈 Открыть в TradingView")
        .show()
        .onClick(() => {
            tg.openLink(`https://www.tradingview.com/chart/?symbol=BINANCE:${currentSymbol}`);
        });
    
    // Настройка задней кнопки
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        tg.close();
    });
    
    console.log('Telegram WebApp инициализирован');
}

// ============================================
// КОНФИГУРАЦИЯ И ПЕРЕМЕННЫЕ
// ============================================
const config = {
    apiUrl: 'https://api.binance.com/api/v3',
    wsUrl: 'wss://stream.binance.com:9443/ws',
    defaultSymbol: 'BTCUSDT',
    defaultTimeframe: '1h',
    maxBars: 200
};

let currentSymbol = config.defaultSymbol;
let currentTimeframe = config.defaultTimeframe;
let chartWidget = null;
let chartData = [];
let lastUpdateTime = 0;
let wsConnection = null;
let isChartReady = false;

// Состояние индикатора
let indicatorState = {
    trend: null,
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    targets: [],
    signal: null,
    lastSignalTime: null
};

// ============================================
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Приложение загружается...');
    
    try {
        // Инициализация Telegram
        initTelegramApp();
        
        // Инициализация элементов управления
        initializeControls();
        
        // Показать начальное состояние
        showMessage('Приложение загружается...', 'info');
        
        // Загрузка библиотеки TradingView
        await loadTradingViewLibrary();
        
        // Инициализация графика
        await initializeChart();
        
        // Запуск WebSocket для реальных данных
        startWebSocket();
        
        // Скрыть индикатор загрузки
        hideLoading();
        
        showMessage('График готов к использованию!', 'success');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError(`Ошибка загрузки: ${error.message}`);
    }
});

// ============================================
// УПРАВЛЕНИЕ ЭЛЕМЕНТАМИ ИНТЕРФЕЙСА
// ============================================
function initializeControls() {
    // Символы
    document.getElementById('symbolSelect').addEventListener('change', (e) => {
        currentSymbol = e.target.value;
        const displaySymbol = `${currentSymbol.replace('USDT', '')}/USDT`;
        document.getElementById('currentSymbol').textContent = displaySymbol;
        
        // Обновить график
        updateChart();
        
        // Переподключить WebSocket
        restartWebSocket();
        
        showMessage(`Символ изменен на ${displaySymbol}`, 'info');
    });

    // Таймфреймы
    document.getElementById('timeframeSelect').addEventListener('change', (e) => {
        currentTimeframe = e.target.value;
        const tfText = document.getElementById('timeframeSelect').options[document.getElementById('timeframeSelect').selectedIndex].text;
        document.getElementById('currentTF').textContent = tfText.split(' ')[0];
        
        updateChart();
        showMessage(`Таймфрейм изменен на ${tfText}`, 'info');
    });

    // Кнопка обновления
    document.getElementById('updateChartBtn').addEventListener('click', () => {
        updateChart();
        showMessage('График обновлен', 'success');
    });

    // Кнопка поделиться
    document.getElementById('shareBtn').addEventListener('click', () => {
        shareSignal();
    });

    // Кнопка полноэкранного режима
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        if (chartWidget) {
            chartWidget.chart().takeScreenshot();
        }
    });

    // Обновление настроек в реальном времени
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', debounce(() => {
            if (isChartReady) {
                calculateAndUpdateIndicator();
            }
        }, 500));
    });
}

// ============================================
// ЗАГРУЗКА TRADINGVIEW БИБЛИОТЕКИ
// ============================================
async function loadTradingViewLibrary() {
    return new Promise((resolve, reject) => {
        if (window.TradingView) {
            console.log('TradingView уже загружен');
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        
        script.onload = () => {
            console.log('TradingView библиотека загружена');
            resolve();
        };
        
        script.onerror = (error) => {
            console.error('Ошибка загрузки TradingView:', error);
            reject(new Error('Не удалось загрузить TradingView библиотеку'));
        };
        
        document.head.appendChild(script);
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ГРАФИКА TRADINGVIEW
// ============================================
async function initializeChart() {
    return new Promise((resolve) => {
        const widgetOptions = {
            symbol: `BINANCE:${currentSymbol}`,
            interval: currentTimeframe,
            container_id: 'tv_chart_container',
            theme: 'dark',
            style: '1',
            locale: 'ru',
            toolbar_bg: '#1e293b',
            enable_publishing: false,
            withdateranges: true,
            hide_side_toolbar: false,
            allow_symbol_change: true,
            save_image: false,
            details: true,
            hotlist: true,
            calendar: true,
            studies: [
                "MASimple@tv-basicstudies"
            ],
            timezone: 'Etc/UTC',
            disabled_features: [
                'use_localstorage_for_settings',
                'left_toolbar',
                'header_widget'
            ],
            enabled_features: [
                'study_templates',
                'side_toolbar_in_fullscreen_mode',
                'header_symbol_search'
            ],
            overrides: {
                "paneProperties.background": "#0f172a",
                "paneProperties.vertGridProperties.color": "#1e293b",
                "paneProperties.horzGridProperties.color": "#1e293b",
                "symbolWatermarkProperties.transparency": 90,
                "scalesProperties.textColor": "#94a3b8",
                "mainSeriesProperties.candleStyle.upColor": "#10b981",
                "mainSeriesProperties.candleStyle.downColor": "#ef4444",
                "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
                "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
                "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444"
            },
            custom_css_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
        };

        console.log('Инициализация TradingView виджета...');
        
        chartWidget = new TradingView.widget(widgetOptions);

        chartWidget.onChartReady(() => {
            console.log('График готов');
            isChartReady = true;
            
            // Настройка графика
            setupChart();
            
            // Загрузка исторических данных
            loadHistoricalData().then(() => {
                // Расчет индикатора
                calculateAndUpdateIndicator();
                
                // Создание пользовательского индикатора
                createCustomIndicator();
                
                resolve();
            }).catch(error => {
                console.error('Ошибка загрузки данных:', error);
                showError('Не удалось загрузить исторические данные');
                resolve();
            });
        });
    });
}

// ============================================
// НАСТРОЙКА ГРАФИКА
// ============================================
function setupChart() {
    if (!chartWidget || !isChartReady) return;

    try {
        const chart = chartWidget.chart();
        
        // Настройка отображения
        chart.setSymbol(`BINANCE:${currentSymbol}`, currentTimeframe, () => {
            console.log('Символ установлен:', currentSymbol);
        });
        
        // Подписка на события
        chart.onIntervalChanged().subscribe(null, (interval) => {
            currentTimeframe = interval;
            updateTimeframeDisplay();
            loadHistoricalData();
        });
        
        chart.onSymbolChanged().subscribe(null, (symbol) => {
            const newSymbol = symbol.split(':')[1];
            if (newSymbol !== currentSymbol) {
                currentSymbol = newSymbol;
                updateSymbolDisplay();
                loadHistoricalData();
                restartWebSocket();
            }
        });
        
    } catch (error) {
        console.error('Ошибка настройки графика:', error);
    }
}

// ============================================
// ЗАГРУЗКА ИСТОРИЧЕСКИХ ДАННЫХ
// ============================================
async function loadHistoricalData() {
    try {
        showLoading();
        
        const timeframeToInterval = {
            '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w'
        };
        
        const interval = timeframeToInterval[currentTimeframe] || '1h';
        const limit = config.maxBars;
        
        console.log(`Загрузка данных: ${currentSymbol}, ${interval}, ${limit} баров`);
        
        const response = await fetch(
            `${config.apiUrl}/klines?symbol=${currentSymbol}&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        chartData = data.map(item => ({
            time: item[0] / 1000,
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
        }));
        
        console.log(`Загружено ${chartData.length} баров данных`);
        
        // Обновить индикатор
        calculateAndUpdateIndicator();
        
    } catch (error) {
        console.error('Ошибка загрузки исторических данных:', error);
        showError(`Ошибка загрузки данных: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// ============================================
// РАСЧЕТ ИНДИКАТОРА TREND_1H
// ============================================
function calculateAndUpdateIndicator() {
    if (chartData.length < 50) {
        console.warn('Недостаточно данных для расчета индикатора');
        return;
    }

    try {
        // Получение параметров
        const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
        const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
        const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
        
        // Расчет ATR
        const atr = calculateATR(chartData, atrPeriod);
        const smoothedATR = atr * 0.3;
        
        // Получение массивов цен
        const highs = chartData.map(d => d.high);
        const lows = chartData.map(d => d.low);
        const closes = chartData.map(d => d.close);
        
        // Расчет SMA с учетом ATR
        const smaHighArray = calculateSMA(highs, trendLength);
        const smaLowArray = calculateSMA(lows, trendLength);
        
        const lastIndex = chartData.length - 1;
        const smaHigh = smaHighArray[lastIndex] + smoothedATR;
        const smaLow = smaLowArray[lastIndex] - smoothedATR;
        const lastClose = closes[lastIndex];
        
        // Определение тренда
        let trend = 'neutral';
        let signal = null;
        
        if (lastClose > smaHigh) {
            trend = 'up';
            if (!indicatorState.trend || indicatorState.trend === 'down') {
                signal = 'UP';
            }
        } else if (lastClose < smaLow) {
            trend = 'down';
            if (!indicatorState.trend || indicatorState.trend === 'up') {
                signal = 'DOWN';
            }
        }
        
        // Расчет целей
        const targets = calculateTargets(lastClose, smoothedATR, targetMultiplier, trend === 'up');
        
        // Обновление состояния
        indicatorState = {
            trend,
            smaHigh,
            smaLow,
            atr: smoothedATR,
            targets,
            signal,
            lastSignalTime: signal ? Date.now() : indicatorState.lastSignalTime
        };
        
        // Обновление интерфейса
        updateIndicatorDisplay();
        updateTargetsDisplay();
        
        // Отображение сигнала
        if (signal) {
            showSignalAlert(signal, lastClose);
        }
        
        // Отправка данных в Telegram
        sendDataToTelegram();
        
    } catch (error) {
        console.error('Ошибка расчета индикатора:', error);
        showError(`Ошибка расчета: ${error.message}`);
    }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ РАСЧЕТА
// ============================================
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

function calculateATR(data, period) {
    if (data.length < period + 1) return 0;
    
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
    
    // Простое скользящее среднее для ATR
    let atrSum = 0;
    for (let i = 0; i < period; i++) {
        atrSum += trValues[i] || 0;
    }
    
    return atrSum / period;
}

function calculateTargets(entryPrice, atr, multiplier, isUpTrend) {
    const sign = isUpTrend ? 1 : -1;
    const atrMultiplied = atr * (1 + multiplier * 0.1);
    
    return [
        {
            name: "Стоп-лосс",
            value: entryPrice - atrMultiplied * 2 * sign,
            type: "loss",
            level: 0
        },
        {
            name: "Цель 1",
            value: entryPrice + atrMultiplied * (5 + multiplier) * sign,
            type: "profit",
            level: 1
        },
        {
            name: "Цель 2",
            value: entryPrice + atrMultiplied * (10 + multiplier * 2) * sign,
            type: "profit",
            level: 2
        },
        {
            name: "Цель 3",
            value: entryPrice + atrMultiplied * (15 + multiplier * 4) * sign,
            type: "profit",
            level: 3
        },
        {
            name: "Цель 4",
            value: entryPrice + atrMultiplied * (20 + multiplier * 6) * sign,
            type: "profit",
            level: 4
        }
    ];
}

// ============================================
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
// ============================================
function updateIndicatorDisplay() {
    const indicator = document.getElementById('trendIndicator');
    const text = document.getElementById('trendText');
    const atrValue = document.getElementById('atrValue');
    
    // Обновление ATR
    atrValue.textContent = indicatorState.atr.toFixed(4);
    
    // Обновление тренда
    switch (indicatorState.trend) {
        case 'up':
            indicator.className = 'indicator-dot dot-up';
            text.textContent = '📈 ВОСХОДЯЩИЙ';
            text.style.color = '#22c55e';
            break;
        case 'down':
            indicator.className = 'indicator-dot dot-down';
            text.textContent = '📉 НИСХОДЯЩИЙ';
            text.style.color = '#ef4444';
            break;
        default:
            indicator.className = 'indicator-dot dot-neutral';
            text.textContent = '➖ НЕЙТРАЛЬНЫЙ';
            text.style.color = '#94a3b8';
    }
}

function updateTargetsDisplay() {
    const container = document.getElementById('targetsContainer');
    const grid = document.getElementById('targetsGrid');
    
    if (!indicatorState.targets || indicatorState.targets.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    grid.innerHTML = '';
    
    indicatorState.targets.forEach(target => {
        const div = document.createElement('div');
        div.className = 'target-item';
        
        const valueColor = target.type === 'profit' ? 'target-profit' : 'target-loss';
        const prefix = target.type === 'profit' ? '🎯' : '🛑';
        
        div.innerHTML = `
            <div class="target-label">${prefix} ${target.name}</div>
            <div class="target-value ${valueColor}">${target.value.toFixed(4)}</div>
        `;
        
        grid.appendChild(div);
    });
}

function updateSymbolDisplay() {
    const displaySymbol = `${currentSymbol.replace('USDT', '')}/USDT`;
    document.getElementById('currentSymbol').textContent = displaySymbol;
    document.getElementById('symbolSelect').value = currentSymbol;
}

function updateTimeframeDisplay() {
    const tfMap = {
        '1': '1m', '5': '5m', '15': '15m', '60': '1h',
        '240': '4h', 'D': '1d', 'W': '1w'
    };
    
    const reverseMap = Object.fromEntries(
        Object.entries(tfMap).map(([k, v]) => [v, k])
    );
    
    const select = document.getElementById('timeframeSelect');
    select.value = reverseMap[currentTimeframe] || '60';
    
    const tfText = select.options[select.selectedIndex].text;
    document.getElementById('currentTF').textContent = tfText.split(' ')[0];
}

// ============================================
// СОЗДАНИЕ КАСТОМНОГО ИНДИКАТОРА
// ============================================
function createCustomIndicator() {
    if (!chartWidget || !isChartReady) return;
    
    try {
        const chart = chartWidget.chart();
        
        // Создание пользовательского индикатора
        chart.createStudy('Awesome Oscillator', false, false, {
            'plot.color': '#3b82f6',
            'plot.linewidth': 2
        }, [
            { resolution: currentTimeframe, symbol: `BINANCE:${currentSymbol}` }
        ]);
        
        // Добавление скользящих средних
        const ma1 = chart.createStudy('Moving Average Exponential', false, false, {
            'length': 9,
            'color': '#22c55e',
            'linewidth': 1
        });
        
        const ma2 = chart.createStudy('Moving Average Exponential', false, false, {
            'length': 21,
            'color': '#ef4444',
            'linewidth': 1
        });
        
        console.log('Пользовательские индикаторы созданы');
        
    } catch (error) {
        console.error('Ошибка создания индикатора:', error);
    }
}

// ============================================
// WEBSOCKET ДЛЯ РЕАЛЬНОГО ВРЕМЕНИ
// ============================================
function startWebSocket() {
    try {
        if (wsConnection) {
            wsConnection.close();
        }
        
        const streamName = `${currentSymbol.toLowerCase()}@kline_${currentTimeframe}`;
        const wsUrl = `${config.wsUrl}/${streamName}`;
        
        wsConnection = new WebSocket(wsUrl);
        
        wsConnection.onopen = () => {
            console.log('WebSocket подключен:', streamName);
        };
        
        wsConnection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.k) {
                const kline = data.k;
                const newCandle = {
                    time: kline.t / 1000,
                    open: parseFloat(kline.o),
                    high: parseFloat(kline.h),
                    low: parseFloat(kline.l),
                    close: parseFloat(kline.c),
                    volume: parseFloat(kline.v),
                    isClosed: kline.x
                };
                
                // Обновление данных
                updateRealtimeData(newCandle);
                
                // Обновление индикатора если свеча закрылась
                if (newCandle.isClosed) {
                    calculateAndUpdateIndicator();
                }
            }
        };
        
        wsConnection.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };
        
        wsConnection.onclose = () => {
            console.log('WebSocket отключен');
            // Попытка переподключения через 5 секунд
            setTimeout(() => {
                if (isChartReady) {
                    startWebSocket();
                }
            }, 5000);
        };
        
    } catch (error) {
        console.error('Ошибка WebSocket:', error);
    }
}

function restartWebSocket() {
    if (wsConnection) {
        wsConnection.close();
    }
    setTimeout(startWebSocket, 1000);
}

function updateRealtimeData(newCandle) {
    if (!chartData.length) return;
    
    const lastCandle = chartData[chartData.length - 1];
    
    if (newCandle.time === lastCandle.time) {
        // Обновить текущую свечу
        chartData[chartData.length - 1] = newCandle;
    } else if (newCandle.time > lastCandle.time) {
        // Добавить новую свечу
        chartData.push(newCandle);
        
        // Ограничить количество баров
        if (chartData.length > config.maxBars) {
            chartData.shift();
        }
    }
}

// ============================================
// УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'block';
}

function hideLoading() {
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'none';
}

function showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 
                          type === 'success' ? 'success-message' : 'info-message';
    messageDiv.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(messageDiv);
    
    // Автоматическое скрытие
    if (type !== 'error') {
        setTimeout(() => {
            if (messageDiv.parentNode === container) {
                container.removeChild(messageDiv);
            }
        }, 3000);
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showSignalAlert(signal, price) {
    const signalText = signal === 'UP' ? '📈 ПОКУПКА' : '📉 ПРОДАЖА';
    const message = `${signalText} сигнал на ${currentSymbol} по цене ${price.toFixed(4)}`;
    
    showMessage(message, 'success');
    
    // Отправить уведомление в Telegram
    if (tg && tg.showAlert) {
        tg.showAlert(message);
    }
    
    // Вибрация на мобильных устройствах
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

// ============================================
// ФУНКЦИИ ОБНОВЛЕНИЯ ГРАФИКА
// ============================================
function updateChart() {
    if (!chartWidget || !isChartReady) return;
    
    showLoading();
    
    chartWidget.chart().setSymbol(`BINANCE:${currentSymbol}`, currentTimeframe, () => {
        loadHistoricalData().then(() => {
            calculateAndUpdateIndicator();
            createCustomIndicator();
        });
    });
}

// ============================================
// ИНТЕГРАЦИЯ С TELEGRAM
// ============================================
function shareSignal() {
    if (!indicatorState.trend) {
        showMessage('Нет активного сигнала для отправки', 'error');
        return;
    }
    
    const signalText = indicatorState.trend === 'up' ? '📈 ПОКУПКА' : '📉 ПРОДАЖА';
    const lastClose = chartData[chartData.length - 1].close;
    const targetsText = indicatorState.targets
        .map(t => `${t.name}: ${t.value.toFixed(4)}`)
        .join('\n');
    
    const message = `
🎯 *TREND_1H СИГНАЛ* 🎯

*Символ:* ${currentSymbol}
*Таймфрейм:* ${currentTimeframe}
*Сигнал:* ${signalText}
*Цена:* ${lastClose.toFixed(4)}

*Цели:*
${targetsText}

*Индикатор:* Trend_1H [☆GREAT ANNA☆]
*Время:* ${new Date().toLocaleTimeString()}

#Trading #Signal #${currentSymbol}
    `.trim();
    
    // Отправка через Telegram WebApp
    tg.sendData(JSON.stringify({
        action: 'share_signal',
        symbol: currentSymbol,
        signal: signalText,
        price: lastClose,
        trend: indicatorState.trend,
        targets: indicatorState.targets
    }));
    
    // Показать уведомление
    tg.showAlert('Сигнал отправлен в Telegram!');
    
    showMessage('Сигнал успешно отправлен!', 'success');
}

function sendDataToTelegram() {
    if (!tg || !indicatorState.trend) return;
    
    const data = {
        action: 'indicator_update',
        symbol: currentSymbol,
        timeframe: currentTimeframe,
        trend: indicatorState.trend,
        price: chartData[chartData.length - 1].close,
        atr: indicatorState.atr,
        timestamp: Date.now()
    };
    
    tg.sendData(JSON.stringify(data));
}

// ============================================
// ОБРАБОТЧИКИ ОШИБОК
// ============================================
window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
    showError(`Ошибка приложения: ${event.error.message}`);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Необработанное обещание:', event.reason);
    showError(`Ошибка обещания: ${event.reason}`);
});

// Экспорт для отладки
window.app = {
    updateChart,
    calculateAndUpdateIndicator,
    showMessage,
    showError,
    getState: () => ({
        symbol: currentSymbol,
        timeframe: currentTimeframe,
        indicator: indicatorState,
        dataLength: chartData.length
    })
};

console.log('Приложение инициализировано');
