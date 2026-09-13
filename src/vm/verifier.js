import {
  OPCODE,
  opcodeName,
  isValidOpcode
} from "./opcodes.js"

const MAX_REGISTERS = 65535
const MAX_CONSTANTS = 65535
const MAX_INSTRUCTIONS = 5_000_000

const isInt = value =>
  Number.isInteger(value)

const isReg = value =>
  isInt(value) &&
  value >= 0 &&
  value <= MAX_REGISTERS

const isFiniteNumber = value =>
  typeof value === "number" &&
  Number.isFinite(value)

const fail = (errors, message) => {
  errors.push(message)
}

const warn = (warnings, message) => {
  warnings.push(message)
}

const getOp = instruction =>
  instruction?.opcode ??
  instruction?.op ??
  instruction?.name

const getA = instruction =>
  instruction?.a ??
  instruction?.A ??
  0

const getB = instruction =>
  instruction?.b ??
  instruction?.B ??
  0

const getC = instruction =>
  instruction?.c ??
  instruction?.C ??
  0

const getD = instruction =>
  instruction?.d ??
  instruction?.D ??
  0

const getJumpOffset = instruction =>
  instruction?.offset ??
  instruction?.jump ??
  getD(instruction) ??
  0

const registerOperands = opcode => {
  switch (opcode) {
    case OPCODE.MOVE:
      return ["a", "b"]

    case OPCODE.GETLOCAL:
      return ["a"]

    case OPCODE.SETLOCAL:
      return ["b"]

    case OPCODE.GETGLOBAL:
      return ["a"]

    case OPCODE.SETGLOBAL:
      return ["b"]

    case OPCODE.GETUPVAL:
      return ["a"]

    case OPCODE.SETUPVAL:
      return ["b"]

    case OPCODE.NEWTABLE:
      return ["a"]

    case OPCODE.GETTABLE:
      return ["a", "b", "c"]

    case OPCODE.SETTABLE:
      return ["a", "b", "c"]

    case OPCODE.ADD:
    case OPCODE.SUB:
    case OPCODE.MUL:
    case OPCODE.DIV:
    case OPCODE.MOD:
    case OPCODE.POW:
    case OPCODE.IDIV:
    case OPCODE.EQ:
    case OPCODE.NE:
    case OPCODE.LT:
    case OPCODE.LE:
    case OPCODE.GT:
    case OPCODE.GE:
    case OPCODE.AND:
    case OPCODE.OR:
    case OPCODE.CONCAT:
      return ["a", "b", "c"]

    case OPCODE.NOT:
    case OPCODE.NEG:
    case OPCODE.LEN:
      return ["a", "b"]

    case OPCODE.CALL:
      return ["a", "b"]

    case OPCODE.RETURN:
      return ["a"]

    case OPCODE.JMPIF:
    case OPCODE.JMPIFNOT:
      return ["b"]

    case OPCODE.CLOSURE:
      return ["a"]

    case OPCODE.FORPREP:
      return ["a", "a+1", "a+2"]

    case OPCODE.FORLOOP:
      return ["a", "a+1", "a+2", "a+3"]

    case OPCODE.POP:
      return ["a"]

    case OPCODE.DUP:
      return ["a", "a+1"]

    case OPCODE.SWAP:
      return ["a", "b"]

    case OPCODE.VARARG:
      return ["a"]

    case OPCODE.SELF:
      return ["a", "a+1", "b"]

    case OPCODE.TEST:
      return ["b"]

    case OPCODE.TESTSET:
      return ["a", "b"]

    default:
      return []
  }
}

