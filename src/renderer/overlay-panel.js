'use strict';
// Native <input type=range> dragging relies on OS capture, which an offscreen
// Chromium window does not own. Handle pointer drags in the shared DOM instead.
// A custom theme stores one accent colour. The other three shades the panel
// needs are derived from it here, in one place, so the preview in the app and
// the surface drawn inside the game cannot drift apart.
//   bright  accent lifted toward white, for text on dark
//   soft    accent at low alpha, for selected rows
//   back    a dark tint over the panel's own base, for the gradient
window.overlayThemeVars = accent => {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(accent || ''));
  if (!hex) return null;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
  const pair = v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  const mix = (c, target, amount) => pair(c + (target - c) * amount);
  return {
    '--ol-accent': `#${pair(r)}${pair(g)}${pair(b)}`,
    '--ol-bright': `#${mix(r, 255, .47)}${mix(g, 255, .47)}${mix(b, 255, .47)}`,
    '--ol-soft': `#${pair(r)}${pair(g)}${pair(b)}25`,
    '--ol-back': `#${mix(r, 16, .88)}${mix(g, 21, .88)}${mix(b, 25, .88)}`
  };
};

// Point an element at a theme. Built-in themes are pure CSS; a custom one adds
// the derived variables inline, which override the stylesheet's defaults.
window.applyOverlayTheme = (element, prefs) => {
  if (!element || !prefs) return;
  element.dataset.overlayTheme = prefs.theme;
  for (const name of ['--ol-accent', '--ol-bright', '--ol-soft', '--ol-back']) element.style.removeProperty(name);
  if (prefs.theme !== 'custom') return;
  const vars = window.overlayThemeVars(prefs.custom && prefs.custom.accent);
  if (vars) for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
};

window.bindOverlayRanges = root => {
  let active = null;
  const move = event => {
    if (!active) return;
    const r = active.getBoundingClientRect(), thumb = 7.5;
    const min = Number(active.min), max = Number(active.max), step = Number(active.step) || .01;
    const ratio = Math.max(0, Math.min(1, (event.clientX - r.left - thumb) / Math.max(1, r.width - 2 * thumb)));
    active.value = String(Math.max(min, Math.min(max, min + Math.round(ratio * (max - min) / step) * step)));
    active.dispatchEvent(new Event('input', { bubbles: true }));
  };
  root.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.target.matches('input[type=range]:not(:disabled)')) return;
    active = event.target; event.preventDefault(); active.focus();
    active.dataset.dragging = 'true';
    try { active.setPointerCapture(event.pointerId); } catch {}
    move(event);
  });
  root.addEventListener('pointermove', move);
  const finish = () => { if (active) { delete active.dataset.dragging; active.dispatchEvent(new Event('change', { bubbles: true })); } active = null; };
  root.addEventListener('pointerup', finish);
  root.addEventListener('pointercancel', finish);
  root.addEventListener('lostpointercapture', finish);
};
// One DOM for the the preview AND the in-game Chromium surface. No native
// reconstruction of controls: their metrics, fonts and behavior stay identical.
window.mountOverlayPanel = (root, footer = 'Design inspired by the NVIDIA reference. Masking, models and DLSS sliders are not connected to the SDK.') => {
  const slider = (id, label, value) => `<label class="ol-slider" for="${id}"><span>${label}</span><input id="${id}" type="range" min="0" max="1" step="0.01" value="${value}"/><output for="${id}">${value.toFixed(2)}</output></label>`;
  root.innerHTML = `<div class="ol-panel" dir="ltr">
    <header><span class="ol-eyebrow">DLSS 5 SWAPPER CONTROLS</span><span class="ol-prototype">PREVIEW</span></header>
    <label class="ol-check ol-master"><input type="checkbox" checked/> DLSS ON <small>Preview only</small></label>
    <label class="ol-check ol-badge"><input type="checkbox"/> ON-SCREEN STATUS <small>Shows DLSS 5 On/Off over the game</small></label>
    <section><h4>GLOBAL CONTROLS</h4>${slider('olStructure', 'Structure Intensity', .38)}${slider('olTone', 'Tone Intensity', .28)}</section>
    <section class="ol-muted"><label class="ol-check"><input type="checkbox" disabled/> MODEL AUTOMASK <small>SDK required</small></label>${slider('olMaskStructure', 'Structure Intensity', 1)}</section>
    <section><label class="ol-check"><input type="checkbox" checked/> DEVELOPER MASKING <small>Demo groups</small></label>
      ${[['Pitcher', .45, .35], ['Grapes', 1, 1], ['Bottles', 1, 1]].map(([label, structure, tone], i) => `<div class="ol-group"><label class="ol-check"><input type="checkbox" checked/> ${label}</label>${slider(`olGroup${i}s`, 'Structure Intensity', structure)}${slider(`olGroup${i}t`, 'Tone Intensity', tone)}</div>`).join('')}
    </section><section><h4>MODELS <small>Preview selection</small></h4><div class="ol-models">${['A', 'B', 'C'].map((m, i) => `<button class="ol-model ${i ? '' : 'selected'}" aria-pressed="${!i}">Model ${m}</button>`).join('')}</div></section>
    <footer></footer></div>`;
  root.querySelector('footer').textContent = footer;
  root.querySelector('#olMaskStructure').disabled = true;
  for (const input of root.querySelectorAll('input[type="range"]')) input.oninput = () => { input.nextElementSibling.textContent = Number(input.value).toFixed(2); };
  for (const model of root.querySelectorAll('.ol-model')) model.onclick = () => {
    for (const item of root.querySelectorAll('.ol-model')) { item.classList.toggle('selected', item === model); item.setAttribute('aria-pressed', String(item === model)); }
  };
  if (!root.dataset.rangeBinding) { window.bindOverlayRanges(root); root.dataset.rangeBinding = 'true'; }
};

