import { OPCODES } from "./opcodes.js"

const DEFAULT_CHUNK_NAME = "Zisuay"
const DEFAULT_WATERMARK = "zis_obfuscator"

function clone(value) {
if (value === undefined || value === null) return value
return JSON.parse(JSON.stringify(value))
}

function opcodeValue(op) {
if (typeof op === "number") return op >>> 0

if (typeof op === "string") {
if (Object.prototype.hasOwnProperty.call(OPCODES, op)) {
return OPCODES[op]
}

const upper = op.toUpperCase()

if (Object.prototype.hasOwnProperty.call(OPCODES, upper)) {
  return OPCODES[upper]
}

}

return OPCODES.NOP
}

function normalizeInstruction(instruction) {
if (Array.isArray(instruction)) {
return {
op: opcodeValue(instruction[0]),
a: Number(instruction[1]) || 0,
b: Number(instruction[2]) || 0,
c: Number(instruction[3]) || 0,
extra: clone(instruction[4] ?? null)
}
}

return {
op: opcodeValue(
instruction?.op ??
instruction?.opcode ??
OPCODES.NOP
),
a: Number(instruction?.a ?? 0) || 0,
b: Number(instruction?.b ?? 0) || 0,
c: Number(instruction?.c ?? 0) || 0,
extra: clone(instruction?.extra ?? null)
}
}

function normalizeProgram(program) {
return {
instructions: Array.isArray(program?.instructions)
? program.instructions.map(normalizeInstruction)
: [],
constants: clone(program?.constants ?? []),
functions: clone(program?.functions ?? []),
metadata: clone(program?.metadata ?? {})
}
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

function createStateKey(metadata) {
return mix32(
hash32(metadata?.chunkName ?? DEFAULT_CHUNK_NAME),
hash32(metadata?.watermark ?? DEFAULT_WATERMARK)
)
}

function shuffle(list, seed) {
const result = [...list]
let state = seed >>> 0

const next = () => {
state ^= state << 13
state ^= state >>> 17
state ^= state << 5
state >>>= 0
return state
}

for (let i = result.length - 1; i > 0; i--) {
const j = next() % (i + 1)
const temp = result[i]
result[i] = result[j]
result[j] = temp
}

return result
}

function createOpcodeTable(key) {
const names = Object.keys(OPCODES)

const entries = names.map(name => ({
name,
opcode: OPCODES[name]
}))

return shuffle(entries, key)
}

function createDispatchTable(program, key) {
const instructions = program.instructions

const table = new Array(instructions.length)

for (let i = 0; i < instructions.length; i++) {
const instruction = instructions[i]

table[i] = {
  state: mix32(key, i),
  target: i,
  opcode: instruction.op,
  registerA: instruction.a,
  registerB: instruction.b,
  registerC: instruction.c
}

}

return table
}

function createHandlerMap(program, key) {
const handlers = new Map()

for (let i = 0; i < program.instructions.length; i++) {
const instruction = program.instructions[i]
const state = mix32(key, i)

handlers.set(state, {
  pc: i,
  opcode: instruction.op,
  execute: instruction
})

}

return handlers
}

function resolveJumpTarget(instruction, pc) {
const extra = instruction.extra

if (extra && Number.isInteger(extra.target)) {
return extra.target
}

if (extra && Number.isInteger(extra.address)) {
return extra.address
}

if (
instruction.op === OPCODES.JMP ||
instruction.op === OPCODES.JMPIF ||
instruction.op === OPCODES.JMPIFNOT
) {
if (Number.isInteger(instruction.b)) {
return instruction.b
}
}

return pc + 1
}

export class VMDispatcher {
constructor(options = {}) {
this.options = {
chunkName: options.chunkName ?? DEFAULT_CHUNK_NAME,
watermark: options.watermark ?? DEFAULT_WATERMARK,
randomized: options.randomized ?? true,
...options
}

this.program = null
this.key = 0
this.dispatchTable = []
this.opcodeTable = []
this.handlers = new Map()

}

build(program) {
this.program = normalizeProgram(program)

this.key = createStateKey({
  chunkName:
    this.options.chunkName ??
    this.program.metadata?.chunkName,
  watermark:
    this.options.watermark ??
    this.program.metadata?.watermark
})

this.dispatchTable = createDispatchTable(
  this.program,
  this.key
)

this.opcodeTable = createOpcodeTable(this.key)

this.handlers = createHandlerMap(
  this.program,
  this.key
)

return this.export()

}

dispatch(pc) {
if (!this.program) {
throw new Error("VM dispatcher has not been initialized")
}

if (pc < 0 || pc >= this.program.instructions.length) {
  return {
    done: true,
    pc,
    instruction: null
  }
}

const instruction =
  this.program.instructions[pc]

const state = mix32(this.key, pc)

return {
  done: false,
  pc,
  state,
  opcode: instruction.op,
  instruction: clone(instruction),
  nextPC: resolveJumpTarget(instruction, pc)
}

}

getHandler(pc) {
if (!this.program) return null

const state = mix32(this.key, pc)
return this.handlers.get(state) ?? null

}

next(pc) {
if (!this.program) {
throw new Error("VM dispatcher has not been initialized")
}

const instruction = this.program.instructions[pc]

if (!instruction) {
  return -1
}

if (
  instruction.op === OPCODES.JMP ||
  instruction.op === OPCODES.JMPIF ||
  instruction.op === OPCODES.JMPIFNOT
) {
  return resolveJumpTarget(instruction, pc)
}

if (
  instruction.op === OPCODES.RETURN ||
  instruction.op === OPCODES.HALT ||
  instruction.op === OPCODES.TRAP
) {
  return -1
}

return pc + 1

}

export() {
return {
magic: "ZISUAY",
version: 2,
architecture: "Zisuay-REGVM",
chunkName: this.options.chunkName,
watermark: this.options.watermark,
key: this.key,
dispatchTable: clone(this.dispatchTable),
opcodeTable: clone(this.opcodeTable),
instructionCount:
this.program?.instructions?.length ?? 0
}
}

reset() {
this.program = null
this.key = 0
this.dispatchTable = []
this.opcodeTable = []
this.handlers.clear()
}
}

export function createDispatcher(options = {}) {
return new VMDispatcher(options)
}

export function buildDispatchTable(program, options = {}) {
return new VMDispatcher(options).build(program)
}

export function dispatchInstruction(
program,
pc,
options = {}
) {
const dispatcher = new VMDispatcher(options)
dispatcher.build(program)
return dispatcher.dispatch(pc)
}

export function getNextPC(
program,
pc
) {
const normalized = normalizeProgram(program)
const instruction = normalized.instructions[pc]

if (!instruction) return -1

return resolveJumpTarget(instruction, pc)
}

export default VMDispatcher
