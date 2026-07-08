#!/usr/bin/env python3
"""Cérebro estilo Obsidian: servidor local que liga todas as notas/pesquisas
num grafo interativo (força-dirigido, canvas, sem dependências externas).

Nós = notas .md em .claude/brain/ + .claude/MEMORY.md + rotinas do módulo VBA.
Arestas = [[wikilinks]] entre notas e menções a nomes de Sub/Function.

Uso: brain_server.py [porta]           (padrão 8765)
Notas: escreva .md em .claude/brain/ com [[NomeDeOutraNota]] ou nomes de rotinas.
"""
import glob, html, json, os, re, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.getcwd()
BRAIN = os.path.join(ROOT, ".claude", "brain")
MEMORY = os.path.join(ROOT, ".claude", "MEMORY.md")
BAS = os.path.join(ROOT, "vba", "AnaliseCKCP_OTIMIZADO.bas")

def vba_routines():
    out = {}
    try:
        with open(BAS, encoding="utf-8", errors="replace") as f:
            for i, ln in enumerate(f, 1):
                m = re.match(r"\s*(?:Public |Private )?(Sub|Function) (\w+)", ln)
                if m:
                    out[m.group(2)] = i
    except OSError:
        pass
    return out

def notes():
    os.makedirs(BRAIN, exist_ok=True)
    out = {}
    for p in glob.glob(os.path.join(BRAIN, "**", "*.md"), recursive=True):
        out[os.path.splitext(os.path.basename(p))[0]] = p
    if os.path.isfile(MEMORY):
        out["MEMORY"] = MEMORY
    return out

def build_graph():
    ns, routines = notes(), vba_routines()
    nodes, edges, seen = [], [], set()
    def add(nid, kind):
        if nid not in seen:
            seen.add(nid)
            nodes.append({"id": nid, "kind": kind})
    for name in ns:
        add(name, "note")
    for name, path in ns.items():
        try:
            txt = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        for target in re.findall(r"\[\[([^\]|#]+)", txt):
            target = target.strip()
            add(target, "note" if target in ns else "ghost")
            edges.append([name, target])
        for r in routines:
            if re.search(r"\b" + re.escape(r) + r"\b", txt):
                add(r, "vba")
                edges.append([name, r])
    return {"nodes": nodes, "edges": edges,
            "stats": {"notas": len(ns), "rotinas_vba": len(routines)}}

PAGE = """<!doctype html><meta charset=utf-8><title>Brain — AnaliseCKCP</title>
<style>body{margin:0;background:#16161d;color:#dcd7ba;font:13px/1.4 system-ui}
#top{padding:8px 14px;background:#1f1f28;display:flex;gap:14px;align-items:center}
#top b{color:#7e9cd8}canvas{display:block}#note{position:fixed;right:0;top:42px;
bottom:0;width:34%;overflow:auto;background:#1f1f28;padding:14px;white-space:pre-wrap;
border-left:1px solid #2a2a37;display:none}input{background:#16161d;color:#dcd7ba;
border:1px solid #2a2a37;padding:4px 8px;border-radius:4px}</style>
<div id=top><b>🧠 Brain</b><span id=stats></span>
<input id=q placeholder="filtrar..."><span style="color:#727169">notas=azul · VBA=verde · fantasma=cinza · clique abre</span></div>
<canvas id=c></canvas><div id=note></div>
<script>
let G,N=[],E=[],sel=null;const c=document.getElementById('c'),x=c.getContext('2d');
function fit(){c.width=innerWidth;c.height=innerHeight-42}fit();onresize=fit;
fetch('/api/graph').then(r=>r.json()).then(g=>{G=g;
document.getElementById('stats').textContent=`${g.stats.notas} notas · ${g.stats.rotinas_vba} rotinas VBA · ${g.edges.length} ligações`;
N=g.nodes.map(n=>({...n,x:Math.random()*c.width,y:Math.random()*c.height,vx:0,vy:0}));
E=g.edges.map(([a,b])=>[N.findIndex(n=>n.id==a),N.findIndex(n=>n.id==b)]).filter(e=>e[0]>=0&&e[1]>=0);
loop()});
function loop(){for(let it=0;it<3;it++){
for(const[a,b]of E){const A=N[a],B=N[b],dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy)||1,f=(d-90)*0.002;
A.vx+=dx/d*f*d;A.vy+=dy/d*f*d;B.vx-=dx/d*f*d;B.vy-=dy/d*f*d}
for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const A=N[i],B=N[j];
let dx=B.x-A.x,dy=B.y-A.y,d2=dx*dx+dy*dy+0.1,f=1200/d2;
A.vx-=dx*f;A.vy-=dy*f;B.vx+=dx*f;B.vy+=dy*f}
for(const n of N){n.vx+=(c.width/2-n.x)*0.0005;n.vy+=(c.height/2-n.y)*0.0005;
n.x+=n.vx*=0.85;n.y+=n.vy*=0.85}}
draw();requestAnimationFrame(loop)}
const col={note:'#7e9cd8',vba:'#98bb6c',ghost:'#54546d'};
function draw(){x.clearRect(0,0,c.width,c.height);const q=document.getElementById('q').value.toLowerCase();
x.strokeStyle='#2a2a37';for(const[a,b]of E){x.beginPath();x.moveTo(N[a].x,N[a].y);x.lineTo(N[b].x,N[b].y);x.stroke()}
for(const n of N){const hit=q&&n.id.toLowerCase().includes(q);
x.fillStyle=hit?'#e6c384':col[n.kind];x.beginPath();
x.arc(n.x,n.y,n.kind=='note'?7:5,0,7);x.fill();
x.fillStyle=hit?'#e6c384':'#9c9a90';x.fillText(n.id,n.x+9,n.y+4)}}
c.onclick=e=>{const mx=e.offsetX,my=e.offsetY;
const n=N.find(n=>Math.hypot(n.x-mx,n.y-my)<10);const box=document.getElementById('note');
if(!n){box.style.display='none';return}
fetch('/api/node?id='+encodeURIComponent(n.id)).then(r=>r.text()).then(t=>{
box.textContent=t;box.style.display='block'})};
document.getElementById('q').oninput=draw;
</script>"""

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, body, ctype="text/html; charset=utf-8", code=200):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/":
            self._send(PAGE)
        elif u.path == "/api/graph":
            self._send(json.dumps(build_graph()), "application/json")
        elif u.path == "/api/node":
            nid = parse_qs(u.query).get("id", [""])[0]
            ns, rs = notes(), vba_routines()
            if nid in ns:
                self._send(open(ns[nid], encoding="utf-8", errors="replace").read(),
                           "text/plain; charset=utf-8")
            elif nid in rs:
                # extrai o corpo da rotina, mesmo truque do vba_sub.sh
                out, on = [], False
                for i, ln in enumerate(open(BAS, encoding="utf-8", errors="replace"), 1):
                    if not on and re.search(r"(Sub|Function) " + re.escape(nid) + r"[( ]", ln):
                        on = True
                    if on:
                        out.append(f"{i}\t{ln.rstrip()}")
                        if re.match(r"\s*End (Sub|Function)", ln):
                            break
                self._send("\n".join(out) or "(não encontrada)", "text/plain; charset=utf-8")
            else:
                self._send(f"(nota fantasma: crie .claude/brain/{nid}.md)",
                           "text/plain; charset=utf-8")
        else:
            self._send("404", code=404)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"🧠 brain em http://localhost:{port}  (notas: .claude/brain/*.md)")
    HTTPServer(("127.0.0.1", port), H).serve_forever()
