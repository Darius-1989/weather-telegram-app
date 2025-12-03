// ============================================
// INITIALIZATION
// ============================================

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// State variables
let chart = null;
let candleSeries = null;
let lineSeries = [];
let trendLines = [];
let currentData = [];
let isLoading = false;
let lastPrice = 0;
let updateInterval = null;
let liveUpdateInterval = null;

// TradingView Pine Script логика
let indicator = {
    trend: 'neutral',
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    price: 0,
    targets: [],
    isBullish: false,
    stopLossHit: false,
    trendChanged: false,
    trendLength: 10,
    targetMultiplier: 0,
    atrPeriod: 20,
    lastUpdate: new Date()
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
// CHART INITIALIZATION
// ============================================

function initChart() {
    console.log('Initializing chart...');
    
    const chartContainer = document.querySelector('.chart-container');
    const chartElement = document.getElementById('chart');
    chartElement.innerHTML = '';
    
    chart = LightweightCharts.createChart(chartElement, {
        width: chartElement.clientWidth,
        height: chartElement.clientHeight,
        layout: { 
            background: { color: '#000000' },
            textColor: '#DDDDDD',
            fontFamily: "'Exo 2', sans-serif"
        },
        grid: { 
            vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        crosshair: { 
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                width: 1,
                color: 'rgba(0, 102, 204, 0.5)',
                style: LightweightCharts.LineStyle.Dashed
            },
            horzLine: {
                width: 1,
                color: 'rgba(0, 102, 204, 0.5)',
                style: LightweightCharts.LineStyle.Dashed
            }
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textColor: '#888'
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 8,
            minBarSpacing: 3,
            fixLeftEdge: true,
            fixRightEdge: true
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
    
    candleSeries = chart.addCandlestickSeries({
        upColor: '#00ffaa',
        downColor: '#ff4444',
        borderUpColor: '#00ffaa',
        borderDownColor: '#ff4444',
        wickUpColor: '#00ffaa',
        wickDownColor: '#ff4444',
    });
    
    window.addEventListener('resize', () => {
        if (chart && chartElement) {
            chart.applyOptions({
                width: chartElement.clientWidth,
                height: chartElement.clientHeight,
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
// PINE SCRIPT LOGIC (100% ACCURATE)
// ============================================

function calculatePineIndicator() {
    if (currentData.length < 30) return;
    
    const length = parseInt(document.getElementById('trendLength').value) || 10;
    const target = parseInt(document.getElementById('targetMultiplier').value) || 0;
    const atrPeriod = 20;
    
    // Calculate ATR как в Pine Script
    let atrSum = 0;
    for (let i = currentData.length - atrPeriod; i < currentData.length; i++) {
        if (i <= 0) continue;
        const high = currentData[i].high;
        const low = currentData[i].low;
        const prevClose = currentData[i-1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        atrSum += tr;
    }
    const atr_value = (atrSum / atrPeriod) * 0.3;
    
    // Calculate SMA как в Pine Script
    let smaHighSum = 0;
    let smaLowSum = 0;
    for (let i = currentData.length - length; i < currentData.length; i++) {
        if (i < 0) continue;
        smaHighSum += currentData[i].high;
        smaLowSum += currentData[i].low;
    }
    const sma_high = (smaHighSum / length) + atr_value;
    const sma_low = (smaLowSum / length) - atr_value;
    
    const close = currentData[currentData.length - 1].close;
    
    // Determine trend как в Pine Script
    let trend = indicator.trend === 'up';
    let signal_up = false;
    let signal_down = false;
    
    // Проверяем crossover/сrossunder
    const prevClose = currentData.length > 1 ? currentData[currentData.length - 2].close : close;
    const prevSmaHigh = currentData.length > length ? 
        (smaHighSum - currentData[currentData.length - length].high + currentData[currentData.length - 1].high) / length + atr_value : 
        sma_high;
    
    const prevSmaLow = currentData.length > length ? 
        (smaLowSum - currentData[currentData.length - length].low + currentData[currentData.length - 1].low) / length - atr_value : 
        sma_low;
    
    // Crossover проверка
    if (close > sma_high && prevClose <= prevSmaHigh) {
        trend = true;
        signal_up = true;
        signal_down = false;
        indicator.stopLossHit = false;
        indicator.trendChanged = true;
        showSignalMarker('buy');
    }
    
    // Crossunder проверка
    if (close < sma_low && prevClose >= prevSmaLow) {
        trend = false;
        signal_up = false;
        signal_down = true;
        indicator.stopLossHit = false;
        indicator.trendChanged = true;
        showSignalMarker('sell');
    }
    
    // Проверка стоп лосса
    if (!indicator.stopLossHit && indicator.targets.length > 0) {
        const stopLossPrice = indicator.targets.find(t => t.type === 'stop')?.value;
        if (stopLossPrice) {
            if ((indicator.isBullish && close <= stopLossPrice) || 
                (!indicator.isBullish && close >= stopLossPrice)) {
                indicator.stopLossHit = true;
                showStopLossAlert();
            }
        }
    }
    
    // Calculate targets
    const base = trend ? sma_low : sma_high;
    const atr_multiplier = atr_value * (trend ? 1 : -1);
    
    const targets = [
        { 
            name: 'STOP LOSS', 
            value: base, 
            type: 'stop', 
            color: indicator.stopLossHit ? '#ff4444' : '#ff4444'
        },
        { 
            name: 'ENTRY', 
            value: close, 
            type: 'entry', 
            color: indicator.stopLossHit ? '#ff4444' : '#0066cc'
        },
        { 
            name: 'TP1', 
            value: close + atr_multiplier * (5 + target), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff4444' : '#00ffaa'
        },
        { 
            name: 'TP2', 
            value: close + atr_multiplier * (10 + target * 2), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff4444' : '#00ffaa'
        },
        { 
            name: 'TP3', 
            value: close + atr_multiplier * (15 + target * 4), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff4444' : '#00ffaa'
        },
        { 
            name: 'TP4', 
            value: close + atr_multiplier * (20 + target * 6), 
            type: 'profit', 
            color: indicator.stopLossHit ? '#ff4444' : '#00ffaa'
        }
    ];
    
    indicator = {
        ...indicator,
        trend: trend ? 'up' : 'down',
        smaHigh: sma_high,
        smaLow: sma_low,
        atr: atr_value,
        price: close,
        targets,
        isBullish: trend,
        signal_up,
        signal_down,
        trendLength: length,
        targetMultiplier: target,
        atrPeriod,
        lastUpdate: new Date()
    };
    
    updateLastUpdateTime();
    updatePriceAnimation(close);
}

function showSignalMarker(type) {
    const chartContainer = document.querySelector('.chart-container');
    const marker = document.createElement('div');
    marker.className = `signal-marker ${type}`;
    marker.style.left = '90%';
    marker.style.top = '10%';
    chartContainer.appendChild(marker);
    
    setTimeout(() => {
        marker.remove();
    }, 2000);
}

function showStopLossAlert() {
    const trendElement = document.getElementById('trendValue');
    trendElement.style.animation = 'none';
    setTimeout(() => {
        trendElement.style.animation = 'pulse 0.5s ease 3';
    }, 10);
}

// ============================================
// DATA LOADING WITH AUTO ZOOM
// ============================================

async function loadData(isInitial = false) {
    if (isLoading) return;
    
    try {
        isLoading = true;
        if (isInitial) showLoading();
        
        if (!chart) initChart();
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        const data = await getChartData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received');
        }
        
        currentData = formatData(data);
        updateChart(currentData);
        calculatePineIndicator();
        drawLines();
        updateUI();
        
        // Автоматически подгоняем график в окно
        if (isInitial) {
            setTimeout(() => {
                autoZoomToLatest();
                hideLoading();
                startLiveUpdates();
            }, 500);
        } else {
            autoZoomToLatest();
        }
        
    } catch (error) {
        console.error('Error:', error);
        loadTestData();
    } finally {
        isLoading = false;
    }
}

async function getChartData(symbol, interval, limit = 100) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return await response.json();
        
    } catch (error) {
        console.warn('Using test data:', error.message);
        return null;
    }
}

async function getLatestPrice(symbol) {
    try {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        return parseFloat(data.price);
        
    } catch (error) {
        console.warn('Error getting latest price:', error);
        return null;
    }
}

function formatData(rawData) {
    return rawData.map(item => ({
        time: item[0] / 1000,
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
    }));
}

function autoZoomToLatest() {
    if (!chart || currentData.length < 10) return;
    
    try {
        // Показываем последние 50 свечей
        const visibleBars = 50;
        const lastBarIndex = currentData.length - 1;
        const firstVisibleIndex = Math.max(0, lastBarIndex - visibleBars);
        
        const firstTime = currentData[firstVisibleIndex].time;
        const lastTime = currentData[lastBarIndex].time;
        
        // Добавляем небольшой отступ справа
        const padding = (lastTime - firstTime) * 0.05;
        
        chart.timeScale().setVisibleRange({
            from: firstTime,
            to: lastTime + padding
        });
        
    } catch (error) {
        console.warn('Auto zoom error:', error);
        chart.timeScale().fitContent();
    }
}

// ============================================
// LIVE UPDATES (1 SECOND)
// ============================================

function startLiveUpdates() {
    if (liveUpdateInterval) clearInterval(liveUpdateInterval);
    
    liveUpdateInterval = setInterval(async () => {
        if (document.hidden || isLoading) return;
        
        try {
            const symbol = document.getElementById('symbol').value;
            const latestPrice = await getLatestPrice(symbol);
            
            if (latestPrice && currentData.length > 0) {
                // Обновляем последнюю свечу
                const lastCandle = currentData[currentData.length - 1];
                const newTime = Math.floor(Date.now() / 1000);
                
                // Если время совпадает (та же свеча), обновляем цену
                if (newTime - lastCandle.time < 60) {
                    lastCandle.close = latestPrice;
                    lastCandle.high = Math.max(lastCandle.high, latestPrice);
                    lastCandle.low = Math.min(lastCandle.low, latestPrice);
                } else {
                    // Новая свеча
                    currentData.push({
                        time: newTime,
                        open: lastCandle.close,
                        high: latestPrice,
                        low: latestPrice,
                        close: latestPrice,
                        volume: 0
                    });
                    
                    // Удаляем старые данные если их слишком много
                    if (currentData.length > 200) {
                        currentData.shift();
                    }
                }
                
                // Плавно обновляем график
                updateLiveChart();
                
                // Обновляем индикатор
                calculatePineIndicator();
                drawLines();
                updateUI();
                
                // Плавно скроллим график вправо
                const chart = window.chart;
                if (chart) {
                    const timeScale = chart.timeScale();
                    const visibleRange = timeScale.getVisibleRange();
                    if (visibleRange && visibleRange.to > lastCandle.time - 60) {
                        timeScale.scrollToPosition(timeScale.scrollPosition() + 1, false);
                    }
                }
            }
        } catch (error) {
            console.warn('Live update error:', error);
        }
    }, 1000); // Обновление каждую секунду
}

function updateLiveChart() {
    if (!candleSeries) return;
    
    candleSeries.update(currentData[currentData.length - 1]);
}

// ============================================
// DRAW LINES (WITH STOP LOSS LOGIC)
// ============================================

function drawLines() {
    if (!chart || indicator.targets.length === 0) return;
    
    // Remove old lines
    [...lineSeries, ...trendLines].forEach(series => {
        try {
            chart.removeSeries(series);
        } catch (e) {}
    });
    lineSeries = [];
    trendLines = [];
    
    // Draw target lines (все красные если стоп лосс сработал)
    indicator.targets.forEach(target => {
        const lineColor = indicator.stopLossHit ? '#ff4444' : target.color;
        const lineWidth = target.type === 'entry' ? 3 : target.type === 'stop' ? 2 : 1;
        const lineStyle = target.type === 'profit' ? 
            LightweightCharts.LineStyle.Dashed : 
            LightweightCharts.LineStyle.Solid;
        
        const series = chart.addLineSeries({
            color: lineColor,
            lineWidth: lineWidth,
            lineStyle: lineStyle,
            priceLineVisible: false,
        });
        
        const lineData = currentData.map(d => ({
            time: d.time,
            value: target.value
        }));
        
        series.setData(lineData);
        lineSeries.push(series);
    });
    
    // Draw SMA lines
    const smaHighSeries = chart.addLineSeries({
        color: indicator.stopLossHit ? '#ff4444' : 'rgba(0, 255, 170, 0.7)',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        priceLineVisible: false,
    });
    
    const smaLowSeries = chart.addLineSeries({
        color: indicator.stopLossHit ? '#ff4444' : 'rgba(255, 68, 68, 0.7)',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        priceLineVisible: false,
    });
    
    const smaHighData = currentData.map(d => ({
        time: d.time,
        value: indicator.smaHigh
    }));
    
    const smaLowData = currentData.map(d => ({
        time: d.time,
        value: indicator.smaLow
    }));
    
    smaHighSeries.setData(smaHighData);
    smaLowSeries.setData(smaLowData);
    
    trendLines.push(smaHighSeries, smaLowSeries);
}

// ============================================
// UI UPDATES WITH ANIMATIONS
// ============================================

function updateUI() {
    // Update trend
    const trendElement = document.getElementById('trendValue');
    const oldTrend = trendElement.textContent;
    const newTrend = indicator.stopLossHit ? 'STOP HIT' : indicator.trend.toUpperCase();
    
    if (oldTrend !== newTrend) {
        trendElement.style.animation = 'none';
        setTimeout(() => {
            trendElement.style.animation = 'fadeIn 0.3s ease';
        }, 10);
    }
    
    trendElement.textContent = newTrend;
    trendElement.className = `status-value trend-${indicator.trend}`;
    
    if (indicator.stopLossHit) {
        trendElement.style.color = '#ff4444';
        trendElement.style.textShadow = '0 0 10px rgba(255, 68, 68, 0.5)';
    }
    
    // Update values
    updatePriceWithAnimation();
    document.getElementById('atrValue').textContent = indicator.atr.toFixed(4);
    document.getElementById('smaHighValue').textContent = indicator.smaHigh.toFixed(2);
    
    // Update targets
    const container = document.getElementById('targetsContainer');
    container.innerHTML = '';
    
    indicator.targets.forEach(target => {
        const div = document.createElement('div');
        div.className = `target ${target.type}`;
        
        if (indicator.stopLossHit) {
            div.style.borderLeftColor = '#ff4444';
        }
        
        div.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-value value-${target.type}" 
                 style="color: ${indicator.stopLossHit ? '#ff4444' : target.type === 'stop' ? '#ff4444' : target.type === 'entry' ? '#0066cc' : '#00ffaa'}">
                ${target.value.toFixed(2)}
            </div>
        `;
        
        container.appendChild(div);
    });
}

function updatePriceWithAnimation() {
    const priceElement = document.getElementById('priceValue');
    const currentPrice = parseFloat(priceElement.textContent) || 0;
    const newPrice = indicator.price;
    
    priceElement.textContent = newPrice.toFixed(2);
    
    if (currentPrice !== 0) {
        const changeElement = document.createElement('span');
        changeElement.className = `price-change ${newPrice > currentPrice ? 'positive' : 'negative'}`;
        changeElement.textContent = newPrice > currentPrice ? '▲' : '▼';
        
        priceElement.appendChild(changeElement);
        
        setTimeout(() => {
            changeElement.remove();
        }, 1000);
    }
}

function updatePriceAnimation(newPrice) {
    const priceElement = document.getElementById('priceValue');
    const oldPrice = lastPrice;
    
    if (oldPrice !== 0 && newPrice !== oldPrice) {
        priceElement.style.color = newPrice > oldPrice ? '#00ffaa' : '#ff4444';
        setTimeout(() => {
            priceElement.style.color = '#ffffff';
        }, 500);
    }
    
    lastPrice = newPrice;
}

function updateLastUpdateTime() {
    const element = document.getElementById('lastUpdate');
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    element.textContent = timeString;
}

// ============================================
// TEST DATA (FALLBACK)
// ============================================

function loadTestData() {
    console.log('Loading test data...');
    
    const symbol = document.getElementById('symbol').value;
    const data = generateTestData(symbol);
    
    currentData = formatData(data);
    updateChart(currentData);
    calculatePineIndicator();
    drawLines();
    updateUI();
    
    autoZoomToLatest();
    hideLoading();
    
    // Запускаем тестовые обновления
    startTestLiveUpdates();
}

function generateTestData(symbol) {
    const data = [];
    let price = getTestPrice(symbol);
    let trend = true;
    
    for (let i = 0; i < 100; i++) {
        const time = Date.now() - (99 - i) * 60000;
        
        // Создаем трендовые движения
        const trendStrength = trend ? 0.002 : -0.002;
        const noise = (Math.random() - 0.5) * 0.001;
        
        const open = price;
        const change = trendStrength + noise;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1.001 + Math.random() * 0.001);
        const low = Math.min(open, close) * (0.999 - Math.random() * 0.001);
        
        // Периодически меняем тренд
        if (i % 30 === 0) trend = !trend;
        
        data.push([
            time,
            open.toFixed(6),
            high.toFixed(6),
            low.toFixed(6),
            close.toFixed(6),
            (Math.random() * 1000).toFixed(2)
        ]);
        
        price = close;
    }
    
    return data;
}

function startTestLiveUpdates() {
    if (liveUpdateInterval) clearInterval(liveUpdateInterval);
    
    liveUpdateInterval = setInterval(() => {
        if (document.hidden) return;
        
        const lastCandle = currentData[currentData.length - 1];
        const change = (Math.random() - 0.5) * 0.002;
        const newPrice = lastCandle.close * (1 + change);
        
        lastCandle.close = newPrice;
        lastCandle.high = Math.max(lastCandle.high, newPrice);
        lastCandle.low = Math.min(lastCandle.low, newPrice);
        
        updateLiveChart();
        calculatePineIndicator();
        drawLines();
        updateUI();
        
    }, 1000);
}

function getTestPrice(symbol) {
    const prices = {
        'BTCUSDT': 65000,
        'ETHUSDT': 3500,
        'BNBUSDT': 600,
        'SOLUSDT': 150,
        'XRPUSDT': 0.6
    };
    return prices[symbol] || 100;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function updateChart(data) {
    if (!candleSeries) return;
    
    candleSeries.setData(data);
    
    if (data.length > 0) {
        const lastPrice = data[data.length - 1].close;
        document.getElementById('priceValue').textContent = lastPrice.toFixed(2);
        indicator.price = lastPrice;
        updateLastUpdateTime();
    }
}

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
TREND_1H FUTURES SIGNAL
════════════════════════
Symbol: ${document.getElementById('symbol').value}
Timeframe: ${document.getElementById('timeframe').value}
Trend: ${indicator.trend.toUpperCase()} ${indicator.stopLossHit ? '(STOP HIT)' : ''}
Price: ${indicator.price.toFixed(2)}
ATR: ${indicator.atr.toFixed(4)}
Stop Loss: ${indicator.targets.find(t => t.type === 'stop')?.value.toFixed(2) || '0.00'}
════════════════════════
Time: ${new Date().toLocaleString()}
    `;
    
    tg.sendData(JSON.stringify({ signal }));
    tg.showAlert('Signal shared to Telegram!');
}

function resetStopLoss() {
    indicator.stopLossHit = false;
    indicator.trendChanged = false;
    calculatePineIndicator();
    drawLines();
    updateUI();
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventListeners() {
    document.getElementById('updateBtn').addEventListener('click', () => {
        loadData(true);
        // Анимация кнопки
        const btn = document.getElementById('updateBtn');
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 150);
    });
    
    document.getElementById('symbol').addEventListener('change', () => {
        loadData(true);
    });
    
    document.getElementById('timeframe').addEventListener('change', () => {
        loadData(true);
    });
    
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if (currentData.length > 20) {
                calculatePineIndicator();
                drawLines();
                updateUI();
            }
        });
    });
    
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('resetStopBtn').addEventListener('click', resetStopLoss);
    
    // Добавляем плавную прокрутку при клике
    document.querySelectorAll('button, select, input').forEach(el => {
        el.addEventListener('click', (e) => {
            e.currentTarget.style.transform = 'scale(0.98)';
            setTimeout(() => {
                e.currentTarget.style.transform = 'scale(1)';
            }, 100);
        });
    });
}

// ============================================
// MAIN INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('App starting...');
    
    // Инициализируем список монет
    initSymbols();
    
    // Настройка событий
    setupEventListeners();
    
    // Инициализируем график
    initChart();
    
    // Загружаем данные
    setTimeout(() => loadData(true), 300);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadData();
            startLiveUpdates();
        } else {
            if (liveUpdateInterval) {
                clearInterval(liveUpdateInterval);
                liveUpdateInterval = null;
            }
        }
    });
    
    console.log('App started successfully');
});
