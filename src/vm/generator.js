import { OPCODES, opcodeName, instructionSize } from "./opcodes.js"
import { assemble, optimizeBytecode, validateBytecode } from "./assembler.js"
import { verifyBytecode } from "./verifier.js"

const MAGIC = "ZISUAY"
const VERSION = 2
const DEFAULT_CHUNK_NAME = "Zisuay"
const DEFAULT_WATERMARK = "zis_obfuscator"

function clone(value) {
if (value === undefined || value === null) return value
return JSON.parse(JSON.stringify(value))
}

function normalizeInstruction(instruction) {
if (Array.isArray(instruction)) {
const [op, a = 0, b = 0, c = 0, extra = null] = instruction

return {
  op: typeof op === "string" ? opcodeValue(op) : Number(op) || 0,
  a: Number(a) || 0,
  b: Number(b) || 0,
  c: Number(c) || 0,
  extra
}

}

if (!instruction || typeof instruction !== "object") {
return {
op: OPCODES.NOP,
a: 0,
b: 0,
c: 0,
extra: null
}
}

const rawOp =
instruction.op ??
instruction.opcode ??
instruction.code ??
"NOP"

return {
op: typeof rawOp === "string" ? opcodeValue(rawOp) : Number(rawOp) || 0,
a: Number(instruction.a ?? instruction.A ?? 0) || 0,
b: Number(instruction.b ?? instruction.B ?? 0) || 0,
c: Number(instruction.c ?? instruction.C ?? 0) || 0,
extra: instruction.extra ?? instruction.data ?? null
}
}

function opcodeValue(name) {
if (typeof name !== "string") return Number(name) || 0

if (Object.prototype.hasOwnProperty.call(OPCODES, name)) {
return OPCODES[name]
}

const upper = name.toUpperCase()

if (Object.prototype.hasOwnProperty.call(OPCODES, upper)) {
return OPCODES[upper]
}

return OPCODES.NOP
}

function normalizeConstants(constants) {
if (!Array.isArray(constants)) return []

return constants.map(value => clone(value))
}

function normalizeLocals(locals) {
if (!Array.isArray(locals)) return []

return locals.map((local, index) => {
if (typeof local === "string") {
return {
index,
name: local
}
}

return {
  index: Number(local?.index ?? index),
  name: String(local?.name ?? `L${index}`),
  ...clone(local)
}

})
}

function normalizeProgram(program) {
if (!program) {
return {
instructions: [],
constants: [],
locals: [],
upvalues: [],
functions: []
}
}

if (Array.isArray(program)) {
return {
instructions: program.map(normalizeInstruction),
constants: [],
locals: [],
upvalues: [],
functions: []
}
}

const instructions =
program.instructions ??
program.code ??
program.bytecode ??
program.ops ??
[]

return {
instructions: Array.isArray(instructions)
? instructions.map(normalizeInstruction)
: [],
constants: normalizeConstants(
program.constants ??
program.consts ??
[]
),
locals: normalizeLocals(program.locals ?? []),
upvalues: clone(program.upvalues ?? []),
functions: clone(program.functions ?? [])
}
}

function buildConstantPool(program) {
const constants = [...program.constants]
const lookup = new Map()

for (let i = 0; i < constants.length; i++) {
const key = constantKey(constants[i])
if (!lookup.has(key)) lookup.set(key, i)
}

return {
constants,
lookup
}
}

function constantKey(value) {
if (value === null) return "nil"
if (typeof value === "string") return "s:${value}"
if (typeof value === "number") return "n:${value}"
if (typeof value === "boolean") return "b:${value}"
if (typeof value === "bigint") return "i:${value.toString()}"
return "o:${JSON.stringify(value)}"
}

function deduplicateConstants(program) {
const pool = buildConstantPool(program)

const instructions = program.instructions.map(instruction => {
const copy = { ...instruction }

if (
  copy.op === OPCODES.LOADK &&
  copy.extra &&
  Object.prototype.hasOwnProperty.call(copy.extra, "constant")
) {
  const value = copy.extra.constant
  const key = constantKey(value)

  let index = pool.lookup.get(key)

  if (index === undefined) {
    index = pool.constants.length
    pool.constants.push(clone(value))
    pool.lookup.set(key, index)
  }

  copy.b = index
  copy.extra = {
    ...copy.extra,
    constant: undefined
  }
}

return copy

})

return {
...program,
instructions,
constants: pool.constants
}
}

function remapInstructionConstants(program) {
return program.instructions.map(instruction => {
const copy = { ...instruction }

if (
  copy.op === OPCODES.LOADK &&
  copy.extra &&
  Object.prototype.hasOwnProperty.call(copy.extra, "constant")
) {
  const index = program.constants.findIndex(
    value => constantKey(value) === constantKey(copy.extra.constant)
  )

  if (index >= 0) {
    copy.b = index
  }
}

return copy

})
}

function injectMetadata(program, options) {
return {
...program,
metadata: {
magic: MAGIC,
version: VERSION,
architecture: "Zisuay-REGVM",
chunkName: options.chunkName,
watermark: options.watermark,
generatedAt: Date.now(),
instructionCount: program.instructions.length,
constantCount: program.constants.length
}
}
}

