# 黄金价格监控 - D1 数��库集成指南

本指南将帮助您部署 Cloudflare Workers + D1 数据库后端。

## 前置要求

1. **Node.js** (建议 v16 或更高版本)
2. **npm** (随 Node.js 一起安装)
3. **Cloudflare 账号** (免费账号即可)

## 第一步：安装 Wrangler CLI

```bash
npm install -g wrangler
```

## 第二步：登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器让您授权。

## 第三步：创建 D1 数据库

```bash
wrangler d1 create gold-price-db
```

**重要：** 复制命令输出中的 `database_id`，例如：
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 第四步：更新 wrangler.toml

打开 `wrangler.toml` 文件，将 `your-database-id` 替换为刚才复制的真实数据库 ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "gold-price-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 替换这里
```

## 第五步：创建数据库表

```bash
npm run d1:execute
```

或者：
```bash
wrangler d1 execute gold-price-db --file=schema.sql
```

## 第六步：本地测试（可选）

```bash
npm run dev
```

访问 http://localhost:8787/api/health 检查是否运行正常。

## 第七步：部署到 Cloudflare

```bash
npm run deploy
```

部署成功后，您会看到类似这样的输出：
```
Published gold-price-monitor
  https://gold-price-monitor.your-subdomain.workers.dev
```

**复制您的 Workers URL，** 例如：
```
https://gold-price-monitor.abc123.workers.dev
```

## 第八步：配置前端

打开 `index.html`，找到 `<script>` 标签前添加：

```html
<script>
    // 配置后端 API 地址
    const API_BASE_URL = 'https://gold-price-monitor.abc123.workers.dev';
</script>
```

将 URL 替换为您第七步部署的真实地址。

## API 接口说明

### 1. 保存价格数据
```
POST /api/price
Content-Type: application/json

{
  "priceUsd": 2850.50,
  "priceCny": 650.23,
  "exchangeRate": 7.24,
  "changePercent": 0.5,
  "changeAmount": 14.25,
  "closePrice": 2836.25,
  "openPrice": 2840.00,
  "timestamp": 1704067200000
}
```

### 2. 获取历史价格
```
GET /api/prices?hours=2&limit=1000
```

参数：
- `hours`: 时间范围（小时），默认 2
- `limit`: 最大返回数量，默认 1000

### 3. 获取最新价格
```
GET /api/prices/latest
```

### 4. 健康检查
```
GET /api/health
```

## 数据管理

### 查看数据库中的数据量
```bash
wrangler d1 execute gold-price-db --command "SELECT COUNT(*) as count FROM gold_prices"
```

### 查看最近的数据
```bash
wrangler d1 execute gold-price-db --command "SELECT * FROM gold_prices ORDER BY timestamp DESC LIMIT 10"
```

### 清空所有数据（谨慎使用）
```bash
wrangler d1 execute gold-price-db --command "DELETE FROM gold_prices"
```

### 删除数据库
```bash
wrangler d1 delete gold-price-db
```

## 故障排除

### 1. CORS 错误
确保 `worker.js` 中的 CORS 设置正确：
```javascript
'Access-Control-Allow-Origin': '*'
```

### 2. 数据库连接失败
检查 `wrangler.toml` 中的 `database_id` 是否正确。

### 3. 部署失败
确保已运行 `wrangler login` 并且账号有效。

## 免费额度

Cloudflare Workers 免费计划：
- 每天 100,000 次请求
- D1 数据库：5GB 存储
- 完全满足个人使用

## 完成！

现在您的黄金价格监控系统已经使用 D1 数据库永久保存数据了！
