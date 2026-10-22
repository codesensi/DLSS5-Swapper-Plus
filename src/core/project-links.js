'use strict';

// Only these destinations may be opened by the renderer, never arbitrary URLs.
const links = Object.freeze({
  github: 'https://github.com/codesensi/DLSS5-Swapper-Plus',
  releases: 'https://github.com/codesensi/DLSS5-Swapper-Plus/releases/latest',
  bilibili: 'https://space.bilibili.com/5199773'
});
function projectUrl(key) {
  return typeof key === 'string' && Object.hasOwn(links, key) ? links[key] : null;
}
module.exports = { links, projectUrl };
