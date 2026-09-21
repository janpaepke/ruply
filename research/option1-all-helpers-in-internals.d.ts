type Nullish = null | undefined;
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
 */
declare function run<T, R, C>(this: C, value: T, callback: (this: C, value: internals.Resolve<T>) => R):
	internals.TransferAsynchronicity<T, R>;
declare function run<T, Z, R, C>(this: C, value: T, ...callbacks: [(this: C, value: internals.Resolve<T>) => Z, (this: C, value: internals.Resolve<Z>) => R]):
	internals.Chain<[T, Z], R>;
declare function run<T, Z, Y, R, C>(this: C, value: T, ...callbacks: [(this: C, value: internals.Resolve<T>) => Z, (this: C, value: internals.Resolve<Z>) => Y, (this: C, value: internals.Resolve<Y>) => R]):
	internals.Chain<[T, Z, Y], R>;
declare function run<T, Z, Y, X, R, C>(this: C, value: T, ...callbacks: [(this: C, value: internals.Resolve<T>) => Z, (this: C, value: internals.Resolve<Z>) => Y, (this: C, value: internals.Resolve<Y>) => X, (this: C, value: internals.Resolve<X>) => R]):
	internals.Chain<[T, Z, Y, X], R>;
declare function run<T, Z, Y, X, W, R, C>(this: C, value: T, ...callbacks: [(this: C, value: internals.Resolve<T>) => Z, (this: C, value: internals.Resolve<Z>) => Y, (this: C, value: internals.Resolve<Y>) => X, (this: C, value: internals.Resolve<X>) => W, (this: C, value: internals.Resolve<W>) => R]):
	internals.Chain<[T, Z, Y, X, W], R>;
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
 */
declare function runIf<T, R, C>(this: C, value: T, callback: (this: C, value: Exclude<internals.Resolve<T>, Nullish>) => R):
	internals.ChainUntilNullish<[T], R>;
declare function runIf<T, Z, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<internals.Resolve<T>, Nullish>) => Z, (this: C, value: Exclude<internals.Resolve<Z>, Nullish>) => R]):
	internals.ChainUntilNullish<[T, Z], R>;
declare function runIf<T, Z, Y, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<internals.Resolve<T>, Nullish>) => Z, (this: C, value: Exclude<internals.Resolve<Z>, Nullish>) => Y, (this: C, value: Exclude<internals.Resolve<Y>, Nullish>) => R]):
	internals.ChainUntilNullish<[T, Z, Y], R>;
declare function runIf<T, Z, Y, X, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<internals.Resolve<T>, Nullish>) => Z, (this: C, value: Exclude<internals.Resolve<Z>, Nullish>) => Y, (this: C, value: Exclude<internals.Resolve<Y>, Nullish>) => X, (this: C, value: Exclude<internals.Resolve<X>, Nullish>) => R]):
	internals.ChainUntilNullish<[T, Z, Y, X], R>;
declare function runIf<T, Z, Y, X, W, R, C>(this: C, value: T, ...callbacks: [(this: C, value: Exclude<internals.Resolve<T>, Nullish>) => Z, (this: C, value: Exclude<internals.Resolve<Z>, Nullish>) => Y, (this: C, value: Exclude<internals.Resolve<Y>, Nullish>) => X, (this: C, value: Exclude<internals.Resolve<X>, Nullish>) => W, (this: C, value: Exclude<internals.Resolve<W>, Nullish>) => R]):
	internals.ChainUntilNullish<[T, Z, Y, X, W], R>;
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
declare function apply<T, Z, C>(this: C, value: T, callback: (this: C, value: internals.Resolve<T>) => Z):
	internals.ChainReturningValue<[Z], T>;
// ↑ This overload is not strictly necessary. The one below is a generalised form of it.
declare function apply<T, U extends Array<(this: C, value: internals.Resolve<T>) => any>, C>(this: C, value: T, ...callbacks: U):
	internals.ChainReturningValue<internals.ReturnTypes<U>, T>;

