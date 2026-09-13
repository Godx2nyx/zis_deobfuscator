export {
  OPCODE,
  OPCODE_NAMES,
  OPCODE_INFO,
  opcodeName,
  opcodeCode,
  isValidOpcode,
  getOpcodeInfo,
  encode,
  decode
} from "./opcodes.js"

export {
  BytecodeBuilder,
  assemble,
  encodeBytecode,
  decodeBytecode,
  disassemble,
  validateBytecode,
  cloneBytecode,
  optimizeBytecode,
  randomizeConstants
} from "./assembler.js"

export {
  BytecodeVerifier,
  verifyBytecode,
  assertBytecode,
  inspectBytecode
} from "./verifier.js"

export {
  VMImage,
  VMLoader,
  loadVM,
  createVMImage,
  serializeVM,
  deserializeVM,
  isVMImage,
  getVMInfo,
  decodeVMCode,
  MAGIC,
  VERSION
} from "./loader.js"

export {
  VMFrame,
  ZisuayVM,
  createVM,
  runVM
} from "./runtime.js"

export const VM_VERSION = "2.0.0"

export const VM_ARCHITECTURE =
  "Zisuay-REGVM"

export const VM_CHUNK_NAME =
  "Zisuay"

export const VM_WATERMARK =
  "zis_obfuscator"

export function createVMProgram(
  bytecode,
  options = {}
) {
  return {
    magic: "ZISUAY",
    version: 2,
    architecture:
      VM_ARCHITECTURE,

    chunkName:
      options.chunkName ||
      VM_CHUNK_NAME,

    watermark:
      options.watermark ||
      VM_WATERMARK,

    flags: {
      virtualization: true,
      registerVM: true,
      customBytecode: true,
      controlFlow: true,
      constantHiding:
        options.constantHiding !== false,
      opaquePredicates:
        options.opaquePredicates !== false,
      deadCode:
        options.deadCode !== false
    },

    ...bytecode
  }
}

export function isZisuayVM(
  value
) {
  return !!(
    value &&
    typeof value === "object" &&
    (
      value.magic === "ZISUAY" ||
      value.architecture ===
        VM_ARCHITECTURE
    )
  )
}

export default {
  VM_VERSION,
  VM_ARCHITECTURE,
  VM_CHUNK_NAME,
  VM_WATERMARK,
  createVMProgram,
  isZisuayVM
}
