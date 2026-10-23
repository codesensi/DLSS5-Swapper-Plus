# Overlay 协议与 534px 面板契约

游戏内注入端（`overlay/`，C++）与主进程离屏窗口之间通过命名管道传输
共享内存帧。整条链路的宽度是一份**硬编码契约：534 CSS 像素宽**。
任何一处改动都必须同步下面所有锚点，否则注入端会丢帧、面板会被拉伸。

## 534 的四个定义处（必须同时改）

| 位置 | 内容 | 角色 |
| --- | --- | --- |
| `overlay/overlay.cpp:46` | `constexpr uint32_t panel_width = 534, max_height = 1600` | 注入端：共享内存帧尺寸校验与缓冲区大小（`max_frame = panel_width * max_height * 4 + 24`） |
| `src/main/overlay-protocol.js:6` | `const WIDTH = 534, MAX_HEIGHT = 1600` | 主进程：帧编码/校验（`overlay-protocol.js:17` 校验 `width === WIDTH` 且位图字节数 = `width * height * 4`） |
| `src/renderer/overlay-surface.css:3` | `#panel { width:534px }` | 离屏窗口：实际绘制宽度，`'paint'` 事件按此宽度出帧 |
| `src/renderer/overlay-lab.css:48` | `.ol-static-panel { width:534px }` | 实验页静态面板，与注入端所见对齐 |

派生消费点（读 534 而不定义 534）：

- `src/main/overlay-bridge.js:75-83`：离屏窗口按显示器缩放系数出帧
  （150% 显示器上 534×320 会被画成 804×480），bridge 在 `paint`
  事件里把帧统一 `resize` 回 `protocol.WIDTH`，再交给注入端。
- `src/renderer/overlay-gallery.js:36`：画廊卡片缩放 `scale = width/534`。

## 帧格式

- 帧头魔数 `0x31534C44`（`'DSL1'`，小端）+ JSON 长度，见
  `overlay/overlay.cpp:147` 与 `overlay-protocol.js` 的 `FRAME_MAGIC`。
- 帧位图大小必须是 `width * height * 4` 字节（BGRA），`height ∈ [1, 1600]`。
- 握手/输入消息结构、新旧版本兼容（`helloReply`、`HELLO_VALUE` 等）见
  `src/main/overlay-protocol.js`，注入端解析在 `overlay/overlay.cpp:147` 附近。

## 改宽度的步骤（如果必须改）

1. `overlay/overlay.cpp:46` 的 `panel_width`（注入端重新编译）。
2. `src/main/overlay-protocol.js:6` 的 `WIDTH`（主进程校验）。
3. `src/renderer/overlay-surface.css:3` 与 `src/renderer/overlay-lab.css:48`。
4. 跑 `pnpm test`；`test/overlay-*` 会校验协议层，画廊/实验室用例覆盖缩放。

## 手动验收（注入链路）

1. 启动应用，开启任一游戏的 overlay 面板。
2. 在 100% 与 150% 缩放的显示器上各验证一次：游戏内画面出现面板、
   无逐行漂移（DPI 重采样路径 `overlay-bridge.js:83` 生效）。
3. 在画廊页打开面板预览：卡片按容器宽度缩放且无横向溢出
   （`overlay-gallery.js:36` 的 `width/534`）。
