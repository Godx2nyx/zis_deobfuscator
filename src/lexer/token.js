const TokenType = Object.freeze({
    EOF: "EOF",

    Identifier: "Identifier",
    Number: "Number",
    String: "String",

    True: "True",
    False: "False",
    Nil: "Nil",

    Local: "Local",
    Function: "Function",
    End: "End",
    If: "If",
    Then: "Then",
    Else: "Else",
    ElseIf: "ElseIf",
    While: "While",
    Do: "Do",
    For: "For",
    In: "In",
    Repeat: "Repeat",
    Until: "Until",
    Return: "Return",
    Break: "Break",
    Continue: "Continue",

    And: "And",
    Or: "Or",
    Not: "Not",

    Plus: "Plus",
    Minus: "Minus",
    Multiply: "Multiply",
    Divide: "Divide",
    FloorDivide: "FloorDivide",
    Modulo: "Modulo",
    Power: "Power",

    Equal: "Equal",
    NotEqual: "NotEqual",
    Less: "Less",
    LessEqual: "LessEqual",
    Greater: "Greater",
    GreaterEqual: "GreaterEqual",

    Assign: "Assign",

    LeftParen: "LeftParen",
    RightParen: "RightParen",
    LeftBrace: "LeftBrace",
    RightBrace: "RightBrace",
    LeftBracket: "LeftBracket",
    RightBracket: "RightBracket",

    Comma: "Comma",
    Dot: "Dot",
    Colon: "Colon",
    Semicolon: "Semicolon",

    DoubleColon: "DoubleColon",
    Vararg: "Vararg",

    Comment: "Comment"
});

const Keywords = Object.freeze({
    and: TokenType.And,
    or: TokenType.Or,
    not: TokenType.Not,

    true: TokenType.True,
    false: TokenType.False,
    nil: TokenType.Nil,

    local: TokenType.Local,
    function: TokenType.Function,
    end: TokenType.End,

    if: TokenType.If,
    then: TokenType.Then,
    else: TokenType.Else,
    elseif: TokenType.ElseIf,

    while: TokenType.While,
    do: TokenType.Do,

    for: TokenType.For,
    in: TokenType.In,

    repeat: TokenType.Repeat,
    until: TokenType.Until,

    return: TokenType.Return,
    break: TokenType.Break,
    continue: TokenType.Continue
});

class Token {
    constructor(
        type,
        value,
        line = 1,
        column = 1,
        start = 0,
        end = 0
    ) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
        this.start = start;
        this.end = end;
    }

    clone() {
        return new Token(
            this.type,
            this.value,
            this.line,
            this.column,
            this.start,
            this.end
        );
    }

    is(type) {
        return this.type === type;
    }

    isAny(...types) {
        return types.includes(this.type);
    }

    toString() {
        return `${this.type}(${JSON.stringify(this.value)})@${this.line}:${this.column}`;
    }

    toJSON() {
        return {
            type: this.type,
            value: this.value,
            line: this.line,
            column: this.column,
            start: this.start,
            end: this.end
        };
    }
}

function keywordType(value) {
    return Keywords[value] || TokenType.Identifier;
}

function isKeyword(value) {
    return Object.prototype.hasOwnProperty.call(
        Keywords,
        value
    );
}

export {
    Token,
    TokenType,
    Keywords,
    keywordType,
    isKeyword
};

export default Token;