declare namespace internals {
	/**
	 * If `T` is a tuple of functions, a tuple of the return types of those functions.
	 */
	export type ReturnTypes<T extends Array<(...a: Array<any>) => any>> = { [K in keyof T]: T[K] extends (...a: Array<any>) => infer R ? R : never };
	/**
	 * If `T` is a `Promise`, the type of the values to which the promise resolves. Otherwise `T` itself.
	 */
	export type Resolve<T> = T extends Promise<infer A> ? A : T;
	/**
	 * Like `Exclude` except that if `T` is a `Promise`, the exclusion logic is applied to the type of the values to which
	 * the promise resolves instead of to `T` directly.
	 */
	export type ExcludeAsynchronous<T, U> = T extends Promise<infer A> ? [A] extends [never] ? T : A extends U ? never : Promise<A> : T extends U ? never : T;
	/**
	 * Like `Extract` except that if `T` is a `Promise`, the extraction logic is applied to the type of the values to which
	 * the promise resolves instead of to `T` directly.
	 */
	export type ExtractAsynchronous<T, U> = T extends Promise<infer A> ? A extends U ? Promise<A> : never : T extends U ? T : never;
	/**
	 * The type which results from passing values of type `U` on to a step which results in `T`:
	 * - If `U` is `never` (no value ever reaches the step), `never`.
	 * - If `U` is a `Promise`, `T` made asynchronous: a `Promise` which rejects if `T` is `never` (the step always throws)
	 *   or if `U` never resolves (`Promise<never>`), `T` itself if it is a `Promise`, and a `Promise` which resolves to
	 *   values of type `T` otherwise.
	 * - Otherwise `T` itself.
	 */
	export type TransferAsynchronicity<U, T> =
		U extends Promise<infer A>
			? [T] extends [never] ? Promise<never> : [A] extends [never] ? Promise<never> : T extends Promise<any> ? T : Promise<T>
			: T;
	/**
	 * `T` without `Promise<never>` if `T` includes other promises: a promise which always rejects adds nothing to a union
	 * which is asynchronous anyway.
	 */
	export type DropRedundantRejection<T> = [Extract<Exclude<T, Promise<never>>, Promise<any>>] extends [never] ? T : Exclude<T, Promise<never>>;
	/**
	 * `TransferAsynchronicity` applied for every type in the tuple `U`: if any type in `U` is a `Promise` and `T` is not a
	 * `Promise`, a `Promise` which resolves to values of type `T`. If any type in `U` is `never`, `never`. Otherwise `T`
	 * itself. If `U` is an array rather than a tuple (callbacks spread from an array), its element type stands in for every
	 * step.
	 */
	export type Chain<U extends Array<unknown>, T> =
		U extends [infer A, ...infer B] ? TransferAsynchronicity<A, Chain<B, T>>
		: U extends [] ? T
		: U extends Array<infer A> ? TransferAsynchronicity<A, T>
		: T;
	/**
	 * Like `Chain`, except that a null-ish value ends the chain: it becomes part of the result, and only non-null-ish values
	 * are passed on to the next step.
	 */
	export type ChainUntilNullish<U extends Array<unknown>, T> = DropRedundantRejection<ChainUntilNullishSteps<U, T>>;
	export type ChainUntilNullishSteps<U extends Array<unknown>, T> =
		U extends [infer A, ...infer B]
			? ExtractAsynchronous<A, Nullish> | TransferAsynchronicity<ExcludeAsynchronous<A, Nullish>, ChainUntilNullishSteps<B, T>>
			: T;
	/**
	 * The type which results from passing values of type `T` through the steps `U` and then returning those values
	 * themselves rather than the result of the last step. `T` is not a step: if it is a promise, the steps run once it
	 * resolves, so the only effect they can have on it is that one which throws turns it into a promise which rejects.
	 * Otherwise the steps make `T` asynchronous as they would any result.
	 */
	export type ChainReturningValue<U extends Array<unknown>, T> =
		T extends Promise<any> ? HasNever<U> extends true ? Promise<never> : T : Chain<U, T>;
	/**
	 * `true` if any type in the tuple `U` is `never`, or a promise which never resolves.
	 */
	export type HasNever<U extends Array<unknown>> = true extends { [K in keyof U]: [Resolve<U[K]>] extends [never] ? true : false }[number] ? true : false;
}
export {
	run, runIf,
	apply,
	internals
};