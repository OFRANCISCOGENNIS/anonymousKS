#!/usr/bin/env node
// Gera web/inventario-standalone.html — versão única (HTML+CSS+JS inline)
// a partir dos arquivos-fonte em web/. Rode: node web/build-standalone.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'css/style.css'), 'utf8');
const inv = fs.readFileSync(path.join(dir, 'js/inventario.js'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'js/app.js'), 'utf8');

html = html
  .replace(/<link rel="stylesheet" href="css\/style.css">/, '<style>\n' + css + '\n</style>')
  .replace(/<script src="js\/inventario.js"><\/script>/, '<script>\n' + inv + '\n</script>')
  .replace(/<script src="js\/app.js"><\/script>/, '<script>\n' + app + '\n</script>');

const out = path.join(dir, 'inventario-standalone.html');
fs.writeFileSync(out, html);
console.log('Gerado:', out, '(' + html.length + ' bytes)');
