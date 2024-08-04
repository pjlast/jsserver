import { expect, test } from "bun:test";
import * as inf from "./inference.js";
import { unify } from "./inference.js";

// Named types must equal
test("named types", () => {
  expect(unify(tn("number"), tn("number"))).toEqual({});
  expect(() => unify(tn("number"), tn("string"))).toThrow();
})

// When var is compared with named, a subst is returned
test("var and named", () => {
  expect(unify(tv("x"), tn("number"))).toEqual({
    x: tn("number")
  });
  expect(unify(tn("number"), tv("x"))).toEqual({
    x: tn("number")
  });
})

// Two vars are unified
test("var and var", () => {
  expect(unify(tv("x"), tv("x"))).toEqual({});
  expect(unify(tv("x"), tv("y"))).toEqual({
    x: tv("y")
  });
})

// Unions only match when the right side "fits" into
// the left side. i.e. {number | string} = {number},
// but {number} != {number | string}, since you cannot
// assign a possible string to a number.
test("unions", () => {
  expect(unify(un(tn("number"), tn("string")), tn("number"))).toEqual({});
  expect(unify(un(tn("number"), tn("string")), tn("string"))).toEqual({});
  expect(() => unify(un(tn("number"), tn("string")), tn("undefined"))).toThrow();
  expect(() => unify(un(tn("number"), tn("string")), tn("null"))).toThrow();

  expect(() => unify(tn("number"), un(tn("number"), tn("string")))).toThrow();
  expect(() =>
    unify(tn("string"), un(tn("number"), tn("string")))
  ).toThrow();
  expect(() =>
    unify(tn("undefined"), un(tn("number"), tn("string")))
  ).toThrow();
  expect(() =>
    unify(tn("null"), un(tn("number"), tn("string")))
  ).toThrow();

  expect(unify(un(tn("number"), tn("string")), un(tn("number"), tn("string")))).toEqual({});

  // Unions with a var leads to subst
  expect(unify(un(tn("number"), tn("string")), un(tn("number"), tv("x")))).toEqual({
    x: un(tn("number"), tn("string"))
  });
  expect(unify(un(tn("number"), tv("x")), un(tn("number"), tn("string")))).toEqual({
    x: tn("string")
  });
})

test("functions", () => {
  expect(unify(tfunc([], tn("number")), tfunc([], tn("number")))).toEqual({});
  expect(unify(tfunc([], tv("x")), tfunc([], tn("number")))).toEqual({
    x: tn("number")
  });
  expect(unify(tfunc([], tn("number")), tfunc([], tv("x")))).toEqual({
    x: tn("number")
  });
})

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
    name, rhs, loc
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
    name, rhs, loc
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
  * @returns {inf.EVar}
  */
function v(name) {
  return {
    nodeType: "Var",
    name: name, loc
  };
}

/**
  * @param {number} value
  * @returns {inf.Expression}
  */
function i(value) {
  return {
    nodeType: "Number",
    value: value, loc
  };
}

/**
  * @returns {inf.Expression}
  */
function u() {
  return {
    nodeType: "Undefined", loc
  };
}

/**
  * @param {string} value
  * @returns {inf.Expression}
  */
function s(value) {
  return {
    nodeType: "String",
    value: value, loc
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
    body: body.map(b => typeof b === "string" ? v(b) : b), loc
  }
}

/**
  * @param {(inf.EVar | inf.EAssign)[]} params
  * @param {(inf.Expression | inf.Block | string)} body
  * @returns {inf.Expression}
  */
function f(params, body) {
  return {
    nodeType: "Function",
    params: params,
    body: typeof body === "string" ? v(body) : body, loc
  };
}

/**
  * @param {inf.Expression | string} expr
  * @returns {inf.Return}
  */
function ret(expr) {
  return {
    nodeType: "Return",
    rhs: typeof expr === "string" ? v(expr) : expr, loc
  }
}

let loc = {
  start: {
    line: 0,
    column: 0,
    index: 0
  },
  end: {
    line: 0,
    column: 0,
    index: 0
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
    args: args,
    loc
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
  "ambig": tfunc([], un(tn("number"), tn("undefined"))),
  "parseInt": tfunc([tn("string"), un(tn("number"), tn("undefined"))], tn("number")),
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
  eLet("x", f([v("a"), v("b"), v("c")], blk([             // let x = (a, b, c) => {
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
