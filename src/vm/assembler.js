import {
  OPCODE,
  opcodeCode,
  opcodeName,
  encode,
  decode
} from "./opcodes.js"

const REGISTER_LIMIT = 65535
const CONSTANT_LIMIT = 65535

const isNumber = value =>
  typeof value === "number" && Number.isFinite(value)

const isRegister = value =>
  isNumber(value) &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= REGISTER_LIMIT

const normalizeOpcode = value => {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const code = opcodeCode(value)
    if (code !== undefined) return code

    const upper = value.toUpperCase()

    if (OPCODE[upper] !== undefined) {
      return OPCODE[upper]
    }
  }

  throw new Error(`Unknown opcode: ${String(value)}`)
}

const normalizeInstruction = instruction => {
  if (typeof instruction === "number") {
    return decode(instruction)
  }

  if (Array.isArray(instruction)) {
    return {
      opcode: normalizeOpcode(instruction[0]),
      a: instruction[1] ?? 0,
      b: instruction[2] ?? 0,
      c: instruction[3] ?? 0,
      d: instruction[4] ?? 0
    }
  }

  if (!instruction || typeof instruction !== "object") {
    throw new Error("Invalid instruction")
  }

  const opcode =
    instruction.opcode ??
    instruction.op ??
    instruction.name

  return {
    ...instruction,
    opcode: normalizeOpcode(opcode),
    a: instruction.a ?? instruction.A ?? 0,
    b: instruction.b ?? instruction.B ?? 0,
    c: instruction.c ?? instruction.C ?? 0,
    d: instruction.d ?? instruction.D ?? 0
  }
}

export class BytecodeBuilder {
  constructor(options = {}) {
    this.chunkName = options.chunkName || "Zisuay"
    this.watermark = options.watermark || "zis_obfuscator"

    this.code = []
    this.constants = []
    this.constantMap = new Map()

    this.prototypes = []
    this.labels = new Map()
    this.fixups = []

    this.registerCount = options.registerCount || 16
    this.upvalueCount = options.upvalueCount || 0

    this.metadata = {
      version: options.version || 2,
      architecture: "Zisuay-REGVM",
      virtualization: true,
      watermark: this.watermark,
      chunkName: this.chunkName
    }
  }

  constant(value) {
    const key = this.constantKey(value)

    if (this.constantMap.has(key)) {
      return this.constantMap.get(key)
    }

    if (this.constants.length >= CONSTANT_LIMIT) {
      throw new Error("Constant table overflow")
    }

    const index = this.constants.length

    this.constants.push(value)
    this.constantMap.set(key, index)

    return index
  }

  constantKey(value) {
    if (value === null) return "null"
    if (value === undefined) return "undefined"

    const type = typeof value

    if (
      type === "string" ||
      type === "number" ||
      type === "boolean"
    ) {
      return `${type}:${String(value)}`
    }

    try {
      return `${type}:${JSON.stringify(value)}`
    } catch {
      return `${type}:${String(value)}`
    }
  }

  register(index) {
    if (!isRegister(index)) {
      throw new Error(`Invalid register ${String(index)}`)
    }

    if (index >= this.registerCount) {
      this.registerCount = index + 1
    }

    return index
  }

  emit(opcode, a = 0, b = 0, c = 0, d = 0, extra = undefined) {
    const instruction = {
      opcode: normalizeOpcode(opcode),
      a,
      b,
      c,
      d
    }

    if (extra !== undefined) {
      instruction.extra = extra
    }

    this.code.push(instruction)

    return this.code.length - 1
  }

  emitRaw(instruction) {
    const normalized = normalizeInstruction(instruction)

    this.code.push(normalized)

    return this.code.length - 1
  }

  mark(label) {
    if (!label) {
      throw new Error("Label name is required")
    }

    if (this.labels.has(label)) {
      throw new Error(`Duplicate label: ${label}`)
    }

    this.labels.set(label, this.code.length)

    return this.code.length
  }

  jump(opcode, label, a = 0, b = 0, c = 0) {
    const index = this.emit(
      opcode,
      a,
      b,
      c,
      0
    )

    this.fixups.push({
      instruction: index,
      label
    })

    return index
  }

