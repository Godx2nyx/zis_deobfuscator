import { Token, TokenType, keywordType } from "./token.js";

class LexerError extends Error {
    constructor(message, line, column, source) {
        super(`${message} at ${line}:${column}`);
        this.name = "LexerError";
        this.line = line;
        this.column = column;
        this.source = source;
    }
}

class Lexer {
    constructor(source, options = {}) {
        this.source = String(source ?? "");
        this.length = this.source.length;

        this.index = 0;
        this.line = 1;
        this.column = 1;

        this.tokens = [];

        this.options = {
            preserveComments: options.preserveComments === true,
            preserveWhitespace: false,
            allowShebang: options.allowShebang !== false
        };
    }

    tokenize() {
        while (!this.isEOF()) {
            this.scanToken();
        }

        this.tokens.push(
            new Token(
                TokenType.EOF,
                null,
                this.line,
                this.column,
                this.index,
                this.index
            )
        );

        return this.tokens;
    }

    scanToken() {
        const char = this.peek();

        if (this.isWhitespace(char)) {
            this.skipWhitespace();
            return;
        }

        if (
            this.index === 0 &&
            char === "#" &&
            this.peek(1) === "!"
        ) {
            if (this.options.allowShebang) {
                this.skipLineComment();
                return;
            }

            this.error("Shebang is not allowed");
        }

        if (char === "-" && this.peek(1) === "-") {
            this.scanComment();
            return;
        }

        if (this.isIdentifierStart(char)) {
            this.scanIdentifier();
            return;
        }

        if (
            this.isDigit(char) ||
            (char === "." && this.isDigit(this.peek(1)))
        ) {
            this.scanNumber();
            return;
        }

        if (
            char === "'" ||
            char === '"' ||
            char === "`"
        ) {
            this.scanString(char);
            return;
        }

        if (
            char === "." &&
            this.peek(1) === "." &&
            this.peek(2) === "."
        ) {
            this.addToken(
                TokenType.Vararg,
                "...",
                3
            );
            return;
        }

        if (
            char === "." &&
            this.peek(1) === "."
        ) {
            this.addToken(
                TokenType.Dot,
                "..",
                2
            );
            return;
        }

        if (
            char === ":" &&
            this.peek(1) === ":"
        ) {
            this.addToken(
                TokenType.DoubleColon,
                "::",
                2
            );
            return;
        }

        if (
            char === "=" &&
            this.peek(1) === "="
        ) {
            this.addToken(
                TokenType.Equal,
                "==",
                2
            );
            return;
        }

        if (
            char === "~" &&
            this.peek(1) === "="
        ) {
            this.addToken(
                TokenType.NotEqual,
                "~=",
                2
            );
            return;
        }

        if (
            char === "<" &&
            this.peek(1) === "="
        ) {
            this.addToken(
                TokenType.LessEqual,
                "<=",
                2
            );
            return;
        }

        if (
            char === ">" &&
            this.peek(1) === "="
        ) {
            this.addToken(
                TokenType.GreaterEqual,
                ">=",
                2
            );
            return;
        }

        if (
            char === "/" &&
            this.peek(1) === "/"
        ) {
            this.addToken(
                TokenType.FloorDivide,
                "//",
                2
            );
            return;
        }

        const single = {
            "+": TokenType.Plus,
            "-": TokenType.Minus,
            "*": TokenType.Multiply,
            "/": TokenType.Divide,
            "%": TokenType.Modulo,
            "^": TokenType.Power,

            "<": TokenType.Less,
            ">": TokenType.Greater,
            "=": TokenType.Assign,

            "(": TokenType.LeftParen,
            ")": TokenType.RightParen,

            "{": TokenType.LeftBrace,
            "}": TokenType.RightBrace,

            "[": TokenType.LeftBracket,
            "]": TokenType.RightBracket,

            ",": TokenType.Comma,
            ".": TokenType.Dot,
            ":": TokenType.Colon,
            ";": TokenType.Semicolon
        };

        if (single[char] !== undefined) {
            this.addToken(
                single[char],
                char,
                1
            );
            return;
        }

        this.error(
            `Unexpected character ${JSON.stringify(char)}`
        );
    }

    scanIdentifier() {
        const start = this.index;
        const line = this.line;
        const column = this.column;

        this.advance();

        while (this.isIdentifierPart(this.peek())) {
            this.advance();
        }

        const value = this.source.slice(
            start,
            this.index
        );

        const type = keywordType(value);

        this.tokens.push(
            new Token(
                type,
                value,
                line,
                column,
                start,
                this.index
            )
        );
    }

