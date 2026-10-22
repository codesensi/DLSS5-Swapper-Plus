# DLSS5-Swapper-Plus

一个管理 DLSS 5（神经渲染）游戏插件的 Windows 桌面工具：扫描本机游戏库，一键安装/替换 DLSS5 运行时、RenoDX 与 OptiScaler 组件，并在游戏内提供 ImGui 悬浮控制面板。

## 来源与致谢

本项目基于 [rakanki911/DLSS5-Swapper](https://github.com/rakanki911/DLSS5-Swapper) 删库前最后公开的 **v2.2.9** 版本二次开发而来——原仓库已不可访问，本仓库保留了这一基线并持续维护。

简体中文本地化最初来自 [EverChangAn/DLSS5-Swapper-zh-CN](https://github.com/EverChangAn/DLSS5-Swapper-zh-CN)，在此之上做了措辞与界面体验上的进一步打磨，感谢原作者的翻译工作。

## 构建与打包

### 前置条件

- **必须使用管理员权限的 PowerShell**。本项目的工作区可能存在完整性级别被压低（Low IL）的目录，普通权限终端会导致 zig 编译报 `AccessDenied`、Electron 启动即崩溃（0xC0000005）等难以定位的错误。
- Node.js ≥ 24（Node 26 已验证），pnpm ≥ 12。
- **DLSS SDK 分发（手动准备）**：`nvngx_dlssnr.dll` 等受 NVIDIA 许可证限制，不随构建下载，需本机自备。将 DLSS 分发内容（DLSS5 神经渲染 + DLSS SR/RR/FG + **Streamline 运行时**，不只 DLSS5）**平铺**放入 `vendor\dlss-streamline\`（DLL 直接位于该目录，不要套子目录），或用 `pnpm run payload -- <目录>` 指定，找不到即退出。
- **ReShade_Setup_\*_Addon.exe（可选）**：payload 优先扫描 `vendor\reshade-setup\`，找到即用；本地没有时自动下载**钉死的 6.8.0**（与 SDK 头文件同版本，SHA-256 校验，缓存于 `vendor\component-cache\`）。若手动放置其他版本，须与 `vendor\toolchain\reshade\` 内 SDK 版本一致，否则悬浮层 ABI 可能错位。
- **可选附加悬浮层（可选）**：需要捆绑其他 `.addon64` 时放入 `vendor\addons\`（各放一级子目录），通常留空即可。

### 当前验证过的打包环境

| 项目 | 版本 |
|---|---|
| Windows | Windows 11（内核 10.0.26300） |
| PowerShell | 7.6.7 |
| Node.js | v26.12.0 |
| pnpm | 12.14.0 |

低版本组合未测试，不保证通过。

### 网络配置（国内环境）

**给 Node 配置临时代理**（payload 会经 Node fetch 下载 Feeder/RenoDX 等组件，Node 默认不走系统代理）：

```powershell
$env:HTTPS_PROXY = 'http://192.168.2.4:7890'   # 换成你的代理端口
$env:NODE_USE_ENV_PROXY = '1'                # Node 24+ 原生开关
```

**给 Electron 配置临时加速镜像**（Electron 与 electron-builder 的二进制默认从 GitHub 下载，国内极慢）：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
```

以上均为**当前会话临时变量**，关闭终端即失效，不影响系统全局配置。

### 开发与测试

日常开发**不需要打包**：源码直接跑，改完即验。

```powershell
pnpm start                 # 启动应用（Electron 直接跑源码，改 JS/CSS 后重启即生效）
```

改悬浮层 C++（`overlay\*.cpp/.hpp`）后只需两步验证游戏内面板：

```powershell
pnpm run overlay:build     # 重编悬浮层（~30s，缓存在 vendor\toolchain\zig-cache）
pnpm start                 # 重启应用，悬浮层页会拿到新编译的 addon64
```

**测试命令**（Node ≥ 24 自带 test runner，无需打包）：

```powershell
pnpm test                                          # 全量测试（65 个文件，node --test）
pnpm run test:payload                              # 真实 payload 冒烟：合成游戏目录上走完安装/恢复全流程
pnpm run test:optiscaler                           # OptiScaler 组件同样验证
node --test test/release-228.test.js               # 单跑某个测试文件
node --test test/apply.test.js test/scan.test.js   # 任选几个
```

测试分层说明：

| 层级 | 命令 | 验什么 |
|---|---|---|
| 单元/契约 | `pnpm test` | 主进程与核心模块逻辑，纯内存夹具 |
| 集成 | `test:payload` / `test:optiscaler` | 在合成游戏目录上真实执行 apply/restore，校验 PE 架构与配置改写（不启动游戏） |
| 构建期 | `pnpm run payload` | 跨 pin 交叉校验（overlay 指纹 ↔ 组件摘要），不一致直接拒构建 |
| 人工 | 游戏内 F8 | 神经通道、滑条联动、日志面板——唯一需要真机的环节 |

注意：`test:payload`/`test:optiscaler` 依赖 `pnpm run payload` 先跑过（读 `dist\payload\`）；`test:optiscaler` 首次会经 `vendor\runtime-tests\components\` 下载/解压测试组件（已钉哈希）。

### 打包流程

在**管理员 PowerShell** 中按顺序执行：

```powershell
pnpm install              # 1. 安装依赖
pnpm run icon             # 2. 生成游戏图标（build\icon.ico，每机一次）
pnpm run overlay:prepare  # 3. 准备悬浮层构建素材（zig + ReShade SDK，每版本一次）
pnpm run overlay:build    # 4. 编译悬浮层
pnpm run payload          # 5. 下载/校验/组装运行时组件（build 的 prebuild 钩子会自动执行）
pnpm run build            # 6. 打包安装版 + 便携版（产物在 dist\）
```

### 注意点

- **产物挪出工作区再运行**：`dist\` 下生成的安装器/便携版可能被压上低完整性标签，双击安装会报 `Error writing temporary file`。把 exe 复制到项目目录之外（如 Downloads）再双击即可。
- **版本全部 SHA-256 钉死**：Feeder/RenoDX/dgVoodoo 等组件的下载地址与摘要钉在 `src\core\*-release.js` 与 `scripts\collect-payload.js` 中，payload 构建时逐个校验，并交叉核对 overlay 内编译的组件指纹（不一致直接拒构建）。升级组件时需同步更新钉点与 overlay 头文件。
- **组件下载缓存**：所有下载落在 `vendor\component-cache\`，摘要一致则秒过；手动下载组件放置于此可跳过联网。悬浮层工具链（zig、ReShade SDK 头）由 `overlay:prepare` 生成到 `vendor\toolchain\`，版本钉在 `scripts\prepare-overlay.ps1` 一处，第二次运行零下载。


