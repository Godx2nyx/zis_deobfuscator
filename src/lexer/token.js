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
    Concat: "Concat",

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

class Token {
    constructor(
        type,
        value = null,
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

    toString() {
        return `${this.type}${this.value !== null ? `(${this.value})` : ""}`;
    }
}

const keywords = Object.freeze({
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
    continue: TokenType.Continue,

    and: TokenType.And,
    or: TokenType.Or,
    not: TokenType.Not
});

function keywordType(value) {
    return keywords[value] || TokenType.Identifier;
}

function isKeyword(value) {
    return Object.prototype.hasOwnProperty.call(
        keywords,
        value
    );
}

export {
    TokenType,
    Token,
    keywords,
    keywordType,
    isKeyword
};

export default TokenType;