const instructionReads = opcode => {
  switch (opcode) {
    case OPCODE.MOVE:
      return ["b"]

    case OPCODE.GETLOCAL:
    case OPCODE.GETGLOBAL:
    case OPCODE.GETUPVAL:
    case OPCODE.NEWTABLE:
    case OPCODE.CLOSURE:
    case OPCODE.LOADK:
    case OPCODE.LOADBOOL:
    case OPCODE.LOADNIL:
      return []

    case OPCODE.SETLOCAL:
    case OPCODE.SETGLOBAL:
    case OPCODE.SETUPVAL:
      return ["b"]

    case OPCODE.GETTABLE:
      return ["b", "c"]

    case OPCODE.SETTABLE:
      return ["a", "b", "c"]

    case OPCODE.ADD:
    case OPCODE.SUB:
    case OPCODE.MUL:
    case OPCODE.DIV:
    case OPCODE.MOD:
    case OPCODE.POW:
    case OPCODE.IDIV:
    case OPCODE.EQ:
    case OPCODE.NE:
    case OPCODE.LT:
    case OPCODE.LE:
    case OPCODE.GT:
    case OPCODE.GE:
    case OPCODE.AND:
    case OPCODE.OR:
    case OPCODE.CONCAT:
      return ["b", "c"]

    case OPCODE.NOT:
    case OPCODE.NEG:
    case OPCODE.LEN:
      return ["b"]

    case OPCODE.CALL:
      return ["b"]

    case OPCODE.RETURN:
      return ["a"]

    case OPCODE.JMPIF:
    case OPCODE.JMPIFNOT:
      return ["b"]

    case OPCODE.FORPREP:
      return ["a", "a+1", "a+2"]

    case OPCODE.FORLOOP:
      return ["a", "a+1", "a+2"]

    case OPCODE.DUP:
      return ["a"]

    case OPCODE.SWAP:
      return ["a", "b"]

    case OPCODE.TEST:
      return ["b"]

    case OPCODE.TESTSET:
      return ["b"]

    case OPCODE.SELF:
      return ["b"]

    default:
      return []
  }
}

const instructionWrites = opcode => {
  switch (opcode) {
    case OPCODE.LOADK:
    case OPCODE.LOADBOOL:
    case OPCODE.LOADNIL:
    case OPCODE.MOVE:
    case OPCODE.GETLOCAL:
    case OPCODE.GETGLOBAL:
    case OPCODE.GETUPVAL:
    case OPCODE.NEWTABLE:
    case OPCODE.GETTABLE:
    case OPCODE.ADD:
    case OPCODE.SUB:
    case OPCODE.MUL:
    case OPCODE.DIV:
    case OPCODE.MOD:
    case OPCODE.POW:
    case OPCODE.IDIV:
    case OPCODE.EQ:
    case OPCODE.NE:
    case OPCODE.LT:
    case OPCODE.LE:
    case OPCODE.GT:
    case OPCODE.GE:
    case OPCODE.AND:
    case OPCODE.OR:
    case OPCODE.NOT:
    case OPCODE.NEG:
    case OPCODE.CONCAT:
    case OPCODE.LEN:
    case OPCODE.CALL:
    case OPCODE.CLOSURE:
    case OPCODE.DUP:
    case OPCODE.VARARG:
    case OPCODE.SELF:
      return ["a"]

    case OPCODE.FORLOOP:
      return ["a", "a+3"]

    case OPCODE.TESTSET:
      return ["a"]

    default:
      return []
  }
}

export class BytecodeVerifier {
  constructor(options = {}) {
    this.strict =
      options.strict !== undefined
        ? !!options.strict
        : true

    this.allowUnknownOpcodes =
      !!options.allowUnknownOpcodes

    this.maxInstructions =
      options.maxInstructions ||
      MAX_INSTRUCTIONS

    this.maxRegisters =
      options.maxRegisters ||
      MAX_REGISTERS

    this.maxConstants =
      options.maxConstants ||
      MAX_CONSTANTS
  }

