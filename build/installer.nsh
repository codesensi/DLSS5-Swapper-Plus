; Uninstalling the app does not touch any game folder: Restore originals is
; what puts a game back, from the backup it keeps in that game's own folder.
; People uninstalled first and were left with ReShade in their games (#266),
; so the uninstaller says so before it goes, and offers to stop. It stays
; silent during an update, which runs the old uninstaller on its own.
;
; The notice is localised through NSIS LangStrings: the uninstaller has no
; language page of its own, so the string follows the Windows display
; language, with English as the fallback for every other locale. The
; installer language table is pinned to these five languages via
; nsis.installerLanguages in package.json — every language in the table
; needs a LangString here, or makensis emits warning 6040 and
; electron-builder treats that warning as an error.
;
; Language ids are numeric LCIDs on purpose: this file is included before the
; MUI language macros run, so ${LANG_*} defines do not exist yet and makensis
; raises warning 7025, which electron-builder treats as an error.
; 1033=en-US 2052=zh-CN 1028=zh-TW 1041=ja 1042=ko
LangString uninstallGameNotice 1033 "Uninstalling DLSS 5 Swapper Plus does not remove anything it installed into your games.$\r$\n$\r$\nTo put a game back the way it was, open DLSS 5 Swapper Plus first and use Restore originals on it. The backup stays in each game folder, so you can also reinstall the app later and restore then.$\r$\n$\r$\nContinue uninstalling?"
LangString uninstallGameNotice 2052 "卸载 DLSS 5 Swapper Plus 不会移除它安装到游戏中的任何文件。$\r$\n$\r$\n要将游戏恢复原状，请先打开 DLSS 5 Swapper Plus，使用「还原原文件」。备份保留在每个游戏文件夹内，之后也可以重新安装本应用再还原。$\r$\n$\r$\n要继续卸载吗？"
LangString uninstallGameNotice 1028 "解除安裝 DLSS 5 Swapper Plus 不會移除它安裝到遊戲中的任何檔案。$\r$\n$\r$\n要將遊戲還原原狀，請先開啟 DLSS 5 Swapper Plus，使用「還原原始檔」。備份保留在每個遊戲資料夾內，之後也可以重新安裝本應用再還原。$\r$\n$\r$\n要繼續解除安裝嗎？"
LangString uninstallGameNotice 1041 "DLSS 5 Swapper Plus をアンインストールしても、ゲームにインストールされたファイルは削除されません。$\r$\n$\r$\nゲームを元の状態に戻すには、先に DLSS 5 Swapper Plus を開いて「元に戻す」を実行してください。バックアップは各ゲームフォルダーに残るため、後からアプリを再インストールして復元することもできます。$\r$\n$\r$\nアンインストールを続行しますか？"
LangString uninstallGameNotice 1042 "DLSS 5 Swapper Plus를 제거해도 게임에 설치된 파일은 삭제되지 않습니다.$\r$\n$\r$\n게임을 원래 상태로 되돌리려면 먼저 DLSS 5 Swapper Plus를 연 다음 『원본 복원』을 사용하세요. 백업은 각 게임 폴더에 그대로 남으므로, 나중에 앱을 다시 설치해서 복원할 수도 있습니다.$\r$\n$\r$\n제거를 계속할까요?"

!macro customUnInit
  ${ifNot} ${isUpdated}
    IfSilent +3
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "$(uninstallGameNotice)" IDOK +2
    Quit
  ${endIf}
!macroend
