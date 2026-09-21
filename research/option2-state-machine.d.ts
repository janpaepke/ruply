/**
 * The types which count as null-ish. Includes `void`, as a function without a return value results in `undefined`.
 */
type Nullish = null | undefined | void;
/**
 * A promise of the same kind as the promise-like `T` which resolves to values of type `A`: a `Promise` if the `then`
 * method of `T` returns promises, a `PromiseLike` otherwise.
 */
type Rewrap<T, A> = T extends { then(...a: Array<any>): Promise<any> } ? AsPromise<A> : AsPromiseLike<A>;
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
			? (A extends { then(...a: Array<any>): Promise<any> } ? 'rejects' : 'rejectsThenable')
			: (A extends { then(...a: Array<any>): Promise<any> } ? 'promise' : 'thenable')
		: 'sync';
/**
 * The state of a chain in state `S` after a step in state `K`: a chain keeps the kind of promise it first turned
 * asynchronous with, a step which never produces a value ends the chain (as a rejection if the chain was asynchronous),
 * and an ended chain stays ended. A lookup table rather than conditions on `S`, so that `S` is mentioned once: a
 * consumer's declaration file spells these types out for every step of a chain, and would otherwise grow exponentially.
 */
type Next<S extends State, K extends State> = {
	sync: { sync: 'sync', promise: 'promise', thenable: 'thenable', never: 'never', rejects: 'rejects', rejectsThenable: 'rejectsThenable' },
	promise: { sync: 'promise', promise: 'promise', thenable: 'promise', never: 'rejects', rejects: 'rejects', rejectsThenable: 'rejects' },
	thenable: { sync: 'thenable', promise: 'thenable', thenable: 'thenable', never: 'rejectsThenable', rejects: 'rejectsThenable', rejectsThenable: 'rejectsThenable' },
	never: { sync: 'never', promise: 'never', thenable: 'never', never: 'never', rejects: 'never', rejectsThenable: 'never' },
	rejects: { sync: 'rejects', promise: 'rejects', thenable: 'rejects', never: 'rejects', rejects: 'rejects', rejectsThenable: 'rejects' },
	rejectsThenable: { sync: 'rejectsThenable', promise: 'rejectsThenable', thenable: 'rejectsThenable', never: 'rejectsThenable', rejects: 'rejectsThenable', rejectsThenable: 'rejectsThenable' },
}[S][K];
/**
 * The state of a chain in state `S` after the steps `U`.
 */
type Fold<U extends Array<unknown>, S extends State> =
	U extends [infer A, ...infer B] ? Fold<B, Next<S, StepState<A>>> : S;
/**
 * The result of a chain in state `S` whose last step produces values of type `R`.
 */
type Result<S extends State, R> = 
	S extends 'promise' ? AsPromise<Awaited<R>>
	: S extends 'thenable' ? AsPromiseLike<Awaited<R>>
	: S extends 'never' ? never
	: S extends 'rejects' ? AsPromise<never>
	: S extends 'rejectsThenable' ? AsPromiseLike<never>
	: R;
/**
 * The result of a chain which starts with a value of type `U[0]`, passes it through the steps `U[1]`…, and ends with a
 * step which produces values of type `R`.
 */
type Chain<U extends Array<unknown>, R> = Result<Fold<U, 'sync'>, R>;
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
type ChainReturningValue<U extends Array<unknown>, T> = ChainReturningValueIn<Fold<U, 'sync'>, T>;
type ChainReturningValueIn<S extends State, T> =
	T extends PromiseLike<any> ? (S extends 'never' | 'rejects' | 'rejectsThenable' ? Rewrap<T, never> : T) : Result<S, T>;
