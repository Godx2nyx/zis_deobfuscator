import { TokenType } from "../lexer/token.js";
import * as AST from "../ast/types.js";

class ParserError extends Error {
    constructor(message, token = null) {
        const location = token
            ? ` at ${token.line}:${token.column}`
            : "";

        super(`${message}${location}`);

        this.name = "ParserError";
        this.token = token;
    }
}

class Parser {
    constructor(tokens = []) {
        this.tokens = tokens;
        this.position = 0;
    }

    current() {
        return (
            this.tokens[this.position] ||
            this.tokens[this.tokens.length - 1]
        );
    }

    peek(offset = 1) {
        return (
            this.tokens[this.position + offset] ||
            this.tokens[this.tokens.length - 1]
        );
    }

    advance() {
        const token = this.current();

        if (
            this.position <
            this.tokens.length - 1
        ) {
            this.position++;
        }

        return token;
    }

    check(type) {
        return this.current().type === type;
    }

    match(type) {
        if (this.check(type)) {
            return this.advance();
        }

        return null;
    }

    expect(type, message = null) {
        const token = this.current();

        if (token.type !== type) {
            throw new ParserError(
                message ||
                `Expected ${type}, got ${token.type}`,
                token
            );
        }

        return this.advance();
    }

    parse() {
        const body = this.parseBlock(
            new Set([TokenType.EOF])
        );

        this.expect(
            TokenType.EOF
        );

        return new AST.Program(body);
    }

    parseBlock(stopTokens = new Set()) {
        const body = [];

        while (
            !stopTokens.has(
                this.current().type
            ) &&
            !this.check(TokenType.EOF)
        ) {
            body.push(
                this.parseStatement()
            );
        }

        return body;
    }

    parseStatement() {
        switch (this.current().type) {
            case TokenType.Local:
                return this.parseLocal();

            case TokenType.Function:
                return this.parseFunctionDeclaration();

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
                return new AST.BreakStatement();

            case TokenType.Continue:
                this.advance();
                return new AST.ContinueStatement();

            default:
                return this.parseExpressionOrAssignment();
        }
    }

    parseLocal() {
        this.expect(
            TokenType.Local
        );

        if (
            this.match(TokenType.Function)
        ) {
            const name =
                this.parseIdentifier();

            const body =
                this.parseFunctionBody();

            return new AST.FunctionDeclaration(
                name,
                body.parameters,
                body.body,
                true,
                false
            );
        }

        const names = [];

        names.push(
            this.parseIdentifier()
        );

        while (
            this.match(TokenType.Comma)
        ) {
            names.push(
                this.parseIdentifier()
            );
        }

        const expressions =
            this.match(TokenType.Assign)
                ? this.parseExpressionList()
                : [];

        return new AST.LocalDeclaration(
            names,
            expressions
        );
    }

    parseFunctionDeclaration() {
        this.expect(
            TokenType.Function
        );

        const nameParts = [
            this.parseIdentifier()
        ];

        while (
            this.match(TokenType.Dot)
        ) {
            nameParts.push(
                this.parseIdentifier()
            );
        }

        let isMethod = false;

        if (
            this.match(TokenType.Colon)
        ) {
            nameParts.push(
                this.parseIdentifier()
            );

            isMethod = true;
        }

        const body =
            this.parseFunctionBody();

        let name = nameParts[0];

        if (nameParts.length > 1) {
            let expression =
                nameParts[0];

            for (
                let i = 1;
                i < nameParts.length;
                i++
            ) {
                expression =
                    new AST.MemberExpression(
                        expression,
                        nameParts[i],
                        false
                    );
            }

            name = expression;
        }

        return new AST.FunctionDeclaration(
            name,
            body.parameters,
            body.body,
            false,
            isMethod
        );
    }

