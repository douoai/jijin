/**
 * 黄金价格实时折线图应用
 * 功能：获取国际金价，转换为人民币/克，并实时显示折线图
 */

// ==================== 页面元素 ====================
const priceDisplay = document.getElementById('price-display'); // 价格显示元素
const priceTitle = document.querySelector('.price-title'); // 标题元素
const rateDisplay = document.getElementById('rate-display'); // 汇率显示元素
const xauPriceEl = document.getElementById('xau-price'); // 国际金价显示
const xauCloseEl = document.getElementById('xau-close'); // 前收盘价显示
const xauOpenEl = document.getElementById('xau-open'); // 今日开盘价显示
const xauPercentEl = document.getElementById('xau-percent'); // 黄金涨跌幅
const xauChangeEl = document.getElementById('xau-change'); // 价格变化显示
// 国内价格元素
const domesticPriceEl = document.getElementById('domestic-price'); // 国内金价
const domesticCloseEl = document.getElementById('domestic-close'); // 国内前收盘价
const domesticOpenEl = document.getElementById('domestic-open'); // 国内今日开盘
const domesticPercentEl = document.getElementById('domestic-percent'); // 国内涨跌幅
const domesticChangeEl = document.getElementById('domestic-change'); // 国内价格变化
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
let isLoading = true; // 是否正在加载（用于控制首���加载动画）
let lastUsdToRmbRate = 6.92; // 上次获取的美元兑人民币汇率
let lastGoldPriceUsd = null; // 上次的国际金价（美元/盎司）
let lastPriceChangePercent = null; // 上次的价格变化百分比
let lastSuccessfulData = null; // 上次成功的API数据（用于容错）
let priceHistory = []; // 价格历史数据数组 [{price, timestamp}, ...]
let myChart = null; // ECharts图表实例
let currentMetal = 'gold'; // 当前选择的金属类型
let currentTimePeriod = 'realtime'; // 当前选择的时间段
let todayOpenPrice = null; // 今日开盘价（美元，当天的第一个价格）
let lastDate = null; // 上次更新的日期

// ==================== API 配置 ====================
let API_BASE_URL = window.API_BASE_URL || 'http://localhost:8787';

// ==================== 金属配置 ====================
// 不同金属的基础价格配置（用于模拟其他金属价格）
const metalConfig = {
    gold: { name: '黄金', basePrice: 1087.13 },
    kgold: { name: 'K金', basePrice: 980.50 },
    platinum: { name: '铂金', basePrice: 1250.80 },
    silver: { name: '白银', basePrice: 4.25 }
};

/**
 * 从 D1 数据库加载价格历史数据
 * @returns {Promise<Array>} 历史数据数组
 */