/**
 * Calls the passed callback, forwarding the first argument and routing back whatever is returned.
 *
 * This is a simplified implementation of `run`:
 * ```
 * function run(value, callback) {
 *   return callback(value);
 * }
 * ```
 *
 * #### Promises
 *
 * If the first argument is a promise, the value to which that promise resolves is forwarded to the passed callback
 * instead of the promise itself. As a result, the call to the passed callback is delayed until the promise resolves.
 * If the promise rejects, the passed callback is skipped.
 *
 * #### Chains
 *
 * If multiple callbacks are passed, they are called subsequently. `run(x, a, b)` is equivalent to `run(run(x, a), b)`.
 * Up to ten callbacks are typed; nest calls for longer chains.
 */
declare function run<T, R, C>(this: C, value: T, callback: (this: C, value: Awaited<T>) => R):
	Chain<[T], R>;
declare function run<T, Z, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => R]):
	Chain<[T, Z], R>;
declare function run<T, Z, Y, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => R]):
	Chain<[T, Z, Y], R>;
declare function run<T, Z, Y, X, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => X, (this: C, value: Awaited<X>) => R]):
	Chain<[T, Z, Y, X], R>;
declare function run<T, Z, Y, X, W, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => X, (this: C, value: Awaited<X>) => W, (this: C, value: Awaited<W>) => R]):
	Chain<[T, Z, Y, X, W], R>;
declare function run<T, Z, Y, X, W, V, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => X, (this: C, value: Awaited<X>) => W, (this: C, value: Awaited<W>) => V, (this: C, value: Awaited<V>) => R]):
	Chain<[T, Z, Y, X, W, V], R>;
declare function run<T, Z, Y, X, W, V, U, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => X, (this: C, value: Awaited<X>) => W, (this: C, value: Awaited<W>) => V, (this: C, value: Awaited<V>) => U, (this: C, value: Awaited<U>) => R]):
	Chain<[T, Z, Y, X, W, V, U], R>;
declare function run<T, Z, Y, X, W, V, U, S, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => X, (this: C, value: Awaited<X>) => W, (this: C, value: Awaited<W>) => V, (this: C, value: Awaited<V>) => U, (this: C, value: Awaited<U>) => S, (this: C, value: Awaited<S>) => R]):
	Chain<[T, Z, Y, X, W, V, U, S], R>;
declare function run<T, Z, Y, X, W, V, U, S, Q, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => X, (this: C, value: Awaited<X>) => W, (this: C, value: Awaited<W>) => V, (this: C, value: Awaited<V>) => U, (this: C, value: Awaited<U>) => S, (this: C, value: Awaited<S>) => Q, (this: C, value: Awaited<Q>) => R]):
	Chain<[T, Z, Y, X, W, V, U, S, Q], R>;
declare function run<T, Z, Y, X, W, V, U, S, Q, P, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<Z>) => Y, (this: C, value: Awaited<Y>) => X, (this: C, value: Awaited<X>) => W, (this: C, value: Awaited<W>) => V, (this: C, value: Awaited<V>) => U, (this: C, value: Awaited<U>) => S, (this: C, value: Awaited<S>) => Q, (this: C, value: Awaited<Q>) => P, (this: C, value: Awaited<P>) => R]):
	Chain<[T, Z, Y, X, W, V, U, S, Q, P], R>;
/**
 * Calls the passed callback ‒ forwarding the argument and routing back whatever is returned ‒ if the first argument is
 * not null-ish. If the first argument is null-ish, it is returned directly and the passed callback is skipped.
 *
 * This is a simplified implementation of `runIf`:
 * ```
 * function runIf(value, callback) {
 *   return value != null ? callback(value) : value;
 * }
 * ```
 *
 * #### Promises
 *
 * If the first argument is a promise, the value to which that promise resolves is forwarded to the passed callback
 * instead of the promise itself. As a result, the call to the passed callback is delayed until the promise resolves.
 * If the value to which the promise resolves is null-ish or the promise rejects, the passed callback is skipped.
 *
 * #### Chains
 *
 * If multiple callbacks are passed, they are called subsequently—respecting the logic regarding null-ish values.
 * `runIf(x, a, b)` is equivalent to `runIf(runIf(x, a), b)`
 * Up to ten callbacks are typed; nest calls for longer chains.
 */
