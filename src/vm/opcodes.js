export const OPCODES = Object.freeze({
  NOP: 0,
  LOADK: 1,
  MOVE: 2,
  GETGLOBAL: 3,
  SETGLOBAL: 4,
  GETLOCAL: 5,
  SETLOCAL: 6,
  GETUPVAL: 7,
  SETUPVAL: 8,
  NEWTABLE: 9,
  GETTABLE: 10,
  SETTABLE: 11,
  ADD: 12,
  SUB: 13,
  MUL: 14,
  DIV: 15,
  MOD: 16,
  POW: 17,
  IDIV: 18,
  EQ: 19,
  NE: 20,
  LT: 21,
  LE: 22,
  GT: 23,
  GE: 24,
  AND: 25,
  OR: 26,
  NOT: 27,
  NEG: 28,
  CONCAT: 29,
  LEN: 30,
  CALL: 31,
  RETURN: 32,
  JMP: 33,
  JMPIF: 34,
  JMPIFNOT: 35,
  CLOSURE: 36,
  FORPREP: 37,
  FORLOOP: 38,
  POP: 39,
  TEST: 40,
  TESTSET: 41,
  DUP: 42,
  SWAP: 43,
  LOADBOOL: 44,
  LOADNIL: 45,
  VARARG: 46,
  SELF: 47,
  CLOSE: 48,
  HALT: 49,
  TRAP: 50
})

export const OPCODE = OPCODES

export const OPCODE_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(OPCODES).map(([name, code]) => [code, name])
  )
)

export const OPCODE_INFO = Object.freeze({
  NOP: { code: 0, operands: [], category: "system" },

  LOADK: { code: 1, operands: ["A", "K"], category: "constant" },
  MOVE: { code: 2, operands: ["A", "B"], category: "register" },

  GETGLOBAL: { code: 3, operands: ["A", "K"], category: "global" },
  SETGLOBAL: { code: 4, operands: ["K", "A"], category: "global" },

  GETLOCAL: { code: 5, operands: ["A", "B"], category: "local" },
  SETLOCAL: { code: 6, operands: ["A", "B"], category: "local" },

  GETUPVAL: { code: 7, operands: ["A", "B"], category: "upvalue" },
  SETUPVAL: { code: 8, operands: ["A", "B"], category: "upvalue" },

  NEWTABLE: { code: 9, operands: ["A", "SIZE"], category: "table" },
  GETTABLE: { code: 10, operands: ["A", "B", "C"], category: "table" },
  SETTABLE: { code: 11, operands: ["A", "B", "C"], category: "table" },

  ADD: { code: 12, operands: ["A", "B", "C"], category: "arithmetic" },
  SUB: { code: 13, operands: ["A", "B", "C"], category: "arithmetic" },
  MUL: { code: 14, operands: ["A", "B", "C"], category: "arithmetic" },
  DIV: { code: 15, operands: ["A", "B", "C"], category: "arithmetic" },
  MOD: { code: 16, operands: ["A", "B", "C"], category: "arithmetic" },
  POW: { code: 17, operands: ["A", "B", "C"], category: "arithmetic" },
  IDIV: { code: 18, operands: ["A", "B", "C"], category: "arithmetic" },

  EQ: { code: 19, operands: ["A", "B", "C"], category: "comparison" },
  NE: { code: 20, operands: ["A", "B", "C"], category: "comparison" },
  LT: { code: 21, operands: ["A", "B", "C"], category: "comparison" },
  LE: { code: 22, operands: ["A", "B", "C"], category: "comparison" },
  GT: { code: 23, operands: ["A", "B", "C"], category: "comparison" },
  GE: { code: 24, operands: ["A", "B", "C"], category: "comparison" },

  AND: { code: 25, operands: ["A", "B", "C"], category: "logic" },
  OR: { code: 26, operands: ["A", "B", "C"], category: "logic" },
  NOT: { code: 27, operands: ["A", "B"], category: "logic" },
  NEG: { code: 28, operands: ["A", "B"], category: "arithmetic" },

  CONCAT: { code: 29, operands: ["A", "B", "C"], category: "string" },
  LEN: { code: 30, operands: ["A", "B"], category: "string" },

  CALL: { code: 31, operands: ["A", "B", "C"], category: "call" },
  RETURN: { code: 32, operands: ["A", "COUNT"], category: "control" },

  JMP: { code: 33, operands: ["TARGET"], category: "control" },
  JMPIF: { code: 34, operands: ["A", "TARGET"], category: "control" },
  JMPIFNOT: { code: 35, operands: ["A", "TARGET"], category: "control" },

  CLOSURE: { code: 36, operands: ["A", "PROTO"], category: "function" },

  FORPREP: { code: 37, operands: ["A", "B", "C"], category: "loop" },
  FORLOOP: { code: 38, operands: ["A", "B", "TARGET"], category: "loop" },

  POP: { code: 39, operands: ["A"], category: "stack" },

  TEST: { code: 40, operands: ["A", "TARGET"], category: "control" },
  TESTSET: { code: 41, operands: ["A", "B", "TARGET"], category: "control" },

  DUP: { code: 42, operands: ["A", "B"], category: "register" },
  SWAP: { code: 43, operands: ["A", "B"], category: "register" },

  LOADBOOL: { code: 44, operands: ["A", "VALUE"], category: "constant" },
  LOADNIL: { code: 45, operands: ["A"], category: "constant" },

  VARARG: { code: 46, operands: ["A", "COUNT"], category: "function" },

  SELF: { code: 47, operands: ["A", "B", "C"], category: "call" },

  CLOSE: { code: 48, operands: ["A"], category: "function" },

  HALT: { code: 49, operands: [], category: "system" },
  TRAP: { code: 50, operands: ["ID"], category: "system" }
})

