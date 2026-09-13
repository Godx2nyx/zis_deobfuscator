export function isUint8Array(value) {
  return value instanceof Uint8Array
}

export function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength
    )
  }

  if (Array.isArray(value)) {
    return Uint8Array.from(value)
  }

  if (typeof value === "string") {
    return new TextEncoder().encode(value)
  }

  throw new TypeError("Unsupported byte value")
}

export function concatBytes(...values) {
  const arrays = values.map(toUint8Array)

  let length = 0

  for (const array of arrays) {
    length += array.length
  }

  const output = new Uint8Array(length)

  let offset = 0

  for (const array of arrays) {
    output.set(array, offset)
    offset += array.length
  }

  return output
}

export function sliceBytes(bytes, start = 0, end) {
  const source = toUint8Array(bytes)

  return source.slice(start, end)
}

export function equalBytes(a, b) {
  const left = toUint8Array(a)
  const right = toUint8Array(b)

  if (left.length !== right.length) {
    return false
  }

  let result = 0

  for (let i = 0; i < left.length; i++) {
    result |= left[i] ^ right[i]
  }

  return result === 0
}

export function fillBytes(length, value = 0) {
  const output = new Uint8Array(length)

  output.fill(value & 0xFF)

  return output
}

export function reverseBytes(bytes) {
  const source = toUint8Array(bytes)
  const output = new Uint8Array(source.length)

  for (let i = 0; i < source.length; i++) {
    output[i] = source[source.length - i - 1]
  }

  return output
}

export function rotateLeftBytes(bytes, amount = 1) {
  const source = toUint8Array(bytes)

  if (source.length === 0) {
    return new Uint8Array()
  }

  const shift =
    ((amount % source.length) + source.length) %
    source.length

  const output = new Uint8Array(source.length)

  for (let i = 0; i < source.length; i++) {
    output[i] =
      source[(i + shift) % source.length]
  }

  return output
}

export function rotateRightBytes(bytes, amount = 1) {
  return rotateLeftBytes(
    bytes,
    -amount
  )
}

export function xorByteArrays(a, b) {
  const left = toUint8Array(a)
  const right = toUint8Array(b)

  if (right.length === 0) {
    return left.slice()
  }

  const output = new Uint8Array(left.length)

  for (let i = 0; i < left.length; i++) {
    output[i] =
      left[i] ^
      right[i % right.length]
  }

  return output
}

export function addBytes(a, b) {
  const left = toUint8Array(a)
  const right = toUint8Array(b)

  const length = Math.max(
    left.length,
    right.length
  )

  const output = new Uint8Array(length)

  for (let i = 0; i < length; i++) {
    output[i] =
      ((left[i] || 0) +
        (right[i] || 0)) &
      0xFF
  }

  return output
}

export function subtractBytes(a, b) {
  const left = toUint8Array(a)
  const right = toUint8Array(b)

  const length = Math.max(
    left.length,
    right.length
  )

  const output = new Uint8Array(length)

  for (let i = 0; i < length; i++) {
    output[i] =
      ((left[i] || 0) -
        (right[i] || 0)) &
      0xFF
  }

  return output
}

export function mapBytes(bytes, callback) {
  const source = toUint8Array(bytes)
  const output = new Uint8Array(source.length)

  for (let i = 0; i < source.length; i++) {
    output[i] =
      callback(source[i], i) &
      0xFF
  }

  return output
}

export function chunkBytes(bytes, size = 16) {
  const source = toUint8Array(bytes)

  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(
      "Chunk size must be a positive integer"
    )
  }

  const chunks = []

  for (let i = 0; i < source.length; i += size) {
    chunks.push(
      source.slice(
        i,
        Math.min(
          i + size,
          source.length
        )
      )
    )
  }

  return chunks
}

export function mergeChunks(chunks) {
  return concatBytes(...chunks)
}

export function readUint8(bytes, offset = 0) {
  const source = toUint8Array(bytes)

  if (
    offset < 0 ||
    offset >= source.length
  ) {
    throw new RangeError(
      "Byte offset out of range"
    )
  }

  return source[offset]
}

export function readUint16(
  bytes,
  offset = 0,
  littleEndian = true
) {
  const source = toUint8Array(bytes)

  if (offset < 0 || offset + 2 > source.length) {
    throw new RangeError(
      "Uint16 offset out of range"
    )
  }

  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  )

  return view.getUint16(
    offset,
    littleEndian
  )
}

export function readUint32(
  bytes,
  offset = 0,
  littleEndian = true
) {
  const source = toUint8Array(bytes)

  if (offset < 0 || offset + 4 > source.length) {
    throw new RangeError(
      "Uint32 offset out of range"
    )
  }

  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  )

  return view.getUint32(
    offset,
    littleEndian
  )
}

export function writeUint8(
  bytes,
  value,
  offset = 0
) {
  const source = toUint8Array(bytes)

  if (offset < 0 || offset >= source.length) {
    throw new RangeError(
      "Byte offset out of range"
    )
  }

  source[offset] =
    value & 0xFF

  return source
}

export function writeUint16(
  bytes,
  value,
  offset = 0,
  littleEndian = true
) {
  const source = toUint8Array(bytes)

  if (offset < 0 || offset + 2 > source.length) {
    throw new RangeError(
      "Uint16 offset out of range"
    )
  }

  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  )

  view.setUint16(
    offset,
    value & 0xFFFF,
    littleEndian
  )

  return source
}

export function writeUint32(
  bytes,
  value,
  offset = 0,
  littleEndian = true
) {
  const source = toUint8Array(bytes)

  if (offset < 0 || offset + 4 > source.length) {
    throw new RangeError(
      "Uint32 offset out of range"
    )
  }

  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  )

  view.setUint32(
    offset,
    value >>> 0,
    littleEndian
  )

  return source
}

export function bytesToArray(bytes) {
  return Array.from(
    toUint8Array(bytes)
  )
}

export function bytesToBinary(bytes) {
  return Array.from(
    toUint8Array(bytes)
  )
    .map(
      value =>
        value
          .toString(2)
          .padStart(8, "0")
    )
    .join("")
}

export function binaryToBytes(binary) {
  const value = String(binary)
    .replace(/[^01]/g, "")

  const length =
    Math.floor(value.length / 8)

  const output = new Uint8Array(length)

  for (let i = 0; i < length; i++) {
    output[i] = parseInt(
      value.slice(
        i * 8,
        i * 8 + 8
      ),
      2
    )
  }

  return output
}

export function zeroBytes(bytes) {
  const source = toUint8Array(bytes)

  source.fill(0)

  return source
}

export function secureClear(bytes) {
  if (
    bytes instanceof Uint8Array ||
    bytes instanceof Uint8ClampedArray ||
    bytes instanceof Int8Array
  ) {
    bytes.fill(0)
    return true
  }

  return false
}

export default {
  isUint8Array,
  toUint8Array,
  concatBytes,
  sliceBytes,
  equalBytes,
  fillBytes,
  reverseBytes,
  rotateLeftBytes,
  rotateRightBytes,
  xorByteArrays,
  addBytes,
  subtractBytes,
  mapBytes,
  chunkBytes,
  mergeChunks,
  readUint8,
  readUint16,
  readUint32,
  writeUint8,
  writeUint16,
  writeUint32,
  bytesToArray,
  bytesToBinary,
  binaryToBytes,
  zeroBytes,
  secureClear
}