declare function runIf<T, R, C>(this: C, value: T, callback: (this: C, value: Exclude<Awaited<T>, Nullish>) => R):
	ChainUntilNullish<[T], R>;
declare function runIf<T, Z, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => R]):
	ChainUntilNullish<[T, Z], R>;
declare function runIf<T, Z, Y, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y], R>;
declare function runIf<T, Z, Y, X, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => X, (this: C, value: Exclude<Awaited<X>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y, X], R>;
declare function runIf<T, Z, Y, X, W, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => X, (this: C, value: Exclude<Awaited<X>, Nullish>) => W, (this: C, value: Exclude<Awaited<W>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y, X, W], R>;
declare function runIf<T, Z, Y, X, W, V, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => X, (this: C, value: Exclude<Awaited<X>, Nullish>) => W, (this: C, value: Exclude<Awaited<W>, Nullish>) => V, (this: C, value: Exclude<Awaited<V>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y, X, W, V], R>;
declare function runIf<T, Z, Y, X, W, V, U, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => X, (this: C, value: Exclude<Awaited<X>, Nullish>) => W, (this: C, value: Exclude<Awaited<W>, Nullish>) => V, (this: C, value: Exclude<Awaited<V>, Nullish>) => U, (this: C, value: Exclude<Awaited<U>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y, X, W, V, U], R>;
declare function runIf<T, Z, Y, X, W, V, U, S, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => X, (this: C, value: Exclude<Awaited<X>, Nullish>) => W, (this: C, value: Exclude<Awaited<W>, Nullish>) => V, (this: C, value: Exclude<Awaited<V>, Nullish>) => U, (this: C, value: Exclude<Awaited<U>, Nullish>) => S, (this: C, value: Exclude<Awaited<S>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y, X, W, V, U, S], R>;
declare function runIf<T, Z, Y, X, W, V, U, S, Q, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => X, (this: C, value: Exclude<Awaited<X>, Nullish>) => W, (this: C, value: Exclude<Awaited<W>, Nullish>) => V, (this: C, value: Exclude<Awaited<V>, Nullish>) => U, (this: C, value: Exclude<Awaited<U>, Nullish>) => S, (this: C, value: Exclude<Awaited<S>, Nullish>) => Q, (this: C, value: Exclude<Awaited<Q>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y, X, W, V, U, S, Q], R>;
declare function runIf<T, Z, Y, X, W, V, U, S, Q, P, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<Awaited<T>, Nullish>) => Z, (this: C, value: Exclude<Awaited<Z>, Nullish>) => Y, (this: C, value: Exclude<Awaited<Y>, Nullish>) => X, (this: C, value: Exclude<Awaited<X>, Nullish>) => W, (this: C, value: Exclude<Awaited<W>, Nullish>) => V, (this: C, value: Exclude<Awaited<V>, Nullish>) => U, (this: C, value: Exclude<Awaited<U>, Nullish>) => S, (this: C, value: Exclude<Awaited<S>, Nullish>) => Q, (this: C, value: Exclude<Awaited<Q>, Nullish>) => P, (this: C, value: Exclude<Awaited<P>, Nullish>) => R]):
	ChainUntilNullish<[T, Z, Y, X, W, V, U, S, Q, P], R>;
/**
 * Calls the passed callback, forwarding the first argument and returning that argument afterwards.
 *
 * This is a simplified implementation of `apply`:
 * ```
 * function apply(value, callback) {
 *   callback(value);
 *   return value;
 * }
 * ```
 * #### Promises
 *
 * If the first argument is a promise, the value to which that promise resolves is forwarded to the passed callback
 * instead of the promise itself. As a result, the call to the passed callback is delayed until the promise resolves.
 * If the promise rejects, the passed callback is skipped.
 *
 * #### Chains
 *
 * If multiple callbacks are passed, they are called subsequently. `apply(x, a, b)` is equivalent to
 * `apply(apply(x, a), b)`.
 */
