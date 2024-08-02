/**
  * @typedef {TNamed | TVar | TFun | TUnion} Type
  * @typedef {{ nodeType: "Named", name: string }} TNamed
  * @typedef {{ nodeType: "Var", name: string }} TVar
  * @typedef {{ nodeType: "Union", types: Type[] }} TUnion
  * @typedef {{ nodeType: "Function", from: Type[], to: Type }} TFun
  */

/**
  * @typedef {ENumber | EString | EUndefined | ENull | EVar | EFunc | ECall | ELet} Expression
  * @typedef {{nodeType: "Number", value: number}} ENumber
  * @typedef {{nodeType: "String", value: string}} EString
  * @typedef {{nodeType: "Undefined"}} EUndefined
  * @typedef {{nodeType: "Null"}} ENull
  * @typedef {{nodeType: "Var", name: string}} EVar
  * @typedef {{nodeType: "Function", params: string[], body: (Expression | Return)[]}} EFunc
  * @typedef {{nodeType: "Call", func: Expression, args: Expression[]}} ECall
  * @typedef {{nodeType: "Let", name: string, rhs: Expression}} ELet
  */

/** @typedef {{nodeType: "Return", rhs: Expression}} Return */

/**
  * @typedef {{nodeType: "Forall", quantifiers: string[], type: Type}} Forall
  */

/**
  * @typedef {{[name: string]: Type | Forall}} Env
  */

/**
  * @typedef {{next: number, env: Env}} Context
  */

/**
  * @typedef {{[key: string]: Type}} Substitution
  */

/**
  * @typedef {{[name: string]: true}} FreeVars
  */

/**
  * @param {FreeVars} a
  * @param {FreeVars} b
  * @returns {FreeVars}
  */
function union(a, b) {
  return { ...a, ...b };
}

/**
  * @param {FreeVars} a
  * @param {FreeVars} b
  * @returns {FreeVars}
  */
function difference(a, b) {
  const result = { ...a };
  for (const name in b) {

    if (result[name]) {
      delete result[name];
    }
  }
  return result;
}

/**
  * @param {Type} t
  * @returns {FreeVars}
  */
function freeTypeVarsInType(t) {
  switch (t.nodeType) {
    case "Named": return {};
    case "Var": return { [t.name]: true };
    case "Union": return t.types.reduce(
      (freeVars, type) => union(freeVars, freeTypeVarsInType(type)),
      {}
    );
    case "Function":
      return union(
        t.from.reduce(
          (freeVars, from) => union(freeVars, freeTypeVarsInType(from)),
          {}
        ),
        freeTypeVarsInType(t.to)
      );
  }
}

/**
  * @param {Env} env
  * @returns {FreeVars}
  */
function freeTypeVarsInEnv(env) {
  /** @type {FreeVars} */
  let result = {};
  for (const key in env) {
    const t = env[key];
    const freeVars = t.nodeType === "Forall"
      ? freeTypeVarsInForall(t)
      : freeTypeVarsInType(t);
    result = union(result, freeVars);
  }
  return result;
}

/**
  * @param {Forall} t
  * @returns {FreeVars}
  */
function freeTypeVarsInForall(t) {
  /** @type {FreeVars} */
  const quantifiers = {};
  for (const name of t.quantifiers) {
    quantifiers[name] = true;
  }
  const freeInType = freeTypeVarsInType(t.type);
  return difference(freeInType, quantifiers);
}

/**
  * @param {Context} ctx
  * @param {Forall} forall
  * @returns {Type}
  */
function instantiate(ctx, forall) {
  /** @type {Substitution} */
  const subst = {};
  for (const name of forall.quantifiers) {
    const tVar = newTVar(ctx);
    subst[name] = tVar;
  }
  return applySubstToType(subst, forall.type);
}

/**
  * @param {Context} ctx
  * @param {EVar} e
  * @returns {[Type, Substitution, Context]}
  */
function inferVar(ctx, e) {
  const env = ctx.env;
  if (env[e.name]) {
    const envType = env[e.name];
    if (envType.nodeType === "Forall") {
      return [instantiate(ctx, envType), {}, ctx];
    } else {
      return [envType, {}, ctx]
    }
  } else {
    throw `Unbound var ${e.name}`;
  }
}

/**
  * @param {Env} env
  * @param {Type} type
  * @returns {Type | Forall}
  */