/* ==========================================================================
 * 简体中文本地化（汉化补丁追加，不改变原有逻辑）
 * 机制：不改写模板与赋值语句，改为在 DOM 渲染后做一次精确文本映射。
 *       未命中的文本原样保留，因此漏配只会显示英文，不会出错。
 *       英文与阿拉伯语两条既有分支完全不受影响。
 * ========================================================================== */
const OL_ZH = {
  'DLSS 5 SWAPPER CONTROLS': 'DLSS 5 SWAPPER 控制台',
  'PREVIEW': '预览',
  'DLSS ON': 'DLSS 开',
  'Preview only': '仅预览',
  'ON-SCREEN STATUS': '屏幕状态显示',
  'Shows DLSS 5 On/Off over the game': '在游戏画面上显示 DLSS 5 开关状态',
  'SDK required': '需要 SDK',
  'Demo groups': '演示分组',
  'Preview selection': '预览选择',
  'Preview: Feeder + RenoDX': '预览：Feeder + RenoDX',
  'Preview: RenoDX': '预览：RenoDX',
  'MODELS': '模型',
  'MODEL AUTOMASK': '角色遮罩',
  'CHARACTER MASK': '角色遮罩',
  'DEVELOPER MASKING': '开发者遮罩',
  'GLOBAL CONTROLS': '全局控制',
  'MORE RENODX CONTROLS': '更多 RenoDX 控制',
  'FEEDER CONTROLS': 'Feeder 控制',
  'NR STYLE': '神经渲染风格',
  'LIVE RESHADE': 'ReShade 实时',
  'CONNECTED': '已连接',
  'DISCONNECTED': '未连接',
  'NOT CONNECTED': '未连接',
  'DLSS 5 SWAPPER · INJECTED TOOLS': 'DLSS 5 SWAPPER · 注入工具',
  'RenoDX live': 'RenoDX 实时',
  'RenoDX character mask': 'RenoDX 角色遮罩',
  'RenoDX controls unavailable.': 'RenoDX 控制不可用。',
  'Waiting for RenoDX': '正在等待 RenoDX',
  'Waiting for game connection': '正在等待游戏连接',
  'Unavailable': '不可用',
  'On-screen status card': '屏幕状态卡片',
  'ReShade shader effects': 'ReShade 着色器效果',
  'Live tools': '实时工具',
  'DLSS controls': 'DLSS 控制',
  'Show RenoDX extras': '显示 RenoDX 额外项',
  'Show Feeder controls': '显示 Feeder 控制',

  'Structure Intensity': '结构强度',
  'Tone Intensity': '色调强度',
  'Global Tone Intensity': '全局色调强度',
  'Local Tone Intensity': '局部色调强度',
  'Overall Intensity': '总强度',
  'Diffuse White (nits)': '漫反射白点 (nits)',
  'Motion Scale X Multiplier': '运动缩放 X 倍数',
  'Motion Scale Y Multiplier': '运动缩放 Y 倍数',
  'Character/Skin Structure': '角色/皮肤结构',
  'Automatic / Character Mask': '自动 / 角色遮罩',
  'Enable DLSS Neural Rendering': '启用 DLSS 神经渲染',
  'Enable Upscaling (WIP)': '启用超分辨率（开发中）',
  'NR UI Correction': '神经渲染界面修正',
  'NR Preset': '神经渲染预设',
  'NR Style': '神经渲染风格',
  'Depth Convention': '深度约定',
  'Use game NGX flag': '使用游戏 NGX 标志',
  'Force normal depth': '强制正常深度',
  'Force inverted depth': '强制反转深度',

  'Default': '默认',
  'Natural': '自然',
  'Cinematic': '电影感',
  'Preset #1': '预设 #1',
  'Preset #2': '预设 #2',
  'Preset #3': '预设 #3',
  'Model A · Default': '模型 A · 默认',
  'Model B · Natural': '模型 B · 自然',
  'Model C · Cinematic': '模型 C · 电影感',

  'Feeder enabled (original panel)': 'Feeder 已启用（原始面板）',
  'Work resolution (%)': '工作分辨率 (%)',
  'Work sharpness': '工作锐度',
  'Motion scale X': '运动缩放 X',
  'Motion scale Y': '运动缩放 Y',
  'HDR contract': 'HDR 约定',
  'Depth convention': '深度约定',
  'Work upscale': '工作分辨率放大',
  'HDR10 bridge': 'HDR10 桥接',
  'HDR paper white (nits)': 'HDR 纸白 (nits)',
  'Auto': '自动',
  'Force SDR': '强制 SDR',
  'Force HDR': '强制 HDR',
  'Normal': '正常',
  'Inverted': '反转',
  'Bilinear': '双线性',
  'DLSS SR (experimental)': 'DLSS SR（实验性）',
  'Off': '关闭',
  'On': '开启',

  'Design inspired by the NVIDIA reference. Masking, models and DLSS sliders are not connected to the SDK.':
    '设计参考 NVIDIA 方案。遮罩、模型和 DLSS 滑块均未连接 SDK。',
  'Restart DLSS 5 Swapper Plus and connect the updated overlay to load RenoDX controls.':
    '重启 DLSS 5 Swapper Plus 并连接更新后的叠加层，以加载 RenoDX 控制。',
  'Design preview; no game connection.': '设计预览；未连接游戏。',
  'RenoDX v4.7 controls use its original callback. FX controls below are separate. Experimental adapter; original tool windows remain available.':
    'RenoDX v4.7 控制使用其原始回调。下方的 FX 控制是独立的。实验性适配器；原始工具窗口仍可使用。',
  'Waiting for compatible RenoDX. FX controls do not control DLSS.':
    '正在等待兼容的 RenoDX。FX 控制不会控制 DLSS。',
  'No separate .fx shader controls found. RenoDX controls above do not require .fx shaders.':
    '未找到独立的 .fx 着色器控制。上方的 RenoDX 控制不需要 .fx 着色器。',
  'Interactive design preview only. Changes here do not affect a game. The installed overlay connects automatically to the verified RenoDX v4.7 build.':
    '仅为交互式设计预览。此处更改不会影响游戏。已安装的叠加层会自动连接到经过验证的 RenoDX v4.7 版本。',
  'Live RenoDX v4.7 settings. A/B/C select NR Style, not AI models. Scroll More Controls; click a number to type. Home keeps the original tools available.':
    'RenoDX v4.7 实时设置。A/B/C 选择的是神经渲染风格，而非 AI 模型。滚动到「更多控制」；点击数字可直接输入。Home 键保留原始工具。',
  'Waiting for the verified RenoDX v4.7 build. Connection is automatic; unsupported builds are refused. Original tools remain available.':
    '正在等待经过验证的 RenoDX v4.7 版本。连接是自动的；不受支持的版本会被拒绝。原始工具仍可使用。',
  'Design preview only. Feeder cfg controls; work resolution, filter and sharpness require DX11.':
    '仅为设计预览。Feeder 可配置的控制项；工作分辨率、滤镜和锐度需要 DX11。',

  'show/hide': '显示 / 隐藏',
  'Drag header: move': '拖动标题栏移动',
  'close': '关闭',
  'original tools': '原始工具'
};

