# CBT-I 睡眠教练小程序（极简版）

这是一个面向微信端的 CBT-I 睡眠日记原型，目标是：
- 每天 1 分钟内完成记录
- 自动给出“建议上床/起床时间”
- 提供可下载打印的纸质日记模板

## 已实现功能

1. 今日睡眠计划（首页）
2. 睡眠日记录入（每日数据）
3. 历史记录查看/编辑/删除
4. 打印模板下载页（支持复制链接与在线打开）
5. 本地离线存储（无需后端即可运行）

## 目录结构

- `app.json`：小程序路由与全局配置
- `pages/home/`：首页（建议睡眠窗口）
- `pages/diary/`：日记录入页
- `pages/history/`：历史记录页
- `pages/templates/`：纸质模板下载页
- `utils/cbti.js`：CBT-I 动态建议算法
- `utils/storage.js`：本地存储
- `config/template-links.js`：模板下载 URL 配置
- `resources/templates/`：你已有的 PDF/XLSX 原始模板

## 如何运行

1. 打开微信开发者工具。
2. 选择“导入项目”，目录指向本项目：
   - `/Users/huanglu/Documents/Code/18-CBTI/wechat-miniapp`
3. `appid` 可先使用测试号；后续发布前改成你的小程序 `appid`。

## 你现在只需补的两项

1. 在 `project.config.json` 里替换 `appid`。
2. 在 `config/template-links.js` 里填入真实的 HTTPS 下载地址（例如 COS/CDN 链接）。

## 算法说明（当前版本）

- 近 7 天平均总睡眠时长作为基础睡眠窗口。
- 若近 7 天平均睡眠效率 >= 90%，窗口 +15 分钟。
- 若近 7 天平均睡眠效率 < 85%，窗口 -15 分钟。
- 睡眠窗口限制在 5 小时到 9 小时之间。
- 建议上床时间 = 固定起床时间 - 睡眠窗口。

> 注意：此工具用于 CBT-I 自助练习，不替代医生诊疗。
