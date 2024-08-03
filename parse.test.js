import { parse } from "@babel/parser";
import { infer } from "./inference.js";

function babelExprToInfExpr(expr) {
  if (expr.type === "Identifier") {
    return { nodeType: "Var", name: expr.name }
  }
  if (expr.type === "NumericLiteral") {
    return { nodeType: "Number", value: expr.value }
  }
  if (expr.type === "StringLiteral") {
    return { nodeType: "String", value: expr.value }
  }
  if (expr.type === "BlockStatement") {
    return { nodeType: "Block", body: expr.body.map(babelExprToInfExpr) }
  }
  if (expr.type === "VariableDeclaration") {
    return { nodeType: "Let", name: expr.declarations[0].id.name, rhs: babelExprToInfExpr(expr.declarations[0].init) }
  }
  if (expr.type === "BinaryExpression") {
    return { nodeType: "Call", func: { nodeType: "Var", name: expr.operator }, args: [babelExprToInfExpr(expr.right), babelExprToInfExpr(expr.right)] }
  }
  if (expr.type === "FunctionDeclaration") {
    return { nodeType: "Let", name: expr.id.name, rhs: { nodeType: "Function", params: expr.params.map(p => p.name), body: babelExprToInfExpr(expr.body) } }
  }
  if (expr.type === "ReturnStatement") {
    return { nodeType: "Return", rhs: babelExprToInfExpr(expr.argument) }
  }
  if (expr.type === "ExpressionStatement") {
    return babelExprToInfExpr(expr.expression)
  }
  if (expr.type === "CallExpression") {
    return { nodeType: "Call", func: { nodeType: "Var", name: expr.callee.name }, args: expr.arguments.map(babelExprToInfExpr) }
  }
  if (expr.type === "AssignmentExpression") {
    return { nodeType: "Assign", name: expr.left.name, rhs: babelExprToInfExpr(expr.right) }
  }
  if (expr.type === "IfStatement") {
    const else_ = expr.alternate ? babelExprToInfExpr(expr.alternate) : null;
    return { nodeType: "If", condition: babelExprToInfExpr(expr.test), then: babelExprToInfExpr(expr.consequent), else: else_ }
  }
}

/**
  * @param {string} name
  * @param {string | inf.Expression} _rhs
  * @returns {inf.Expression}
  */
function eLet(
  name,
  _rhs,
) {
  const rhs = e(_rhs);
  return {
    nodeType: "Let",
    name, rhs
  }
}

/**
  * @param {string} name
  * @param {string | inf.Expression} _rhs
  * @returns {inf.Expression}
  */
function eAssign(
  name,
  _rhs,
) {
  const rhs = e(_rhs);
  return {
    nodeType: "Assign",
    name, rhs
  }
}

/**
  * @param {inf.Expression | string} expr
  * @returns {inf.Expression}
  */
function e(expr) {
  if (typeof expr === "string") {
    return v(expr);
  } else {
    return expr;
  }
}

/**
  * @param {string} name
  * @returns {inf.Expression}
  */
function v(name) {
  return {
    nodeType: "Var",
    name: name
  };
}

/**
  * @param {number} value
  * @returns {inf.Expression}
  */
function i(value) {
  return {
    nodeType: "Number",
    value: value
  };
}

/**
  * @returns {inf.Expression}
  */
function u() {
  return {
    nodeType: "Undefined"
  };
}

/**
  * @param {string} value
  * @returns {inf.Expression}
  */
function s(value) {
  return {
    nodeType: "String",
    value: value
  };
}

/**
  * @param {inf.Type[]} types
  * @returns {inf.Type}
  */
function un(...types) {
  return {
    nodeType: "Union",
    types: types
  }
}

/**
  * @param {string[]} params
  * @param {(inf.Expression | inf.Return | string)[]} body
  * @returns {inf.Expression}
  */
function f(params, body) {
  return {
    nodeType: "Function",
    params: params,
    body: body.map(body => typeof body === "string" ? v(body) : body)
  };
}

/**
  * @param {inf.Expression | string} expr
  * @returns {inf.Return}
  */
function ret(expr) {
  return {
    nodeType: "Return",
    rhs: typeof expr === "string" ? v(expr) : expr
  }
}

/**
  * @param {inf.Expression | string} f
  * @param {(inf.Expression | string)[]} _args
  * @returns {inf.Expression}
  */
function c(f, ..._args) {
  const args = _args.map(a => typeof a === "string" ? v(a) : a);
  return {
    nodeType: "Call",
    func: typeof f === "string" ? v(f) : f,
    args: args
  }
}

/**
  * @param {string} name
  * @returns {inf.Type}
  */
function tn(name) {
  return {
    nodeType: "Named",
    name: name
  };
}

/**
  * @param {string} name
  * @returns {inf.Type}
  */
function tv(name) {
  return {
    nodeType: "Var",
    name: name
  };
}

/**
  * @param {inf.Type[]} types
  * @param {inf.Type} to
  * @returns {inf.Type}
  */
function tfunc(types, to) {
  return {
    nodeType: "Function",
    from: types,
    to: to
  };
}

const initialEnv = {
  "parseInt": tfunc([tn("String"), un(tn("Number"), tn("Undefined"))], tn("Number")),
  "+": tfunc([tn("Number"), tn("Number")], tn("Number")),
};

function checkCode(code) {
  let res = parse(code)
  let ast = res.program.body

  let infAst = ast.map(babelExprToInfExpr);

  let startCtx = { next: 0, env: initialEnv }
  infAst.reduce((ctx, expr) => {
    let [_1, _2, ctx1] = infer(ctx, expr)
    return ctx1;
  }, startCtx)
}


let code = `
function myFunction() {
  if (1) {
    return 1;
  } else {
    return "String";
  }
}
let x = myFunction();
x = "123";
`

checkCode(code)
