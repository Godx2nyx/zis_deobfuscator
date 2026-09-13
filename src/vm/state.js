const DEFAULT_CHUNK_NAME = "Zisuay"
const DEFAULT_WATERMARK = "zis_obfuscator"

function clone(value) {
if (value === undefined || value === null) return value
return JSON.parse(JSON.stringify(value))
}

function hash32(value) {
let h = 0x811c9dc5
const text = String(value)

for (let i = 0; i < text.length; i++) {
h ^= text.charCodeAt(i)
h = Math.imul(h, 0x01000193) >>> 0
}

return h >>> 0
}

function mix32(a, b) {
let x = (a ^ b) >>> 0

x ^= x >>> 16
x = Math.imul(x, 0x85ebca6b) >>> 0
x ^= x >>> 13
x = Math.imul(x, 0xc2b2ae35) >>> 0
x ^= x >>> 16

return x >>> 0
}

function normalizeRegisters(registers) {
if (!Array.isArray(registers)) {
return []
}

return registers.map(value => clone(value))
}

function createRegisterProxy(registers) {
return new Proxy(registers, {
get(target, property) {
if (typeof property === "string" && /^\d+$/.test(property)) {
return target[Number(property)]
}

  return target[property]
},

set(target, property, value) {
  if (typeof property === "string" && /^\d+$/.test(property)) {
    target[Number(property)] = value
    return true
  }

  target[property] = value
  return true
}

})
}

