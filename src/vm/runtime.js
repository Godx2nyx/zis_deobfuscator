import { OPCODE, opcodeName } from "./opcodes.js"

const hasOwn = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key)

const isObject = value =>
  value !== null && typeof value === "object"

const truthy = value => !!value

const luaLen = value => {
  if (typeof value === "string") return value.length
  if (Array.isArray(value)) return value.length

  if (isObject(value)) {
    let n = 0
    while (hasOwn(value, n + 1)) n++
    return n
  }

  return 0
}

const luaEqual = (a, b) => {
  if (a === b) return true

  if (
    typeof a === "number" &&
    typeof b === "number" &&
    Number.isNaN(a) &&
    Number.isNaN(b)
  ) {
    return false
  }

  return false
}

const luaConcat = (a, b) => {
  const left = a == null ? "nil" : String(a)
  const right = b == null ? "nil" : String(b)
  return left + right
}

const luaAdd = (a, b) => {
  const x = Number(a)
  const y = Number(b)

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`attempt to add ${typeof a} and ${typeof b}`)
  }

  return x + y
}

const luaSub = (a, b) => {
  const x = Number(a)
  const y = Number(b)

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`attempt to subtract ${typeof a} and ${typeof b}`)
  }

  return x - y
}

const luaMul = (a, b) => {
  const x = Number(a)
  const y = Number(b)

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`attempt to multiply ${typeof a} and ${typeof b}`)
  }

  return x * y
}

const luaDiv = (a, b) => {
  const x = Number(a)
  const y = Number(b)

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`attempt to divide ${typeof a} and ${typeof b}`)
  }

  return x / y
}

const luaMod = (a, b) => {
  const x = Number(a)
  const y = Number(b)

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`attempt to modulo ${typeof a} and ${typeof b}`)
  }

  return x % y
}

const luaPow = (a, b) => {
  const x = Number(a)
  const y = Number(b)

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`attempt to exponentiate ${typeof a} and ${typeof b}`)
  }

  return x ** y
}

const luaIDiv = (a, b) => {
  const x = Number(a)
  const y = Number(b)

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`attempt to integer divide ${typeof a} and ${typeof b}`)
  }

  return Math.floor(x / y)
}

const getTable = (table, key) => {
  if (table == null) return undefined

  if (
    typeof table === "object" ||
    typeof table === "function"
  ) {
    return table[key]
  }

  return undefined
}

const setTable = (table, key, value) => {
  if (
    table == null ||
    (typeof table !== "object" && typeof table !== "function")
  ) {
    throw new Error("attempt to index a non-table value")
  }

  table[key] = value
  return value
}

const defaultGlobals = () => ({
  print: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  tostring: value => String(value),
  tonumber: value => {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  },
  type: value => {
    if (value === null || value === undefined) return "nil"
    if (Array.isArray(value)) return "table"
    if (typeof value === "number") return "number"
    if (typeof value === "string") return "string"
    if (typeof value === "boolean") return "boolean"
    if (typeof value === "function") return "function"
    return "table"
  },
  pairs: value => {
    if (value == null) return []
    return Object.entries(value)
  },
  ipairs: value => {
    if (!Array.isArray(value)) return []
    return value.map((v, i) => [i + 1, v])
  },
  math: {
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    max: Math.max,
    min: Math.min,
    sqrt: Math.sqrt,
    random: Math.random,
    pow: Math.pow
  },
  string: {
    len: value => String(value).length,
    lower: value => String(value).toLowerCase(),
    upper: value => String(value).toUpperCase(),
    sub: (value, start, finish) =>
      String(value).substring(
        Number(start) - 1,
        finish == null ? undefined : Number(finish)
      )
  },
  table: {
    insert: (table, value) => {
      table.push(value)
      return table
    },
    remove: (table, index) => {
      if (index == null) return table.pop()
      return table.splice(Number(index) - 1, 1)[0]
    }
  }
})

