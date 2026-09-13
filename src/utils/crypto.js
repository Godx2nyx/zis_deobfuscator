import {
  utf8Encode,
  utf8Decode,
  bytesToBase64,
  base64ToBytes,
  xorBytes
} from "./encoding.js"

import {
  fnv1a,
  hashChain
} from "./hash.js"

import {
  Random
} from "./random.js"

const MASK32 = 0xFFFFFFFF

function u32(value) {
  return Number(value) >>> 0
}

function rotl(value, amount) {
  value = u32(value)
  amount &= 31

  return u32(
    (value << amount) |
    (value >>> (32 - amount))
  )
}

function rotr(value, amount) {
  value = u32(value)
  amount &= 31

  return u32(
    (value >>> amount) |
    (value << (32 - amount))
  )
}

function mix(value) {
  value = u32(value)

  value ^= value >>> 16
  value = Math.imul(value, 0x7FEB352D)
  value ^= value >>> 15
  value = Math.imul(value, 0x846CA68B)
  value ^= value >>> 16

  return u32(value)
}

function deriveKey(seed, salt = "") {
  return hashChain([
    u32(seed),
    salt,
    "zis_obfuscator",
    "Zisuay",
    "REGVM"
  ], seed)
}

function keystream(length, seed, salt = "") {
  const output = new Uint8Array(length)
  const random = new Random(
    deriveKey(seed, salt)
  )

  for (let i = 0; i < length; i++) {
    const word = random.uint32()

    output[i] =
      (word ^
        rotl(word, i & 31) ^
        Math.imul(i + 1, 0x9E3779B1)
      ) & 0xFF
  }

  return output
}

export function xorEncrypt(bytes, key) {
  return xorBytes(bytes, key)
}

export function xorDecrypt(bytes, key) {
  return xorBytes(bytes, key)
}

export function streamEncrypt(bytes, seed, salt = "") {
  const source = bytes instanceof Uint8Array
    ? bytes
    : Uint8Array.from(bytes)

  const stream = keystream(
    source.length,
    seed,
    salt
  )

  const output = new Uint8Array(source.length)

  for (let i = 0; i < source.length; i++) {
    output[i] = source[i] ^ stream[i]
  }

  return output
}

export function streamDecrypt(bytes, seed, salt = "") {
  return streamEncrypt(bytes, seed, salt)
}

export function encryptString(value, seed, salt = "string") {
  const source = utf8Encode(value)
  const encrypted = streamEncrypt(
    source,
    seed,
    salt
  )

  return bytesToBase64(encrypted)
}

export function decryptString(value, seed, salt = "string") {
  const encrypted = base64ToBytes(value)

  return utf8Decode(
    streamDecrypt(
      encrypted,
      seed,
      salt
    )
  )
}

export function deriveKeys(seed, count = 8, salt = "") {
  const output = []
  let state = deriveKey(seed, salt)

  for (let i = 0; i < count; i++) {
    state = mix(
      state ^
      Math.imul(
        i + 1,
        0x9E3779B9
      )
    )

    output.push(state >>> 0)
  }

  return output
}

export function rotateKey(key, round = 1) {
  let value = u32(key)

  value = rotl(
    value,
    round * 7
  )

  value ^= Math.imul(
    round + 1,
    0x45D9F3B
  )

  return mix(value)
}

export function makeKeySchedule(seed, rounds = 16) {
  const keys = []
  let key = deriveKey(
    seed,
    "key-schedule"
  )

  for (let i = 0; i < rounds; i++) {
    key = rotateKey(
      key,
      i + 1
    )

    keys.push(key)
  }

  return keys
}

export function encryptBlock(value, key, rounds = 8) {
  let left = u32(value)
  let right = u32(key)

  for (let i = 0; i < rounds; i++) {
    const roundKey = mix(
      right ^
      Math.imul(
        i + 1,
        0x9E3779B9
      )
    )

    left = u32(
      rotl(
        left ^ roundKey,
        (i + 5) & 31
      )
    )

    right = u32(
      rotl(
        right ^ left,
        (i + 11) & 31
      )
    )
  }

  return {
    left,
    right
  }
}

export function decryptBlock(value, key, rounds = 8) {
  let left = u32(value.left)
  let right = u32(value.right)

  for (let i = rounds - 1; i >= 0; i--) {
    right = rotr(
      right,
      (i + 11) & 31
    )

    right = u32(
      right ^ left
    )

    left = rotr(
      left,
      (i + 5) & 31
    )

    const roundKey = mix(
      right ^
      Math.imul(
        i + 1,
        0x9E3779B9
      )
    )

    left = u32(
      left ^ roundKey
    )
  }

  return left >>> 0
}