function generalize(env, type) {
  const envFreeVars = freeTypeVarsInEnv(env);
  const typeFreeVars = freeTypeVarsInType(type);
  const quantifiers = Object.keys(difference(typeFreeVars, envFreeVars));
  if (quantifiers.length > 0) {
    return {
      nodeType: "Forall",
      quantifiers: quantifiers,
      type: type
    };
  } else {
    return type;
  }
}

/**
  * @param {Context} ctx
  * @param {ELet} expr
  * @returns {[Type, Substitution, Context]}
  */
function inferLet(ctx, expr) {
  const [rhsType, s1] = infer(ctx, expr.rhs);
  const ctx1 = applySubstToCtx(s1, ctx);
  const rhsPolytype = generalize(ctx1.env, rhsType);
  const ctx2 = addToContext(ctx1, expr.name, rhsPolytype);
  return [{ nodeType: "Named", name: "Undefined" }, {}, ctx2];
}

/**
  * @param {Substitution} subst - The substitution.
  * @param {Type} type - The type.
  * @returns {Type} The type with the substitution applied.
  */
function applySubstToType(subst, type) {
  switch (type.nodeType) {
    case "Named": return type;
    case "Union": return { nodeType: "Union", types: type.types.map(t => applySubstToType(subst, t)) };
    case "Var":
      if (subst[type.name]) {
        return subst[type.name];
      } else {
        return type;
      }
    case "Function":
      return {
        nodeType: "Function",
        from: type.from.map(from => applySubstToType(subst, from)),
        to: applySubstToType(subst, type.to)
      };
  }
}

/**
  * @param {Substitution} subst - The substitution.
  * @param {Forall} type - The types.
  * @returns {Forall}
  */
function applySubstToForall(subst, type) {
  const substWithoutBound = { ...subst };
  for (const name of type.quantifiers) {
    delete substWithoutBound[name];
  }
  return {
    ...type,
    type: applySubstToType(substWithoutBound, type.type)
  }
}

/**
  * @param {Substitution} subst - The substitution.
  * @param {TFun} type - The type.
  * @returns {TFun} The type with the substitution applied.
  */
function applySubstToTFun(subst, type) {
  return {
    nodeType: "Function",
    from: type.from.map(from => applySubstToType(subst, from)),
    to: applySubstToType(subst, type.to)
  };
}

/**
  * @param {Context} ctx
  * @param {string} name
  * @param {Type | Forall} type
  * @returns {Context}
  */
function addToContext(ctx, name, type) {
  const newEnv = Object.assign({}, ctx, {
    env: Object.assign({}, ctx.env)
  });
  newEnv.env[name] = type;
  return newEnv;
}

/**
  * @param {Context} ctx
  * @returns {Type}
  */
function newTVar(ctx) {
  const newVarNum = ctx.next;
  ctx.next++;
  return {
    nodeType: "Var",
    name: `T${newVarNum}`
  };
}

/**
  * @param {Context} ctx - The environment.
  * @param {Expression} e - Expression to infer.
  * @returns {[Type, Substitution, Context]} The inferred type.
  * @throws {string} If the expression cannot be inferred.
  */
