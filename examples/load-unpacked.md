# 加载已解包扩展（开发 / 试用）

```bash
git clone https://github.com/SuperMarioYL/cleanserp.git
cd cleanserp && npm install && npm run build
# Chrome → chrome://extensions → 开启「开发者模式」→「加载已解包」→ 选择 dist/
```

随后访问 baidu.com 搜索任意查询，死链结果即时消失，顶部出现「净搜已过滤 N 条」徽章。

> v0.1 未上架商店；m3 会产出可上架的 Web Store 打包。当前用 load-unpacked 即可。
