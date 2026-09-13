import {
  normalizeOptions
} from "./obfuscator.js"

import {
  createRandom
} from "../utils/random.js"

import {
  createCryptoContext
} from "../utils/crypto.js"

const STAGES = Object.freeze([
  "rename",
  "strings",
  "constants",
  "controlFlow",
  "opaque",
  "deadCode",
  "minify"
])

export class ObfuscationPipeline {
  constructor(options = {}) {
    this.options = normalizeOptions(options)

    this.random =
      createRandom(
        this.options.seed
      )

    this.crypto =
      createCryptoContext(
        this.options.seed,
        {
          watermark:
            this.options.watermark,
          chunkName:
            this.options.chunkName
        }
      )

    this.stages = []
    this.history = []
  }

  add(name, transform, options = {}) {
    if (typeof transform !== "function") {
      throw new TypeError(
        "Pipeline transform must be a function"
      )
    }

    this.stages.push({
      name,
      transform,
      enabled:
        options.enabled !== false,
      priority:
        Number.isFinite(options.priority)
          ? options.priority
          : this.stages.length
    })

    this.stages.sort(
      (a, b) =>
        a.priority - b.priority
    )

    return this
  }

  remove(name) {
    this.stages =
      this.stages.filter(
        stage =>
          stage.name !== name
      )

    return this
  }

  enable(name) {
    const stage =
      this.stages.find(
        item =>
          item.name === name
      )

    if (stage) {
      stage.enabled = true
    }

    return this
  }

  disable(name) {
    const stage =
      this.stages.find(
        item =>
          item.name === name
      )

    if (stage) {
      stage.enabled = false
    }

    return this
  }

  clear() {
    this.stages = []
    this.history = []

    return this
  }

  execute(source, context = {}) {
    let code = String(source)

    const warnings = []
    const history = []

    const runtimeContext = {
      ...context,

      options:
        this.options,

      random:
        this.random,

      crypto:
        this.crypto,

      seed:
        this.options.seed,

      watermark:
        this.options.watermark,

      chunkName:
        this.options.chunkName
    }

    for (const stage of this.stages) {
      if (!stage.enabled) {
        continue
      }

      const before =
        code.length

      const started =
        Date.now()

      try {
        const result =
          stage.transform(
            code,
            runtimeContext
          )

        if (
          typeof result === "string"
        ) {
          code = result
        } else if (
          result &&
          typeof result.code === "string"
        ) {
          code = result.code

          if (
            Array.isArray(
              result.warnings
            )
          ) {
            warnings.push(
              ...result.warnings
            )
          }
        } else {
          warnings.push(
            `${stage.name}: invalid transform result`
          )
        }

        history.push({
          stage: stage.name,
          before,
          after: code.length,
          delta:
            code.length - before,
          duration:
            Date.now() - started
        })
      } catch (error) {
        warnings.push(
          `${stage.name}: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        )

        history.push({
          stage: stage.name,
          before,
          after: code.length,
          delta:
            code.length - before,
          duration:
            Date.now() - started,
          failed: true
        })
      }
    }

    this.history = history

    return {
      code,
      warnings,
      history,
      stages:
        history.map(
          item => item.stage
        )
    }
  }

  inspect() {
    return this.stages.map(
      stage => ({
        name: stage.name,
        enabled: stage.enabled,
        priority: stage.priority
      })
    )
  }
}

export function createPipeline(options = {}) {
  return new ObfuscationPipeline(
    options
  )
}

export function runPipeline(
  source,
  stages = [],
  options = {}
) {
  const pipeline =
    new ObfuscationPipeline(
      options
    )

  for (
    let i = 0;
    i < stages.length;
    i++
  ) {
    const stage =
      stages[i]

    if (
      typeof stage === "function"
    ) {
      pipeline.add(
        `stage_${i}`,
        stage
      )
    } else if (
      stage &&
      typeof stage.transform === "function"
    ) {
      pipeline.add(
        stage.name ||
          `stage_${i}`,
        stage.transform,
        stage
      )
    }
  }

  return pipeline.execute(
    source
  )
}

export function getPipelineStages() {
  return [...STAGES]
}

export default ObfuscationPipeline
