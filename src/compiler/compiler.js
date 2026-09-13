import * as AST from "../ast/types.js";

class CompilerError extends Error {
    constructor(message, node = null) {
        super(message);
        this.name = "CompilerError";
        this.node = node;
    }
}

const OPCODE = Object.freeze({
    NOP: 0,
    LOADK: 1,
    MOVE: 2,
    GETGLOBAL: 3,
    SETGLOBAL: 4,
    GETUPVAL: 5,
    SETUPVAL: 6,
    NEWTABLE: 7,
    GETTABLE: 8,
    SETTABLE: 9,
    ADD: 10,
    SUB: 11,
    MUL: 12,
    DIV: 13,
    MOD: 14,
    POW: 15,
    EQ: 16,
    NE: 17,
    LT: 18,
    LE: 19,
    GT: 20,
    GE: 21,
    AND: 22,
    OR: 23,
    NOT: 24,
    NEG: 25,
    CALL: 26,
    RETURN: 27,
    JMP: 28,
    JMPIF: 29,
    JMPIFNOT: 30,
    CLOSURE: 31,
    SETLOCAL: 32,
    GETLOCAL: 33,
    FORPREP: 34,
    FORLOOP: 35,
    CONCAT: 36,
    LEN: 37,
    POP: 38,
    HALT: 39
});

class Instruction {
    constructor(op, a = 0, b = 0, c = 0, extra = null) {
        this.op = op;
        this.a = a;
        this.b = b;
        this.c = c;

        if (extra !== null) {
            this.extra = extra;
        }
    }

    clone() {
        return new Instruction(
            this.op,
            this.a,
            this.b,
            this.c,
            this.extra ?? null
        );
    }
}

class ConstantPool {
    constructor() {
        this.values = [];
        this.map = new Map();
    }

    key(value) {
        if (value === null) {
            return "nil";
        }

        if (typeof value === "string") {
            return `s:${value}`;
        }

        if (typeof value === "number") {
            return `n:${value}`;
        }

        if (typeof value === "boolean") {
            return `b:${value}`;
        }

        return JSON.stringify(value);
    }

    add(value) {
        const key = this.key(value);

        if (this.map.has(key)) {
            return this.map.get(key);
        }

        const index = this.values.length;

        this.values.push(value);
        this.map.set(key, index);

        return index;
    }

    get(index) {
        return this.values[index];
    }
}

class RegisterAllocator {
    constructor() {
        this.next = 0;
        this.max = 0;
        this.free = [];
    }

    allocate() {
        let register;

        if (this.free.length > 0) {
            register = this.free.pop();
        } else {
            register = this.next++;
        }

        this.max = Math.max(
            this.max,
            register + 1
        );

        return register;
    }

    release(register) {
        if (
            Number.isInteger(register) &&
            register >= 0 &&
            !this.free.includes(register)
        ) {
            this.free.push(register);
        }
    }
}

class CompilerScope {
    constructor(parent = null) {
        this.parent = parent;
        this.instructions = [];
        this.constants = new ConstantPool();
        this.registers = new RegisterAllocator();

        this.locals = new Map();
        this.upvalues = new Map();

        this.labels = [];
        this.pendingJumps = [];

        this.functions = [];
    }

    emit(op, a = 0, b = 0, c = 0, extra = null) {
        const instruction = new Instruction(
            op,
            a,
            b,
            c,
            extra
        );

        this.instructions.push(instruction);

        return this.instructions.length - 1;
    }

    patch(index, target) {
        if (!this.instructions[index]) {
            throw new CompilerError(
                `Invalid patch location ${index}`
            );
        }

        this.instructions[index].extra = target;
    }

    createLabel() {
        return {
            position: null
        };
    }

    markLabel(label) {
        label.position = this.instructions.length;
    }
}

