import {
    TokenType,
    Token,
    keywordType
} from "./token.js";

class LexerError extends Error {
    constructor(message, line, column) {
        super(`${message} at ${line}:${column}`);
        this.name = "LexerError";
        this.line = line;
        this.column = column;
    }
}

class Lexer {
    constructor(source = "") {
        this.source = String(source);
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
    }

    current() {
        return this.source[this.position] || "";
    }

    peek(offset = 1) {
        return this.source[this.position + offset] || "";
    }

    advance(count = 1) {
        for (let i = 0; i < count; i++) {
            const char = this.source[this.position];

            if (char === "\n") {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }

            this.position++;
        }
    }

    addToken(type, value = null, length = 1, line = this.line, column = this.column, start = this.position) {
        this.tokens.push(
            new Token(
                type,
                value,
                line,
                column,
                start,
                start + length
            )
        );

        this.advance(length);
    }

    error(message) {
        throw new LexerError(
            message,
            this.line,
            this.column
        );
    }

    isWhitespace(char) {
        return (
            char === " " ||
            char === "\t" ||
            char === "\r" ||
            char === "\n" ||
            char === "\f"
        );
    }

    isDigit(char) {
        return char >= "0" && char <= "9";
    }

    isHexDigit(char) {
        return /^[0-9a-fA-F]$/.test(char);
    }

    isIdentifierStart(char) {
        return (
            !!char &&
            (
                (char >= "a" && char <= "z") ||
                (char >= "A" && char <= "Z") ||
                char === "_"
            )
        );
    }

    isIdentifierPart(char) {
        return (
            this.isIdentifierStart(char) ||
            this.isDigit(char)
        );
    }

    readIdentifier() {
        const start = this.position;
        const line = this.line;
        const column = this.column;

        while (
            this.isIdentifierPart(
                this.current()
            )
        ) {
            this.advance();
        }

        const value = this.source.slice(
            start,
            this.position
        );

        this.tokens.push(
            new Token(
                keywordType(value),
                value,
                line,
                column,
                start,
                this.position
            )
        );
    }

    readNumber() {
        const start = this.position;
        const line = this.line;
        const column = this.column;

        if (
            this.current() === "0" &&
            (
                this.peek(1) === "x" ||
                this.peek(1) === "X"
            )
        ) {
            this.advance(2);

            while (
                this.isHexDigit(
                    this.current()
                )
            ) {
                this.advance();
            }

            const raw = this.source.slice(
                start,
                this.position
            );

            if (raw.length <= 2) {
                this.error("Invalid hexadecimal number");
            }

            this.tokens.push(
                new Token(
                    TokenType.Number,
                    Number.parseInt(raw, 16),
                    line,
                    column,
                    start,
                    this.position
                )
            );

            return;
        }

        while (
            this.isDigit(
                this.current()
            )
        ) {
            this.advance();
        }

        if (
            this.current() === "." &&
            this.peek(1) !== "." &&
            this.isDigit(this.peek(1))
        ) {
            this.advance();

            while (
                this.isDigit(
                    this.current()
                )
            ) {
                this.advance();
            }
        }

        if (
            this.current() === "e" ||
            this.current() === "E"
        ) {
            const beforeExponent = this.position;

            this.advance();

            if (
                this.current() === "+" ||
                this.current() === "-"
            ) {
                this.advance();
            }

            if (
                !this.isDigit(
                    this.current()
                )
            ) {
                this.position = beforeExponent;
                this.column -=
                    this.position - beforeExponent;

                this.error(
                    "Invalid number exponent"
                );
            }

            while (
                this.isDigit(
                    this.current()
                )
            ) {
                this.advance();
            }
        }

        const raw = this.source.slice(
            start,
            this.position
        );

        const value = Number(raw);

        if (Number.isNaN(value)) {
            this.error(
                `Invalid number ${raw}`
            );
        }

        this.tokens.push(
            new Token(
                TokenType.Number,
                value,
                line,
                column,
                start,
                this.position
            )
        );
    }

    readString(quote) {
        const start = this.position;
        const line = this.line;
        const column = this.column;

        this.advance();

        let value = "";

        while (this.position < this.source.length) {
            const char = this.current();

            if (char === quote) {
                this.advance();

                this.tokens.push(
                    new Token(
                        TokenType.String,
                        value,
                        line,
                        column,
                        start,
                        this.position
                    )
                );

                return;
            }

            if (char === "\\") {
                this.advance();

                const escaped = this.current();

                if (escaped === "") {
                    this.error(
                        "Unterminated string"
                    );
                }

                const escapes = {
                    n: "\n",
                    r: "\r",
                    t: "\t",
                    b: "\b",
                    f: "\f",
                    v: "\v",
                    a: "\x07",
                    "\\": "\\",
                    "\"": "\"",
                    "'": "'"
                };

                if (
                    Object.prototype.hasOwnProperty.call(
                        escapes,
                        escaped
                    )
                ) {
                    value += escapes[escaped];
                    this.advance();
                    continue;
                }

                if (escaped === "\n") {
                    value += "\n";
                    this.advance();
                    continue;
                }

                value += escaped;
                this.advance();
                continue;
            }

            value += char;
            this.advance();
        }

        this.error("Unterminated string");
    }

