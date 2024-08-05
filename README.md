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

## Resources

[Type inference for beginners](https://medium.com/@dhruvrajvanshi/type-inference-for-beginners-part-1-3e0a5be98a4b)