class Compiler {
    constructor(options = {}) {
        this.options = {
            optimize: options.optimize !== false,
            debug: options.debug === true,
            registerLimit: options.registerLimit || 255,
            ...options
        };

        this.root = null;
    }

    compile(program) {
        if (
            !program ||
            program.type !== AST.NodeType.Program
        ) {
            throw new CompilerError(
                "Compiler expected Program AST"
            );
        }

        this.root = new CompilerScope();

        this.compileBlock(
            this.root,
            program.body
        );

        if (
            this.root.instructions.length === 0 ||
            this.root.instructions[
                this.root.instructions.length - 1
            ].op !== OPCODE.RETURN
        ) {
            this.root.emit(
                OPCODE.RETURN,
                0,
                0,
                0
            );
        }

        this.resolveJumps(this.root);

        return this.buildChunk(
            this.root
        );
    }

    buildChunk(scope) {
        return {
            name: "Zisuay",
            watermark: "zis_obfuscator",
            version: 1,

            code: scope.instructions.map(
                instruction => ({
                    op: instruction.op,
                    a: instruction.a,
                    b: instruction.b,
                    c: instruction.c,
                    ...(instruction.extra !== undefined &&
                    instruction.extra !== null
                        ? {
                            extra: instruction.extra
                        }
                        : {})
                })
            ),

            constants:
                scope.constants.values.slice(),

            maxRegisters:
                scope.registers.max,

            functions:
                scope.functions.map(
                    child => this.buildChunk(child)
                )
        };
    }

    compileBlock(scope, statements) {
        for (const statement of statements || []) {
            this.compileStatement(
                scope,
                statement
            );
        }
    }

