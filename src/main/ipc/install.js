'use strict';
// The install pipeline: details, per-executable overrides, install and
// restore, serialised by a single busy flag so two mutations never interleave.

const fs = require('fs');
const path = require('path');

let mutationBusy = false;

function register(ctx) {
  const { app, ipcMain, dialog, shell } = ctx;
  const { loadState, saveState, keyFor, apiPreferenceKey, apiPreference, reshadeProxyPreference } = ctx;
  const { payload, companionAddons } = ctx.addons;

  ipcMain.handle('details', async (_event, dir) => {
    const detailsPayload = payload();
    const scan = await ctx.scanGame(dir);
    // Opening a game is a chance to undo the read-only ReShade.ini an install
    // from before 2.2.2 left behind - the banner on #155 outlives an app update
    // because only an install used to clear it.
    if (scan.chosen) {
      try {
        const cleared = await ctx.makeReShadeConfigWritable(path.dirname(scan.chosen.path));
        if (cleared.length) console.log('Cleared read-only:', cleared.join(', '), 'in', dir);
      } catch { /* a game folder we cannot touch is not a reason to fail here */ }
    }
    const state = loadState();
    const hasNativeDlss = ctx.installRoutes.nativeDlssPresent(scan);
    const files = [...scan.dlssFiles, ...scan.streamlineFiles]
      .map((f) => ({ rel: f.rel, name: f.name, version: f.version }));
    return {
      ok: Boolean(scan.chosen),
      reason: scan.chosen ? null : (scan.emptyReason || null),
      exe: scan.chosen ? scan.chosen.rel : null,
      exePath: scan.chosen ? scan.chosen.path : null,
      api: scan.chosen ? scan.chosen.apiLabel : null,
      apiKey: scan.chosen ? scan.chosen.api : null,
      bitness: scan.chosen ? scan.chosen.bitness : null,
      via: scan.chosen ? scan.chosen.via : null,
      emulator: scan.emulator,
      installedRoute: scan.install && scan.install.route,
      antiCheatWarning: ctx.compatibility.hasAntiCheat(dir, scan.chosen?.path),
      installedApi: scan.install && scan.install.api,
      installedExe: scan.install && scan.install.exe,
      previousReShadeRoute: scan.install && scan.install.previousReShadeRoute,
      optiscaler: scan.install && scan.install.optiscaler,
      recommendedRoute: ctx.installRoutes.recommendedRoute(scan),
      exes: scan.exeCandidates.map((e) => ({
        rel: e.rel, path: e.path, apiLabel: e.apiLabel, api: e.api,
        bitness: e.bitness, size: e.size, via: e.via,
        emulator: e.emulator,
        installIssue: ctx.compatibility.targetIssue(dir, e.path),
        antiCheatWarning: ctx.compatibility.hasAntiCheat(dir, e.path),
        hasNativeDlss,
        apiOverride: apiPreference(state, dir, e.path),
        reshadeProxy: reshadeProxyPreference(state, dir, e.path),
        apiChoices: e.apiChoices || [{ api: e.api, label: e.apiLabel }],
        routes: ctx.installRoutes.routesFor({ ...e, hasNativeDlss })
      })),
      files,
      currentDlss: scan.primaryDlss ? {
        rel: scan.primaryDlss.rel,
        version: scan.primaryDlss.version,
        bitness: scan.primaryDlss.bitness
      } : null,
      addon: scan.addonPresent,
      reshade: scan.reshade,
      hasBackup: scan.hasBackup || fs.existsSync(ctx.journal.pendingPath(dir)),
      newDlss: detailsPayload && detailsPayload.source ? detailsPayload.source.dlssVersion : null
    };
  });

  const isMutationBusy = () => mutationBusy;

  ipcMain.handle('set-api-override', async (_event, dir, exePath, value) => {
    if (mutationBusy) return { ok: false, code: 'errJobBusy' };
    if (!ctx.renderingApi.valid(value) || typeof dir !== 'string' || !path.isAbsolute(dir) || typeof exePath !== 'string') {
      return { ok: false, code: 'errApiChoice' };
    }
    const scan = await ctx.scanGame(dir);
    if (mutationBusy) return { ok: false, code: 'errJobBusy' };
    if (!scan.exeCandidates.some(exe => exe.path === exePath)) return { ok: false, code: 'errApiChoice' };
    const state = loadState();
    state.apiOverrides = state.apiOverrides && typeof state.apiOverrides === 'object' && !Array.isArray(state.apiOverrides)
      ? state.apiOverrides : {};
    const key = apiPreferenceKey(dir, exePath);
    if (value === 'auto') delete state.apiOverrides[key];
    else state.apiOverrides[key] = value;
    return saveState(state) ? { ok: true } : { ok: false, code: 'errApiSave' };
  });
  ipcMain.handle('set-reshade-proxy', async (_event, dir, exePath, value) => {
    if (mutationBusy) return { ok: false, code: 'errJobBusy' };
    if (!['dxgi', 'd3d11'].includes(value) || typeof dir !== 'string' || !path.isAbsolute(dir) || typeof exePath !== 'string') {
      return { ok: false, code: 'errApiChoice' };
    }
    const scan = await ctx.scanGame(dir);
    if (mutationBusy) return { ok: false, code: 'errJobBusy' };
    if (!scan.exeCandidates.some(exe => exe.path === exePath)) return { ok: false, code: 'errApiChoice' };
    const state = loadState();
    state.reshadeProxy = state.reshadeProxy && typeof state.reshadeProxy === 'object' && !Array.isArray(state.reshadeProxy)
      ? state.reshadeProxy : {};
    const key = apiPreferenceKey(dir, exePath);
    if (value === 'dxgi') delete state.reshadeProxy[key];
    else state.reshadeProxy[key] = value;
    return saveState(state) ? { ok: true } : { ok: false, code: 'errApiSave' };
  });
  async function exclusiveMutation(work) {
    if (mutationBusy) return { ok: false, code: 'errJobBusy' };
    mutationBusy = true;
    try { return await work(); }
    catch (err) { return { ok: false, code: err.code, message: err.message }; }
    finally { mutationBusy = false; }
  }

  // The install handler used to be one ~250-line arrow. It now reads as
  // three private stages between the guard rails: choose the target and
  // route, prepare every moving part (downloads, dialogs, the overlay plan),
  // then run the tracked install. All three close over the same ctx pieces.
  async function resolveTarget(dir, exePath, requestedApi) {
    const scan = await ctx.scanGame(dir);
    if (!scan.chosen) return { code: 'errNoGameExecutable', message: 'errNoGameExecutable' };
    // Honour the sheet's choice, but only if it is one of the candidates we
    // actually found - never patch a path the renderer made up.
    const detected = scan.exeCandidates.find((e) => e.path === exePath) || scan.chosen;
    const selection = requestedApi ?? apiPreference(loadState(), dir, detected.path);
    const target = ctx.renderingApi.effective(detected, selection);
    ctx.compatibility.assertSafeTarget(dir, target.path);
    target.hasNativeDlss = ctx.installRoutes.nativeDlssPresent(scan);
    const api = target.api;
    const availableRoutes = ctx.installRoutes.routesFor(target, api);
    return { scan, target, api, availableRoutes };
  }

  function resolveRoute(requestedRoute, availableRoutes, scan, target) {
    if (requestedRoute === 'optiscaler' && !availableRoutes.includes('optiscaler')) {
      return { code: ctx.installRoutes.optiReason(target, target.api) || 'optiUnsupported' };
    }
    if (!availableRoutes.length) return { code: 'unsupportedRendererHint', message: 'unsupportedRendererHint' };
    const recommendedRoute = ctx.installRoutes.recommendedRoute(scan, target);
    const route = availableRoutes.includes(requestedRoute) ? requestedRoute
      : (availableRoutes.includes(recommendedRoute) ? recommendedRoute : availableRoutes[0]);
    return { route };
  }

  // ReShade Setup is a Windows executable. On Linux, support Windows games
  // launched with Steam Play by using their existing Proton prefix; native
  // Linux games do not load the Windows DLSS/ReShade payload.
  function protonContext(dir) {
    const protonGame = process.platform === 'linux'
      ? ctx.steam().find((game) => path.resolve(game.dir) === path.resolve(dir))
      : null;
    return ctx.contextForSteamGame(protonGame);
  }

  ipcMain.handle('install', (event, dir, exePath, requestedRoute, requestedApi) => exclusiveMutation(async () => {
    const p = payload();
    if (!p) return { ok: false, ...ctx.winLayer.payloadMissing() };

    const resolved = await resolveTarget(dir, exePath, requestedApi);
    if (resolved.code) return { ok: false, code: resolved.code, message: resolved.message };
    const { scan, target, api, availableRoutes } = resolved;
    const routed = resolveRoute(requestedRoute, availableRoutes, scan, target);
    if (routed.code) return { ok: false, code: routed.code, message: routed.message };
    const route = routed.route;

    const proton = protonContext(dir);
    if (process.platform === 'linux' && !proton) {
      return { ok: false, code: 'errProtonRequired', message: 'errProtonRequired' };
    }
    if (process.platform === 'linux' && api === 'vulkan') {
      return { ok: false, code: 'errLinuxVulkanUnsupported', message: 'errLinuxVulkanUnsupported' };
    }

    const send = (e) => event.sender.send('job', e);
    await ctx.guards.assertGameClosed(dir, target.path);
    if (fs.existsSync(ctx.journal.pendingPath(dir))) return { ok: false, code: 'errBackendRecovery' };
    const old = ctx.backends.readManifest(dir);
    const changed = old && (old.route !== route || old.game.api !== api || old.game.exe.toLowerCase() !== target.rel.toLowerCase());
    if (changed && (old.game.api === 'vulkan' || api === 'vulkan')) return { ok: false, code: 'errBackendVulkanSwitch' };
    let antiCheatAcknowledged = false;
    if (ctx.compatibility.hasAntiCheat(dir, target.path)) {
      const answer = await dialog.showMessageBox(ctx.winLayer.getWindow(), ctx.antiCheatWarning.dialogOptions(loadState().lang, dir, target.path));
      if (answer.response !== 1) return { ok: false, cancelled: true };
      antiCheatAcknowledged = true;
      send({ code: 'antiCheatRiskAccepted', params: {} });
    }
    // The ReShade and Feeder routes both drive the RenoDX neural consumer, which
    // upstream has measured faulting inside NVIDIA's runtime on a known driver
    // range. Say so before the work starts; it never stops the install.
    if (route === 'native' || route === 'feeder') {
      // Advice only: nothing about reading the driver may decide whether an
      // install runs.
      try {
        const rows = await ctx.guards.gpuInfo();
        if (ctx.guards.driverNeuralFault(rows)) send({ code: 'driverNeuralFault', params: { gpu: ctx.guards.driverNames(rows) } });
      } catch {}
    }

    // Prepare the OptiScaler build if the route wants one: conflict check,
    // the hardware/confirm dialog, the VC runtime check, then the download.
    async function prepareOptiscaler() {
      ctx.optiscaler.checkConflicts(dir, target.path, old, api);
      if (api === 'vulkan' && await ctx.vulkanLayer.existing(ctx.vulkanLayer.defaultRunner)) return { code: 'errOptiVulkanLayer' };
      const gpu = await ctx.guards.gpuInfo();
      // Neither the card nor the driver is refused outright any more. Upstream
      // 0.2.0 says plainly that architectures older than Blackwell work with a
      // modded nvngx_dlssnr.dll, which the person supplies themselves - so this
      // is their decision to make, with both facts in front of them.
      const oldCard = gpu ? !ctx.guards.gpuModelSupported(gpu) : false;
      const oldDriver = gpu ? !ctx.guards.driverSupported(gpu) : false;
      const confirmation = await dialog.showMessageBox(ctx.winLayer.getWindow(), {
        type: 'warning', title: 'OptiScaler DLSS-NR',
        message: ctx.featureText('optiConfirm'),
        detail: [gpu ? gpu.map(g => `${g.name} — ${g.driver}`).join('\n') : ctx.featureText('errOptiHardware'),
          oldCard ? ctx.featureText('optiCardOld') : null,
          oldDriver ? ctx.featureText('optiDriverOld') : null,
          ctx.featureText('optiHint'), ctx.featureText('optiBridgeHint'), ctx.featureText('backendHint')].filter(Boolean).join('\n\n'),
        buttons: [ctx.featureText('installOpti'), ctx.featureText('cancel')], defaultId: 1, cancelId: 1
      });
      if (confirmation.response !== 0) return { cancelled: true };
      const missing = ctx.missingVCRuntime(64, path.dirname(target.path), process.env.SystemRoot, ['msvcp140_atomic_wait.dll']);
      if (missing.length) return { code: 'runtimeRequiredHint', message: missing.join(', ') };
      send({ code: 'optiDownloading', params: {} });
      // A game may name an older pinned build. #238: No Man's Sky runs on
      // 0.1.1.5 and crashes on 0.2.0-patch1, and until now the only way back was
      // to keep an old copy of the whole app.
      const wanted = (loadState().optiscalerVersion || {})[path.resolve(dir).toLowerCase()];
      const release = ctx.optiscaler.releaseFor(wanted);
      optiVersion = release.version;
      try { optiRoot = await ctx.optiscaler.ensureOptiScaler(app.getPath('userData'), release.version); }
      catch (err) { return { code: ctx.componentCode(err, 'errOptiDownload'), message: err.message }; }
      send({ code: 'optiVerified', params: { version: release.version } });
      return {};
    }

    // Check before restoring or touching the game: these DLLs are imported by
    // Feeder and its helper. Never report a working installation if absent.
    // Returns the VCRuntime download URL when the runtime is missing.
    async function prepareFeeder() {
      if (!p.source.feeder || !(target.bitness === 32 ? p.source.feeder.ok32 : p.source.feeder.ok64)) {
        return { code: 'errFeederPayload', message: 'errFeederPayload' };
      }
      const checks = [[target.bitness, path.dirname(target.path)]];
      if (target.bitness === 32) checks.push([64, path.join(path.dirname(target.path), 'host64')]);
      for (const [bits, folder] of checks) {
        const missing = ctx.missingVCRuntime(bits, folder);
        if (missing.length) {
          const response = await dialog.showMessageBox(ctx.winLayer.getWindow(), {
            type: 'warning', title: 'Microsoft Visual C++ Runtime',
            message: ctx.featureText('runtimeRequiredHint'),
            detail: `${bits === 32 ? 'x86' : 'x64'}\n${missing.join(', ')}\n${folder}`,
            buttons: [ctx.featureText('runtimeDownload'), ctx.featureText('cancel')], cancelId: 1, defaultId: 0
          });
          if (response.response === 0) await shell.openExternal(`https://aka.ms/vc14/vc_redist.${bits === 32 ? 'x86' : 'x64'}.exe`);
          return { code: 'runtimeRequiredHint' };
        }
      }
      // DirectDraw goes through dgVoodoo exactly as DX8 and DX9 do - apply.js
      // refuses a ddraw install without it - and it was never downloaded for one,
      // so every DirectDraw install failed with errDgVoodooMissing (#292, #279).
      if (api === 'd3d8' || api === 'd3d9' || api === 'ddraw') {
        try {
          p.source.feeder.dgVoodooDir = await ctx.ensureDgVoodoo(app.getPath('userData'));
          send({ code: 'legacyWrapperReady', params: { api, bitness: target.bitness } });
        } catch (error) {
          return { code: ctx.componentCode(error, 'legacyDownloadHint'), message: error.message };
        }
      }
      // Lumenite is motion-only: VORT is bundled under MIT as an offline
      // fallback, so the install remains usable even when GitHub is not.
      try {
        p.source.feeder.lumeniteRoot = await ctx.ensureLumenite(app.getPath('userData'));
        send({ code: 'motionProviderReady', params: { provider: 'LumeniteFX Kernel 2.0' } });
      } catch (err) {
        p.source.feeder.lumeniteRoot = null;
        send({ code: 'motionProviderFallback', params: { error: err.message } });
      }
      return {};
    }

    // The in-game overlay rides along with the install when it is switched on and
    // the executable is one it supports. Prepared before anything is written, so
    // an unsupported build refuses the install rather than half-finishing it.
    const overlay = ctx.gameOverlay;
    function planOverlay() {
      let wanted = false;
      // An unreadable preference means the overlay is off. A DLSS install must not
      // fail because of it.
      try { wanted = ctx.overlayPreferences.read(app.getPath('userData')).enabled === true; } catch {}
      if (!wanted) return { plan: null };
      try {
        // Drop records whose bytes are already gone - a restore, or an overlay
        // rebuilt since. Without this, prepare() refuses the new build because an
        // old record still claims a different one is installed here.
        overlay.cleanupMissing(ctx.overlayLibrary(), dir);
        // An update ships a different overlay build. Retire the copy this app
        // installed here for the previous one instead of stopping with "remove
        // the previous test overlay first".
        overlay.replaceOutdated(ctx.overlayLibrary(), path.dirname(target.path));
        if (overlay.routes(target).includes(route)) {
          return { plan: overlay.prepare({ library: ctx.overlayLibrary(), target, route }) };
        }
        // Never silently. A route or an API the panel cannot ride on produced
        // an install with no overlay file and no line saying why, which is
        // indistinguishable from a bug.
        // The one reason that applies, in words: "does not attach on
        // renodx/DirectX 11" read as a fault on every route (#338).
        const why = target.bitness !== 64 ? 'bits' : route === 'renodx' ? 'multipass' : route === 'optiscaler' ? 'optiscaler' : 'api';
        send({ code: 'overlayNotForRoute', params: { why, api: target.apiLabel || target.api } });
      } catch (error) {
        // DLSS is the job; the overlay rides along. A missing or conflicting
        // overlay build is reported and skipped - the switch defaults to on, so
        // failing here would break every install on a machine without one.
        send({ code: 'overlaySkipped', params: { error: error.message } });
      }
      return { plan: null };
    }

    let optiRoot = null;
    let optiVersion = null;
    if (route === 'optiscaler') {
      const prepared = await prepareOptiscaler();
      if (prepared.code) return { ok: false, code: prepared.code, message: prepared.message };
      if (prepared.cancelled) return { ok: false, cancelled: true };
    }

    if (route === 'feeder') {
      const prepared = await prepareFeeder();
      if (prepared.code) return { ok: false, code: prepared.code, message: prepared.message };
    }

    // Only user-selected companion builds are installed. Leave unrelated
    // add-ons alone; all managed copies now participate in the transaction.
    const companions = route === 'native' && target.bitness === 64 ? companionAddons() : [];

    const overlayPlan = planOverlay().plan;

    try {
      // A game could have been launched while the component download ran.
      await ctx.guards.assertGameClosed(dir, target.path);
      // Preserve the previous snapshot before a repeat install changes it.
      ctx.history().list([{ dir, name: ctx.gameName(dir) }], error => send({ code: 'historySaveWarning', params: { error: error.message } }));
      const manifest = await ctx.backends.install({
        gameDir: dir,
        exePath: target.path,
        api,
        apiLabel: target.apiLabel,
        bitness: target.bitness,
        route,
        antiCheatAcknowledged,
        emulator: target.emulator,
        source: p.source,
        optiRoot,
        optiVersion,
        companions,
        reshadeSetup: p.reshadeSetup,
        setupRunner: proton ? ctx.createSetupRunner(proton) : undefined,
        vulkanLayerTarget: path.join(app.getPath('userData'), 'reshade-vulkan'),
        // DirectX 11 (#328) and the wrapped DirectX 8/9 titles that become
        // DirectX 11 inside dgVoodoo (#343). Not DirectX 12, which never loads
        // d3d11.dll, and not OptiScaler, which has no ReShade of its own.
        reshadeProxy: ['dxgi', 'd3d8', 'd3d9', 'ddraw'].includes(api) && target.apiLabel !== 'DirectX 12' && route !== 'optiscaler'
          ? reshadeProxyPreference(loadState(), dir, target.path) : 'dxgi',
        installReShade: true,
        addMissingDlss: true,
        addStreamline: false,
        upgradeReShade: false
      }, send);
      // By this point DLSS is installed and the manifest is written. An overlay
      // failure here is reported, never turned into a failed install that the
      // caller would read as "nothing happened".
      if (overlayPlan) try {
        const exeDir = path.dirname(target.path);
        // Feeder's own config template omits two upstream defaults the overlay
        // reads; fill them without touching a choice already made.
        if (route === 'feeder') {
          const cfg = path.join(exeDir, 'dlss5-feed.cfg');
          if (fs.existsSync(cfg)) {
            await ctx.writeTracked(manifest, dir, cfg,
              overlay.completeFeederConfig(fs.readFileSync(cfg, 'utf8')), { kind: 'config' });
          }
        }
        await ctx.journal.capture(dir, overlayPlan.file);
        await overlay.attach({
          library: ctx.overlayLibrary(), target, gameDir: dir, manifest,
          saveManifest: ctx.saveActiveManifest, plan: overlayPlan
        });
        send({ code: 'addonInstalled', params: { name: 'DLSS 5 Overlay (F8)' } });
      } catch (error) {
        send({ code: 'overlaySkipped', params: { error: error.message } });
        try { overlay.cleanupMissing(ctx.overlayLibrary(), dir); } catch {}
      }
      ctx.saveOperation(dir, manifest, 'install', send);
      return { ok: true, replaced: manifest.replaced.length, added: manifest.added.length };
    } catch (err) {
      // Drop stale overlay records whose bytes the rollback already removed.
      try { ctx.gameOverlay.cleanupMissing(ctx.overlayLibrary(), dir); } catch {}
      return { ok: false, code: err.code, message: err.message };
    }
  }));

  ipcMain.handle('restore', (event, dir) => exclusiveMutation(async () => {
    let restoredManifest = null;
    const send = (e) => {
      if (e.code === 'restoreDone') restoredManifest = e.params;
      event.sender.send('job', e);
    };
    try {
      let old = null;
      try { old = ctx.backends.readManifest(dir); } catch (error) { if (!fs.existsSync(ctx.journal.pendingPath(dir))) throw error; }
      // Recovery belongs to the manifest/journal, not the graphics scanner.
      // A missing/updated/unrecognised executable must not strand our hooks.
      if (!old && !fs.existsSync(ctx.journal.pendingPath(dir))) return { ok: false, code: 'errNoBackup' };
      const exe = old ? ctx.journal.safePath(dir, old.game.exe) : null;
      await ctx.guards.assertGameClosed(dir, exe);
      ctx.history().list([{ dir, name: ctx.gameName(dir) }], error => send({ code: 'historySaveWarning', params: { error: error.message } }));
      if (!await ctx.backends.restore(dir, send)) return { ok: false, code: 'errNoBackup' };
      ctx.saveOperation(dir, restoredManifest || {}, restoredManifest ? 'restore' : 'recovery', send);
      return { ok: true };
    } catch (err) {
      return { ok: false, code: err.code, message: err.message };
    }
  }));

  return { isMutationBusy };
}

module.exports = { register };
