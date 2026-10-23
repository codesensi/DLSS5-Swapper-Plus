# 安装备份与 manifest.json 说明

> 「还原原始文件」按钮的全部记忆都存在游戏目录旁的一份 JSON 里。
> 本文说明它的位置、字段、与出问题时的恢复路径。实现在
> `src/core/manifest-tracker.js`（记账）与 `src/core/apply.js`（restore 流程）。

## 位置

```
<游戏目录>\_dlss5_backup\
├─ manifest.json                       ← 活动记录（restore 的依据）
├─ manifest.json.done-<时间戳>.json     ← 退役记录（每次 restore 后留下）
└─ originals\<UUID>\                   ← 被替换文件的原始备份（backupPrefix）
```

- 备份目录名固定为 `_dlss5_backup`（`BACKUP_DIR`），`originalPath()`
  会校验 `backupPrefix` 必须形如 `originals/<UUID>`，防路径逃逸。
- manifest 本身的每次写入都先经 `file-journal` 捕获（原子替换 + 断电安全）。

## 活动字段（version: 1）

| 字段 | 含义 |
| --- | --- |
| `game` | `{dir, exe(相对路径), api}` — 安装目标 |
| `backupPrefix` | `originals/<UUID>`，首次安装生成后**永不改变** |
| `replaced[]` | 被覆盖的原有文件：`{rel, oldVersion, newVersion, kind?}`。**第一个 oldVersion 永远保留**——重复安装只更新 `newVersion`，原始备份不丢 |
| `added[]` | 应用新建的文件（restore 时直接删除，无备份） |
| `addedDirs[]` | 安装途中创建的目录（restore 时移除空壳） |
| `reshade` | ReShade 状态：`installedByUs`、hook 文件名、`filesAdded[]` |
| `optiscaler` | `{version, hook}` — OptiScaler 路由专用（optiscaler.js:205） |
| `vulkanLayer` | Vulkan 隐式层注册信息 `{manifest, owned, dir}`（apply.js:381），手动清理见 `docs/vulkan-layer-recovery.md` |
| `previousReShadeRoute` | 换到 optiscaler 路由前先前的 ReShade 路由（backend-manager.js:147），扫描/恢复用 |
| `route` | 当前安装路由（native/renodx/optiscaler/feeder） |

**关键语义**：manifest 描述的是**第一次安装前的机器状态**，不是最近一次点击。
第二次安装（或升级 payload）会复用并扩充它，保证最终 restore 回到的仍是
 genuine 原件（`beginManifest` 把 previous 展开合并）。

## restore 的行为

1. 读活动 manifest；**损坏（断电/杀软截断）时**自动查找最新的 `.done` 退役记录
   恢复（`recoverableManifest`，文件大小比对判断「是否仍装着」，不做 160 MB 哈希）。
2. 逐文件还原：`replaced[]` 从 `originals/` 拷回，`added[]` 删除，
   `addedDirs[]` 移除空目录。
3. `vulkanLayer` 存在时注销隐式层（见 vulkan-layer-recovery.md）。
4. 完成后把刚用的 manifest 改名为 `manifest.json.done-<时间戳>` 留档。

## 手动恢复与常见故障

- 活动 manifest JSON 损坏但想手动救：按 `replaced[].rel` 把
  `_dlss5_backup\originals\<UUID>\` 下同名文件拷回游戏目录即可，
  `rel` 是相对游戏目录的路径。
- 想彻底清除应用的痕迹：删掉整个 `_dlss5_backup\`（先确认不再需要 restore），
  Vulkan 层另按 vulkan-layer-recovery.md 处理。
- `errBackupInvalid`：manifest 缺失 `version:1` 或 `backupPrefix` 格式不对——
  多为手工编辑过，删除备份目录并重装即可重建。