    compileStatement(scope, statement) {
        if (!statement) {
            return;
        }

        switch (statement.type) {
            case AST.NodeType.LocalDeclaration:
                this.compileLocal(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.AssignmentStatement:
                this.compileAssignment(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.ExpressionStatement:
                this.compileExpressionStatement(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.ReturnStatement:
                this.compileReturn(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.BreakStatement:
                this.compileBreak(scope);
                break;

            case AST.NodeType.ContinueStatement:
                this.compileContinue(scope);
                break;

            case AST.NodeType.IfStatement:
                this.compileIf(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.WhileStatement:
                this.compileWhile(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.RepeatStatement:
                this.compileRepeat(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.ForNumericStatement:
                this.compileNumericFor(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.ForGenericStatement:
                this.compileGenericFor(
                    scope,
                    statement
                );
                break;

            case AST.NodeType.FunctionDeclaration:
                this.compileFunctionDeclaration(
                    scope,
                    statement
                );
                break;

            default:
                throw new CompilerError(
                    `Unsupported statement ${statement.type}`,
                    statement
                );
        }
    }

    compileLocal(scope, statement) {
        const names = statement.names || [];
        const expressions = statement.expressions || [];

        for (let i = 0; i < names.length; i++) {
            const name = names[i].name;

            const register =
                scope.registers.allocate();

            scope.locals.set(
                name,
                register
            );

            if (expressions[i]) {
                const source =
                    this.compileExpression(
                        scope,
                        expressions[i]
                    );

                scope.emit(
                    OPCODE.SETLOCAL,
                    register,
                    source
                );

                scope.registers.release(
                    source
                );
            } else {
                const constant =
                    scope.constants.add(null);

                scope.emit(
                    OPCODE.LOADK,
                    register,
                    constant
                );
            }
        }

        for (
            let i = names.length;
            i < expressions.length;
            i++
        ) {
            const temp =
                this.compileExpression(
                    scope,
                    expressions[i]
                );

            scope.registers.release(temp);
        }
    }

    compileAssignment(scope, statement) {
        const expressions =
            statement.expressions || [];

        const variables =
            statement.variables || [];

        const values =
            expressions.map(
                expression =>
                    this.compileExpression(
                        scope,
                        expression
                    )
            );

        for (
            let i = 0;
            i < variables.length;
            i++
        ) {
            const target =
                variables[i];

            const source =
                values[
                    Math.min(
                        i,
                        values.length - 1
                    )
                ];

            if (source === undefined) {
                continue;
            }

            this.compileStore(
                scope,
                target,
                source
            );
        }

        for (const register of values) {
            scope.registers.release(
                register
            );
        }
    }

    compileStore(scope, target, source) {
        switch (target.type) {
            case AST.NodeType.Identifier: {
                const local =
                    this.resolveLocal(
                        scope,
                        target.name
                    );

                if (local !== null) {
                    scope.emit(
                        OPCODE.SETLOCAL,
                        local,
                        source
                    );
                } else {
                    const constant =
                        scope.constants.add(
                            target.name
                        );

                    scope.emit(
                        OPCODE.SETGLOBAL,
                        constant,
                        source
                    );
                }

                return;
            }

            case AST.NodeType.MemberExpression: {
                const object =
                    this.compileExpression(
                        scope,
                        target.object
                    );

                const property =
                    scope.constants.add(
                        target.property.name
                    );

                scope.emit(
                    OPCODE.SETTABLE,
                    object,
                    property,
                    source
                );

                scope.registers.release(
                    object
                );

                return;
            }

            case AST.NodeType.IndexExpression: {
                const object =
                    this.compileExpression(
                        scope,
                        target.object
                    );

                const index =
                    this.compileExpression(
                        scope,
                        target.index
                    );

                scope.emit(
                    OPCODE.SETTABLE,
                    object,
                    index,
                    source
                );

                scope.registers.release(
                    object
                );

                scope.registers.release(
                    index
                );

                return;
            }

            default:
                throw new CompilerError(
                    "Invalid assignment target",
                    target
                );
        }
    }

    compileExpressionStatement(scope, statement) {
        const register =
            this.compileExpression(
                scope,
                statement.expression
            );

        scope.emit(
            OPCODE.POP,
            register
        );

        scope.registers.release(
            register
        );
    }

    compileReturn(scope, statement) {
        const expressions =
            statement.expressions || [];

        if (expressions.length === 0) {
            scope.emit(
                OPCODE.RETURN,
                0,
                0
            );

            return;
        }

        const values =
            expressions.map(
                expression =>
                    this.compileExpression(
                        scope,
                        expression
                    )
            );

        const first = values[0];

        scope.emit(
            OPCODE.RETURN,
            first,
            values.length
        );

        for (const register of values) {
            scope.registers.release(
                register
            );
        }
    }

    compileBreak(scope) {
        const jump =
            scope.emit(
                OPCODE.JMP,
                0,
                0,
                0,
                null
            );

        scope.pendingJumps.push({
            index: jump,
            type: "break"
        });
    }

    compileContinue(scope) {
        const jump =
            scope.emit(
                OPCODE.JMP,
                0,
                0,
                0,
                null
            );

        scope.pendingJumps.push({
            index: jump,
            type: "continue"
        });
    }

    compileIf(scope, statement) {
        const condition =
            this.compileExpression(
                scope,
                statement.test
            );

        const falseJump =
            scope.emit(
                OPCODE.JMPIFNOT,
                condition,
                0,
                0,
                null
            );

        scope.registers.release(
            condition
        );

        this.compileBlock(
            scope,
            statement.consequent
        );

        if (statement.alternate) {
            const endJump =
                scope.emit(
                    OPCODE.JMP,
                    0,
                    0,
                    0,
                    null
                );

            const elseTarget =
                scope.instructions.length;

            scope.patch(
                falseJump,
                elseTarget
            );

            this.compileBlock(
                scope,
                statement.alternate
            );

            const endTarget =
                scope.instructions.length;

            scope.patch(
                endJump,
                endTarget
            );
        } else {
            scope.patch(
                falseJump,
                scope.instructions.length
            );
        }
    }

    compileWhile(scope, statement) {
        const loopStart =
            scope.instructions.length;

        const condition =
            this.compileExpression(
                scope,
                statement.test
            );

        const exitJump =
            scope.emit(
                OPCODE.JMPIFNOT,
                condition,
                0,
                0,
                null
            );

        scope.registers.release(
            condition
        );

        this.compileBlock(
            scope,
            statement.body
        );

        scope.emit(
            OPCODE.JMP,
            0,
            0,
            0,
            loopStart
        );

        scope.patch(
            exitJump,
            scope.instructions.length
        );

        this.patchLoopControl(
            scope,
            loopStart,
            scope.instructions.length
        );
    }

    compileRepeat(scope, statement) {
        const loopStart =
            scope.instructions.length;

        this.compileBlock(
            scope,
            statement.body
        );

        const condition =
            this.compileExpression(
                scope,
                statement.test
            );

        scope.emit(
            OPCODE.JMPIFNOT,
            condition,
            0,
            0,
            loopStart
        );

        scope.registers.release(
            condition
        );

        this.patchLoopControl(
            scope,
            loopStart,
            scope.instructions.length
        );
    }

    compileNumericFor(scope, statement) {
        const start =
            this.compileExpression(
                scope,
                statement.start
            );

        const end =
            this.compileExpression(
                scope,
                statement.end
            );

        const step =
            statement.step
                ? this.compileExpression(
                    scope,
                    statement.step
                )
                : this.loadConstant(
                    scope,
                    1
                );

        const variable =
            scope.registers.allocate();

        scope.locals.set(
            statement.variable.name,
            variable
        );

        const prepIndex =
            scope.emit(
                OPCODE.FORPREP,
                variable,
                start,
                end,
                {
                    step,
                    target: null
                }
            );

        const bodyStart =
            scope.instructions.length;

        this.compileBlock(
            scope,
            statement.body
        );

        scope.emit(
            OPCODE.FORLOOP,
            variable,
            step,
            0,
            bodyStart
        );

        const exit =
            scope.instructions.length;

        scope.instructions[
            prepIndex
        ].extra.target = exit;

        scope.registers.release(start);
        scope.registers.release(end);
        scope.registers.release(step);
    }

    compileGenericFor(scope, statement) {
        const iterators =
            statement.iterators || [];

        const iterator =
            this.compileExpression(
                scope,
                iterators[0]
            );

        const state =
            iterators[1]
                ? this.compileExpression(
                    scope,
                    iterators[1]
                )
                : this.loadConstant(
                    scope,
                    null
                );

        const control =
            iterators[2]
                ? this.compileExpression(
                    scope,
                    iterators[2]
                )
                : this.loadConstant(
                    scope,
                    null
                );

        const variables =
            (statement.variables || []).map(
                variable => {
                    const register =
                        scope.registers.allocate();

                    scope.locals.set(
                        variable.name,
                        register
                    );

                    return register;
                }
            );

        const call =
            scope.emit(
                OPCODE.CALL,
                iterator,
                3,
                variables.length,
                {
                    state,
                    control,
                    exit: null
                }
            );

        const bodyStart =
            scope.instructions.length;

        this.compileBlock(
            scope,
            statement.body
        );

        scope.emit(
            OPCODE.JMP,
            0,
            0,
            0,
            call
        );

        const exit =
            scope.instructions.length;

        scope.instructions[
            call
        ].extra.exit = exit;

        scope.registers.release(
            iterator
        );

        scope.registers.release(
            state
        );

        scope.registers.release(
            control
        );

        for (const register of variables) {
            scope.registers.release(
                register
            );
        }
    }

    compileFunctionDeclaration(scope, statement) {
        const child =
            new CompilerScope(scope);

        for (
            const parameter of
            statement.parameters || []
        ) {
            const register =
                child.registers.allocate();

            child.locals.set(
                parameter.name,
                register
            );
        }

        this.compileBlock(
            child,
            statement.body
        );

        if (
            child.instructions.length === 0 ||
            child.instructions[
                child.instructions.length - 1
            ].op !== OPCODE.RETURN
        ) {
            child.emit(
                OPCODE.RETURN,
                0,
                0
            );
        }

        this.resolveJumps(child);

        const functionIndex =
            scope.functions.length;

        scope.functions.push(child);

        const destination =
            this.getOrCreateVariableRegister(
                scope,
                statement.name
            );

        scope.emit(
            OPCODE.CLOSURE,
            destination,
            functionIndex,
            0
        );
    }

    compileExpression(scope, expression) {
        if (!expression) {
            return this.loadConstant(
                scope,
                null
            );
        }

        switch (expression.type) {
            case AST.NodeType.Identifier:
                return this.compileIdentifier(
                    scope,
                    expression
                );

            case AST.NodeType.NumberLiteral:
                return this.loadConstant(
                    scope,
                    expression.value
                );

            case AST.NodeType.StringLiteral:
                return this.loadConstant(
                    scope,
                    expression.value
                );

            case AST.NodeType.BooleanLiteral:
                return this.loadConstant(
                    scope,
                    expression.value
                );

            case AST.NodeType.NilLiteral:
                return this.loadConstant(
                    scope,
                    null
                );

            case AST.NodeType.VarargExpression:
                return this.loadConstant(
                    scope,
                    "..."
                );

            case AST.NodeType.UnaryExpression:
                return this.compileUnary(
                    scope,
                    expression
                );

            case AST.NodeType.BinaryExpression:
                return this.compileBinary(
                    scope,
                    expression
                );

            case AST.NodeType.CallExpression:
                return this.compileCall(
                    scope,
                    expression
                );

            case AST.NodeType.MethodCallExpression:
                return this.compileMethodCall(
                    scope,
                    expression
                );

            case AST.NodeType.MemberExpression:
                return this.compileMember(
                    scope,
                    expression
                );

            case AST.NodeType.IndexExpression:
                return this.compileIndex(
                    scope,
                    expression
                );

            case AST.NodeType.TableExpression:
                return this.compileTable(
                    scope,
                    expression
                );

            case AST.NodeType.FunctionExpression:
                return this.compileFunctionExpression(
                    scope,
                    expression
                );

            default:
                throw new CompilerError(
                    `Unsupported expression ${expression.type}`,
                    expression
                );
        }
    }

    compileIdentifier(scope, expression) {
        const local =
            this.resolveLocal(
                scope,
                expression.name
            );

        if (local !== null) {
            const destination =
                scope.registers.allocate();

            scope.emit(
                OPCODE.GETLOCAL,
                destination,
                local
            );

            return destination;
        }

        const destination =
            scope.registers.allocate();

        const constant =
            scope.constants.add(
                expression.name
            );

        scope.emit(
            OPCODE.GETGLOBAL,
            destination,
            constant
        );

        return destination;
    }

    compileUnary(scope, expression) {
        const argument =
            this.compileExpression(
                scope,
                expression.argument
            );

        const destination =
            scope.registers.allocate();

        switch (expression.operator) {
            case "-":
                scope.emit(
                    OPCODE.NEG,
                    destination,
                    argument
                );
                break;

            case "not":
                scope.emit(
                    OPCODE.NOT,
                    destination,
                    argument
                );
                break;

            case "#":
                scope.emit(
                    OPCODE.LEN,
                    destination,
                    argument
                );
                break;

            default:
                throw new CompilerError(
                    `Unsupported unary operator ${expression.operator}`
                );
        }

        scope.registers.release(
            argument
        );

        return destination;
    }

    compileBinary(scope, expression) {
        const left =
            this.compileExpression(
                scope,
                expression.left
            );

        const right =
            this.compileExpression(
                scope,
                expression.right
            );

        const destination =
            scope.registers.allocate();

        const opcode =
            this.binaryOpcode(
                expression.operator
            );

        scope.emit(
            opcode,
            destination,
            left,
            right
        );

        scope.registers.release(left);
        scope.registers.release(right);

        return destination;
    }

    compileCall(scope, expression) {
        const callee =
            this.compileExpression(
                scope,
                expression.callee
            );

        const args =
            (expression.arguments || []).map(
                argument =>
                    this.compileExpression(
                        scope,
                        argument
                    )
            );

        const destination =
            scope.registers.allocate();

        scope.emit(
            OPCODE.CALL,
            destination,
            callee,
            args.length,
            {
                args
            }
        );

        scope.registers.release(callee);

        for (const register of args) {
            scope.registers.release(register);
        }

        return destination;
    }

    compileMethodCall(scope, expression) {
        const object =
            this.compileExpression(
                scope,
                expression.object
            );

        const method =
            scope.constants.add(
                expression.method.name
            );

        const args =
            (expression.arguments || []).map(
                argument =>
                    this.compileExpression(
                        scope,
                        argument
                    )
            );

        const destination =
            scope.registers.allocate();

        scope.emit(
            OPCODE.CALL,
            destination,
            object,
            args.length + 1,
            {
                method,
                args,
                self: true
            }
        );

        scope.registers.release(object);

        for (const register of args) {
            scope.registers.release(register);
        }

        return destination;
    }

    compileMember(scope, expression) {
        const object =
            this.compileExpression(
                scope,
                expression.object
            );

        const property =
            scope.constants.add(
                expression.property.name
            );

        const destination =
            scope.registers.allocate();

        scope.emit(
            OPCODE.GETTABLE,
            destination,
            object,
            property
        );

        scope.registers.release(object);

        return destination;
    }

    compileIndex(scope, expression) {
        const object =
            this.compileExpression(
                scope,
                expression.object
            );

        const index =
            this.compileExpression(
                scope,
                expression.index
            );

        const destination =
            scope.registers.allocate();

        scope.emit(
            OPCODE.GETTABLE,
            destination,
            object,
            index
        );

        scope.registers.release(object);
        scope.registers.release(index);

        return destination;
    }

    compileTable(scope, expression) {
        const fields = expression.fields || [];

        const destination =
            scope.registers.allocate();

        scope.emit(
            OPCODE.NEWTABLE,
            destination,
            fields.length
        );

        let arrayIndex = 1;

        for (const field of fields) {
            if (
                field.type === AST.NodeType.TableField
            ) {
                const value =
                    this.compileExpression(
                        scope,
                        field.value
                    );

                const key =
                    this.loadConstant(
                        scope,
                        arrayIndex++
                    );

                scope.emit(
                    OPCODE.SETTABLE,
                    destination,
                    key,
                    value
                );

                scope.registers.release(key);
                scope.registers.release(value);

                continue;
            }

            if (
                field.type ===
                AST.NodeType.TableKeyField
            ) {
                const key =
                    this.loadConstant(
                        scope,
                        field.key.name
                    );

                const value =
                    this.compileExpression(
                        scope,
                        field.value
                    );

                scope.emit(
                    OPCODE.SETTABLE,
                    destination,
                    key,
                    value
                );

                scope.registers.release(key);
                scope.registers.release(value);

                continue;
            }

            if (
                field.type ===
                AST.NodeType.TableIndexField
            ) {
                const key =
                    this.compileExpression(
                        scope,
                        field.index
                    );

                const value =
                    this.compileExpression(
                        scope,
                        field.value
                    );

                scope.emit(
                    OPCODE.SETTABLE,
                    destination,
                    key,
                    value
                );

                scope.registers.release(key);
                scope.registers.release(value);
            }
        }

        return destination;
    }

    compileFunctionExpression(scope, expression) {
        const child =
            new CompilerScope(scope);

        for (
            const parameter of
            expression.parameters || []
        ) {
            const register =
                child.registers.allocate();

            child.locals.set(
                parameter.name,
                register
            );
        }

        this.compileBlock(
            child,
            expression.body
        );

        if (
            child.instructions.length === 0 ||
            child.instructions[
                child.instructions.length - 1
            ].op !== OPCODE.RETURN
        ) {
            child.emit(
                OPCODE.RETURN,
                0,
                0
            );
        }

        this.resolveJumps(child);

        const functionIndex =
            scope.functions.length;

        scope.functions.push(child);

        const destination =
            scope.registers.allocate();

        scope.emit(
            OPCODE.CLOSURE,
            destination,
            functionIndex,
            0
        );

        return destination;
    }

    loadConstant(scope, value) {
        const destination =
            scope.registers.allocate();

        const constant =
            scope.constants.add(value);

        scope.emit(
            OPCODE.LOADK,
            destination,
            constant
        );

        return destination;
    }

    getOrCreateVariableRegister(scope, name) {
        if (
            name &&
            name.type === AST.NodeType.Identifier
        ) {
            if (scope.locals.has(name.name)) {
                return scope.locals.get(
                    name.name
                );
            }

            const register =
                scope.registers.allocate();

            scope.locals.set(
                name.name,
                register
            );

            return register;
        }

        if (typeof name === "string") {
            if (scope.locals.has(name)) {
                return scope.locals.get(name);
            }

            const register =
                scope.registers.allocate();

            scope.locals.set(
                name,
                register
            );

            return register;
        }

        throw new CompilerError(
            "Invalid function declaration name"
        );
    }

    resolveLocal(scope, name) {
        let current = scope;

        while (current) {
            if (current.locals.has(name)) {
                return current.locals.get(name);
            }

            current = current.parent;
        }

        return null;
    }

    binaryOpcode(operator) {
        const map = {
            "+": OPCODE.ADD,
            "-": OPCODE.SUB,
            "*": OPCODE.MUL,
            "/": OPCODE.DIV,
            "//": OPCODE.DIV,
            "%": OPCODE.MOD,
            "^": OPCODE.POW,

            "==": OPCODE.EQ,
            "~=": OPCODE.NE,
            "<": OPCODE.LT,
            "<=": OPCODE.LE,
            ">": OPCODE.GT,
            ">=": OPCODE.GE,

            "and": OPCODE.AND,
            "or": OPCODE.OR,

            "..": OPCODE.CONCAT
        };

        const opcode = map[operator];

        if (opcode === undefined) {
            throw new CompilerError(
                `Unsupported binary operator ${operator}`
            );
        }

        return opcode;
    }

    patchLoopControl(
        scope,
        continueTarget,
        breakTarget
    ) {
        for (const jump of scope.pendingJumps) {
            if (jump.type === "break") {
                scope.patch(
                    jump.index,
                    breakTarget
                );
            } else if (
                jump.type === "continue"
            ) {
                scope.patch(
                    jump.index,
                    continueTarget
                );
            }
        }

        scope.pendingJumps =
            scope.pendingJumps.filter(
                jump =>
                    jump.type !== "break" &&
                    jump.type !== "continue"
            );
    }

    resolveJumps(scope) {
        for (
            const instruction of
            scope.instructions
        ) {
            if (
                instruction.extra &&
                typeof instruction.extra === "object"
            ) {
                if (
                    instruction.extra.target !==
                        undefined &&
                    instruction.extra.target !== null
                ) {
                    instruction.extra.target =
                        Number(
                            instruction.extra.target
                        );
                }

                if (
                    instruction.extra.exit !==
                        undefined &&
                    instruction.extra.exit !== null
                ) {
                    instruction.extra.exit =
                        Number(
                            instruction.extra.exit
                        );
                }
            }
        }
    }
}

export {
    Compiler,
    CompilerError,
    Instruction,
    ConstantPool,
    RegisterAllocator,
    CompilerScope,
    OPCODE
};

export default Compiler;
