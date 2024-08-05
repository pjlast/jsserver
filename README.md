# jsserver

`jsserver` is my attempt at learning something about type inference and in the process
trying to answer the question: "How far can we get without type annotations in JavaScript?".

To install dependencies:

```bash
bun install
```

To use the LSP in Neovim:

```lua
vim.api.nvim_create_autocmd({ "BufReadPost", "BufNewFile" }, {
  pattern = { "*.js" },
  callback = function()
    vim.lsp.start {
      name = "jsserver",
      cmd = { "bun", "/path/to/jsserver/lsp.js", "--stdio" },
      root_dir = vim.fs.dirname(vim.fs.find({ '.git' }, { upward = true })[1]),
    }
  end,
})
```

## Assumptions

JavaScript is dynamically typed. So when applying static type analysis, we need to add some self-imposed constraints.

### Variables cannot change type once declared

This is required to keep programs predictable and easy to reason about. Consider the following program:

```javascript
let x = "123";

function myFunc() {
  return parseInt(x);
}

let y = myFunc();

x = 123;

y = myFunc();
```

Here `myFunc` becomes linked to the type of `x`, but the type of `x` can change at any time. Here it's somewhat predictable, but we can add something like `if (randomNumber() > 50)` to make the type of `x` ambiguous, and this would affect whether or not we could call `myFunc` reliably.

Perhaps there is some form of analysis that allows us to determine if a function call would be successful, but for now we're imposing this restriction.

#### Future idea

We could make the type signature of `myFunc` depend on the outside variable `x` and allow `x` to be dynamic. Then when
`myFunc()` is called, we evaluate `x` as part of the parameters? However, there is value in keeping types static. It's often quite useful to get immediate feedback on things like variable assignments when you change something far away in a program.

Will keep the idea open.

## Ideas

### All functions are generic unless proven otherwise

```javascript
// Returns the first argument.
function identity(a) { return a; }

let x = identity(1);
```

Here `tsserver` would complain that `a` is of type `any`, and as a result `x` would be of type `any`.
However, we can clearly see that `x` would be a `number` in this case. So, instead, `identity` is of type `(T0) => T0`.

### Type inference by usage

```javascript
function myFunction(a) { return parseInt(a); }
```

Assuming `parseInt` has the type signature `(string) => number`, we can infer that `myFunction` has the type signature `(string) => number`, since for `parseInt` to process `a` successfully, `a` needs to be a `string`.

## Resources

[Type inference for beginners](https://medium.com/@dhruvrajvanshi/type-inference-for-beginners-part-1-3e0a5be98a4b)