// 繁體中文（臺灣用語）本地化。術語對齊主詞典 zh-TW 塊：疊加層、附加元件、
// 偵測、設定、還原。產品名（DLSS / ReShade / RenoDX / Feeder / SDK）保留英文。
const OL_ZH_TW = {
  'DLSS 5 SWAPPER CONTROLS': 'DLSS 5 SWAPPER 主控台',
  'PREVIEW': '預覽',
  'DLSS ON': 'DLSS 開',
  'Preview only': '僅預覽',
  'ON-SCREEN STATUS': '螢幕狀態顯示',
  'Shows DLSS 5 On/Off over the game': '在遊戲畫面上顯示 DLSS 5 開關狀態',
  'SDK required': '需要 SDK',
  'Demo groups': '示範分組',
  'Preview selection': '預覽選擇',
  'Preview: Feeder + RenoDX': '預覽：Feeder + RenoDX',
  'Preview: RenoDX': '預覽：RenoDX',
  'MODELS': '模型',
  'MODEL AUTOMASK': '角色遮罩',
  'CHARACTER MASK': '角色遮罩',
  'DEVELOPER MASKING': '開發者遮罩',
  'GLOBAL CONTROLS': '全域控制',
  'MORE RENODX CONTROLS': '更多 RenoDX 控制',
  'FEEDER CONTROLS': 'Feeder 控制',
  'NR STYLE': '神經渲染風格',
  'LIVE RESHADE': 'ReShade 即時',
  'CONNECTED': '已連線',
  'DISCONNECTED': '未連線',
  'NOT CONNECTED': '未連線',
  'DLSS 5 SWAPPER · INJECTED TOOLS': 'DLSS 5 SWAPPER · 注入工具',
  'RenoDX live': 'RenoDX 即時',
  'RenoDX character mask': 'RenoDX 角色遮罩',
  'RenoDX controls unavailable.': 'RenoDX 控制無法使用。',
  'Waiting for RenoDX': '正在等待 RenoDX',
  'Waiting for game connection': '正在等待遊戲連線',
  'Unavailable': '無法使用',
  'On-screen status card': '螢幕狀態卡片',
  'ReShade shader effects': 'ReShade 著色器效果',
  'Live tools': '即時工具',
  'DLSS controls': 'DLSS 控制',
  'Show RenoDX extras': '顯示 RenoDX 額外項目',
  'Show Feeder controls': '顯示 Feeder 控制',

  'Structure Intensity': '結構強度',
  'Tone Intensity': '色調強度',
  'Global Tone Intensity': '全域色調強度',
  'Local Tone Intensity': '局部色調強度',
  'Overall Intensity': '總強度',
  'Diffuse White (nits)': '漫射白點 (nits)',
  'Motion Scale X Multiplier': '運動縮放 X 倍數',
  'Motion Scale Y Multiplier': '運動縮放 Y 倍數',
  'Character/Skin Structure': '角色/皮膚結構',
  'Automatic / Character Mask': '自動 / 角色遮罩',
  'Enable DLSS Neural Rendering': '啟用 DLSS 神經渲染',
  'Enable Upscaling (WIP)': '啟用超解析度（開發中）',
  'NR UI Correction': '神經渲染介面修正',
  'NR Preset': '神經渲染預設',
  'NR Style': '神經渲染風格',
  'Depth Convention': '深度約定',
  'Use game NGX flag': '使用遊戲 NGX 標誌',
  'Force normal depth': '強制正常深度',
  'Force inverted depth': '強制反轉深度',

  'Default': '預設',
  'Natural': '自然',
  'Cinematic': '電影感',
  'Preset #1': '預設 #1',
  'Preset #2': '預設 #2',
  'Preset #3': '預設 #3',
  'Model A · Default': '模型 A · 預設',
  'Model B · Natural': '模型 B · 自然',
  'Model C · Cinematic': '模型 C · 電影感',

  'Feeder enabled (original panel)': 'Feeder 已啟用（原始面板）',
  'Work resolution (%)': '工作解析度 (%)',
  'Work sharpness': '工作銳利度',
  'Motion scale X': '運動縮放 X',
  'Motion scale Y': '運動縮放 Y',
  'HDR contract': 'HDR 約定',
  'Depth convention': '深度約定',
  'Work upscale': '工作解析度放大',
  'HDR10 bridge': 'HDR10 橋接',
  'HDR paper white (nits)': 'HDR 紙白 (nits)',
  'Auto': '自動',
  'Force SDR': '強制 SDR',
  'Force HDR': '強制 HDR',
  'Normal': '正常',
  'Inverted': '反轉',
  'Bilinear': '雙線性',
  'DLSS SR (experimental)': 'DLSS SR（實驗性）',
  'Off': '關閉',
  'On': '開啟',

  'Design inspired by the NVIDIA reference. Masking, models and DLSS sliders are not connected to the SDK.':
    '設計參考 NVIDIA 方案。遮罩、模型和 DLSS 滑桿均未連接 SDK。',
  'Restart DLSS 5 Swapper Plus and connect the updated overlay to load RenoDX controls.':
    '重新啟動 DLSS 5 Swapper Plus 並連線更新後的疊加層，以載入 RenoDX 控制。',
  'Design preview; no game connection.': '設計預覽；未連線遊戲。',
  'RenoDX v4.7 controls use its original callback. FX controls below are separate. Experimental adapter; original tool windows remain available.':
    'RenoDX v4.7 控制使用其原始回呼。下方的 FX 控制是獨立的。實驗性配接器；原始工具視窗仍可使用。',
  'Waiting for compatible RenoDX. FX controls do not control DLSS.':
    '正在等待相容的 RenoDX。FX 控制不會控制 DLSS。',
  'No separate .fx shader controls found. RenoDX controls above do not require .fx shaders.':
    '未找到獨立的 .fx 著色器控制。上方的 RenoDX 控制不需要 .fx 著色器。',
  'Interactive design preview only. Changes here do not affect a game. The installed overlay connects automatically to the verified RenoDX v4.7 build.':
    '僅為互動式設計預覽。此處變更不會影響遊戲。已安裝的疊加層會自動連線到經過驗證的 RenoDX v4.7 版本。',
  'Live RenoDX v4.7 settings. A/B/C select NR Style, not AI models. Scroll More Controls; click a number to type. Home keeps the original tools available.':
    'RenoDX v4.7 即時設定。A/B/C 選擇的是神經渲染風格，而非 AI 模型。滾動到「更多控制」；點選數字可直接輸入。Home 鍵保留原始工具。',
  'Waiting for the verified RenoDX v4.7 build. Connection is automatic; unsupported builds are refused. Original tools remain available.':
    '正在等待經過驗證的 RenoDX v4.7 版本。連線是自動的；不支援的版本會被拒絕。原始工具仍可使用。',
  'Design preview only. Feeder cfg controls; work resolution, filter and sharpness require DX11.':
    '僅為設計預覽。Feeder 可設定的控制項；工作解析度、濾鏡和銳利度需要 DX11。',

  'show/hide': '顯示 / 隱藏',
  'Drag header: move': '拖動標題列移動',
  'close': '關閉',
  'original tools': '原始工具'
};

