const DEFAULT_OPTIONS = {
  seed: 0x9e3779b9,
  opaque: true,
  flatten: true,
  shuffle: true,
  junk: true,
  maxJunk: 2
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
      return Math.floor(this.next() * (max - min + 1)) + min
    }
  }
}

function randomName(rng, prefix = "__z") {
  const alphabet = "abcdefghijklmnopqrstuvwxyz"
  let value = prefix

  const length = rng.int(3, 7)

  for (let i = 0; i < length; i++) {
    value += alphabet[rng.int(0, alphabet.length - 1)]
  }

  value += rng.int(10, 99)

  return value
}

function maskStrings(source) {
  const strings = []

  const code = source.replace(
    /(["'])(?:\\.|(?!\1)[\s\S])*?\1/g,
    match => {
      const id = strings.length
      strings.push(match)
      return `__ZIS_CF_STRING_${id}__`
    }
  )

  return {
    code,
    strings
  }
}

function restoreStrings(source, strings) {
  return source.replace(
    /__ZIS_CF_STRING_(\d+)__/g,
    (_, index) => strings[Number(index)] ?? _
  )
}

function maskComments(source) {
  const comments = []

  const code = source.replace(
    /--\[\[[\s\S]*?\]\]|--[^\n\r]*/g,
    match => {
      const id = comments.length
      comments.push(match)
      return `__ZIS_CF_COMMENT_${id}__`
    }
  )

  return {
    code,
    comments
  }
}

function restoreComments(source, comments) {
  return source.replace(
    /__ZIS_CF_COMMENT_(\d+)__/g,
    (_, index) => comments[Number(index)] ?? _
  )
}

function splitStatements(source) {
  const statements = []
  let buffer = ""
  let depth = 0
  let quote = null
  let escape = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (quote) {
      buffer += char

      if (escape) {
        escape = false
        continue
      }

      if (char === "\\") {
        escape = true
        continue
      }

      if (char === quote) {
        quote = null
      }

      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }

    if (char === "(" || char === "[" || char === "{") {
      depth++
      buffer += char
      continue
    }

    if (char === ")" || char === "]" || char === "}") {
      depth--
      buffer += char
      continue
    }

    if (
      depth === 0 &&
      (char === ";" || char === "\n")
    ) {
      const value = buffer.trim()

      if (value) {
        statements.push(value)
      }

      buffer = ""
      continue
    }

    buffer += char
  }

  const last = buffer.trim()

  if (last) {
    statements.push(last)
  }

  return statements
}

function isControlStatement(statement) {
  return /^(if|for|while|repeat|function|local\s+function)\b/.test(
    statement
  )
}

function opaqueTrue(rng) {
  const a = rng.int(2, 1000)
  const b = rng.int(2, 1000)

  return `((${a}*${b})==(${a * b}))`
}

function opaqueFalse(rng) {
  const a = rng.int(2, 1000)
  const b = rng.int(2, 1000)

  return `((${a}*${b})~=(${a * b}))`
}

function junkStatement(rng) {
  const name = randomName(rng)

  const type = rng.int(0, 4)

  if (type === 0) {
    return `local ${name}=nil`
  }

  if (type === 1) {
    return `local ${name}=${rng.int(100, 9999)}`
  }

  if (type === 2) {
    return `local ${name}="${randomName(rng, "")}"`
  }

  if (type === 3) {
    return `local ${name}={}`
  }

  return `local ${name}=(${rng.int(2, 20)}+${rng.int(2, 20)})`
}

function injectJunk(statements, rng, maxJunk) {
  const output = []

  for (const statement of statements) {
    if (rng.next() < 0.35) {
      const amount = rng.int(1, maxJunk)

      for (let i = 0; i < amount; i++) {
        output.push(junkStatement(rng))
      }
    }

    output.push(statement)

    if (rng.next() < 0.2) {
      output.push(junkStatement(rng))
    }
  }

  return output
}

function wrapOpaque(statement, rng) {
  const trueCondition = opaqueTrue(rng)
  const falseCondition = opaqueFalse(rng)

  const junk = junkStatement(rng)

  return [
    `if ${trueCondition} then`,
    `  ${statement}`,
    `else`,
    `  if ${falseCondition} then`,
    `    ${junk}`,
    `  end`,
    `end`
  ].join("\n")
}

function flattenStatements(statements, rng) {
  if (statements.length < 2) {
    return statements.join("\n")
  }

  const state = randomName(rng, "__state")
  const guard = randomName(rng, "__guard")

  const order = statements.map((_, index) => index)

  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const temp = order[i]
    order[i] = order[j]
    order[j] = temp
  }

  const labels = order.map(
    (_, index) => index + 1
  )

  const stateForOriginal = new Map()

  order.forEach((originalIndex, stateIndex) => {
    stateForOriginal.set(
      originalIndex,
      labels[stateIndex]
    )
  })

  const body = []

  body.push(`local ${state}=${labels[0]}`)
  body.push(`local ${guard}=0`)
  body.push(`while ${state}~=0 do`)

  for (let stateIndex = 0; stateIndex < order.length; stateIndex++) {
    const originalIndex = order[stateIndex]
    const currentState = labels[stateIndex]
    const nextState =
      stateIndex + 1 < order.length
        ? labels[stateIndex + 1]
        : 0

    const statement = statements[originalIndex]

    body.push(
      `  if ${state}==${currentState} then`
    )

    body.push(`    ${statement}`)

    if (nextState === 0) {
      body.push(`    ${state}=0`)
    } else {
      body.push(`    ${state}=${nextState}`)
    }

    body.push(`  end`)
  }

  body.push(`end`)

  return body.join("\n")
}

function transformBlock(source, options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const rng = createRng(opts.seed)

  const comments = maskComments(source)
  const strings = maskStrings(comments.code)

  let statements = splitStatements(strings.code)

  if (opts.junk) {
    statements = injectJunk(
      statements,
      rng,
      Math.max(1, opts.maxJunk)
    )
  }

  if (opts.opaque) {
    statements = statements.map(statement => {
      if (
        !statement ||
        isControlStatement(statement) ||
        statement.startsWith("__ZIS_CF_")
      ) {
        return statement
      }

      if (rng.next() < 0.45) {
        return wrapOpaque(statement, rng)
      }

      return statement
    })
  }

  let result

  if (
    opts.flatten &&
    statements.length >= 3 &&
    rng.next() < 0.75
  ) {
    result = flattenStatements(statements, rng)
  } else {
    result = statements.join("\n")
  }

  result = restoreStrings(result, strings.strings)
  result = restoreComments(result, comments.comments)

  return result
}

function controlFlowObfuscate(source, options = {}) {
  if (typeof source !== "string") {
    throw new TypeError("source must be a string")
  }

  return transformBlock(source, options)
}

class ControlFlowObfuscator {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    }
  }

  transform(source) {
    return controlFlowObfuscate(
      source,
      this.options
    )
  }

  obfuscate(source) {
    return this.transform(source)
  }
}

function createControlFlowObfuscator(options = {}) {
  return new ControlFlowObfuscator(options)
}

export {
  ControlFlowObfuscator,
  createControlFlowObfuscator,
  controlFlowObfuscate,
  transformBlock,
  splitStatements,
  injectJunk,
  flattenStatements,
  opaqueTrue,
  opaqueFalse
}

export default ControlFlowObfuscator