  patchJump(index, target) {
    if (!this.code[index]) {
      throw new Error(`Invalid jump instruction ${index}`)
    }

    const offset =
      target - (index + 1)

    this.code[index].d = offset

    return offset
  }

  resolveLabels() {
    for (const fixup of this.fixups) {
      const target = this.labels.get(fixup.label)

      if (target === undefined) {
        throw new Error(
          `Undefined label: ${fixup.label}`
        )
      }

      this.patchJump(
        fixup.instruction,
        target
      )
    }

    this.fixups.length = 0

    return this
  }

  addPrototype(proto) {
    const index = this.prototypes.length

    this.prototypes.push(proto)

    return index
  }

  createPrototype(options = {}) {
    return {
      chunkName:
        options.chunkName ||
        this.chunkName,

      watermark:
        options.watermark ||
        this.watermark,

      code:
        options.code ||
        [],

      constants:
        options.constants ||
        [],

      prototypes:
        options.prototypes ||
        [],

      registerCount:
        options.registerCount ||
        16,

      upvalueCount:
        options.upvalueCount ||
        0,

      params:
        options.params ||
        [],

      vararg:
        !!options.vararg
    }
  }

  assemble() {
    this.resolveLabels()

    return {
      ...this.metadata,

      chunkName: this.chunkName,
      watermark: this.watermark,

      code: this.code,
      constants: this.constants,
      prototypes: this.prototypes,

      registerCount: this.registerCount,
      upvalueCount: this.upvalueCount,

      instructionCount: this.code.length,
      constantCount: this.constants.length,

      labels: Object.fromEntries(
        this.labels.entries()
      )
    }
  }

  encode() {
    this.resolveLabels()

    return this.code.map(instruction => {
      return encode(
        instruction.opcode,
        instruction.a ?? 0,
        instruction.b ?? 0,
        instruction.c ?? 0,
        instruction.d ?? 0
      )
    })
  }

  serialize() {
    return JSON.stringify(
      this.assemble()
    )
  }

  reset() {
    this.code = []
    this.constants = []
    this.constantMap.clear()
    this.prototypes = []
    this.labels.clear()
    this.fixups = []

    return this
  }
}

export function assemble(code, options = {}) {
  const builder =
    code instanceof BytecodeBuilder
      ? code
      : new BytecodeBuilder(options)

  if (!(code instanceof BytecodeBuilder)) {
    for (const instruction of code || []) {
      builder.emitRaw(instruction)
    }
  }

  return builder.assemble()
}

export function encodeBytecode(bytecode) {
  const code = bytecode?.code || []

  return code.map(instruction => {
    if (typeof instruction === "number") {
      return instruction
    }

    return encode(
      normalizeOpcode(
        instruction.opcode ??
        instruction.op ??
        instruction.name
      ),
      instruction.a ?? instruction.A ?? 0,
      instruction.b ?? instruction.B ?? 0,
      instruction.c ?? instruction.C ?? 0,
      instruction.d ?? instruction.D ?? 0
    )
  })
}

export function decodeBytecode(bytecode) {
  if (!Array.isArray(bytecode)) {
    throw new Error(
      "Bytecode must be an array"
    )
  }

  return bytecode.map(value => {
    if (
      typeof value === "object" &&
      value !== null
    ) {
      return normalizeInstruction(value)
    }

    return decode(value)
  })
}

export function disassemble(bytecode) {
  const code =
    Array.isArray(bytecode)
      ? bytecode
      : bytecode?.code || []

  return code.map((instruction, index) => {
    const decoded =
      typeof instruction === "number"
        ? decode(instruction)
        : normalizeInstruction(instruction)

    const name =
      opcodeName(decoded.opcode)

    const a =
      decoded.a ??
      decoded.A ??
      0

    const b =
      decoded.b ??
      decoded.B ??
      0

    const c =
      decoded.c ??
      decoded.C ??
      0

    const d =
      decoded.d ??
      decoded.D ??
      0

    return {
      address: index,
      opcode: decoded.opcode,
      name,
      A: a,
      B: b,
      C: c,
      D: d,
      text:
        `${String(index).padStart(4, "0")} ` +
        `${name.padEnd(10, " ")} ` +
        `${a} ${b} ${c} ${d}`
    }
  })
}

