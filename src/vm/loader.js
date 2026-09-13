import {
  OPCODE,
  isValidOpcode
} from "./opcodes.js"

import {
  verifyBytecode
} from "./verifier.js"

import {
  decodeBytecode
} from "./assembler.js"

const MAGIC = "ZISUAY"
const VERSION = 2

const isObject = value =>
  value !== null &&
  typeof value === "object"

const clone = value =>
  JSON.parse(JSON.stringify(value))

const normalizeInstruction = instruction => {
  if (
    typeof instruction === "number"
  ) {
    return {
      ...instruction
    }
  }

  if (
    !instruction ||
    typeof instruction !== "object"
  ) {
    throw new Error(
      "Invalid VM instruction"
    )
  }

  const opcode =
    instruction.opcode ??
    instruction.op ??
    instruction.name

  return {
    ...instruction,
    opcode
  }
}

const normalizePrototype = (
  prototype,
  fallback = {}
) => {
  if (
    !prototype ||
    typeof prototype !== "object"
  ) {
    throw new Error(
      "Invalid VM prototype"
    )
  }

  return {
    chunkName:
      prototype.chunkName ||
      fallback.chunkName ||
      "Zisuay",

    watermark:
      prototype.watermark ||
      fallback.watermark ||
      "zis_obfuscator",

    code:
      Array.isArray(prototype.code)
        ? prototype.code.map(
            normalizeInstruction
          )
        : [],

    constants:
      Array.isArray(
        prototype.constants
      )
        ? prototype.constants.slice()
        : [],

    prototypes:
      Array.isArray(
        prototype.prototypes
      )
        ? prototype.prototypes.map(
            child =>
              normalizePrototype(
                child,
                prototype
              )
          )
        : [],

    registerCount:
      prototype.registerCount ||
      16,

    upvalueCount:
      prototype.upvalueCount ||
      0,

    params:
      Array.isArray(prototype.params)
        ? prototype.params.slice()
        : [],

    vararg:
      !!prototype.vararg
  }
}

export class VMImage {
  constructor(image) {
    this.magic =
      image.magic || MAGIC

    this.version =
      image.version || VERSION

    this.architecture =
      image.architecture ||
      "Zisuay-REGVM"

    this.chunkName =
      image.chunkName ||
      "Zisuay"

    this.watermark =
      image.watermark ||
      "zis_obfuscator"

    this.flags =
      image.flags || {}

    this.entry =
      image.entry ||
      null

    this.code =
      Array.isArray(image.code)
        ? image.code
        : []

    this.constants =
      Array.isArray(image.constants)
        ? image.constants
        : []

    this.prototypes =
      Array.isArray(image.prototypes)
        ? image.prototypes
        : []

    this.metadata =
      image.metadata || {}

    this.signature =
      image.signature || null
  }

  toJSON() {
    return {
      magic: this.magic,
      version: this.version,
      architecture:
        this.architecture,
      chunkName:
        this.chunkName,
      watermark:
        this.watermark,
      flags:
        this.flags,
      entry:
        this.entry,
      code:
        this.code,
      constants:
        this.constants,
      prototypes:
        this.prototypes,
      metadata:
        this.metadata,
      signature:
        this.signature
    }
  }
}

export class VMLoader {
  constructor(options = {}) {
    this.strict =
      options.strict !== undefined
        ? !!options.strict
        : true

    this.verify =
      options.verify !== undefined
        ? !!options.verify
        : true

    this.maxCode =
      options.maxCode ||
      5_000_000

    this.maxConstants =
      options.maxConstants ||
      65_535

    this.maxPrototypes =
      options.maxPrototypes ||
      10_000

    this.expectedChunkName =
      options.chunkName ||
      "Zisuay"

    this.expectedWatermark =
      options.watermark ||
      "zis_obfuscator"
  }

  load(input) {
    const parsed =
      this.parseInput(input)

    const image =
      this.normalize(parsed)

    this.checkLimits(image)

    if (this.verify) {
      const result =
        verifyBytecode(
          image,
          {
            strict: this.strict
          }
        )

      if (!result.valid) {
        throw new Error(
          [
            "VM verification failed:",
            ...result.errors
          ].join("\n")
        )
      }

      image.metadata =
        {
          ...image.metadata,
          verification: {
            valid: true,
            warnings:
              result.warnings,
            stats:
              result.stats
          }
        }
    }

    return image
  }

  parseInput(input) {
    if (
      typeof input === "string"
    ) {
      const text =
        input.trim()

      if (!text) {
        throw new Error(
          "Empty VM image"
        )
      }

      try {
        return JSON.parse(text)
      } catch {
        throw new Error(
          "Invalid VM image JSON"
        )
      }
    }

    if (
      input instanceof Uint8Array
    ) {
      const text =
        new TextDecoder()
          .decode(input)

      return this.parseInput(text)
    }

    if (
      Buffer.isBuffer(input)
    ) {
      return this.parseInput(
        input.toString("utf8")
      )
    }

    if (isObject(input)) {
      return input
    }

    throw new Error(
      "Unsupported VM image input"
    )
  }