  verify(bytecode) {
    const errors = []
    const warnings = []

    if (!bytecode || typeof bytecode !== "object") {
      fail(errors, "Bytecode must be an object")

      return {
        valid: false,
        errors,
        warnings,
        stats: null
      }
    }

    this.verifyHeader(
      bytecode,
      errors,
      warnings
    )

    const code = bytecode.code
    const constants = bytecode.constants

    if (!Array.isArray(code)) {
      fail(errors, "code must be an array")
    }

    if (!Array.isArray(constants)) {
      fail(errors, "constants must be an array")
    }

    if (
      Array.isArray(code) &&
      code.length > this.maxInstructions
    ) {
      fail(
        errors,
        `instruction limit exceeded: ${code.length}`
      )
    }

    if (
      Array.isArray(constants) &&
      constants.length > this.maxConstants
    ) {
      fail(
        errors,
        `constant limit exceeded: ${constants.length}`
      )
    }

    if (
      Array.isArray(code) &&
      Array.isArray(constants)
    ) {
      this.verifyInstructions(
        code,
        constants,
        bytecode,
        errors,
        warnings
      )

      this.verifyControlFlow(
        code,
        errors,
        warnings
      )

      this.verifyReachability(
        code,
        errors,
        warnings
      )
    }

    this.verifyPrototypes(
      bytecode,
      errors,
      warnings
    )

    const stats = {
      instructions:
        Array.isArray(code)
          ? code.length
          : 0,

      constants:
        Array.isArray(constants)
          ? constants.length
          : 0,

      registers:
        bytecode.registerCount || 0,

      prototypes:
        Array.isArray(bytecode.prototypes)
          ? bytecode.prototypes.length
          : 0
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats
    }
  }

  verifyHeader(
    bytecode,
    errors,
    warnings
  ) {
    if (
      bytecode.chunkName !== undefined &&
      typeof bytecode.chunkName !== "string"
    ) {
      fail(
        errors,
        "chunkName must be a string"
      )
    }

    if (
      bytecode.watermark !== undefined &&
      typeof bytecode.watermark !== "string"
    ) {
      fail(
        errors,
        "watermark must be a string"
      )
    }

    if (
      bytecode.chunkName !== undefined &&
      bytecode.chunkName !== "Zisuay"
    ) {
      warn(
        warnings,
        "chunkName is not Zisuay"
      )
    }

    if (
      bytecode.watermark !== undefined &&
      bytecode.watermark !==
        "zis_obfuscator"
    ) {
      warn(
        warnings,
        "watermark is not zis_obfuscator"
      )
    }

    if (
      bytecode.registerCount !== undefined
    ) {
      if (
        !isInt(bytecode.registerCount) ||
        bytecode.registerCount <= 0
      ) {
        fail(
          errors,
          "registerCount must be a positive integer"
        )
      }

      if (
        bytecode.registerCount >
        this.maxRegisters
      ) {
        fail(
          errors,
          "registerCount exceeds limit"
        )
      }
    }

    if (
      bytecode.upvalueCount !== undefined &&
      (
        !isInt(bytecode.upvalueCount) ||
        bytecode.upvalueCount < 0
      )
    ) {
      fail(
        errors,
        "upvalueCount must be a non-negative integer"
      )
    }
  }

  verifyInstructions(
    code,
    constants,
    bytecode,
    errors,
    warnings
  ) {
    const registerCount =
      bytecode.registerCount ||
      this.maxRegisters

    code.forEach(
      (instruction, index) => {
        this.verifyInstruction(
          instruction,
          index,
          code,
          constants,
          registerCount,
          errors,
          warnings
        )
      }
    )
  }

