# DLSS5-Swapper-Plus

> [English](README_EN.md) | 简体中文

一个管理 DLSS 5（神经渲染）游戏插件的 Windows 桌面工具：扫描本机游戏库，一键安装/替换 DLSS5 运行时、RenoDX 与 OptiScaler 组件，并在游戏内提供 ImGui 悬浮控制面板。

## 来源与致谢

- 本项目基于 [rakanki911/DLSS5-Swapper](https://github.com/rakanki911/DLSS5-Swapper) 删库前最后公开的 **v2.2.9** 版本二次开发而来——原仓库已不可访问，本仓库保留了这一基线并持续维护。
- 简体中文本地化最初来自 [EverChangAn/DLSS5-Swapper-zh-CN](https://github.com/EverChangAn/DLSS5-Swapper-zh-CN)，在此之上做了措辞与界面体验上的进一步打磨，感谢原作者的翻译工作。

## 目录结构

| 目录 | 职责 |
|---|---|
| `main.js` | 组合根：装配各层、注册 IPC（唯一直接 require `src/core` 的入口） |
| `src\core\` | 纯 Node 逻辑层（扫描/安装/备份/manifest），禁止依赖 electron，全部可直测 |
| `src\main\` | 主进程集成层（窗口/托盘/状态/overlay 桥）+ `ipc\` 五个按域拆分的 register(ctx) 模块 |
| `src\shared\` | 主进程与渲染进程共用代码（feature-i18n、install-routes 等） |
| `src\renderer\` | 渲染层（经典脚本）：i18n、两套主题、overlay 面板/画廊 |
| `overlay\` | 游戏内注入端（C++ AddOn 插件），见其 README.md |
| `scripts\{build,test,dev}\` | 构建、payload 测试与一次性开发脚本 |
| `docs\` | 架构约定与运维手册（architecture、overlay-protocol、vulkan-layer-recovery、install-manifest、i18n） |
| `vendor\` | 本地准备的 DLSS 分发与组件下载缓存（不入库） |
| `dist\` | electron-builder 产物目录（不入库） |

分层依赖约定、vm 测试契约与不可破坏的组合根规则见 [docs/architecture.md](docs/architecture.md)。

## 一、开发与构建

### 1.前置条件

- **必须使用管理员权限的 PowerShell**。本项目的工作区可能存在完整性级别被压低（Low IL）的目录，普通权限终端会导致 zig 编译报 `AccessDenied`、Electron 启动即崩溃（0xC0000005）等难以定位的错误。
- Node.js ≥ 24（Node 26 已验证），pnpm ≥ 12。
- **DLSS SDK 分发（手动准备）**：`nvngx_dlssnr.dll` 等受 NVIDIA 许可证限制，不随构建下载，需本机自备。将 DLSS 分发内容（DLSS5 神经渲染 + DLSS SR/RR/FG + **Streamline 运行时**，不只 DLSS5）**平铺**放入 `vendor\dlss-streamline\`（DLL 直接位于该目录，不要套子目录），或用 `pnpm run payload -- <目录>` 指定，找不到即退出。
- **ReShade_Setup_\*_Addon.exe（可选）**：payload 优先扫描 `vendor\reshade-setup\`，找到即用；本地没有时自动下载**钉死的 6.8.0**（与 SDK 头文件同版本，SHA-256 校验，缓存于 `vendor\component-cache\`）。若手动放置其他版本，须与 `vendor\toolchain\reshade\` 内 SDK 版本一致，否则悬浮层 ABI 可能错位。
- **可选附加悬浮层（可选）**：需要捆绑其他 `.addon64` 时放入 `vendor\addons\`（各放一级子目录），通常留空即可。

### 2.当前验证过的打包环境

| 项目 | 版本 |
|---|---|
| Windows | Windows 11（内核 10.0.26300） |
| PowerShell | 7.6.7 |
| Node.js | v26.12.0 |
| pnpm | 12.14.0 |

低版本组合未测试，不保证通过。

### 3.网络配置（可选）

- **给 Node 配置临时代理**（payload 会经 Node fetch 下载 Feeder/RenoDX 等组件，Node 默认不走系统代理）：

```powershell
# 换成你的代理端口
$env:HTTPS_PROXY = 'http://192.168.2.4:7890'
# Node 24+ 原生开关
$env:NODE_USE_ENV_PROXY = '1'
```

- **给 Electron 配置临时加速镜像**（Electron 与 electron-builder 的二进制默认从 GitHub 下载）：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
```

`注：网络配置均为当前会话临时变量，关闭终端即失效，不影响系统全局配置。`

### 4.本地开发

**全量测试**

```powershell
pnpm test
```

启动应用

```powershell
pnpm start
```

### 5.构建打包

在**管理员 PowerShell** 中按顺序执行：

```powershell
# 1. 安装依赖
pnpm install
# 2. 生成应用图标
pnpm run icon
# 3. 准备悬浮层构建素材
pnpm run overlay:prepare
# 4. 编译悬浮层
pnpm run overlay:build
# 5. 打包安装版 + 便携版
pnpm run build
```

### 注意点

- **产物挪出工作区再运行**：`dist\` 下生成的安装器/便携版可能被压上低完整性标签，双击安装会报 `Error writing temporary file`。把 exe 复制到项目目录之外（如 Downloads）再双击即可。
- **版本全部 SHA-256 钉死**：Feeder/RenoDX/dgVoodoo 等组件的下载地址与摘要钉在 `src\core\*-release.js` 与 `scripts\build\collect-payload.js` 中，payload 构建时逐个校验，并交叉核对 overlay 内编译的组件指纹（不一致直接拒构建）。升级组件时需同步更新钉点与 overlay 头文件。
- **组件下载缓存**：所有下载落在 `vendor\component-cache\`，摘要一致则秒过；手动下载组件放置于此可跳过联网。悬浮层工具链（zig、ReShade SDK 头）由 `overlay:prepare` 生成到 `vendor\toolchain\`，版本钉在 `scripts\build\prepare-overlay.ps1` 一处，第二次运行零下载。


