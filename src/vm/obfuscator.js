import { Random } from "../utils/random.js"
import { fnv1a, hashToHex } from "../utils/hash.js"
import { OPCODES } from "./opcodes.js"

const DEFAULT_CHUNK_NAME = "Zisuay"
const DEFAULT_WATERMARK = "zis_obfuscator"

function clone(value) {
if (value === undefined || value === null) return value
return JSON.parse(JSON.stringify(value))
}

function hash32(value) {
return fnv1a(String(value)) >>> 0
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

function instructionKey(instruction, index) {
return [
index,
instruction?.op ?? 0,
instruction?.a ?? 0,
instruction?.b ?? 0,
instruction?.c ?? 0
].join(":")
}

function normalizeInstruction(instruction) {
if (Array.isArray(instruction)) {
return {
op: Number(instruction[0]) || 0,
a: Number(instruction[1]) || 0,
b: Number(instruction[2]) || 0,
c: Number(instruction[3]) || 0,
extra: instruction[4] ?? null
}
}

return {
op: Number(instruction?.op ?? instruction?.opcode ?? 0) || 0,
a: Number(instruction?.a ?? 0) || 0,
b: Number(instruction?.b ?? 0) || 0,
c: Number(instruction?.c ?? 0) || 0,
extra: clone(instruction?.extra ?? null)
}
}

function normalizeProgram(program) {
if (Array.isArray(program)) {
return {
instructions: program.map(normalizeInstruction),
constants: [],
functions: [],
metadata: {}
}
}

return {
instructions: Array.isArray(program?.instructions)
? program.instructions.map(normalizeInstruction)
: [],
constants: clone(program?.constants ?? []),
functions: clone(program?.functions ?? []),
metadata: clone(program?.metadata ?? {})
}
}

function isJump(op) {
return (
op === OPCODES.JMP ||
op === OPCODES.JMPIF ||
op === OPCODES.JMPIFNOT
)
}

function isTerminator(op) {
return (
op === OPCODES.RETURN ||
op === OPCODES.HALT ||
op === OPCODES.TRAP
)
}

function randomPermutation(length, random) {
const order = Array.from({ length }, (_, i) => i)

for (let i = order.length - 1; i > 0; i--) {
const j = random.int(0, i)
const temp = order[i]
order[i] = order[j]
order[j] = temp
}

return order
}

function remapJumpTargets(instructions, oldToNew) {
return instructions.map((instruction, index) => {
const output = { ...instruction }

if (!isJump(output.op)) {
  return output
}

if (output.extra && Number.isInteger(output.extra.target)) {
  const target = output.extra.target
  if (oldToNew.has(target)) {
    output.extra = {
      ...output.extra,
      target: oldToNew.get(target)
    }
  }
}

if (output.extra && Number.isInteger(output.extra.address)) {
  const target = output.extra.address
  if (oldToNew.has(target)) {
    output.extra = {
      ...output.extra,
      address: oldToNew.get(target)
    }
  }
}

if (Number.isInteger(output.b) && oldToNew.has(output.b)) {
  output.b = oldToNew.get(output.b)
}

if (Number.isInteger(output.c) && oldToNew.has(output.c)) {
  output.c = oldToNew.get(output.c)
}

return output

})
}

function createOpaqueConstant(random) {
const a = random.int(1000, 0x7fffffff)
const b = random.int(1, 997)

return {
left: a,
right: b,
value: (a ^ b) >>> 0
}
}

function injectOpaqueInstructions(instructions, random, intensity) {
if (intensity <= 0 || instructions.length === 0) {
return instructions
}

const output = []

for (let i = 0; i < instructions.length; i++) {
output.push(instructions[i])

if (random.float() > intensity) {
  continue
}

const opaque = createOpaqueConstant(random)

output.push({
  op: OPCODES.LOADK,
  a: 0,
  b: 0,
  c: 0,
  extra: {
    constant: opaque.left
  }
})

output.push({
  op: OPCODES.LOADK,
  a: 1,
  b: 0,
  c: 0,
  extra: {
    constant: opaque.right
  }
})

output.push({
  op: OPCODES.XOR ?? OPCODES.NOP,
  a: 2,
  b: 0,
  c: 1,
  extra: {
    opaque: true,
    expected: opaque.value
  }
})

output.push({
  op: OPCODES.POP,
  a: 2,
  b: 0,
  c: 0,
  extra: {
    opaque: true
  }
})

}

return output
}

function injectDeadInstructions(instructions, random, intensity) {
if (intensity <= 0 || instructions.length === 0) {
return instructions
}

const output = []

for (const instruction of instructions) {
if (random.float() < intensity) {
output.push({
op: OPCODES.NOP,
a: random.int(0, 15),
b: random.int(0, 15),
c: random.int(0, 15),
extra: {
dead: true,
marker: random.hex(6)
}
})
}

output.push(instruction)

}

return output
}

function encodeInstruction(instruction, key, index) {
const salt = mix32(key, hash32(instructionKey(instruction, index)))

return {
op: (instruction.op ^ (salt & 0x3f)) >>> 0,
a: (instruction.a ^ ((salt >>> 6) & 0xff)) >>> 0,
b: (instruction.b ^ ((salt >>> 14) & 0xff)) >>> 0,
c: (instruction.c ^ ((salt >>> 22) & 0xff)) >>> 0,
extra: clone(instruction.extra)
}
}

function createDispatchTable(length, random, key) {
const table = []
const permutation = randomPermutation(length, random)

for (let i = 0; i < permutation.length; i++) {
const original = permutation[i]

table.push({
  state: i,
  target: original,
  check: mix32(key, original) >>> 0
})

}

return table
}

export class VMObfuscator {
constructor(options = {}) {
this.options = {
seed: options.seed ?? Date.now(),
chunkName: options.chunkName ?? DEFAULT_CHUNK_NAME,
watermark: options.watermark ?? DEFAULT_WATERMARK,
instructionEncoding: options.instructionEncoding ?? true,
shuffleBlocks: options.shuffleBlocks ?? true,
opaqueInstructions: options.opaqueInstructions ?? true,
deadInstructions: options.deadInstructions ?? true,
opaqueIntensity: options.opaqueIntensity ?? 0.08,
deadIntensity: options.deadIntensity ?? 0.08,
...options
}

this.random = new Random(this.options.seed)

}

obfuscate(program) {
let vm = normalizeProgram(program)
let instructions = vm.instructions

if (this.options.opaqueInstructions) {
  instructions = injectOpaqueInstructions(
    instructions,
    this.random,
    this.options.opaqueIntensity
  )
}

if (this.options.deadInstructions) {
  instructions = injectDeadInstructions(
    instructions,
    this.random,
    this.options.deadIntensity
  )
}

let dispatchTable = []

if (this.options.shuffleBlocks && instructions.length > 1) {
  const order = randomPermutation(instructions.length, this.random)
  const oldToNew = new Map()

  order.forEach((oldIndex, newIndex) => {
    oldToNew.set(oldIndex, newIndex)
  })

  instructions = order.map(index => instructions[index])
  instructions = remapJumpTargets(instructions, oldToNew)

  dispatchTable = createDispatchTable(
    instructions.length,
    this.random,
    hash32(this.options.seed)
  )
}

const key = mix32(
  hash32(this.options.chunkName),
  hash32(this.options.watermark)
)

if (this.options.instructionEncoding) {
  instructions = instructions.map((instruction, index) =>
    encodeInstruction(instruction, key, index)
  )
}

const fingerprint = hashToHex(
  fnv1a(
    JSON.stringify({
      instructions,
      constants: vm.constants,
      seed: this.options.seed
    })
  )
)

return {
  ...vm,
  instructions,
  dispatchTable,
  metadata: {
    ...vm.metadata,
    magic: "ZISUAY",
    version: 2,
    architecture: "Zisuay-REGVM",
    chunkName: this.options.chunkName,
    watermark: this.options.watermark,
    encoded: this.options.instructionEncoding,
    shuffled: this.options.shuffleBlocks,
    opaque: this.options.opaqueInstructions,
    deadCode: this.options.deadInstructions,
    fingerprint,
    seed: this.options.seed
  }
}

}
}

export function createVMObfuscator(options = {}) {
return new VMObfuscator(options)
}

export function obfuscateVM(program, options = {}) {
return new VMObfuscator(options).obfuscate(program)
}

export default VMObfuscator