    scanNumber() {
        const start = this.index;
        const line = this.line;
        const column = this.column;

        let value = "";

        if (
            this.peek() === "0" &&
            this.peek(1).toLowerCase() === "x"
        ) {
            value += this.advance();
            value += this.advance();

            if (!this.isHexDigit(this.peek())) {
                this.error("Invalid hexadecimal number");
            }

            while (this.isHexDigit(this.peek())) {
                value += this.advance();
            }

            if (this.peek() === ".") {
                value += this.advance();

                while (this.isHexDigit(this.peek())) {
                    value += this.advance();
                }
            }

            if (
                this.peek().toLowerCase() === "p"
            ) {
                value += this.advance();

                if (
                    this.peek() === "+" ||
                    this.peek() === "-"
                ) {
                    value += this.advance();
                }

                if (!this.isDigit(this.peek())) {
                    this.error(
                        "Invalid hexadecimal exponent"
                    );
                }

                while (this.isDigit(this.peek())) {
                    value += this.advance();
                }
            }
        } else {
            let hasDot = false;

            if (this.peek() === ".") {
                hasDot = true;
                value += this.advance();
            }

            while (this.isDigit(this.peek())) {
                value += this.advance();
            }

            if (
                !hasDot &&
                this.peek() === "." &&
                this.peek(1) !== "."
            ) {
                hasDot = true;
                value += this.advance();

                while (this.isDigit(this.peek())) {
                    value += this.advance();
                }
            }

            if (
                this.peek().toLowerCase() === "e"
            ) {
                value += this.advance();

                if (
                    this.peek() === "+" ||
                    this.peek() === "-"
                ) {
                    value += this.advance();
                }

                if (!this.isDigit(this.peek())) {
                    this.error(
                        "Invalid numeric exponent"
                    );
                }

                while (this.isDigit(this.peek())) {
                    value += this.advance();
                }
            }
        }

        if (this.isIdentifierStart(this.peek())) {
            this.error("Invalid number literal");
        }

        this.tokens.push(
            new Token(
                TokenType.Number,
                value,
                line,
                column,
                start,
                this.index
            )
        );
    }

    scanString(quote) {
        const start = this.index;
        const line = this.line;
        const column = this.column;

        this.advance();

        let value = "";

        while (!this.isEOF()) {
            const char = this.peek();

            if (char === quote) {
                this.advance();

                this.tokens.push(
                    new Token(
                        TokenType.String,
                        value,
                        line,
                        column,
                        start,
                        this.index
                    )
                );

                return;
            }

            if (char === "\\") {
                this.advance();

                if (this.isEOF()) {
                    this.error("Unterminated string");
                }

                value += this.readEscape();
                continue;
            }

            if (
                char === "\n" ||
                char === "\r"
            ) {
                this.error("Unterminated string");
            }

            value += this.advance();
        }

        this.error("Unterminated string");
    }

    readEscape() {
        const char = this.advance();

        const escapes = {
            a: "\x07",
            b: "\b",
            f: "\f",
            n: "\n",
            r: "\r",
            t: "\t",
            v: "\v",
            "\\": "\\",
            "\"": "\"",
            "'": "'",
            "`": "`"
        };

        if (
            Object.prototype.hasOwnProperty.call(
                escapes,
                char
            )
        ) {
            return escapes[char];
        }

        if (char === "\n") {
            return "\n";
        }

        if (char === "\r") {
            if (this.peek() === "\n") {
                this.advance();
            }

            return "\n";
        }

        if (char === "x") {
            const a = this.peek();
            const b = this.peek(1);

            if (
                !this.isHexDigit(a) ||
                !this.isHexDigit(b)
            ) {
                this.error(
                    "Invalid hexadecimal escape"
                );
            }

            this.advance();
            this.advance();

            return String.fromCharCode(
                parseInt(a + b, 16)
            );
        }

        if (
            char === "u" &&
            this.peek() === "{"
        ) {
            this.advance();

            let hex = "";

            while (
                !this.isEOF() &&
                this.peek() !== "}"
            ) {
                if (!this.isHexDigit(this.peek())) {
                    this.error(
                        "Invalid Unicode escape"
                    );
                }

                hex += this.advance();

                if (hex.length > 6) {
                    this.error(
                        "Unicode escape is too long"
                    );
                }
            }

            if (this.peek() !== "}") {
                this.error(
                    "Unterminated Unicode escape"
                );
            }

            this.advance();

            const codePoint = parseInt(hex, 16);

            if (
                !Number.isFinite(codePoint) ||
                codePoint > 0x10ffff
            ) {
                this.error(
                    "Invalid Unicode code point"
                );
            }

            return String.fromCodePoint(codePoint);
        }

        if (this.isDigit(char)) {
            let digits = char;

            for (
                let i = 0;
                i < 2 &&
                this.isDigit(this.peek());
                i++
            ) {
                digits += this.advance();
            }

            const code = Number(digits);

            if (code > 255) {
                this.error(
                    "Decimal escape is out of range"
                );
            }

            return String.fromCharCode(code);
        }

        return char;
    }

