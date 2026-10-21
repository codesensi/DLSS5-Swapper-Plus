# DLSS5-Swapper-Plus 技术方案评审报告

- **评审对象**：DLSS5-Swapper-Plus v2.2.9（`E:\Projects\WebStorm\DLSS5-Swapper-Plus`）
- **评审日期**：2026-10-20
- **评审方式**：专家团（架构 / 安全 / 质量）并行静态分析 + 沙箱内逐文件测试实测；未修改任何文件
- **总体验收结论**：**NEEDS WORK** —— 测试套件当前非绿且无 CI 门禁，"全部通过"声明在当前工作区不成立

---

## 一、总体结论

项目整体质量高于同类桌面工具平均水平，无"必须推倒重来"的架构缺陷。以下三项设计扎实，应作为不变量保持：

1. **进程边界正确**：主窗口 `contextIsolation:true` / `nodeIntegration:false`（main.js:371-375），preload 仅暴露固定函数集合，无任意透传；
2. **文件替换事务化**：file-journal 写前日志（safePath 拒绝绝对路径/符号链接、tmp+rename 原子写）+ manifest 机制 + append-only 历史审计，形成完整回滚链路；
3. **Overlay 协议校验充分**：定长二进制协议带版本协商，限长/限速/魔数校验齐备。

需要优化的内容集中在四条线：

- ① 测试套件当前非绿且无 CI 门禁（已复现）；
- ② 社区内容 → 渲染器的 XSS 依赖面（转义不统一、emoji 键无白名单）；
- ③ main.js god-module 与核心模块循环依赖；
- ④ 若干未串行化 / 未鉴别的并发与通信缺口。

---

## 二、放行阻断项（修复前不建议发布）

| 编号/严重度 | 风险与位置 | 触发条件与影响 | 最小修复与验证 | 状态 |
|---|---|---|---|---|
| **#1 P0** | **测试套件失配**<br>`test/release-227.test.js:32` | 触发：直接运行即触发，断言写权限对话框按钮数为 2，实际为 3。<br>影响：套件非绿，且无法区分是产品新增语言还是产品回归。 | 对照 `src/shared/anti-cheat-warning.js` 当前语言集合更新期望（或确认产品误加并回退）。<br>验证：本用例转绿。 | ✅已复现（实测） |
| **#2 P0** | **验证链断裂（无 CI 门禁）**<br>17 个测试文件依赖 `extract-zip`（`src/core/runtime-components.js:9`、`src/core/optiscaler.js:5`），缺 node_modules 时主进程本身无法加载 | 触发：未安装依赖的环境（从源码运行、CI 缓存失效）。<br>影响：启动即崩；17 个测试文件未验证。 | 固化 `npm ci && npm test`（`--test-concurrency=1`）为发布门禁。<br>验证：发布附 CI 绿色运行记录。 | ✅已复现（环境性） |
| **#3 P1** | **社区内容 XSS 链**<br>`src/renderer/chat.js:152`（reactions emoji 键无白名单）、`src/renderer/renderer.js:4`（esc 缺 `'`）、全 renderer 约 60 处 innerHTML | 触发：社区服务器返回恶意字段（emoji 键、用户名、正文）且任一插值点漏 esc。<br>影响：渲染进程任意 JS → 可调用 110 个 preload IPC API，并被 #4 放大为任意执行。 | ① 统一 esc 为五字符单一模块；② emoji/name/tag 客户端白名单（如 `/^[\p{Emoji}\u200d\ufe0f]{1,8}$/u`）；③ 审计全部 innerHTML 插值点。<br>验证：fuzz 单测（恶意 reaction 键被丢弃）+ 渲染快照测试不回归。 | ⚠️潜在风险（高优先） |
| **#4 P1** | **open IPC 可打开任意路径**<br>`main.js:1218` `shell.openPath(dir)` 无校验 | 触发：渲染进程被攻破（#3 成立）或前端逻辑被诱导。<br>影响：打开/执行任意本地可执行文件。 | 白名单仅放行已注册游戏目录、userData、app 目录前缀（`path.resolve` 后校验）。<br>验证：单测 `C:\Windows\System32\cmd.exe` 被拒、游戏目录放行。 | ⚠️潜在风险 |

---

## 三、高优先跟踪项（P2）