export function opcodeName(code) {
  return OPCODE_NAMES[code] ?? "UNKNOWN"
}

export function opcodeCode(name) {
  if (typeof name !== "string") {
    return -1
  }

  return OPCODES[name.toUpperCase()] ?? -1
}

export function isValidOpcode(code) {
  return (
    Number.isInteger(code) &&
    OPCODE_NAMES[code] !== undefined
  )
}

export function getOpcodeInfo(opcode) {
  const name =
    typeof opcode === "number"
      ? opcodeName(opcode)
      : String(opcode).toUpperCase()

  return OPCODE_INFO[name] ?? null
}

export function encode(
  opcode,
  a = 0,
  b = 0,
  c = 0,
  extra = undefined
) {
  const code =
    typeof opcode === "string"
      ? opcodeCode(opcode)
      : opcode

  if (!isValidOpcode(code)) {
    throw new Error(`Invalid opcode: ${opcode}`)
  }

  const instruction = {
    op: code,
    a: a | 0,
    b: b | 0,
    c: c | 0
  }

  if (extra !== undefined) {
    instruction.extra = extra
  }

  return Object.freeze(instruction)
}

export function decode(instruction) {
  if (
    instruction === null ||
    typeof instruction !== "object"
  ) {
    throw new Error("Invalid VM instruction")
  }

  const op =
    typeof instruction.op === "string"
      ? opcodeCode(instruction.op)
      : instruction.op

  if (!isValidOpcode(op)) {
    throw new Error(`Invalid opcode: ${instruction.op}`)
  }

  return {
    name: opcodeName(op),
    op,
    a: instruction.a | 0,
    b: instruction.b | 0,
    c: instruction.c | 0,
    extra: instruction.extra
  }
}

export function instructionSize(instruction) {
  return instruction?.extra === undefined ? 1 : 2
}

export default {
  OPCODES,
  OPCODE,
  OPCODE_NAMES,
  OPCODE_INFO,
  opcodeName,
  opcodeCode,
  isValidOpcode,
  getOpcodeInfo,
  encode,
  decode,
  instructionSize
}