export function encryptUint32(value, seed, salt = "") {
  const key = deriveKey(
    seed,
    salt
  )

  return encryptBlock(
    u32(value),
    key,
    10
  )
}

export function decryptUint32(block, seed, salt = "") {
  const key = deriveKey(
    seed,
    salt
  )

  return decryptBlock(
    block,
    key,
    10
  )
}

export function generateNonce(seed, length = 16) {
  const random = new Random(
    deriveKey(
      seed,
      "nonce"
    )
  )

  const output = new Uint8Array(length)

  for (let i = 0; i < length; i++) {
    output[i] =
      random.uint32() ^
      ((i * 0x5B) & 0xFF)
  }

  return output
}

export function checksum(bytes, seed = 0) {
  const source = bytes instanceof Uint8Array
    ? bytes
    : Uint8Array.from(bytes)

  let hash = fnv1a(
    `checksum:${u32(seed)}`
  )

  for (let i = 0; i < source.length; i++) {
    hash ^= source[i]

    hash = Math.imul(
      hash,
      0x01000193
    )

    hash = rotl(
      hash,
      5
    )
  }

  return hash >>> 0
}

export function signData(data, seed, salt = "") {
  const bytes = typeof data === "string"
    ? utf8Encode(data)
    : data instanceof Uint8Array
      ? data
      : Uint8Array.from(data)

  const hash = checksum(
    bytes,
    deriveKey(seed, salt)
  )

  const key = deriveKey(
    seed,
    `signature:${salt}`
  )

  return mix(
    hash ^ key
  )
}

export function verifySignature(
  data,
  signature,
  seed,
  salt = ""
) {
  return (
    signData(
      data,
      seed,
      salt
    ) >>> 0
  ) === (
    u32(signature)
  )
}

export function protectString(
  value,
  seed,
  salt = "constant"
) {
  const nonce = generateNonce(
    deriveKey(seed, salt),
    8
  )

  const source = utf8Encode(value)
  const stream = keystream(
    source.length,
    deriveKey(seed, bytesToBase64(nonce)),
    salt
  )

  const encrypted = new Uint8Array(
    source.length
  )

  for (let i = 0; i < source.length; i++) {
    encrypted[i] =
      source[i] ^
      stream[i] ^
      nonce[i % nonce.length]
  }

  return {
    data: bytesToBase64(encrypted),
    nonce: bytesToBase64(nonce),
    signature: signData(
      encrypted,
      seed,
      salt
    )
  }
}

export function unprotectString(
  payload,
  seed,
  salt = "constant"
) {
  const encrypted = base64ToBytes(
    payload.data
  )

  const nonce = base64ToBytes(
    payload.nonce
  )

  const stream = keystream(
    encrypted.length,
    deriveKey(
      seed,
      bytesToBase64(nonce)
    ),
    salt
  )

  const output = new Uint8Array(
    encrypted.length
  )

  for (let i = 0; i < encrypted.length; i++) {
    output[i] =
      encrypted[i] ^
      stream[i] ^
      nonce[i % nonce.length]
  }

  return utf8Decode(output)
}

export function createCryptoContext(
  seed,
  options = {}
) {
  const normalizedSeed =
    u32(seed)

  return {
    seed: normalizedSeed,

    watermark:
      options.watermark ||
      "zis_obfuscator",

    chunkName:
      options.chunkName ||
      "Zisuay",

    keys: makeKeySchedule(
      normalizedSeed,
      options.rounds || 16
    ),

    deriveKey(
      salt = ""
    ) {
      return deriveKey(
        normalizedSeed,
        salt
      )
    },

    encrypt(
      value,
      salt = "data"
    ) {
      return encryptString(
        value,
        normalizedSeed,
        salt
      )
    },

    decrypt(
      value,
      salt = "data"
    ) {
      return decryptString(
        value,
        normalizedSeed,
        salt
      )
    },

    checksum(value) {
      return checksum(
        typeof value === "string"
          ? utf8Encode(value)
          : value,
        normalizedSeed
      )
    },

    sign(
      value,
      salt = ""
    ) {
      return signData(
        value,
        normalizedSeed,
        salt
      )
    }
  }
}

export default {
  xorEncrypt,
  xorDecrypt,
  streamEncrypt,
  streamDecrypt,
  encryptString,
  decryptString,
  deriveKeys,
  rotateKey,
  makeKeySchedule,
  encryptBlock,
  decryptBlock,
  encryptUint32,
  decryptUint32,
  generateNonce,
  checksum,
  signData,
  verifySignature,
  protectString,
  unprotectString,
  createCryptoContext
}
