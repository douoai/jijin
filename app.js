// 黄金价格K线图应用

// 页面元素
const priceDisplay = document.getElementById('price-display');
const priceChangeElement = document.getElementById('price-change');
const updateTimeElement = document.getElementById('update-time');
const statusMessage = document.getElementById('status-message');
const chartContainer = document.getElementById('kline-chart');
const intervalButtons = document.querySelectorAll('.interval-btn');

// 配置
const REFRESH_INTERVAL = 5000; // 5秒刷新一次
const MAX_KLINE_COUNT = 200; // 最多显示的K线数量

// API URLs
const GOLD_API_URL = 'https://data-asg.goldprice.org/dbXRates/USD';
const USD_TO_RMB_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const BACKUP_USD_TO_RMB_API_URL = 'https://open.er-api.com/v6/latest/USD';

// 状态变量
let lastUsdToRmbRate = 7.2;
let lastGoldPriceUsd = null;
let lastPriceChangePercent = null;
let lastSuccessfulData = null;
let currentInterval = 1; // 当前选择的时间周期（分钟）
let priceHistory = []; // 存储价格历史数据
let currentKline = null; // 当前正在形成的K线
let myChart = null; // ECharts实例

// 初始化ECharts
function initChart() {
    myChart = echarts.init(chartContainer);

    const option = {
        title: {
            text: '黄金价格走势',
            left: 'center',
            textStyle: {
                fontSize: 16,
                color: '#333'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            },
            formatter: function(params) {
                const data = params[0];
                const klineData = data.value;
                return `
                    <div style="padding: 8px;">
                        <div style="font-weight: bold; margin-bottom: 5px;">${data.name}</div>
                        <div>开盘: ¥${klineData[1].toFixed(2)}</div>
                        <div>收盘: ¥${klineData[2].toFixed(2)}</div>
                        <div>最低: ¥${klineData[3].toFixed(2)}</div>
                        <div>最高: ¥${klineData[4].toFixed(2)}</div>
                        <div>涨跌幅: ${((klineData[2] - klineData[1]) / klineData[1] * 100).toFixed(2)}%</div>
                    </div>
                `;
            }
        },
        grid: {
            left: '3%',
            right: '3%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: [],
            axisLine: { lineStyle: { color: '#666' } },
            axisLabel: {
                rotate: 45,
                formatter: function(value) {
                    const date = new Date(value);
                    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                }
            }
        },
        yAxis: {
            type: 'value',
            scale: true,
            axisLine: { lineStyle: { color: '#666' } },
            splitLine: { lineStyle: { color: '#eee' } },
            axisLabel: {
                formatter: '¥{value}'
            }
        },
        dataZoom: [
            {
                type: 'inside',
                start: 50,
                end: 100
            },
            {
                show: true,
                type: 'slider',
                top: '92%',
                start: 50,
                end: 100
            }
        ],
        series: [{
            type: 'candlestick',
            data: [],
            itemStyle: {
                color: '#ef5350',
                color0: '#26a69a',
                borderColor: '#ef5350',
                borderColor0: '#26a69a'
            }
        }]
    };

    myChart.setOption(option);

    // 响应式调整
    window.addEventListener('resize', () => {
        myChart.resize();
    });
}

// 更新图表数据
function updateChart() {
    if (!myChart) return;

    const klineData = priceHistory.map(kline => [
        kline.timestamp,
        kline.open,
        kline.close,
        kline.low,
        kline.high
    ]);

    const categoryData = priceHistory.map(kline => {
        const date = new Date(kline.timestamp);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    });

    myChart.setOption({
        xAxis: {
            data: categoryData
        },
        series: [{
            data: klineData
        }]
    });
}

// 添加价格数据到历史记录
function addPriceData(price, timestamp) {
    const timeKey = getTimeKey(timestamp, currentInterval);

    // 如果是新的时间周期，完成上一根K线并创建新的
    if (!currentKline || currentKline.timeKey !== timeKey) {
        // 保存之前的K线
        if (currentKline) {
            priceHistory.push({
                ...currentKline
            });

            // 限制K线数量
            if (priceHistory.length > MAX_KLINE_COUNT) {
                priceHistory.shift();
            }
        }

        // 创建新K线
        currentKline = {
            timeKey: timeKey,
            timestamp: timestamp,
            open: price,
            close: price,
            high: price,
            low: price
        };
    } else {
        // 更新当前K线
        currentKline.close = price;
        currentKline.high = Math.max(currentKline.high, price);
        currentKline.low = Math.min(currentKline.low, price);
        currentKline.timestamp = timestamp;
    }

    updateChart();
}

// 根据时间周期获取时间键
function getTimeKey(timestamp, interval) {
    const date = new Date(timestamp);
    const minutes = Math.floor(date.getMinutes() / interval) * interval;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), minutes, 0).getTime();
}

