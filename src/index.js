export * from "./lexer/token.js"
export * from "./lexer/lexer.js"

export * from "./ast/types.js"
export * from "./parser/parser.js"

export * from "./compiler/compiler.js"

export * from "./vm/index.js"

export * from "./transforms/index.js"

export * from "./obfuscator/index.js"

export {
  Obfuscator,
  obfuscate,
  process,
  compileVM,
  transform,
  createObfuscator,
  WATERMARK,
  CHUNK_NAME,
  VM_VERSION,
  ARCHITECTURE,
  normalizeOptions
} from "./obfuscator/obfuscator.js"

export const ZIS_VERSION = "0.1.0"
export const ZIS_NAME = "Zis Luau Obfuscate Premium"
export const ZIS_WATERMARK = "zis_obfuscator"
export const ZIS_CHUNK_NAME = "Zisuay"

export const ZIS_FEATURES = Object.freeze([
  "Virtualization-Based Obfuscation",
  "Custom Virtual Machine",
  "Custom Bytecode",
  "Control Flow Obfuscation",
  "Opaque Predicates",
  "Dead Code Injection",
  "Constant Hiding",
  "String Encryption",
  "Variable Renaming",
  "Minification"
])

export function getInfo() {
  return {
    name: ZIS_NAME,
    version: ZIS_VERSION,
    watermark: ZIS_WATERMARK,
    chunkName: ZIS_CHUNK_NAME,
    vm: "Zisuay-REGVM",
    vmVersion: "2.0.0",
    features: [...ZIS_FEATURES]
  }
}

export default {
  name: ZIS_NAME,
  version: ZIS_VERSION,
  watermark: ZIS_WATERMARK,
  chunkName: ZIS_CHUNK_NAME,
  vm: "Zisuay-REGVM",
  vmVersion: "2.0.0",
  features: [...ZIS_FEATURES],
  getInfo,
  obfuscate,
  process,
  compileVM,
  transform,
  createObfuscator
}
