Output assets/demo.gif
Require npm

Set FontSize 16
Set Width 960
Set Height 540
Set Padding 20
Set Theme "{{ .Config.Theme | default \"Dracula\" }}"

# 10-minute happy path：clone → build → 加载已解包 → 搜索净化
Type "git clone https://github.com/SuperMarioYL/cleanserp.git"
Enter
Sleep 2s

Type "cd cleanserp && npm install"
Enter
Sleep 6s

Type "npm run build"
Enter
Sleep 3s

# 提示加载 dist/
Type "# 在 Chrome 打开 chrome://extensions → 开发者模式 → 加载已解包 → 选 dist/"
Enter
Sleep 2s

# 模拟一次净搜前后的 SERP
Echo "搜索「怎么治疗脱发」(before)：5 条营销号/百家号AI文/付费墙死链"
Sleep 2s
Echo "净搜已过滤 5 条 → 剩 1 条干净可读结果"
Sleep 2s

Type "npm test"
Enter
Sleep 4s
