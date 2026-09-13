export class VMMemory {
  constructor(options = {}) {
    this.size = options.size ?? 4096
    this.values = new Array(this.size)
    this.free = new Set()

    for (let i = 0; i < this.size; i++) {
      this.free.add(i)
    }
  }

  allocate(value = undefined) {
    const iterator = this.free.values()
    const address = iterator.next().value

    if (address === undefined) {
      throw new Error("VM memory exhausted")
    }

    this.free.delete(address)
    this.values[address] = value

    return address
  }

  allocateMany(values = []) {
    const addresses = []

    for (const value of values) {
      addresses.push(this.allocate(value))
    }

    return addresses
  }

  read(address) {
    this.validate(address)
    return this.values[address]
  }

  write(address, value) {
    this.validate(address)

    if (this.free.has(address)) {
      this.free.delete(address)
    }

    this.values[address] = value
    return value
  }

  release(address) {
    this.validate(address)

    this.values[address] = undefined
    this.free.add(address)
  }

  clone(address) {
    return this.read(address)
  }

  clear() {
    this.values.fill(undefined)
    this.free.clear()

    for (let i = 0; i < this.size; i++) {
      this.free.add(i)
    }
  }

  used() {
    return this.size - this.free.size
  }

  available() {
    return this.free.size
  }

  validate(address) {
    if (
      !Number.isInteger(address) ||
      address < 0 ||
      address >= this.size
    ) {
      throw new RangeError(`Invalid VM memory address: ${address}`)
    }
  }

  snapshot() {
    return {
      size: this.size,
      values: this.values.slice(),
      free: [...this.free]
    }
  }

  restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.values)) {
      throw new TypeError("Invalid VM memory snapshot")
    }

    this.size = snapshot.size
    this.values = snapshot.values.slice()
    this.free = new Set(snapshot.free ?? [])

    return this
  }

  export() {
    return {
      size: this.size,
      used: this.used(),
      available: this.available(),
      values: this.values.slice()
    }
  }
}

export function createVMMemory(options = {}) {
  return new VMMemory(options)
}

export default VMMemory
