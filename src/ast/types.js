"use strict";

const NodeType = Object.freeze({
    Program: "Program",

    Identifier: "Identifier",
    NumberLiteral: "NumberLiteral",
    StringLiteral: "StringLiteral",
    BooleanLiteral: "BooleanLiteral",
    NilLiteral: "NilLiteral",

    VarargExpression: "VarargExpression",

    UnaryExpression: "UnaryExpression",
    BinaryExpression: "BinaryExpression",

    CallExpression: "CallExpression",
    MethodCallExpression: "MethodCallExpression",

    MemberExpression: "MemberExpression",
    IndexExpression: "IndexExpression",

    TableExpression: "TableExpression",
    TableField: "TableField",
    TableIndexField: "TableIndexField",
    TableKeyField: "TableKeyField",

    FunctionExpression: "FunctionExpression",

    AssignmentStatement: "AssignmentStatement",
    LocalDeclaration: "LocalDeclaration",

    ExpressionStatement: "ExpressionStatement",

    ReturnStatement: "ReturnStatement",
    BreakStatement: "BreakStatement",
    ContinueStatement: "ContinueStatement",

    BlockStatement: "BlockStatement",

    IfStatement: "IfStatement",
    WhileStatement: "WhileStatement",
    RepeatStatement: "RepeatStatement",
    ForNumericStatement: "ForNumericStatement",
    ForGenericStatement: "ForGenericStatement",

    FunctionDeclaration: "FunctionDeclaration"
});

function node(type, fields = {}) {
    return {
        type,
        ...fields
    };
}

function Program(body = []) {
    return node(NodeType.Program, {
        body
    });
}

function Identifier(name) {
    return node(NodeType.Identifier, {
        name
    });
}

function NumberLiteral(value, raw = null) {
    return node(NodeType.NumberLiteral, {
        value,
        raw: raw ?? String(value)
    });
}

function StringLiteral(value, raw = null) {
    return node(NodeType.StringLiteral, {
        value,
        raw: raw ?? JSON.stringify(value)
    });
}

function BooleanLiteral(value) {
    return node(NodeType.BooleanLiteral, {
        value: Boolean(value)
    });
}

function NilLiteral() {
    return node(NodeType.NilLiteral);
}

function VarargExpression() {
    return node(NodeType.VarargExpression);
}

function UnaryExpression(operator, argument) {
    return node(NodeType.UnaryExpression, {
        operator,
        argument
    });
}

function BinaryExpression(operator, left, right) {
    return node(NodeType.BinaryExpression, {
        operator,
        left,
        right
    });
}

function CallExpression(callee, args = []) {
    return node(NodeType.CallExpression, {
        callee,
        arguments: args
    });
}

function MethodCallExpression(object, method, args = []) {
    return node(NodeType.MethodCallExpression, {
        object,
        method,
        arguments: args
    });
}

function MemberExpression(object, property) {
    return node(NodeType.MemberExpression, {
        object,
        property
    });
}

function IndexExpression(object, index) {
    return node(NodeType.IndexExpression, {
        object,
        index
    });
}

function TableExpression(fields = []) {
    return node(NodeType.TableExpression, {
        fields
    });
}

function TableField(value) {
    return node(NodeType.TableField, {
        value
    });
}

function TableIndexField(index, value) {
    return node(NodeType.TableIndexField, {
        index,
        value
    });
}

function TableKeyField(key, value) {
    return node(NodeType.TableKeyField, {
        key,
        value
    });
}

function FunctionExpression(parameters = [], body = [], isVararg = false) {
    return node(NodeType.FunctionExpression, {
        parameters,
        body,
        isVararg
    });
}

function AssignmentStatement(variables = [], expressions = []) {
    return node(NodeType.AssignmentStatement, {
        variables,
        expressions
    });
}

function LocalDeclaration(names = [], expressions = []) {
    return node(NodeType.LocalDeclaration, {
        names,
        expressions
    });
}

function ExpressionStatement(expression) {
    return node(NodeType.ExpressionStatement, {
        expression
    });
}

function ReturnStatement(expressions = []) {
    return node(NodeType.ReturnStatement, {
        expressions
    });
}

function BreakStatement() {
    return node(NodeType.BreakStatement);
}

function ContinueStatement() {
    return node(NodeType.ContinueStatement);
}

function BlockStatement(body = []) {
    return node(NodeType.BlockStatement, {
        body
    });
}

function IfStatement(test, consequent = [], alternate = null) {
    return node(NodeType.IfStatement, {
        test,
        consequent,
        alternate
    });
}

function WhileStatement(test, body = []) {
    return node(NodeType.WhileStatement, {
        test,
        body
    });
}

function RepeatStatement(body = [], test = null) {
    return node(NodeType.RepeatStatement, {
        body,
        test
    });
}

function ForNumericStatement(
    variable,
    start,
    end,
    step = null,
    body = []
) {
    return node(NodeType.ForNumericStatement, {
        variable,
        start,
        end,
        step,
        body
    });
}

function ForGenericStatement(
    variables = [],
    iterators = [],
    body = []
) {
    return node(NodeType.ForGenericStatement, {
        variables,
        iterators,
        body
    });
}

function FunctionDeclaration(
    name,
    parameters = [],
    body = [],
    isLocal = false,
    isMethod = false
) {
    return node(NodeType.FunctionDeclaration, {
        name,
        parameters,
        body,
        isLocal,
        isMethod
    });
}

function isNode(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        typeof value.type === "string"
    );
}

function cloneNode(value) {
    if (!isNode(value)) {
        if (Array.isArray(value)) {
            return value.map(cloneNode);
        }

        if (
            value !== null &&
            typeof value === "object"
        ) {
            const result = {};

            for (const [key, item] of Object.entries(value)) {
                result[key] = cloneNode(item);
            }

            return result;
        }

        return value;
    }

    const result = {};

    for (const [key, item] of Object.entries(value)) {
        result[key] = cloneNode(item);
    }

    return result;
}

module.exports = {
    NodeType,

    node,

    Program,

    Identifier,
    NumberLiteral,
    StringLiteral,
    BooleanLiteral,
    NilLiteral,
    VarargExpression,

    UnaryExpression,
    BinaryExpression,

    CallExpression,
    MethodCallExpression,

    MemberExpression,
    IndexExpression,

    TableExpression,
    TableField,
    TableIndexField,
    TableKeyField,

    FunctionExpression,

    AssignmentStatement,
    LocalDeclaration,
    ExpressionStatement,

    ReturnStatement,
    BreakStatement,
    ContinueStatement,

    BlockStatement,

    IfStatement,
    WhileStatement,
    RepeatStatement,
    ForNumericStatement,
    ForGenericStatement,

    FunctionDeclaration,

    isNode,
    cloneNode
};
