/**
 * Cloudflare Workers + D1 数据库
 * 黄金价格监控 API
 */

export default {
    async fetch(request, env) {
        // 处理 CORS 预检请求
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // 路由分发
            if (path === '/api/price' && request.method === 'POST') {
                // 保存价格数据
                return await savePrice(request, env);
            } else if (path === '/api/prices' && request.method === 'GET') {
                // 获取历史价格数据
                return await getPrices(request, env);
            } else if (path === '/api/prices/latest' && request.method === 'GET') {
                // 获取最新的价格数据
                return await getLatestPrice(env);
            } else if (path === '/api/health' && request.method === 'GET') {
                // 健康检查
                return jsonResponse({ status: 'ok', message: 'API is running' });
            } else {
                return jsonResponse({ error: 'Not found' }, 404);
            }
        } catch (error) {
            console.error('API Error:', error);
            return jsonResponse({ error: error.message }, 500);
        }
    }
};

/**
 * 处理 CORS
 */
function handleCORS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}

/**
 * 返回 JSON 响应
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        }
    });
}

/**
 * 保存价格数据到数据库
 * POST /api/price
 * Body: {
 *   priceUsd: number,
 *   priceCny: number,
 *   exchangeRate: number,
 *   changePercent: number,
 *   changeAmount: number,
 *   closePrice: number,
 *   openPrice: number,
 *   timestamp: number
 * }
 */
async function savePrice(request, env) {
    try {
        const data = await request.json();

        // 验证必需字段
        const required = ['priceUsd', 'priceCny', 'exchangeRate', 'timestamp'];
        for (const field of required) {
            if (data[field] === undefined || data[field] === null) {
                return jsonResponse({ error: `Missing required field: ${field}` }, 400);
            }
        }

        // 插入数据
        const stmt = env.DB.prepare(`
            INSERT INTO gold_prices (
                price_usd, price_cny, exchange_rate,
                change_percent, change_amount, close_price, open_price,
                timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.bind(
            data.priceUsd,
            data.priceCny,
            data.exchangeRate,
            data.changePercent || null,
            data.changeAmount || null,
            data.closePrice || null,
            data.openPrice || null,
            data.timestamp
        ).run();

        return jsonResponse({
            success: true,
            message: 'Price saved successfully'
        });
    } catch (error) {
        console.error('Save price error:', error);
        return jsonResponse({ error: 'Failed to save price' }, 500);
    }
}

/**
 * 获取历史价格数据
 * GET /api/prices?hours=2&limit=1000
 */
async function getPrices(request, env) {
    try {
        const url = new URL(request.url);
        const hours = parseInt(url.searchParams.get('hours')) || 2;
        const limit = parseInt(url.searchParams.get('limit')) || 1000;

        // 计算时间范围（当前时间往前推N小时）
        const endTime = Date.now();
        const startTime = endTime - (hours * 60 * 60 * 1000);

        // 查询数据
        const stmt = env.DB.prepare(`
            SELECT
                price_usd as priceUsd,
                price_cny as priceCny,
                exchange_rate as exchangeRate,
                change_percent as changePercent,
                change_amount as changeAmount,
                close_price as closePrice,
                open_price as openPrice,
                timestamp
            FROM gold_prices
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
            LIMIT ?
        `);

        const result = await stmt.bind(startTime, limit).all();

        // 安全检查：确保 result 存在且有 results 属性
        if (!result || !result.results) {
            return jsonResponse({
                success: true,
                data: [],
                count: 0
            });
        }

        return jsonResponse({
            success: true,
            data: result.results,
            count: result.results.length
        });
    } catch (error) {
        console.error('Get prices error:', error);
        return jsonResponse({ error: 'Failed to get prices' }, 500);
    }
}

/**
 * 获取最新的价格数据
 * GET /api/prices/latest
 */
async function getLatestPrice(env) {
    try {
        const stmt = env.DB.prepare(`
            SELECT
                price_usd as priceUsd,
                price_cny as priceCny,
                exchange_rate as exchangeRate,
                change_percent as changePercent,
                change_amount as changeAmount,
                close_price as closePrice,
                open_price as openPrice,
                timestamp
            FROM gold_prices
            ORDER BY timestamp DESC
            LIMIT 1
        `);

        const result = await stmt.first();

        // 如果数据库中没有数据，返回空数组而不是错误
        if (!result) {
            return jsonResponse({
                success: true,
                data: null,
                message: 'No data found'
            });
        }

        return jsonResponse({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Get latest price error:', error);
        return jsonResponse({ error: 'Failed to get latest price' }, 500);
    }
}
