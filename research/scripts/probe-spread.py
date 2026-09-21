"""Behaviour probe for apply's spread overloads and a few edge shapes, on TS 4.9 and 5.9, against a typings variant."""
import os, re, subprocess, sys
T = '/Users/janpaepke/.claude/jobs/f42d90c1/tmp'
WT = '/Users/janpaepke/dev/forks/ruply/.claude/worktrees/docs-and-chain-overloads'
os.chdir(f'{T}/linear')
variant = sys.argv[1]
src = f"""import {{ run, runIf, apply }} from './{variant}';
declare const aNumber: number;
declare const aNumeralPromise: Promise<number>;
declare const increment: (value: number) => number;
declare const asyncIncrement: (value: number) => Promise<number>;
declare const throwError: (value: number) => never;
declare const syncCallbacks: Array<(value: number) => void>;
declare const asyncCallbacks: Array<(value: number) => Promise<void>>;
declare const maybeAsyncCallbacks: Array<(value: number) => void | Promise<void>>;
declare const throwingCallbacks: Array<(value: number) => never>;
declare const noCallbacks: [];
export const a = apply(aNumber, ...syncCallbacks, asyncIncrement);
export const b = apply(aNumber, ...maybeAsyncCallbacks, asyncIncrement);
export const c = apply(aNumber, increment, ...asyncCallbacks, increment);
export const d = apply(aNumber, ...asyncCallbacks, increment);
export const e = apply(aNumber, ...asyncCallbacks);
export const f = apply(aNumber, increment, ...asyncCallbacks);
export const g = apply(aNumber, ...noCallbacks);
export const h = apply(aNumber, increment, ...syncCallbacks, asyncIncrement);
export const i = apply(aNumber, increment, ...syncCallbacks, increment);
export const j = apply(aNumber, ...syncCallbacks, ...asyncCallbacks);
export const k = apply(aNumeralPromise, ...syncCallbacks, throwError);
export const l = apply(aNumber, ...throwingCallbacks);
export const m = apply(aNumber, ...syncCallbacks, throwError);
export const n = apply(aNumber, increment, throwError);
export const o = apply(aNumber, ...syncCallbacks, function (value) {{ return value * 2; }});
export const p = apply(aNumber, ...syncCallbacks, asyncIncrement, ...syncCallbacks);
export const q = apply(aNumber, ...syncCallbacks, increment, increment);
export const r = ({{ n: 1, apply }}).apply(aNumber, ...syncCallbacks, function (value) {{ const self: {{ n: number }} = this; return value; }});
export function forward<U extends Array<(value: number) => any>>(...callbacks: U) {{ return apply(aNumber, ...callbacks); }}
export function forwardThen<U extends Array<(value: number) => void>>(...callbacks: U) {{ return apply(aNumber, ...callbacks, asyncIncrement); }}
"""
open(f'spread-{variant}.ts', 'w').write(src)
for tsc, label in [(f'{WT}/node_modules/typescript/lib/tsc.js', '4.9'), (f'{T}/tsdcheck/node_modules/@tsd/typescript/typescript/lib/tsc.js', '5.9')]:
    out = f'spread-out-{label}'
    subprocess.run(['rm', '-rf', out])
    r = subprocess.run(['node', tsc, '--strict', '--declaration', '--emitDeclarationOnly', '--target', 'es2017', '--moduleResolution', 'node', '--outDir', out, f'spread-{variant}.ts'], capture_output=True, text=True, timeout=120)
    errs = [l for l in r.stdout.split('\n') if 'error TS' in l]
    print(f'== TS {label}: {len(errs)} errors')
    for l in errs[:10]: print('   ' + l[:160])
    path = f'{out}/spread-{variant}.d.ts'
    if os.path.exists(path):
        for name, typ in re.findall(r'export declare const (\w+): (.*);', open(path).read()):
            print(f'   {name}: {typ[:110]}')
        for line in re.findall(r'export declare function forward\w*.*', open(path).read()):
            print('   ' + line[:170])
