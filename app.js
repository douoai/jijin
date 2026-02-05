// ��金价格实时折线图应用

// 页面元素
const priceDisplay = document.getElementById('price-display');
const priceTitle = document.querySelector('.price-title');
const chartContainer = document.getElementById('kline-chart');

// 配置
const REFRESH_INTERVAL = 5000; // 5秒刷新一次
const MAX_DATA_COUNT = 200; // 最多显示的数据点数量

// API URLs
const GOLD_API_URL = 'https://data-asg.goldprice.org/dbXRates/USD';
const USD_TO_RMB_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const BACKUP_USD_TO_RMB_API_URL = 'https://open.er-api.com/v6/latest/USD';

// 状态变量
let lastUsdToRmbRate = 6.92;
let lastGoldPriceUsd = null;
let lastPriceChangePercent = null;
let lastSuccessfulData = null;
let priceHistory = []; // 存储价格历史数据 {price, timestamp}
let myChart = null; // ECharts实例
let currentMetal = 'gold'; // 当前选择的金属
let currentTimePeriod = 'realtime'; // 当前选择的时间段

// 金属配置
const metalConfig = {
    gold: { name: '黄金', basePrice: 1087.13 },
    kgold: { name: 'K金', basePrice: 980.50 },
    platinum: { name: '铂金', basePrice: 1250.80 },
    silver: { name: '白银', basePrice: 4.25 }
};

// 初始化ECharts
function initChart() {
    myChart = echarts.init(chartContainer);

    const option = {
        backgroundColor: 'transparent',
        grid: {
            left: '5%',
            right: '5%',
            bottom: '10%',
            top: '10%',
            containLabel: true
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                lineStyle: {
                    color: '#ffd700',
                    width: 1,
                    type: 'dashed'
                }
            },
            formatter: function(params) {
                const data = params[0];
                const value = data.value.toFixed(2);
                return `
                    <div style="padding: 8px; background: rgba(0,0,0,0.9); border-radius: 4px;">
                        <div style="color: #ffd700; font-weight: bold; margin-bottom: 5px;">${data.name}</div>
                        <div style="color: #fff;">价格: <span style="color: #ffd700;">¥${value}</span>/克</div>
                    </div>
                `;
            },
            backgroundColor: 'transparent',
            borderColor: 'transparent'
        },
        xAxis: {
            type: 'category',
            data: [],
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { show: false },
            boundaryGap: false
        },
        yAxis: {
            type: 'value',
            scale: true,
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false }
        },
        series: [{
            type: 'line',
            data: [],
            smooth: true,
            symbol: 'circle',
            symbolSize: 4,
            showSymbol: false,
            lineStyle: {
                color: '#ffd700',
                width: 2.5,
                shadowColor: 'rgba(255, 215, 0, 0.5)',
                shadowBlur: 10,
                shadowOffsetY: 5
            },
            itemStyle: {
                color: '#ffd700',
                borderColor: '#ffd700',
                borderWidth: 2
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                        offset: 0, color: 'rgba(255, 215, 0, 0.35)'
                    }, {
                        offset: 0.5, color: 'rgba(255, 215, 0, 0.15)'
                    }, {
                        offset: 1, color: 'rgba(255, 215, 0, 0.02)'
                    }]
                }
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

    // 准备数据
    const priceData = priceHistory.map(item => item.price);
    const categoryData = priceHistory.map(item => {
        const date = new Date(item.timestamp);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    });

    myChart.setOption({
        xAxis: {
            data: categoryData
        },
        series: [{
            data: priceData
        }]
    });
}

// 添加价格数据到历史记录
function addPriceData(price, timestamp) {
    // 添加到历史记录
    priceHistory.push({
        price: price,
        timestamp: timestamp
    });

    // 限制数据点数量
    if (priceHistory.length > MAX_DATA_COUNT) {
        priceHistory.shift();
    }

    updateChart();
}

// 格式化价格显示
function formatPrice(price) {
    return price.toFixed(2);
}

// 切换金属类型
function switchMetal(metalType) {
    currentMetal = metalType;
    const config = metalConfig[metalType];

    // 更新标题
    priceTitle.textContent = `${config.name}价格`;

    // 模拟不同金属的价格变化
    const basePrice = config.basePrice;
    priceDisplay.textContent = formatPrice(basePrice);

    // 清空并重新生成历史数据
    priceHistory = [];
    const now = Date.now();
    for (let i = 100; i >= 0; i--) {
        const timestamp = now - i * 60000; // 每分钟一个数据点
        const variation = (Math.random() - 0.5) * basePrice * 0.02; // ±1% 的波动
        priceHistory.push({
            price: basePrice + variation,
            timestamp: timestamp
        });
    }

    updateChart();
}

