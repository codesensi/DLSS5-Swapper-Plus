'use strict';

// README screenshots, taken from the real app so the pictures are of the thing
// itself rather than a mock. Dark theme, one wide window, and every shot waits
// on what it is photographing rather than a clock.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Electron is started on a script rather than on the app folder, so it reports
// its own version for app.getVersion() - 33.4.11 turned up in the report sheet
// where 2.2.4 belongs. The real one is put back before anything reads it.
const version = require('../package.json').version;
if (typeof app.setVersion === 'function') app.setVersion(version);
else app.getVersion = () => version;
app.setName('DLSS 5 Swapper Plus');

require('../main.js');

const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const WIDTH = 1680, HEIGHT = 1020;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const die = (why) => { console.error(why); app.exit(1); };
setTimeout(() => die('timed out'), 180000);

app.whenReady().then(async () => {
  let win = null;
  for (let i = 0; i < 200 && !win; ++i) {
    win = BrowserWindow.getAllWindows().find((w) => !w.webContents.isDestroyed() && !w.webContents.isOffscreen());
    if (!win) await wait(100);
  }
  if (!win) return die('no window');
  await new Promise((resolve) => win.webContents.isLoading() ? win.webContents.once('did-finish-load', resolve) : resolve());
  win.setSize(WIDTH, HEIGHT);
  win.center();
  win.show();

  const run = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => {
    await wait(700);
    const image = await win.webContents.capturePage();
    const file = path.join(OUT, name);
    fs.writeFileSync(file, image.toPNG());
    console.log('  wrote', name, image.getSize().width + 'x' + image.getSize().height);
  };
  const settle = async (expression, why) => {
    for (let i = 0; i < 150; ++i) { if (await run(expression)) return; await wait(200); }
    throw new Error('never became true: ' + why);
  };

  // Dark theme through the same path the button uses, so nothing is faked.
  await run(`state.theme = 'dark'; document.documentElement.dataset.theme = 'dark'; paintBrand(); window.lab.setTheme('dark'); true`);
  await wait(400);

  // The menu the app draws itself on a game card, over a library that has
  // settled: a progress bar in the corner reading "Fetching art..." is not
  // what the page looks like in use.
  await run(`show('games'); true`);
  await settle(`$('statusText').textContent === t('ready')`, 'library idle');
  await settle(`document.querySelectorAll('#groups .card').length > 0`, 'game cards');
  await run(`(() => {
    const card = document.querySelector('#groups .card');
    card.scrollIntoView({ block: 'center' });
    return true;
  })()`);
  await wait(600);
  await run(`(() => {
    const card = document.querySelector('#groups .card');
    const box = card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: Math.round(box.left + box.width / 2), clientY: Math.round(box.top + box.height / 2)
    }));
    return true;
  })()`);
  await settle(`!document.getElementById('gameMenu').hidden && document.getElementById('gameMenu').offsetHeight > 0`, 'game menu');
  await wait(700);
  await shot('12-games-menu.png');
  await run(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await wait(500);

  // Settings: the switch that decides whether Windows says anything at all.
  await run(`document.querySelectorAll('dialog[open]').forEach(d => d.close()); show('settings'); true`);
  await settle(`document.getElementById('settings').textContent.length > 200`, 'settings drawn');
  await run(`(() => {
    const block = [...document.querySelectorAll('#settings *')]
      .find(el => /notification/i.test(el.textContent) && el.children.length && el.textContent.length < 900);
    if (block) block.scrollIntoView({ block: 'center' });
    return true;
  })()`);
  await wait(900);
  await shot('14-settings.png');

  console.log('done');
  app.exit(0);
}).catch((error) => die(error && error.stack || String(error)));
