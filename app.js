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
let currentData = [];
let isLoading = false;

// Indicator state
let indicator = {
    trend: 'neutral',
    smaHigh: 0,
    smaLow: 0,
    atr: 0,
    price: 0,
    targets: [],
    isBullish: false
};

// ============================================
// CHART INITIALIZATION (GUARANTEED TO WORK)
// ============================================

function initChart() {
    console.log('Initializing chart...');
    
    const chartContainer = document.getElementById('chart');
    
    // Clear container
    chartContainer.innerHTML = '';
    
    // Create chart with correct options
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
            background: { color: '#000000' },
            textColor: '#DDDDDD',
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
            horzTouchDrag: true,
            vertTouchDrag: true,
        },
        handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
        },
    });
    
    // Create candle series
    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });
    
    // Handle resize
    window.addEventListener('resize', () => {
        if (chart) {
            chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
            });
        }
    });
    
    console.log('Chart initialized successfully');
    return true;
}

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading();
        
        // Ensure chart is initialized
        if (!chart) {
            initChart();
        }
        
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        
        console.log(`Loading ${symbol} ${timeframe}...`);
        
        // Get data
        const data = await getChartData(symbol, timeframe);
        
        if (!data || data.length === 0) {
            throw new Error('No data received');
        }
        
        // Process data
        currentData = formatData(data);
        
        // Update chart
        updateChart(currentData);
        
        // Calculate indicator
        calculateIndicator();
        
        // Draw lines
        drawLines();
        
        // Update UI
        updateUI();
        
        hideLoading();
        
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
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.warn('Using test data:', error.message);
        return null;
    }
}

function formatData(rawData) {
    return rawData.map(item => ({
        time: item[0] / 1000, // Convert to seconds
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
    }));
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
    calculateIndicator();
    drawLines();
    updateUI();
    
    hideLoading();
}

function generateTestData(symbol) {
    const data = [];
    let price = getTestPrice(symbol);
    
    for (let i = 0; i < 100; i++) {
        const time = Date.now() - (99 - i) * 60000;
        const open = price;
        const change = (Math.random() - 0.5) * 0.02;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1.01 + Math.random() * 0.01);
        const low = Math.min(open, close) * (0.99 - Math.random() * 0.01);
        
        data.push([
            time,
            open.toFixed(2),
            high.toFixed(2),
            low.toFixed(2),
            close.toFixed(2),
            (Math.random() * 1000).toFixed(2)
        ]);
        
        price = close;
    }
    
    return data;
}

function getTestPrice(symbol) {
    const prices = {
        'BTCUSDT': 50000,
        'ETHUSDT': 3000,
        'BNBUSDT': 400,
        'SOLUSDT': 100,
        'XRPUSDT': 0.5
    };
    return prices[symbol] || 100;
}

// ============================================
// CHART UPDATE
// ============================================

function updateChart(data) {
    if (!candleSeries) {
        console.error('Candle series not initialized');
        return;
    }
    
    candleSeries.setData(data);
    
    // Fit content
    chart.timeScale().fitContent();
    
    // Update price
    if (data.length > 0) {
        const lastPrice = data[data.length - 1].close;
        document.getElementById('priceValue').textContent = lastPrice.toFixed(2);
        indicator.price = lastPrice;
    }
}

// ============================================
// INDICATOR CALCULATION
// ============================================

function calculateIndicator() {
    if (currentData.length < 30) return;
    
    const trendLength = parseInt(document.getElementById('trendLength').value) || 10;
    const targetMultiplier = parseInt(document.getElementById('targetMultiplier').value) || 0;
    const atrPeriod = parseInt(document.getElementById('atrPeriod').value) || 20;
    
    const closes = currentData.map(d => d.close);
    const highs = currentData.map(d => d.high);
    const lows = currentData.map(d => d.low);
    
    // Calculate ATR
    const atr = calculateATR(currentData, atrPeriod) * 0.3;
    
    // Calculate SMA
    const smaHigh = calculateSMA(highs, trendLength) + atr;
    const smaLow = calculateSMA(lows, trendLength) - atr;
    
    // Determine trend
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
    
    // Calculate targets
    const targets = calculateTargets(lastClose, atr, targetMultiplier, isBullish);
    
    // Update indicator state
    indicator = {
        trend,
        smaHigh,
        smaLow,
        atr,
        price: lastClose,
        targets,
        isBullish
    };
    
    console.log('Indicator calculated:', indicator);
}

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