// 日本語ローカライズ（DLSS 5 Swapper Plus オーバーレイパネル）。製品名
// （DLSS / ReShade / RenoDX / Feeder / SDK / DX11 / nits など）は主辞書の
// 方針に従い英語のまま残す。
const OL_JA = {
  'DLSS 5 SWAPPER CONTROLS': 'DLSS 5 SWAPPER コンソール',
  'PREVIEW': 'プレビュー',
  'DLSS ON': 'DLSS オン',
  'Preview only': 'プレビューのみ',
  'ON-SCREEN STATUS': '画面内ステータス',
  'Shows DLSS 5 On/Off over the game': 'ゲーム画面上に DLSS 5 のオン/オフを表示',
  'SDK required': 'SDK が必要',
  'Demo groups': 'デモグループ',
  'Preview selection': '選択をプレビュー',
  'Preview: Feeder + RenoDX': 'プレビュー：Feeder + RenoDX',
  'Preview: RenoDX': 'プレビュー：RenoDX',
  'MODELS': 'モデル',
  'MODEL AUTOMASK': 'モデル自動マスク',
  'CHARACTER MASK': 'キャラクターマスク',
  'DEVELOPER MASKING': '開発者マスキング',
  'GLOBAL CONTROLS': 'グローバルコントロール',
  'MORE RENODX CONTROLS': 'RenoDX の追加コントロール',
  'FEEDER CONTROLS': 'Feeder コントロール',
  'NR STYLE': 'NR スタイル',
  'LIVE RESHADE': 'ReShade ライブ',
  'CONNECTED': '接続済み',
  'DISCONNECTED': '未接続',
  'NOT CONNECTED': '未接続',
  'DLSS 5 SWAPPER · INJECTED TOOLS': 'DLSS 5 SWAPPER · 注入ツール',
  'RenoDX live': 'RenoDX ライブ',
  'RenoDX character mask': 'RenoDX キャラクターマスク',
  'RenoDX controls unavailable.': 'RenoDX コントロールは利用できません。',
  'Waiting for RenoDX': 'RenoDX を待機中',
  'Waiting for game connection': 'ゲーム接続を待機中',
  'Unavailable': '利用不可',
  'On-screen status card': '画面内ステータスカード',
  'ReShade shader effects': 'ReShade シェーダー効果',
  'Live tools': 'ライブツール',
  'DLSS controls': 'DLSS コントロール',
  'Show RenoDX extras': 'RenoDX の追加項目を表示',
  'Show Feeder controls': 'Feeder コントロールを表示',

  'Structure Intensity': 'ストラクチャー強度',
  'Tone Intensity': 'トーン強度',
  'Global Tone Intensity': 'グローバルトーン強度',
  'Local Tone Intensity': 'ローカルトーン強度',
  'Overall Intensity': '総合強度',
  'Diffuse White (nits)': '拡散白色 (nits)',
  'Motion Scale X Multiplier': 'モーションスケール X 倍率',
  'Motion Scale Y Multiplier': 'モーションスケール Y 倍数',
  'Character/Skin Structure': 'キャラクター/肌ストラクチャー',
  'Automatic / Character Mask': '自動 / キャラクターマスク',
  'Enable DLSS Neural Rendering': 'DLSS ニューラルレンダリングを有効化',
  'Enable Upscaling (WIP)': 'アップスケーリングを有効化（開発中）',
  'NR UI Correction': 'NR UI 補正',
  'NR Preset': 'NR プリセット',
  'NR Style': 'NR スタイル',
  'Depth Convention': '深度コンベンション',
  'Use game NGX flag': 'ゲームの NGX フラグを使用',
  'Force normal depth': '通常深度を強制',
  'Force inverted depth': '反転深度を強制',

  'Default': 'デフォルト',
  'Natural': 'ナチュラル',
  'Cinematic': 'シネマティック',
  'Preset #1': 'プリセット #1',
  'Preset #2': 'プリセット #2',
  'Preset #3': 'プリセット #3',
  'Model A · Default': 'モデル A · デフォルト',
  'Model B · Natural': 'モデル B · ナチュラル',
  'Model C · Cinematic': 'モデル C · シネマティック',

  'Feeder enabled (original panel)': 'Feeder 有効（元のパネル）',
  'Work resolution (%)': '作業解像度 (%)',
  'Work sharpness': '作業シャープネス',
  'Motion scale X': 'モーションスケール X',
  'Motion scale Y': 'モーションスケール Y',
  'HDR contract': 'HDR コンベンション',
  'Depth convention': '深度コンベンション',
  'Work upscale': '作業アップスケール',
  'HDR10 bridge': 'HDR10 ブリッジ',
  'HDR paper white (nits)': 'HDR ペーパーホワイト (nits)',
  'Auto': '自動',
  'Force SDR': 'SDR を強制',
  'Force HDR': 'HDR を強制',
  'Normal': '通常',
  'Inverted': '反転',
  'Bilinear': 'バイリニア',
  'DLSS SR (experimental)': 'DLSS SR（実験的）',
  'Off': 'オフ',
  'On': 'オン',

  'Design inspired by the NVIDIA reference. Masking, models and DLSS sliders are not connected to the SDK.':
    'NVIDIA リファレンスに基づくデザイン。マスキング、モデル、DLSS スライダーは SDK に接続されていません。',
  'Restart DLSS 5 Swapper Plus and connect the updated overlay to load RenoDX controls.':
    'RenoDX コントロールを読み込むには、DLSS 5 Swapper Plus を再起動し、更新したオーバーレイを接続してください。',
  'Design preview; no game connection.': 'デザインのプレビュー。ゲームには接続していません。',
  'RenoDX v4.7 controls use its original callback. FX controls below are separate. Experimental adapter; original tool windows remain available.':
    'RenoDX v4.7 コントロールは元のコールバックを使用します。下の FX コントロールは別物です。実験的アダプター。元のツールウィンドウはそのまま使えます。',
  'Waiting for compatible RenoDX. FX controls do not control DLSS.':
    '互換性のある RenoDX を待機中。FX コントロールは DLSS を制御しません。',
  'No separate .fx shader controls found. RenoDX controls above do not require .fx shaders.':
    '独立した .fx シェーダーコントロールは見つかりませんでした。上の RenoDX コントロールに .fx シェーダーは不要です。',
  'Interactive design preview only. Changes here do not affect a game. The installed overlay connects automatically to the verified RenoDX v4.7 build.':
    'インタラクティブなデザインプレビューのみ。ここでの変更はゲームに影響しません。インストール済みのオーバーレイは、検証済みの RenoDX v4.7 ビルドに自動接続します。',
  'Live RenoDX v4.7 settings. A/B/C select NR Style, not AI models. Scroll More Controls; click a number to type. Home keeps the original tools available.':
    'RenoDX v4.7 のライブ設定。A/B/C は AI モデルではなく NR スタイルを選択します。More Controls をスクロールし、数値をクリックして入力できます。Home で元のツールを表示します。',
  'Waiting for the verified RenoDX v4.7 build. Connection is automatic; unsupported builds are refused. Original tools remain available.':
    '検証済みの RenoDX v4.7 ビルドを待機中。接続は自動です。非対応のビルドは拒否されます。元のツールはそのまま使えます。',
  'Design preview only. Feeder cfg controls; work resolution, filter and sharpness require DX11.':
    'デザインのプレビューのみ。Feeder cfg コントロール。作業解像度・フィルター・シャープネスには DX11 が必要です。',

  'show/hide': '表示 / 非表示',
  'Drag header: move': 'ヘッダーをドラッグして移動',
  'close': '閉じる',
  'original tools': '元のツール'
};

