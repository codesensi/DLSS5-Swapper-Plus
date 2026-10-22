'use strict';
// Shared by game filters, warnings and native confirmations. Every supported
// language owns these strings; product/API names deliberately remain unchanged.
(function (root) {
const catalog = {
  "en": {
    "searchGames": "Search games",
    "searchGamesHint": "Search by game title…",
    "filterDlss": "DLSS status",
    "filterAddon": "Add-on",
    "clearFilters": "Clear filters",
    "allApis": "All APIs",
    "allDlss": "All DLSS states",
    "allAddons": "Any add-on state",
    "filterReady": "Ready to install",
    "hasDlss": "DLSS present",
    "dlssCurrent": "DLSS 5 installed / up to date",
    "addonPresent": "Add-on present",
    "addonAbsent": "No add-on",
    "unknownApi": "Unknown API",
    "noMatchingGames": "No matching games",
    "changeFilters": "Try another search or clear the filters.",
    "filteredCount": "{0} of {1} shown",
    "dx12Count": "{0} on DirectX 12",
    "dlssCount": "{0} with DLSS",
    "setAutoScan": "Scan all drives automatically",
    "setAutoScanHint": "Off by default. User-added folders are always scanned.",
    "setGroupGames": "Group games by store",
    "setGroupGamesHint": "Turn off to show all games and emulators in one alphabetical grid, without store sections.",
    "fBackend": "Rendering backend",
    "backendReShade": "ReShade (default)",
    "installedBackend": "Installed backend",
    "applyBackend": "Apply backend change",
    "installOpti": "Install OptiScaler DLSS-NR",
    "operationCancelled": "Cancelled. No game files changed.",
    "fArchitecture": "Architecture",
    "fRoute": "Installation route",
    "routeNative": "Native DLSS (RenoDX)",
    "routeFeeder": "DLSS5-Feeder (No DLSS / Incompatible DLSS)",
    "antiCheatWarningTitle": "Warning: anti-cheat detected",
    "antiCheatWarning": "This game appears to use anti-cheat. ReShade, Feeder or OptiScaler may cause crashes, prevent launch, or result in an account ban. Installation is optional: click Install and explicitly accept the risks to continue. Anti-cheat will not be disabled or bypassed.",
    "errAntiCheatConsent": "Anti-cheat was detected. Click Install again to review the warning and choose whether to continue.",
    "antiCheatRiskAccepted": "Anti-cheat risks acknowledged for this installation attempt.",
    "errManagedModpack": "A Mod Organizer Stock Game / Root Builder installation was detected (for example LoreRim). Direct injection could conflict with its managed ENB/ReShade. Automatic installation is blocked; configure compatibility through the modpack manager. Restore originals remains available.",
    "errLoaderConflict": "A conflicting graphics loader or ReShade hook is present. No conflicting file was overwritten. Restore the previous Swapper install, or manage external ENB/DXVK/ReShade through its own installer before retrying. See the file path below.",
    "errRuntimeArchitecture": "An existing DLSS runtime beside the selected executable is unreadable or has a different architecture. Restore/repair that installation first; it was not overwritten.",
    "restoreProfileWarning": "Optional backend settings could not be saved; continuing to restore the original game files.",
    "errBackupInvalid": "The original backup is incomplete or invalid. No full restore was performed. Keep _DLSS5_Backup intact; check the missing file in the log and repair the game with its launcher if the original is lost. The app will not delete unknown game/mod files.",
    "nativeEffectsHint": "Native DLSS uses the Add-ons tab, not .fx effects. “No effects found” alone does not mean installation failed. Enable DLSS in the game and check the add-on status. Streamline and frame-generation files are preserved.",
    "backendHint": "Optional per-game backend. Changes apply only when you click Apply / Install with the game closed. Each backend keeps its own settings.",
    "optiHint": "Optional OptiScaler DLSS-NR. Needs a 64-bit game with native DLSS enabled. The bundled neural model runs on Blackwell (RTX 50 series or RTX PRO Blackwell); an older card needs a modded nvngx_dlssnr.dll you supply. NVIDIA driver 616.56+ is recommended, not required. Anti-cheat games show a risk warning and require confirmation. Downloads ~130 MB on first use. Game compatibility is not guaranteed.",
    "optiDriverOld": "NVIDIA driver older than 616.56. This app supplies the neural-rendering model file itself, so OptiScaler normally still runs on an older driver - which matters because 616.x is reported to break RenoDX, and people roll back deliberately. If the model does not initialise in game, update the driver.",
    "optiCardOld": "Not a Blackwell card ({0}). The neural-rendering model that ships here is NVIDIA’s own, which runs on Blackwell; upstream says an older architecture needs a modded nvngx_dlssnr.dll, supplied by you and placed beside the game. An existing one is never overwritten. Install anyway and see - or use the ReShade or Feeder route instead.",
    "optiBridgeHint": "DX11 / Vulkan: Neural Rendering uses the DX12 bridge with FSR output, not native DLSS output. The bridge is configured automatically; keep DLSS selected in the game to provide inputs.",
    "optiVulkanHint": "Vulkan backend changes require Restore originals first. A global ReShade Vulkan layer must not be active; other games’ layer registrations are never disabled automatically.",
    "optiUnsupported": "OptiScaler DLSS-NR is offered only for 64-bit DX11/DX12/Vulkan games, not DX8/DX9, OpenGL or emulators.",
    "optiNeedsDlss": "OptiScaler needs the game’s original DLSS pipeline. No original DLSS DLL was found; copied/injected DLLs alone do not qualify.",
    "errOptiHardware": "This OptiScaler DLSS-NR build requires an RTX 50 series GPU and NVIDIA driver 616.56 or newer.",
    "errOptiVulkanLayer": "A global ReShade Vulkan layer is active. Restore its managed Vulkan installs first; the app will not disable it for other games.",
    "errBackendVulkanSwitch": "For Vulkan, use Restore originals before installing the other backend. Settings are saved for the next installation.",
    "errOptiConflict": "Another loader/mod is present. Restore or remove that mod with its own installer first. No conflicting file was overwritten.",
    "errOptiDownload": "Could not download and verify the official OptiScaler release. Retry after checking your connection; the current backend was not changed.",
    "componentQuarantined": "The component downloaded and matched its official checksum, then disappeared before it could be used - that is antivirus quarantine, not your connection. Allow the file or exclude the app’s components folder, then retry. The game was not changed.",
    "driverNeuralFault": "Driver 616.64 and newer ({0}) are measured upstream to fault inside NVIDIA’s own neural runtime with the RenoDX DLSS 5 add-on, on every evaluate; 616.56 is the last one seen completing. Installing anyway is fine - if the neural pass never appears in game, roll the driver back.",
    "oldShaderCompiler": "{0} in the game folder is version {1} - older than the Windows 10 SDK - and Windows loads it in preference to the current copy in System32. The neural pass is compiled as Shader Model 5.1, which this version cannot build, so it quietly does nothing while frames are still reported as delivered. The install moves it into the backup so the game uses the copy Windows ships; Restore puts it back.",
    "rivalConsumerSetAside": "{1} was beside the game: a second RenoDX DLSS consumer. Two cannot run together - ReShade keeps one and drops the other, whatever route was picked. It has been moved into the backup, and Restore puts it back.",
    "errOptiPayload": "OptiScaler payload is incomplete, has the wrong architecture, or failed verification.",
    "errGameRunning": "Close the game and its helper processes before installing, switching or restoring.",
    "errProcessCheck": "Could not verify that the game is closed. Restart the app and retry; no installation was started.",
    "errJobBusy": "Another installation or restore is in progress. Wait for it to finish.",
    "errBackendRecovery": "An interrupted switch needs recovery. Close the game, then click Restore originals. Keep the backup folder intact.",
    "unsupportedRendererHint": "Native DirectX 10 is not supported by Feeder. Select the game’s DirectX 11 mode if available. This renderer cannot be installed automatically.",
    "legacyRendererHint": "DX8/9 requires dgVoodoo2 → DirectX 11. The matching wrapper is downloaded from its official source on first install. Disable MSAA/SSAA in the game if depth is unavailable.",
    "runtimeRequiredHint": "Install or repair the official Microsoft Visual C++ runtime, then retry. 32-bit games need both x86 and x64.",
    "legacyDownloadHint": "The official dgVoodoo2 download could not be verified. Check your connection and retry; the existing installation was not changed.",
    "xeniaUiHint": "Xenia HUD compatibility is experimental. A conservative motion-vector/mask preset is applied, but UI correction cannot guarantee preservation of every game’s HUD. Share the game title and ReShade/Feeder logs if it still glitches.",
    "emulatorDepthHint": "If the image is wrong, choose the correct depth buffer in ReShade.",
    "rXboxProtected": "Protected Xbox package — move or reinstall it to XboxGames",
    "copyFailed": "Could not copy. Select the text and press Ctrl+C, or try again.",
    "historyLoadFailed": "Could not load history. Reopen this page to try again.",
    "historySaveWarning": "History could not be read or saved completely. Available entries are shown; copy them before closing the app and check access to the app data folder.",
    "cancel": "Cancel",
    "antiCheatContinue": "I understand the risks — Install anyway",
    "optiConfirm": "Install the optional OptiScaler DLSS-NR backend for this game?",
    "runtimeDownload": "Open official Microsoft download"
  }
};
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
  zh: {
    searchGames:'搜索游戏', searchGamesHint:'按游戏名称搜索…', filterDlss:'DLSS 状态', filterAddon:'附加组件', clearFilters:'清除筛选', allApis:'所有图形 API', allDlss:'所有 DLSS 状态', allAddons:'所有组件状态', filterReady:'可安装', hasDlss:'已有 DLSS', dlssCurrent:'DLSS 5 已安装／最新', addonPresent:'有附加组件', addonAbsent:'无附加组件', unknownApi:'未知 API', noMatchingGames:'没有匹配的游戏', changeFilters:'请更改搜索或清除筛选。', filteredCount:'显示 {0} / {1}', dx12Count:'{0} 个使用 DirectX 12', dlssCount:'{0} 个有 DLSS', setAutoScan:'自动扫描所有驱动器', setAutoScanHint:'默认关闭。始终扫描手动添加的文件夹。', setGroupGames:'按商店分组游戏', setGroupGamesHint:'关闭后，所有游戏和模拟器按名称排列，不再分组。', fBackend:'渲染后端', backendReShade:'ReShade（默认）', installedBackend:'已安装的后端', applyBackend:'应用后端更改', installOpti:'安装 OptiScaler DLSS-NR', operationCancelled:'已取消。游戏文件未更改。', fArchitecture:'架构', fRoute:'安装方式', routeNative:'原生 DLSS（RenoDX）', routeFeeder:'DLSS5-Feeder（无 DLSS / 不兼容的 DLSS）', cancel:'取消', antiCheatContinue:'理解风险，仍要安装', optiConfirm:'为此游戏安装可选的 OptiScaler DLSS-NR？', runtimeDownload:'打开 Microsoft 官方下载',
        errOptiVulkanLayer:'存在活动的全局 ReShade Vulkan 层。请先还原其管理的 Vulkan 安装；本程序不会为其他游戏禁用它。', errOptiConflict:'存在其他加载器或 mod。请先用其自身安装程序还原或移除该 mod。未覆盖任何冲突文件。', legacyDownloadHint:'无法校验官方 dgVoodoo2 下载。请检查网络后重试；现有安装未更改。',
    antiCheatWarningTitle:'警告：检测到反作弊', antiCheatWarning:'此游戏似乎使用反作弊。ReShade、Feeder 或 OptiScaler 可能导致崩溃、无法启动或封号。安装由您选择；继续前须明确接受风险。程序不会禁用或绕过反作弊。', errAntiCheatConsent:'检测到反作弊。再次点击安装，查看警告并决定是否继续。', antiCheatRiskAccepted:'仅本次安装已接受反作弊风险。', errManagedModpack:'检测到 Mod Organizer Stock Game / Root Builder（如 LoreRim）。为防止 ENB/ReShade 冲突，已阻止直接安装；请使用整合包管理器。仍可还原原始文件。', errLoaderConflict:'图形加载器或 ReShade 冲突，未覆盖文件。请还原 Swapper 或用原安装器管理 ENB/DXVK/ReShade。路径见日志。', errRuntimeArchitecture:'现有 DLSS 无法读取或架构不符。未覆盖；请先还原或修复。', restoreProfileWarning:'可选设置保存失败；继续还原原始文件。', errBackupInvalid:'备份无效或不完整，还原未完成。保留 _DLSS5_Backup，查看日志中的缺失文件；原件丢失时用启动器修复。不会删除未知文件。', nativeEffectsHint:'原生 DLSS 使用附加组件，而非 .fx。没有效果不代表失败。请在游戏中启用 DLSS 并检查组件。保留 Streamline 和帧生成文件。', backendHint:'按游戏选择；关闭游戏并点击应用／安装后才更改。各后端设置分别保留。', optiHint:'可选功能：需要 RTX 50、驱动 616.56+ 及启用原生 DLSS 的 64 位游戏。反作弊需确认风险。首次下载约 130 MB；不保证兼容。', optiDriverOld: 'NVIDIA 驱动低于 616.56。神经渲染模型文件随本程序一起提供，因此 OptiScaler 通常仍可运行。仅当模型在游戏中无法初始化时才需更新驱动。', optiCardOld: '不是 Blackwell 显卡（{0}）。随附的神经渲染模型是 NVIDIA 官方的，只在 Blackwell 上运行；上游说明较旧架构需要经过修改的 nvngx_dlssnr.dll，由你自行放到游戏旁边。已存在的文件绝不会被覆盖。可以照样安装试试，或改用 ReShade / Feeder 路线。', optiBridgeHint:'DX11/Vulkan 使用 DX12 桥接与 FSR 输出，而非原生 DLSS 输出。自动配置；游戏中仍须选择 DLSS。', optiVulkanHint:'更换 Vulkan 后端前请还原原始文件，并还原使用全局 ReShade Vulkan 层的安装。不会自动禁用其他游戏的层。', optiUnsupported:'仅支持 64 位 DX11/DX12/Vulkan 游戏，不支持 DX8/DX9、OpenGL 或模拟器。', optiNeedsDlss:'需要游戏原生 DLSS 管线。未找到原始 DLL；复制或注入的 DLL 不算。', errOptiHardware:'需要 RTX 50 及 NVIDIA 驱动 616.56 或更新版。', errOptiDownload:'官方组件下载或验证失败。请检查网络重试；现有后端未更改。', componentQuarantined: '组件已下载并与官方校验和一致，但在使用前消失了 - 这是杀毒软件隔离，不是网络问题。请允许该文件或将本程序的 components 文件夹加入排除项后重试。游戏未被修改。', driverNeuralFault: '上游实测显示，驱动 616.64 及更新版本（{0}）在使用 RenoDX DLSS 5 附加组件时，每次推理都会在 NVIDIA 自家的神经运行时内部崩溃；616.56 是最后一个可以跑通的版本。仍可继续安装 - 若游戏中始终看不到神经处理，请回退驱动。', rivalConsumerSetAside: '游戏旁边还有 {1}：第二个 RenoDX DLSS 使用者。两个无法同时运行——无论选择哪条路线，ReShade 只保留一个并丢弃另一个。它已移入备份，恢复原始文件时会放回。', oldShaderCompiler: '游戏目录中的 {0} 版本为 {1}，早于 Windows 10 SDK，而 Windows 会优先加载它而不是 System32 中的最新副本。神经处理通道以 Shader Model 5.1 编译，该版本无法构建，因此它会悄悄地什么都不做，尽管帧仍被报告为已交付。安装会把它移入备份，让游戏改用 Windows 自带的副本；还原会把它放回去。', errOptiPayload:'OptiScaler 文件不全、架构错误或验证失败。', errGameRunning:'安装、切换或还原前，请关闭游戏及辅助进程。', errProcessCheck:'无法确认游戏已关闭。请重启程序再试；尚未开始安装。', errJobBusy:'正在安装或还原，请等待。', errBackendRecovery:'操作中断。关闭游戏并还原原始文件，保留备份。', unsupportedRendererHint:'Feeder 不支持原生 DX10；如可用，请在游戏中选择 DX11。不能自动安装此渲染器。', legacyRendererHint:'DX8/9 需要 dgVoodoo2 转 DX11，从官方来源下载。若无深度，请关闭 MSAA/SSAA。', runtimeRequiredHint:'请安装或修复 Microsoft 官方 Visual C++ 运行库。32 位游戏需要 x86 和 x64。', xeniaUiHint:'Xenia 界面修正为实验功能，预设不保证所有 HUD 正常。仍有问题请提供游戏名及 ReShade/Feeder 日志。', emulatorDepthHint:'画面异常时，请在 ReShade 选择正确的深度缓冲区。', rXboxProtected:'受保护的 Xbox 包：请移动或重装到 XboxGames', copyFailed:'复制失败。请选中文字按 Ctrl+C 或重试。', historyLoadFailed:'历史加载失败，请重新打开此页。', historySaveWarning:'历史未完整读取或保存。关闭前请复制现有记录，并检查程序数据文件夹权限。'
  },
  'zh-TW': {
    searchGames:'搜尋遊戲', searchGamesHint:'依遊戲名稱搜尋…', filterDlss:'DLSS 狀態', filterAddon:'附加元件', clearFilters:'清除篩選', allApis:'所有圖形 API', allDlss:'所有 DLSS 狀態', allAddons:'所有元件狀態', filterReady:'可安裝', hasDlss:'已有 DLSS', dlssCurrent:'DLSS 5 已安裝／最新', addonPresent:'有附加元件', addonAbsent:'無附加元件', unknownApi:'未知 API', noMatchingGames:'沒有符合的遊戲', changeFilters:'請更改搜尋或清除篩選。', filteredCount:'顯示 {0} / {1}', dx12Count:'{0} 個使用 DirectX 12', dlssCount:'{0} 個有 DLSS', setAutoScan:'自動掃描所有磁碟', setAutoScanHint:'預設關閉。手動新增的資料夾一律掃描。', setGroupGames:'依商店分組遊戲', setGroupGamesHint:'關閉後，所有遊戲與模擬器依名稱排列，不再分組。', fBackend:'繪圖後端', backendReShade:'ReShade（預設）', installedBackend:'已安裝的後端', applyBackend:'套用後端變更', installOpti:'安裝 OptiScaler DLSS-NR', operationCancelled:'已取消。遊戲檔案未變更。', fArchitecture:'架構', fRoute:'安裝方式', routeNative:'原生 DLSS（RenoDX）', routeFeeder:'DLSS5-Feeder（無 DLSS / 不相容的 DLSS）', cancel:'取消', antiCheatContinue:'理解風險，仍要安裝', optiConfirm:'為此遊戲安裝選用的 OptiScaler DLSS-NR？', runtimeDownload:'開啟 Microsoft 官方下載',
    antiCheatWarningTitle:'警告：偵測到反作弊', antiCheatWarning:'此遊戲似乎使用反作弊。ReShade、Feeder 或 OptiScaler 可能造成當機、無法啟動或帳號停權。安裝由您選擇；繼續前須明確接受風險。程式不會停用或繞過反作弊。', errAntiCheatConsent:'偵測到反作弊。再次按安裝，查看警告並決定是否繼續。', antiCheatRiskAccepted:'僅本次安裝已接受反作弊風險。', errManagedModpack:'偵測到 Mod Organizer Stock Game / Root Builder（如 LoreRim）。為避免 ENB/ReShade 衝突，已阻止直接安裝；請使用模組包管理器。仍可還原原始檔。', errLoaderConflict:'圖形載入器或 ReShade 衝突，未覆寫檔案。請還原 Swapper 或用原安裝程式管理 ENB/DXVK/ReShade。路徑見紀錄。', errRuntimeArchitecture:'現有 DLSS 無法讀取或架構不符。未覆寫；請先還原或修復。', restoreProfileWarning:'選用設定儲存失敗；繼續還原原始檔。', errBackupInvalid:'備份無效或不完整，還原未完成。保留 _DLSS5_Backup，查看紀錄中的缺失檔案；原檔遺失時用啟動器修復。不會刪除未知檔案。', nativeEffectsHint:'原生 DLSS 使用附加元件，而非 .fx。沒有效果不代表失敗。請在遊戲中啟用 DLSS 並檢查元件。保留 Streamline 和影格生成檔案。', backendHint:'依遊戲選擇；關閉遊戲並按套用／安裝後才變更。各後端設定分別保留。', optiHint:'選用功能：需要 RTX 50、驅動程式 616.56+ 及啟用原生 DLSS 的 64 位元遊戲。反作弊需確認風險。首次下載約 130 MB；不保證相容。', optiDriverOld: 'NVIDIA 驅動程式低於 616.56。神經渲染模型檔案隨本程式提供，因此 OptiScaler 通常仍可運作。只有在模型於遊戲中無法初始化時才需更新驅動程式。', optiCardOld: '不是 Blackwell 顯示卡（{0}）。隨附的神經渲染模型是 NVIDIA 官方的，只在 Blackwell 上執行；上游說明較舊架構需要經過修改的 nvngx_dlssnr.dll，由你自行放到遊戲旁邊。已存在的檔案絕不會被覆寫。可以照樣安裝試試，或改用 ReShade / Feeder 路線。', optiBridgeHint:'DX11/Vulkan 使用 DX12 橋接與 FSR 輸出，而非原生 DLSS 輸出。自動設定；遊戲中仍須選擇 DLSS。', optiVulkanHint:'更換 Vulkan 後端前請還原原始檔，並還原使用全域 ReShade Vulkan 層的安裝。不會自動停用其他遊戲的層。', optiUnsupported:'僅支援 64 位元 DX11/DX12/Vulkan 遊戲，不支援 DX8/DX9、OpenGL 或模擬器。', optiNeedsDlss:'需要遊戲原生 DLSS 管線。找不到原始 DLL；複製或注入的 DLL 不算。', errOptiHardware:'需要 RTX 50 及 NVIDIA 驅動程式 616.56 或更新版。', errOptiDownload:'官方元件下載或驗證失敗。請檢查網路重試；現有後端未變更。', componentQuarantined: '元件已下載並與官方校驗碼一致，但在使用前消失了 - 這是防毒軟體隔離，不是連線問題。請允許該檔案或將本程式的 components 資料夾加入排除清單後重試。遊戲未被修改。', driverNeuralFault: '上游實測顯示，驅動程式 616.64 及更新版本（{0}）在使用 RenoDX DLSS 5 附加元件時，每次推論都會在 NVIDIA 自家的神經執行環境內部當掉；616.56 是最後一個可以跑通的版本。仍可繼續安裝 - 若遊戲中始終看不到神經處理，請回退驅動程式。', rivalConsumerSetAside: '遊戲旁邊還有 {1}：第二個 RenoDX DLSS 使用者。兩個無法同時執行——無論選擇哪條路線，ReShade 只保留一個並捨棄另一個。它已移入備份，還原原始檔案時會放回。', oldShaderCompiler: '遊戲資料夾中的 {0} 版本為 {1}，早於 Windows 10 SDK，而 Windows 會優先載入它而非 System32 中的最新副本。神經處理通道以 Shader Model 5.1 編譯，該版本無法建置，因此它會靜靜地毫無作用，即使畫面仍被回報為已傳送。安裝會把它移入備份，讓遊戲改用 Windows 內建的副本；還原會把它放回去。', errOptiPayload:'OptiScaler 檔案不全、架構錯誤或驗證失敗。', errGameRunning:'安裝、切換或還原前，請關閉遊戲及輔助程序。', errProcessCheck:'無法確認遊戲已關閉。請重新啟動程式再試；尚未開始安裝。', errJobBusy:'正在安裝或還原，請稍候。', errBackendRecovery:'操作中斷。關閉遊戲並還原原始檔，保留備份。', unsupportedRendererHint:'Feeder 不支援原生 DX10；如可用，請在遊戲中選擇 DX11。無法自動安裝此繪圖器。', legacyRendererHint:'DX8/9 需要 dgVoodoo2 轉 DX11，從官方來源下載。若無深度，請關閉 MSAA/SSAA。', runtimeRequiredHint:'請安裝或修復 Microsoft 官方 Visual C++ 執行階段。32 位元遊戲需要 x86 和 x64。', xeniaUiHint:'Xenia 介面修正為實驗功能，預設不保證所有 HUD 正常。仍有問題請提供遊戲名及 ReShade/Feeder 紀錄。', emulatorDepthHint:'畫面異常時，請在 ReShade 選擇正確的深度緩衝區。', rXboxProtected:'受保護的 Xbox 套件：請移動或重新安裝至 XboxGames', copyFailed:'複製失敗。請選取文字按 Ctrl+C 或重試。', historyLoadFailed:'無法載入紀錄，請重新開啟此頁。', historySaveWarning:'紀錄未完整讀取或儲存。關閉前請複製現有紀錄，並檢查程式資料夾存取權限。'
  }
});
Object.assign(catalog, {
  ja: {
    searchGames:'ゲームを検索', searchGamesHint:'ゲーム名で検索…', filterDlss:'DLSS の状態', filterAddon:'アドオン', clearFilters:'絞り込みを解除', allApis:'すべての API', allDlss:'すべての DLSS 状態', allAddons:'すべてのアドオン状態', filterReady:'インストール可能', hasDlss:'DLSS あり', dlssCurrent:'DLSS 5 導入済み／最新', addonPresent:'アドオンあり', addonAbsent:'アドオンなし', unknownApi:'不明な API', noMatchingGames:'該当するゲームはありません', changeFilters:'検索語を変更するか絞り込みを解除してください。', filteredCount:'{1} 件中 {0} 件表示', dx12Count:'DirectX 12：{0} 件', dlssCount:'DLSS あり：{0} 件', setAutoScan:'すべてのドライブを自動スキャン', setAutoScanHint:'初期設定はオフ。手動追加したフォルダーは常にスキャンします。', setGroupGames:'ストア別にゲームを分類', setGroupGamesHint:'オフにするとゲームとエミュレーターを名前順の一覧にまとめます。', fBackend:'描画バックエンド', backendReShade:'ReShade（既定）', installedBackend:'導入済みバックエンド', applyBackend:'バックエンドの変更を適用', installOpti:'OptiScaler DLSS-NR をインストール', operationCancelled:'キャンセルしました。ゲームファイルは変更していません。', fArchitecture:'アーキテクチャ', fRoute:'インストール方式', routeNative:'ネイティブ DLSS（RenoDX）', routeFeeder:'DLSS5-Feeder（DLSS なし / 非対応 DLSS）', cancel:'キャンセル', antiCheatContinue:'危険性を理解してインストール', optiConfirm:'このゲームに追加の OptiScaler DLSS-NR をインストールしますか？', runtimeDownload:'Microsoft 公式ダウンロードを開く',
    antiCheatWarningTitle:'警告：アンチチートを検出', antiCheatWarning:'このゲームはアンチチートを使用している可能性があります。ReShade、Feeder、OptiScaler によりクラッシュ、起動失敗、アカウント停止が発生する恐れがあります。導入は任意です。続行には危険性への明示的な同意が必要です。アンチチートの無効化や回避は行いません。', errAntiCheatConsent:'アンチチートを検出しました。再度インストールを押し、警告を確認して選択してください。', antiCheatRiskAccepted:'今回のインストールに限り危険性への同意を確認しました。', errManagedModpack:'Mod Organizer Stock Game / Root Builder（LoreRim など）を検出。ENB/ReShade との競合を防ぐため直接導入を停止しました。MOD 管理ツールを使用してください。元のファイルへの復元は可能です。', errLoaderConflict:'描画ローダーまたは ReShade が競合しています。上書きしていません。Swapper を復元するか、ENB/DXVK/ReShade の元のインストーラーで管理してください。パスはログにあります。', errRuntimeArchitecture:'既存 DLSS が読み取れないかアーキテクチャが異なります。未上書きです。先に復元・修復してください。', restoreProfileWarning:'任意設定を保存できませんでした。元のファイルの復元は続行します。', errBackupInvalid:'バックアップが不完全または無効で、復元未完了です。_DLSS5_Backup を保持し、ログの不足ファイルを確認してください。原本紛失時はランチャーで修復してください。不明なファイルは削除しません。', nativeEffectsHint:'ネイティブ DLSS は .fx ではなくアドオンを使います。エフェクトがないだけでは失敗とは限りません。ゲームの DLSS を有効にしてアドオンを確認してください。Streamline とフレーム生成ファイルは保持します。', backendHint:'ゲームごとの設定です。ゲームを閉じ、適用／インストールすると変更されます。各バックエンドの設定は別々に保持します。', optiHint:'任意機能。RTX 50、ドライバー 616.56+、ネイティブ DLSS を有効にした 64 ビットゲームが必要です。アンチチートの危険性に同意が必要。初回約 130 MB。互換性は保証しません。', optiDriverOld: 'NVIDIA ドライバーが 616.56 より古いです。ニューラルレンダリングのモデルファイルは本アプリに同梱されているため、通常は OptiScaler も動作します。ゲーム内でモデルが初期化されない場合のみドライバーを更新してください。', optiCardOld: 'Blackwell 世代のカードではありません（{0}）。同梱のニューラルレンダリング モデルは NVIDIA 純正で、Blackwell で動作します。上流の説明では、それより古いアーキテクチャには改変された nvngx_dlssnr.dll が必要で、これはご自身で用意してゲームの隣に置きます。既存のファイルが上書きされることはありません。このまま試すか、ReShade または Feeder の経路をお使いください。', optiBridgeHint:'DX11/Vulkan はネイティブ DLSS 出力ではなく DX12 ブリッジと FSR 出力を使用します。自動設定されますが、ゲームでは DLSS を選択してください。', optiVulkanHint:'Vulkan の変更前に元のファイルへ復元し、使用中のグローバル ReShade Vulkan 層の導入も復元してください。他ゲームの層を自動で無効化しません。', optiUnsupported:'64 ビット DX11/DX12/Vulkan ゲームのみ。DX8/DX9、OpenGL、エミュレーターは対象外です。', optiNeedsDlss:'ゲーム本来の DLSS 処理が必要です。元の DLL が見つかりません。コピー・注入した DLL だけでは利用できません。', errOptiHardware:'RTX 50 と NVIDIA ドライバー 616.56 以降が必要です。', errOptiDownload:'公式コンポーネントの取得・検証に失敗。接続を確認して再試行してください。現在のバックエンドは未変更です。', componentQuarantined: 'コンポーネントはダウンロードされ公式チェックサムと一致しましたが、使用前に消えました - 接続ではなくウイルス対策ソフトの検疫です。ファイルを許可するか、本アプリの components フォルダーを除外してから再試行してください。ゲームは変更されていません。', driverNeuralFault: '上流の計測では、ドライバー 616.64 以降（{0}）は RenoDX DLSS 5 アドオンとの組み合わせで毎回 NVIDIA 自身のニューラルランタイム内部で例外になります。完走が確認された最後は 616.56 です。このまま導入しても構いません - ゲーム内でニューラル処理が現れない場合はドライバーを戻してください。', rivalConsumerSetAside: 'ゲームの横に {1} がありました：2 つ目の RenoDX DLSS コンシューマーです。2 つは同時に動作できず、選んだルートに関係なく ReShade は片方だけを残します。バックアップに移動しました。復元で元に戻ります。', oldShaderCompiler: 'ゲームフォルダーの {0} はバージョン {1} で、Windows 10 SDK より古く、Windows は System32 の最新版よりこちらを優先して読み込みます。ニューラル パスは Shader Model 5.1 としてコンパイルされますが、このバージョンではビルドできないため、フレームは配信済みと報告されたまま、何も行われません。インストール時にこのファイルはバックアップへ移され、ゲームは Windows のコピーを使います。復元で元に戻ります。', errOptiPayload:'OptiScaler のファイル不足、アーキテクチャ不一致、または検証失敗です。', errGameRunning:'インストール・切替・復元の前にゲームと補助プロセスを閉じてください。', errProcessCheck:'ゲームの終了を確認できません。アプリを再起動してください。インストールは未開始です。', errJobBusy:'インストールまたは復元中です。お待ちください。', errBackendRecovery:'操作が中断されました。ゲームを閉じて元のファイルに復元してください。バックアップを保持してください。', unsupportedRendererHint:'Feeder はネイティブ DX10 非対応。可能ならゲームで DX11 を選んでください。この描画方式では自動導入できません。', legacyRendererHint:'DX8/9 は公式配布の dgVoodoo2 で DX11 に変換します。深度が取得できない場合は MSAA/SSAA を無効にしてください。', runtimeRequiredHint:'Microsoft 公式 Visual C++ ランタイムを導入・修復してください。32 ビットゲームには x86 と x64 の両方が必要です。', xeniaUiHint:'Xenia の HUD 補正は実験的です。控えめな設定でも全ゲームの HUD は保証できません。不具合時はゲーム名と ReShade/Feeder ログを共有してください。', emulatorDepthHint:'画像が不正な場合、ReShade で正しい深度バッファーを選択してください。', rXboxProtected:'保護された Xbox パッケージ：XboxGames に移動・再インストールしてください', copyFailed:'コピーできません。文字を選択して Ctrl+C を押すか、再試行してください。', historyLoadFailed:'履歴を読み込めません。ページを開き直してください。', historySaveWarning:'履歴を完全に読み書きできませんでした。終了前に表示中の履歴をコピーし、アプリのデータフォルダーへのアクセス権を確認してください。'
  },
  ko: {
    searchGames:'게임 검색', searchGamesHint:'게임 제목으로 검색…', filterDlss:'DLSS 상태', filterAddon:'추가 기능', clearFilters:'필터 초기화', allApis:'모든 API', allDlss:'모든 DLSS 상태', allAddons:'모든 추가 기능 상태', filterReady:'설치 가능', hasDlss:'DLSS 있음', dlssCurrent:'DLSS 5 설치됨 / 최신', addonPresent:'추가 기능 있음', addonAbsent:'추가 기능 없음', unknownApi:'알 수 없는 API', noMatchingGames:'일치하는 게임 없음', changeFilters:'검색어를 바꾸거나 필터를 초기화하세요.', filteredCount:'{1}개 중 {0}개 표시', dx12Count:'DirectX 12: {0}개', dlssCount:'DLSS 있음: {0}개', setAutoScan:'모든 드라이브 자동 검사', setAutoScanHint:'기본값은 꺼짐입니다. 직접 추가한 폴더는 항상 검사합니다.', setGroupGames:'스토어별 게임 분류', setGroupGamesHint:'끄면 모든 게임과 에뮬레이터를 이름순으로 함께 표시합니다.', fBackend:'렌더링 백엔드', backendReShade:'ReShade (기본값)', installedBackend:'설치된 백엔드', applyBackend:'백엔드 변경 적용', installOpti:'OptiScaler DLSS-NR 설치', operationCancelled:'취소됨. 게임 파일은 변경되지 않았습니다.', fArchitecture:'아키텍처', fRoute:'설치 방식', routeNative:'네이티브 DLSS (RenoDX)', routeFeeder:'DLSS5-Feeder (DLSS 없음 / 호환되지 않는 DLSS)', cancel:'취소', antiCheatContinue:'위험을 이해하며 설치 계속', optiConfirm:'이 게임에 선택 사항인 OptiScaler DLSS-NR을 설치할까요?', runtimeDownload:'Microsoft 공식 다운로드 열기',
    antiCheatWarningTitle:'경고: 안티치트 감지됨', antiCheatWarning:'이 게임은 안티치트를 사용하는 것으로 보입니다. ReShade, Feeder, OptiScaler는 충돌, 실행 실패, 계정 정지를 유발할 수 있습니다. 설치는 선택 사항이며 계속하려면 위험에 명시적으로 동의해야 합니다. 안티치트를 끄거나 우회하지 않습니다.', errAntiCheatConsent:'안티치트가 감지되었습니다. 설치를 다시 눌러 경고를 확인하고 선택하세요.', antiCheatRiskAccepted:'이번 설치 시도에 한해서 위험에 동의했습니다.', errManagedModpack:'Mod Organizer Stock Game / Root Builder(LoreRim 등)가 감지되었습니다. ENB/ReShade 충돌 방지를 위해 직접 설치를 차단합니다. 모드팩 관리자를 사용하세요. 원본 복원은 가능합니다.', errLoaderConflict:'그래픽 로더 또는 ReShade 충돌입니다. 덮어쓰지 않았습니다. Swapper를 복원하거나 원래 설치 도구로 ENB/DXVK/ReShade를 관리하세요. 경로는 로그에 있습니다.', errRuntimeArchitecture:'기존 DLSS를 읽을 수 없거나 아키텍처가 다릅니다. 덮어쓰지 않았습니다. 먼저 복원 또는 복구하세요.', restoreProfileWarning:'선택 설정 저장 실패. 원본 파일 복원은 계속합니다.', errBackupInvalid:'백업이 불완전하거나 잘못되어 복원이 완료되지 않았습니다. _DLSS5_Backup을 보존하고 로그의 누락 파일을 확인하세요. 원본 분실 시 런처로 복구하세요. 알 수 없는 파일은 삭제하지 않습니다.', nativeEffectsHint:'네이티브 DLSS는 .fx 효과가 아닌 추가 기능을 사용합니다. 효과 없음만으로 실패를 뜻하지 않습니다. 게임에서 DLSS를 켜고 추가 기능을 확인하세요. Streamline과 프레임 생성 파일은 보존됩니다.', backendHint:'게임별 선택입니다. 게임 종료 후 적용/설치를 눌러야 변경됩니다. 각 백엔드 설정은 별도로 보존됩니다.', optiHint:'선택 기능. RTX 50, 드라이버 616.56+, 네이티브 DLSS를 켠 64비트 게임이 필요합니다. 안티치트 위험 확인이 필요합니다. 첫 다운로드 약 130 MB. 호환성은 보장하지 않습니다.', optiDriverOld: 'NVIDIA 드라이버가 616.56보다 이전입니다. 뉴럴 렌더링 모델 파일은 이 앱에 포함되어 있으므로 OptiScaler는 대개 그대로 작동합니다. 게임에서 모델이 초기화되지 않을 때만 드라이버를 업데이트하세요.', optiCardOld: 'Blackwell 카드가 아닙니다({0}). 함께 제공되는 뉴럴 렌더링 모델은 NVIDIA 정품이며 Blackwell에서 동작합니다. 상위 프로젝트는 더 오래된 아키텍처에는 수정된 nvngx_dlssnr.dll이 필요하며 사용자가 직접 게임 옆에 두어야 한다고 안내합니다. 기존 파일은 절대 덮어쓰지 않습니다. 그대로 설치해 확인하거나 ReShade 또는 Feeder 경로를 사용하세요.', optiBridgeHint:'DX11/Vulkan은 네이티브 DLSS 출력 대신 DX12 브리지와 FSR 출력을 사용합니다. 자동 설정되며 게임에서는 DLSS 선택을 유지하세요.', optiVulkanHint:'Vulkan 백엔드 변경 전에 원본을 복원하고 활성 전역 ReShade Vulkan 설치도 복원하세요. 다른 게임의 계층을 자동으로 끄지 않습니다.', optiUnsupported:'64비트 DX11/DX12/Vulkan 게임 전용입니다. DX8/DX9, OpenGL, 에뮬레이터는 지원하지 않습니다.', optiNeedsDlss:'게임의 원래 DLSS 파이프라인이 필요합니다. 원본 DLL이 없습니다. 복사하거나 주입한 DLL만으로는 사용할 수 없습니다.', errOptiHardware:'RTX 50 및 NVIDIA 드라이버 616.56 이상이 필요합니다.', errOptiDownload:'공식 구성 요소 다운로드 또는 검증 실패. 연결을 확인하세요. 기존 백엔드는 변경하지 않았습니다.', componentQuarantined: '구성 요소를 내려받아 공식 체크섬과 일치했지만 사용되기 전에 사라졌습니다 - 연결 문제가 아니라 백신의 격리입니다. 파일을 허용하거나 앱의 components 폴더를 제외한 뒤 다시 시도하세요. 게임은 변경되지 않았습니다.', driverNeuralFault: '업스트림 측정에 따르면 드라이버 616.64 이상({0})은 RenoDX DLSS 5 애드온과 함께 사용할 때 매 평가마다 NVIDIA 자체 뉴럴 런타임 내부에서 오류가 납니다. 완주가 확인된 마지막 버전은 616.56입니다. 그래도 설치해도 괜찮습니다 - 게임에서 뉴럴 처리가 전혀 나타나지 않으면 드라이버를 되돌리세요.', rivalConsumerSetAside: '게임 옆에 {1}이(가) 있었습니다: 두 번째 RenoDX DLSS 소비자입니다. 두 개는 함께 실행될 수 없어, 어떤 경로를 선택했든 ReShade가 하나만 남기고 다른 하나를 버립니다. 백업으로 옮겼으며, 복원하면 되돌아옵니다.', oldShaderCompiler: '게임 폴더의 {0}은(는) 버전 {1}로 Windows 10 SDK보다 오래되었으며, Windows는 System32의 최신 사본보다 이 파일을 우선해서 불러옵니다. 신경망 패스는 Shader Model 5.1로 컴파일되는데 이 버전은 이를 빌드할 수 없어, 프레임은 전달된 것으로 보고되지만 실제로는 아무 일도 일어나지 않습니다. 설치 시 이 파일은 백업으로 옮겨져 게임이 Windows 사본을 사용하며, 복원하면 되돌아옵니다.', errOptiPayload:'OptiScaler 파일 누락, 아키텍처 불일치 또는 검증 실패입니다.', errGameRunning:'설치, 전환, 복원 전에 게임과 보조 프로세스를 종료하세요.', errProcessCheck:'게임 종료를 확인하지 못했습니다. 앱을 다시 시작하세요. 설치하지 않았습니다.', errJobBusy:'설치 또는 복원 중입니다. 기다려 주세요.', errBackendRecovery:'작업이 중단되었습니다. 게임 종료 후 원본을 복원하세요. 백업을 보존하세요.', unsupportedRendererHint:'Feeder는 네이티브 DX10을 지원하지 않습니다. 가능하면 게임에서 DX11을 선택하세요. 이 렌더러는 자동 설치할 수 없습니다.', legacyRendererHint:'DX8/9는 공식 dgVoodoo2로 DX11로 변환합니다. 깊이가 없으면 MSAA/SSAA를 끄세요.', runtimeRequiredHint:'공식 Microsoft Visual C++ 런타임을 설치/복구하세요. 32비트 게임은 x86과 x64 모두 필요합니다.', xeniaUiHint:'Xenia HUD 보정은 실험적입니다. 보수적인 설정도 모든 HUD를 보장하지 못합니다. 문제가 지속되면 게임명과 ReShade/Feeder 로그를 보내세요.', emulatorDepthHint:'화면이 잘못되면 ReShade에서 올바른 깊이 버퍼를 선택하세요.', rXboxProtected:'보호된 Xbox 패키지: XboxGames로 이동하거나 다시 설치하세요', copyFailed:'복사 실패. 텍스트 선택 후 Ctrl+C를 누르거나 다시 시도하세요.', historyLoadFailed:'기록을 불러오지 못했습니다. 페이지를 다시 여세요.', historySaveWarning:'기록 읽기/저장이 일부 실패했습니다. 종료 전 표시된 기록을 복사하고 앱 데이터 폴더 접근 권한을 확인하세요.'
  }
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
Object.assign(catalog, {
});
// Keep manual-renderer controls and About actions available in all UI locales.
const rendererStrings = {
  en: ['Automatic (detected: {0})', 'Match the renderer used by the game or wrapper. Saved per executable; game settings are not changed.', 'Vulkan uses a shared ReShade layer, not local proxy DLLs. Restore originals before switching APIs.', 'Latest releases', 'Invalid renderer or executable selection.', 'Could not save the renderer choice. Try again.', 'Could not open the link. Try again.'],
  zh: ['自动（检测到：{0}）', '选择游戏或转换层实际使用的渲染器。按可执行文件保存，不修改游戏设置。', 'Vulkan 使用共享的 ReShade 层，而非本地代理 DLL。切换 API 前请恢复原始文件。', '最新版本', '渲染器或可执行文件选择无效。', '无法保存渲染器选择，请重试。', '无法打开链接，请重试。'],
  'zh-TW': ['自動（偵測到：{0}）', '選擇遊戲或轉換層實際使用的繪圖介面。依執行檔儲存，不修改遊戲設定。', 'Vulkan 使用共用的 ReShade 層，而非本機代理 DLL。切換 API 前請還原原始檔案。', '最新版本', '繪圖介面或執行檔選擇無效。', '無法儲存繪圖介面選擇，請重試。', '無法開啟連結，請重試。'],
  ja: ['自動（検出：{0}）', 'ゲームまたは変換レイヤーで使用する描画 API を選択します。実行ファイルごとに保存され、ゲーム設定は変更しません。', 'Vulkan はローカルのプロキシ DLL ではなく共有 ReShade レイヤーを使用します。API の切り替え前に元のファイルを復元してください。', '最新リリース', '描画 API または実行ファイルの選択が無効です。', '描画 API の選択を保存できませんでした。再試行してください。', 'リンクを開けませんでした。再試行してください。'],
  ko: ['자동 (감지: {0})', '게임이나 변환 계층이 사용하는 렌더러를 선택하세요. 실행 파일별로 저장되며 게임 설정은 바뀌지 않습니다.', 'Vulkan은 로컬 프록시 DLL 대신 공유 ReShade 계층을 사용합니다. API를 바꾸기 전에 원본을 복원하세요.', '최신 릴리스', '렌더러 또는 실행 파일 선택이 올바르지 않습니다.', '렌더러 선택을 저장하지 못했습니다. 다시 시도하세요.', '링크를 열지 못했습니다. 다시 시도하세요.']
};
const rendererKeys = ['apiAutomatic', 'apiOverrideHint', 'apiVulkanHint', 'latestReleases', 'errApiChoice', 'errApiSave', 'errProjectLink'];
for (const [code, values] of Object.entries(rendererStrings)) {
  rendererKeys.forEach((key, index) => { catalog[code][key] = values[index]; });
  catalog[code].errBackendVulkanSwitch = values[2];
}
const aliases = {
  errOptiConflict: 'errLoaderConflict',
  errOptiVulkanLayer: 'optiVulkanHint',
  errBackendVulkanSwitch: 'optiVulkanHint',
  legacyDownloadHint: 'errOptiDownload'
};
function locale(code) {
  const exact = Object.keys(catalog).find(key => key.toLowerCase() === String(code).toLowerCase());
  if (exact) return exact;
  const value = String(code || '').toLowerCase();
  if (/^zh-(?:tw|hk|hant)/.test(value)) return 'zh-TW';
  return Object.hasOwn(catalog, value.split('-')[0]) ? value.split('-')[0] : 'en';
}
function strings(code) {
  const source = catalog[locale(code)];
  const result = { ...source };
  for (const [key, alias] of Object.entries(aliases)) if (!Object.hasOwn(result, key)) result[key] = source[alias];
  return result;
}
function t(code, key, ...args) {
  const value = strings(code)[key] ?? catalog.en[key] ?? key;
  return String(value).replace(/\{(\d+)\}/g, (match, index) => args[index] === undefined ? match : String(args[index]));
}
const api = { catalog, strings, t, locale, keys: Object.keys(catalog.en) };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else {
  root.featureI18n = api;
  for (const meta of root.i18n.LANGS) {
    for (const key of api.keys) {
      if (Object.hasOwn(strings(meta.code), key)) root.i18n.S[meta.code][key] = (...args) => t(meta.code, key, ...args);
    }
  }
}
})(typeof window !== 'undefined' ? window : globalThis);
