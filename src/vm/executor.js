import { OPCODES, opcodeName } from "./opcodes.js"
import { createVMHandlers } from "./handlers.js"
import { VMState } from "./state.js"

export class VMExecutor {
  constructor(options = {}) {
    this.options = {
      maxSteps: options.maxSteps ?? 1000000,
      strict: options.strict ?? true,
      ...options
    }

    this.handlers = options.handlers ?? createVMHandlers(options)
  }

  execute(program, context = {}) {
    const instructions = program?.instructions ?? program?.code ?? []
    const constants = program?.constants ?? []
    const state = context.state instanceof VMState
      ? context.state
      : new VMState({
          registers: program?.registers ?? 256,
          stackSize: program?.stackSize ?? 1024,
          globals: context.globals ?? program?.globals ?? {}
        })

    state.constants = constants
    state.instructions = instructions
    state.ip = 0
    state.halted = false
    state.returnValue = undefined

    let steps = 0

    while (!state.halted && state.ip < instructions.length) {
      if (++steps > this.options.maxSteps) {
        throw new Error("VM execution step limit exceeded")
      }

      const instruction = instructions[state.ip]

      if (!instruction) {
        if (this.options.strict) {
          throw new Error(`Invalid instruction at ${state.ip}`)
        }

        state.ip++
        continue
      }

      const currentIp = state.ip

      try {
        this.executeInstruction(state, instruction)
      } catch (error) {
        error.message = `VM error at instruction ${currentIp}: ${error.message}`
        throw error
      }

      if (!state.halted && state.ip === currentIp) {
        state.ip++
      }
    }

    return {
      value: state.returnValue,
      state,
      steps
    }
  }

  executeInstruction(state, instruction) {
    const opcode = this.resolveOpcode(instruction)

    const handler =
      this.handlers.get?.(opcode) ??
      this.handlers.handlers?.get?.(opcode) ??
      this.handlers[opcode] ??
      this.handlers[opcodeName(opcode)]

    if (typeof handler !== "function") {
      throw new Error(`Missing VM handler for opcode ${opcodeName(opcode)}`)
    }

    const result = handler(state, instruction)

    if (result && typeof result === "object") {
      if (result.ip !== undefined) {
        state.ip = result.ip
      }

      if (result.halted !== undefined) {
        state.halted = result.halted
      }

      if ("value" in result) {
        state.returnValue = result.value
      }
    }

    return result
  }

  resolveOpcode(instruction) {
    if (typeof instruction === "number") {
      return instruction
    }

    if (typeof instruction.opcode === "number") {
      return instruction.opcode
    }

    if (typeof instruction.op === "number") {
      return instruction.op
    }

    if (typeof instruction.opcode === "string") {
      return this.resolveOpcodeName(instruction.opcode)
    }

    if (typeof instruction.op === "string") {
      return this.resolveOpcodeName(instruction.op)
    }

    throw new Error("Instruction has no valid opcode")
  }

  resolveOpcodeName(name) {
    const normalized = String(name).toUpperCase()

    if (OPCODES[normalized] !== undefined) {
      return OPCODES[normalized]
    }

    const numeric = Object.entries(OPCODES).find(
      ([key]) => key.toUpperCase() === normalized
    )

    if (numeric) {
      return numeric[1]
    }

    throw new Error(`Unknown opcode: ${name}`)
  }

  run(program, context = {}) {
    return this.execute(program, context)
  }
}

export function createVMExecutor(options = {}) {
  return new VMExecutor(options)
}

export function executeVM(program, context = {}, options = {}) {
  return new VMExecutor(options).execute(program, context)
}

export default VMExecutor
