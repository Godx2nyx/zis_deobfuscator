const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

export function bytesToHex(bytes) {
  let output = ""

  for (const byte of bytes) {
    output += (byte & 0xFF).toString(16).padStart(2, "0")
  }

  return output
}

export function hexToBytes(hex) {
  const value = String(hex).replace(/[^0-9a-f]/gi, "")
  const length = Math.floor(value.length / 2)
  const output = new Uint8Array(length)

  for (let i = 0; i < length; i++) {
    output[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16)
  }

  return output
}

export function bytesToBase64(bytes) {
  let output = ""

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0

    const value = (a << 16) | (b << 8) | c

    output += BASE64[(value >>> 18) & 63]
    output += BASE64[(value >>> 12) & 63]
    output += i + 1 < bytes.length
      ? BASE64[(value >>> 6) & 63]
      : "="
    output += i + 2 < bytes.length
      ? BASE64[value & 63]
      : "="
  }

  return output
}

export function base64ToBytes(input) {
  const value = String(input).replace(/[^A-Za-z0-9+/=]/g, "")
  const output = []

  for (let i = 0; i < value.length; i += 4) {
    const a = BASE64.indexOf(value[i])
    const b = BASE64.indexOf(value[i + 1])
    const c = value[i + 2] === "=" ? 0 : BASE64.indexOf(value[i + 2])
    const d = value[i + 3] === "=" ? 0 : BASE64.indexOf(value[i + 3])

    if (a < 0 || b < 0) {
      continue
    }

    const number = (a << 18) | (b << 12) | (c << 6) | d

    output.push((number >>> 16) & 0xFF)

    if (value[i + 2] !== "=") {
      output.push((number >>> 8) & 0xFF)
    }

    if (value[i + 3] !== "=") {
      output.push(number & 0xFF)
    }
  }

  return new Uint8Array(output)
}

export function utf8Encode(value) {
  return new TextEncoder().encode(String(value))
}

export function utf8Decode(bytes) {
  return new TextDecoder().decode(bytes)
}

export function xorBytes(bytes, key) {
  const source = bytes instanceof Uint8Array
    ? bytes
    : Uint8Array.from(bytes)

  const output = new Uint8Array(source.length)

  if (typeof key === "number") {
    const k = key & 0xFF

    for (let i = 0; i < source.length; i++) {
      output[i] = source[i] ^ k
    }

    return output
  }

  const keyBytes = key instanceof Uint8Array
    ? key
    : utf8Encode(key)

  if (keyBytes.length === 0) {
    return source.slice()
  }

  for (let i = 0; i < source.length; i++) {
    output[i] = source[i] ^ keyBytes[i % keyBytes.length]
  }

  return output
}

export function rotateBytes(bytes, amount) {
  const source = bytes instanceof Uint8Array
    ? bytes
    : Uint8Array.from(bytes)

  const output = new Uint8Array(source.length)

  if (source.length === 0) {
    return output
  }

  const shift = ((amount % source.length) + source.length) % source.length

  for (let i = 0; i < source.length; i++) {
    output[(i + shift) % source.length] = source[i]
  }

  return output
}

export function unrotateBytes(bytes, amount) {
  return rotateBytes(bytes, -amount)
}

export function encodeInteger(value) {
  let number = Number(value)

  if (!Number.isFinite(number)) {
    throw new TypeError("Value must be finite")
  }

  number = Math.trunc(number)

  let encoded = ""

  do {
    let byte = number & 0x7F
    number = Math.floor(number / 128)

    if (number !== 0) {
      byte |= 0x80
    }

    encoded += String.fromCharCode(byte)
  } while (number !== 0)

  return encoded
}

export function decodeInteger(value, offset = 0) {
  let result = 0
  let shift = 0
  let position = offset

  while (position < value.length) {
    const byte = value.charCodeAt(position++) & 0xFF

    result += (byte & 0x7F) * 2 ** shift

    if ((byte & 0x80) === 0) {
      break
    }

    shift += 7

    if (shift > 53) {
      throw new RangeError("Encoded integer is too large")
    }
  }

  return {
    value: result,
    offset: position
  }
}

export function encodeVarUint(value) {
  let number = Number(value)

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new TypeError("Value must be a safe unsigned integer")
  }

  const output = []

  do {
    let byte = number % 128
    number = Math.floor(number / 128)

    if (number !== 0) {
      byte |= 0x80
    }

    output.push(byte)
  } while (number !== 0)

  return Uint8Array.from(output)
}

export function decodeVarUint(bytes, offset = 0) {
  let value = 0
  let shift = 0
  let position = offset

  while (position < bytes.length) {
    const byte = bytes[position++]

    value += (byte & 0x7F) * 2 ** shift

    if ((byte & 0x80) === 0) {
      return {
        value,
        offset: position
      }
    }

    shift += 7

    if (shift > 49) {
      throw new RangeError("VarUint is too large")
    }
  }

  throw new RangeError("Unexpected end of VarUint")
}

export function packBytes(bytes) {
  const source = bytes instanceof Uint8Array
    ? bytes
    : Uint8Array.from(bytes)

  return bytesToBase64(source)
}

export function unpackBytes(value) {
  return base64ToBytes(value)
}

export function encodeString(value) {
  return bytesToBase64(utf8Encode(value))
}

export function decodeString(value) {
  return utf8Decode(base64ToBytes(value))
}

export function obfuscateBytes(bytes, key = 0xA7) {
  const source = bytes instanceof Uint8Array
    ? bytes
    : Uint8Array.from(bytes)

  const output = new Uint8Array(source.length)

  for (let i = 0; i < source.length; i++) {
    const positionKey = Math.imul(i + 1, 0x45D9F3B) >>> 0

    output[i] =
      source[i] ^
      (key & 0xFF) ^
      (positionKey & 0xFF)
  }

  return output
}

export function deobfuscateBytes(bytes, key = 0xA7) {
  return obfuscateBytes(bytes, key)
}

export default {
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  utf8Encode,
  utf8Decode,
  xorBytes,
  rotateBytes,
  unrotateBytes,
  encodeInteger,
  decodeInteger,
  encodeVarUint,
  decodeVarUint,
  packBytes,
  unpackBytes,
  encodeString,
  decodeString,
  obfuscateBytes,
  deobfuscateBytes
      }
