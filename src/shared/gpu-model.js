'use strict';
// GPU model names arrive in many spellings for the same hardware, so
// "NVIDIA GeForce RTX 5080" and "RTX 5080" normalise to one key. The library
// and diagnostics views use this to group and match cards consistently.
(function (root) {
  const NOISE = /\b(?:NVIDIA|AMD|ATI|Intel|GeForce|Graphics|GPU|Series)\b/gi;
  const FAMILY = new Map([['rtx', 'RTX'], ['gtx', 'GTX'], ['rx', 'RX'], ['xt', 'XT'], ['xtx', 'XTX'],
    ['gre', 'GRE'], ['ti', 'Ti'], ['super', 'SUPER'], ['laptop', 'Laptop'], ['radeon', 'Radeon'],
    ['arc', 'Arc'], ['pro', 'PRO'], ['max-q', 'Max-Q']]);

  function normaliseGpu(value) {
    const words = String(value || '')
      .replace(/\((?:R|TM)\)|[®™]/gi, ' ')
      .replace(NOISE, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => FAMILY.get(word.toLowerCase()) || word);
    const model = words.join(' ').slice(0, 60).trim();
    return model.length >= 2 ? model : null;
  }

  const api = { normaliseGpu };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.gpuModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
