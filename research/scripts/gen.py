"""Generates a full rewrite of the stack top's index.d.ts on the state-machine design, then runs the stack top's
complete type suite against it (tsd 0.33/TS 5.9 and tsd 0.25/TS 4.9) and measures declaration-emit sizes.
Usage: gen.py <variant>   where variant is 'awaited' (lib Awaited, TS >= 4.5) or 'resolve' (private Resolve)."""
import os, re, subprocess, sys
T = '/Users/janpaepke/.claude/jobs/f42d90c1/tmp'
P = f'{T}/linear'
WT = '/Users/janpaepke/dev/forks/ruply/.claude/worktrees/docs-and-chain-overloads'
HEAD = 'feat/ten-callbacks'
os.chdir(P)
variant = sys.argv[1]
AW = 'Awaited' if variant == 'awaited' else 'Resolve'
DRR = sys.argv[2] if len(sys.argv) > 2 else 'all'
PFORM = sys.argv[3] if len(sys.argv) > 3 else 'awaited'

asis = subprocess.run(['git', '-C', WT, 'show', f'{HEAD}:index.d.ts'], capture_output=True, text=True, check=True).stdout
def doc_before(name):
    m = re.search(r'(/\*\*\n(?: \*[^\n]*\n)*? \*/\n)declare function ' + name + '<', asis)
    assert m, name
    return m.group(1)

PR = f'{AW}<R>' if PFORM == 'awaited' else f'R extends PromiseLike<any> ? {AW}<R> : R'
RFORM = sys.argv[4] if len(sys.argv) > 4 else 'cond'
variant = f'{variant}-{DRR}-{PFORM}-{RFORM}'
if RFORM == 'cond':
    RESULT = f"""
	S extends 'sync' ? R
	: S extends 'promise' ? AsPromise<{PR}>
	: S extends 'thenable' ? AsPromiseLike<{PR}>
	: S extends 'never' ? never
	: S extends 'rejects' ? AsPromise<never>
	: AsPromiseLike<never>"""
elif RFORM == 'condlast':
    RESULT = f"""
	S extends 'promise' ? AsPromise<{PR}>
	: S extends 'thenable' ? AsPromiseLike<{PR}>
	: S extends 'never' ? never
	: S extends 'rejects' ? AsPromise<never>
	: S extends 'rejectsThenable' ? AsPromiseLike<never>
	: R"""
elif RFORM == 'condtable':
    RESULT = f"""
	S extends 'promise' | 'thenable' | 'never' | 'rejects' | 'rejectsThenable'
		? {{ promise: AsPromise<{PR}>, thenable: AsPromiseLike<{PR}>, never: never, rejects: AsPromise<never>, rejectsThenable: AsPromiseLike<never> }}[S]
		: R"""
elif RFORM == 'table':
    RESULT = f"""{{
	sync: R, promise: AsPromise<{PR}>, thenable: AsPromiseLike<{PR}>, never: never, rejects: AsPromise<never>, rejectsThenable: AsPromiseLike<never>
}}[S]"""
else:
    RESULT = 'Results<R>[S]'
RESULTS_ALIAS = ('\ntype Results<R> = { sync: R, promise: AsPromise<' + PR + '>, thenable: AsPromiseLike<' + PR + '>, never: never, rejects: AsPromise<never>, rejectsThenable: AsPromiseLike<never> };') if RFORM == 'tablealias' else ''