function infer(ctx, e) {
  switch (e.nodeType) {
    case "Number": return [{ nodeType: "Named", name: "Number" }, {}, ctx];
    case "String": return [{ nodeType: "Named", name: "String" }, {}, ctx];
    case "Undefined": return [{ nodeType: "Named", name: "Undefined" }, {}, ctx];
    case "Null": return [{ nodeType: "Named", name: "Null" }, {}, ctx];
    case "Let": return inferLet(ctx, e);
    case "Var": return inferVar(ctx, e);
    case "Function":
      {
        /** @type {Type[]} */
        let newTypes = [];
        let newCtx = e.params.reduce((ctx, param) => {
          const newType = newTVar(ctx);
          newTypes.push(newType);
          return addToContext(ctx, param, newType);
        }, ctx);

        /** @type {TUnion} */
        let returnType = {
          nodeType: "Union",
          types: []
        }

        /** @type {Substitution} */
        let subst = {};

        e.body.forEach((expr) => {
          if (expr.nodeType === "Return") {
            const [exprType, _subst] = infer(newCtx, expr.rhs);
            subst = composeSubst(subst, _subst);
            returnType.types.push(exprType);
          } else {
            const [_exprType, _subst, resCtx] = infer(newCtx, expr);
            subst = composeSubst(subst, _subst);
            newCtx = resCtx;
          }
        });

        /** @type {Type} */
        const inferredType = {
          nodeType: "Function",
          from: newTypes.map(type => applySubstToType(subst, type)),
          to: returnType
        };

        return [inferredType, subst, ctx];
      }
    case "Call":
      {
        const [funcType, s1] = infer(ctx, e.func);
        const ctx1 = applySubstToCtx(s1, ctx);
        /** @type {Type[]} */
        let argTypes = []
        /** @type {Substitution[]} */
        let substs = []
        e.args.forEach((arg) => {

          const [argType, subst] = infer(ctx1, arg);
          argTypes.push(argType);
          substs.push(subst);
        });
        const s2 = substs.reduce(composeSubst, {});

        const newVar = newTVar(ctx1);
        const s3 = composeSubst(s1, s2);
        const s4 = unify(funcType, {
          nodeType: "Function",
          from: argTypes,
          to: newVar
        });

        if (funcType.nodeType === "Function") {
          const funcType1 = applySubstToTFun(s4, funcType);
          const s5 = composeSubst(s3, s4);
          const types = funcType1.from.map(from => applySubstToType(s5, from));
          const substs = types.map((type, i) => {
            if (argTypes[i]) {
              return unify(type, argTypes[i])
            } else {
              return unify(type, { nodeType: "Named", name: "Undefined" });
            }
          });
          const s6 = substs.reduce((s, s2) => composeSubst(s, s2), {});
          const resultSubst = composeSubst(s5, s6);
          return [applySubstToType(resultSubst, funcType1.to), resultSubst, ctx];
        } else {
          throw `Type mismatch: expected ${typeToString(funcType)}`;
        }
      }
  }
}

/**
  * @param {Type} t1
  * @param {Type} t2
  * @returns {Substitution}
  */
function unify(t1, t2) {
  if (t1.nodeType === "Named"
    && t2.nodeType === "Named"
    && t1.name === t2.name) {
    return {};
  } else if (t1.nodeType === "Var") {
    return varBind(t1.name, t2);
  } else if (t2.nodeType === "Var") {
    return varBind(t2.name, t1);
  } else if (t1.nodeType === "Function" && t2.nodeType === "Function") {
    let t1from = t1.from;
    if (t1from.length > t2.from.length) {
      t1from = t1from.slice(0, t2.from.length);
    }
    const substs = t1from.map((from, i) => unify(from, t2.from[i]));
    const s1 = substs.reduce((s, s2) => composeSubst(s, s2), {});
    const s2 = unify(
      applySubstToType(s1, t1.to),
      applySubstToType(s1, t2.to)
    );
    return composeSubst(s1, s2);
  } else if (t1.nodeType === "Union" && t2.nodeType === "Union") {
    if (t2.types.length > t1.types.length) {
      throw `Type mismatchlength:\n   Expected ${typeToString(t1)}\n   Found ${typeToString(t2)}`;
    }
    if (t2.types.every(t => {
      try {
        unify(t, t1);
        return true;
      } catch (_e) {
        console.log(_e);
        return false;
      }
    })) {
      return {}
    } else {
      throw `Type mismatch0:\n   Expected ${typeToString(t1)}\n   Found ${typeToString(t2)}`;
    }
  } else if (t1.nodeType === "Union") {
    if (t1.types.some(t => {
      try {
        unify(t, t2);
        return true;
      } catch (_e) {
        return false;
      }
    })) {
      return {}
    } else {
      throw `Type mismatch1:\n   Expected ${typeToString(t1)}\n   Found ${typeToString(t2)}`;
    }
  } else if (t2.nodeType === "Union") {
    if (t2.types.some(t => {
      try {
        unify(t, t1);
        return true;
      } catch (_e) {
        return false;
      }
    })) {
      return {}
    } else {
      throw `Type mismatch2:\n   Expected ${typeToString(t1)}\n   Found ${typeToString(t2)}`;
    }
  } else {
    throw `Type mismatch3:\n    Expected ${typeToString(t1)}\n    Found ${typeToString(t2)}`;
  }
}

/**
  * @param {Substitution} s1
  * @param {Substitution} s2
  * @returns {Substitution}
  */
function composeSubst(s1, s2) {
  /** @type {Substitution} */
  const result = {};
  for (const k in s2) {
    const type = s2[k];
    result[k] = applySubstToType(s1, type);
  };
  return { ...s1, ...result };
}