export class VMState {
constructor(options = {}) {
this.chunkName =
options.chunkName ??
DEFAULT_CHUNK_NAME

this.watermark =
  options.watermark ??
  DEFAULT_WATERMARK

this.seed =
  Number(options.seed ?? Date.now()) >>> 0

this.key = mix32(
  hash32(this.chunkName),
  hash32(this.watermark)
)

this.pc = 0
this.base = 0
this.top = 0

this.registers = createRegisterProxy(
  normalizeRegisters(options.registers)
)

this.stack = []
this.constants = []
this.upvalues = []
this.locals = new Map()
this.globals = options.globals ?? {}
this.environment = options.environment ?? {}

this.callStack = []
this.frames = []

this.returnValues = []
this.lastResult = undefined

this.running = false
this.halted = false
this.error = null

this.flags = {
  zero: false,
  negative: false,
  positive: false,
  truthy: false,
  ...clone(options.flags ?? {})
}

this.metadata = {
  magic: "ZISUAY",
  version: 2,
  architecture: "Zisuay-REGVM",
  chunkName: this.chunkName,
  watermark: this.watermark,
  ...clone(options.metadata ?? {})
}

}

getRegister(index) {
index = Number(index) || 0
return this.registers[index]
}

setRegister(index, value) {
index = Number(index) || 0
this.registers[index] = value

if (index >= this.top) {
  this.top = index + 1
}

return value

}

clearRegister(index) {
index = Number(index) || 0
this.registers[index] = undefined
}

getLocal(name) {
return this.locals.get(String(name))
}

setLocal(name, value) {
this.locals.set(String(name), value)
return value
}

deleteLocal(name) {
return this.locals.delete(String(name))
}

getGlobal(name) {
const key = String(name)

if (
  Object.prototype.hasOwnProperty.call(
    this.globals,
    key
  )
) {
  return this.globals[key]
}

return this.environment[key]

}

setGlobal(name, value) {
const key = String(name)
this.globals[key] = value
return value
}

push(value) {
this.stack.push(value)
this.top = this.stack.length
return value
}

pop() {
const value = this.stack.pop()
this.top = this.stack.length
return value
}

peek(offset = 0) {
const index =
this.stack.length - 1 - Number(offset || 0)

return index >= 0
  ? this.stack[index]
  : undefined

}

clearStack() {
this.stack.length = 0
this.top = 0
}

pushFrame(frame = {}) {
const current = {
pc: this.pc,
base: this.base,
top: this.top,
functionId: frame.functionId ?? null,
returnRegister:
frame.returnRegister ?? null,
registers: this.registers,
locals: this.locals,
...clone(frame)
}

this.callStack.push(current)

this.frames.push({
  functionId: current.functionId,
  pc: current.pc,
  base: current.base
})

this.registers = createRegisterProxy(
  normalizeRegisters(frame.registers)
)

this.locals =
  frame.locals instanceof Map
    ? new Map(frame.locals)
    : new Map(
        Object.entries(
          frame.locals ?? {}
        )
      )

this.pc = Number(frame.entry ?? 0)
this.base = Number(frame.base ?? 0)
this.top = this.registers.length

return current

}

popFrame() {
const previous = this.callStack.pop()

this.frames.pop()

if (!previous) {
  return null
}

this.pc = previous.pc
this.base = previous.base
this.top = previous.top
this.registers = previous.registers
this.locals = previous.locals

return previous

}

setFlag(name, value) {
this.flags[name] = Boolean(value)
}

updateFlags(value) {
this.flags.zero =
value === 0 ||
value === false ||
value === null ||
value === undefined

this.flags.negative =
  typeof value === "number" &&
  value < 0

this.flags.positive =
  typeof value === "number" &&
  value > 0

this.flags.truthy = Boolean(value)

return this.flags

}

getStateToken() {
return mix32(
this.key,
mix32(
this.pc >>> 0,
this.top >>> 0
)
)
}

snapshot() {
return {
pc: this.pc,
base: this.base,
top: this.top,
registers: clone([...this.registers]),
stack: clone(this.stack),
constants: clone(this.constants),
upvalues: clone(this.upvalues),
locals: Object.fromEntries(this.locals),
globals: clone(this.globals),
returnValues: clone(this.returnValues),
flags: clone(this.flags),
running: this.running,
halted: this.halted,
error: this.error
? String(this.error.message ?? this.error)
: null,
metadata: clone(this.metadata)
}
}

restore(snapshot = {}) {
this.pc = Number(snapshot.pc ?? 0)
this.base = Number(snapshot.base ?? 0)
this.top = Number(snapshot.top ?? 0)

this.registers = createRegisterProxy(
  normalizeRegisters(snapshot.registers)
)

this.stack = clone(snapshot.stack ?? [])
this.constants = clone(snapshot.constants ?? [])
this.upvalues = clone(snapshot.upvalues ?? [])

this.locals = new Map(
  Object.entries(snapshot.locals ?? {})
)

this.globals = clone(snapshot.globals ?? {})
this.returnValues = clone(
  snapshot.returnValues ?? []
)

this.flags = {
  zero: false,
  negative: false,
  positive: false,
  truthy: false,
  ...clone(snapshot.flags ?? {})
}

this.running = Boolean(snapshot.running)
this.halted = Boolean(snapshot.halted)

this.error = snapshot.error
  ? new Error(String(snapshot.error))
  : null

return this

}

reset() {
this.pc = 0
this.base = 0
this.top = 0

this.registers.length = 0
this.stack.length = 0

this.constants = []
this.upvalues = []
this.locals.clear()

this.callStack.length = 0
this.frames.length = 0

this.returnValues = []
this.lastResult = undefined

this.running = false
this.halted = false
this.error = null

this.flags.zero = false
this.flags.negative = false
this.flags.positive = false
this.flags.truthy = false

return this

}

clone() {
return new VMState(
this.snapshot()
)
}

export() {
return {
magic: this.metadata.magic,
version: this.metadata.version,
architecture: this.metadata.architecture,
chunkName: this.chunkName,
watermark: this.watermark,
seed: this.seed,
key: this.key,
state: this.snapshot()
}
}
}

export function createVMState(options = {}) {
return new VMState(options)
}

export function snapshotVMState(state) {
if (state instanceof VMState) {
return state.snapshot()
}

return new VMState(state).snapshot()
}

export function restoreVMState(state, snapshot) {
if (state instanceof VMState) {
return state.restore(snapshot)
}

return new VMState().restore(snapshot)
}

export function cloneVMState(state) {
if (state instanceof VMState) {
return state.clone()
}

return new VMState(state).clone()
}

export function createStateToken(state) {
if (!(state instanceof VMState)) {
state = new VMState(state)
}

return state.getStateToken()
}

export default VMState