// 한국어 현지화(DLSS 5 Swapper Plus 오버레이 패널). 제품명(DLSS / ReShade /
// RenoDX / Feeder / SDK / DX11 / nits 등)은 기본 사전 방침에 따라 영문 유지.
const OL_KO = {
  'DLSS 5 SWAPPER CONTROLS': 'DLSS 5 SWAPPER 콘솔',
  'PREVIEW': '미리보기',
  'DLSS ON': 'DLSS 켜짐',
  'Preview only': '미리보기만',
  'ON-SCREEN STATUS': '화면 상태 표시',
  'Shows DLSS 5 On/Off over the game': '게임 화면 위에 DLSS 5 켜짐/끄짐 상태 표시',
  'SDK required': 'SDK 필요',
  'Demo groups': '데모 그룹',
  'Preview selection': '선택 항목 미리보기',
  'Preview: Feeder + RenoDX': '미리보기: Feeder + RenoDX',
  'Preview: RenoDX': '미리보기: RenoDX',
  'MODELS': '모델',
  'MODEL AUTOMASK': '모델 자동 마스크',
  'CHARACTER MASK': '캐릭터 마스크',
  'DEVELOPER MASKING': '개발자 마스킹',
  'GLOBAL CONTROLS': '전역 컨트롤',
  'MORE RENODX CONTROLS': 'RenoDX 추가 컨트롤',
  'FEEDER CONTROLS': 'Feeder 컨트롤',
  'NR STYLE': 'NR 스타일',
  'LIVE RESHADE': 'ReShade 라이브',
  'CONNECTED': '연결됨',
  'DISCONNECTED': '연결 안 됨',
  'NOT CONNECTED': '연결 안 됨',
  'DLSS 5 SWAPPER · INJECTED TOOLS': 'DLSS 5 SWAPPER · 주입 도구',
  'RenoDX live': 'RenoDX 라이브',
  'RenoDX character mask': 'RenoDX 캐릭터 마스크',
  'RenoDX controls unavailable.': 'RenoDX 컨트롤을 사용할 수 없습니다.',
  'Waiting for RenoDX': 'RenoDX 대기 중',
  'Waiting for game connection': '게임 연결 대기 중',
  'Unavailable': '사용 불가',
  'On-screen status card': '화면 상태 카드',
  'ReShade shader effects': 'ReShade 셰이더 효과',
  'Live tools': '라이브 도구',
  'DLSS controls': 'DLSS 컨트롤',
  'Show RenoDX extras': 'RenoDX 추가 항목 표시',
  'Show Feeder controls': 'Feeder 컨트롤 표시',

  'Structure Intensity': '구조 강도',
  'Tone Intensity': '톤 강도',
  'Global Tone Intensity': '전역 톤 강도',
  'Local Tone Intensity': '로컬 톤 강도',
  'Overall Intensity': '전체 강도',
  'Diffuse White (nits)': '디퓨즈 화이트 (nits)',
  'Motion Scale X Multiplier': '모션 스케일 X 배율',
  'Motion Scale Y Multiplier': '모션 스케일 Y 배율',
  'Character/Skin Structure': '캐릭터/피부 구조',
  'Automatic / Character Mask': '자동 / 캐릭터 마스크',
  'Enable DLSS Neural Rendering': 'DLSS 뉴럴 렌더링 사용',
  'Enable Upscaling (WIP)': '업스케일링 사용 (개발 중)',
  'NR UI Correction': 'NR UI 보정',
  'NR Preset': 'NR 프리셋',
  'NR Style': 'NR 스타일',
  'Depth Convention': '뎁스 규약',
  'Use game NGX flag': '게임 NGX 플래그 사용',
  'Force normal depth': '일반 뎁스 강제',
  'Force inverted depth': '반전 뎁스 강제',

  'Default': '기본값',
  'Natural': '내추럴',
  'Cinematic': '시네마틱',
  'Preset #1': '프리셋 #1',
  'Preset #2': '프리셋 #2',
  'Preset #3': '프리셋 #3',
  'Model A · Default': '모델 A · 기본값',
  'Model B · Natural': '모델 B · 내추럴',
  'Model C · Cinematic': '모델 C · 시네마틱',

  'Feeder enabled (original panel)': 'Feeder 사용 중 (원본 패널)',
  'Work resolution (%)': '작업 해상도 (%)',
  'Work sharpness': '작업 샤프니스',
  'Motion scale X': '모션 스케일 X',
  'Motion scale Y': '모션 스케일 Y',
  'HDR contract': 'HDR 규약',
  'Depth convention': '뎁스 규약',
  'Work upscale': '작업 업스케일',
  'HDR10 bridge': 'HDR10 브리지',
  'HDR paper white (nits)': 'HDR 페이퍼 화이트 (nits)',
  'Auto': '자동',
  'Force SDR': 'SDR 강제',
  'Force HDR': 'HDR 강제',
  'Normal': '일반',
  'Inverted': '반전',
  'Bilinear': '바이리니어',
  'DLSS SR (experimental)': 'DLSS SR (실험적)',
  'Off': '끄기',
  'On': '켜기',

  'Design inspired by the NVIDIA reference. Masking, models and DLSS sliders are not connected to the SDK.':
    'NVIDIA 레퍼런스에서 착안한 디자인입니다. 마스킹, 모델, DLSS 슬라이더는 SDK에 연결되어 있지 않습니다.',
  'Restart DLSS 5 Swapper Plus and connect the updated overlay to load RenoDX controls.':
    'RenoDX 컨트롤을 불러오려면 DLSS 5 Swapper Plus를 다시 시작하고 업데이트된 오버레이를 연결하세요.',
  'Design preview; no game connection.': '디자인 미리보기일 뿐이며 게임에 연결되지 않았습니다.',
  'RenoDX v4.7 controls use its original callback. FX controls below are separate. Experimental adapter; original tool windows remain available.':
    'RenoDX v4.7 컨트롤은 원래 콜백을 사용합니다. 아래 FX 컨트롤은 별개입니다. 실험적 어댑터이며 원본 도구 창은 그대로 사용할 수 있습니다.',
  'Waiting for compatible RenoDX. FX controls do not control DLSS.':
    '호환되는 RenoDX를 기다리는 중입니다. FX 컨트롤은 DLSS를 제어하지 않습니다.',
  'No separate .fx shader controls found. RenoDX controls above do not require .fx shaders.':
    '별도의 .fx 셰이더 컨트롤을 찾지 못했습니다. 위의 RenoDX 컨트롤에는 .fx 셰이더가 필요하지 않습니다.',
  'Interactive design preview only. Changes here do not affect a game. The installed overlay connects automatically to the verified RenoDX v4.7 build.':
    '대화형 디자인 미리보기일 뿐입니다. 여기서 변경해도 게임에는 영향이 없습니다. 설치된 오버레이는 검증된 RenoDX v4.7 빌드에 자동으로 연결됩니다.',
  'Live RenoDX v4.7 settings. A/B/C select NR Style, not AI models. Scroll More Controls; click a number to type. Home keeps the original tools available.':
    'RenoDX v4.7 실시간 설정입니다. A/B/C는 AI 모델이 아닌 NR 스타일을 선택합니다. More Controls에서 스크롤하고 숫자를 클릭해 입력하세요. Home 키로 원본 도구를 표시합니다.',
  'Waiting for the verified RenoDX v4.7 build. Connection is automatic; unsupported builds are refused. Original tools remain available.':
    '검증된 RenoDX v4.7 빌드를 기다리는 중입니다. 연결은 자동이며 지원되지 않는 빌드는 거부됩니다. 원본 도구는 계속 사용할 수 있습니다.',
  'Design preview only. Feeder cfg controls; work resolution, filter and sharpness require DX11.':
    '디자인 미리보기일 뿐입니다. Feeder cfg 컨트롤이며 작업 해상도, 필터, 샤프니스에는 DX11이 필요합니다.',

  'show/hide': '표시 / 숨기기',
  'Drag header: move': '헤더를 드래그하여 이동',
  'close': '닫기',
  'original tools': '원본 도구'
};
const OL_MAPS = { zh: OL_ZH, ja: OL_JA, ko: OL_KO, 'zh-tw': OL_ZH_TW };