export function validateBytecode(bytecode) {
  const errors = []
  const warnings = []

  if (!bytecode || typeof bytecode !== "object") {
    errors.push("Bytecode must be an object")
    return {
      valid: false,
      errors,
      warnings
    }
  }

  if (!Array.isArray(bytecode.code)) {
    errors.push("Missing code array")
  }

  if (!Array.isArray(bytecode.constants)) {
    errors.push("Missing constants array")
  }

  if (
    bytecode.registerCount !== undefined &&
    (!Number.isInteger(bytecode.registerCount) ||
      bytecode.registerCount <= 0)
  ) {
    errors.push("Invalid registerCount")
  }

  if (Array.isArray(bytecode.code)) {
    bytecode.code.forEach(
      (instruction, index) => {
        try {
          const normalized =
            normalizeInstruction(instruction)

          if (
            !Number.isInteger(
              normalized.opcode
            )
          ) {
            errors.push(
              `Instruction ${index}: invalid opcode`
            )
          }

          for (const field of [
            "a",
            "b",
            "c"
          ]) {
            if (
              !Number.isInteger(
                normalized[field]
              )
            ) {
              errors.push(
                `Instruction ${index}: invalid ${field}`
              )
            }
          }
        } catch (error) {
          errors.push(
            `Instruction ${index}: ${error.message}`
          )
        }
      }
    )
  }

  if (
    bytecode.chunkName !== "Zisuay"
  ) {
    warnings.push(
      "Unexpected chunkName"
    )
  }

  if (
    bytecode.watermark !==
    "zis_obfuscator"
  ) {
    warnings.push(
      "Watermark mismatch"
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function cloneBytecode(bytecode) {
  return JSON.parse(
    JSON.stringify(bytecode)
  )
}

export function optimizeBytecode(bytecode) {
  const result = cloneBytecode(bytecode)

  if (!Array.isArray(result.code)) {
    return result
  }

  const optimized = []

  for (let i = 0; i < result.code.length; i++) {
    const current = result.code[i]
    const next = result.code[i + 1]

    if (
      current &&
      next &&
      current.opcode === OPCODE.MOVE &&
      next.opcode === OPCODE.MOVE &&
      current.a === next.b &&
      current.b === next.a
    ) {
      optimized.push({
        opcode: OPCODE.MOVE,
        a: current.a,
        b: current.b,
        c: 0,
        d: 0
      })

      i++
      continue
    }

    if (
      current &&
      current.opcode === OPCODE.NOP
    ) {
      continue
    }

    optimized.push(current)
  }

  result.code = optimized
  result.instructionCount =
    optimized.length

  return result
}

export function randomizeConstants(
  bytecode,
  seed = Date.now()
) {
  const result = cloneBytecode(bytecode)

  if (
    !Array.isArray(result.constants) ||
    !Array.isArray(result.code)
  ) {
    return result
  }

  let state =
    Number(seed) >>> 0

  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (
      (state >>> 0) /
      4294967296
    )
  }

  const indexes =
    result.constants.map(
      (_, index) => index
    )

  for (
    let i = indexes.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        random() * (i + 1)
      )

    ;[
      indexes[i],
      indexes[j]
    ] = [
      indexes[j],
      indexes[i]
    ]
  }

  const oldConstants =
    result.constants.slice()

  const remap = new Map()

  indexes.forEach(
    (oldIndex, newIndex) => {
      result.constants[newIndex] =
        oldConstants[oldIndex]

      remap.set(
        oldIndex,
        newIndex
      )
    }
  )

  for (
    const instruction of result.code
  ) {
    if (
      instruction.opcode ===
      OPCODE.LOADK
    ) {
      const old =
        instruction.b ?? 0

      if (remap.has(old)) {
        instruction.b =
          remap.get(old)
      }
    }
  }

  return result
}

export default BytecodeBuilder
