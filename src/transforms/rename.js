const LUA_KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "continue",
  "type",
  "export"
])

const LUA_BUILTINS = new Set([
  "_G",
  "_ENV",
  "assert",
  "collectgarbage",
  "coroutine",
  "debug",
  "dofile",
  "error",
  "getmetatable",
  "ipairs",
  "load",
  "next",
  "pairs",
  "pcall",
  "print",
  "rawequal",
  "rawget",
  "rawset",
  "require",
  "select",
  "setmetatable",
  "tonumber",
  "tostring",
  "type",
  "xpcall",
  "string",
  "table",
  "math",
  "bit32",
  "utf8",
  "coroutine",
  "os",
  "io",
  "task",
  "game",
  "workspace",
  "script",
  "shared",
  "getgenv",
  "getrenv",
  "getfenv",
  "setfenv",
  "loadstring"
])

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
      return Math.floor(this.next() * (max - min + 1)) + min
    }
  }
}

function isIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}

function isProtected(name, options) {
  if (!name || !isIdentifier(name)) {
    return true
  }

  if (LUA_KEYWORDS.has(name)) {
    return true
  }

  if (LUA_BUILTINS.has(name)) {
    return true
  }

  if (options.reserved?.includes(name)) {
    return true
  }

  return false
}

function generateName(index, rng) {
  const first = [
    "l",
    "v",
    "x",
    "q",
    "z",
    "n",
    "r",
    "u",
    "k",
    "m"
  ]

  const chars = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z"
  ]

  const prefix = first[rng.int(0, first.length - 1)]

  let value = prefix

  let n = index

  while (n > 0) {
    value += chars[n % chars.length]
    n = Math.floor(n / chars.length)
  }

  value += rng.int(10, 99)

  return value
}

function maskStrings(source) {
  const strings = []

  const masked = source.replace(
    /(["'])(?:\\.|(?!\1)[\s\S])*?\1/g,
    match => {
      const id = strings.length
      strings.push(match)
      return `__ZIS_STRING_${id}__`
    }
  )

  return {
    source: masked,
    strings
  }
}

function restoreStrings(source, strings) {
  return source.replace(
    /__ZIS_STRING_(\d+)__/g,
    (_, index) => strings[Number(index)] ?? _
  )
}

function maskComments(source) {
  const comments = []

  const masked = source.replace(
    /--\[\[[\s\S]*?\]\]|--[^\n\r]*/g,
    match => {
      const id = comments.length
      comments.push(match)
      return `__ZIS_COMMENT_${id}__`
    }
  )

  return {
    source: masked,
    comments
  }
}

function restoreComments(source, comments) {
  return source.replace(
    /__ZIS_COMMENT_(\d+)__/g,
    (_, index) => comments[Number(index)] ?? _
  )
}

function collectIdentifiers(source) {
  const identifiers = new Set()

  const regex = /\b[A-Za-z_][A-Za-z0-9_]*\b/g

  let match

  while ((match = regex.exec(source))) {
    identifiers.add(match[0])
  }

  return [...identifiers]
}

function detectDeclarations(source) {
  const declarations = new Set()

  const localRegex =
    /\blocal\s+(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)/g

  const functionRegex =
    /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)/g

  const forRegex =
    /\bfor\s+([A-Za-z_][A-Za-z0-9_]*)/g

  const localListRegex =
    /\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g

  let match

  while ((match = localRegex.exec(source))) {
    declarations.add(match[1])
  }

  while ((match = functionRegex.exec(source))) {
    declarations.add(match[1])
  }

  while ((match = forRegex.exec(source))) {
    declarations.add(match[1])
  }

  while ((match = localListRegex.exec(source))) {
    for (const name of match[1].split(",")) {
      const value = name.trim()

      if (isIdentifier(value)) {
        declarations.add(value)
      }
    }
  }

  return [...declarations]
}

function buildRenameMap(source, options = {}) {
  const seed = options.seed ?? 0x9e3779b9
  const rng = createRng(seed)

  const declarations = detectDeclarations(source)
  const map = new Map()

  let index = 0

  for (const name of declarations) {
    if (isProtected(name, options)) {
      continue
    }

    if (options.keep?.includes(name)) {
      continue
    }

    let generated

    do {
      generated = generateName(index++, rng)
    } while (
      map.has(generated) ||
      LUA_KEYWORDS.has(generated) ||
      LUA_BUILTINS.has(generated) ||
      options.reserved?.includes(generated)
    )

    map.set(name, generated)
  }

  return map
}

function replaceIdentifiers(source, map) {
  if (!map.size) {
    return source
  }

  const regex = /\b[A-Za-z_][A-Za-z0-9_]*\b/g

  return source.replace(regex, name => {
    return map.get(name) ?? name
  })
}

function renameSource(source, options = {}) {
  if (typeof source !== "string") {
    throw new TypeError("source must be a string")
  }

  const opts = {
    seed: 0x9e3779b9,
    reserved: [],
    keep: [],
    ...options
  }

  const comments = maskComments(source)
  const strings = maskStrings(comments.source)

  const map = buildRenameMap(strings.source, opts)

  let result = replaceIdentifiers(strings.source, map)

  result = restoreStrings(result, strings.strings)
  result = restoreComments(result, comments.comments)

  return {
    code: result,
    map
  }
}

class Renamer {
  constructor(options = {}) {
    this.options = {
      seed: 0x9e3779b9,
      reserved: [],
      keep: [],
      ...options
    }

    this.map = new Map()
  }

  build(source) {
    this.map = buildRenameMap(source, this.options)
    return this.map
  }

  rename(source) {
    const result = renameSource(source, this.options)

    this.map = result.map

    return result.code
  }

  transform(source) {
    return this.rename(source)
  }

  get(name) {
    return this.map.get(name)
  }

  has(name) {
    return this.map.has(name)
  }

  entries() {
    return [...this.map.entries()]
  }

  clear() {
    this.map.clear()
  }
}

function createRenamer(options = {}) {
  return new Renamer(options)
}

export {
  Renamer,
  createRenamer,
  renameSource,
  buildRenameMap,
  replaceIdentifiers,
  generateName,
  isIdentifier,
  isProtected
}

export default Renamer
