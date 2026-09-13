const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const WATERMARK = "zis_obfuscator";
const CHUNK_NAME = "Zisuay";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/info", (req, res) => {
    res.json({
        name: "Zis Obfuscator",
        version: "0.1.0",
        watermark: WATERMARK,
        chunkName: CHUNK_NAME
    });
});

app.post("/api/obfuscate", (req, res) => {
    const code = typeof req.body.code === "string"
        ? req.body.code
        : "";

    if (!code.trim()) {
        return res.status(400).json({
            error: "Source code is empty"
        });
    }

    res.json({
        success: true,
        output: code,
        watermark: WATERMARK,
        chunkName: CHUNK_NAME
    });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Zis Obfuscator running on port ${PORT}`);
});
