import {
  toUint8Array,
  concatBytes,
  readUint32,
  writeUint32
} from "./bytes.js"

import {
  bytesToBase64,
  base64ToBytes,
  utf8Encode,
  utf8Decode
} from "./encoding.js"

import {
  checksum
} from "./crypto.js"

const MAGIC = "ZISP"
const VERSION = 1
const HEADER_SIZE = 24

function writeString(value) {
  const bytes = utf8Encode(value)
  const output = new Uint8Array(4 + bytes.length)

  writeUint32(output, bytes.length, 0)
  output.set(bytes, 4)

  return output
}

function readString(bytes, offset) {
  const length = readUint32(bytes, offset)
  const start = offset + 4
  const end = start + length

  if (end > bytes.length) {
    throw new RangeError("Invalid packed string")
  }

  return {
    value: utf8Decode(bytes.slice(start, end)),
    offset: end
  }
}

function magicBytes() {
  return utf8Encode(MAGIC)
}

function checkMagic(bytes) {
  const magic = magicBytes()

  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) {
      return false
    }
  }

  return true
}

export class Packer {
  constructor(options = {}) {
    this.version = options.version || VERSION
    this.name = options.name || "Zisuay"
    this.watermark =
      options.watermark || "zis_obfuscator"
  }

  pack(data, metadata = {}) {
    const payload = toUint8Array(data)

    const name =
      metadata.name ||
      this.name

    const watermark =
      metadata.watermark ||
      this.watermark

    const checksumValue =
      checksum(payload)

    const nameBytes =
      writeString(name)

    const watermarkBytes =
      writeString(watermark)

    const header = new Uint8Array(
      HEADER_SIZE
    )

    header.set(
      magicBytes(),
      0
    )

    header[4] =
      this.version & 0xFF

    writeUint32(
      header,
      payload.length,
      8
    )

    writeUint32(
      header,
      checksumValue,
      12
    )

    writeUint32(
      header,
      nameBytes.length,
      16
    )

    writeUint32(
      header,
      watermarkBytes.length,
      20
    )

    return concatBytes(
      header,
      nameBytes,
      watermarkBytes,
      payload
    )
  }

  unpack(data) {
    const bytes =
      toUint8Array(data)

    if (bytes.length < HEADER_SIZE) {
      throw new RangeError(
        "Packed data is too small"
      )
    }

    if (!checkMagic(bytes)) {
      throw new Error(
        "Invalid ZISP package"
      )
    }

    const version =
      bytes[4]

    const payloadLength =
      readUint32(bytes, 8)

    const expectedChecksum =
      readUint32(bytes, 12)

    const nameLength =
      readUint32(bytes, 16)

    const watermarkLength =
      readUint32(bytes, 20)

    let offset = HEADER_SIZE

    const nameResult =
      readString(bytes, offset)

    offset = nameResult.offset

    const watermarkResult =
      readString(bytes, offset)

    offset = watermarkResult.offset

    const end =
      offset + payloadLength

    if (end > bytes.length) {
      throw new RangeError(
        "Invalid payload length"
      )
    }

    const payload =
      bytes.slice(
        offset,
        end
      )

    const actualChecksum =
      checksum(payload)

    return {
      version,
      name: nameResult.value,
      watermark: watermarkResult.value,
      payload,
      payloadLength,
      checksum: actualChecksum,
      checksumValid:
        actualChecksum === expectedChecksum,
      valid:
        actualChecksum === expectedChecksum
    }
  }

  encode(data, metadata = {}) {
    return bytesToBase64(
      this.pack(
        data,
        metadata
      )
    )
  }

  decode(value) {
    return this.unpack(
      base64ToBytes(value)
    )
  }

  verify(data) {
    try {
      const result =
        this.unpack(data)

      return result.valid
    } catch {
      return false
    }
  }
}

export function pack(
  data,
  metadata = {}
) {
  return new Packer(
    metadata
  ).pack(
    data,
    metadata
  )
}

export function unpack(data) {
  return new Packer().unpack(data)
}

export function encodePackage(
  data,
  metadata = {}
) {
  return new Packer(
    metadata
  ).encode(
    data,
    metadata
  )
}

export function decodePackage(value) {
  return new Packer().decode(value)
}

export function verifyPackage(data) {
  return new Packer().verify(data)
}

export function getPackageInfo(data) {
  const result =
    unpack(data)

  return {
    version: result.version,
    name: result.name,
    watermark: result.watermark,
    payloadLength:
      result.payloadLength,
    checksum:
      result.checksum,
    valid:
      result.valid
  }
}

export {
  MAGIC,
  VERSION,
  HEADER_SIZE
}

export default Packer
