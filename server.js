import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { obfuscate } from "./src/obfuscator/obfuscator.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

const WATERMARK = "zis_obfuscator"
const CHUNK_NAME = "Zisuay"

app.use(express.json({ limit: "2mb" }))
app.use(express.static(path.join(__dirname, "public")))

app.get("/api/info", (req, res) => {
  res.json({
    success: true,
    name: "Zis Obfuscator",
    version: "0.1.0",
    watermark: WATERMARK,
    chunkName: CHUNK_NAME
  })
})

app.post("/api/obfuscate", (req, res) => {
  try {
    const code = typeof req.body?.code === "string"
      ? req.body.code
      : ""

    if (!code.trim()) {
      return res.status(400).json({
        success: false,
        error: "Source code is empty"
      })
    }

    const inputOptions = req.body?.options || {}

    const options = {
      rename: inputOptions.rename !== false,
      encodeStrings: inputOptions.encodeStrings !== false,
      hideConstants: inputOptions.hideConstants !== false,
      controlFlow: inputOptions.controlFlow !== false,
      opaque: inputOptions.opaque !== false,
      deadCode: inputOptions.deadCode !== false,
      minify: inputOptions.minify === true,
      optimizeVM: inputOptions.optimizeVM !== false,
      vmVersion: inputOptions.vmVersion || "new",
      seed: Number.isFinite(inputOptions.seed)
        ? inputOptions.seed >>> 0
        : ((Math.random() * 0xFFFFFFFF) >>> 0),
      chunkName: CHUNK_NAME,
      watermark: WATERMARK
    }

    const result = obfuscate(code, options)

    return res.json({
      success: true,
      output: result.output || result.code || "",
      code: result.code || "",
      source: result.source || "",
      bytecode: result.bytecode || null,
      image: result.image || null,
      serializedVM: result.serializedVM || null,
      verification: result.verification || null,
      metadata: result.metadata || null,
      warnings: result.warnings || [],
      watermark: WATERMARK,
      chunkName: CHUNK_NAME
    })
  } catch (error) {
    console.error("Obfuscation error:", error)

    return res.status(500).json({
      success: false,
      error: error instanceof Error
        ? error.message
        : String(error)
    })
  }
})

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Zis Obfuscator running on port ${PORT}`)
})