| 编号 | 风险与位置 | 触发条件与影响 | 最小修复 | 状态 |
|---|---|---|---|---|
| **#5** | **Xbox 库 8.3 短路径等值缺陷**<br>`test/library-xbox.test.js:152`（对应实现层字符串精确比较） | 路径任一侧经 8.3 别名（如 `CODESE~1`）解析即不匹配 → Xbox 包去重/命名错误。 | 比较前对两侧做 `fs.realpathSync` 规范化。 | ✅已复现 |
| **#6** | **restore() 对损坏 manifest 裸 JSON.parse**<br>`src/core/apply.js:1065`（对照 :41-47 同情况处理正确） | manifest 被截断 → 裸 SyntaxError，不走 retired-manifest 恢复路径。 | try/catch 后回退 `recoverableManifest(gameDir)`。 | 🔍代码证实·未复现 |
| **#7** | **install/restore 互斥仅为进程内布尔 + TOCTOU**<br>`main.js:1715-1721`；set-api-override / set-reshade-proxy 二检后 saveState 无锁 | 同进程异步交错 → manifest/配置写入竞态（journal 兜底为"可恢复"而非"损坏"，非阻断）。 | 变更段统一纳入 `exclusiveMutation`；补 install 与 restore 并发的回归用例。 | 🔍代码证实·未复现 |
| **#8** | **overlay-ipc 安装/移除疑似未串行化**<br>`src/overlay-ipc.js` 对照 `main.js:1715-1721` | Overlay 页操作与游戏 install 并发 → 两路文件变更可能交错写入同一游戏目录。 | 纳入同一互斥区。（主理人注：待核验项，未证实） | ❓待核验 |
| **#9** | **Overlay 命名管道无对端鉴别**<br>`src/overlay-bridge.js:108-176` | 本机恶意进程连接管道 → 注入伪造输入/状态（UI 欺骗）；协议不传文件/路径，无隐私回泄。 | 握手挑战-应答（endpoint 文件已有 token，扩展协议即可），未握手即断开。 | 🔍设计风险 |
| **#10** | **Vulkan 路由绕过 journal 事务**<br>`src/core/backend-manager.js:104-113`（注释明示有意） | 安装中途崩溃/断电 → 残留文件 + 全局 HKCU Vulkan 层，恢复依赖用户手动 Restore。 | 补"Vulkan 失败 → 手动恢复成功"人工验收用例并留档；UI 明确引导。 | 🔍设计确认项 |
| **#11** | **main.js god-module**<br>main.js 1995 行、约 89 个 ipcMain.handle，preload 1:1 粘合 | 变更放大多米诺化（合并冲突与回归面大）；测试只能 vm/stub 打穿。 | 按域拆分注册模块，先拆 community（占半数处理器），仿 `src/overlay-ipc.js` 的 handle 包装 + 依赖注入模式；main.js 收敛为组装根。 | 📐可维护性 |
| **#12** | **核心三角循环依赖靠延迟 require 压制**<br>`src/core/optiscaler.js:144,180,190`；`src/core/scan.js:684,693` | 新贡献者在顶层补 require 即触发 CommonJS 部分初始化，错误暴露在运行时而非加载时。 | 抽取 `src/core/manifest-tracker.js` 承载 manifest 编排，使 apply/optiscaler/scan 顶层互不 require；CI 加依赖方向检查。 | 📐可维护性 |

---

## 四、低优先项（P3）

- **协议演进无文档**：`src/overlay-protocol.js` 能力位（15 位掩码）无映射表；534px 宽度在协议/原生/CSS 三处硬编码 → 新增 `docs/overlay-protocol.md` + 常量一致性单测。
- **主窗口未启 sandbox**：`main.js:371-375` 有 contextIsolation 但无 `sandbox:true`（与 overlay-bridge 窗口策略不一致，是否有意待确认）；启用前需验证 `preload.js:109` `webUtils.getPathForFile` 兼容性。
- **admin token 内存驻留**：`src/admin-vault.js:12` `cached` 无清零机制 → 用后置空，按需解密。
- **installId 终身复用**（`src/community-client.js:28-30,47`）：跨请求画像隐私项 → 提供重置入口 + 隐私声明。
- **ack 空指针**：`src/overlay-bridge.js:156` ack 处理 `latest.readUInt32LE(8)` 未判 null，恶意时序下销毁整条连接 → `latest &&` 短路。
- **反作弊启发式漏报可能**：`src/core/install-guards.js:106-121` 深度 ≤2 / 2000 文件上限，属已声明的近似，验收时注明即可。

---

## 五、放行条件（Checklist）

- [ ] 修复 #1、#5 两个失败用例后，干净环境 `npm ci && npm test` 全绿（#2 的 17 个被阻断文件随之转为已验证）
- [ ] #3：esc 统一 + emoji 白名单完成，附 fuzz 单测
- [ ] #4：open 路径白名单完成，附正反单测
- [ ] #10：Vulkan 失败 → 手动恢复的人工验收用例执行并留档
- [ ] 向服务端确认社区 schema 约束（emoji/name/tag 是否有白名单）——直接决定 #3 的最终定级

---

## 六、建议补充的验收用例（现有测试无覆盖）

| 场景 | 前置条件 | 操作 | 预期结果 |
|---|---|---|---|
| 损坏 manifest 恢复 | 截断的 manifest.json | Restore | 走 retired 恢复或报 `errBackupInvalid`，不抛裸异常 |
| 并发互斥 | install 进行中 | 并发 invoke restore / set-api-override | 第二操作等待而非交错 |
| 未鉴别管道连接 | 恶意本地进程 | 连接后注入伪造 status | 握手失败即断开（现状：能连入） |
| esc 回归 | 用户名含 `'` | 社区卡片/聊天渲染 | 不破版 |
| admin-vault 降级 | `isEncryptionAvailable()===false` | save() | 必须抛错拒绝落盘 |

---

## 七、覆盖范围声明

**已覆盖**：

- 主进程 / preload / renderer 关键链路逐行审读；65 个测试文件逐文件实测（46 通过，含 315 个用例；2 失败；17 因缺依赖未验证）。

**未覆盖（材料缺口）**：

- `overlay/` 下 C++ 注入侧源码未审——JS↔C++ 协议契约一致性、C++ 内存安全均未核验；
- `build/installer.nsh` 与 `scripts/` 构建链未审；
- `src/core/scan.js`（821 行）仅复核调用关系未逐行审；
- renderer 本地 UI 类 innerHTML 插值点未逐点审计；
- 真实游戏 E2E、Proton 实机、DPI、杀软干扰、OneDrive 场景未执行。

**待核验交接项**：

- #8（overlay-ipc 变更路径是否间接经过 exclusiveMutation）；
- 主窗口与 overlay 窗口 sandbox 策略不一致是否有意设计。

> 说明：全部结论基于静态分析 + 沙箱内可运行测试，未宣称任何未执行的测试通过。
