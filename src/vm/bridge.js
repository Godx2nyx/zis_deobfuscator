import { VMState } from "./state.js"
import { createVMExecutor } from "./executor.js"

export class VMBridge {
  constructor(options = {}) {
    this.options = { ...options }
    this.executor = options.executor ?? createVMExecutor(options)
  }

  createState(context = {}) {
    return new VMState({
      registers: context.registers ?? 256,
      stackSize: context.stackSize ?? 1024,
      globals: context.globals ?? {}
    })
  }

  createContext(context = {}) {
    return {
      globals: context.globals ?? {},
      functions: context.functions ?? {},
      environment: context.environment ?? {},
      state: context.state ?? this.createState(context)
    }
  }

  execute(program, context = {}) {
    const vmContext = this.createContext(context)
    return this.executor.execute(program, vmContext)
  }

  run(program, context = {}) {
    return this.execute(program, context)
  }

  call(program, args = [], context = {}) {
    const vmContext = this.createContext(context)
    vmContext.args = Array.isArray(args) ? args : [args]

    const result = this.executor.execute(program, vmContext)

    return result?.value
  }

  getGlobal(state, name) {
    if (!state) return undefined

    if (typeof state.getGlobal === "function") {
      return state.getGlobal(name)
    }

    return state.globals?.[name]
  }

  setGlobal(state, name, value) {
    if (!state) return value

    if (typeof state.setGlobal === "function") {
      state.setGlobal(name, value)
    } else {
      state.globals ??= {}
      state.globals[name] = value
    }

    return value
  }

  snapshot(state) {
    if (typeof state?.snapshot === "function") {
      return state.snapshot()
    }

    return null
  }

  restore(state, snapshot) {
    if (typeof state?.restore === "function") {
      state.restore(snapshot)
    }

    return state
  }
}

export function createVMBridge(options = {}) {
  return new VMBridge(options)
}

export default VMBridge
