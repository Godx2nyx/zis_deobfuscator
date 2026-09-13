export class Random {
  constructor(seed = Date.now()) {
    this.state = (seed >>> 0) || 0x6D2B79F5
  }

  next() {
    let x = this.state

    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5

    this.state = x >>> 0

    return this.state / 0x100000000
  }

  uint32() {
    return Math.floor(this.next() * 0x100000000) >>> 0
  }

  int(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)

    if (max <= min) {
      return min
    }

    return min + Math.floor(this.next() * (max - min + 1))
  }

  float(min = 0, max = 1) {
    return min + this.next() * (max - min)
  }

  bool(probability = 0.5) {
    return this.next() < probability
  }

  pick(array) {
    if (!Array.isArray(array) || array.length === 0) {
      return undefined
    }

    return array[this.int(0, array.length - 1)]
  }

  shuffle(array) {
    const result = [...array]

    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i)

      const temp = result[i]
      result[i] = result[j]
      result[j] = temp
    }

    return result
  }

  bytes(length) {
    const result = new Uint8Array(length)

    for (let i = 0; i < length; i++) {
      result[i] = this.uint32() & 0xFF
    }

    return result
  }

  hex(length = 16) {
    const bytes = this.bytes(Math.ceil(length / 2))

    return Array.from(bytes)
      .map(value => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, length)
  }

  identifier(length = 10) {
    const first = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_"
    const rest = `${first}0123456789`

    let result = first[this.int(0, first.length - 1)]

    for (let i = 1; i < length; i++) {
      result += rest[this.int(0, rest.length - 1)]
    }

    return result
  }

  derive(label = "") {
    let hash = 2166136261

    const value = `${this.state}:${label}`

    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }

    return new Random(hash >>> 0)
  }
}

export function createRandom(seed) {
  return new Random(seed)
}

export function randomUint32(seed) {
  return new Random(seed).uint32()
}

export function randomInt(min, max, seed) {
  return new Random(seed).int(min, max)
}

export function randomBool(probability = 0.5, seed) {
  return new Random(seed).bool(probability)
}

export function randomIdentifier(length = 10, seed) {
  return new Random(seed).identifier(length)
}

export function randomHex(length = 16, seed) {
  return new Random(seed).hex(length)
}

export default Random