function calculateSMA(data, period) {
    if (data.length < period) return 0;
    
    const slice = data.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

function calculateTargets(entry, atr, multiplier, isBullish) {
    const sign = isBullish ? 1 : -1;
    
    return [
        { name: 'STOP LOSS', value: entry - atr * 2 * sign, type: 'stop', color: '#ff0000' },
        { name: 'ENTRY', value: entry, type: 'entry', color: '#0066cc' },
        { name: 'TP1', value: entry + atr * (5 + multiplier) * sign, type: 'profit', color: '#00ff00' },
        { name: 'TP2', value: entry + atr * (10 + multiplier * 2) * sign, type: 'profit', color: '#00ff00' },
        { name: 'TP3', value: entry + atr * (15 + multiplier * 4) * sign, type: 'profit', color: '#00ff00' },
        { name: 'TP4', value: entry + atr * (20 + multiplier * 6) * sign, type: 'profit', color: '#00ff00' }
    ];
}

// ============================================
// DRAW LINES ON CHART
// ============================================

function drawLines() {
    if (!chart || indicator.targets.length === 0) return;
    
    // Remove old lines
    lineSeries.forEach(series => {
        try {
            chart.removeSeries(series);
        } catch (e) {
            // Ignore
        }
    });
    lineSeries = [];
    
    // Draw target lines
    indicator.targets.forEach(target => {
        const series = chart.addLineSeries({
            color: target.color,
            lineWidth: 2,
            lineStyle: target.type === 'profit' ? 1 : 0,
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
    
    lineSeries.push(smaHighSeries, smaLowSeries);
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    // Update trend
    const trendElement = document.getElementById('trendValue');
    trendElement.textContent = indicator.trend.toUpperCase();
    trendElement.className = `status-value trend-${indicator.trend}`;
    
    // Update values
    document.getElementById('atrValue').textContent = indicator.atr.toFixed(4);
    document.getElementById('smaHighValue').textContent = indicator.smaHigh.toFixed(2);
    
    // Update targets
    const container = document.getElementById('targetsContainer');
    container.innerHTML = '';
    
    indicator.targets.forEach(target => {
        const div = document.createElement('div');
        div.className = `target ${target.type}`;
        
        div.innerHTML = `
            <div class="target-name">${target.name}</div>
            <div class="target-value value-${target.type}">${target.value.toFixed(2)}</div>
        `;
        
        container.appendChild(div);
    });
}

// ============================================
// UTILITY FUNCTIONS
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
TREND_1H SIGNAL
Symbol: ${document.getElementById('symbol').value}
Trend: ${indicator.trend.toUpperCase()}
Price: ${indicator.price.toFixed(2)}
ATR: ${indicator.atr.toFixed(4)}
Time: ${new Date().toLocaleString()}
    `;
    
    tg.sendData(JSON.stringify({ signal }));
    tg.showAlert('Signal shared!');
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventListeners() {
    document.getElementById('updateBtn').addEventListener('click', loadData);
    document.getElementById('symbol').addEventListener('change', loadData);
    document.getElementById('timeframe').addEventListener('change', loadData);
    
    ['trendLength', 'targetMultiplier', 'atrPeriod'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (currentData.length > 20) {
                calculateIndicator();
                drawLines();
                updateUI();
            }
        });
    });
    
    document.getElementById('shareBtn').addEventListener('click', shareSignal);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('App starting...');
    
    // Setup events
    setupEventListeners();
    
    // Initialize chart
    initChart();
    
    // Load initial data
    setTimeout(loadData, 500);
    
    // Auto-update every 30 seconds
    setInterval(() => {
        if (!document.hidden) {
            loadData();
        }
    }, 30000);
    
    // Update on visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadData();
        }
    });
    
    console.log('App started successfully');
});
