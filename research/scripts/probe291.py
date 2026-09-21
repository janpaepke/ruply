"""Which shapes of `Result` let TS 4.9 resolve `await run(value, async () => 1)` in a generic wrapper (test line 291)?
Standalone typings with a single-callback run; each variant compiled with TS 4.5, 4.9 and 5.9."""
import os, re, subprocess
T = '/Users/janpaepke/.claude/jobs/f42d90c1/tmp'
WT = '/Users/janpaepke/dev/forks/ruply/.claude/worktrees/docs-and-chain-overloads'
os.chdir(f'{T}/linear'); os.makedirs('p291', exist_ok=True)
base = """
type AsPromise<A> = Promise<A>;
type AsPromiseLike<A> = PromiseLike<A>;
type State = 'sync' | 'promise' | 'thenable' | 'never' | 'rejects' | 'rejectsThenable';
type StepState<A> =
	[A] extends [never] ? 'never'
	: A extends PromiseLike<infer X>
		? [X] extends [never]
			? (A extends { then(...a: Array<any>): Promise<any> } ? 'rejects' : 'rejectsThenable')
			: (A extends { then(...a: Array<any>): Promise<any> } ? 'promise' : 'thenable')
		: 'sync';
type Next<S extends State, K extends State> = {
	sync: { sync: 'sync', promise: 'promise', thenable: 'thenable', never: 'never', rejects: 'rejects', rejectsThenable: 'rejectsThenable' },
	promise: { sync: 'promise', promise: 'promise', thenable: 'promise', never: 'rejects', rejects: 'rejects', rejectsThenable: 'rejects' },
	thenable: { sync: 'thenable', promise: 'thenable', thenable: 'thenable', never: 'rejectsThenable', rejects: 'rejectsThenable', rejectsThenable: 'rejectsThenable' },
	never: { sync: 'never', promise: 'never', thenable: 'never', never: 'never', rejects: 'never', rejectsThenable: 'never' },
	rejects: { sync: 'rejects', promise: 'rejects', thenable: 'rejects', never: 'rejects', rejects: 'rejects', rejectsThenable: 'rejects' },
	rejectsThenable: { sync: 'rejectsThenable', promise: 'rejectsThenable', thenable: 'rejectsThenable', never: 'rejectsThenable', rejects: 'rejectsThenable', rejectsThenable: 'rejectsThenable' },
}[S][K];
%s
declare function run<T, R, C>(this: C, value: T, callback: (this: C, value: Awaited<T>) => R): Result<Next<'sync', StepState<T>>, R>;
export { run };
"""
variants = {
    'cond': """type Result<S extends State, R> =
	S extends 'sync' ? R : S extends 'promise' ? AsPromise<Awaited<R>> : S extends 'thenable' ? AsPromiseLike<Awaited<R>> : S extends 'never' ? never : S extends 'rejects' ? AsPromise<never> : AsPromiseLike<never>;""",
    'table': """type Result<S extends State, R> = { sync: R, promise: AsPromise<Awaited<R>>, thenable: AsPromiseLike<Awaited<R>>, never: never, rejects: AsPromise<never>, rejectsThenable: AsPromiseLike<never> }[S];""",
    'cond-sync-last': """type Result<S extends State, R> =
	S extends 'promise' ? AsPromise<Awaited<R>> : S extends 'thenable' ? AsPromiseLike<Awaited<R>> : S extends 'never' ? never : S extends 'rejects' ? AsPromise<never> : S extends 'rejectsThenable' ? AsPromiseLike<never> : R;""",
    'cond-redistributed': """type Result<S extends State, R> = S extends infer S2 ? S2 extends 'sync' ? R : S2 extends 'promise' ? AsPromise<Awaited<R>> : S2 extends 'thenable' ? AsPromiseLike<Awaited<R>> : S2 extends 'never' ? never : S2 extends 'rejects' ? AsPromise<never> : AsPromiseLike<never> : never;""",
    'cond-grouped': """type Result<S extends State, R> =
	S extends 'sync' ? R : S extends 'never' ? never : S extends 'promise' | 'rejects' ? AsPromise<S extends 'promise' ? Awaited<R> : never> : AsPromiseLike<S extends 'thenable' ? Awaited<R> : never>;""",
    'table-on-State-first': """type Result<S extends State, R> = S extends State ? { sync: R, promise: AsPromise<Awaited<R>>, thenable: AsPromiseLike<Awaited<R>>, never: never, rejects: AsPromise<never>, rejectsThenable: AsPromiseLike<never> }[S] : never;""",
}
consumer = """import { run } from './%s';
export const awaitedInWrapper = async <T>(value: T): Promise<number> => await run(value, async () => 1);
export const plain = run(1 as number, async () => 1);
export const p: Promise<number> = plain;
"""
compilers = [(f'{T}/tsold/ts-4.5.5/lib/tsc.js', '4.5'), (f'{WT}/node_modules/typescript/lib/tsc.js', '4.9'), (f'{T}/tsdcheck/node_modules/@tsd/typescript/typescript/lib/tsc.js', '5.9')]
for name, result in variants.items():
    open(f'p291/{name}.d.ts', 'w').write(base % result)
    open(f'p291/c-{name}.ts', 'w').write(consumer % name)
    row = f'{name:22}'
    for tsc, label in compilers:
        r = subprocess.run(['node', tsc, '--strict', '--noEmit', '--target', 'es2017', '--moduleResolution', 'node', f'p291/c-{name}.ts'], capture_output=True, text=True, timeout=60)
        errs = re.findall(r'c-[\w-]+\.ts\((\d+),\d+\): error (TS\d+)', r.stdout)
        row += f'  {label}: ' + ('ok' if not errs else ','.join(f'L{l}:{c}' for l, c in errs))
    print(row)
