import { OPCODES } from "./opcodes.js"

const MAGIC = "ZISUAY"
const VERSION = 2

function clone(value) {
if (value === undefined || value === null) return value
return JSON.parse(JSON.stringify(value))
}

function getOpcodeName(value) {
for (const [name, opcode] of Object.entries(OPCODES)) {
if (opcode === value) return name
}

return "UNKNOWN"
}

function normalizeInstruction(instruction) {
if (Array.isArray(instruction)) {
return {
op: Number(instruction[0]) || 0,
a: Number(instruction[1]) || 0,
b: Number(instruction[2]) || 0,
c: Number(instruction[3]) || 0,
extra: clone(instruction[4] ?? null)
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

function rotateRight(value, amount) {
amount &= 31
value >>>= 0

if (amount === 0) return value

return (
(value >>> amount) |
(value << (32 - amount))
) >>> 0
}

function rotateLeft(value, amount) {
amount &= 31
value >>>= 0

if (amount === 0) return value

return (
(value << amount) |
(value >>> (32 - amount))
) >>> 0
}

function mix32(value, key) {
let x = (value ^ key) >>> 0

x ^= x >>> 16
x = Math.imul(x, 0x85ebca6b) >>> 0
x ^= x >>> 13
x = Math.imul(x, 0xc2b2ae35) >>> 0
x ^= x >>> 16

return x >>> 0
}

function deriveKey(metadata = {}) {
let key = 0x9e3779b9

const source = [
metadata.chunkName ?? "Zisuay",
metadata.watermark ?? "zis_obfuscator",
metadata.seed ?? 0,
metadata.fingerprint ?? ""
].join("|")

for (let i = 0; i < source.length; i++) {
key ^= source.charCodeAt(i)
key = Math.imul(key, 0x01000193) >>> 0
key ^= key >>> 13
}

return key >>> 0
}

export function decodeInstruction(instruction, index, key) {
const encoded = normalizeInstruction(instruction)

const salt = mix32(
key,
index * 0x45d9f3b
)

return {
op: (encoded.op ^ (salt & 0x3f)) >>> 0,
a: (encoded.a ^ ((salt >>> 6) & 0xff)) >>> 0,
b: (encoded.b ^ ((salt >>> 14) & 0xff)) >>> 0,
c: (encoded.c ^ ((salt >>> 22) & 0xff)) >>> 0,
extra: clone(encoded.extra)
}
}

export function encodeInstruction(instruction, index, key) {
const normalized = normalizeInstruction(instruction)

const salt = mix32(
key,
index * 0x45d9f3b
)

return {
op: (normalized.op ^ (salt & 0x3f)) >>> 0,
a: (normalized.a ^ ((salt >>> 6) & 0xff)) >>> 0,
b: (normalized.b ^ ((salt >>> 14) & 0xff)) >>> 0,
c: (normalized.c ^ ((salt >>> 22) & 0xff)) >>> 0,
extra: clone(normalized.extra)
}
}

export class VMDecoder {
constructor(options = {}) {
this.options = {
strict: options.strict ?? false,
...options
}
}

decode(program) {
const vm = normalizeProgram(program)
const metadata = vm.metadata ?? {}

if (
  metadata.magic &&
  metadata.magic !== MAGIC &&
  this.options.strict
) {
  throw new Error("Invalid Zisuay VM magic")
}

if (
  metadata.version &&
  Number(metadata.version) !== VERSION &&
  this.options.strict
) {
  throw new Error("Unsupported Zisuay VM version")
}

if (!metadata.encoded) {
  return {
    ...vm,
    instructions: vm.instructions.map(normalizeInstruction),
    metadata: {
      ...metadata,
      decoded: true
    }
  }
}

const key = deriveKey(metadata)

const instructions = vm.instructions.map(
  (instruction, index) =>
    decodeInstruction(instruction, index, key)
)

return {
  ...vm,
  instructions,
  metadata: {
    ...metadata,
    decoded: true,
    encodingKey: undefined
  }
}

}

inspect(program) {
const decoded = this.decode(program)

return {
  magic: decoded.metadata?.magic ?? MAGIC,
  version: decoded.metadata?.version ?? VERSION,
  architecture:
    decoded.metadata?.architecture ?? "Zisuay-REGVM",
  chunkName:
    decoded.metadata?.chunkName ?? "Zisuay",
  watermark:
    decoded.metadata?.watermark ?? "zis_obfuscator",
  instructionCount: decoded.instructions.length,
  constantCount: decoded.constants.length,
  instructions: decoded.instructions.map(
    (instruction, index) => ({
      index,
      opcode: instruction.op,
      name: getOpcodeName(instruction.op),
      a: instruction.a,
      b: instruction.b,
      c: instruction.c,
      extra: clone(instruction.extra)
    })
  )
}

}

disassemble(program) {
const decoded = this.decode(program)

return decoded.instructions.map(
  (instruction, index) => {
    const name = getOpcodeName(instruction.op)

    const args = [
      instruction.a,
      instruction.b,
      instruction.c
    ].join(", ")

    return `${String(index).padStart(4, "0")}  ${name.padEnd(10, " ")} ${args}`
  }
).join("\n")

}
}

export function createVMDecoder(options = {}) {
return new VMDecoder(options)
}

export function decodeVM(program, options = {}) {
return new VMDecoder(options).decode(program)
}

export function inspectVM(program, options = {}) {
return new VMDecoder(options).inspect(program)
}

export function disassembleVM(program, options = {}) {
return new VMDecoder(options).disassemble(program)
}

export {
MAGIC,
VERSION,
deriveKey,
mix32,
rotateLeft,
rotateRight
}

export default VMDecoder
