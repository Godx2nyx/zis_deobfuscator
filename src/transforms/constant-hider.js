const DEFAULT_OPTIONS = {
  seed: 0x9e3779b9,
  numbers: true,
  strings: true,
  booleans: true,
  intensity: 1
}

function mul32(a, b) {
  return Math.imul(a, b) >>> 0
}

function createRng(seed) {
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

function randomName(rng, prefix = "__zis_c") {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  let name = prefix

  for (let i = 0; i < rng.int(3, 7); i++) {
    name += chars[
      rng.int(0, chars.length - 1)
    ]
  }

  return `${name}${rng.int(10, 999)}`
}

function encodeNumber(value, rng) {
  if (!Number.isFinite(value)) {
    return String(value)
  }

  if (Object.is(value, -0)) {
    return "(-0)"
  }

  const mode = rng.int(0, 5)

  if (mode === 0) {
    const key = rng.int(2, 31)

    return `((${value + key})-${key})`
  }

  if (mode === 1) {
    const key = rng.int(2, 31)

    return `((${value - key})+${key})`
  }

  if (mode === 2) {
    const a = rng.int(2, 19)
    const b = rng.int(2, 19)

    return `((${value}+${a})-(${a}+${b}-${b}))`
  }

  if (mode === 3) {
    const key = rng.int(2, 17)

    return `((${value}*${key})/${key})`
  }

  if (mode === 4) {
    const key = rng.int(2, 17)

    return `((${value}*${key})%${key}==0 and ${value} or ${value})`
  }

  const a = rng.int(1, 1000)
  const b = rng.int(1, 1000)

  return `((${a}==${a} and ${value}) or (${b}~=${b} and 0))`
}

function encodeBoolean(value, rng) {
  if (value === true) {
    const a = rng.int(10, 1000)

    return `((${a}==${a}) and true)`
  }

  const a = rng.int(10, 1000)

  return `((${a}~=${a}) or false)`
}

function encodeString(value, rng) {
  const bytes = Array.from(
    new TextEncoder().encode(value)
  )

  if (!bytes.length) {
    return '""'
  }

  const key = rng.int(31, 255)

  const encoded = bytes.map(
    byte => byte ^ key
  )

  const chunks = []

  const size = Math.max(
    1,
    Math.ceil(encoded.length / 3)
  )

  for (let i = 0; i < encoded.length; i += size) {
    chunks.push(
      encoded
        .slice(i, i + size)
        .join(",")
    )
  }

  const tableName = randomName(
    rng,
    "__zis_bytes"
  )

  const keyName = randomName(
    rng,
    "__zis_key"
  )

  const outName = randomName(
    rng,
    "__zis_out"
  )

  const tables = chunks
    .map(chunk => `{${chunk}}`)
    .join(",")

  return `(function(${tableName},${keyName})
local ${outName}={}
for _,${randomName(rng, "__zis_part")} in ipairs(${tableName}) do
for ${randomName(rng, "__zis_i")},${randomName(rng, "__zis_b")} in ipairs(${randomName(rng, "__zis_part")}) do
${outName}[#${outName}+1]=string.char(bit32.bxor(${randomName(rng, "__zis_b")},${keyName}))
end
end
return table.concat(${outName})
end)({${tables}},${key})`
}

function maskStrings(source) {
  const strings = []

  const code = source.replace(
    /(["'])(?:\\.|(?!\1)[\s\S])*?\1/g,
    match => {
      const id = strings.length

      strings.push(match)

      return `__ZIS_CONSTANT_STRING_${id}__`
    }
  )

  return {
    code,
    strings
  }
}

function restoreStrings(source, strings) {
  return source.replace(
    /__ZIS_CONSTANT_STRING_(\d+)__/g,
    (_, index) =>
      strings[Number(index)] ?? _
  )
}

function maskComments(source) {
  const comments = []

  const code = source.replace(
    /--\[\[[\s\S]*?\]\]|--[^\n\r]*/g,
    match => {
      const id = comments.length

      comments.push(match)

      return `__ZIS_CONSTANT_COMMENT_${id}__`
    }
  )

  return {
    code,
    comments
  }
}

function restoreComments(source, comments) {
  return source.replace(
    /__ZIS_CONSTANT_COMMENT_(\d+)__/g,
    (_, index) =>
      comments[Number(index)] ?? _
  )
}

function hideNumbers(source, rng, options) {
  if (!options.numbers) {
    return source
  }

  return source.replace(
    /(?<![A-Za-z0-9_.$])(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)(?![A-Za-z0-9_])/g,
    match => {
      if (
        rng.next() > options.intensity
      ) {
        return match
      }

      const value = Number(match)

      if (!Number.isFinite(value)) {
        return match
      }

      return encodeNumber(value, rng)
    }
  )
}

function hideBooleans(source, rng, options) {
  if (!options.booleans) {
    return source
  }

  return source.replace(
    /\b(true|false)\b/g,
    match => {
      if (
        rng.next() > options.intensity
      ) {
        return match
      }

      return encodeBoolean(
        match === "true",
        rng
      )
    }
  )
}

function hideStrings(source, rng, options) {
  if (!options.strings) {
    return source
  }

  return source.replace(
    /__ZIS_CONSTANT_STRING_(\d+)__/g,
    (_, index) => {
      const value =
        options.__strings?.[Number(index)]

      if (typeof value !== "string") {
        return _
      }

      const content = value.slice(
        1,
        -1
      )

      if (
        rng.next() > options.intensity
      ) {
        return value
      }

      return encodeString(
        content,
        rng
      )
    }
  )
}

function hideConstants(source, options = {}) {
  if (typeof source !== "string") {
    throw new TypeError(
      "source must be a string"
    )
  }

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const rng = createRng(
    opts.seed >>> 0
  )

  const comments = maskComments(source)

  const strings = maskStrings(
    comments.code
  )

  let code = strings.code

  code = hideStrings(
    code,
    rng,
    {
      ...opts,
      __strings: strings.strings
    }
  )

  code = hideNumbers(
    code,
    rng,
    opts
  )

  code = hideBooleans(
    code,
    rng,
    opts
  )

  code = restoreStrings(
    code,
    strings.strings
  )

  code = restoreComments(
    code,
    comments.comments
  )

  return code
}

class ConstantHider {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    }
  }

  transform(source) {
    return hideConstants(
      source,
      this.options
    )
  }

  hide(source) {
    return this.transform(source)
  }
}

function createConstantHider(options = {}) {
  return new ConstantHider(options)
}

export {
  ConstantHider,
  createConstantHider,
  hideConstants,
  encodeNumber,
  encodeBoolean,
  encodeString
}

export default ConstantHider