// 面板语言解析：返回当前应使用的映射表键（zh / ja / ko / zh-tw），null = 保持英文。
const olLang = () => {
  const value = String(document.documentElement.lang || 'en').toLowerCase();
  if (value.startsWith('zh-tw') || value.startsWith('zh-hant') || value.startsWith('zh_tw')) return 'zh-tw';
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('ko')) return 'ko';
  return null;
};

// 含动态值的拼接文本（热键、文件路径等），按固定片段做子串替换
const OL_ZH_PARTS = [
  ['The overlay add-on is missing from this app, so no game can load it:',
    '本程序缺少叠加层插件，任何游戏都无法加载它：'],
  ['Antivirus software removes this file - restore it from your antivirus quarantine and add an exclusion, or reinstall DLSS 5 Swapper Plus.',
    '防病毒软件会删除此文件 —— 请从隔离区恢复并添加排除项，或重新安装 DLSS 5 Swapper Plus。'],
  [': show/hide · Drag header: move · Esc: close · Home: original tools',
    '：显示 / 隐藏 · 拖动标题栏移动 · Esc 关闭 · Home 原始工具'],
  [': show/hide · Drag header to move · Esc: close · Home: original tools',
    '：显示 / 隐藏 · 拖动标题栏移动 · Esc 关闭 · Home 原始工具']
];