resolve_def = '' if AW == 'Awaited' else """/**
 * If `T` is promise-like, the type of the values to which it resolves. Otherwise `T` itself.
 */
type Resolve<T> = T extends PromiseLike<infer A> ? A : T;
"""
helpers = f"""/**
 * The types which count as null-ish. Includes `void`, as a function without a return value results in `undefined`.
 */
type Nullish = null | undefined | void;
{resolve_def}/**
 * A promise of the same kind as the promise-like `T` which resolves to values of type `A`: a `Promise` if the `then`
 * method of `T` returns promises, a `PromiseLike` otherwise.
 */
type Rewrap<T, A> = T extends {{ then(...a: Array<any>): Promise<any> }} ? AsPromise<A> : AsPromiseLike<A>;
/**
 * `Promise<A>` and `PromiseLike<A>`. Every promise in these helpers is produced through these two aliases, as TypeScript
 * only recognises promises of the same type as one and the same if they stem from the same declaration.
 */
type AsPromise<A> = Promise<A>;
type AsPromiseLike<A> = PromiseLike<A>;
/**
 * Like `Exclude` except that if `T` is promise-like, the exclusion logic is applied to the type of the values to which
 * it resolves instead of to `T` directly.
 */
type ExcludeAsynchronous<T, U> = T extends PromiseLike<infer A> ? [A] extends [never] ? T : A extends U ? never : Rewrap<T, A> : T extends U ? never : T;
/**
 * Like `Extract` except that if `T` is promise-like, the extraction logic is applied to the type of the values to which
 * it resolves instead of to `T` directly.
 */
type ExtractAsynchronous<T, U> = T extends PromiseLike<infer A> ? A extends U ? Rewrap<T, A> : never : T extends U ? T : never;
/**
 * `T` without promises which always reject (`Promise<never>`, `PromiseLike<never>`) if `T` includes other promises: a
 * promise which always rejects adds nothing to a union which is asynchronous anyway.
 */
type DropRedundantRejection<T> = [Extract<Exclude<T, PromiseLike<never>>, PromiseLike<any>>] extends [never] ? T : Exclude<T, PromiseLike<never>>;
/**
 * The state of a chain: whether it is still synchronous, has turned asynchronous (and into which kind of promise), has
 * ended because a step never produces a value, or has ended in a rejection. A chain which is only sometimes asynchronous
 * is in a union of states, over which everything below distributes.
 */
type State = 'sync' | 'promise' | 'thenable' | 'never' | 'rejects' | 'rejectsThenable';
/**
 * The state a chain enters through a single step which produces values of type `A`.
 */
type StepState<A> =
	[A] extends [never] ? 'never'
	: A extends PromiseLike<infer X>
		? [X] extends [never]
			? (A extends {{ then(...a: Array<any>): Promise<any> }} ? 'rejects' : 'rejectsThenable')
			: (A extends {{ then(...a: Array<any>): Promise<any> }} ? 'promise' : 'thenable')
		: 'sync';
/**
 * The state of a chain in state `S` after a step in state `K`: a chain keeps the kind of promise it first turned
 * asynchronous with, a step which never produces a value ends the chain (as a rejection if the chain was asynchronous),
 * and an ended chain stays ended. A lookup table rather than conditions on `S`, so that `S` is mentioned once: a
 * consumer's declaration file spells these types out for every step of a chain, and would otherwise grow exponentially.
 */
type Next<S extends State, K extends State> = {{
	sync: {{ sync: 'sync', promise: 'promise', thenable: 'thenable', never: 'never', rejects: 'rejects', rejectsThenable: 'rejectsThenable' }},
	promise: {{ sync: 'promise', promise: 'promise', thenable: 'promise', never: 'rejects', rejects: 'rejects', rejectsThenable: 'rejects' }},
	thenable: {{ sync: 'thenable', promise: 'thenable', thenable: 'thenable', never: 'rejectsThenable', rejects: 'rejectsThenable', rejectsThenable: 'rejectsThenable' }},
	never: {{ sync: 'never', promise: 'never', thenable: 'never', never: 'never', rejects: 'never', rejectsThenable: 'never' }},
	rejects: {{ sync: 'rejects', promise: 'rejects', thenable: 'rejects', never: 'rejects', rejects: 'rejects', rejectsThenable: 'rejects' }},
	rejectsThenable: {{ sync: 'rejectsThenable', promise: 'rejectsThenable', thenable: 'rejectsThenable', never: 'rejectsThenable', rejects: 'rejectsThenable', rejectsThenable: 'rejectsThenable' }},
}}[S][K];
/**
 * The state of a chain in state `S` after the steps `U`.
 */
type Fold<U extends Array<unknown>, S extends State> =
	U extends [infer A, ...infer B] ? Fold<B, Next<S, StepState<A>>> : S;
/**
 * The result of a chain in state `S` whose last step produces values of type `R`.
 */
type Result<S extends State, R> = {RESULT};{RESULTS_ALIAS}
/**
 * The result of a chain which starts with a value of type `U[0]`, passes it through the steps `U[1]`…, and ends with a
 * step which produces values of type `R`.
 */
type Chain<U extends Array<unknown>, R> = {'DropRedundantRejection<Result<Fold<U, %s>, R>>' % (chr(39)+'sync'+chr(39)) if DRR == 'all' else 'Result<Fold<U, %s>, R>' % (chr(39)+'sync'+chr(39))};
/**
 * Like `Chain`, except that a null-ish value ends the chain: it becomes part of the result, and only non-null-ish values
 * are passed on to the next step.
 */
type ChainUntilNullish<U extends Array<unknown>, R> = DropRedundantRejection<ChainUntilNullishSteps<U, 'sync', R>>;
type ChainUntilNullishSteps<U extends Array<unknown>, S extends State, R> =
	U extends [infer A, ...infer B]
		? Result<S, ExtractAsynchronous<A, Nullish>> | ChainUntilNullishSteps<B, Next<S, StepState<ExcludeAsynchronous<A, Nullish>>>, R>
		: Result<S, R>;
/**
 * The type which results from passing values of type `T` through steps which produce values of the types `U` and then
 * returning those values themselves rather than the result of the last step. `T` is not a step: if it is promise-like,
 * the steps run once it resolves, so the only effect they can have on it is that one which throws turns it into a
 * promise which rejects. Otherwise the steps make `T` asynchronous as they would any result. (A promise-like `T` is
 * returned as its own type, although the runtime returns what its `then` produces; the two differ only for thenables
 * which are not promises.)
 */
type ChainReturningValue<U extends Array<unknown>, T> = {'DropRedundantRejection<ChainReturningValueIn<Fold<U, %s>, T>>' % (chr(39)+'sync'+chr(39)) if DRR == 'all' else 'ChainReturningValueIn<Fold<U, %s>, T>' % (chr(39)+'sync'+chr(39))};
type ChainReturningValueIn<S extends State, T> =
	T extends PromiseLike<any> ? (S extends 'never' | 'rejects' | 'rejectsThenable' ? Rewrap<T, never> : T) : Result<S, T>;
"""

