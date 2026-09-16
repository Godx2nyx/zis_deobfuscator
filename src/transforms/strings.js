const DEFAULT_OPTIONS = {
  seed: 0x9e3779b9,
  split: true,
  layers: 3
}

function mul32(a, b) {
  return Math.imul(a, b) >>> 0
}

function rngFactory(seed) {
  let state = seed >>> 0

  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0

      let t = state
      t = mul32(t ^ (t >>> 15), t | 1)
      t ^= t + mul32(t ^ (t >>> 7), t | 61)

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },

    int(min, max) {
      return Math.floor(
        this.next() * (max - min + 1)
      ) + min
    }
  }
}

function escapeLuaString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\0/g, "\\0")
}

function decodeLuaString(value) {
  let result = ""

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (char !== "\\") {
      result += char
      continue
    }

    if (i + 1 >= value.length) {
      result += "\\"
      continue
    }

    const next = value[++i]

    switch (next) {
      case "n":
        result += "\n"
        break

      case "r":
        result += "\r"
        break

      case "t":
        result += "\t"
        break

      case "0":
        result += "\0"
        break

      case "\\":
        result += "\\"
        break

      case '"':
        result += '"'
        break

      case "'":
        result += "'"
        break

      case "b":
        result += "\b"
        break

      case "f":
        result += "\f"
        break

      case "v":
        result += "\v"
        break

      default:
        result += next
        break
    }
  }

  return result
}

function bytes(value) {
  return Array.from(
    new TextEncoder().encode(value)
  )
}

function xorBytes(data, key) {
  return data.map(
    value => (value ^ key) & 255
  )
}

function xorBytesMulti(data, keys) {
  let result = data.slice()

  for (const key of keys) {
    result = xorBytes(result, key)
  }

  return result
}

function buildRuntime(data, keys, chunks) {
  const byteText = data.join(",")
  const keyText = keys.join(",")

  const parts = chunks
    .map(chunk => `{${chunk.start},${chunk.end}}`)
    .join(",")

  return `(function()
local _b={${byteText}}
local _k={${keyText}}
local _c={${parts}}
local _r={}
for _i=1,#_b do
local _v=_b[_i]
for _n=1,#_k do
_v=bit32.bxor(_v,_k[_n])
end
_r[_i]=string.char(_v)
end
local _s={}
for _n=1,#_c do
local _p=_c[_n]
local _t={}
for _i=_p[1],_p[2] do
_t[#_t+1]=_r[_i]
end
_s[#_s+1]=table.concat(_t)
end
return table.concat(_s)
end)()`
}

function buildLayeredRuntime(value, rng, layers) {
  const data = bytes(value)

  const count = Math.max(
    1,
    Math.min(
      8,
      Math.floor(layers)
    )
  )

  const keys = []

  for (let i = 0; i < count; i++) {
    keys.push(
      rng.int(1, 255)
    )
  }

  const encoded = xorBytesMulti(
    data,
    keys
  )

  const chunkSize = Math.max(
    2,
    Math.min(
      12,
      Math.ceil(encoded.length / 4)
    )
  )

  const chunks = []

  for (
    let i = 0;
    i < encoded.length;
    i += chunkSize
  ) {
    chunks.push({
      start: i + 1,
      end: Math.min(
        i + chunkSize,
        encoded.length
      )
    })
  }

  return buildRuntime(
    encoded,
    keys,
    chunks
  )
}

function encodeString(value, options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const rng = rngFactory(
    opts.seed >>> 0
  )

  if (!value.length) {
    return '""'
  }

  const layers = Number.isFinite(
    opts.layers
  )
    ? Math.floor(opts.layers)
    : 0

  if (layers > 0) {
    return buildLayeredRuntime(
      value,
      rng,
      layers
    )
  }

  const raw = bytes(value)

  const keyCount = Math.min(
    8,
    Math.max(
      3,
      Math.ceil(Math.sqrt(raw.length))
    )
  )

  const keys = []

  for (let i = 0; i < keyCount; i++) {
    keys.push(
      rng.int(1, 255)
    )
  }

  const encrypted = raw.map(
    (byte, index) =>
      (
        byte ^
        keys[index % keys.length]
      ) & 255
  )

  const chunkSize = Math.max(
    2,
    Math.min(
      9,
      Math.ceil(encrypted.length / 4)
    )
  )

  const chunks = []

  for (
    let i = 0;
    i < encrypted.length;
    i += chunkSize
  ) {
    chunks.push({
      start: i + 1,
      end: Math.min(
        i + chunkSize,
        encrypted.length
      )
    })
  }

  return buildRuntime(
    encrypted,
    keys,
    chunks
  )
}

function encodeShortString(value, seed) {
  const rng = rngFactory(
    seed >>> 0
  )

  const data = bytes(value)

  if (!data.length) {
    return '""'
  }

  const key = rng.int(
    32,
    255
  )

  const encoded = xorBytes(
    data,
    key
  )

  return `(function(_a,_k)
local _s={}
for _i=1,#_a do
_s[_i]=string.char(bit32.bxor(_a[_i],_k))
end
return table.concat(_s)
end)({${encoded.join(",")}},${key})`
}

function processString(value, options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  if (typeof value !== "string") {
    return value
  }

  if (!value.length) {
    return '""'
  }

  if (value.length <= 3) {
    return encodeShortString(
      value,
      opts.seed
    )
  }

  return encodeString(
    value,
    opts
  )
}

function processSource(source, options = {}) {
  if (typeof source !== "string") {
    throw new TypeError(
      "source must be a string"
    )
  }

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  let seed = opts.seed >>> 0

  return source.replace(
    /(["'])(?:\\.|(?!\1)[\s\S])*?\1/g,
    match => {
      if (match.length < 2) {
        return match
      }

      const content = match.slice(
        1,
        -1
      )

      if (!content.length) {
        return match
      }

      const decoded = decodeLuaString(
        content
      )

      const result = processString(
        decoded,
        {
          ...opts,
          seed
        }
      )

      seed = (
        seed + 0x45d9f3b
      ) >>> 0

      return result
    }
  )
}

class StringEncryptor {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    }

    this.seed =
      this.options.seed >>> 0

    this.cache = new Map()
  }

  encode(value) {
    if (this.cache.has(value)) {
      return this.cache.get(value)
    }

    const encoded = processString(
      value,
      {
        ...this.options,
        seed: this.seed
      }
    )

    this.seed = (
      this.seed + 0x45d9f3b
    ) >>> 0

    this.cache.set(
      value,
      encoded
    )

    return encoded
  }

  transform(source) {
    return processSource(
      source,
      {
        ...this.options,
        seed: this.seed
      }
    )
  }

  clear() {
    this.cache.clear()
  }
}

function createStringEncryptor(options = {}) {
  return new StringEncryptor(options)
}

export {
  StringEncryptor,
  createStringEncryptor,
  encodeString,
  encodeShortString,
  processString,
  processSource,
  escapeLuaString,
  decodeLuaString
}

export default StringEncryptor