    readLongString() {
        const start = this.position;
        const line = this.line;
        const column = this.column;

        let level = 0;
        let index = this.position + 1;

        while (
            this.source[index] === "="
        ) {
            level++;
            index++;
        }

        if (
            this.source[index] !== "["
        ) {
            return false;
        }

        const openerLength =
            2 + level;

        this.advance(openerLength);

        const closing =
            "]" +
            "=".repeat(level) +
            "]";

        const contentStart =
            this.position;

        const endIndex =
            this.source.indexOf(
                closing,
                this.position
            );

        if (endIndex === -1) {
            this.error(
                "Unterminated long string"
            );
        }

        while (
            this.position < endIndex
        ) {
            this.advance();
        }

        const value =
            this.source.slice(
                contentStart,
                endIndex
            );

        this.advance(
            closing.length
        );

        this.tokens.push(
            new Token(
                TokenType.String,
                value,
                line,
                column,
                start,
                this.position
            )
        );

        return true;
    }

    readComment() {
        if (
            this.current() !== "-" ||
            this.peek(1) !== "-"
        ) {
            return false;
        }

        if (
            this.peek(2) === "["
        ) {
            const savedPosition =
                this.position;

            const savedLine =
                this.line;

            const savedColumn =
                this.column;

            this.advance(2);

            let level = 0;
            let index = this.position + 1;

            while (
                this.source[index] === "="
            ) {
                level++;
                index++;
            }

            if (
                this.source[index] === "["
            ) {
                this.position = savedPosition;
                this.line = savedLine;
                this.column = savedColumn;

                this.advance(2);

                const openerLength =
                    1 + level + 1;

                this.advance(
                    openerLength
                );

                const closing =
                    "]" +
                    "=".repeat(level) +
                    "]";

                const endIndex =
                    this.source.indexOf(
                        closing,
                        this.position
                    );

                if (endIndex === -1) {
                    this.error(
                        "Unterminated long comment"
                    );
                }

                while (
                    this.position < endIndex
                ) {
                    this.advance();
                }

                this.advance(
                    closing.length
                );

                return true;
            }

            this.position = savedPosition;
            this.line = savedLine;
            this.column = savedColumn;
        }

        this.advance(2);

        while (
            this.current() &&
            this.current() !== "\n"
        ) {
            this.advance();
        }

        return true;
    }

    tokenize() {
        while (
            this.position <
            this.source.length
        ) {
            const char = this.current();

            if (this.isWhitespace(char)) {
                this.advance();
                continue;
            }

            if (this.readComment()) {
                continue;
            }

            if (
                char === "[" &&
                (
                    this.peek(1) === "[" ||
                    this.peek(1) === "="
                )
            ) {
                if (this.readLongString()) {
                    continue;
                }
            }

            if (
                char === "\"" ||
                char === "'"
            ) {
                this.readString(char);
                continue;
            }

            if (
                this.isIdentifierStart(char)
            ) {
                this.readIdentifier();
                continue;
            }

            if (
                this.isDigit(char) ||
                (
                    char === "." &&
                    this.isDigit(this.peek(1))
                )
            ) {
                this.readNumber();
                continue;
            }

            const line = this.line;
            const column = this.column;
            const start = this.position;

            if (
                char === "." &&
                this.peek(1) === "." &&
                this.peek(2) === "."
            ) {
                this.addToken(
                    TokenType.Vararg,
                    "...",
                    3,
                    line,
                    column,
                    start
                );
                continue;
            }

            if (
                char === "." &&
                this.peek(1) === "."
            ) {
                this.addToken(
                    TokenType.Concat,
                    "..",
                    2,
                    line,
                    column,
                    start
                );
                continue;
            }

            if (
                char === ":" &&
                this.peek(1) === ":"
            ) {
                this.addToken(
                    TokenType.DoubleColon,
                    "::",
                    2,
                    line,
                    column,
                    start
                );
                continue;
            }

            if (
                char === "=" &&
                this.peek(1) === "="
            ) {
                this.addToken(
                    TokenType.Equal,
                    "==",
                    2,
                    line,
                    column,
                    start
                );
                continue;
            }

            if (
                char === "~" &&
                this.peek(1) === "="
            ) {
                this.addToken(
                    TokenType.NotEqual,
                    "~=",
                    2,
                    line,
                    column,
                    start
                );
                continue;
            }

            if (
                char === "<" &&
                this.peek(1) === "="
            ) {
                this.addToken(
                    TokenType.LessEqual,
                    "<=",
                    2,
                    line,
                    column,
                    start
                );
                continue;
            }

            if (
                char === ">" &&
                this.peek(1) === "="
            ) {
                this.addToken(
                    TokenType.GreaterEqual,
                    ">=",
                    2,
                    line,
                    column,
                    start
                );
                continue;
            }

            if (
                char === "/" &&
                this.peek(1) === "/"
            ) {
                this.addToken(
                    TokenType.FloorDivide,
                    "//",
                    2,
                    line,
                    column,
                    start
                );
                continue;
            }

            const single = {
                "+": TokenType.Plus,
                "-": TokenType.Minus,
                "*": TokenType.Multiply,
                "/": TokenType.Divide,
                "%": TokenType.Modulo,
                "^": TokenType.Power,

                "=": TokenType.Assign,

                "<": TokenType.Less,
                ">": TokenType.Greater,

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

            const type = single[char];

            if (type) {
                this.addToken(
                    type,
                    char,
                    1,
                    line,
                    column,
                    start
                );
                continue;
            }

            this.error(
                `Unexpected character '${char}'`
            );
        }

        this.tokens.push(
            new Token(
                TokenType.EOF,
                null,
                this.line,
                this.column,
                this.position,
                this.position
            )
        );

        return this.tokens;
    }

    tokenizeAll() {
        return this.tokenize();
    }
}

export {
    Lexer,
    LexerError
};

export default Lexer;
