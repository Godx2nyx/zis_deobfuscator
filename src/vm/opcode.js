"use strict";

const OPCODES = Object.freeze({
    NOP: 0,

    LOADK: 1,
    MOVE: 2,

    GETGLOBAL: 3,
    SETGLOBAL: 4,

    GETLOCAL: 5,
    SETLOCAL: 6,

    GETUPVAL: 7,
    SETUPVAL: 8,

    NEWTABLE: 9,
    GETTABLE: 10,
    SETTABLE: 11,

    ADD: 12,
    SUB: 13,
    MUL: 14,
    DIV: 15,
    MOD: 16,
    POW: 17,

    IDIV: 18,

    EQ: 19,
    NE: 20,
    LT: 21,
    LE: 22,
    GT: 23,
    GE: 24,

    AND: 25,
    OR: 26,
    NOT: 27,
    NEG: 28,

    CONCAT: 29,
    LEN: 30,

    CALL: 31,
    RETURN: 32,

    JMP: 33,
    JMPIF: 34,
    JMPIFNOT: 35,

    CLOSURE: 36,

    FORPREP: 37,
    FORLOOP: 38,

    POP: 39,

    TEST: 40,
    TESTSET: 41,

    DUP: 42,
    SWAP: 43,

    LOADBOOL: 44,
    LOADNIL: 45,

    VARARG: 46,

    SELF: 47,

    CLOSE: 48,

    HALT: 49,

    TRAP: 50
});

const OPCODE_NAMES = Object.freeze(
    Object.fromEntries(
        Object.entries(OPCODES).map(
            ([name, code]) => [code, name]
        )
    )
);

