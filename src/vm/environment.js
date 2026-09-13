export class VMEnvironment {
  constructor(options = {}) {
    this.globals = Object.create(null)
    this.builtins = Object.create(null)
    this.modules = Object.create(null)

    if (options.globals) {
      this.setGlobals(options.globals)
    }

    if (options.builtins) {
      this.setBuiltins(options.builtins)
    }

    if (options.modules) {
      this.setModules(options.modules)
    }
  }

  has(name) {
    return (
      Object.prototype.hasOwnProperty.call(this.globals, name) ||
      Object.prototype.hasOwnProperty.call(this.builtins, name)
    )
  }

  get(name) {
    if (Object.prototype.hasOwnProperty.call(this.globals, name)) {
      return this.globals[name]
    }

    if (Object.prototype.hasOwnProperty.call(this.builtins, name)) {
      return this.builtins[name]
    }

    return undefined
  }

  set(name, value) {
    this.globals[name] = value
    return value
  }

  delete(name) {
    delete this.globals[name]
  }

  setGlobals(values) {
    for (const [name, value] of Object.entries(values)) {
      this.globals[name] = value
    }

    return this
  }

  setBuiltins(values) {
    for (const [name, value] of Object.entries(values)) {
      this.builtins[name] = value
    }

    return this
  }

  setModules(values) {
    for (const [name, value] of Object.entries(values)) {
      this.modules[name] = value
    }

    return this
  }

  getModule(name) {
    return this.modules[name]
  }

  defineBuiltin(name, value) {
    this.builtins[name] = value
    return value
  }

  defineModule(name, value) {
    this.modules[name] = value
    return value
  }

  createChild() {
    return new VMEnvironment({
      globals: { ...this.globals },
      builtins: this.builtins,
      modules: this.modules
    })
  }

  export() {
    return {
      globals: { ...this.globals },
      builtins: { ...this.builtins },
      modules: { ...this.modules }
    }
  }

  snapshot() {
    return this.export()
  }

  restore(snapshot) {
    if (!snapshot) {
      throw new TypeError("Invalid VM environment snapshot")
    }

    this.globals = Object.assign(
      Object.create(null),
      snapshot.globals ?? {}
    )

    this.builtins = Object.assign(
      Object.create(null),
      snapshot.builtins ?? {}
    )

    this.modules = Object.assign(
      Object.create(null),
      snapshot.modules ?? {}
    )

    return this
  }
}

export function createVMEnvironment(options = {}) {
  return new VMEnvironment(options)
}

export default VMEnvironment