declare function apply<T, Z, C>(this: C, value: T, callback: (this: C, value: Awaited<T>) => Z):
	ChainReturningValue<[Z], T>;
declare function apply<T, Z, Y, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y]):
	ChainReturningValue<[Z, Y], T>;
declare function apply<T, Z, Y, X, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X]):
	ChainReturningValue<[Z, Y, X], T>;
declare function apply<T, Z, Y, X, W, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X, (this: C, value: Awaited<T>) => W]):
	ChainReturningValue<[Z, Y, X, W], T>;
declare function apply<T, Z, Y, X, W, V, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X, (this: C, value: Awaited<T>) => W, (this: C, value: Awaited<T>) => V]):
	ChainReturningValue<[Z, Y, X, W, V], T>;
declare function apply<T, Z, Y, X, W, V, U, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X, (this: C, value: Awaited<T>) => W, (this: C, value: Awaited<T>) => V, (this: C, value: Awaited<T>) => U]):
	ChainReturningValue<[Z, Y, X, W, V, U], T>;
declare function apply<T, Z, Y, X, W, V, U, S, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X, (this: C, value: Awaited<T>) => W, (this: C, value: Awaited<T>) => V, (this: C, value: Awaited<T>) => U, (this: C, value: Awaited<T>) => S]):
	ChainReturningValue<[Z, Y, X, W, V, U, S], T>;
declare function apply<T, Z, Y, X, W, V, U, S, Q, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X, (this: C, value: Awaited<T>) => W, (this: C, value: Awaited<T>) => V, (this: C, value: Awaited<T>) => U, (this: C, value: Awaited<T>) => S, (this: C, value: Awaited<T>) => Q]):
	ChainReturningValue<[Z, Y, X, W, V, U, S, Q], T>;
declare function apply<T, Z, Y, X, W, V, U, S, Q, P, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X, (this: C, value: Awaited<T>) => W, (this: C, value: Awaited<T>) => V, (this: C, value: Awaited<T>) => U, (this: C, value: Awaited<T>) => S, (this: C, value: Awaited<T>) => Q, (this: C, value: Awaited<T>) => P]):
	ChainReturningValue<[Z, Y, X, W, V, U, S, Q, P], T>;
declare function apply<T, Z, Y, X, W, V, U, S, Q, P, O, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, (this: C, value: Awaited<T>) => Y, (this: C, value: Awaited<T>) => X, (this: C, value: Awaited<T>) => W, (this: C, value: Awaited<T>) => V, (this: C, value: Awaited<T>) => U, (this: C, value: Awaited<T>) => S, (this: C, value: Awaited<T>) => Q, (this: C, value: Awaited<T>) => P, (this: C, value: Awaited<T>) => O]):
	ChainReturningValue<[Z, Y, X, W, V, U, S, Q, P, O], T>;
// ↓ Callbacks spread from an array, possibly around fixed callbacks: the array's element type stands in for every step
// it contributes. In the last overload the return type is read off the array as a whole, so that an array holding
// callbacks of several types (two spread arrays, for example) counts as possibly asynchronous.
declare function apply<T, Z, Y, X, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, ...Array<(this: C, value: Awaited<T>) => Y>, (this: C, value: Awaited<T>) => X]):
	ChainReturningValue<[Z, Y, X], T>;
declare function apply<T, Z, Y, C>(this: C, value: T, ...callbacks: [(this: C, value: Awaited<T>) => Z, ...Array<(this: C, value: Awaited<T>) => Y>]):
	ChainReturningValue<[Z, Y], T>;
declare function apply<T, Z, Y, C>(this: C, value: T, ...callbacks: [...Array<(this: C, value: Awaited<T>) => Z>, (this: C, value: Awaited<T>) => Y]):
	ChainReturningValue<[Z, Y], T>;
declare function apply<T, U extends Array<(this: C, value: Awaited<T>) => any>, C>(this: C, value: T, ...callbacks: U):
	ChainReturningValue<[ReturnType<U[number]>], T>;

export {
	run, runIf,
	apply
};