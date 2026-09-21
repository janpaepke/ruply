"""Finds which assertion statements of the stack top's type-test file make TS 5.9 run away (time/memory) against a
typings variant. Declarations are kept in every chunk; assertion statements are split into chunks, then narrowed.
Usage: bisect.py <variant-name-without-.d.ts>"""
import os, re, subprocess, sys
T = '/Users/janpaepke/.claude/jobs/f42d90c1/tmp'
P = f'{T}/linear'
WT = '/Users/janpaepke/dev/forks/ruply/.claude/worktrees/docs-and-chain-overloads'
os.chdir(P)
variant = sys.argv[1]
tsc = f'{T}/tsdcheck/node_modules/@tsd/typescript/typescript/lib/tsc.js'
test = subprocess.run(['git', '-C', WT, 'show', 'feat/ten-callbacks:test/index.test-d.ts'], capture_output=True, text=True, check=True).stdout
lines = test.split('\n')
# group into statements: a statement starts at a line with no leading whitespace which is not a closer
stmts = []
for i, line in enumerate(lines):
    if line and not line[0].isspace() and not line.startswith((')', '}', ']')) and not line.startswith('//'):
        stmts.append([i])
    elif stmts:
        stmts[-1].append(i)
def text(group):
    return '\n'.join(lines[i] for i in group)
decls = [g for g in stmts if re.match(r'(import|const|declare|type|interface|class|function|let|var)\b', lines[g[0]])]
asserts = [g for g in stmts if g not in decls]
print(f'{len(decls)} declarations, {len(asserts)} assertions')
os.makedirs('bisect', exist_ok=True)
tsd_types = f"declare function expectType<T>(value: T): void;\ndeclare function expectError<T = any>(value: T): void;\n"
def run(groups, label):
    src = tsd_types + '\n'.join(text(g) for g in decls if not lines[g[0]].startswith('import')) + '\n' + '\n'.join(text(g) for g in groups) + '\n'
    src = f"import {{ run, runIf, apply }} from '../{variant}';\n" + src
    f = f'bisect/{label}.ts'
    open(f, 'w').write(src)
    try:
        r = subprocess.run(['node', '--max-old-space-size=2048', tsc, '--strict', '--noEmit', '--skipLibCheck', '--target', 'es2017', '--moduleResolution', 'node', f], capture_output=True, text=True, timeout=40)
        if r.returncode == 0 or 'error TS' in r.stdout:
            return 'ok'
        return 'CRASH'
    except subprocess.TimeoutExpired:
        return 'TIMEOUT'
def bisect(groups, label, depth=0):
    status = run(groups, label)
    print(f'{"  " * depth}{label}: {len(groups)} assertions -> {status}')
    if status == 'ok' or len(groups) == 1:
        if status != 'ok':
            print(f'{"  " * depth}  CULPRIT line {groups[0][0] + 1}: {lines[groups[0][0]][:120]}')
        return
    half = len(groups) // 2
    bisect(groups[:half], label + 'a', depth + 1)
    bisect(groups[half:], label + 'b', depth + 1)
bisect(asserts, 'all')
