const input = document.getElementById("input");
const output = document.getElementById("output");

const processButton = document.getElementById("process");
const processText = document.getElementById("processText");
const status = document.getElementById("status");

const clearButton = document.getElementById("clear");
const sampleButton = document.getElementById("sample");

const copyButton = document.getElementById("copy");
const downloadButton = document.getElementById("download");

const inputInfo = document.getElementById("inputInfo");
const outputInfo = document.getElementById("outputInfo");

const rename = document.getElementById("rename");
const strings = document.getElementById("strings");
const constants = document.getElementById("constants");
const controlFlow = document.getElementById("controlFlow");
const deadCode = document.getElementById("deadCode");
const minify = document.getElementById("minify");


const SAMPLE_CODE = `local Players = game:GetService("Players")

local player = Players.LocalPlayer

local message = "Hello from Zis Obfuscator"

local function greet(name)
    local text = message .. ", " .. name
    print(text)
    return text
end

greet(player.Name)`;


function updateInputInfo() {
    if (!inputInfo) return;

    inputInfo.textContent =
        `${input.value.length.toLocaleString()} characters`;
}


function updateOutputInfo() {
    if (!outputInfo) return;

    outputInfo.textContent =
        `${output.value.length.toLocaleString()} characters`;
}


function setStatus(text) {
    if (status) {
        status.textContent = text;
    }
}


function setProcessing(processing) {
    if (!processButton) return;

    processButton.disabled = processing;

    if (processText) {
        processText.textContent =
            processing ? "Processing..." : "Obfuscate";
    }
}


function getOptions() {
    return {
        rename: rename ? rename.checked : true,
        encodeStrings: strings ? strings.checked : true,
        hideConstants: constants ? constants.checked : true,
        controlFlow: controlFlow ? controlFlow.checked : true,
        opaque: controlFlow ? controlFlow.checked : true,
        deadCode: deadCode ? deadCode.checked : true,
        minify: minify ? minify.checked : false,
        optimizeVM: true,
        vmVersion: "new",
        chunkName: "Zisuay",
        watermark: "zis_obfuscator",
        seed: Math.floor(
            Math.random() * 0xFFFFFFFF
        )
    };
}


async function obfuscate() {
    const code = input.value;

    if (!code.trim()) {
        output.value = "";
        updateOutputInfo();

        setStatus("Enter Luau source first");

        input.focus();

        return;
    }

    setProcessing(true);
    setStatus("Processing...");

    try {
        const response = await fetch("/api/obfuscate", {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                code,
                options: getOptions()
            })
        });


        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                `Server returned invalid JSON (${response.status})`
            );
        }


        if (!response.ok) {
            throw new Error(
                data?.error ||
                data?.message ||
                `Request failed with status ${response.status}`
            );
        }


        const result =
            data.output ??
            data.code ??
            data.source ??
            "";


        if (!result) {
            throw new Error(
                "Obfuscator returned empty output"
            );
        }


        output.value = result;

        updateOutputInfo();

        setStatus("Completed");

    } catch (error) {

        console.error("Obfuscation error:", error);

        output.value =
            `-- Zis Obfuscator Error\n` +
            `-- ${error.message}`;

        updateOutputInfo();

        setStatus("Failed");

    } finally {
        setProcessing(false);
    }
}


async function copyOutput() {
    const text = output.value;

    if (!text.trim()) {
        setStatus("Nothing to copy");
        return;
    }


    try {

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {
            await navigator.clipboard.writeText(text);
        } else {
            fallbackCopy(text);
        }


        const oldText = copyButton.textContent;

        copyButton.textContent = "Copied";

        setStatus("Copied to clipboard");


        setTimeout(() => {
            copyButton.textContent = oldText;
        }, 1200);

    } catch (error) {

        console.error("Copy error:", error);

        setStatus("Copy failed");
    }
}


function fallbackCopy(text) {
    const area = document.createElement("textarea");

    area.value = text;

    area.style.position = "fixed";
    area.style.left = "-999999px";
    area.style.top = "0";

    document.body.appendChild(area);

    area.focus();
    area.select();

    const success =
        document.execCommand("copy");

    document.body.removeChild(area);

    if (!success) {
        throw new Error("Clipboard unavailable");
    }
}


function downloadOutput() {
    const text = output.value;

    if (!text.trim()) {
        setStatus("Nothing to download");
        return;
    }


    try {

        const blob = new Blob(
            [text],
            {
                type: "text/plain;charset=utf-8"
            }
        );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");

        link.href = url;

        link.download = "Zisuay.lua";

        link.style.display = "none";

        document.body.appendChild(link);

        link.click();

        link.remove();


        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);


        setStatus("Downloaded Zisuay.lua");

    } catch (error) {

        console.error("Download error:", error);

        setStatus("Download failed");
    }
}


function clearAll() {
    input.value = "";
    output.value = "";

    updateInputInfo();
    updateOutputInfo();

    setStatus("Ready");

    input.focus();
}


function loadSample() {
    input.value = SAMPLE_CODE;

    output.value = "";

    updateInputInfo();
    updateOutputInfo();

    setStatus("Sample loaded");

    input.focus();
}


function handleTab(event) {
    if (event.key !== "Tab") {
        return;
    }

    event.preventDefault();


    const start = input.selectionStart;
    const end = input.selectionEnd;

    const before =
        input.value.substring(0, start);

    const after =
        input.value.substring(end);


    input.value =
        before +
        "    " +
        after;


    input.selectionStart =
        input.selectionEnd =
        start + 4;


    updateInputInfo();
}


if (processButton) {
    processButton.addEventListener(
        "click",
        obfuscate
    );
}


if (copyButton) {
    copyButton.addEventListener(
        "click",
        copyOutput
    );
}


if (downloadButton) {
    downloadButton.addEventListener(
        "click",
        downloadOutput
    );
}


if (clearButton) {
    clearButton.addEventListener(
        "click",
        clearAll
    );
}


if (sampleButton) {
    sampleButton.addEventListener(
        "click",
        loadSample
    );
}


if (input) {

    input.addEventListener(
        "input",
        updateInputInfo
    );

    input.addEventListener(
        "keydown",
        handleTab
    );
}


if (output) {
    output.addEventListener(
        "input",
        updateOutputInfo
    );
}


updateInputInfo();
updateOutputInfo();
setStatus("Ready");
