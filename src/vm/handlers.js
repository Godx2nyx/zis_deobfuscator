import { OPCODES } from "./opcodes.js"

function isTruthy(value) {
return value !== false && value !== nil && value !== null && value !== undefined
}

const nil = undefined

function luaLength(value) {
if (value === null || value === undefined) {
return 0
}

if (typeof value === "string" || Array.isArray(value)) {
return value.length
}

if (typeof value === "object") {
return Object.keys(value).length
}

return 0
}

function luaEqual(a, b) {
if (a === nil && b === nil) return true
return a === b
}

function luaCompare(a, b, type) {
if (type === "lt") return a < b
if (type === "le") return a <= b
if (type === "gt") return a > b
if (type === "ge") return a >= b
return false
}

function concat(a, b) {
if (a === nil) a = ""
if (b === nil) b = ""

return String(a) + String(b)
}

function getTable(table, key) {
if (table === null || table === undefined) {
return undefined
}

if (typeof table === "object") {
return table[key]
}

return undefined
}

function setTable(table, key, value) {
if (
table === null ||
table === undefined ||
typeof table !== "object"
) {
return value
}

table[key] = value
return value
}

function getOperand(state, index) {
return state.getRegister(index)
}

function setOperand(state, index, value) {
return state.setRegister(index, value)
}

function callFunction(fn, args, state) {
if (typeof fn !== "function") {
return []
}

try {
const result = fn(...args)

if (Array.isArray(result)) {
  return result
}

return [result]

} catch (error) {
state.error = error
state.halted = true
return []
}
}