class VMError extends Error {
  constructor(message, vm) {
    super(message)
    this.name = "VMError"
    this.ip = vm?.ip ?? -1
    this.chunkName = vm?.chunkName ?? "Zisuay"
    this.watermark = "zis_obfuscator"
  }
}

export class VMFrame {
  constructor(proto, args = [], parent = null) {
    this.proto = proto || {}
    this.code = Array.isArray(this.proto.code) ? this.proto.code : []
    this.constants = Array.isArray(this.proto.constants)
      ? this.proto.constants
      : []
    this.registers = new Array(
      this.proto.registerCount ||
      this.proto.maxRegisters ||
      64
    ).fill(undefined)

    this.locals = Object.create(null)
    this.upvalues = parent ? parent.upvalues : Object.create(null)
    this.parent = parent
    this.args = args
    this.varargs = args.slice()
    this.ip = 0
    this.top = 0
    this.returned = false
    this.returnValues = []
  }
}

export class ZisuayVM {
  constructor(options = {}) {
    this.chunkName = options.chunkName || "Zisuay"
    this.watermark = options.watermark || "zis_obfuscator"
    this.globals = {
      ...defaultGlobals(),
      ...(options.globals || {})
    }

    this.maxSteps = options.maxSteps || 5_000_000
    this.trace = !!options.trace
    this.traceLog = []
    this.callStack = []
    this.ip = -1
    this.currentFrame = null
    this.halted = false
  }

  log(...args) {
    if (!this.trace) return

    this.traceLog.push({
      ip: this.ip,
      opcode: args[0],
      args: args.slice(1)
    })
  }

  constant(frame, index) {
    return frame.constants[index]
  }

  register(frame, index) {
    return frame.registers[index]
  }

  setRegister(frame, index, value) {
    frame.registers[index] = value

    if (index >= frame.top) {
      frame.top = index + 1
    }

    return value
  }

  resolveName(frame, name) {
    if (hasOwn(frame.locals, name)) {
      return frame.locals[name]
    }

    let current = frame

    while (current) {
      if (hasOwn(current.locals, name)) {
        return current.locals[name]
      }

      current = current.parent
    }

    if (hasOwn(frame.upvalues, name)) {
      return frame.upvalues[name]
    }

    return this.globals[name]
  }

  assignName(frame, name, value) {
    if (hasOwn(frame.locals, name)) {
      frame.locals[name] = value
      return value
    }

    let current = frame.parent

    while (current) {
      if (hasOwn(current.locals, name)) {
        current.locals[name] = value
        return value
      }

      current = current.parent
    }

    this.globals[name] = value
    return value
  }

  resolveFunction(target) {
    if (typeof target === "function") {
      return target
    }

    if (
      target &&
      typeof target.call === "function"
    ) {
      return (...args) => target.call(...args)
    }

    throw new VMError(
      `attempt to call a ${typeof target} value`,
      this
    )
  }

  invoke(target, args, frame) {
    if (typeof target === "function") {
      return target(...args)
    }

    if (
      target &&
      target.__vmClosure === true
    ) {
      const child = new VMFrame(
        target.proto,
        args,
        target.frame
      )

      child.upvalues = target.upvalues || target.frame.upvalues

      const result = this.executeFrame(child)

      if (result.length <= 1) {
        return result[0]
      }

      return result
    }

    if (target && typeof target.call === "function") {
      return target.call(...args)
    }

    throw new VMError(
      `attempt to call ${typeof target}`,
      this
    )
  }

  createClosure(proto, frame) {
    return {
      __vmClosure: true,
      proto,
      frame,
      upvalues: frame.upvalues,
      watermark: this.watermark,
      chunkName: this.chunkName,
      call: (...args) => {
        const child = new VMFrame(proto, args, frame)
        child.upvalues = frame.upvalues

        const result = this.executeFrame(child)

        if (result.length <= 1) {
          return result[0]
        }

        return result
      }
    }
  }