params = ['T', 'Z', 'Y', 'X', 'W', 'V', 'U', 'S', 'Q', 'P']
def overloads(name, arg, ret):
    out = []
    for n in range(1, 11):
        ps = params[:n]
        generics = ', '.join(ps + ['R', 'C'])
        cbs = [f'(this: C, value: {arg(p)}) => {nxt}' for p, nxt in zip(ps, ps[1:] + ['R'])]
        if n == 1:
            sig = f'declare function {name}<{generics}>(this: C, value: T, callback: {cbs[0]}):'
        else:
            sig = f'declare function {name}<{generics}>(this: C, value: T, ...callbacks: [{", ".join(cbs)}]):'
        out.append(sig + '\n\t' + ret(ps) + ';')
    return '\n'.join(out)

run_ol = overloads('run', lambda p: f'{AW}<{p}>', lambda ps: f'Chain<[{", ".join(ps)}], R>')
runif_ol = overloads('runIf', lambda p: f'Exclude<{AW}<{p}>, Nullish>', lambda ps: f'ChainUntilNullish<[{", ".join(ps)}], R>')

# apply: fixed arities 1..10 over return types, then spread shapes.
apply_lines = []
rets = ['Z', 'Y', 'X', 'W', 'V', 'U', 'S', 'Q', 'P', 'O']
for n in range(1, 11):
    rs = rets[:n]
    cbs = [f'(this: C, value: {AW}<T>) => {r}' for r in rs]
    generics = ', '.join(['T'] + rs + ['C'])
    if n == 1:
        sig = f'declare function apply<{generics}>(this: C, value: T, callback: {cbs[0]}):'
    else:
        sig = f'declare function apply<{generics}>(this: C, value: T, ...callbacks: [{", ".join(cbs)}]):'
    apply_lines.append(sig + f'\n\tChainReturningValue<[{", ".join(rs)}], T>;')
