/**
 * @typedef {TNamed | TVar | TFun | TUnion} Type
 * @typedef {{ nodeType: "Named", name: string }} TNamed
 * @typedef {{ nodeType: "Var", name: string }} TVar
 * @typedef {{ nodeType: "Union", types: Type[] }} TUnion
 * @typedef {{ nodeType: "Function", from: Type[], to: Type, throws: (Type | null) }} TFun
 */

/** @typedef {{line: number, column: number}} Position
  * @typedef {{start: Position, end: Position}} SourceLocation

/**
  * @typedef {ENumber | EString | EBool | EUndefined | ENull | EVar | EFunc | ECall | ELet | EAssign | EBinary} Expression
  * @typedef {{nodeType: "Number", value: number, loc: SourceLocation}} ENumber
  * @typedef {{nodeType: "String", value: string, loc: SourceLocation}} EString
  * @typedef {{nodeType: "Boolean", value: string, loc: SourceLocation}} EBool
  * @typedef {{nodeType: "Undefined", loc: SourceLocation}} EUndefined
  * @typedef {{nodeType: "Null", loc: SourceLocation}} ENull
  * @typedef {{nodeType: "Var", name: string, loc: SourceLocation}} EVar
  * @typedef {{nodeType: "Function", params: (EVar | EAssign)[], body: (Expression | Block), loc: SourceLocation}} EFunc
  * @typedef {{nodeType: "Binary", operator: string, lhs: Expression, rhs: Expression, loc: SourceLocation}} EBinary
  * @typedef {{nodeType: "Call", func: Expression, args: Expression[], loc: SourceLocation}} ECall
  * @typedef {{nodeType: "Let", name: string, rhs: Expression, loc: SourceLocation}} ELet
  * @typedef {{nodeType: "Assign", lhs: {name: string, loc: SourceLocation}, rhs: Expression, loc: SourceLocation}} EAssign
  */

/** @typedef {{nodeType: "Return", rhs: Expression, loc: SourceLocation}} Return */
/** @typedef {{nodeType: "Throw", rhs: Expression, loc: SourceLocation}} Throw */
/** @typedef {{nodeType: "Block", body: (Expression | Return | Block | If | Throw)[], loc: SourceLocation}} Block */
/** @typedef {{nodeType: "If", condition: Expression, then: Block, else: Block | null, loc: SourceLocation}} If */

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
    case "Named":
      return {};
    case "Var":
      return { [t.name]: true };
    case "Union":
      return t.types.reduce(
        (freeVars, type) => union(freeVars, freeTypeVarsInType(type)),
        {},
      );
    case "Function":
      return union(
        t.from.reduce(
          (freeVars, from) => union(freeVars, freeTypeVarsInType(from)),
          {},
        ),
        freeTypeVarsInType(t.to),
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
    const freeVars =
      t.nodeType === "Forall" ? freeTypeVarsInForall(t) : freeTypeVarsInType(t);
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
      return [envType, {}, ctx];
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
      type: type,
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
  return [{ nodeType: "Named", name: "Undefined" }, s1, ctx2];
}

export class TypeMismatchError extends Error {
  /**
   * @param {Type} want
   * @param {Type} got
   */
  constructor(want, got) {
    super(
      "Type mismatch: expected " +
        typeToString(want) +
        ", got " +
        typeToString(got),
    );
    this.name = "TypeMismatchError";
    this.want = want;
    this.got = got;
  }
}

export class TypeInferenceError extends Error {
  /**
   * @param {TypeMismatchError} typeMismatchErr
   * @param {SourceLocation} loc
   */
  constructor(typeMismatchErr, loc) {
    super(typeMismatchErr.message);
    this.name = "TypeInferenceError";
    this.want = typeMismatchErr.want;
    this.got = typeMismatchErr.got;
    this.loc = loc;
  }
}

/**
 * @param {Context} ctx
 * @param {EAssign} expr
 * @returns {[Type, Substitution, Context]}
 */
function inferAssign(ctx, expr) {
  const assignedType = ctx.env[expr.lhs.name];
  if (!assignedType) {
    throw `Unbound var ${expr.lhs.name}`;
  }
  const [rhsType, s1] = infer(ctx, expr.rhs);
  const ctx1 = applySubstToCtx(s1, ctx);
  if (assignedType.nodeType === "Forall") {
    throw "TODO";
  } else {
    try {
      const subst = unify(assignedType, rhsType);
      const ctx2 = applySubstToCtx(subst, ctx1);
      return [assignedType, subst, ctx2];
    } catch (e) {
      if (e instanceof TypeMismatchError) {
        throw new TypeInferenceError(e, expr.lhs.loc);
      } else {
        throw e;
      }
    }
  }
}

