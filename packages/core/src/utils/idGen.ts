const OVERFLOW = 1_000_000;

/**
 * Creates a semi-unique id generator function.
 *
 * There's nothing mission critical with respect to id uniqueness, so we're just looking for something
 * that gives "unique" ids as fast as possible without running into MIN/MAX_SAFE_INTEGER issues.
 *
 * The following were tried and abandoned.
 * 1. Date.now() -- insufficient as 2 calls to function could result in same value if within the same millisecond
 * 2. performance.now() -- worst performance of "valid" options
 * 3. if(id === Number.MAX_SAFE_INTEGER) {id = Number.MIN_SAFE_INTEGER} -- this was surprisingly slow.
 *
 * The modulo solution was the best performing and the overflow limit of 1 million makes any
 * theoretical duplicate value so unlikely. Plus the worst that happens if a duplicate is met would be
 * something re-calculating one time more than it should.
 *
 * @returns a function that generates incrementing IDs.
 */
export function createIdGenerator() {
  let id = 0;
  return () => {
    id++;
    return id % OVERFLOW;
  };
}
