const DEFAULT_OPTIONS = {
  seed: 0x9e3779b9,
  intensity: 0.55,
  maxBlocks: 3,
  maxStatements: 3
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

function randomName(rng, prefix = "__zis_dead") {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  let name = prefix

  const length = rng.int(3, 7)

  for (let i = 0; i < length; i++) {
    name += chars[
      rng.int(0, chars.length - 1)
    ]
  }

  return `${name}${rng.int(10, 999)}`
}

function arithmeticJunk(rng) {
  const a = rng.int(10, 999)
  const b = rng.int(10, 999)

  return [
    `local ${randomName(rng)}=(${a}+${b})`,
    `local ${randomName(rng)}=(${a}*${b})`,
    `local ${randomName(rng)}=(${a}-${b})`,
    `local ${randomName(rng)}=(${a}%${Math.max(2, b)})`
  ][rng.int(0, 3)]
}

function tableJunk(rng) {
  const name = randomName(rng)

  return [
    `local ${name}={}`,
    `${name}[${rng.int(1, 9)}]=${rng.int(10, 999)}`,
    `local ${randomName(rng)}=${name}`
  ].join("\n")
}

function stringJunk(rng) {
  const name = randomName(rng)

  const words = [
    "zis",
    "zisuay",
    "obfuscator",
    "virtual",
    "runtime",
    "bytecode",
    "protected",
    "chunk"
  ]

  const value =
    words[rng.int(0, words.length - 1)]

  return `local ${name}="${value}"`
}

function booleanJunk(rng) {
  const name = randomName(rng)

  const a = rng.int(10, 500)

  return `local ${name}=(${a}==${a})`
}

function generateJunkStatement(rng) {
  const type = rng.int(0, 4)

  if (type === 0) {
    return arithmeticJunk(rng)
  }

  if (type === 1) {
    return tableJunk(rng)
  }

  if (type === 2) {
    return stringJunk(rng)
  }

  if (type === 3) {
    return booleanJunk(rng)
  }

  return `do local ${randomName(rng)}=nil end`
}

function generateDeadBlock(rng, options = {}) {
  const amount = rng.int(
    1,
    Math.max(
      1,
      options.maxStatements ??
        DEFAULT_OPTIONS.maxStatements
    )
  )

  const statements = []

  for (let i = 0; i < amount; i++) {
    statements.push(
      generateJunkStatement(rng)
    )
  }

  const falseConditions = [
    "false",
    `(1==0)`,
    `(2>3)`,
    `(7~=7)`,
    `(9<4)`
  ]

  const condition =
    falseConditions[
      rng.int(0, falseConditions.length - 1)
    ]

  return [
    `if ${condition} then`,
    ...statements.map(
      statement => `  ${statement}`
    ),
    `end`
  ].join("\n")
}

function generateDeadLoop(rng) {
  const variable = randomName(
    rng,
    "__zis_loop"
  )

  const limit = rng.int(1, 3)

  const body = [
    `local ${randomName(rng)}=${rng.int(
      100,
      9999
    )}`,
    `local ${randomName(rng)}=nil`
  ]

  return [
    `for ${variable}=1,${limit} do`,
    ...body.map(
      statement => `  ${statement}`
    ),
    `end`
  ].join("\n")
}

function generateDeadFunction(rng) {
  const name = randomName(
    rng,
    "__zis_fn"
  )

  const argument = randomName(
    rng,
    "__zis_arg"
  )

  const localValue = randomName(
    rng,
    "__zis_local"
  )

  return [
    `local function ${name}(${argument})`,
    `  local ${localValue}=(${rng.int(
      10,
      100
    )}+${rng.int(10, 100)})`,
    `  return ${localValue}`,
    `end`
  ].join("\n")
}

function generateDeadTable(rng) {
  const name = randomName(
    rng,
    "__zis_tbl"
  )

  const key1 = randomName(rng, "k")
  const key2 = randomName(rng, "q")

  return [
    `local ${name}={}`,
    `${name}["${key1}"]=${rng.int(
      100,
      999
    )}`,
    `${name}["${key2}"]=${rng.int(
      100,
      999
    )}`
  ].join("\n")
}

function generateDeadBlockVariant(rng) {
  const type = rng.int(0, 3)

  if (type === 0) {
    return generateDeadBlock(rng)
  }

  if (type === 1) {
    return generateDeadLoop(rng)
  }

  if (type === 2) {
    return generateDeadFunction(rng)
  }

  return generateDeadTable(rng)
}

function maskStrings(source) {
  const strings = []

  const code = source.replace(
    /(["'])(?:\\.|(?!\1)[\s\S])*?\1/g,
    match => {
      const id = strings.length
      strings.push(match)

      return `__ZIS_DEAD_STRING_${id}__`
    }
  )

  return {
    code,
    strings
  }
}

function restoreStrings(source, strings) {
  return source.replace(
    /__ZIS_DEAD_STRING_(\d+)__/g,
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

      return `__ZIS_DEAD_COMMENT_${id}__`
    }
  )

  return {
    code,
    comments
  }
}

function restoreComments(source, comments) {
  return source.replace(
    /__ZIS_DEAD_COMMENT_(\d+)__/g,
    (_, index) =>
      comments[Number(index)] ?? _
  )
}

function isSafeInsertionPoint(line) {
  const value = line.trim()

  if (!value) {
    return false
  }

  if (
    value.startsWith("--") ||
    value.startsWith("if ") ||
    value.startsWith("elseif ") ||
    value === "else" ||
    value === "end" ||
    value.startsWith("for ") ||
    value.startsWith("while ") ||
    value.startsWith("repeat") ||
    value.startsWith("until ") ||
    value.startsWith("function ") ||
    value.startsWith("local function") ||
    value === "return" ||
    value.startsWith("return ")
  ) {
    return false
  }

  return true
}

function injectDeadCode(source, options = {}) {
  if (typeof source !== "string") {
    throw new TypeError("source must be a string")
  }

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const rng = createRng(opts.seed)

  const comments = maskComments(source)
  const strings = maskStrings(comments.code)

  const lines = strings.code.split(/\r?\n/)
  const output = []

  let blocks = 0

  for (const line of lines) {
    if (
      blocks < opts.maxBlocks &&
      isSafeInsertionPoint(line) &&
      rng.next() < opts.intensity
    ) {
      const dead = generateDeadBlockVariant(
        rng
      )

      const indent =
        line.match(/^\s*/)?.[0] ?? ""

      output.push(
        dead
          .split("\n")
          .map(part => indent + part)
          .join("\n")
      )

      blocks++
    }

    output.push(line)
  }

  let result = output.join("\n")

  result = restoreStrings(
    result,
    strings.strings
  )

  result = restoreComments(
    result,
    comments.comments
  )

  return result
}

class DeadCodeInjector {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    }
  }

  transform(source) {
    return injectDeadCode(
      source,
      this.options
    )
  }

  inject(source) {
    return this.transform(source)
  }
}

function createDeadCodeInjector(
  options = {}
) {
  return new DeadCodeInjector(options)
}

export {
  DeadCodeInjector,
  createDeadCodeInjector,
  injectDeadCode,
  generateDeadBlock,
  generateDeadLoop,
  generateDeadFunction,
  generateDeadTable,
  generateJunkStatement
}

export default DeadCodeInjector
