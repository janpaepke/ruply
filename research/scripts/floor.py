"""Compiles the stack top's type-test file (with tsd's expectType/expectError stubbed) against a typings variant under
older compilers, to find the floor. Usage: floor.py <variant>"""
import os, re, subprocess, sys
T = '/Users/janpaepke/.claude/jobs/f42d90c1/tmp'
WT = '/Users/janpaepke/dev/forks/ruply/.claude/worktrees/docs-and-chain-overloads'
os.chdir(f'{T}/linear')
variant = sys.argv[1]
test = subprocess.run(['git', '-C', WT, 'show', 'feat/ten-callbacks:test/index.test-d.ts'], capture_output=True, text=True, check=True).stdout
test = test.replace("import { expectType, expectError } from 'tsd';", "declare function expectType<T>(value: T): void;\ndeclare function expectError<T = any>(value: T): void;")
test = test.replace("from '..';", f"from '../{variant}';")
os.makedirs('floor', exist_ok=True)
open('floor/suite.ts', 'w').write(test)
for v in ['4.2.4', '4.4.4', '4.5.5']:
    tsc = f'{T}/tsold/ts-{v}/lib/tsc.js'
    r = subprocess.run(['node', tsc, '--strict', '--noEmit', '--target', 'es2017', '--moduleResolution', 'node', 'floor/suite.ts'], capture_output=True, text=True, timeout=300)
    errs = [l for l in r.stdout.split('\n') if 'error TS' in l]
    # expectError lines are meant to error; count only errors outside them
    lines = test.split('\n')
    real = [e for e in errs if not (m := re.search(r'suite\.ts\((\d+),', e)) or 'expectError' not in lines[int(m.group(1)) - 1]]
    print(f'TS {v}: {len(errs)} errors, {len(real)} outside expectError lines')
    for e in real[:6]:
        print('   ' + e[:170])