async function loadFromDatabase() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/prices?hours=${MAX_HISTORY_HOURS}&limit=${MAX_DATA_COUNT}`);

        if (!response.ok) {
            console.error('API 返回错误:', response.status);
            return null;
        }

        const result = await response.json();

        if (result.success && result.data) {
            // 转换数据格式以兼容现有的图表代码
            const history = result.data.map(item => ({
                price: item.priceCny,
                timestamp: item.timestamp
            }));

            console.log(`从数据库加载了 ${history.length} 条数据`);
            return history;
        }

        return null;
    } catch (error) {
        console.error('从数据库加载数据失败', error);
        return null;
    }
}

/**
 * 保存价格数据到 D1 数据库
 */
async function saveToDatabase(priceData) {
    try {
        await fetch(`${API_BASE_URL}/api/price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(priceData)
        });
    } catch (error) {
        console.error('保存到数据库失败', error);
    }
}

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
            // 自定义提示框内容 - 第一行价格，第二行完整时间
            formatter: function(params) {
                const data = params[0];
                const value = data.data.value.toFixed(2);
                const timestamp = data.data.timestamp;

                // 格式化完整时间
                const date = new Date(timestamp);
                const timeStr = date.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });

                return `
                    <div style="padding: 10px 12px; background: rgba(0,0,0,0.95); border-radius: 6px; border: 1px solid #333;">
                        <div style="color: #ffd700; font-weight: bold; font-size: 16px; margin-bottom: 8px;">
                            ¥${value}/克
                        </div>
                        <div style="color: #ffd700; font-size: 13px;">
                            ${timeStr}
                        </div>
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
            symbol: 'none', // 不显示数据点
            showSymbol: false,
            // 简洁的线条样式 - 基金风格
            lineStyle: {
                color: '#FFD700', // 金色
                width: 2.5, // 适中的线条宽度
                shadowColor: 'rgba(255, 215, 0, 0.3)', // 柔和阴影
                shadowBlur: 8,
                shadowOffsetY: 3
            },
            // 区域填充 - 简洁渐变
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                        offset: 0, color: 'rgba(255, 215, 0, 0.25)' // 顶部淡金色
                    }, {
                        offset: 1, color: 'rgba(255, 215, 0, 0.02)' // 底部几乎透明
                    }]
                }
            },
            // 简单的入场动画
            animationDuration: 1000,
            animationEasing: 'linear',
            // 鼠标悬停效果
            emphasis: {
                focus: 'series',
                lineStyle: {
                    width: 3.5,
                    shadowColor: 'rgba(255, 215, 0, 0.5)',
                    shadowBlur: 15
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

    // 准备数据数组，每个元素包含价格和时间戳
    const seriesData = displayData.map(item => ({
        value: item.price,
        timestamp: item.timestamp
    }));

    // 首次有数据时隐藏加载动画
    if (isLoading && seriesData.length > 0) {
        isLoading = false;
        hideLoading();
    }

    // 准备时间标签数组 - 根据数据密度调整显示格式
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
            data: seriesData // 更新折线数据
        }]
    });
}

/**
 * 添加价格数据到历史记录
 * @param {number} price - 价格数值
 * @param {number} timestamp - 时间戳
 * @param {Object} apiData - 完整的API数据（用于保存到数据库）
 */
function addPriceData(price, timestamp, apiData = null) {
    // 添加新数据到历史记录
    priceHistory.push({
        price: price,
        timestamp: timestamp
    });

    // 如果数据点超过最大数量，删除最旧的数据
    if (priceHistory.length > MAX_DATA_COUNT) {
        priceHistory.shift();
    }

    // 保存到 D1 数据库（异步执行，不阻塞）
    if (apiData) {
        const priceData = {
            priceUsd: apiData.goldPriceUsd,
            priceCny: price,
            exchangeRate: apiData.usdToRmbRate,
            changePercent: apiData.goldPercent,
            changeAmount: apiData.goldChange,
            closePrice: apiData.goldClose,
            openPrice: apiData.todayOpenPrice,
            timestamp: timestamp
        };
        saveToDatabase(priceData);
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

    // 只在非黄金类型时生成模拟数据
    if (metalType !== 'gold') {
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
    // 黄金类型不生成模拟数据，使用真实API数据
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
 * 隐藏加载动画
 */
function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        // 等待过渡完成后从DOM中移除（可选）
        setTimeout(() => {
            if (loadingOverlay.parentNode) {
                loadingOverlay.style.display = 'none';
            }
        }, 500);
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

        // 3. 提取关��API数据
        const item = goldData.items[0];
        const goldPriceUsd = item.xauPrice; // 国际金价
        const goldChange = item.chgXau; // 黄金价格变化
        const goldPercent = item.pcXau; // 黄金涨跌幅
        const goldClose = item.xauClose; // 前收盘价

        // 4. 检查日期变化，确定今日开盘价
        const now = new Date();
        const currentDate = now.toDateString();

        // 如果是新的一天或者是第一次运行，记录开盘价
        if (lastDate !== currentDate) {
            if (lastDate === null) {
                // 第一次运行，使用当前价格作为开盘价
                todayOpenPrice = goldPriceUsd;
            } else {
                // 日期变化了，新的一天的第一个价格作为开盘价
                todayOpenPrice = goldPriceUsd;
            }
            lastDate = currentDate;
        }

        // 5. 计算人民币每克价格
        // 公式：国内金价（元/克）= 国际金价（美元/盎司）× 汇率 ÷ 31.1035
        let goldPriceRmbPerGram = (goldPriceUsd * usdToRmbRate) / 31.1035;

        // 6. 如果选择的是其他金属，使用模拟价格
        if (currentMetal !== 'gold') {
            const config = metalConfig[currentMetal];
            goldPriceRmbPerGram = config.basePrice + (Math.random() - 0.5) * config.basePrice * 0.01;
        }

        // 7. 检查价格是否有变化（避免重复数据）
        const lastPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : null;

        // 8. 更新上次价格记录
        lastGoldPriceUsd = goldPriceUsd;

        // 9. 只在价格变化时添加新数据到历史记录
        if (lastPrice === null || Math.abs(goldPriceRmbPerGram - lastPrice) > 0.01) {
            // 准备完整的API数据用于保存到数据库
            const apiData = {
                goldPriceUsd,
                usdToRmbRate,
                goldPercent,
                goldChange,
                goldClose,
                todayOpenPrice
            };
            addPriceData(goldPriceRmbPerGram, now.getTime(), apiData);
        }

        // 10. 更新页面价格显示
        priceDisplay.textContent = formatPrice(goldPriceRmbPerGram);

        // 11. 更新国际金价
        xauPriceEl.textContent = `${goldPriceUsd.toFixed(2)} USD/盎司`;

        // 12. 更新前收盘价
        xauCloseEl.textContent = `${goldClose.toFixed(2)} USD`;

        // 13. 更新今日开盘价
        if (todayOpenPrice) {
            xauOpenEl.textContent = `${todayOpenPrice.toFixed(2)} USD`;
        }

        // 14. 更新涨跌幅（带颜色）
        xauPercentEl.textContent = `${goldPercent >= 0 ? '+' : ''}${goldPercent.toFixed(2)}%`;
        xauPercentEl.className = goldPercent >= 0 ? 'info-value positive' : 'info-value negative';

        // 15. 更新价格变化（带颜色）
        xauChangeEl.textContent = `${goldChange >= 0 ? '+' : ''}${goldChange.toFixed(2)}`;
        xauChangeEl.className = goldChange >= 0 ? 'info-value positive' : 'info-value negative';

        // 16. 更新汇率（在价格下方显示）
        rateDisplay.textContent = `汇率: 1 USD = ${usdToRmbRate.toFixed(2)} CNY`;

        // 17. 更新本地时间（在汇率后面显示）
        const timeStr = now.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        localTimeEl.textContent = `更新时间: ${timeStr}`;

        // 18. 计算并更新第二行国内价格
        // 换算函数：美元/盎司 -> 人民币/克
        const usdToRmb = (usdPrice) => (usdPrice * usdToRmbRate) / 31.1035;

        // 国内金价
        domesticPriceEl.textContent = `${formatPrice(goldPriceRmbPerGram)} ¥/克`;

        // 国内前收盘价
        const domesticClosePrice = usdToRmb(goldClose);
        domesticCloseEl.textContent = `${formatPrice(domesticClosePrice)} ¥/克`;

        // 国内今日开盘
        let domesticOpenPrice = 0;
        if (todayOpenPrice) {
            domesticOpenPrice = usdToRmb(todayOpenPrice);
            domesticOpenEl.textContent = `${formatPrice(domesticOpenPrice)} ¥/克`;
        }

        // 国内涨跌幅（与国际金价相同）
        domesticPercentEl.textContent = `${goldPercent >= 0 ? '+' : ''}${goldPercent.toFixed(2)}%`;
        domesticPercentEl.className = goldPercent >= 0 ? 'info-value positive' : 'info-value negative';

        // 国内价格变化（美元转人民币）
        const domesticChange = usdToRmb(goldChange);
        domesticChangeEl.textContent = `${domesticChange >= 0 ? '+' : ''}${formatPrice(domesticChange)}`;
        domesticChangeEl.className = domesticChange >= 0 ? 'info-value positive' : 'info-value negative';

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
 * 初始化应用
 * 启动时执行，初始化所有功能模块
 */
async function init() {
    // 初始化图表
    initChart();

    // 初始化标签切换事件
    initTabEvents();

    // 从 D1 数据库加载历史数据
    try {
        const dbHistory = await loadFromDatabase();
        if (dbHistory && dbHistory.length > 0) {
            priceHistory = dbHistory;
            // 立即更新图表显示缓存的数据
            updateChart();
            console.log('已从数据库加载历史数据，图表将显示历史数据');
        } else {
            console.log('数据库中暂无历史数据，将开始收集新数据');
        }
    } catch (error) {
        console.error('加载历史数据失败，将开始收集新数据', error);
    }

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
