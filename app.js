/**
 * 黄金价格实时折线图应用
 * 功能：获取国际金价，转换为人民币/克，并实时显示折线图
 */

// ==================== 页面元素 ====================
const priceDisplay = document.getElementById('price-display'); // 价��显示元素
const priceTitle = document.querySelector('.price-title'); // 标题元素
const xauPriceEl = document.getElementById('xau-price'); // 国际金价显示
const xauPercentEl = document.getElementById('xau-percent'); // 黄金涨跌幅
const rateValue = document.getElementById('rate-value'); // 汇率显示元素
const localTimeEl = document.getElementById('local-time'); // 本地时间
const chartContainer = document.getElementById('kline-chart'); // 图表容器

// ==================== 配置参数 ====================
const REFRESH_INTERVAL = 5000; // 价格刷新间隔：5秒
const MAX_HISTORY_HOURS = 2; // 保留最近2小时的历史数据
const MAX_DATA_COUNT = Math.floor((MAX_HISTORY_HOURS * 3600 * 1000) / REFRESH_INTERVAL); // 计算数据点数量
const CHART_DISPLAY_COUNT = MAX_DATA_COUNT; // 显示所有保存的数据点

// ==================== API接口地址 ====================
const GOLD_API_URL = 'https://data-asg.goldprice.org/dbXRates/USD'; // 国际金价API
const USD_TO_RMB_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD'; // 美元兑人民币汇率API（主）
const BACKUP_USD_TO_RMB_API_URL = 'https://open.er-api.com/v6/latest/USD'; // 汇率API（备用）

// ==================== 全局状态变量 ====================
let lastUsdToRmbRate = 6.92; // 上次获取的美元兑人民币汇率
let lastGoldPriceUsd = null; // 上次的国际金价（美元/盎司）
let lastPriceChangePercent = null; // 上次的价格变化百分比
let lastSuccessfulData = null; // 上次成功的API数据（用于容错）
let priceHistory = []; // 价格历史数据数组 [{price, timestamp}, ...]
let myChart = null; // ECharts图表实例
let currentMetal = 'gold'; // 当前选择的金属类型
let currentTimePeriod = 'realtime'; // 当前选择的时间段

// ==================== 金属配置 ====================
// 不同金属的基础价格配置（用于模拟其他金属价格）
const metalConfig = {
    gold: { name: '黄金', basePrice: 1087.13 },
    kgold: { name: 'K金', basePrice: 980.50 },
    platinum: { name: '铂金', basePrice: 1250.80 },
    silver: { name: '白银', basePrice: 4.25 }
};

/**
 * 初始化ECharts折线图
 * 配置图表样式、坐标轴、提示框等
 */
function initChart() {
    myChart = echarts.init(chartContainer);

    const option = {
        backgroundColor: 'transparent', // 背景透明
        grid: {
            left: '5%',
            right: '5%',
            bottom: '10%',
            top: '10%',
            containLabel: true // 包含坐标轴标签
        },
        tooltip: {
            trigger: 'axis', // 坐标轴触发
            axisPointer: {
                type: 'line',
                lineStyle: {
                    color: '#ffd700',
                    width: 1,
                    type: 'dashed'
                }
            },
            // 自定义提示框内容
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
            type: 'category', // 类目轴
            data: [],
            axisLine: { show: false }, // 隐藏轴线
            axisTick: { show: false }, // 隐藏刻度
            axisLabel: { show: false }, // 隐藏标签
            boundaryGap: false // 两端留白
        },
        yAxis: {
            type: 'value', // 数值轴
            scale: true, // 不从0开始
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false }, // 隐藏网格线
            axisLabel: { show: false }
        },
        series: [{
            type: 'line', // 折线图
            data: [],
            smooth: true, // 平滑曲线
            symbol: 'circle', // 数据点形状
            symbolSize: 4,
            showSymbol: false, // 默认不显示数据点
            lineStyle: {
                color: '#ffd700', // 金色线条
                width: 2.5,
                shadowColor: 'rgba(255, 215, 0, 0.5)', // 阴影效果
                shadowBlur: 10,
                shadowOffsetY: 5
            },
            itemStyle: {
                color: '#ffd700',
                borderColor: '#ffd700',
                borderWidth: 2
            },
            areaStyle: { // 区域填充样式
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                        offset: 0, color: 'rgba(255, 215, 0, 0.35)' // 顶部渐变
                    }, {
                        offset: 0.5, color: 'rgba(255, 215, 0, 0.15)' // 中部渐变
                    }, {
                        offset: 1, color: 'rgba(255, 215, 0, 0.02)' // 底部渐变
                    }]
                }
            }
        }]
    };

    myChart.setOption(option);

    // 监听窗口大小变化，自动调整图表尺寸
    window.addEventListener('resize', () => {
        myChart.resize();
    });
}

