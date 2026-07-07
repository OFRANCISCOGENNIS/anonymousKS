// Gera Simulador_Standalone.html: um único arquivo HTML com CSS, JS e as libs
// (Lightweight Charts) embutidos, para abrir direto no navegador (file://) sem
// servidor. Uso: node build_standalone.js
//
// Minificação: usa esbuild (via npx) para reduzir app.js/styles.css. No JS só
// remove espaços/comentários e simplifica sintaxe — NÃO renomeia identificadores
// (o código continua auditável e nada externo quebra). Se o esbuild não estiver
// disponível (offline), o build segue sem minificar.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const dir = __dirname;

function minificar(src, tipo) {
  try {
    const args = ['-y', 'esbuild', '--loader=' + tipo];
    if (tipo === 'js') args.push('--minify-whitespace', '--minify-syntax');
    else args.push('--minify');
    const out = execFileSync('npx', args, { input: src, maxBuffer: 64 * 1024 * 1024, timeout: 90000 }).toString();
    return out && out.length ? out : src;
  } catch (e) {
    console.warn('aviso: minificação de ' + tipo + ' indisponível (' + String(e.message).split('\n')[0] + ') — usando fonte sem minificar');
    return src;
  }
}

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const lwc = fs.readFileSync(path.join(dir, 'lightweight-charts.standalone.production.js'), 'utf8');
const css = minificar(fs.readFileSync(path.join(dir, 'styles.css'), 'utf8'), 'css');
const app = minificar(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), 'js');

html = html.replace(
  /<!-- TradingView Lightweight Charts vendorizado localmente \(100% offline\) -->\s*<script src="lightweight-charts\.standalone\.production\.js"><\/script>/,
  '<script>\n' + lwc + '\n</script>'
);
html = html.replace(/<link rel="stylesheet" href="styles\.css">/, '<style>\n' + css + '\n</style>');
html = html.replace(/<script src="app\.js"><\/script>/, '<script>\n' + app + '\n</script>');

const leftovers = (html.match(/(href="styles\.css"|src="app\.js"|src="lightweight-charts\.standalone\.production\.js")/g) || []);
if (leftovers.length) { console.error('FALHA: referências externas restantes:', leftovers); process.exit(1); }

fs.writeFileSync(path.join(dir, 'Simulador_Standalone.html'), html);
console.log('OK: Simulador_Standalone.html gerado (' + html.length + ' bytes)');