// 日本語の部分一致置換（動的値を含む連結テキスト用）。
const OL_JA_PARTS = [
  ['The overlay add-on is missing from this app, so no game can load it:',
    'このアプリにオーバーレイ アドオンが見つからないため、どのゲームも読み込めません:'],
  ['Antivirus software removes this file - restore it from your antivirus quarantine and add an exclusion, or reinstall DLSS 5 Swapper Plus.',
    'アンチウイルスソフトがこのファイルを削除しました - 隔離から復元し、除外設定に追加するか、DLSS 5 Swapper Plus を再インストールしてください。'],
  [': show/hide · Drag header: move · Esc: close · Home: original tools',
    '：表示 / 非表示 · ヘッダーをドラッグして移動 · Esc で閉じる · Home で元のツール'],
  [': show/hide · Drag header to move · Esc: close · Home: original tools',
    '：表示 / 非表示 · ヘッダーをドラッグして移動 · Esc で閉じる · Home で元のツール']
];
// 繁體中文的局部相符替換（含動態值的連接文字用）。
const OL_ZH_TW_PARTS = [
  ['The overlay add-on is missing from this app, so no game can load it:',
    '本程式缺少疊加層附加元件，任何遊戲都無法載入它：'],
  ['Antivirus software removes this file - restore it from your antivirus quarantine and add an exclusion, or reinstall DLSS 5 Swapper Plus.',
    '防毒軟體會刪除此檔案 —— 請從隔離區還原並新增排除項，或重新安裝 DLSS 5 Swapper Plus。'],
  [': show/hide · Drag header: move · Esc: close · Home: original tools',
    '：顯示 / 隱藏 · 拖動標題列移動 · Esc 關閉 · Home 原始工具'],
  [': show/hide · Drag header to move · Esc: close · Home: original tools',
    '：顯示 / 隱藏 · 拖動標題列移動 · Esc 關閉 · Home 原始工具']
];
const OL_PARTS_MAPS = { zh: OL_ZH_PARTS, ja: OL_JA_PARTS, ko: null, 'zh-tw': OL_ZH_TW_PARTS };