/**
 * 更新图表数据
 * 从priceHistory中提取数据并更新图表
 * 显示最近2小时的数据点
 */
function updateChart() {
    if (!myChart) return;

    // 只获取最近的数据点
    const displayData = priceHistory.slice(-CHART_DISPLAY_COUNT);

    // 准备价格数据数组
    const priceData = displayData.map(item => item.price);

    // 准���时间标签数组 - 根据数据密度调整显示格式
    const categoryData = displayData.map((item, index) => {
        const date = new Date(item.timestamp);

        // 每隔一定数量的数据点显示一次时间（避免标签重叠）
        // 1440个数据点，每120个点显示一次标签（约10分钟）
        const showLabelInterval = Math.max(1, Math.floor(displayData.length / 12));

        if (index % showLabelInterval === 0 || index === displayData.length - 1) {
            return date.toLocaleString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            return ''; // 中间的点不显示标签
        }
    });

    // 更新图表配置
    myChart.setOption({
        xAxis: {
            data: categoryData // 更新X轴数据
        },
        series: [{
            data: priceData // 更新Y轴数据
        }]
    });
}

/**
 * 添加价格数据到历史记录
 * @param {number} price - 价格数值
 * @param {number} timestamp - 时间戳
 */
function addPriceData(price, timestamp) {
    // 添加新数据到历史记录
    priceHistory.push({
        price: price,
        timestamp: timestamp
    });

    // 如果数据点超过最大数量，删除最旧的数据
    if (priceHistory.length > MAX_DATA_COUNT) {
        priceHistory.shift();
    }

    // 更新图表显示
    updateChart();
}

/**
 * 格式化价格显示
 * @param {number} price - 原始价格
 * @returns {string} 格式化后的价格（保留两位小数）
 */
function formatPrice(price) {
    return price.toFixed(2);
}

/**
 * 切换金属类型
 * @param {string} metalType - 金属类型 ('gold', 'kgold', 'platinum', 'silver')
 */
function switchMetal(metalType) {
    currentMetal = metalType;
    const config = metalConfig[metalType];

    // 更新页面标题
    priceTitle.textContent = `${config.name}价格`;

    // 获取基础价格
    const basePrice = config.basePrice;
    priceDisplay.textContent = formatPrice(basePrice);

    // 清空历史数据并重新生成模拟数据
    priceHistory = [];
    const now = Date.now();
    // 生成100个历史数据点，每分钟一个
    for (let i = 100; i >= 0; i--) {
        const timestamp = now - i * 60000; // 每分钟一个数据点
        const variation = (Math.random() - 0.5) * basePrice * 0.02; // ±1% 的随机波动
        priceHistory.push({
            price: basePrice + variation,
            timestamp: timestamp
        });
    }

    // 更新图表显示
    updateChart();
}

/**
 * 切换时间段
 * @param {string} period - 时间段 ('realtime', '1month', '3month', '1year')
 */
function switchTimePeriod(period) {
    currentTimePeriod = period;

    // 根据时间段筛选数据
    let filteredHistory = [...priceHistory];
    const now = Date.now();

    switch(period) {
        case 'realtime':
            // 显示所有数据（实时模式）
            break;
        case '1month':
            // 显示近一个月的数据（30天）
            filteredHistory = priceHistory.filter(item => now - item.timestamp <= 30 * 24 * 60 * 60 * 1000);
            break;
        case '3month':
            // 显示近三个月的数据（90天）
            filteredHistory = priceHistory.filter(item => now - item.timestamp <= 90 * 24 * 60 * 60 * 1000);
            break;
        case '1year':
            // 显示近一年的数据（365天）
            filteredHistory = priceHistory.filter(item => now - item.timestamp <= 365 * 24 * 60 * 60 * 1000);
            break;
    }

    // 临时更新图表显示（不影响原始数据）
    const tempHistory = priceHistory;
    priceHistory = filteredHistory;
    updateChart();
    priceHistory = tempHistory; // 恢复原始数据
}

/**
 * 获取美元兑人民币汇率
 * 优先使用主API，失败时使用备用API，都失败则使用上次缓存的汇率
 * @returns {Promise<number>} 汇率数值
 */
async function getUsdToRmbRate() {
    try {
        // 尝试使用主API
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
            // 尝试使用备用API
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

        // 所有API都失败，返回上次缓存的汇率
        return lastUsdToRmbRate;
    }
}

/**
 * 获取黄金价格数据
 * 从API获取国际金价，失败时返回上次缓存的数据
 * @returns {Promise<Object>} 黄金价格数据对象
 */
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

        // 验证数据格式
        if (!data || !data.items || !data.items[0] || typeof data.items[0].xauPrice !== 'number') {
            throw new Error('API返回的数据格式无效');
        }

        // 缓存成功的数据
        lastSuccessfulData = data;
        return data;
    } catch (error) {
        console.error('获取黄金价格失败', error);

        // 如果有上次成功的数据，返回缓存数据
        if (lastSuccessfulData) {
            return lastSuccessfulData;
        }

        throw error;
    }
}