  verifyInstruction(
    instruction,
    index,
    code,
    constants,
    registerCount,
    errors,
    warnings
  ) {
    if (
      !instruction ||
      typeof instruction !== "object"
    ) {
      fail(
        errors,
        `instruction ${index}: invalid object`
      )
      return
    }

    const rawOpcode =
      getOp(instruction)

    let opcode

    if (typeof rawOpcode === "string") {
      opcode =
        OPCODE[rawOpcode.toUpperCase()]
    } else {
      opcode = rawOpcode
    }

    if (
      !isInt(opcode) ||
      !isValidOpcode(opcode)
    ) {
      if (!this.allowUnknownOpcodes) {
        fail(
          errors,
          `instruction ${index}: invalid opcode ${String(rawOpcode)}`
        )
      }

      return
    }

    const A = getA(instruction)
    const B = getB(instruction)
    const C = getC(instruction)
    const D = getD(instruction)

    const registers = {
      a: A,
      b: B,
      c: C,
      d: D
    }

    for (
      const field of registerOperands(opcode)
    ) {
      const match =
        field.match(/^([abcd])(?:\+(\d+))?$/)

      if (!match) continue

      const base =
        registers[match[1]]

      const offset =
        Number(match[2] || 0)

      const value =
        base + offset

      if (!isReg(value)) {
        fail(
          errors,
          `instruction ${index}: invalid register ${field}`
        )
        continue
      }

      if (
        value >= registerCount
      ) {
        fail(
          errors,
          `instruction ${index}: register ${value} exceeds registerCount`
        )
      }
    }

    if (
      opcode === OPCODE.LOADK
    ) {
      if (
        !isInt(B) ||
        B < 0 ||
        B >= constants.length
      ) {
        fail(
          errors,
          `instruction ${index}: constant index ${B} out of range`
        )
      }
    }

    if (
      opcode === OPCODE.JMP ||
      opcode === OPCODE.JMPIF ||
      opcode === OPCODE.JMPIFNOT
    ) {
      const offset =
        getJumpOffset(instruction)

      if (!isInt(offset)) {
        fail(
          errors,
          `instruction ${index}: invalid jump offset`
        )
      } else {
        const target =
          index + 1 + offset

        if (
          target < 0 ||
          target >= code.length
        ) {
          fail(
            errors,
            `instruction ${index}: jump target ${target} out of range`
          )
        }
      }
    }

    if (
      opcode === OPCODE.CALL
    ) {
      this.verifyCall(
        instruction,
        index,
        registerCount,
        errors
      )
    }

    if (
      opcode === OPCODE.RETURN
    ) {
      const count =
        instruction.count ??
        instruction.extra?.count ??
        B ??
        1

      if (
        !isInt(count) ||
        count < 0
      ) {
        fail(
          errors,
          `instruction ${index}: invalid return count`
        )
      }

      if (
        isInt(count) &&
        A + count >
          registerCount
      ) {
        fail(
          errors,
          `instruction ${index}: return range exceeds registers`
        )
      }
    }

    if (
      opcode === OPCODE.TRAP
    ) {
      warn(
        warnings,
        `instruction ${index}: contains VM trap`
      )
    }

    if (
      opcode === OPCODE.NOP
    ) {
      warn(
        warnings,
        `instruction ${index}: NOP`
      )
    }
  }

  verifyCall(
    instruction,
    index,
    registerCount,
    errors
  ) {
    const args =
      instruction.args ??
      instruction.extra?.args

    if (Array.isArray(args)) {
      for (
        const value of args
      ) {
        if (
          typeof value === "number" &&
          isInt(value) &&
          value >= 0 &&
          value < registerCount
        ) {
          continue
        }

        if (
          value === undefined
        ) {
          fail(
            errors,
            `instruction ${index}: invalid CALL argument`
          )
        }
      }
    }

    const B =
      getB(instruction)

    if (
      !isReg(B) ||
      B >= registerCount
    ) {
      fail(
        errors,
        `instruction ${index}: invalid CALL target register`
      )
    }
  }

  verifyControlFlow(
    code,
    errors,
    warnings
  ) {
    for (
      let index = 0;
      index < code.length;
      index++
    ) {
      const instruction =
        code[index]

      if (
        !instruction ||
        typeof instruction !== "object"
      ) {
        continue
      }

      const opcode = this.resolveOpcode(
        instruction
      )

      if (
        opcode !== OPCODE.JMP &&
        opcode !== OPCODE.JMPIF &&
        opcode !== OPCODE.JMPIFNOT
      ) {
        continue
      }

      const offset =
        getJumpOffset(instruction)

      if (!isInt(offset)) {
        continue
      }

      const target =
        index + 1 + offset

      if (
        target === index
      ) {
        warn(
          warnings,
          `instruction ${index}: self-loop detected`
        )
      }

      if (
        target < index &&
        Math.abs(offset) >
          code.length
      ) {
        fail(
          errors,
          `instruction ${index}: suspicious backward jump`
        )
      }
    }
  }

