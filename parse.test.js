import { parse } from "@babel/parser";
import { infer } from "./inference.js";
import { babelExprToInfExpr } from "./parse.js";


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
    try {
      let [_1, _2, ctx1] = infer(ctx, expr)
      return ctx1;
    } catch (e) {
      throw { msg: e, loc: expr.loc }
    }
  }, startCtx)
}


let code = `
function myFunction(b, a = 10) { }
`

try {
  checkCode(code)
} catch (e) {
  console.log(e.msg)
  console.log(e.loc)
}
