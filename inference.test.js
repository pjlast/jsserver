import * as inf from "./inference.js";

/**
  * @param {string[]} quantifiers
  * @param {inf.Type} type
  * @returns {inf.Forall}
  */
function forall(quantifiers, type) {
  return {
    nodeType: "Forall",
    quantifiers,
    type
  };
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
  * @param {(inf.Expression | inf.Return | inf.Block | string)[]} body
  * @returns {inf.Block}
  */
function blk(body) {
  return {
    nodeType: "Block",
    body: body.map(b => typeof b === "string" ? v(b) : b)
  }
}

/**
  * @param {string[]} params
  * @param {(inf.Expression | inf.Block | string)} body
  * @returns {inf.Expression}
  */
function f(params, body) {
  return {
    nodeType: "Function",
    params: params,
    body: typeof body === "string" ? v(body) : body
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
  "ambig": tfunc([], un(tn("Number"), tn("Undefined"))),
  "parseInt": tfunc([tn("String"), un(tn("Number"), tn("Undefined"))], tn("Number")),
  "identity": tfunc([tv("x")], tv("x")),
};

console.log(
  inf.typeToString(
    inf.infer({
      next: 0,
      env: initialEnv
    },
      c("parseInt", s("1")),
    )[0]
  ));


let [_t1, _1, ctx1] = inf.infer({
  next: 0,
  env: initialEnv
},
  eLet("x", c("ambig"))
);

let [_t0, _0, ctx0] = inf.infer(ctx1,
  eAssign("x", c("ambig"))
);

console.log(
  inf.typeToString(
    inf.infer(ctx0,
      c("parseInt", s("1"), v("x")),
    )[0]
  ));

let [_t2, _2, ctx2] = inf.infer({
  next: 0,
  env: initialEnv
},
  eLet("x", f(["a", "b", "c"], blk([             // let x = (a, b, c) => {
    eLet("y", c("parseInt", v("b"))),        //   let y = parseInt(b);
    eAssign("a", i(456)),                    //   a = 456;
    ret(v("c"))])))                           //   return c;}
);

console.log(inf.typeToString(_t2));

console.log(
  inf.typeToString(
    inf.infer(ctx2,
      c("identity", v("x")),
    )[0]
  ));
