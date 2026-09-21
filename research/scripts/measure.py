"""Per-wrapper declaration-emit size for a typings variant (argument 1, without .d.ts), on TS 4.9 and 5.9."""
import os, re, subprocess, sys
T = '/Users/janpaepke/.claude/jobs/f42d90c1/tmp'
P = f'{T}/linear'
WT = '/Users/janpaepke/dev/forks/ruply/.claude/worktrees/docs-and-chain-overloads'
os.chdir(P)
variant = sys.argv[1]
cases = []
for n in [1, 2, 3, 4, 5, 8, 10]:
    cases.append((f'run{n}', f"export function run{n}<T>(value: T) {{ return run(value, {', '.join(['v => v'] * n)}); }}"))
for n in [1, 2, 3, 4, 5, 8, 10]:
    cases.append((f'runIf{n}', f"export function runIf{n}<T>(value: T) {{ return runIf(value, {', '.join(['v => v'] * n)}); }}"))
for n in [5, 10]:
    cases.append((f'apply{n}', f"export function apply{n}<T>(value: T) {{ return apply(value, {', '.join(['v => {}'] * n)}); }}"))
cases.append(('forward', 'export function forward<U extends Array<(value: number) => any>>(...callbacks: U) { return apply(1 as number, ...callbacks); }'))
compilers = [(f'{WT}/node_modules/typescript/lib/tsc.js', '4.9'), (f'{T}/tsdcheck/node_modules/@tsd/typescript/typescript/lib/tsc.js', '5.9')]
if len(sys.argv) > 2:
    compilers = [c for c in compilers if c[1] in sys.argv[2:]]
os.makedirs(f'cases-{variant}', exist_ok=True)
print(f'variant {variant}:')
for name, src in cases:
    row = f'  {name:8}'
    for tsc, label in compilers:
        f = f'cases-{variant}/{name}.ts'
        open(f, 'w').write(f"import {{ run, runIf, apply }} from '../{variant}';\n{src}\n")
        out = f'cases-{variant}/out-{name}-{label}'
        subprocess.run(['rm', '-rf', out])
        try:
            r = subprocess.run(['node', '--max-old-space-size=1024', tsc, '--strict', '--declaration', '--emitDeclarationOnly', '--outDir', out, f], capture_output=True, text=True, timeout=45)
            diag = ', '.join(sorted(set(re.findall(r'error (TS\d+)', r.stdout + r.stderr))))
            if r.returncode != 0 and not diag:
                diag = 'CRASH'
        except subprocess.TimeoutExpired:
            diag = 'TIMEOUT'
        path = f'{out}/{name}.d.ts'
        if os.path.exists(path) and not diag:
            row += f'  {label}: {os.path.getsize(path):>9,}'
        else:
            row += f'  {label}: {diag:>9}'
    print(row, flush=True)
