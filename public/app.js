const input = document.getElementById("input");
const output = document.getElementById("output");

const processButton = document.getElementById("process");
const clearButton = document.getElementById("clear");

const rename = document.getElementById("rename");
const strings = document.getElementById("strings");
const minify = document.getElementById("minify");

processButton.addEventListener("click", async () => {
    const code = input.value;

    if (!code.trim()) {
        output.value = "";
        return;
    }

    processButton.disabled = true;
    processButton.textContent = "Processing...";

    try {
        const response = await fetch("/api/obfuscate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                code,
                options: {
                    rename: rename.checked,
                    encodeStrings: strings.checked,
                    minify: minify.checked
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Processing failed");
        }

        output.value = data.output || "";
    } catch (error) {
        output.value = `-- Error: ${error.message}`;
    } finally {
        processButton.disabled = false;
        processButton.textContent = "Process";
    }
});

clearButton.addEventListener("click", () => {
    input.value = "";
    output.value = "";
});

input.addEventListener("keydown", event => {
    if (event.key === "Tab") {
        event.preventDefault();

        const start = input.selectionStart;
        const end = input.selectionEnd;

        input.value =
            input.value.substring(0, start) +
            "    " +
            input.value.substring(end);

        input.selectionStart = input.selectionEnd = start + 4;
    }
});