/**
 * @param {Substitution} subst - The substitution.
 * @param {Type} type - The type.
 * @returns {Type} The type with the substitution applied.
 */
function applySubstToType(subst, type) {
  switch (type.nodeType) {
    case "Named":
      return type;
    case "Union":
      return {
        nodeType: "Union",
        types: type.types.map((t) => applySubstToType(subst, t)),
      };
    case "Var":
      if (subst[type.name]) {
        return subst[type.name];
      } else {
        return type;
      }
    case "Function":
      return {
        nodeType: "Function",
        from: type.from.map((from) => applySubstToType(subst, from)),
        to: applySubstToType(subst, type.to),
        throws: null,
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
    type: applySubstToType(substWithoutBound, type.type),
  };
}

/**
 * @param {Substitution} subst - The substitution.
 * @param {TFun} type - The type.
 * @returns {TFun} The type with the substitution applied.
 */
function applySubstToTFun(subst, type) {
  return {
    nodeType: "Function",
    from: type.from.map((from) => applySubstToType(subst, from)),
    to: applySubstToType(subst, type.to),
    throws: null,
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
    env: Object.assign({}, ctx.env),
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
    name: `T${newVarNum}`,
  };
}

/**
 * @param {Context} ctx
 * @param {Block} block
 * @returns {[Type | null, Substitution]}
 */
function inferBlock(ctx, block) {
  /** @type {Substitution} */
  let subst = {};

  /** @type {TUnion} */
  let blockTypes = { nodeType: "Union", types: [] };

  for (const e of block.body) {
    if (e.nodeType === "Return") {
      const [exprType, _subst, retCtx] = infer(ctx, e.rhs);
      subst = composeSubst(subst, _subst);
      ctx = retCtx;
      ctx = applySubstToCtx(subst, ctx);
      return [exprType, subst];
    } else if (e.nodeType === "Throw") {
      console.log("TODO");
    } else if (e.nodeType === "Block") {
      const [retType, isubst] = inferBlock(ctx, e);
      subst = composeSubst(subst, isubst);
      ctx = applySubstToCtx(subst, ctx);
      if (retType) {
        return [retType, subst];
      }
    } else if (e.nodeType === "If") {
      const [allBranches, types, substs] = inferIf(ctx, e);
      subst = composeSubst(subst, substs);
      if (allBranches) {
        return [types, subst];
      }
      if (types) {
        blockTypes.types.push(types);
      }
    } else {
      const [_exprType, _subst, resCtx] = infer(ctx, e);
      subst = composeSubst(subst, _subst);
      ctx = resCtx;
      ctx = applySubstToCtx(subst, ctx);
    }
  }
  blockTypes.types.push({ nodeType: "Named", name: "Undefined" });
  return [blockTypes, subst];
}

/**
 * @param {Context} ctx
 * @param {If} ifs
 * @returns {[boolean, Type | null, Substitution]}
 */
function inferIf(ctx, ifs) {
  /** @type {Substitution} */
  let subst = {};
  const [_t, s, c] = infer(ctx, ifs.condition);
  subst = composeSubst(subst, s);
  ctx = applySubstToCtx(subst, c);
  const [thenT, thenS] = inferBlock(ctx, ifs.then);
  subst = composeSubst(subst, thenS);
  ctx = applySubstToCtx(subst, ctx);
  /** @type {TUnion} */
  let returnType = { nodeType: "Union", types: [] };
  if (thenT) {
    returnType.types.push(thenT);
  }
  if (ifs.else) {
    const [elseT, elseS] = inferBlock(ctx, ifs.else);
    subst = composeSubst(subst, elseS);
    ctx = applySubstToCtx(subst, ctx);
    if (elseT) {
      if (!returnType.types.some((t) => typesEqual(t, elseT))) {
        returnType.types.push(elseT);
      }
    }
    if (returnType.types.length === 1) {
      return [true, returnType.types[0], subst];
    }
    return [true, returnType, subst];
  }

  if (returnType.types.length === 1) {
    return [false, returnType.types[0], subst];
  }

  return [false, returnType, subst];
}

/**
 * @param {Context} ctx - The environment.
 * @param {Expression} expr - Expression to infer.
 * @returns {[Type, Substitution, Context]} The inferred type.
 * @throws {string} If the expression cannot be inferred.
 */
export function infer(ctx, expr) {
  switch (expr.nodeType) {
    case "Number":
      return [{ nodeType: "Named", name: "number" }, {}, ctx];
    case "String":
      return [{ nodeType: "Named", name: "string" }, {}, ctx];
    case "Undefined":
      return [{ nodeType: "Named", name: "undefined" }, {}, ctx];
    case "Null":
      return [{ nodeType: "Named", name: "null" }, {}, ctx];
    case "Boolean":
      return [{ nodeType: "Named", name: "boolean" }, {}, ctx];
    case "Binary": {
      let [lhsType, s1] = infer(ctx, expr.lhs);
      let ctx1 = applySubstToCtx(s1, ctx);
      let [rhsType, s2] = infer(ctx1, expr.rhs);
      let ctx2 = applySubstToCtx(s2, ctx1);
      /** @type {Type} */
      const numberType = {
        nodeType: "Named",
        name: "Number",
      };
      if (expr.operator === "+") {
        if (
          typesEqual(lhsType, numberType) &&
          typesEqual(rhsType, numberType)
        ) {
          return [
            {
              nodeType: "Named",
              name: "number",
            },
            composeSubst(s2, s1),
            ctx2,
          ];
        } else {
          return [
            {
              nodeType: "Named",
              name: "string",
            },
            composeSubst(s2, s1),
            ctx2,
          ];
        }
      } else if (expr.operator === "===") {
        return [
          {
            nodeType: "Named",
            name: "boolean",
          },
          composeSubst(s2, s1),
          ctx2,
        ];
      } else {
        throw "TODO";
      }
    }
    case "Let":
      return inferLet(ctx, expr);
    case "Assign":
      return inferAssign(ctx, expr);
    case "Var":
      return inferVar(ctx, expr);
    case "Function": {
      /** @type {Type[]} */
      let newTypes = [];
      let newCtx = expr.params.reduce((ctx, param) => {
        switch (param.nodeType) {
          case "Var": {
            /** @type {TVar} */
            const newType = {
              nodeType: "Var",
              name: param.name,
            };
            newTypes.push(newType);
            return addToContext(ctx, param.name, newType);
          }
          case "Assign": {
            const [paramType, _subst, _ctx] = infer(ctx, param.rhs);
            return addToContext(_ctx, param.lhs.name, paramType);
          }
        }
      }, ctx);

      /** @type {Type} */
      let returnType = {
        nodeType: "Named",
        name: "undefined",
      };

      /** @type {Substitution} */
      let subst = {};

      if (expr.body.nodeType === "Block") {
        const [retType, isubst] = inferBlock(newCtx, expr.body);
        subst = composeSubst(subst, isubst);
        if (retType) {
          returnType = applySubstToType(subst, retType);
        }
      } else {
        const [_exprType, _subst, resCtx] = infer(newCtx, expr);
        subst = composeSubst(subst, _subst);
        newCtx = resCtx;
        newCtx = applySubstToCtx(subst, newCtx);
      }

      const resType = applySubstToType(subst, returnType);

      /** @type {Type} */
      const inferredType = {
        nodeType: "Function",
        from: newTypes.map((type) => applySubstToType(subst, type)),
        to: resType,
        throws: null,
      };

      return [inferredType, subst, ctx];
    }
    case "Call":
      try {
        const [funcType, s1] = infer(ctx, expr.func);
        const ctx1 = applySubstToCtx(s1, ctx);
        /** @type {Type[]} */
        let argTypes = [];
        /** @type {Substitution[]} */
        let substs = [];
        expr.args.forEach((arg) => {
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
          to: newVar,
          throws: null,
        });

        if (funcType.nodeType === "Function") {
          const funcType1 = applySubstToTFun(s4, funcType);
          const s5 = composeSubst(s3, s4);
          const types = funcType1.from.map((from) =>
            applySubstToType(s5, from),
          );
          const substs = types.map((type, i) => {
            if (argTypes[i]) {
              return unify(type, argTypes[i]);
            } else {
              return unify(type, { nodeType: "Named", name: "undefined" });
            }
          });
          const s6 = substs.reduce((s, s2) => composeSubst(s, s2), {});
          const resultSubst = composeSubst(s5, s6);
          return [
            applySubstToType(resultSubst, funcType1.to),
            resultSubst,
            ctx,
          ];
        } else {
          throw new TypeInferenceError(
            new TypeMismatchError(funcType, {
              nodeType: "Named",
              name: "function",
            }),
            expr.loc,
          );
        }
      } catch (e) {
        if (e instanceof TypeMismatchError) {
          throw new TypeInferenceError(e, expr.loc);
        } else {
          throw e;
        }
      }
  }
}

/**
 * Check if right can fit left, and if so, return a
 * substitution that makes them equal. Otherwise,
 * throw an error.
 *
 * @param {Type} left - The restrictive type.
 * @param {Type} right - The type that must fit left.
 * @returns {Substitution} The substitution that makes left equal to right.
 * @throws {TypeMismatchError} If the types cannot be unified.
 */
export function unify(left, right) {
  if (
    left.nodeType === "Named" &&
    right.nodeType === "Named" &&
    left.name === right.name
  ) {
    return {};
  } else if (left.nodeType === "Var") {
    return varBind(left.name, right);
  } else if (right.nodeType === "Var") {
    return varBind(right.name, left);
  } else if (left.nodeType === "Function" && right.nodeType === "Function") {
    let t1from = left.from;
    if (t1from.length > right.from.length) {
      t1from = t1from.slice(0, right.from.length);
    }
    const substs = t1from.map((from, i) => unify(from, right.from[i]));
    const s1 = substs.reduce((s, s2) => composeSubst(s, s2), {});
    const s2 = unify(
      applySubstToType(s1, left.to),
      applySubstToType(s1, right.to),
    );
    return composeSubst(s1, s2);
  } else if (left.nodeType === "Union" && right.nodeType === "Union") {
    if (right.types.length > left.types.length) {
      throw new TypeMismatchError(left, right);
    }

    /** @type {Substitution} */
    let subst = {};
    if (
      right.types.every((t) => {
        try {
          subst = composeSubst(subst, unify(left, t));
          return true;
        } catch (_e) {
          console.log(_e);
          return false;
        }
      })
    ) {
      return subst;
    } else {
      throw new TypeMismatchError(left, right);
    }
  } else if (left.nodeType === "Union") {
    /** @type {Substitution} */
    let subst = {};
    if (
      left.types.some((t) => {
        try {
          subst = composeSubst(subst, unify(t, right));
          return true;
        } catch (_e) {
          return false;
        }
      })
    ) {
      return subst;
    } else {
      throw new TypeMismatchError(left, right);
    }
  } else if (right.nodeType === "Union") {
    /** @type {Substitution} */
    let subst = {};
    if (
      right.types.every((t) => {
        try {
          subst = composeSubst(subst, unify(t, left));
          return true;
        } catch (_e) {
          return false;
        }
      })
    ) {
      return subst;
    } else {
      throw new TypeMismatchError(left, right);
    }
  } else {
    throw new TypeMismatchError(left, right);
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
  }
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
  } else if (
    t.nodeType === "Union" &&
    t.types.some((type) => contains(type, name))
  ) {
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
    case "Named":
      return false;
    case "Var":
      return t.name === name;
    case "Union":
      return t.types.some((type) => contains(type, name));
    case "Function":
      return (
        t.from.some((from) => contains(from, name)) || contains(t.to, name)
      );
  }
}

