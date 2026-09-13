const DEFAULT_OPTIONS = {
  seed: 0x9e3779b9,
  intensity: 0.7,
  arithmetic: true,
  boolean: true,
  comparison: true
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

function randomIdentifier(rng, prefix = "__zis") {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  let name = prefix

  for (let i = 0; i < rng.int(3, 7); i++) {
    name += chars[rng.int(0, chars.length - 1)]
  }

  return `${name}${rng.int(10, 99)}`
}

function arithmeticTrue(rng) {
  const a = rng.int(2, 999)
  const b = rng.int(2, 999)
  const mode = rng.int(0, 4)

  if (mode === 0) {
    return `((${a}+${b})==${a + b})`
  }

  if (mode === 1) {
    return `((${a}*${b})==${a * b})`
  }

  if (mode === 2) {
    return `((${a}-${b})==${a - b})`
  }

  if (mode === 3) {
    return `((${a}+${b})~=${a + b + 1})`
  }

  return `((${a}*${b})~=${a * b + 1})`
}

function arithmeticFalse(rng) {
  const a = rng.int(2, 999)
  const b = rng.int(2, 999)

  if (rng.next() < 0.5) {
    return `((${a}+${b})~=${a + b})`
  }

  return `((${a}*${b})~=${a * b})`
}

function booleanTrue(rng) {
  const a = rng.int(1, 1000)
  const b = rng.int(1, 1000)

  const expressions = [
    `(not false)`,
    `(true or false)`,
    `(false or true)`,
    `(${a}==${a})`,
    `(${a}<=${a})`,
    `(${a}>=${a})`,
    `(not (${a}~=${a}))`,
    `(${a}<${b} or ${a}>=${b})`
  ]

  return expressions[rng.int(0, expressions.length - 1)]
}

function booleanFalse(rng) {
  const a = rng.int(1, 1000)

  const expressions = [
    `false`,
    `(true and false)`,
    `(false and true)`,
    `(${a}~=${a})`,
    `(${a}<${a})`,
    `(${a}>${a})`,
    `(not true)`
  ]

  return expressions[rng.int(0, expressions.length - 1)]
}

function comparisonTrue(rng) {
  const a = rng.int(1, 1000)
  const b = rng.int(1, 1000)

  const expressions = [
    `(${a}==${a})`,
    `(${a}<=${a})`,
    `(${a}>=${a})`,
    `(${a}<${b} or ${a}>=${b})`,
    `(${a}>${b} or ${a}<=${b})`
  ]

  return expressions[rng.int(0, expressions.length - 1)]
}

function comparisonFalse(rng) {
  const a = rng.int(1, 1000)

  return [
    `(${a}~=${a})`,
    `(${a}<${a})`,
    `(${a}>${a})`,
    `(${a}<=${a - 1})`,
    `(${a}>=${a + 1})`
  ][rng.int(0, 4)]
}

function generateOpaqueTrue(rng, options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const candidates = []

  if (opts.arithmetic) {
    candidates.push(() => arithmeticTrue(rng))
  }

  if (opts.boolean) {
    candidates.push(() => booleanTrue(rng))
  }

  if (opts.comparison) {
    candidates.push(() => comparisonTrue(rng))
  }

  if (!candidates.length) {
    return "true"
  }

  return candidates[
    rng.int(0, candidates.length - 1)
  ]()
}

function generateOpaqueFalse(rng, options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const candidates = []

  if (opts.arithmetic) {
    candidates.push(() => arithmeticFalse(rng))
  }

  if (opts.boolean) {
    candidates.push(() => booleanFalse(rng))
  }

  if (opts.comparison) {
    candidates.push(() => comparisonFalse(rng))
  }

  if (!candidates.length) {
    return "false"
  }

  return candidates[
    rng.int(0, candidates.length - 1)
  ]()
}

function buildOpaqueExpression(rng, options = {}) {
  const trueExpression = generateOpaqueTrue(
    rng,
    options
  )

  const falseExpression = generateOpaqueFalse(
    rng,
    options
  )

  const selector = rng.int(0, 4)

  if (selector === 0) {
    return `(${trueExpression} and not (${falseExpression}))`
  }

  if (selector === 1) {
    return `((${trueExpression}) or (${falseExpression} and false))`
  }

  if (selector === 2) {
    return `((${trueExpression}) and (${trueExpression}))`
  }

  if (selector === 3) {
    return `not ((${falseExpression}) or false)`
  }

  return `((${trueExpression}) ~= (${falseExpression}))`
}

function buildOpaqueFalseExpression(rng, options = {}) {
  const trueExpression = generateOpaqueTrue(
    rng,
    options
  )

  const falseExpression = generateOpaqueFalse(
    rng,
    options
  )

  const selector = rng.int(0, 4)

  if (selector === 0) {
    return `(${falseExpression} and ${trueExpression})`
  }

  if (selector === 1) {
    return `(${falseExpression} or (false and ${trueExpression}))`
  }

  if (selector === 2) {
    return `(not ${trueExpression})`
  }

  if (selector === 3) {
    return `(${falseExpression} and ${falseExpression})`
  }

  return `(${trueExpression} and ${falseExpression})`
}

function injectOpaqueBranch(statement, rng, options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const condition =
    rng.next() < 0.5
      ? buildOpaqueExpression(rng, opts)
      : buildOpaqueFalseExpression(rng, opts)

  const trueBranch = rng.next() < 0.5

  if (trueBranch) {
    return [
      `if ${condition} then`,
      `  ${statement}`,
      `else`,
      `  local ${randomIdentifier(rng)}=nil`,
      `end`
    ].join("\n")
  }

  return [
    `if ${condition} then`,
    `  local ${randomIdentifier(rng)}=nil`,
    `else`,
    `  ${statement}`,
    `end`
  ].join("\n")
}

function injectOpaqueAssignment(statement, rng) {
  const name = randomIdentifier(rng)

  const expression = [
    arithmeticTrue(rng),
    booleanTrue(rng),
    comparisonTrue(rng)
  ][rng.int(0, 2)]

  return [
    `local ${name}=${expression}`,
    statement
  ].join("\n")
}

function obfuscateOpaque(source, options = {}) {
  if (typeof source !== "string") {
    throw new TypeError("source must be a string")
  }

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const rng = createRng(opts.seed)

  const lines = source.split(/\r?\n/)
  const output = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      output.push(line)
      continue
    }

    if (
      trimmed.startsWith("--") ||
      trimmed.startsWith("local function") ||
      trimmed.startsWith("function ") ||
      trimmed === "end" ||
      trimmed === "else" ||
      trimmed.startsWith("elseif ") ||
      trimmed.startsWith("for ") ||
      trimmed.startsWith("while ") ||
      trimmed.startsWith("repeat")
    ) {
      output.push(line)
      continue
    }

    if (rng.next() > opts.intensity) {
      output.push(line)
      continue
    }

    const indent =
      line.match(/^\s*/)?.[0] ?? ""

    const transformed = injectOpaqueBranch(
      trimmed,
      rng,
      opts
    )

    output.push(
      transformed
        .split("\n")
        .map((part, index) =>
          index === 0
            ? indent + part
            : indent + part
        )
        .join("\n")
    )
  }

  return output.join("\n")
}

class OpaquePredicate {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    }

    this.rng = createRng(this.options.seed)
  }

  trueExpression() {
    return generateOpaqueTrue(
      this.rng,
      this.options
    )
  }

  falseExpression() {
    return generateOpaqueFalse(
      this.rng,
      this.options
    )
  }

  expression() {
    return buildOpaqueExpression(
      this.rng,
      this.options
    )
  }

  falseExpressionComplex() {
    return buildOpaqueFalseExpression(
      this.rng,
      this.options
    )
  }

  branch(statement) {
    return injectOpaqueBranch(
      statement,
      this.rng,
      this.options
    )
  }

  assignment(statement) {
    return injectOpaqueAssignment(
      statement,
      this.rng
    )
  }

  transform(source) {
    return obfuscateOpaque(
      source,
      this.options
    )
  }
}

function createOpaquePredicate(options = {}) {
  return new OpaquePredicate(options)
}

export {
  OpaquePredicate,
  createOpaquePredicate,
  obfuscateOpaque,
  generateOpaqueTrue,
  generateOpaqueFalse,
  buildOpaqueExpression,
  buildOpaqueFalseExpression,
  injectOpaqueBranch,
  injectOpaqueAssignment
}

export default OpaquePredicate