    scanComment() {
        const start = this.index;
        const line = this.line;
        const column = this.column;

        this.advance();
        this.advance();

        if (this.peek() === "[") {
            const long = this.tryReadLongBracket();

            if (long !== null) {
                if (this.options.preserveComments) {
                    this.tokens.push(
                        new Token(
                            TokenType.Comment,
                            long,
                            line,
                            column,
                            start,
                            this.index
                        )
                    );
                }

                return;
            }
        }

        this.skipLineComment();
    }

    skipLineComment() {
        while (!this.isEOF()) {
            const char = this.peek();

            if (
                char === "\n" ||
                char === "\r"
            ) {
                break;
            }

            this.advance();
        }
    }

    tryReadLongBracket() {
        const savedIndex = this.index;
        const savedLine = this.line;
        const savedColumn = this.column;

        if (this.peek() !== "[") {
            return null;
        }

        this.advance();

        let level = 0;

        while (this.peek() === "=") {
            level++;
            this.advance();
        }

        if (this.peek() !== "[") {
            this.index = savedIndex;
            this.line = savedLine;
            this.column = savedColumn;
            return null;
        }

        this.advance();

        if (this.peek() === "\r") {
            this.advance();

            if (this.peek() === "\n") {
                this.advance();
            }
        } else if (this.peek() === "\n") {
            this.advance();
        }

        const contentStart = this.index;

        while (!this.isEOF()) {
            if (this.peek() === "]") {
                let closeIndex = this.index + 1;
                let equals = 0;

                while (
                    equals < level &&
                    this.source[closeIndex] === "="
                ) {
                    equals++;
                    closeIndex++;
                }

                if (
                    equals === level &&
                    this.source[closeIndex] === "]"
                ) {
                    const content = this.source.slice(
                        contentStart,
                        this.index
                    );

                    this.advance();

                    for (
                        let i = 0;
                        i < level;
                        i++
                    ) {
                        this.advance();
                    }

                    this.advance();

                    return content;
                }
            }

            this.advance();
        }

        this.error("Unterminated long bracket");
    }

    skipWhitespace() {
        while (
            !this.isEOF() &&
            this.isWhitespace(this.peek())
        ) {
            this.advance();
        }
    }

    addToken(type, value, length) {
        const start = this.index;
        const line = this.line;
        const column = this.column;

        for (
            let i = 0;
            i < length;
            i++
        ) {
            this.advance();
        }

        this.tokens.push(
            new Token(
                type,
                value,
                line,
                column,
                start,
                this.index
            )
        );
    }

    advance() {
        if (this.isEOF()) {
            return "";
        }

        const char = this.source[this.index++];

        if (char === "\r") {
            if (this.source[this.index] === "\n") {
                this.index++;
            }

            this.line++;
            this.column = 1;

            return "\n";
        }

        if (char === "\n") {
            this.line++;
            this.column = 1;

            return char;
        }

        this.column++;

        return char;
    }

    peek(offset = 0) {
        const position = this.index + offset;

        if (
            position < 0 ||
            position >= this.length
        ) {
            return "\0";
        }

        return this.source[position];
    }

    isEOF() {
        return this.index >= this.length;
    }

    isWhitespace(char) {
        return (
            char === " " ||
            char === "\t" ||
            char === "\n" ||
            char === "\r" ||
            char === "\f" ||
            char === "\v"
        );
    }

    isDigit(char) {
        return (
            char >= "0" &&
            char <= "9"
        );
    }

    isHexDigit(char) {
        return (
            (char >= "0" && char <= "9") ||
            (char >= "a" && char <= "f") ||
            (char >= "A" && char <= "F")
        );
    }

    isIdentifierStart(char) {
        return (
            (char >= "a" && char <= "z") ||
            (char >= "A" && char <= "Z") ||
            char === "_"
        );
    }

    isIdentifierPart(char) {
        return (
            this.isIdentifierStart(char) ||
            this.isDigit(char)
        );
    }

    error(message) {
        throw new LexerError(
            message,
            this.line,
            this.column,
            this.source
        );
    }
}

function tokenize(source, options = {}) {
    return new Lexer(source, options).tokenize();
}

export {
    Lexer,
    LexerError,
    tokenize
};

export default Lexer;
