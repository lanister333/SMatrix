#!/usr/bin/env python3
"""Наблюдатель деплоя: снимает TCP-соединения и процессы во время POST /deploy."""
import subprocess, time, threading, json, os, sys

DURATION = float(sys.argv[1]) if len(sys.argv) > 1 else 35.0
OUT = "/tmp/deploy-watch-results.txt"

def tcp_snapshot():
    rows = {}
    for f in ('/proc/net/tcp', '/proc/net/tcp6'):
        try:
            lines = open(f).read().splitlines()[1:]
        except Exception:
            continue
        for l in lines:
            p = l.split()
            local, rem, st = p[1], p[2], p[3]
            if st == '0A' and local.endswith(':3138'):  # слушатель 12600
                continue
            rows[(local, rem, st)] = None
    return set(rows)

def ps_snapshot():
    out = set()
    for d in os.listdir('/proc'):
        if not d.isdigit():
            continue
        try:
            cmd = open(f'/proc/{d}/cmdline','rb').read().replace(b'\0', b' ').decode().strip()
            if cmd:
                out.add((d, cmd[:160]))
        except Exception:
            pass
    return out

results = {'net_events': {}, 'new_procs': {}}
stop = threading.Event()

def watcher():
    base_net = tcp_snapshot()
    base_ps = ps_snapshot()
    prev_net, prev_ps = base_net, base_ps
    t0 = time.time()
    while not stop.is_set() and time.time() - t0 < DURATION:
        time.sleep(0.3)
        try:
            cur_net = tcp_snapshot()
            cur_ps = ps_snapshot()
        except Exception:
            continue
        for k in cur_net - prev_net:
            key = f"{k[2]} {k[1]}"
            ts = round(time.time() - t0, 1)
            results['net_events'].setdefault(key, []).append(ts)
        for k in cur_ps - prev_ps:
            ts = round(time.time() - t0, 1)
            results['new_procs'].setdefault(k[1], []).append(ts)
        prev_net, prev_ps = cur_net, cur_ps

w = threading.Thread(target=watcher)
w.start()

# Триггерим деплой
r = subprocess.run(['curl','-sS','--max-time','120','-X','POST','http://127.0.0.1:12600/deploy',
                    '-H','Content-Type: application/json',
                    '-d','{"userid":"web-ffa7802c-17b4-4f3f-af27-29bbe13a199e","chatid":"4bb38ded-30a1-4868-be17-29c72578b3a8"}'],
                   capture_output=True, text=True)
stop.set(); w.join()

with open(OUT,'w') as f:
    f.write(f"=== DEPLOY RESPONSE ===\n{r.stdout}\n{r.stderr}\n\n")
    f.write("=== NEW NET EVENTS (state remote -> timestamps) ===\n")
    for k, v in sorted(results['net_events'].items()):
        f.write(f"{k} -> {v[:6]}\n")
    f.write("\n=== NEW PROCESSES ===\n")
    for k, v in sorted(results['new_procs'].items(), key=lambda x: x[1][0]):
        f.write(f"t={v[0]} {k}\n")
print(open(OUT).read())
