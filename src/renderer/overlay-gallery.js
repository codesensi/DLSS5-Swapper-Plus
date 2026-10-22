'use strict';
(()=>{
const $=id=>document.getElementById(id);
const olLang=()=>{const l=String(document.documentElement.lang||'en').toLowerCase();return (l.startsWith('zh-tw')||l.startsWith('zh-hant'))?'zh-tw':l.startsWith('zh')?'zh':l.startsWith('ja')?'ja':l.startsWith('ko')?'ko':null;};
const GALLERY_ZH={"Interactive demo · no game changes":"交互式演示 · 不会改动游戏","Saved.":"已保存。","Choose your style. Preview it, then make it yours.":"选择你的风格，先预览，再定为你的。","Install overlay with DLSS":"随 DLSS 安装叠加层","＋ Add Overlay":"＋ 添加叠加层","Developer files":"开发者文件","Hotkey":"热键","Create theme":"创建主题","Emerald":"翠玉绿","Azure":"天青蓝","Amethyst":"紫水晶","✓ Selected":"✓ 已选择","Select":"选择","◉ Preview":"◉ 预览","Delete this theme":"删除此主题","Custom native overlay: browser preview unavailable. Only test trusted files.":"自定义原生叠加层：无法在浏览器中预览。请只测试可信文件。","Install separately":"单独安装","Remove":"移除","Existing installations":"现有安装","Remove overlay only":"仅移除叠加层","Overlay service is not running. Restart DLSS 5 Swapper Plus, then press the hotkey in game.":"叠加层服务未运行。请重启 DLSS 5 Swapper Plus，然后在游戏内按下热键。","Overlay service connected to a running game.":"叠加层服务已连接到正在运行的游戏。","Overlay service ready, waiting for a game. Keep DLSS 5 Swapper Plus open and press the hotkey in game.":"叠加层服务已就绪，正在等待游戏。请保持 DLSS 5 Swapper Plus 开启，并在游戏内按下热键。","Done.":"完成。","My theme":"我的主题","Create a theme":"创建主题","Pick an accent colour. The panel's other shades are derived from it.":"选择一个强调色。面板的其他色阶由它派生。","Colour":"颜色","Name":"名称","Cancel":"取消","Save":"保存","Give the theme a name.":"请为主题命名。","Reserved / unsupported key. Try F9 or Ctrl + Shift + O.":"该按键被保留或不受支持。请尝试 F9 或 Ctrl + Shift + O。"};
// 日本語ローカライズ（オーバーレイ管理ページ）。製品名は英語のまま残す。
const GALLERY_JA={"Interactive demo · no game changes":"インタラクティブなデモ · ゲームは変更しません","Saved.":"保存しました。","Choose your style. Preview it, then make it yours.":"スタイルを選び、プレビューして、自分のものにしましょう。","Install overlay with DLSS":"DLSS と一緒にオーバーレイをインストール","＋ Add Overlay":"＋ オーバーレイを追加","Developer files":"開発者ファイル","Hotkey":"ホットキー","Create theme":"テーマを作成","Emerald":"エメラルド","Azure":"アジュール","Amethyst":"アメシスト","✓ Selected":"✓ 選択中","Select":"選択","◉ Preview":"◉ プレビュー","Delete this theme":"このテーマを削除","Custom native overlay: browser preview unavailable. Only test trusted files.":"カスタムネイティブ オーバーレイ:ブラウザー プレビューは利用できません。信頼できるファイルだけをテストしてください。","Install separately":"個別にインストール","Remove":"削除","Existing installations":"既存のインストール","Remove overlay only":"オーバーレイのみ削除","Overlay service is not running. Restart DLSS 5 Swapper Plus, then press the hotkey in game.":"オーバーレイ サービスが動作していません。DLSS 5 Swapper Plus を再起動してから、ゲーム内でホットキーを押してください。","Overlay service connected to a running game.":"オーバーレイ サービスが実行中のゲームに接続しました。","Overlay service ready, waiting for a game. Keep DLSS 5 Swapper Plus open and press the hotkey in game.":"オーバーレイ サービスは準備完了し、ゲームを待っています。DLSS 5 Swapper Plus を開いたまま、ゲーム内でホットキーを押してください。","Done.":"完了。","My theme":"マイテーマ","Create a theme":"テーマを作成","Pick an accent colour. The panel's other shades are derived from it.":"アクセント カラーを選択してください。パネルの他の色合いはここから派生します。","Colour":"カラー","Name":"名前","Cancel":"キャンセル","Save":"保存","Give the theme a name.":"テーマに名前を付けてください。","Reserved / unsupported key. Try F9 or Ctrl + Shift + O.":"予約キーまたは非対応のキーです。F9 か Ctrl + Shift + O をお試しください。"};
// 한국어 현지화(오버레이 관리 페이지). 제품명은 영문 유지.
const GALLERY_KO={"Interactive demo · no game changes":"대화형 데모 · 게임은 변경하지 않습니다","Saved.":"저장했습니다.","Choose your style. Preview it, then make it yours.":"스타일을 선택하고, 미리 보고, 나만의 것으로 만드세요.","Install overlay with DLSS":"DLSS와 함께 오버레이 설치","＋ Add Overlay":"＋ 오버레이 추가","Developer files":"개발자 파일","Hotkey":"단축키","Create theme":"테마 만들기","Emerald":"에메랄드","Azure":"아주르","Amethyst":"아메시스트","✓ Selected":"✓ 선택됨","Select":"선택","◉ Preview":"◉ 미리보기","Delete this theme":"이 테마 삭제","Custom native overlay: browser preview unavailable. Only test trusted files.":"사용자 지정 네이티브 오버레이: 브라우저 미리보기를 사용할 수 없습니다. 신뢰할 수 있는 파일만 테스트하세요.","Install separately":"개별 설치","Remove":"제거","Existing installations":"기존 설치","Remove overlay only":"오버레이만 제거","Overlay service is not running. Restart DLSS 5 Swapper Plus, then press the hotkey in game.":"오버레이 서비스가 실행 중이 아닙니다. DLSS 5 Swapper Plus를 다시 시작한 뒤 게임 내에서 단축키를 누르세요.","Overlay service connected to a running game.":"오버레이 서비스가 실행 중인 게임에 연결되었습니다.","Overlay service ready, waiting for a game. Keep DLSS 5 Swapper Plus open and press the hotkey in game.":"오버레이 서비스가 준비되어 게임을 기다리는 중입니다. DLSS 5 Swapper Plus를 연 상태로 게임 내에서 단축키를 누르세요.","Done.":"완료.","My theme":"내 테마","Create a theme":"테마 만들기","Pick an accent colour. The panel's other shades are derived from it.":"강조 색을 선택하세요. 패널의 다른 색조는 여기에서 파생됩니다.","Colour":"색상","Name":"이름","Cancel":"취소","Save":"저장","Give the theme a name.":"테마에 이름을 지어주세요.","Reserved / unsupported key. Try F9 or Ctrl + Shift + O.":"예약되었거나 지원되지 않는 키입니다. F9 또는 Ctrl + Shift + O를 시도하세요."};
// 繁體中文（臺灣用語）。術語對齊主詞典 zh-TW 塊：疊加層、附加元件、建立、儲存。
const GALLERY_ZH_TW={"Interactive demo · no game changes":"互動式示範 · 不會變更遊戲","Saved.":"已儲存。","Choose your style. Preview it, then make it yours.":"選擇你的風格，先預覽，再定為你的。","Install overlay with DLSS":"隨 DLSS 安裝疊加層","＋ Add Overlay":"＋ 新增疊加層","Developer files":"開發者檔案","Hotkey":"熱鍵","Create theme":"建立主題","Emerald":"翠玉綠","Azure":"天青藍","Amethyst":"紫水晶","✓ Selected":"✓ 已選擇","Select":"選擇","◉ Preview":"◉ 預覽","Delete this theme":"刪除此主題","Custom native overlay: browser preview unavailable. Only test trusted files.":"自訂原生疊加層：無法在瀏覽器中預覽。請只測試可信檔案。","Install separately":"個別安裝","Remove":"移除","Existing installations":"現有安裝","Remove overlay only":"僅移除疊加層","Overlay service is not running. Restart DLSS 5 Swapper Plus, then press the hotkey in game.":"疊加層服務未執行。請重新啟動 DLSS 5 Swapper Plus，然後在遊戲內按下熱鍵。","Overlay service connected to a running game.":"疊加層服務已連線到正在執行的遊戲。","Overlay service ready, waiting for a game. Keep DLSS 5 Swapper Plus open and press the hotkey in game.":"疊加層服務已就緒，正在等待遊戲。請保持 DLSS 5 Swapper Plus 開啟，並在遊戲內按下熱鍵。","Done.":"完成。","My theme":"我的主題","Create a theme":"建立主題","Pick an accent colour. The panel's other shades are derived from it.":"選擇一個強調色。面板的其他色階由它衍生。","Colour":"色彩","Name":"名稱","Cancel":"取消","Save":"儲存","Give the theme a name.":"請為主題命名。","Reserved / unsupported key. Try F9 or Ctrl + Shift + O.":"該按鍵被保留或不受支援。請嘗試 F9 或 Ctrl + Shift + O。"};
const GALLERY_MAPS={zh:GALLERY_ZH,ja:GALLERY_JA,ko:GALLERY_KO,'zh-tw':GALLERY_ZH_TW};
const text=(en)=>{const map=GALLERY_MAPS[olLang()];return (map&&map[en])||en;};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const builtInThemes=[['green','Emerald'],['blue','Azure'],['purple','Amethyst']];
// The saved custom theme sits alongside the built-in three; its label is
// whatever the person typed, in either language.
const themeList=()=>prefs&&prefs.custom
  ? [...builtInThemes,['custom',prefs.custom.name,prefs.custom.name]]
  : builtInThemes;
let prefs,busy=false,generation=0,observer,draft;
const keyName=k=>k>=112?`F${k-111}`:({32:'Space',33:'PageUp',34:'PageDown',35:'End',37:'Left',38:'Up',39:'Right',40:'Down',45:'Insert',46:'Delete'}[k]||String.fromCharCode(k));
const keyLabel=h=>[h.mods&1?'Ctrl':'',h.mods&2?'Alt':'',h.mods&4?'Shift':'',keyName(h.key)].filter(Boolean).join(' + ');
const button=(action,id,label)=>`<button class="ghost sm" data-ol-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
function dispose(){observer?.disconnect();document.querySelectorAll('.ol-static-panel').forEach(e=>e._overlayDispose?.());}
function preview(id){const root=$('olPreview');root._overlayDispose?.();window.applyOverlayTheme(root,{theme:id,custom:prefs&&prefs.custom});window.mountOverlayLive(root,{designOnly:true});$('olPreviewLabel').textContent=text('Interactive demo · no game changes','معاينة تفاعلية · لا تغيّر اللعبة');$('olPreviewDialog').showModal();}
async function save(patch){if(busy)return false;busy=true;try{const r=await window.lab.saveOverlayPreferences(patch);if(!r.ok)throw Error(r.error);prefs=r.value;$('olStatus').textContent=text('Saved.','تم الحفظ.');return true;}catch(e){$('olStatus').textContent=e.message;return false;}finally{busy=false;await render();}}
async function render(){
 const run=++generation,[r,s]=await Promise.all([window.lab.overlays(),window.lab.overlayPreferences()]);if(run!==generation)return;
 if(!r.ok||!s.ok){$('olStatus').textContent=r.error||s.error;return;}prefs=s.value;
 $('olSubtitle').textContent=text('Choose your style. Preview it, then make it yours.','اختر ثيمك، جرّبه في المعاينة، ثم حدده.');
 $('olEnabled').checked=prefs.enabled;$('olEnabledLabel').textContent=text('Install overlay with DLSS','تثبيت الأوفرلاي مع DLSS');$('olHotkey').textContent=`${text('Hotkey','زر الاختصار')} · ${keyLabel(prefs.hotkey)}`;
 $('olAdd').textContent=text('＋ Add Overlay','＋ إضافة أوفرلاي');$('olSource').textContent=text('Developer files','ملفات المطورين');$('olCustom').textContent=text('Create theme','إنشاء ثيم');dispose();
 $('olThemeGallery').innerHTML=themeList().map(([id,en])=>`<article class="ol-theme-card ${prefs.theme===id?'selected':''}" data-overlay-theme="${id}"><div class="ol-card-stage"><div class="ol-static-panel" inert aria-hidden="true"></div></div><div class="ol-theme-bottom"><h3>${text(en)}</h3><div class="ol-actions"><button class="ol-select" data-ol-action="select" data-id="${id}" aria-pressed="${prefs.theme===id}">${prefs.theme===id?text('✓ Selected'):text('Select')}</button>${button('preview',id,text('◉ Preview'))}${id==='custom'?`<button class="drop" data-ol-action="delete-theme" data-id="custom" title="${text('Delete this theme')}" aria-label="${text('Delete this theme')}"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`:''}</div></div></article>`).join('');
 for(const root of document.querySelectorAll('.ol-static-panel')){window.mountOverlayLive(root,{designOnly:true});root.querySelectorAll('.ol-live-modes,.ol-preview-backend').forEach(e=>e.remove());root.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));root.querySelectorAll('[for]').forEach(e=>e.removeAttribute('for'));}
 observer=new ResizeObserver(entries=>{for(const {target} of entries){const width=target.clientWidth;if(target.dataset.width===String(width))continue;target.dataset.width=width;requestAnimationFrame(()=>{if(!target.isConnected)return;const scale=width/534;target.firstElementChild.style.transform=`scale(${scale})`;target.style.height=`${target.firstElementChild.scrollHeight*scale}px`;});}});document.querySelectorAll('.ol-card-stage').forEach(e=>observer.observe(e));
 for(const card of $('olThemeGallery').querySelectorAll('[data-overlay-theme=custom]'))
   window.applyOverlayTheme(card,{theme:'custom',custom:prefs.custom});
 $('olLibrary').innerHTML=r.value.overlays.filter(e=>!e.builtin).map(e=>`<article class="ol-card"><h3>${esc(e.name)}</h3><p>${text('Custom native overlay: browser preview unavailable. Only test trusted files.','أوفرلاي خارجي لا يدعم معاينة المتصفح. اختبر الملفات الموثوقة فقط.')}</p><div class="ol-actions">${button('install',e.id,text('Install separately','تثبيت منفصل'))}${button('remove',e.id,text('Remove','إزالة'))}</div></article>`).join('');
 const builtinName=(r.value.overlays.find(o=>o.id==='builtin')||{}).name;
 $('olInstalls').innerHTML=r.value.installations.length?`<details><summary>${text('Existing installations','التثبيتات الحالية')} (${r.value.installations.length})</summary>${r.value.installations.map(e=>`<article class="ol-card"><b>${esc(e.overlayId==='builtin'&&builtinName?builtinName:e.name)}</b><p>${esc(e.directory)}</p>${button('uninstall',e.id,text('Remove overlay only','إزالة الأوفرلاي فقط'))}</article>`).join('')}</details>`:'';
 if(r.value.errors.length)$('olStatus').textContent=r.value.errors.join('\n');
 await showBridge();
}
// The panel in the game says it is waiting; this says what for. Without it
// there is no way to tell a service that never started from a game that has
// not attached yet.
async function showBridge(){
 const box=$('olBridge'); if(!box)return;
 let state=null;
 try{const r=await window.lab.overlayBridge(); if(r&&r.ok)state=r.value;}catch{}
 // A missing add-on outranks anything about the service: it is the reason no
 // game will ever attach, and it used to leave the page saying "ready".
 if(state&&state.addon===false){
  box.dataset.state='off';
  box.textContent=text(
   `The overlay add-on is missing from this app, so no game can load it: ${state.addonFile||''}. Antivirus software removes this file - restore it from your antivirus quarantine and add an exclusion, or reinstall DLSS 5 Swapper Plus.`,
   `ملف الأوفرلاي مفقود من البرنامج، فلا تستطيع أي لعبة تحميله: ${state.addonFile||''}. برامج الحماية تحذف هذا الملف - استعده من الحجر الصحي وأضف استثناءً، أو أعد تثبيت البرنامج.`);
  return;
 }
 if(!state||!state.listening){
  box.dataset.state='off';
  box.textContent=text('Overlay service is not running. Restart DLSS 5 Swapper Plus, then press the hotkey in game.',
   'خدمة الأوفرلاي لا تعمل. أعد تشغيل البرنامج ثم اضغط زر الاختصار داخل اللعبة.');
  return;
 }
 if(state.connected){
  box.dataset.state='on';
  box.textContent=text('Overlay service connected to a running game.','خدمة الأوفرلاي متصلة بلعبة تعمل الآن.');
  return;
 }
 box.dataset.state='ready';
 box.textContent=text('Overlay service ready, waiting for a game. Keep DLSS 5 Swapper Plus open and press the hotkey in game.',
  'خدمة الأوفرلاي جاهزة وتنتظر لعبة. أبقِ البرنامج مفتوحاً واضغط زر الاختصار داخل اللعبة.');
}
async function action(name,id){if(busy)return;if(name==='preview'){preview(id);return;}if(name==='select'){await save({theme:id});return;}if(name==='delete-theme'){await save({custom:null,theme:prefs.theme==='custom'?'green':prefs.theme});return;}busy=true;try{const r=await({add:window.lab.overlayAdd,remove:window.lab.overlayRemove,install:window.lab.overlayInstall,uninstall:window.lab.overlayUninstall,source:window.lab.overlaySource})[name](id);$('olStatus').textContent=r.ok?text('Done.','تم.'):r.error;}catch(e){$('olStatus').textContent=e.message;}finally{busy=false;await render();}}
$('olAdd').onclick=()=>action('add');$('olSource').onclick=()=>action('source');$('olEnabled').onchange=()=>save({enabled:$('olEnabled').checked});
$('olPreviewClose').onclick=()=>$('olPreviewDialog').close();$('olPreviewDialog').addEventListener('close',()=>{$('olPreview')._overlayDispose?.();$('olPreview').replaceChildren();});
// Create-a-theme dialog. The preview repaints on every colour change so the
// choice is judged on the real panel, not on a swatch.
function paintCustomPreview(){
  const root=$('olCustomPreview');root._overlayDispose?.();
  window.applyOverlayTheme(root,{theme:'custom',custom:{accent:$('olCustomColour').value,name:'x'}});
  window.mountOverlayLive(root,{designOnly:true});
}
$('olCustom').onclick=()=>{
  $('olCustomColour').value=(prefs.custom&&prefs.custom.accent)||'#ff7a00';
  $('olCustomName').value=(prefs.custom&&prefs.custom.name)||text('My theme','ثيمي');
  $('olCustomError').textContent='';
  $('olCustomTitle').textContent=text('Create a theme','إنشاء ثيم');
  $('olCustomHelp').textContent=text("Pick an accent colour. The panel's other shades are derived from it.",
    'اختر اللون الأساسي، وبقية درجات اللوحة تُشتق منه.');
  $('olCustomColourLabel').textContent=text('Colour','اللون');
  $('olCustomNameLabel').textContent=text('Name','الاسم');
  $('olCustomCancel').textContent=text('Cancel','إلغاء');
  $('olCustomSave').textContent=text('Save','حفظ');
  $('olCustomDialog').showModal();paintCustomPreview();
};
$('olCustomColour').oninput=paintCustomPreview;
$('olCustomCancel').onclick=()=>$('olCustomDialog').close();
$('olCustomDialog').addEventListener('close',()=>{$('olCustomPreview')._overlayDispose?.();$('olCustomPreview').replaceChildren();});
$('olCustomSave').onclick=async()=>{
  const name=$('olCustomName').value.trim();
  if(!name){$('olCustomError').textContent=text('Give the theme a name.','أعطِ الثيم اسماً.');return;}
  // Saved and selected together: creating a theme you then have to go and pick
  // is a step nobody wants.
  if(await save({custom:{accent:$('olCustomColour').value,name},theme:'custom'})){$('olCustomDialog').close();render();}
  else $('olCustomError').textContent=$('olStatus').textContent;
};
$('olHotkey').onclick=()=>{draft={...prefs.hotkey};$('olKeyCapture').textContent=keyLabel(draft);$('olKeyError').textContent='';$('olKeyCancel').textContent=text('Cancel','إلغاء');$('olKeySave').textContent=text('Save','حفظ');$('olHotkeyDialog').showModal();$('olKeyCapture').focus();};
$('olKeyCapture').onkeydown=e=>{if(e.key==='Tab'||e.key==='Escape')return;e.preventDefault();e.stopPropagation();
 const key=/^Key[A-Z]$/.test(e.code)?e.code.charCodeAt(3):/^Digit[0-9]$/.test(e.code)?e.code.charCodeAt(5):/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)?111+Number(e.code.slice(1)):({Space:32,PageUp:33,PageDown:34,End:35,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Insert:45,Delete:46}[e.code]);
 if(!key||e.metaKey){$('olKeyError').textContent=text('Reserved / unsupported key. Try F9 or Ctrl + Shift + O.','زر محجوز أو غير مدعوم. جرّب F9 أو Ctrl + Shift + O.');return;}
 draft={key,mods:(e.ctrlKey?1:0)|(e.altKey?2:0)|(e.shiftKey?4:0)};$('olKeyCapture').textContent=keyLabel(draft);$('olKeyError').textContent='';};
$('olKeyCancel').onclick=()=>$('olHotkeyDialog').close();$('olKeySave').onclick=async()=>{if(await save({hotkey:draft}))$('olHotkeyDialog').close();};
$('view-overlays').addEventListener('click',e=>{const b=e.target.closest('[data-ol-action]');if(b)action(b.dataset.olAction,b.dataset.id);});window.overlayLab={render};
})();