/**
 * 更新页面显示
 * 核心函数：获取汇率、金价、计算人民币价格并更新显示
 * 计算公式：国内金价（元/克）= 国际金价（美元/盎司）× 汇率 ÷ 31.1035
 */
async function updateDisplay() {
    try {
        // 1. 获取美元兑人民币汇率
        const usdToRmbRate = await getUsdToRmbRate();

        // 2. 获取黄金价格数据
        const goldData = await getGoldPrice();

        // 3. 提取关键API数据
        const item = goldData.items[0];
        const goldPriceUsd = item.xauPrice; // 国际金价
        const goldPercent = item.pcXau; // 黄金涨跌幅

        // 4. 计算人民币每克价格
        // 公式：国内金价（元/克）= 国际金价（美元/盎司）× 汇率 ÷ 31.1035
        let goldPriceRmbPerGram = (goldPriceUsd * usdToRmbRate) / 31.1035;

        // 5. 如果选择的是其他金属，使用模拟价格
        if (currentMetal !== 'gold') {
            const config = metalConfig[currentMetal];
            goldPriceRmbPerGram = config.basePrice + (Math.random() - 0.5) * config.basePrice * 0.01;
        }

        // 6. 更新上次价格记录
        lastGoldPriceUsd = goldPriceUsd;

        // 7. 添加新价格到历史记录
        const now = Date.now();
        addPriceData(goldPriceRmbPerGram, now);

        // 8. 更新页面价格显示
        priceDisplay.textContent = formatPrice(goldPriceRmbPerGram);

        // 9. 更新国际金价
        xauPriceEl.textContent = `${goldPriceUsd.toFixed(2)} USD/盎司`;

        // 10. 更新涨跌幅（带颜色）
        xauPercentEl.textContent = `${goldPercent >= 0 ? '+' : ''}${goldPercent.toFixed(2)}%`;
        xauPercentEl.className = goldPercent >= 0 ? 'info-value positive' : 'info-value negative';

        // 11. 更新汇率
        rateValue.textContent = `1 USD = ${usdToRmbRate.toFixed(2)} CNY`;

        // 12. 更新本地时间
        localTimeEl.textContent = new Date(now).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

    } catch (error) {
        console.error('更新显示失败', error);
    }
}

/**
 * 初始化标签切换事件
 * 包括时间段标签切换功能
 */
function initTabEvents() {
    // 时间段标签切换事件
    const timeTabs = document.querySelectorAll('.time-tab');
    timeTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有标签的active类
            timeTabs.forEach(t => t.classList.remove('active'));
            // 为当前点击的标签添加active类
            this.classList.add('active');
            // 切换到对应的时间段
            const period = this.getAttribute('data-period');
            switchTimePeriod(period);
        });
    });
}

/**
 * 全屏功能切换
 * 仅对图表容器进行全屏显示，而不是整个页面
 */
function toggleFullscreen() {
    const chartElement = document.getElementById('kline-chart');
    if (!document.fullscreenElement) {
        // 进入全屏模式
        chartElement.requestFullscreen().catch(err => {
            console.error('进入全屏失败:', err);
        });
    } else {
        // 退出全屏模式
        document.exitFullscreen();
    }
}

/**
 * 更新全屏按钮图标
 * 根据当前全屏状态切换图标样式
 */
function updateFullscreenIcon() {
    const icon = document.getElementById('fullscreen-icon');
    const btn = document.getElementById('fullscreen-btn');

    if (document.fullscreenElement) {
        // 显示退出全屏图标
        icon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
        btn.setAttribute('title', '退出全屏');
    } else {
        // 显示进入全屏图标
        icon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
        btn.setAttribute('title', '全屏');
    }
}

/**
 * 初始化全屏功能
 * 绑定全屏按钮点击事件和全屏状态变化监听
 */
function initFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // 监听全屏状态变化事件
    document.addEventListener('fullscreenchange', function() {
        // 更新按钮图标
        updateFullscreenIcon();
        // 延迟调用resize，确保全屏过渡完成后再调整图表尺寸
        setTimeout(() => {
            if (myChart) {
                myChart.resize();
            }
        }, 100);
    });
}

/**
 * 初始化应用
 * 启动时执行，初始化所有功能模块
 */
function init() {
    // 初始化图表
    initChart();

    // 初始化标签切换事件
    initTabEvents();

    // 初始化全屏功能
    initFullscreen();

    // 初始化黄金数据
    switchMetal('gold');

    // 立即执行一次价格更新
    updateDisplay();

    // 设置定时刷新（每5秒更新一次）
    setInterval(updateDisplay, REFRESH_INTERVAL);
}

// ==================== 应用启动 ====================
// 等待DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', init);
