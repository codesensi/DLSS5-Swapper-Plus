'use strict';
// Stamps the packaging time into assets/, which ships with the app
// (build.files already carries "assets/**/*"). Dev runs never write the file,
// and the About view hides the build row when it is missing - so the stamp is
// best-effort by design and must never fail a build.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'assets', 'build-info.json');
fs.writeFileSync(file, `${JSON.stringify({ builtAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`build-info written: ${file}`);