F = f'(this: C, value: {AW}<T>) => any'
apply_lines.append(f"""// ↓ Callbacks spread from an array, possibly around fixed callbacks: the array's element type stands in for every step
// it contributes. In the last overload the return type is read off the array as a whole, so that an array holding
// callbacks of several types (two spread arrays, for example) counts as possibly asynchronous.
declare function apply<T, Z, Y, X, C>(this: C, value: T, ...callbacks: [(this: C, value: {AW}<T>) => Z, ...Array<(this: C, value: {AW}<T>) => Y>, (this: C, value: {AW}<T>) => X]):
	ChainReturningValue<[Z, Y, X], T>;
declare function apply<T, Z, Y, C>(this: C, value: T, ...callbacks: [(this: C, value: {AW}<T>) => Z, ...Array<(this: C, value: {AW}<T>) => Y>]):
	ChainReturningValue<[Z, Y], T>;
declare function apply<T, Z, Y, C>(this: C, value: T, ...callbacks: [...Array<(this: C, value: {AW}<T>) => Z>, (this: C, value: {AW}<T>) => Y]):
	ChainReturningValue<[Z, Y], T>;
declare function apply<T, U extends Array<(this: C, value: {AW}<T>) => any>, C>(this: C, value: T, ...callbacks: U):
	ChainReturningValue<[ReturnType<U[number]>], T>;""")
apply_ol = '\n'.join(apply_lines)

full = helpers + doc_before('run') + run_ol + '\n' + doc_before('runIf') + runif_ol + '\n' + doc_before('apply') + apply_ol + '\n\nexport {\n\trun, runIf,\n\tapply\n};'
open(f'full-{variant}.d.ts', 'w').write(full)
print(f'full-{variant}.d.ts written ({len(full)} chars)')

# The stack top's type suite.
test = subprocess.run(['git', '-C', WT, 'show', f'{HEAD}:test/index.test-d.ts'], capture_output=True, text=True, check=True).stdout
pkg = subprocess.run(['git', '-C', WT, 'show', f'{HEAD}:package.json'], capture_output=True, text=True, check=True).stdout
for label, modules in [('tsd 0.33 / TS 5.9', f'{T}/tsdcheck/node_modules'), ('tsd 0.25 / TS 4.9', f'{WT}/node_modules')]:
    d = f'{P}/pkg-{variant}-{label[4:8]}'
    subprocess.run(['rm', '-rf', d]); os.makedirs(f'{d}/test')
    open(f'{d}/package.json', 'w').write(pkg)
    open(f'{d}/test/index.test-d.ts', 'w').write(test)
    open(f'{d}/index.d.ts', 'w').write(full)
    os.symlink('../index.d.ts', f'{d}/test/index.d.ts')
    os.symlink(modules, f'{d}/node_modules')
    r = subprocess.run(['npx', 'tsd', 'test'], cwd=d, capture_output=True, text=True)
    text = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
    fails = re.findall(r'✖\s+(\d+):\d+\s+(.*)', text)
    print(f'{label}: {"pass" if r.returncode == 0 else f"{len(fails)} failures"}')
    for line, msg in fails[:40]:
        src = test.split('\n')[int(line) - 1].strip()
        print(f'   {line}: {msg[:100]}\n        {src[:120]}')