    parseFunctionBody() {
        this.expect(
            TokenType.LeftParen
        );

        const parameters = [];

        if (
            !this.check(
                TokenType.RightParen
            )
        ) {
            if (
                this.check(
                    TokenType.Vararg
                )
            ) {
                this.advance();

                parameters.push(
                    new AST.VarargExpression()
                );
            } else {
                parameters.push(
                    this.parseIdentifier()
                );

                while (
                    this.match(TokenType.Comma)
                ) {
                    if (
                        this.check(
                            TokenType.Vararg
                        )
                    ) {
                        this.advance();

                        parameters.push(
                            new AST.VarargExpression()
                        );

                        break;
                    }

                    parameters.push(
                        this.parseIdentifier()
                    );
                }
            }
        }

        this.expect(
            TokenType.RightParen
        );

        const body =
            this.parseBlock(
                new Set([
                    TokenType.End
                ])
            );

        this.expect(
            TokenType.End
        );

        return {
            parameters,
            body
        };
    }

    parseIf() {
        this.expect(
            TokenType.If
        );

        const test =
            this.parseExpression();

        this.expect(
            TokenType.Then
        );

        const consequent =
            this.parseBlock(
                new Set([
                    TokenType.ElseIf,
                    TokenType.Else,
                    TokenType.End
                ])
            );

        let alternate = null;

        if (
            this.match(TokenType.ElseIf)
        ) {
            this.position--;

            alternate = [
                this.parseIf()
            ];
        } else if (
            this.match(TokenType.Else)
        ) {
            alternate =
                this.parseBlock(
                    new Set([
                        TokenType.End
                    ])
                );
        }

        this.expect(
            TokenType.End
        );

        return new AST.IfStatement(
            test,
            consequent,
            alternate
        );
    }

    parseWhile() {
        this.expect(
            TokenType.While
        );

        const test =
            this.parseExpression();

        this.expect(
            TokenType.Do
        );

        const body =
            this.parseBlock(
                new Set([
                    TokenType.End
                ])
            );

        this.expect(
            TokenType.End
        );

        return new AST.WhileStatement(
            test,
            body
        );
    }

    parseRepeat() {
        this.expect(
            TokenType.Repeat
        );

        const body =
            this.parseBlock(
                new Set([
                    TokenType.Until
                ])
            );

        this.expect(
            TokenType.Until
        );

        const test =
            this.parseExpression();

        return new AST.RepeatStatement(
            body,
            test
        );
    }

    parseFor() {
        this.expect(
            TokenType.For
        );

        const first =
            this.parseIdentifier();

        if (
            this.match(TokenType.Assign)
        ) {
            const start =
                this.parseExpression();

            this.expect(
                TokenType.Comma
            );

            const end =
                this.parseExpression();

            let step = null;

            if (
                this.match(TokenType.Comma)
            ) {
                step =
                    this.parseExpression();
            }

            this.expect(
                TokenType.Do
            );

            const body =
                this.parseBlock(
                    new Set([
                        TokenType.End
                    ])
                );

            this.expect(
                TokenType.End
            );

            return new AST.ForNumericStatement(
                first,
                start,
                end,
                step,
                body
            );
        }

        const variables = [first];

        while (
            this.match(TokenType.Comma)
        ) {
            variables.push(
                this.parseIdentifier()
            );
        }

        this.expect(
            TokenType.In
        );

        const iterators =
            this.parseExpressionList();

        this.expect(
            TokenType.Do
        );

        const body =
            this.parseBlock(
                new Set([
                    TokenType.End
                ])
            );

        this.expect(
            TokenType.End
        );

        return new AST.ForGenericStatement(
            variables,
            iterators,
            body
        );
    }

    parseReturn() {
        this.expect(
            TokenType.Return
        );

        if (
            this.check(TokenType.End) ||
            this.check(TokenType.Else) ||
            this.check(TokenType.ElseIf) ||
            this.check(TokenType.Until) ||
            this.check(TokenType.EOF)
        ) {
            return new AST.ReturnStatement([]);
        }

        const expressions =
            this.parseExpressionList();

        this.match(
            TokenType.Semicolon
        );

        return new AST.ReturnStatement(
            expressions
        );
    }

    parseExpressionOrAssignment() {
        const first =
            this.parseExpression();

        if (
            this.check(TokenType.Assign) ||
            this.check(TokenType.Comma)
        ) {
            const variables = [first];

            while (
                this.match(TokenType.Comma)
            ) {
                variables.push(
                    this.parseExpression()
                );
            }

            this.expect(
                TokenType.Assign
            );

            const expressions =
                this.parseExpressionList();

            return new AST.AssignmentStatement(
                variables,
                expressions
            );
        }

        return new AST.ExpressionStatement(
            first
        );
    }

