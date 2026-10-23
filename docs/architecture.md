# 架构与分层约定

> 本文是改代码前先读的那份：谁依赖谁、测试为什么这样写、改动时不能破的约定。

## 总览

```
main.js                    组合根（~230 行）：require 全部模块、组装 ctx、注册 IPC
├─ src/main/               主进程集成层——依赖 electron
│  ├─ state.js             状态：loadState/saveState/SCAN_RULES 等（createState({app}))
│  ├─ addons.js            附加组件目录与 payload 装配
│  ├─ tray.js              托盘图标与菜单
│  ├─ window.js            主窗口创建/显示/关闭到托盘
│  ├─ update.js            更新检查、崩溃记录（createUpdate({app,fetch}))
│  ├─ overlay-preferences.js / overlay-protocol.js / overlay-ipc.js / overlay-bridge.js
│  └─ ipc/                 每个文件导出 register(ctx)，按域拆分：
│     ├─ session.js        boot/语言/主题/设置/诊断/安全图形
│     ├─ library.js        扫描/游戏库/文件夹管理/launch-game（白名单内）
│     ├─ install.js        install/restore/addon/art 等重操作（含互斥）
│     ├─ addons.js         add-on 构建/附加悬浮层管理
│     └─ art.js            海报抓取
├─ src/core/               纯 Node 逻辑层——禁止 require('electron')，全部可用 node --test 直测
├─ src/shared/             主进程与渲染进程共用的纯数据/工具（feature-i18n、install-routes…）
├─ src/renderer/           渲染层（经典脚本，i18n.js + renderer.js + theme2.js + overlay-*）
├─ overlay/                游戏内注入端（C++，AddOn 插件，独立编译）
├─ scripts/{build,test,dev}/  构建脚本与一次性工具
└─ test/                   node:test 全量测试（含 vm 沙箱用例）
```

## 依赖方向（三条铁律）

1. **main.js 是唯一直接 require `./src/core/*` 的入口**；`src/main/` 下的模块一律不
   自己 require core，而是从 `ctx`（main.js:145 组装的上下文对象）拿。
2. **`src/core` 禁止 require electron**，也不允许回到 `scan.js` ↔ `apply.js` 那种环。
   manifest 记账独立在 `src/core/manifest-tracker.js`（只依赖 pe/file-journal），
   `test/core-dependency-graph.test.js` 用 Kahn 拓扑排序把整个 src/core 钉成无环 DAG——
   新增跨模块依赖时若造出环，测试会直接红。
3. **`src/main/ipc/*` 的 register(ctx) 约定**：handler 只用 ctx 上的东西 + 闭包，
   不做顶层副作用；注册顺序见 main.js:166-173（install 最后注册，它的
   `isMutationBusy` 要被其他模块的写操作检查）。

## vm 测试契约（改 main.js 前必读）

9 个测试（history-ipc、api-override-ipc、library-state-race、close-to-tray、
single-instance、update-check、library-grouping、driver-barrier、open-guard 等）
把 **main.js 源码文本放进 vm 上下文执行**。它们依赖：

- **stub require 按 specifier 精确匹配**：测试拦截 `'electron'`、`'./src/core/scan.js'`
  等字面量。因此 main.js 里的 require 路径不能随意改写法；`src/main/*` 的模块
  在 library-grouping 里被显式放行真实加载。
- **四个顶级绑定**（vm.runInContext 直接改写或调用，必须保持顶级 `let`/`function`）：
  - `createWindow()` — close-to-tray / single-instance 直接调用
  - `payload` / `companionAddons` — history-ipc / api-override-ipc 注入假数据
  - `historyStore` — `__resetHistoryStore()` 置空
- **测试钩子出口**在 main.js 末尾的 `module.exports`（`__setPayload` 等），
  guard 住 `typeof module`，保证文件在无 module 的 vm 里也能裸跑。
- **正则断言**：release-227/228、optiscaler-build-choice 等测试对 main.js 与
  `src/main/ipc/install.js` 等文件的**源码文本**做正则断言（如 dgVoodoo 分支、
  `const why = …` 三元链、`optiVersion = release.version;`）。移动/重命名这些
  代码时同步改测试的 `read(...)` 路径。

## 其它关键机制

- **安装互斥**：`ctx.install.isMutationBusy()` 覆盖 Games 页 install/restore
  与 overlay 的 add/remove（main.js:228 注入）。新增会写游戏目录的 handler
  必须先查这个标志。
- **open/launch 白名单**：`open`（session.js）与 `launch-game`（library.js）只对
  `knownFolders(state, cache.lastGames)` 里 keyFor 命中的目录放行，
  错误码 `errOpenOutsideLibrary` / `errLaunchOutsideLibrary`。
- **net 注入**：`art.setFetch(net.fetch)`（main.js:24，带 vm 桩守卫）——商店 API
  走 Electron fetch 才吃系统代理。
- **534px overlay 契约** → 见 `docs/overlay-protocol.md`；
  **Vulkan 隐式层** → 见 `docs/vulkan-layer-recovery.md`；
  **安装 manifest/备份** → 见 `docs/install-manifest.md`。
- **打包**：`build.files = "src/**/*"` + 根目录 main.js/preload.js/overlay-preload.js；
  `dist/` 是 electron-builder 产物目录，不入库。