  executeBinary(opcode, a, b) {
    switch (opcode) {
      case OPCODE.ADD:
        return luaAdd(a, b)

      case OPCODE.SUB:
        return luaSub(a, b)

      case OPCODE.MUL:
        return luaMul(a, b)

      case OPCODE.DIV:
        return luaDiv(a, b)

      case OPCODE.MOD:
        return luaMod(a, b)

      case OPCODE.POW:
        return luaPow(a, b)

      case OPCODE.IDIV:
        return luaIDiv(a, b)

      case OPCODE.EQ:
        return luaEqual(a, b)

      case OPCODE.NE:
        return !luaEqual(a, b)

      case OPCODE.LT:
        return a < b

      case OPCODE.LE:
        return a <= b

      case OPCODE.GT:
        return a > b

      case OPCODE.GE:
        return a >= b

      case OPCODE.AND:
        return truthy(a) ? b : a

      case OPCODE.OR:
        return truthy(a) ? a : b

      case OPCODE.CONCAT:
        return luaConcat(a, b)

      default:
        throw new VMError(
          `unsupported binary opcode ${opcodeName(opcode)}`,
          this
        )
    }
  }

  executeFrame(frame) {
    this.callStack.push(frame)

    let steps = 0
    let result = []

    try {
      while (
        frame.ip < frame.code.length &&
        !this.halted
      ) {
        if (++steps > this.maxSteps) {
          throw new VMError(
            "VM instruction limit exceeded",
            this
          )
        }

        this.currentFrame = frame
        this.ip = frame.ip

        const instruction = frame.code[frame.ip]
        frame.ip++

        if (
          instruction == null ||
          typeof instruction !== "object"
        ) {
          continue
        }

        const op =
          typeof instruction.opcode === "number"
            ? instruction.opcode
            : instruction.op

        const A = instruction.a ?? instruction.A ?? 0
        const B = instruction.b ?? instruction.B ?? 0
        const C = instruction.c ?? instruction.C ?? 0
        const D = instruction.d ?? instruction.D ?? 0

        const extra = instruction.extra || instruction.data

        this.log(opcodeName(op), A, B, C, D)

        switch (op) {
          case OPCODE.NOP:
            break

          case OPCODE.LOADK:
            this.setRegister(
              frame,
              A,
              this.constant(frame, B)
            )
            break

          case OPCODE.LOADBOOL:
            this.setRegister(
              frame,
              A,
              !!B
            )

            if (C) {
              frame.ip++
            }
            break

          case OPCODE.LOADNIL:
            for (
              let i = A;
              i <= (B || A);
              i++
            ) {
              this.setRegister(frame, i, undefined)
            }
            break

          case OPCODE.MOVE:
            this.setRegister(
              frame,
              A,
              this.register(frame, B)
            )
            break

          case OPCODE.GETLOCAL: {
            const name =
              instruction.name ??
              extra?.name ??
              this.constant(frame, B)

            this.setRegister(
              frame,
              A,
              this.resolveName(frame, name)
            )
            break
          }

          case OPCODE.SETLOCAL: {
            const name =
              instruction.name ??
              extra?.name ??
              this.constant(frame, A)

            const source =
              instruction.src ??
              extra?.src ??
              B

            frame.locals[name] =
              this.register(frame, source)
            break
          }

          case OPCODE.GETGLOBAL: {
            const name =
              instruction.name ??
              extra?.name ??
              this.constant(frame, B)

            this.setRegister(
              frame,
              A,
              this.globals[name]
            )
            break
          }

          case OPCODE.SETGLOBAL: {
            const name =
              instruction.name ??
              extra?.name ??
              this.constant(frame, A)

            const source =
              instruction.src ??
              extra?.src ??
              B

            this.globals[name] =
              this.register(frame, source)
            break
          }

          case OPCODE.GETUPVAL: {
            const name =
              instruction.name ??
              extra?.name ??
              this.constant(frame, B)

            this.setRegister(
              frame,
              A,
              frame.upvalues[name]
            )
            break
          }

          case OPCODE.SETUPVAL: {
            const name =
              instruction.name ??
              extra?.name ??
              this.constant(frame, A)

            const source =
              instruction.src ??
              extra?.src ??
              B

            frame.upvalues[name] =
              this.register(frame, source)
            break
          }

          case OPCODE.NEWTABLE:
            this.setRegister(frame, A, {})
            break

          case OPCODE.GETTABLE: {
            const table =
              this.register(frame, B)

            const key =
              instruction.key !== undefined
                ? instruction.key
                : this.register(frame, C)

            this.setRegister(
              frame,
              A,
              getTable(table, key)
            )
            break
          }

          case OPCODE.SETTABLE: {
            const table =
              this.register(frame, A)

            const key =
              instruction.key !== undefined
                ? instruction.key
                : this.register(frame, B)

            const value =
              instruction.value !== undefined
                ? instruction.value
                : this.register(frame, C)

            setTable(table, key, value)
            break
          }

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
          case OPCODE.CONCAT: {
            const left =
              instruction.left !== undefined
                ? instruction.left
                : this.register(frame, B)

            const right =
              instruction.right !== undefined
                ? instruction.right
                : this.register(frame, C)

            this.setRegister(
              frame,
              A,
              this.executeBinary(op, left, right)
            )
            break
          }

          case OPCODE.NOT:
            this.setRegister(
              frame,
              A,
              !truthy(this.register(frame, B))
            )
            break

          case OPCODE.NEG:
            this.setRegister(
              frame,
              A,
              -Number(this.register(frame, B))
            )
            break

          case OPCODE.LEN:
            this.setRegister(
              frame,
              A,
              luaLen(this.register(frame, B))
            )
            break

          case OPCODE.CALL: {
            const target =
              instruction.target !== undefined
                ? instruction.target
                : this.register(frame, B)

            let args

            if (Array.isArray(instruction.args)) {
              args = instruction.args.map(
                index => this.register(frame, index)
              )
            } else if (Array.isArray(extra?.args)) {
              args = extra.args.map(value => {
                if (
                  typeof value === "number" &&
                  value >= 0 &&
                  value < frame.registers.length
                ) {
                  return this.register(frame, value)
                }

                return value
              })
            } else {
              const count = C || 0
              args = []

              for (let i = 0; i < count; i++) {
                args.push(
                  this.register(frame, B + 1 + i)
                )
              }
            }

            const fn =
              typeof target === "number"
                ? this.register(frame, target)
                : target

            const value = this.invoke(
              this.resolveFunction(fn),
              args,
              frame
            )

            if (Array.isArray(value)) {
              value.forEach((v, i) => {
                this.setRegister(
                  frame,
                  A + i,
                  v
                )
              })
            } else {
              this.setRegister(frame, A, value)
            }

            break
          }

          case OPCODE.RETURN: {
            const count =
              instruction.count ??
              extra?.count ??
              B ??
              1

            result = []

            for (let i = 0; i < count; i++) {
              result.push(
                this.register(
                  frame,
                  A + i
                )
              )
            }

            frame.returned = true
            frame.returnValues = result
            return result
          }

          case OPCODE.JMP:
            frame.ip +=
              instruction.offset ??
              instruction.jump ??
              D ??
              B ??
              0
            break

          case OPCODE.JMPIF:
            if (
              truthy(
                this.register(
                  frame,
                  B
                )
              )
            ) {
              frame.ip +=
                instruction.offset ??
                instruction.jump ??
                C ??
                D ??
                0
            }
            break

          case OPCODE.JMPIFNOT:
            if (
              !truthy(
                this.register(
                  frame,
                  B
                )
              )
            ) {
              frame.ip +=
                instruction.offset ??
                instruction.jump ??
                C ??
                D ??
                0
            }
            break

          case OPCODE.TEST:
            if (
              truthy(
                this.register(
                  frame,
                  B
                )
              ) !== !!C
            ) {
              frame.ip++
            }
            break

          case OPCODE.TESTSET: {
            const value =
              this.register(frame, B)

            if (truthy(value) === !!C) {
              this.setRegister(
                frame,
                A,
                value
              )
            } else {
              frame.ip++
            }

            break
          }

          case OPCODE.CLOSURE: {
            const proto =
              instruction.proto ??
              extra?.proto ??
              this.constant(frame, B)

            this.setRegister(
              frame,
              A,
              this.createClosure(
                proto,
                frame
              )
            )
            break
          }

          case OPCODE.FORPREP: {
            const index = Number(
              this.register(frame, A)
            )

            const limit = Number(
              this.register(frame, A + 1)
            )

            const step =
              Number(
                this.register(frame, A + 2)
              ) || 1

            this.setRegister(
              frame,
              A,
              index - step
            )

            this.setRegister(
              frame,
              A + 1,
              limit
            )

            this.setRegister(
              frame,
              A + 2,
              step
            )

            frame.ip +=
              instruction.offset ??
              instruction.jump ??
              s(Number(D || 0))
            break
          }

          case OPCODE.FORLOOP: {
            const step =
              Number(
                this.register(frame, A + 2)
              ) || 1

            const next =
              Number(
                this.register(frame, A)
              ) + step

            const limit =
              Number(
                this.register(frame, A + 1)
              )

            this.setRegister(
              frame,
              A,
              next
            )

            if (
              step >= 0
                ? next <= limit
                : next >= limit
            ) {
              this.setRegister(
                frame,
                A + 3,
                next
              )

              frame.ip +=
                instruction.offset ??
                instruction.jump ??
                B ??
                0
            }
            break
          }

          case OPCODE.POP:
            frame.registers[A] = undefined
            break

          case OPCODE.DUP:
            this.setRegister(
              frame,
              A + 1,
              this.register(frame, A)
            )
            break

          case OPCODE.SWAP: {
            const tmp =
              this.register(frame, A)

            this.setRegister(
              frame,
              A,
              this.register(frame, B)
            )

            this.setRegister(
              frame,
              B,
              tmp
            )
            break
          }

          case OPCODE.VARARG: {
            const count =
              instruction.count ??
              B ??
              frame.varargs.length

            for (let i = 0; i < count; i++) {
              this.setRegister(
                frame,
                A + i,
                frame.varargs[i]
              )
            }
            break
          }

          case OPCODE.SELF: {
            const object =
              this.register(frame, B)

            const key =
              instruction.key !== undefined
                ? instruction.key
                : this.register(frame, C)

            const method =
              getTable(object, key)

            this.setRegister(
              frame,
              A,
              method
            )

            this.setRegister(
              frame,
              A + 1,
              object
            )

            break
          }

          case OPCODE.CLOSE:
            break

          case OPCODE.TRAP:
            throw new VMError(
              instruction.message ||
              extra?.message ||
              "VM trap",
              this
            )

          case OPCODE.HALT:
            this.halted = true
            break

          default:
            throw new VMError(
              `unknown opcode ${String(op)}`,
              this
            )
        }
      }

      return result
    } finally {
      this.callStack.pop()
      this.currentFrame =
        this.callStack[this.callStack.length - 1] || null
    }
  }

  run(proto, args = []) {
    this.halted = false
    this.traceLog = []
    this.callStack = []

    const frame = new VMFrame(
      proto,
      args,
      null
    )

    frame.upvalues = Object.create(null)

    return this.executeFrame(frame)
  }

  execute(bytecode, args = []) {
    return this.run(bytecode, args)
  }

  reset() {
    this.halted = false
    this.traceLog = []
    this.callStack = []
    this.currentFrame = null
    this.ip = -1
  }

  getState() {
    return {
      chunkName: this.chunkName,
      watermark: this.watermark,
      halted: this.halted,
      ip: this.ip,
      stackDepth: this.callStack.length,
      traceLength: this.traceLog.length
    }
  }
}

function s(value) {
  return Number.isFinite(value) ? value : 0
}

export function createVM(options = {}) {
  return new ZisuayVM({
    chunkName: "Zisuay",
    watermark: "zis_obfuscator",
    ...options
  })
}

export function runVM(bytecode, options = {}, args = []) {
  const vm = createVM(options)
  return vm.run(bytecode, args)
}

export default ZisuayVM