    parseExpressionList() {
        const expressions = [
            this.parseExpression()
        ];

        while (
            this.match(TokenType.Comma)
        ) {
            expressions.push(
                this.parseExpression()
            );
        }

        return expressions;
    }

    parseExpression(minPrecedence = 0) {
        let left =
            this.parseUnary();

        while (true) {
            const operator =
                this.getBinaryOperator();

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

            const nextPrecedence =
                operator.rightAssociative
                    ? operator.precedence
                    : operator.precedence + 1;

            const right =
                this.parseExpression(
                    nextPrecedence
                );

            left =
                new AST.BinaryExpression(
                    operator.value,
                    left,
                    right
                );
        }

        return left;
    }

    parseUnary() {
        const token =
            this.current();

        if (
            token.type === TokenType.Not ||
            token.type === TokenType.Minus ||
            token.type === TokenType.Plus
        ) {
            this.advance();

            const argument =
                this.parseUnary();

            return new AST.UnaryExpression(
                token.type === TokenType.Not
                    ? "not"
                    : token.value,
                argument
            );
        }

        return this.parsePrefixExpression();
    }

    parsePrefixExpression() {
        let expression =
            this.parsePrimary();

        while (true) {
            if (
                this.match(TokenType.Dot)
            ) {
                const property =
                    this.parseIdentifier();

                expression =
                    new AST.MemberExpression(
                        expression,
                        property,
                        false
                    );

                continue;
            }

            if (
                this.match(TokenType.LeftBracket)
            ) {
                const index =
                    this.parseExpression();

                this.expect(
                    TokenType.RightBracket
                );

                expression =
                    new AST.IndexExpression(
                        expression,
                        index
                    );

                continue;
            }

            if (
                this.match(TokenType.Colon)
            ) {
                const method =
                    this.parseIdentifier();

                const args =
                    this.parseCallArguments();

                expression =
                    new AST.MethodCallExpression(
                        expression,
                        method,
                        args
                    );

                continue;
            }

            if (
                this.check(
                    TokenType.LeftParen
                )
            ) {
                const args =
                    this.parseCallArguments();

                expression =
                    new AST.CallExpression(
                        expression,
                        args
                    );

                continue;
            }

            if (
                this.check(
                    TokenType.LeftBrace
                )
            ) {
                const args = [
                    this.parseTableExpression()
                ];

                expression =
                    new AST.CallExpression(
                        expression,
                        args
                    );

                continue;
            }

            if (
                this.check(
                    TokenType.String
                )
            ) {
                const string =
                    this.parsePrimary();

                expression =
                    new AST.CallExpression(
                        expression,
                        [string]
                    );

                continue;
            }

            break;
        }

        return expression;
    }

    parseCallArguments() {
        this.expect(
            TokenType.LeftParen
        );

        const argumentsList = [];

        if (
            !this.check(
                TokenType.RightParen
            )
        ) {
            argumentsList.push(
                this.parseExpression()
            );

            while (
                this.match(TokenType.Comma)
            ) {
                argumentsList.push(
                    this.parseExpression()
                );
            }
        }

        this.expect(
            TokenType.RightParen
        );

        return argumentsList;
    }

    parsePrimary() {
        const token =
            this.current();

        switch (token.type) {
            case TokenType.Number:
                this.advance();

                return new AST.NumberLiteral(
                    token.value
                );

            case TokenType.String:
                this.advance();

                return new AST.StringLiteral(
                    token.value
                );

            case TokenType.True:
                this.advance();

                return new AST.BooleanLiteral(
                    true
                );

            case TokenType.False:
                this.advance();

                return new AST.BooleanLiteral(
                    false
                );

            case TokenType.Nil:
                this.advance();

                return new AST.NilLiteral();

            case TokenType.Vararg:
                this.advance();

                return new AST.VarargExpression();

            case TokenType.Identifier:
                return this.parseIdentifier();

            case TokenType.Function:
                return this.parseFunctionExpression();

            case TokenType.LeftParen: {
                this.advance();

                const expression =
                    this.parseExpression();

                this.expect(
                    TokenType.RightParen
                );

                return expression;
            }

            case TokenType.LeftBrace:
                return this.parseTableExpression();

            default:
                throw new ParserError(
                    `Unexpected token ${token.type}`,
                    token
                );
        }
    }