// 切换时间段
function switchTimePeriod(period) {
    currentTimePeriod = period;

    // 根据时间段筛选数据
    let filteredHistory = [...priceHistory];
    const now = Date.now();

    switch(period) {
        case 'realtime':
            // 显示所有数据（实时）
            break;
        case '1month':
            // 显示近一个月的数据
            filteredHistory = priceHistory.filter(item => now - item.timestamp <= 30 * 24 * 60 * 60 * 1000);
            break;
        case '3month':
            // 显示近三个月的数据
            filteredHistory = priceHistory.filter(item => now - item.timestamp <= 90 * 24 * 60 * 60 * 1000);
            break;
        case '1year':
            // 显示近一年的数据
            filteredHistory = priceHistory.filter(item => now - item.timestamp <= 365 * 24 * 60 * 60 * 1000);
            break;
    }

    // 临时更新图表显示
    const tempHistory = priceHistory;
    priceHistory = filteredHistory;
    updateChart();
    priceHistory = tempHistory;
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
        // 获取美元兑人民币汇率
        const usdToRmbRate = await getUsdToRmbRate();

        // 获取黄金价格数据
        const goldData = await getGoldPrice();

        // 提取黄金价格（美元/盎司）
        const goldPriceUsd = goldData.items[0].xauPrice;

        // 计算人民币每克价格
        let goldPriceRmbPerGram = (goldPriceUsd * usdToRmbRate) / 31.1035;

        // 根据当前金属类型调整价格
        if (currentMetal !== 'gold') {
            const config = metalConfig[currentMetal];
            goldPriceRmbPerGram = config.basePrice + (Math.random() - 0.5) * config.basePrice * 0.01;
        }

        // 更新上次价格记录
        lastGoldPriceUsd = goldPriceUsd;

        // 添加价格数据到历史记录
        const now = Date.now();
        addPriceData(goldPriceRmbPerGram, now);

        // 更新价格显示
        priceDisplay.textContent = formatPrice(goldPriceRmbPerGram);

    } catch (error) {
        console.error('更新显示失败', error);
    }
}

// 初始化标签切换事件
function initTabEvents() {
    // 时间标签切换
    const timeTabs = document.querySelectorAll('.time-tab');
    timeTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有active类
            timeTabs.forEach(t => t.classList.remove('active'));
            // 添加active类到当前标签
            this.classList.add('active');
            // 切换时间段
            const period = this.getAttribute('data-period');
            switchTimePeriod(period);
        });
    });

    // 订阅按钮
    const subscribeBtn = document.querySelector('.subscribe-btn');
    subscribeBtn.addEventListener('click', function() {
        const isSubscribed = this.classList.contains('subscribed');
        if (isSubscribed) {
            this.classList.remove('subscribed');
            this.querySelector('span:last-child').textContent = '订阅';
            this.style.backgroundColor = '#ffd700';
        } else {
            this.classList.add('subscribed');
            this.querySelector('span:last-child').textContent = '已订阅';
            this.style.backgroundColor = '#4caf50';
        }
    });
}

// 全屏功能 - 仅对��表容器全屏
function toggleFullscreen() {
    const chartElement = document.getElementById('kline-chart');
    if (!document.fullscreenElement) {
        chartElement.requestFullscreen().catch(err => {
            console.error('进入全屏失败:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// 更新全屏按钮图标
function updateFullscreenIcon() {
    const icon = document.getElementById('fullscreen-icon');
    const btn = document.getElementById('fullscreen-btn');

    if (document.fullscreenElement) {
        // 退出全屏图标
        icon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
        btn.setAttribute('title', '退出全屏');
    } else {
        // 进入全屏图标
        icon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
        btn.setAttribute('title', '全屏');
    }
}

// 初始化全屏功能
function initFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', function() {
        updateFullscreenIcon();
        // 延迟调用resize，确保全屏过渡完成后再调整图表尺寸
        setTimeout(() => {
            if (myChart) {
                myChart.resize();
            }
        }, 100);
    });
}

// 初始化应用
function init() {
    initChart();
    initTabEvents();
    initFullscreen();

    // 初始化黄金数据
    switchMetal('gold');

    // 立即更新一次
    updateDisplay();

    // 设置定时更新
    setInterval(updateDisplay, REFRESH_INTERVAL);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