function buildFunctionTable(program) {
const functions = Array.isArray(program.functions)
? program.functions
: []

return functions.map((fn, index) => ({
id: Number(fn?.id ?? index),
name: String(fn?.name ?? "F${index}"),
entry: Number(fn?.entry ?? 0),
params: Number(fn?.params ?? 0),
registers: Number(fn?.registers ?? 0),
constants: clone(fn?.constants ?? []),
instructions: clone(fn?.instructions ?? [])
}))
}

function calculateRegisterCount(program) {
let max = 0

for (const instruction of program.instructions) {
max = Math.max(
max,
Number(instruction.a) || 0,
Number(instruction.b) || 0,
Number(instruction.c) || 0
)
}

return Math.max(8, max + 1)
}

function createProgramHeader(program, options) {
return {
magic: MAGIC,
version: VERSION,
architecture: "Zisuay-REGVM",
chunkName: options.chunkName,
watermark: options.watermark,
entry: 0,
registers: calculateRegisterCount(program),
instructionCount: program.instructions.length,
constantCount: program.constants.length,
functionCount: program.functions.length
}
}

export class VMGenerator {
constructor(options = {}) {
this.options = {
chunkName: DEFAULT_CHUNK_NAME,
watermark: DEFAULT_WATERMARK,
optimize: true,
verify: true,
deduplicateConstants: true,
...options
}
}

normalize(input) {
return normalizeProgram(input)
}

prepare(input) {
let program = normalizeProgram(input)

if (this.options.deduplicateConstants) {
  program = deduplicateConstants(program)
}

program = {
  ...program,
  instructions: remapInstructionConstants(program)
}

program.functions = buildFunctionTable(program)

program = injectMetadata(program, this.options)

return program

}

optimize(program) {
if (!this.options.optimize) {
return program
}

try {
  const optimized = optimizeBytecode(program)

  if (optimized && typeof optimized === "object") {
    return {
      ...program,
      ...optimized,
      metadata: {
        ...program.metadata,
        optimized: true
      }
    }
  }
} catch {
  // Keep the unoptimized program if optimization is unavailable.
}

return {
  ...program,
  metadata: {
    ...program.metadata,
    optimized: false
  }
}

}

verify(program) {
if (!this.options.verify) {
return {
valid: true,
skipped: true,
errors: [],
warnings: []
}
}

try {
  const result = verifyBytecode(program)

  if (typeof result === "boolean") {
    return {
      valid: result,
      errors: result ? [] : ["Bytecode verification failed"],
      warnings: []
    }
  }

  return {
    valid: result?.valid !== false,
    errors: result?.errors ?? [],
    warnings: result?.warnings ?? [],
    ...result
  }
} catch (error) {
  return {
    valid: false,
    errors: [error?.message ?? String(error)],
    warnings: []
  }
}

}

generate(input) {
let program = this.prepare(input)
program = this.optimize(program)

const verification = this.verify(program)

if (!verification.valid) {
  return {
    success: false,
    program,
    verification,
    bytecode: null,
    header: createProgramHeader(program, this.options),
    error: verification.errors.join("; ")
  }
}

let bytecode = null

try {
  bytecode = assemble(program)
} catch {
  bytecode = {
    instructions: clone(program.instructions),
    constants: clone(program.constants),
    functions: clone(program.functions)
  }
}

return {
  success: true,
  program,
  bytecode,
  verification,
  header: createProgramHeader(program, this.options),
  metadata: {
    ...program.metadata,
    bytecodeVersion: VERSION,
    opcodeCount: Object.keys(OPCODES).length
  }
}

}

build(input) {
return this.generate(input)
}

generateVM(input) {
return this.generate(input)
}
}

export function generateVM(input, options = {}) {
const generator = new VMGenerator(options)
return generator.generate(input)
}

export function createVMGenerator(options = {}) {
return new VMGenerator(options)
}

export function normalizeVMProgram(input) {
return normalizeProgram(input)
}

export function createVMHeader(program, options = {}) {
const normalized = normalizeProgram(program)

return createProgramHeader(normalized, {
chunkName: options.chunkName ?? DEFAULT_CHUNK_NAME,
watermark: options.watermark ?? DEFAULT_WATERMARK
})
}

export function getVMOpcodeInfo(op) {
const value = typeof op === "string" ? opcodeValue(op) : Number(op) || 0

return {
value,
name: opcodeName?.(value) ?? Object.keys(OPCODES).find(
key => OPCODES[key] === value
) ?? "UNKNOWN",
size: instructionSize?.(value) ?? 1
}
}

export function validateVMProgram(program) {
const normalized = normalizeProgram(program)

try {
const result = validateBytecode(normalized)

if (typeof result === "boolean") {
  return {
    valid: result,
    errors: result ? [] : ["Invalid VM program"]
  }
}

return result

} catch (error) {
return {
valid: false,
errors: [error?.message ?? String(error)]
}
}
}

export default VMGenerator
