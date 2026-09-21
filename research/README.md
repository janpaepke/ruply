# Declaration emit of ruply's chain typings: research and prototypes

Parked on 2026-09-21. Reference material, not part of the package. Context: the typing-fix PR stack (#6 → #7 → #10 →
#11 → #16 → #17) replaces the intersection-based chain typings by a step-wise fold. Any consumer that compiles with
`declaration: true` and wraps `run`, `runIf` or `apply` in an unannotated generic function gets ruply's private helper
types *expanded* into its own declaration file (the emitter can only name exported types). With the fold, that expansion
grows exponentially with the number of callbacks: TS7056 at four or five callbacks, a stack overflow or heap exhaustion
at eight and more, and a crash without any diagnostic for a generic pass-through of a callback tuple into `apply`.

`declaration-emit-research.md` is the research report on what TypeScript offers and what other libraries do.
Short version: nothing makes a private alias nameable; every heavy-inference library exports its helpers (flat, under a
namespace, or under a "do not import" subpath); expansion is also silently lossy for re-entered or deeply nested types
(`/*elided*/ any`), which neither design here triggers.

## The two options

**Option 1, `option1-all-helpers-in-internals.d.ts`** (built on #10's typings): keep the fold, export every helper
under a `declare namespace internals`. Consumers' declarations then reference `import("ruply").internals.Chain<…>` by
name: 0.6 KB for a five-callback run wrapper, 2.6 KB for runIf. Floor stays TS 4.2 (leading rest elements). Costs: the
helper names become public API and consumers' published declarations depend on them; hovers show `internals.Chain<…>`.

**Option 2, `option2-state-machine.d.ts`** (built from the stack top, passes its entire type suite unchanged): the chain
carries a small *state* (`'sync' | 'promise' | 'thenable' | 'never' | 'rejects' | 'rejectsThenable'`, a maybe-async chain
being a union of states), each step advances it through a lookup table which mentions the state once, and the state is
applied to the result once at the end. Nothing is exported; emitted declarations are self-contained. `apply` gets fixed
arities 1–10 plus three spread overloads plus an `Array<F>` overload whose result comes from `ReturnType<U[number]>`, so
no recursion is reachable from a consumer. Floor moves to TS 4.5 for the lib's `Awaited`, which keeps callback parameter
types nameable (a private `Resolve` nests exponentially again *and* breaks the generic-wrapper tests of #16: TypeScript
special-cases `Awaited<T>` as assignable to `T`). Chosen on 2026-09-21.

Load-bearing details found the hard way, all pinned by the existing suite:

- Every promise must be created through one alias (`AsPromise<A> = Promise<A>`): TypeScript caches a deferred
  `Promise<X>` per syntactic node, so promises built at two nodes are two non-identical `Promise<null>` types and tsd's
  `expectType` sees `Promise<null> | Promise<null>` (`scripts/identity.js` shows the two type ids).
- `Result`'s conditional must put the synchronous case in its final else branch, or TS 4.9 cannot `await` a generic
  wrapper's result (`scripts/probe291.py`).
- A table form of `Result` (`{…}[S]`) makes TS 5.9 run out of memory on ten-callback runIf chains, and a half-table
  form reports "excessive complexity"; only `Next` is a table (`scripts/bisect.py` found the lines).
- The mixed spread overloads must type their array element concretely (`Array<(this: C, value: Awaited<T>) => Y>`);
  with a generic element `F`, TS 4.9 cannot infer it from a spread inside a leading-rest tuple, and inline callbacks lose
  their contextual type.

## Measurements (bytes of the consumer's emitted `.d.ts` for `<T>(value: T) => fn(value, …)`)

| callbacks | run, fold (#10) | run, option 2 | runIf, fold (#10) | runIf, option 2 | apply, option 2 |
|---|---|---|---|---|---|
| 1 | 0.4k | 1.2k | 3k | 10k | 81 |
| 3 | 40k | 7.6k | 253k | 92k | |
| 5 | TS7056 | 14k | TS7056 | 260k | 81 |
| 8 | crash | 25k | crash | 700k | |
| 10 | crash | 32k | crash | TS7056 | 82 |

Generic callback-tuple pass-through into `apply`: crash with the fold, 1.4 KB with option 2. Identical on TS 4.9, 5.9 and
7.0 (option 2 also checked on 4.5.5; 4.2–4.4 lack `Awaited`). Single-letter state names shrink runIf by only ~15%.
Option 2 also passed the consumer monorepo's type checks (service and frontend) with results identical to the stack top.

## Scripts (paths inside refer to the job's scratch directory and old compilers fetched with `npm pack`)

- `gen.py` generates option 2 from the stack top's file (flags: `awaited|resolve`, rejection-dropping scope, promise
  branch form, `Result` form) and runs the stack top's suite under tsd 0.33 / TS 5.9 and tsd 0.25 / TS 4.9.
- `measure.py` emits generic wrappers of 1–10 callbacks and reports declaration sizes; `probe-spread.py` checks the spread
  shapes; `floor.py` compiles the suite with old compilers; `bisect.py` finds runaway test lines; `identity.js` and
  `probe291.py` reproduce the two compiler quirks above.