/**
  * @param {string} name
  * @param {Type} t
  * @returns {Substitution}
  */
function varBind(name, t) {
  if (t.nodeType === "Var" && t.name === name) {
    return {};
  } else if (t.nodeType === "Union" && t.types.some(type => contains(type, name))) {
    return {};
  } else if (contains(t, name)) {
    throw `Type ${typeToString(t)} contains a reference to itself`;
  } else {
    /** @type {Substitution} */
    const subst = {};
    subst[name] = t;
    return subst;
  }
}

/**
  * @param {Type} t
  * @param {string} name
  * @returns {boolean}
  */
function contains(t, name) {
  switch (t.nodeType) {
    case "Named": return false;
    case "Var": return t.name === name;
    case "Union": return t.types.some(type => contains(type, name));
    case "Function": return t.from.some(from => contains(from, name)) || contains(t.to, name);
  }
}

/**
  * @param {Type} type
  * @returns {string}
  */
function typeToString(type) {
  switch (type.nodeType) {
    case "Named": return type.name;
    case "Var": return type.name;
    case "Union": return type.types.map(typeToString).join(" | ");
    case "Function":
      return `(${type.from.map(typeToString).join(", ")}) => ${typeToString(type.to)}`;
  }
}

/**
  * @param {Substitution} subst
  * @param {Context} ctx
  * @returns {Context}
  */
function applySubstToCtx(subst, ctx) {
  const newContext = {
    ...ctx,
    env: {
      ...ctx.env
    }
  };
  for (const name in newContext.env) {
    const t = newContext.env[name];
    if (t.nodeType === "Forall") {
      newContext.env[name] = applySubstToForall(subst, t);
    } else {
      newContext.env[name] = applySubstToType(subst, t);
    }
  }
  return newContext;
}

/**
  * @param {string[]} quantifiers
  * @param {Type} type
  * @returns {Forall}
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
  * @param {string | Expression} _rhs
  * @returns {Expression}
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
  * @param {Expression | string} expr
  * @returns {Expression}
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
  * @returns {Expression}
  */
function v(name) {
  return {
    nodeType: "Var",
    name: name
  };
}

/**
  * @param {number} value
  * @returns {Expression}
  */
function i(value) {
  return {
    nodeType: "Number",
    value: value
  };
}

/**
  * @returns {Expression}
  */
function u() {
  return {
    nodeType: "Undefined"
  };
}

/**
  * @param {string} value
  * @returns {Expression}
  */
function s(value) {
  return {
    nodeType: "String",
    value: value
  };
}

/**
  * @param {Type[]} types
  * @returns {Type}
  */
function un(...types) {
  return {
    nodeType: "Union",
    types: types
  }
}

/**
  * @param {string[]} params
  * @param {(Expression | Return | string)[]} body
  * @returns {Expression}
  */
function f(params, body) {
  return {
    nodeType: "Function",
    params: params,
    body: body.map(body => typeof body === "string" ? v(body) : body)
  };
}

/**
  * @param {Expression | string} expr
  * @returns {Return}
  */
function ret(expr) {
  return {
    nodeType: "Return",
    rhs: typeof expr === "string" ? v(expr) : expr
  }
}

/**
  * @param {Expression | string} f
  * @param {(Expression | string)[]} _args
  * @returns {Expression}
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
  * @returns {Type}
  */
function tn(name) {
  return {
    nodeType: "Named",
    name: name
  };
}

/**
  * @param {string} name
  * @returns {Type}
  */
function tv(name) {
  return {
    nodeType: "Var",
    name: name
  };
}

/**
  * @param {Type[]} types
  * @param {Type} to
  * @returns {Type}
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
  typeToString(
    infer({
      next: 0,
      env: initialEnv
    },
      c("parseInt", s("1")),
    )[0]
  ));


let [_t1, _1, ctx1] = infer({
  next: 0,
  env: initialEnv
},
  eLet("x", c("ambig"))
);

console.log(
  typeToString(
    infer(ctx1,
      c("parseInt", s("1"), v("x")),
    )[0]
  ));

let [_t2, _2, ctx2] = infer({
  next: 0,
  env: initialEnv
},
  eLet("x", f(["a", "b", "c"], [eLet("y", i(123)), ret(v("y")), ret(v("c")), ret(v("a"))]))
);

console.log(typeToString(_t2));

console.log(
  typeToString(
    infer(ctx2,
      c("identity", v("x")),
    )[0]
  ));
