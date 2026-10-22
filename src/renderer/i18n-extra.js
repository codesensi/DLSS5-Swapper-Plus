'use strict';
// Additional languages. Same key set as i18n.js; product names are left alone.
(function () {
const add = window.i18n.add;

add({ code: 'zh-TW', label: 'Chinese (Traditional)', native: '繁體中文', dir: 'ltr' }, {
  navHome: '首頁', navGames: '遊戲', navHistory: '紀錄', navSettings: '設定', navAbout: '關於',
    navOverlay: '疊加層',
  ready: '就緒', scanning: '掃描中…', fetchingArt: '取得封面…',
  dropTitle: '將遊戲資料夾拖到這裡', or: '或', browse: '瀏覽資料夾',
  recentTitle: '最近的遊戲', viewAll: '檢視全部', recentEmpty: '尚未安裝 — 為遊戲安裝 DLSS 5 後會顯示在這裡。',
  logTitle: '活動紀錄', clear: '清除', logEmpty: '目前沒有內容。',
  gamesTitle: '遊戲', addGame: '新增遊戲', addFolder: '新增資料夾', rescan: '重新掃描',
  found: (n, d) => `找到 ${n} 個 · ${d} 個使用 DirectX 12`, readyFor: (n) => `${n} 個可用於 DLSS 5`,
  fExe: '執行檔', fApi: '繪圖 API', fIn: '遊戲內 DLSS', fNew: '新版 DLSS', fAddon: 'DLSS 5 附加元件', fReShade: 'ReShade',
  installed: '已安裝', notPresent: '不存在', notInstalled: '未安裝', none: '無',
  install: '安裝 DLSS 5', installing: '安裝中…', restore: '還原原始檔', restoring: '還原中…',
  jobReady: '就緒。', noDlss: '無 DLSS', addonShort: '附加元件',
    rInstaller: '安裝程式資料夾', rNoExe: '沒有執行檔', rNoGraphics: '沒有 3D 執行檔', rError: '掃描失敗',
    navAddons: '附加元件', addonActivate: '啟用', addonActive: '已啟用', addonShipped: '隨程式附帶',
    addonHint: '程式內建的附加元件一律會安裝。可同時啟用下列任意多個。',
    addonNameClash: (n) => `已關閉 ${n}：兩個版本不能共用一個檔名。`,
    addonDeactivate: '停用', addonReplaces: '取代內建附加元件',
    addonFlicker: '在部分遊戲中可能出現閃爍',
    addonAddTitle: '新增附加元件', addonName: '名稱', addonDesc: '說明',
    addonDescHint: '每行一項', cancel: '取消', addonRemove: '移除',
    addonTag: '標籤',
  histEmpty: '尚無安裝紀錄。', restored: '已還原', replacedAdded: (r, a) => `取代 ${r} · 新增 ${a}`,
  setFolders: '已掃描的資料夾', setAdd: '新增', setLibrary: '程式庫檔案', setReset: '重設',
    setRoots: '在磁碟上找到',
  setPosters: '封面', setSaved: (n) => `已儲存 ${n} 個`, setLang: '語言',
    aboutTitle: 'DLSS 5 Swapper Plus', aboutBody: '為你的遊戲裝上 DLSS 5，也能隨時還原。', aboutBy: '由 codesensi 開發',
  agoNow: '剛剛', agoMin: (n) => `${n} 分鐘前`, agoHour: (n) => `${n} 小時前`, agoDay: (n) => `${n} 天前`,
  artFound: (a, b) => `封面：${b} 個中找到 ${a} 個`, libReady: (n, d) => `程式庫就緒 — ${n} 個遊戲，${d} 個使用 DirectX 12`
});
})();
