# Vulkan 隐式层：手动恢复与验收步骤

应用给 Vulkan 路由的 ReShade 注册一个 **Khronos 隐式层**（implicit layer）。
正常情况下「Restore originals / 还原原始文件」会把它卸干净；本文留档它的
落盘位置与手动恢复步骤，供 restore 无法运行（应用被删、注册表被手改、
杀软锁文件）时使用。

## 安装了什么

| 内容 | 位置 |
| --- | --- |
| 层 DLL + JSON | `%APPDATA%\<应用名>\reshade-vulkan\ReShade64.dll`、`ReShade64.json`（32 位路由另有 `ReShade32.*`） |
| 注册表值 | `HKCU\Software\Khronos\Vulkan\ImplicitLayers` 下，**名为 JSON 文件完整路径**的 DWORD 值（`vulkan-layer.js:11` 的 `KEY`，值为 0） |
| 游戏清单 | `reshade-vulkan\installs.json` 记录接入过的游戏目录；restore 时把当前游戏移出，清空后整个目录删除 |

代码：`src/core/vulkan-layer.js`（`register`/`detach`/`existing`）；
restore 侧调用在 `src/core/apply.js:986-988`（`vulkanLayerRemoved` /
`vulkanLayerKept` 两条日志）。

## 手动恢复（管理员 PowerShell）

```powershell
# 1. 删除注册表值（层注销；没有它游戏就不会加载 ReShade）
Get-ChildItem 'HKCU:\Software\Khronos\Vulkan\ImplicitLayers' -ErrorAction SilentlyContinue |
  Where-Object { $_.GetValueNames() -match 'ReShade\d+\.json' } |
  ForEach-Object {
    $key = $_
    $_.GetValueNames() | Where-Object { $_ -match 'ReShade\d+\.json' } |
      ForEach-Object { Remove-ItemProperty -Path $key.PSPath -Name $_ }
  }

# 2. 删除层文件（把 <appData> 换成实际应用目录名）
$dir = Join-Path $env:APPDATA '<appData>\reshade-vulkan'
Remove-Item "$dir\ReShade64.dll","$dir\ReShade64.json","$dir\ReShade32.dll","$dir\ReShade32.json","$dir\installs.json" -ErrorAction SilentlyContinue
Remove-Item $dir -ErrorAction SilentlyContinue
```

只做第 1 步已足以让游戏不再加载该层（注销即停用）；第 2 步是清理磁盘。

## 验收步骤（改过 vulkan-layer.js 或 restore 流程后）

1. **安装**：对任一游戏执行 Vulkan 路由安装。期望：
   `reshade-vulkan\` 出现 `ReShade64.dll` + `ReShade64.json`，
   `HKCU\Software\Khronos\Vulkan\ImplicitLayers` 出现以该 JSON 全路径
   命名的 DWORD 值，`installs.json` 包含游戏目录。
2. **共享检测**：对第二个游戏安装 Vulkan 路由，然后 restore 其中一个。
   期望另一个游戏的注册保持完好（`detach` 只把当前游戏移出
   `installs.json`，返回 `vulkanLayerKept`）。
3. **独占卸载**：restore 最后一个接入的游戏。期望：注册表值被删、
   `reshade-vulkan\` 目录整体消失（`vulkanLayerRemoved`）。
4. **他方层不受影响**：若安装前系统已有别的 Vulkan 隐式层
   （`register` 里 `existing()` 返回非本应用目录），应用不接管也不卸载它；
   验收时确认 restore 后该层仍在。
5. **游戏内**：restore 后启动游戏确认画面无 ReShade 注入（无覆盖提示）。

## 常见故障

- **游戏仍加载 ReShade**：注册表值未删干净（路径必须是 JSON 文件的
  完整路径，不是名字）。用 `reg query HKCU\Software\Khronos\Vulkan\ImplicitLayers` 核对。
- **目录删不掉**：游戏或杀软占用 `ReShade64.dll`；重启后再删。
- **JSON 解析失败的旧安装**：`JSON.parse` 失败会让 `installs.json`
  读取回退为空表，直接按上面步骤 1-2 手动清理即可。
