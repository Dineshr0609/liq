const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const EXCL_DIRS = new Set(['node_modules','.git','attached_assets','dist','build','.local','.cache','tmp','exports','uploads','.upm','.config','.pythonlibs']);
const EXCL_PREFIX = ['.replit'];
const EXCL_EXT = ['.log','.zip','.tar.gz'];

const zip = new JSZip();
let count = 0;
function walk(dir, rel='') {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const r = rel ? path.posix.join(rel, name) : name;
    let st;
    try { st = fs.lstatSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (EXCL_DIRS.has(name) || EXCL_PREFIX.some(p => name.startsWith(p))) continue;
      walk(full, r);
    } else if (st.isFile()) {
      if (name === '.env' || name.startsWith('.env.')) continue;
      if (EXCL_EXT.some(e => name.endsWith(e))) continue;
      zip.file(r, fs.readFileSync(full));
      count++;
    }
  }
}
walk('.');
zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  .then(buf => {
    fs.mkdirSync('exports', { recursive: true });
    fs.writeFileSync('exports/licenseiq-codebase.zip', buf);
    console.log('files:', count, 'size:', (buf.length / 1024 / 1024).toFixed(1), 'MB');
  });
