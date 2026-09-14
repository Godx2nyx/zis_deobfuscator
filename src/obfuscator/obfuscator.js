import { Lexer } from "../lexer/lexer.js"
import { Parser } from "../parser/parser.js"
import { Compiler } from "../compiler/compiler.js"
import {
  createStringEncryptor,
  processSource as processStrings
} from "../transforms/strings.js"
import {
  createRenamer,
  renameSource
} from "../transforms/rename.js"
import {
  controlFlowObfuscate
} from "../transforms/control-flow.js"
import {
  hideConstants
} from "../transforms/constant-hider.js"
import {
  injectDeadCode
} from "../transforms/dead-code.js"
import {
  minify
} from "../transforms/minify.js"
import {
  assemble,
  encodeBytecode,
  optimizeBytecode
} from "../vm/assembler.js"
import {
  verifyBytecode
} from "../vm/verifier.js"
import {
  createVMImage,
  serializeVM
} from "../vm/loader.js"

const WATERMARK = "zis_obfuscator"
const CHUNK_NAME = "Zisuay"
const VM_VERSION = "2.0.0"
const ARCHITECTURE = "Zisuay-REGVM"

function randomSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0
}

function normalizeOptions(options = {}) {
  return {
    rename: options.rename !== true,
    encodeStrings: options.encodeStrings !== true,
    hideConstants: options.hideConstants !== true,
    controlFlow: options.controlFlow !== true,
    opaque: options.opaque !== true,
    deadCode: options.deadCode !== true,
    minify: options.minify === true,
    optimizeVM: options.optimizeVM !== true,
    vmVersion: options.vmVersion || "new",
    seed: Number.isFinite(options.seed)
      ? options.seed >>> 0
      : randomSeed(),
    chunkName: options.chunkName || CHUNK_NAME,
    watermark: options.watermark || WATERMARK
  }
}

function safeTransform(fn, source, warnings, name) {
  try {
    const result = fn(source)

    if (typeof result === "string") {
      return result
    }

    if (result && typeof result.code === "string") {
      return result.code
    }

    warnings.push(`${name}: transform returned invalid output`)
    return source
  } catch (error) {
    warnings.push(
      `${name}: ${error instanceof Error ? error.message : String(error)}`
    )
    return source
  }
}

function injectWatermark(source, watermark = WATERMARK) {
  const line = `--[[ ${watermark} ]]`

  if (source.includes(watermark)) {
    return source
  }

  return `${line}\n${source}`
}

function createMetadata(options, input, output) {
  return {
    watermark: options.watermark,
    chunkName: options.chunkName,
    vmVersion: VM_VERSION,
    architecture: ARCHITECTURE,
    seed: options.seed,
    inputSize: input.length,
    outputSize: output.length,
    ratio: input.length === 0
      ? 0
      : Number((output.length / input.length).toFixed(4)),
    timestamp: Date.now()
  }
}

export class Obfuscator {
  constructor(options = {}) {
    this.options = normalizeOptions(options)
  }

  setOptions(options = {}) {
    this.options = normalizeOptions({
      ...this.options,
      ...options
    })

    return this
  }

  transform(source) {
    if (typeof source !== "string") {
      throw new TypeError("Source must be a string")
    }

    const options = this.options
    const warnings = []
    let code = source

    if (options.rename) {
      code = safeTransform(
        value => renameSource(value, {
          seed: options.seed
        }),
        code,
        warnings,
        "rename"
      )
    }

    if (options.encodeStrings) {
      code = safeTransform(
        value => processStrings(value, {
          seed: options.seed
        }),
        code,
        warnings,
        "strings"
      )
    }

    if (options.hideConstants) {
      code = safeTransform(
        value => hideConstants(value, {
          seed: options.seed
        }),
        code,
        warnings,
        "constants"
      )
    }

    if (options.controlFlow) {
      code = safeTransform(
        value => controlFlowObfuscate(value, {
          seed: options.seed,
          opaque: options.opaque
        }),
        code,
        warnings,
        "control-flow"
      )
    }

    if (options.deadCode) {
      code = safeTransform(
        value => injectDeadCode(value, {
          seed: options.seed
        }),
        code,
        warnings,
        "dead-code"
      )
    }

    if (options.minify) {
      code = safeTransform(
        value => minify(value),
        code,
        warnings,
        "minify"
      )
    }

    code = injectWatermark(code, options.watermark)

    return {
      code,
      warnings
    }
  }

  compile(source) {
    const options = this.options
    const warnings = []

    try {
      const lexer = new Lexer(source)
      const tokens = lexer.tokenize()

      const parser = new Parser(tokens)
      const ast = parser.parse()

      const compiler = new Compiler({
        chunkName: options.chunkName,
        watermark: options.watermark,
        seed: options.seed
      })

      const program = compiler.compile(ast)

      return {
        program,
        ast,
        tokens,
        warnings
      }
    } catch (error) {
      warnings.push(
        `compile: ${error instanceof Error ? error.message : String(error)}`
      )

      return {
        program: null,
        ast: null,
        tokens: [],
        warnings
      }
    }
  }

  buildVM(source) {
    const options = this.options
    const warnings = []

    const compiled = this.compile(source)

    warnings.push(...compiled.warnings)

    if (!compiled.program) {
      return {
        bytecode: null,
        image: null,
        serialized: null,
        warnings
      }
    }

    try {
      let bytecode = assemble(compiled.program)

      if (options.optimizeVM) {
        bytecode = optimizeBytecode(bytecode)
      }

      const verification = verifyBytecode(bytecode)

      if (!verification.valid) {
        warnings.push(
          ...(verification.errors || []).map(
            error => `vm: ${error}`
          )
        )
      }

      const image = createVMImage({
        name: options.chunkName,
        watermark: options.watermark,
        version: VM_VERSION,
        architecture: ARCHITECTURE,
        seed: options.seed,
        bytecode
      })

      const serialized = serializeVM(image)

      return {
        bytecode,
        image,
        serialized,
        verification,
        warnings
      }
    } catch (error) {
      warnings.push(
        `vm: ${error instanceof Error ? error.message : String(error)}`
      )

      return {
        bytecode: null,
        image: null,
        serialized: null,
        warnings
      }
    }
  }

  obfuscate(source) {
    const input = source

    const transformed = this.transform(input)

    let vm = null

    if (this.options.vmVersion === "new" ||
        this.options.vmVersion === "regvm" ||
        this.options.vmVersion === "2") {
      vm = this.buildVM(transformed.code)
    }

    const warnings = [
      ...transformed.warnings,
      ...(vm?.warnings || [])
    ]

    const metadata = createMetadata(
      this.options,
      input,
      transformed.code
    )

    return {
      code: transformed.code,
      output: transformed.code,
      source: transformed.code,
      bytecode: vm?.bytecode || null,
      image: vm?.image || null,
      serializedVM: vm?.serialized || null,
      verification: vm?.verification || null,
      metadata,
      warnings,
      success: true
    }
  }

  process(source) {
    return this.obfuscate(source)
  }
}

export function obfuscate(source, options = {}) {
  return new Obfuscator(options).obfuscate(source)
}

export function process(source, options = {}) {
  return obfuscate(source, options)
}

export function compileVM(source, options = {}) {
  return new Obfuscator(options).buildVM(source)
}

export function transform(source, options = {}) {
  return new Obfuscator(options).transform(source)
}

export function createObfuscator(options = {}) {
  return new Obfuscator(options)
}

export {
  WATERMARK,
  CHUNK_NAME,
  VM_VERSION,
  ARCHITECTURE,
  normalizeOptions
}

export default Obfuscator