  normalize(source) {
    if (
      Array.isArray(source)
    ) {
      return new VMImage({
        magic: MAGIC,
        version: VERSION,
        architecture:
          "Zisuay-REGVM",
        chunkName:
          this.expectedChunkName,
        watermark:
          this.expectedWatermark,
        code:
          source
      })
    }

    const image =
      clone(source)

    if (
      image.magic &&
      image.magic !== MAGIC
    ) {
      throw new Error(
        `Invalid VM magic: ${image.magic}`
      )
    }

    if (
      image.version &&
      Number(image.version) >
        VERSION
    ) {
      throw new Error(
        `Unsupported VM version: ${image.version}`
      )
    }

    const normalized =
      new VMImage({
        ...image,

        magic:
          MAGIC,

        version:
          image.version ||
          VERSION,

        architecture:
          image.architecture ||
          "Zisuay-REGVM",

        chunkName:
          image.chunkName ||
          this.expectedChunkName,

        watermark:
          image.watermark ||
          this.expectedWatermark
      })

    normalized.code =
      normalized.code.map(
        normalizeInstruction
      )

    normalized.constants =
      normalized.constants.slice()

    normalized.prototypes =
      normalized.prototypes.map(
        prototype =>
          normalizePrototype(
            prototype,
            normalized
          )
      )

    if (
      normalized.entry &&
      typeof normalized.entry ===
        "object"
    ) {
      normalized.entry =
        normalizePrototype(
          normalized.entry,
          normalized
        )
    }

    return normalized
  }

  checkLimits(image) {
    if (
      image.code.length >
      this.maxCode
    ) {
      throw new Error(
        "VM code size limit exceeded"
      )
    }

    if (
      image.constants.length >
      this.maxConstants
    ) {
      throw new Error(
        "VM constant limit exceeded"
      )
    }

    if (
      image.prototypes.length >
      this.maxPrototypes
    ) {
      throw new Error(
        "VM prototype limit exceeded"
      )
    }

    const visited =
      new Set()

    const walk =
      prototype => {
        if (!prototype) return

        if (
          visited.has(prototype)
        ) {
          throw new Error(
            "Cyclic VM prototype detected"
          )
        }

        visited.add(prototype)

        if (
          prototype.code.length >
          this.maxCode
        ) {
          throw new Error(
            "VM prototype code limit exceeded"
          )
        }

        if (
          prototype.constants.length >
          this.maxConstants
        ) {
          throw new Error(
            "VM prototype constant limit exceeded"
          )
        }

        for (
          const child
          of prototype.prototypes
        ) {
          walk(child)
        }

        visited.delete(
          prototype
        )
      }

    if (
      image.entry
    ) {
      walk(image.entry)
    }

    for (
      const prototype
      of image.prototypes
    ) {
      walk(prototype)
    }
  }
}

export function loadVM(
  input,
  options = {}
) {
  return new VMLoader(
    options
  ).load(input)
}

export function createVMImage(
  bytecode,
  options = {}
) {
  const loader =
    new VMLoader({
      ...options,
      verify: false
    })

  const image =
    loader.normalize(
      bytecode
    )

  image.magic = MAGIC
  image.version =
    VERSION

  image.architecture =
    "Zisuay-REGVM"

  image.chunkName =
    options.chunkName ||
    "Zisuay"

  image.watermark =
    options.watermark ||
    "zis_obfuscator"

  return image
}

export function serializeVM(
  bytecode,
  options = {}
) {
  const image =
    createVMImage(
      bytecode,
      options
    )

  return JSON.stringify(
    image.toJSON()
  )
}

export function deserializeVM(
  source,
  options = {}
) {
  return loadVM(
    source,
    options
  )
}

export function isVMImage(value) {
  return (
    isObject(value) &&
    (
      value.magic === MAGIC ||
      value.architecture ===
        "Zisuay-REGVM"
    )
  )
}

export function getVMInfo(image) {
  const loaded =
    image instanceof VMImage
      ? image
      : createVMImage(
          image
        )

  return {
    magic:
      loaded.magic,

    version:
      loaded.version,

    architecture:
      loaded.architecture,

    chunkName:
      loaded.chunkName,

    watermark:
      loaded.watermark,

    instructions:
      loaded.code.length,

    constants:
      loaded.constants.length,

    prototypes:
      loaded.prototypes.length,

    flags:
      {
        ...loaded.flags
      },

    metadata:
      {
        ...loaded.metadata
      }
  }
}

export function decodeVMCode(
  input
) {
  const image =
    input instanceof VMImage
      ? input
      : createVMImage(
          input
        )

  if (
    image.code.every(
      value =>
        typeof value ===
        "number"
    )
  ) {
    return decodeBytecode(
      image.code
    )
  }

  return image.code
}

export {
  MAGIC,
  VERSION
}

export default VMLoader