// 格式化价格显示
function formatPrice(price) {
    return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 更新时间显示
function updateTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', { hour12: false });
    const dateString = now.toLocaleDateString('zh-CN');
    updateTimeElement.textContent = `更新时间: ${dateString} ${timeString}`;
}

// 获取美元兑人民币汇率
async function getUsdToRmbRate() {
    try {
        const response = await fetch(USD_TO_RMB_API_URL, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.rates && data.rates.CNY) {
                lastUsdToRmbRate = data.rates.CNY;
                return lastUsdToRmbRate;
            }
        }
        throw new Error('主要汇率API返回无效数据');
    } catch (error) {
        console.warn('主要汇率API失败，尝试备用API', error);

        try {
            const backupResponse = await fetch(BACKUP_USD_TO_RMB_API_URL);
            if (backupResponse.ok) {
                const backupData = await backupResponse.json();
                if (backupData && backupData.rates && backupData.rates.CNY) {
                    lastUsdToRmbRate = backupData.rates.CNY;
                    return lastUsdToRmbRate;
                }
            }
        } catch (backupError) {
            console.error('备用汇率API也失败了', backupError);
        }

        return lastUsdToRmbRate;
    }
}

// 获取黄金价格数据
async function getGoldPrice() {
    try {
        const response = await fetch(GOLD_API_URL, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API返回错误: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data.items || !data.items[0] || typeof data.items[0].xauPrice !== 'number') {
            throw new Error('API返回的数据格式无效');
        }

        lastSuccessfulData = data;
        return data;
    } catch (error) {
        console.error('获取黄金价格失败', error);

        if (lastSuccessfulData) {
            return lastSuccessfulData;
        }

        throw error;
    }
}

// 更新页面显示
async function updateDisplay() {
    try {
        statusMessage.textContent = '正在获取最新数据...';

        // 获取美元兑人民币汇率
        const usdToRmbRate = await getUsdToRmbRate();

        // 获取黄金价格数据
        const goldData = await getGoldPrice();

        // 提取黄金价格（美元/盎司）
        const goldPriceUsd = goldData.items[0].xauPrice;

        // 计算人民币每克价格
        const goldPriceRmbPerGram = (goldPriceUsd * usdToRmbRate) / 31.1035;

        // 计算价格变化百分比
        let priceChangePercent = 0;
        if (lastGoldPriceUsd !== null) {
            priceChangePercent = ((goldPriceUsd - lastGoldPriceUsd) / lastGoldPriceUsd) * 100;
        } else if (goldData.items[0].chgXau) {
            priceChangePercent = goldData.items[0].chgXau;
        }

        // 更新上次价格记录
        lastGoldPriceUsd = goldPriceUsd;
        lastPriceChangePercent = priceChangePercent;

        // 添加价格数据到历史记录
        const now = Date.now();
        addPriceData(goldPriceRmbPerGram, now);

        // 更新价格显示
        priceDisplay.textContent = `¥${formatPrice(goldPriceRmbPerGram)}/克`;

        // 更新价格变化显示
        const changePrefix = priceChangePercent >= 0 ? '+' : '';
        const changeClass = priceChangePercent >= 0 ? 'positive' : 'negative';
        priceChangeElement.textContent = `${changePrefix}${priceChangePercent.toFixed(2)}%`;
        priceChangeElement.className = `price-change ${changeClass}`;

        // 更新时间显示
        updateTimeDisplay();

        statusMessage.textContent = `已更新 | K线数量: ${priceHistory.length}`;

    } catch (error) {
        console.error('更新显示失败', error);
        statusMessage.textContent = '获取数据失败，显示缓存数据';
        updateTimeDisplay();
    }
}

// 切换时间周期
function switchInterval(interval) {
    if (currentInterval === interval) return;

    currentInterval = interval;

    // 清空历史数据并重新构建
    priceHistory = [];
    currentKline = null;

    // 从当前时间开始重新收集数据
    if (priceHistory.length === 0 && lastGoldPriceUsd !== null) {
        // 如果有当前价格，作为起点
        const usdToRmbRate = lastUsdToRmbRate;
        const goldPriceRmbPerGram = (lastGoldPriceUsd * usdToRmbRate) / 31.1035;
        addPriceData(goldPriceRmbPerGram, Date.now());
    }

    updateChart();
    statusMessage.textContent = `已切换到${interval}分钟K线`;

    // 更新按钮状态
    intervalButtons.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.interval) === interval) {
            btn.classList.add('active');
        }
    });
}

// 初始化应用
function init() {
    initChart();

    // 绑定时间周期按钮事件
    intervalButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const interval = parseInt(btn.dataset.interval);
            switchInterval(interval);
        });
    });

    // 立即更新一次
    updateDisplay();

    // 设置定时更新
    setInterval(updateDisplay, REFRESH_INTERVAL);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