const OPCODE_INFO = Object.freeze({
    NOP: {
        code: OPCODES.NOP,
        operands: [],
        category: "system"
    },

    LOADK: {
        code: OPCODES.LOADK,
        operands: ["A", "K"],
        category: "constant"
    },

    MOVE: {
        code: OPCODES.MOVE,
        operands: ["A", "B"],
        category: "register"
    },

    GETGLOBAL: {
        code: OPCODES.GETGLOBAL,
        operands: ["A", "K"],
        category: "global"
    },

    SETGLOBAL: {
        code: OPCODES.SETGLOBAL,
        operands: ["K", "A"],
        category: "global"
    },

    GETLOCAL: {
        code: OPCODES.GETLOCAL,
        operands: ["A", "B"],
        category: "local"
    },

    SETLOCAL: {
        code: OPCODES.SETLOCAL,
        operands: ["A", "B"],
        category: "local"
    },

    GETUPVAL: {
        code: OPCODES.GETUPVAL,
        operands: ["A", "B"],
        category: "upvalue"
    },

    SETUPVAL: {
        code: OPCODES.SETUPVAL,
        operands: ["A", "B"],
        category: "upvalue"
    },

    NEWTABLE: {
        code: OPCODES.NEWTABLE,
        operands: ["A", "SIZE"],
        category: "table"
    },

    GETTABLE: {
        code: OPCODES.GETTABLE,
        operands: ["A", "B", "C"],
        category: "table"
    },

    SETTABLE: {
        code: OPCODES.SETTABLE,
        operands: ["A", "B", "C"],
        category: "table"
    },

    ADD: {
        code: OPCODES.ADD,
        operands: ["A", "B", "C"],
        category: "arithmetic"
    },

    SUB: {
        code: OPCODES.SUB,
        operands: ["A", "B", "C"],
        category: "arithmetic"
    },

    MUL: {
        code: OPCODES.MUL,
        operands: ["A", "B", "C"],
        category: "arithmetic"
    },

    DIV: {
        code: OPCODES.DIV,
        operands: ["A", "B", "C"],
        category: "arithmetic"
    },

    MOD: {
        code: OPCODES.MOD,
        operands: ["A", "B", "C"],
        category: "arithmetic"
    },

    POW: {
        code: OPCODES.POW,
        operands: ["A", "B", "C"],
        category: "arithmetic"
    },

    IDIV: {
        code: OPCODES.IDIV,
        operands: ["A", "B", "C"],
        category: "arithmetic"
    },

    EQ: {
        code: OPCODES.EQ,
        operands: ["A", "B", "C"],
        category: "comparison"
    },

    NE: {
        code: OPCODES.NE,
        operands: ["A", "B", "C"],
        category: "comparison"
    },

    LT: {
        code: OPCODES.LT,
        operands: ["A", "B", "C"],
        category: "comparison"
    },

    LE: {
        code: OPCODES.LE,
        operands: ["A", "B", "C"],
        category: "comparison"
    },

    GT: {
        code: OPCODES.GT,
        operands: ["A", "B", "C"],
        category: "comparison"
    },

    GE: {
        code: OPCODES.GE,
        operands: ["A", "B", "C"],
        category: "comparison"
    },

    AND: {
        code: OPCODES.AND,
        operands: ["A", "B", "C"],
        category: "logic"
    },

    OR: {
        code: OPCODES.OR,
        operands: ["A", "B", "C"],
        category: "logic"
    },

    NOT: {
        code: OPCODES.NOT,
        operands: ["A", "B"],
        category: "logic"
    },

    NEG: {
        code: OPCODES.NEG,
        operands: ["A", "B"],
        category: "arithmetic"
    },

    CONCAT: {
        code: OPCODES.CONCAT,
        operands: ["A", "B", "C"],
        category: "string"
    },

    LEN: {
        code: OPCODES.LEN,
        operands: ["A", "B"],
        category: "string"
    },

    CALL: {
        code: OPCODES.CALL,
        operands: ["A", "B", "C"],
        category: "call"
    },

    RETURN: {
        code: OPCODES.RETURN,
        operands: ["A", "COUNT"],
        category: "control"
    },

    JMP: {
        code: OPCODES.JMP,
        operands: ["TARGET"],
        category: "control"
    },

    JMPIF: {
        code: OPCODES.JMPIF,
        operands: ["A", "TARGET"],
        category: "control"
    },

    JMPIFNOT: {
        code: OPCODES.JMPIFNOT,
        operands: ["A", "TARGET"],
        category: "control"
    },

    CLOSURE: {
        code: OPCODES.CLOSURE,
        operands: ["A", "PROTO"],
        category: "function"
    },

    FORPREP: {
        code: OPCODES.FORPREP,
        operands: ["A", "B", "C"],
        category: "loop"
    },

    FORLOOP: {
        code: OPCODES.FORLOOP,
        operands: ["A", "B", "TARGET"],
        category: "loop"
    },

    POP: {
        code: OPCODES.POP,
        operands: ["A"],
        category: "stack"
    },

    TEST: {
        code: OPCODES.TEST,
        operands: ["A", "TARGET"],
        category: "control"
    },

    TESTSET: {
        code: OPCODES.TESTSET,
        operands: ["A", "B", "TARGET"],
        category: "control"
    },

    DUP: {
        code: OPCODES.DUP,
        operands: ["A", "B"],
        category: "register"
    },

    SWAP: {
        code: OPCODES.SWAP,
        operands: ["A", "B"],
        category: "register"
    },

    LOADBOOL: {
        code: OPCODES.LOADBOOL,
        operands: ["A", "VALUE"],
        category: "constant"
    },

    LOADNIL: {
        code: OPCODES.LOADNIL,
        operands: ["A"],
        category: "constant"
    },

    VARARG: {
        code: OPCODES.VARARG,
        operands: ["A", "COUNT"],
        category: "function"
    },

    SELF: {
        code: OPCODES.SELF,
        operands: ["A", "B", "C"],
        category: "call"
    },

    CLOSE: {
        code: OPCODES.CLOSE,
        operands: ["A"],
        category: "function"
    },

    HALT: {
        code: OPCODES.HALT,
        operands: [],
        category: "system"
    },

    TRAP: {
        code: OPCODES.TRAP,
        operands: ["ID"],
        category: "system"
    }
});

function opcodeName(code) {
    return OPCODE_NAMES[code] || "UNKNOWN";
}

function opcodeCode(name) {
    return OPCODES[name] ?? -1;
}

function isValidOpcode(code) {
    return (
        Number.isInteger(code) &&
        OPCODE_NAMES[code] !== undefined
    );
}

function getOpcodeInfo(opcode) {
    const name =
        typeof opcode === "number"
            ? opcodeName(opcode)
            : opcode;

    return OPCODE_INFO[name] || null;
}

function encode(opcode, a = 0, b = 0, c = 0) {
    const code =
        typeof opcode === "string"
            ? opcodeCode(opcode)
            : opcode;

    if (!isValidOpcode(code)) {
        throw new Error(
            `Invalid opcode: ${opcode}`
        );
    }

    return Object.freeze({
        op: code,
        a: a | 0,
        b: b | 0,
        c: c | 0
    });
}

function decode(instruction) {
    if (
        instruction === null ||
        typeof instruction !== "object"
    ) {
        throw new Error(
            "Invalid VM instruction"
        );
    }

    const op =
        typeof instruction.op === "string"
            ? opcodeCode(instruction.op)
            : instruction.op;

    return {
        name: opcodeName(op),
        op,
        a: instruction.a | 0,
        b: instruction.b | 0,
        c: instruction.c | 0,
        extra: instruction.extra
    };
}

module.exports = {
    OPCODES,
    OPCODE_NAMES,
    OPCODE_INFO,
    opcodeName,
    opcodeCode,
    isValidOpcode,
    getOpcodeInfo,
    encode,
    decode
};
