-- 黄金价格历史数据表
CREATE TABLE IF NOT EXISTS gold_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_usd REAL NOT NULL,           -- 国际金价（美元/盎司）
    price_cny REAL NOT NULL,           -- 国内金价（人民币/克）
    exchange_rate REAL NOT NULL,       -- 美元兑人民币汇率
    change_percent REAL,               -- 涨跌幅（%）
    change_amount REAL,                -- 价格变化（美元）
    close_price REAL,                  -- 前收盘价
    open_price REAL,                   -- 今日开盘价
    timestamp INTEGER NOT NULL,        -- 时间戳（毫秒）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- 数据创建时间
);

-- 创建索引，加快查询速度
CREATE INDEX IF NOT EXISTS idx_timestamp ON gold_prices(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_created_at ON gold_prices(created_at DESC);
