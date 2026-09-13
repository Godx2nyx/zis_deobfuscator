import { TokenType } from "../lexer/token.js";
import * as AST from "../ast/types.js";

class ParserError extends Error {
    constructor(message, token) {
        super(
            `${message} at ${token?.line ?? 0}:${token?.column ?? 0}`
        );

        this.name = "ParserError";
        this.token = token;
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens || [];
        this.position = 0;
    }

    parse() {
        const body = this.parseBlock([]);

        this.expect(
            TokenType.EOF,
            "Expected end of input"
        );

        return AST.Program(body);
    }

    current() {
        return this.tokens[this.position];
    }

    previous() {
        return this.tokens[this.position - 1];
    }

    peek(offset = 1) {
        return this.tokens[this.position + offset];
    }

    advance() {
        if (!this.isAtEnd()) {
            this.position++;
        }

        return this.previous();
    }

    check(type) {
        return this.current()?.type === type;
    }

    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }

        return false;
    }

    expect(type, message) {
        if (!this.check(type)) {
            throw new ParserError(
                message || `Expected ${type}`,
                this.current()
            );
        }

        return this.advance();
    }

    isAtEnd() {
        return this.check(TokenType.EOF);
    }

    parseBlock(terminators = []) {
        const statements = [];

        while (
            !this.isAtEnd() &&
            !terminators.includes(this.current().type)
        ) {
            if (this.match(TokenType.Semicolon)) {
                continue;
            }

            statements.push(
                this.parseStatement()
            );

            this.match(TokenType.Semicolon);
        }

        return statements;
    }

    parseStatement() {
        const token = this.current();

        switch (token.type) {
            case TokenType.Local:
                return this.parseLocal();

            case TokenType.Function:
                return this.parseFunctionDeclaration(false);

            case TokenType.If:
                return this.parseIf();

            case TokenType.While:
                return this.parseWhile();

            case TokenType.Repeat:
                return this.parseRepeat();

            case TokenType.For:
                return this.parseFor();

            case TokenType.Return:
                return this.parseReturn();

            case TokenType.Break:
                this.advance();
                return AST.BreakStatement();

            case TokenType.Continue:
                this.advance();
                return AST.ContinueStatement();

            default:
                return this.parseExpressionOrAssignment();
        }
    }

    parseLocal() {
        this.expect(TokenType.Local);

        if (this.check(TokenType.Function)) {
            this.advance();

            return this.parseFunctionDeclaration(true);
        }

        const names = [];

        names.push(
            this.expectIdentifier(
                "Expected local variable name"
            )
        );

        while (this.match(TokenType.Comma)) {
            names.push(
                this.expectIdentifier(
                    "Expected local variable name"
                )
            );
        }

        const expressions = [];

        if (this.match(TokenType.Assign)) {
            expressions.push(
                ...this.parseExpressionList()
            );
        }

        return AST.LocalDeclaration(
            names,
            expressions
        );
    }

    parseFunctionDeclaration(isLocal) {
        this.expect(
            TokenType.Function,
            "Expected function"
        );

        let name = this.expectIdentifier(
            "Expected function name"
        );

        let isMethod = false;

        while (
            this.match(
                TokenType.Dot,
                TokenType.Colon
            )
        ) {
            const separator = this.previous();

            const part = this.expectIdentifier(
                "Expected function name component"
            );

            if (
                separator.type ===
                TokenType.Colon
            ) {
                isMethod = true;
            }

            name = AST.MemberExpression(
                name,
                part
            );
        }

        const {
            parameters,
            body,
            isVararg
        } = this.parseFunctionBody();

        return AST.FunctionDeclaration(
            name,
            parameters,
            body,
            isLocal,
            isMethod
        );
    }

    parseFunctionBody() {
        this.expect(
            TokenType.LeftParen,
            "Expected '(' after function name"
        );

        const parameters = [];
        let isVararg = false;

        if (!this.check(TokenType.RightParen)) {
            if (this.match(TokenType.Vararg)) {
                isVararg = true;
            } else {
                parameters.push(
                    this.expectIdentifier(
                        "Expected parameter name"
                    )
                );

                while (this.match(TokenType.Comma)) {
                    if (
                        this.match(TokenType.Vararg)
                    ) {
                        isVararg = true;
                        break;
                    }

                    parameters.push(
                        this.expectIdentifier(
                            "Expected parameter name"
                        )
                    );
                }
            }
        }

        this.expect(
            TokenType.RightParen,
            "Expected ')'"
        );

        const body = this.parseBlock([
            TokenType.End
        ]);

        this.expect(
            TokenType.End,
            "Expected 'end'"
        );

        return {
            parameters,
            body,
            isVararg
        };
    }

    parseIf() {
        this.expect(TokenType.If);

        const test = this.parseExpression();

        this.expect(
            TokenType.Then,
            "Expected 'then'"
        );

        const consequent = this.parseBlock([
            TokenType.ElseIf,
            TokenType.Else,
            TokenType.End
        ]);

        let alternate = null;

        if (this.match(TokenType.ElseIf)) {
            const elseifTest =
                this.parseExpression();

            this.expect(
                TokenType.Then,
                "Expected 'then'"
            );

            const elseifConsequent =
                this.parseBlock([
                    TokenType.ElseIf,
                    TokenType.Else,
                    TokenType.End
                ]);

            let elseifAlternate = null;

            if (this.match(TokenType.ElseIf)) {
                this.position--;

                elseifAlternate = [
                    this.parseIf()
                ];
            } else if (
                this.match(TokenType.Else)
            ) {
                elseifAlternate =
                    this.parseBlock([
                        TokenType.End
                    ]);
            }

            alternate = [
                AST.IfStatement(
                    elseifTest,
                    elseifConsequent,
                    elseifAlternate
                )
            ];
        } else if (
            this.match(TokenType.Else)
        ) {
            alternate = this.parseBlock([
                TokenType.End
            ]);
        }

        this.expect(
            TokenType.End,
            "Expected 'end'"
        );

        return AST.IfStatement(
            test,
            consequent,
            alternate
        );
    }

    parseWhile() {
        this.expect(TokenType.While);

        const test = this.parseExpression();

        this.expect(
            TokenType.Do,
            "Expected 'do'"
        );

        const body = this.parseBlock([
            TokenType.End
        ]);

        this.expect(
            TokenType.End,
            "Expected 'end'"
        );

        return AST.WhileStatement(
            test,
            body
        );
    }

    parseRepeat() {
        this.expect(TokenType.Repeat);

        const body = this.parseBlock([
            TokenType.Until
        ]);

        this.expect(
            TokenType.Until,
            "Expected 'until'"
        );

        const test = this.parseExpression();

        return AST.RepeatStatement(
            body,
            test
        );
    }

    parseFor() {
        this.expect(TokenType.For);

        const first = this.expectIdentifier(
            "Expected for variable"
        );

        if (this.match(TokenType.Assign)) {
            const start =
                this.parseExpression();

            this.expect(
                TokenType.Comma,
                "Expected ',' in numeric for"
            );

            const end =
                this.parseExpression();

            let step = null;

            if (this.match(TokenType.Comma)) {
                step =
                    this.parseExpression();
            }

            this.expect(
                TokenType.Do,
                "Expected 'do'"
            );

            const body = this.parseBlock([
                TokenType.End
            ]);

            this.expect(
                TokenType.End,
                "Expected 'end'"
            );

            return AST.ForNumericStatement(
                first,
                start,
                end,
                step,
                body
            );
        }

        const variables = [first];

        while (this.match(TokenType.Comma)) {
            variables.push(
                this.expectIdentifier(
                    "Expected for variable"
                )
            );
        }

        this.expect(
            TokenType.In,
            "Expected 'in'"
        );

        const iterators =
            this.parseExpressionList();

        this.expect(
            TokenType.Do,
            "Expected 'do'"
        );

        const body = this.parseBlock([
            TokenType.End
        ]);

        this.expect(
            TokenType.End,
            "Expected 'end'"
        );

        return AST.ForGenericStatement(
            variables,
            iterators,
            body
        );
    }

    parseReturn() {
        this.expect(TokenType.Return);

        if (
            this.check(TokenType.End) ||
            this.check(TokenType.Else) ||
            this.check(TokenType.ElseIf) ||
            this.check(TokenType.Until) ||
            this.check(TokenType.EOF) ||
            this.check(TokenType.Semicolon)
        ) {
            return AST.ReturnStatement([]);
        }

        return AST.ReturnStatement(
            this.parseExpressionList()
        );
    }

    parseExpressionOrAssignment() {
        const first =
            this.parsePrefixExpression();

        if (
            this.check(TokenType.Assign) ||
            this.check(TokenType.Comma)
        ) {
            const variables = [first];

            while (this.match(TokenType.Comma)) {
                variables.push(
                    this.parseAssignable()
                );
            }

            this.expect(
                TokenType.Assign,
                "Expected '='"
            );

            const expressions =
                this.parseExpressionList();

            return AST.AssignmentStatement(
                variables,
                expressions
            );
        }

        return AST.ExpressionStatement(first);
    }

    parseAssignable() {
        const expression =
            this.parsePrefixExpression();

        if (
            expression.type !==
                AST.NodeType.Identifier &&
            expression.type !==
                AST.NodeType.MemberExpression &&
            expression.type !==
                AST.NodeType.IndexExpression
        ) {
            throw new ParserError(
                "Invalid assignment target",
                this.previous()
            );
        }

        return expression;
    }

    parseExpressionList() {
        const expressions = [
            this.parseExpression()
        ];

        while (this.match(TokenType.Comma)) {
            expressions.push(
                this.parseExpression()
            );
        }

        return expressions;
    }

    parseExpression() {
        return this.parseBinaryExpression(0);
    }

    parseBinaryExpression(minPrecedence) {
        let left =
            this.parseUnaryExpression();

        while (true) {
            const operator =
                this.getBinaryOperator(
                    this.current()
                );

            if (!operator) {
                break;
            }

            if (
                operator.precedence <
                minPrecedence
            ) {
                break;
            }

            this.advance();

            const right =
                this.parseBinaryExpression(
                    operator.rightAssociative
                        ? operator.precedence
                        : operator.precedence + 1
                );

            left = AST.BinaryExpression(
                operator.value,
                left,
                right
            );
        }

        return left;
    }

    parseUnaryExpression() {
        if (
            this.match(
                TokenType.Not,
                TokenType.Minus
            )
        ) {
            const operator =
                this.previous().value;

            return AST.UnaryExpression(
                operator,
                this.parseUnaryExpression()
            );
        }

        return this.parsePrefixExpression();
    }

    parsePrefixExpression() {
        let expression =
            this.parsePrimaryExpression();

        while (true) {
            if (this.match(TokenType.Dot)) {
                const property =
                    this.expectIdentifier(
                        "Expected property name"
                    );

                expression =
                    AST.MemberExpression(
                        expression,
                        property
                    );

                continue;
            }

            if (
                this.match(TokenType.LeftBracket)
            ) {
                const index =
                    this.parseExpression();

                this.expect(
                    TokenType.RightBracket,
                    "Expected ']'"
                );

                expression =
                    AST.IndexExpression(
                        expression,
                        index
                    );

                continue;
            }

            if (this.match(TokenType.Colon)) {
                const method =
                    this.expectIdentifier(
                        "Expected method name"
                    );

                const args =
                    this.parseArguments();

                expression =
                    AST.MethodCallExpression(
                        expression,
                        method,
                        args
                    );

                continue;
            }

            if (
                this.check(TokenType.LeftParen) ||
                this.check(TokenType.LeftBrace) ||
                this.check(TokenType.String)
            ) {
                const args =
                    this.parseArguments();

                expression =
                    AST.CallExpression(
                        expression,
                        args
                    );

                continue;
            }

            break;
        }

        return expression;
    }

    parsePrimaryExpression() {
        const token = this.current();

        switch (token.type) {
            case TokenType.Number:
                this.advance();

                return AST.NumberLiteral(
                    this.parseNumber(token.value),
                    token.value
                );

            case TokenType.String:
                this.advance();

                return AST.StringLiteral(
                    token.value,
                    token.value
                );

            case TokenType.True:
                this.advance();
                return AST.BooleanLiteral(true);

            case TokenType.False:
                this.advance();
                return AST.BooleanLiteral(false);

            case TokenType.Nil:
                this.advance();
                return AST.NilLiteral();

            case TokenType.Vararg:
                this.advance();
                return AST.VarargExpression();

            case TokenType.Identifier:
                this.advance();

                return AST.Identifier(
                    token.value
                );

            case TokenType.Function:
                this.advance();

                return this.parseFunctionExpression();

            case TokenType.LeftParen: {
                this.advance();

                const expression =
                    this.parseExpression();

                this.expect(
                    TokenType.RightParen,
                    "Expected ')'"
                );

                return expression;
            }

            case TokenType.LeftBrace:
                return this.parseTable();

            default:
                throw new ParserError(
                    `Unexpected token ${token.type}`,
                    token
                );
        }
    }

    parseFunctionExpression() {
        const {
            parameters,
            body,
            isVararg
        } = this.parseFunctionBody();

        return AST.FunctionExpression(
            parameters,
            body,
            isVararg
        );
    }

    parseArguments() {
        if (this.match(TokenType.LeftParen)) {
            if (
                this.match(TokenType.RightParen)
            ) {
                return [];
            }

            const args =
                this.parseExpressionList();

            this.expect(
                TokenType.RightParen,
                "Expected ')'"
            );

            return args;
        }

        if (this.check(TokenType.LeftBrace)) {
            return [
                this.parseTable()
            ];
        }

        if (this.check(TokenType.String)) {
            return [
                this.parsePrimaryExpression()
            ];
        }

        throw new ParserError(
            "Expected function arguments",
            this.current()
        );
    }

    parseTable() {
        this.expect(TokenType.LeftBrace);

        const fields = [];

        while (
            !this.check(TokenType.RightBrace) &&
            !this.isAtEnd()
        ) {
            if (this.match(TokenType.LeftBracket)) {
                const index =
                    this.parseExpression();

                this.expect(
                    TokenType.RightBracket,
                    "Expected ']'"
                );

                this.expect(
                    TokenType.Assign,
                    "Expected '='"
                );

                const value =
                    this.parseExpression();

                fields.push(
                    AST.TableIndexField(
                        index,
                        value
                    )
                );
            } else if (
                this.check(TokenType.Identifier) &&
                this.peek()?.type ===
                    TokenType.Assign
            ) {
                const key =
                    this.parsePrimaryExpression();

                this.expect(
                    TokenType.Assign,
                    "Expected '='"
                );

                const value =
                    this.parseExpression();

                fields.push(
                    AST.TableKeyField(
                        key,
                        value
                    )
                );
            } else {
                fields.push(
                    AST.TableField(
                        this.parseExpression()
                    )
                );
            }

            if (
                !this.match(
                    TokenType.Comma,
                    TokenType.Semicolon
                )
            ) {
                break;
            }
        }

        this.expect(
            TokenType.RightBrace,
            "Expected '}'"
        );

        return AST.TableExpression(fields);
    }

    getBinaryOperator(token) {
        if (!token) {
            return null;
        }

        const operators = {
            [TokenType.Or]: {
                value: "or",
                precedence: 1
            },

            [TokenType.And]: {
                value: "and",
                precedence: 2
            },

            [TokenType.Equal]: {
                value: "==",
                precedence: 3
            },

            [TokenType.NotEqual]: {
                value: "~=",
                precedence: 3
            },

            [TokenType.Less]: {
                value: "<",
                precedence: 3
            },

            [TokenType.LessEqual]: {
                value: "<=",
                precedence: 3
            },

            [TokenType.Greater]: {
                value: ">",
                precedence: 3
            },

            [TokenType.GreaterEqual]: {
                value: ">=",
                precedence: 3
            },

            [TokenType.Plus]: {
                value: "+",
                precedence: 4
            },

            [TokenType.Minus]: {
                value: "-",
                precedence: 4
            },

            [TokenType.Multiply]: {
                value: "*",
                precedence: 5
            },

            [TokenType.Divide]: {
                value: "/",
                precedence: 5
            },

            [TokenType.FloorDivide]: {
                value: "//",
                precedence: 5
            },

            [TokenType.Modulo]: {
                value: "%",
                precedence: 5
            },

            [TokenType.Power]: {
                value: "^",
                precedence: 7,
                rightAssociative: true
            }
        };

        return operators[token.type] || null;
    }

    expectIdentifier(message) {
        if (
            !this.check(TokenType.Identifier)
        ) {
            throw new ParserError(
                message || "Expected identifier",
                this.current()
            );
        }

        const token = this.advance();

        return AST.Identifier(
            token.value
        );
    }

    parseNumber(raw) {
        const normalized =
            String(raw).replace(
                /_/g,
                ""
            );

        if (/^0[xX]/.test(normalized)) {
            const value =
                Number(normalized);

            if (Number.isFinite(value)) {
                return value;
            }
        }

        const value =
            Number(normalized);

        if (!Number.isFinite(value)) {
            throw new ParserError(
                `Invalid number ${raw}`,
                this.previous()
            );
        }

        return value;
    }
}

function parse(tokens) {
    return new Parser(tokens).parse();
}

export {
    Parser,
    ParserError,
    parse
};

export default Parser;