// 供 overlay-live.js 处理含动态值的拼接文本；lang=null（英文等）时原样返回。
const olMap = () => OL_MAPS[olLang()] || null;
window.overlayZh = (s) => {
  const map = olMap();
  return (map && map[s]) ? map[s] : s;
};

function olLocalize(root) {
  const map = olMap();
  if (!map || !root || !root.querySelectorAll) return;
  const walker = document.createTreeWalker(root, 4, null); // 4 = SHOW_TEXT
  const jobs = [];
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue;
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const hit = map[trimmed];
    if (hit) {
      const next = raw.replace(trimmed, hit);
      if (next !== raw) jobs.push([node, next]);
      continue;
    }
    let patched = raw;
    for (const [from, to] of (OL_PARTS_MAPS[olLang()] || [])) if (patched.includes(from)) patched = patched.split(from).join(to);
    if (patched !== raw) jobs.push([node, patched]);
  }
  for (const [n, v] of jobs) n.nodeValue = v;
  for (const el of root.querySelectorAll('[title],[aria-label],[placeholder]')) {
    for (const attr of ['title', 'aria-label', 'placeholder']) {
      const val = el.getAttribute(attr);
      const hit = val && map[val];
      if (hit && hit !== val) el.setAttribute(attr, hit);
    }
  }
}

let olTimer = 0;
const olSchedule = () => { clearTimeout(olTimer); olTimer = setTimeout(() => olLocalize(document.body), 30); };
// 监听 documentElement（而非 body），以便捕获 lang 属性的变化——
// 游戏内面板是一个独立文档，语言由主进程在窗口加载后注入。
const olObserve = () => {
  olLocalize(document.body);
  new MutationObserver(olSchedule).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['lang']
  });
};
if (document.body) olObserve();
else document.addEventListener('DOMContentLoaded', olObserve);