export class VMHandlers {
constructor(options = {}) {
this.options = {
strict: options.strict ?? false,
...options
}

this.handlers = new Map()
this.registerDefaults()

}

register(opcode, handler) {
if (typeof handler !== "function") {
throw new TypeError("VM handler must be a function")
}

this.handlers.set(opcode, handler)

return this

}

get(opcode) {
return this.handlers.get(opcode)
}

has(opcode) {
return this.handlers.has(opcode)
}

execute(opcode, state, instruction) {
const handler = this.handlers.get(opcode)

if (!handler) {
  if (this.options.strict) {
    throw new Error(`Unknown VM opcode: ${opcode}`)
  }

  return {
    nextPC: state.pc + 1
  }
}

return handler(state, instruction)

}

registerDefaults() {
this.register(OPCODES.NOP, state => ({
nextPC: state.pc + 1
}))

this.register(OPCODES.LOADK, (state, instruction) => {
  let value

  if (
    instruction.extra &&
    Object.prototype.hasOwnProperty.call(
      instruction.extra,
      "constant"
    )
  ) {
    value = instruction.extra.constant
  } else {
    value = state.constants[instruction.b]
  }

  setOperand(state, instruction.a, value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.MOVE, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    getOperand(state, instruction.b)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.GETLOCAL, (state, instruction) => {
  const name =
    instruction.extra?.name ??
    instruction.b

  setOperand(
    state,
    instruction.a,
    state.getLocal(name)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.SETLOCAL, (state, instruction) => {
  const name =
    instruction.extra?.name ??
    instruction.b

  state.setLocal(
    name,
    getOperand(state, instruction.a)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.GETGLOBAL, (state, instruction) => {
  const name =
    instruction.extra?.name ??
    state.constants[instruction.b] ??
    instruction.b

  setOperand(
    state,
    instruction.a,
    state.getGlobal(name)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.SETGLOBAL, (state, instruction) => {
  const name =
    instruction.extra?.name ??
    state.constants[instruction.b] ??
    instruction.b

  state.setGlobal(
    name,
    getOperand(state, instruction.a)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.GETUPVAL, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    state.upvalues[instruction.b]
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.SETUPVAL, (state, instruction) => {
  state.upvalues[instruction.b] =
    getOperand(state, instruction.a)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.NEWTABLE, (state, instruction) => {
  setOperand(state, instruction.a, {})

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.GETTABLE, (state, instruction) => {
  const table = getOperand(state, instruction.b)
  const key = getOperand(state, instruction.c)

  setOperand(
    state,
    instruction.a,
    getTable(table, key)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.SETTABLE, (state, instruction) => {
  const table = getOperand(state, instruction.a)
  const key = getOperand(state, instruction.b)
  const value = getOperand(state, instruction.c)

  setTable(table, key, value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.ADD, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    getOperand(state, instruction.b) +
      getOperand(state, instruction.c)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.SUB, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    getOperand(state, instruction.b) -
      getOperand(state, instruction.c)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.MUL, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    getOperand(state, instruction.b) *
      getOperand(state, instruction.c)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.DIV, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    getOperand(state, instruction.b) /
      getOperand(state, instruction.c)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.MOD, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    getOperand(state, instruction.b) %
      getOperand(state, instruction.c)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.POW, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    Math.pow(
      getOperand(state, instruction.b),
      getOperand(state, instruction.c)
    )
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.IDIV, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    Math.floor(
      getOperand(state, instruction.b) /
      getOperand(state, instruction.c)
    )
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.EQ, (state, instruction) => {
  const value = luaEqual(
    getOperand(state, instruction.b),
    getOperand(state, instruction.c)
  )

  setOperand(state, instruction.a, value)
  state.updateFlags(value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.NE, (state, instruction) => {
  const value = !luaEqual(
    getOperand(state, instruction.b),
    getOperand(state, instruction.c)
  )

  setOperand(state, instruction.a, value)
  state.updateFlags(value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.LT, (state, instruction) => {
  const value = luaCompare(
    getOperand(state, instruction.b),
    getOperand(state, instruction.c),
    "lt"
  )

  setOperand(state, instruction.a, value)
  state.updateFlags(value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.LE, (state, instruction) => {
  const value = luaCompare(
    getOperand(state, instruction.b),
    getOperand(state, instruction.c),
    "le"
  )

  setOperand(state, instruction.a, value)
  state.updateFlags(value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.GT, (state, instruction) => {
  const value = luaCompare(
    getOperand(state, instruction.b),
    getOperand(state, instruction.c),
    "gt"
  )

  setOperand(state, instruction.a, value)
  state.updateFlags(value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.GE, (state, instruction) => {
  const value = luaCompare(
    getOperand(state, instruction.b),
    getOperand(state, instruction.c),
    "ge"
  )

  setOperand(state, instruction.a, value)
  state.updateFlags(value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.AND, (state, instruction) => {
  const left = getOperand(state, instruction.b)
  const right = getOperand(state, instruction.c)

  setOperand(
    state,
    instruction.a,
    isTruthy(left) ? right : left
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.OR, (state, instruction) => {
  const left = getOperand(state, instruction.b)
  const right = getOperand(state, instruction.c)

  setOperand(
    state,
    instruction.a,
    isTruthy(left) ? left : right
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.NOT, (state, instruction) => {
  const value =
    !isTruthy(getOperand(state, instruction.b))

  setOperand(state, instruction.a, value)
  state.updateFlags(value)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.NEG, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    -getOperand(state, instruction.b)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.CONCAT, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    concat(
      getOperand(state, instruction.b),
      getOperand(state, instruction.c)
    )
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.LEN, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    luaLength(
      getOperand(state, instruction.b)
    )
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.CALL, (state, instruction) => {
  const fn = getOperand(state, instruction.a)

  const count =
    instruction.extra?.argCount ??
    instruction.c ??
    0

  const args = []

  for (let i = 0; i < count; i++) {
    args.push(
      getOperand(
        state,
        instruction.b + i
      )
    )
  }

  const results = callFunction(
    fn,
    args,
    state
  )

  const resultCount =
    instruction.extra?.resultCount ??
    1

  for (
    let i = 0;
    i < resultCount;
    i++
  ) {
    setOperand(
      state,
      instruction.a + i,
      results[i]
    )
  }

  state.lastResult = results

  return {
    nextPC: state.pc + 1,
    results
  }
})

this.register(OPCODES.RETURN, (state, instruction) => {
  const count =
    instruction.extra?.count ??
    instruction.b ??
    1

  state.returnValues = []

  for (let i = 0; i < count; i++) {
    state.returnValues.push(
      getOperand(
        state,
        instruction.a + i
      )
    )
  }

  state.halted = true

  return {
    nextPC: -1,
    returnValues: state.returnValues
  }
})

this.register(OPCODES.JMP, (state, instruction) => {
  const target =
    instruction.extra?.target ??
    instruction.extra?.address ??
    instruction.b

  return {
    nextPC: Number(target)
  }
})

this.register(OPCODES.JMPIF, (state, instruction) => {
  const condition =
    getOperand(state, instruction.a)

  const target =
    instruction.extra?.target ??
    instruction.extra?.address ??
    instruction.b

  return {
    nextPC: isTruthy(condition)
      ? Number(target)
      : state.pc + 1
  }
})

this.register(OPCODES.JMPIFNOT, (state, instruction) => {
  const condition =
    getOperand(state, instruction.a)

  const target =
    instruction.extra?.target ??
    instruction.extra?.address ??
    instruction.b

  return {
    nextPC: !isTruthy(condition)
      ? Number(target)
      : state.pc + 1
  }
})

this.register(OPCODES.POP, state => {
  state.pop()

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.DUP, state => {
  state.push(state.peek())

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.SWAP, state => {
  const a = state.pop()
  const b = state.pop()

  state.push(a)
  state.push(b)

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.LOADBOOL, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    Boolean(instruction.b)
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.LOADNIL, (state, instruction) => {
  setOperand(
    state,
    instruction.a,
    nil
  )

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.VARARG, (state, instruction) => {
  const values =
    state.varargs ??
    []

  const count =
    instruction.c ||
    values.length

  for (let i = 0; i < count; i++) {
    setOperand(
      state,
      instruction.a + i,
      values[i]
    )
  }

  return {
    nextPC: state.pc + 1
  }
})

this.register(OPCODES.CLOSE, state => ({
  nextPC: state.pc + 1
}))

this.register(OPCODES.HALT, state => {
  state.halted = true

  return {
    nextPC: -1
  }
})

this.register(OPCODES.TRAP, (state, instruction) => {
  const message =
    instruction.extra?.message ??
    "Zisuay VM trap"

  state.error = new Error(message)
  state.halted = true

  return {
    nextPC: -1,
    error: state.error
  }
})

return this

}

export() {
return {
count: this.handlers.size,
opcodes: [...this.handlers.keys()]
}
}
}

export function createVMHandlers(options = {}) {
return new VMHandlers(options)
}

export function createDefaultHandlers(options = {}) {
return new VMHandlers(options)
}

export function executeHandler(
handlers,
opcode,
state,
instruction
) {
const instance =
handlers instanceof VMHandlers
? handlers
: new VMHandlers()

return instance.execute(
opcode,
state,
instruction
)
}

export default VMHandlers
