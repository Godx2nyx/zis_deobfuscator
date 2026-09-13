export function fnv1a(input) {
  const value = String(input)
  let hash = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

export function fnv1a64(input) {
  const value = String(input)
  let hash = 0xcbf29ce484222325n

  for (let i = 0; i < value.length; i++) {
    hash ^= BigInt(value.charCodeAt(i))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }

  return hash
}

export function hashNumber(value, seed = 0) {
  let hash = (0x811c9dc5 ^ (seed >>> 0)) >>> 0
  const number = Number(value)

  if (Number.isNaN(number)) {
    return fnv1a(String(hash) + ":NaN")
  }

  if (!Number.isFinite(number)) {
    return fnv1a(String(hash) + (number < 0 ? ":-Inf" : ":Inf"))
  }

  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)

  view.setFloat64(0, number, true)

  for (let i = 0; i < 8; i++) {
    hash ^= view.getUint8(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

export function hashBytes(bytes, seed = 0) {
  let hash = (0x811c9dc5 ^ (seed >>> 0)) >>> 0

  for (const byte of bytes) {
    hash ^= byte & 0xFF
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

export function hashObject(object, seed = 0) {
  if (object === null) {
    return fnv1a(`null:${seed}`)
  }

  if (object === undefined) {
    return fnv1a(`undefined:${seed}`)
  }

  if (typeof object !== "object") {
    return fnv1a(`${typeof object}:${String(object)}:${seed}`)
  }

  const keys = Object.keys(object).sort()
  let hash = fnv1a(`object:${seed}`)

  for (const key of keys) {
    hash = fnv1a(
      `${hash}:${key}:${hashObject(object[key], hash)}`
    )
  }

  return hash >>> 0
}

export function hashSource(source, seed = 0) {
  return fnv1a(`${seed >>> 0}:${String(source)}`)
}

export function hashToHex(hash) {
  if (typeof hash === "bigint") {
    return hash
      .toString(16)
      .padStart(16, "0")
  }

  return (hash >>> 0)
    .toString(16)
    .padStart(8, "0")
}

export function hashToBase36(hash) {
  if (typeof hash === "bigint") {
    return hash.toString(36)
  }

  return (hash >>> 0).toString(36)
}

export function mixHash(a, b) {
  let x = (a >>> 0) ^ (b >>> 0)

  x ^= x >>> 16
  x = Math.imul(x, 0x21f0aaad)
  x ^= x >>> 15
  x = Math.imul(x, 0x735a2d97)
  x ^= x >>> 15

  return x >>> 0
}

export function hashChain(values, seed = 0) {
  let hash = seed >>> 0

  for (const value of values) {
    hash = mixHash(
      hash,
      typeof value === "number"
        ? hashNumber(value, hash)
        : fnv1a(String(value))
    )
  }

  return hash >>> 0
}

export function createHashTable(values, seed = 0) {
  const table = new Map()

  for (const value of values) {
    const hash = hashChain([value], seed)
    table.set(hash, value)
  }

  return table
}

export default {
  fnv1a,
  fnv1a64,
  hashNumber,
  hashBytes,
  hashObject,
  hashSource,
  hashToHex,
  hashToBase36,
  mixHash,
  hashChain,
  createHashTable
}