/**
 * @param {Type} t1
 * @param {Type} t2
 * @returns {boolean}
 */
function typesEqual(t1, t2) {
  if (t1.nodeType === "Named" && t2.nodeType === "Named") {
    return t1.name === t2.name;
  } else if (t1.nodeType === "Var" && t2.nodeType === "Var") {
    return t1.name === t2.name;
  } else if (t1.nodeType === "Union" && t2.nodeType === "Union") {
    if (t1.types.length !== t2.types.length) {
      return false;
    }
    return t1.types.every((type) =>
      t2.types.some((type2) => typesEqual(type, type2)),
    );
  } else if (t1.nodeType === "Function" && t2.nodeType === "Function") {
    if (t1.from.length !== t2.from.length) {
      return false;
    }
    for (let i = 0; i < t1.from.length; i++) {
      if (!typesEqual(t1.from[i], t2.from[i])) {
        return false;
      }
    }
    return typesEqual(t1.to, t2.to);
  } else {
    return false;
  }
}

/**
 * @param {Type} type
 * @returns {string}
 */
export function typeToString(type) {
  switch (type.nodeType) {
    case "Named":
      return type.name;
    case "Var":
      return type.name;
    case "Union":
      return type.types.map(typeToString).join(" | ");
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
      ...ctx.env,
    },
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