  verifyReachability(
    code,
    errors,
    warnings
  ) {
    if (code.length === 0) {
      return
    }

    const reachable =
      new Set([0])

    const queue = [0]

    while (queue.length) {
      const index =
        queue.shift()

      const instruction =
        code[index]

      if (!instruction) continue

      const opcode =
        this.resolveOpcode(
          instruction
        )

      if (
        opcode === OPCODE.RETURN ||
        opcode === OPCODE.HALT ||
        opcode === OPCODE.TRAP
      ) {
        continue
      }

      if (
        opcode === OPCODE.JMP
      ) {
        const target =
          index +
          1 +
          getJumpOffset(instruction)

        if (
          target >= 0 &&
          target < code.length &&
          !reachable.has(target)
        ) {
          reachable.add(target)
          queue.push(target)
        }

        continue
      }

      if (
        opcode === OPCODE.JMPIF ||
        opcode === OPCODE.JMPIFNOT
      ) {
        const target =
          index +
          1 +
          getJumpOffset(instruction)

        if (
          target >= 0 &&
          target < code.length &&
          !reachable.has(target)
        ) {
          reachable.add(target)
          queue.push(target)
        }

        if (
          index + 1 < code.length &&
          !reachable.has(index + 1)
        ) {
          reachable.add(index + 1)
          queue.push(index + 1)
        }

        continue
      }

      if (
        index + 1 < code.length &&
        !reachable.has(index + 1)
      ) {
        reachable.add(index + 1)
        queue.push(index + 1)
      }
    }

    let dead = 0

    for (
      let i = 0;
      i < code.length;
      i++
    ) {
      if (!reachable.has(i)) {
        dead++

        if (dead <= 16) {
          warn(
            warnings,
            `unreachable instruction at ${i}`
          )
        }
      }
    }

    if (dead > 16) {
      warn(
        warnings,
        `${dead} unreachable instructions detected`
      )
    }
  }

  verifyPrototypes(
    bytecode,
    errors,
    warnings
  ) {
    if (
      bytecode.prototypes === undefined
    ) {
      return
    }

    if (
      !Array.isArray(bytecode.prototypes)
    ) {
      fail(
        errors,
        "prototypes must be an array"
      )
      return
    }

    bytecode.prototypes.forEach(
      (proto, index) => {
        const result =
          this.verify(proto)

        if (!result.valid) {
          for (
            const error of result.errors
          ) {
            fail(
              errors,
              `prototype ${index}: ${error}`
            )
          }
        }

        for (
          const warning of result.warnings
        ) {
          warn(
            warnings,
            `prototype ${index}: ${warning}`
          )
        }
      }
    )
  }

  resolveOpcode(instruction) {
    const raw =
      getOp(instruction)

    if (typeof raw === "string") {
      return OPCODE[
        raw.toUpperCase()
      ]
    }

    return raw
  }

  static isValid(bytecode) {
    return new BytecodeVerifier()
      .verify(bytecode)
      .valid
  }
}

export function verifyBytecode(
  bytecode,
  options = {}
) {
  return new BytecodeVerifier(
    options
  ).verify(bytecode)
}

export function assertBytecode(
  bytecode,
  options = {}
) {
  const result =
    verifyBytecode(
      bytecode,
      options
    )

  if (!result.valid) {
    throw new Error(
      [
        "Invalid Zisuay bytecode:",
        ...result.errors
      ].join("\n")
    )
  }

  return bytecode
}

export function inspectBytecode(
  bytecode
) {
  const verifier =
    new BytecodeVerifier({
      strict: false
    })

  const result =
    verifier.verify(bytecode)

  return {
    ...result,
    instructions:
      (bytecode?.code || []).map(
        (instruction, index) => {
          const opcode =
            verifier.resolveOpcode(
              instruction
            )

          return {
            index,
            opcode,
            name:
              opcodeName(opcode),
            A: getA(instruction),
            B: getB(instruction),
            C: getC(instruction),
            D: getD(instruction)
          }
        }
      )
  }
}

export default BytecodeVerifier