    parseIdentifier() {
        const token =
            this.expect(
                TokenType.Identifier,
                "Expected identifier"
            );

        return new AST.Identifier(
            token.value
        );
    }

    parseFunctionExpression() {
        this.expect(
            TokenType.Function
        );

        const body =
            this.parseFunctionBody();

        return new AST.FunctionExpression(
            body.parameters,
            body.body
        );
    }

    parseTableExpression() {
        this.expect(
            TokenType.LeftBrace
        );

        const fields = [];

        while (
            !this.check(
                TokenType.RightBrace
            )
        ) {
            if (
                this.check(
                    TokenType.LeftBracket
                )
            ) {
                this.advance();

                const index =
                    this.parseExpression();

                this.expect(
                    TokenType.RightBracket
                );

                this.expect(
                    TokenType.Assign
                );

                const value =
                    this.parseExpression();

                fields.push(
                    new AST.TableIndexField(
                        index,
                        value
                    )
                );
            } else if (
                this.check(
                    TokenType.Identifier
                ) &&
                this.peek().type ===
                    TokenType.Assign
            ) {
                const key =
                    this.parseIdentifier();

                this.expect(
                    TokenType.Assign
                );

                const value =
                    this.parseExpression();

                fields.push(
                    new AST.TableKeyField(
                        key,
                        value
                    )
                );
            } else {
                fields.push(
                    new AST.TableField(
                        this.parseExpression()
                    )
                );
            }

            if (
                !this.match(
                    TokenType.Comma
                )
            ) {
                this.match(
                    TokenType.Semicolon
                );

                if (
                    !this.check(
                        TokenType.RightBrace
                    )
                ) {
                    continue;
                }
            }
        }

        this.expect(
            TokenType.RightBrace
        );

        return new AST.TableExpression(
            fields
        );
    }

    getBinaryOperator() {
        const map = {
            [TokenType.Or]: {
                value: "or",
                precedence: 1,
                rightAssociative: false
            },

            [TokenType.And]: {
                value: "and",
                precedence: 2,
                rightAssociative: false
            },

            [TokenType.Equal]: {
                value: "==",
                precedence: 3,
                rightAssociative: false
            },

            [TokenType.NotEqual]: {
                value: "~=",
                precedence: 3,
                rightAssociative: false
            },

            [TokenType.Less]: {
                value: "<",
                precedence: 3,
                rightAssociative: false
            },

            [TokenType.LessEqual]: {
                value: "<=",
                precedence: 3,
                rightAssociative: false
            },

            [TokenType.Greater]: {
                value: ">",
                precedence: 3,
                rightAssociative: false
            },

            [TokenType.GreaterEqual]: {
                value: ">=",
                precedence: 3,
                rightAssociative: false
            },

            [TokenType.Plus]: {
                value: "+",
                precedence: 4,
                rightAssociative: false
            },

            [TokenType.Minus]: {
                value: "-",
                precedence: 4,
                rightAssociative: false
            },

            [TokenType.Multiply]: {
                value: "*",
                precedence: 5,
                rightAssociative: false
            },

            [TokenType.Divide]: {
                value: "/",
                precedence: 5,
                rightAssociative: false
            },

            [TokenType.FloorDivide]: {
                value: "//",
                precedence: 5,
                rightAssociative: false
            },

            [TokenType.Modulo]: {
                value: "%",
                precedence: 5,
                rightAssociative: false
            },

            [TokenType.Concat]: {
                value: "..",
                precedence: 6,
                rightAssociative: true
            },

            [TokenType.Power]: {
                value: "^",
                precedence: 7,
                rightAssociative: true
            }
        };

        return map[this.current().type] || null;
    }
}

export {
    Parser,
    ParserError
};

export default Parser;
