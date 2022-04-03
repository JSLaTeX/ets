# Embedded TypeScript (ETS)

A port of [EJS](https://ejs.co) to support embedded TypeScript.

## Usage

```typescript
import * as ets from 'embedded-ts';

console.log(
  await ets.render(`
    <%
      let x: string
      x = "hello";
    %>
    <%= x %>
  `)
);

// Outputs: "hello"
```

## Differences from EJS

- For simplicity and consistency, all render functions are now asynchronous, so there is no `async` option. This also means that `include` functions now return promises, so to include another `.ets` file, you must use `await include('path/to/ets/file')`.

- There is no `client` option in ETS.

- The `with` statement is now always used internally to expose provided data to the template. Thus, the `_with` and `destructuredLocals` options have been removed.

- The `strict` option has been removed; all templates are now executed in the context of a strict-mode asynchronous IIFE.

- The option to set global delimiters, opening brackets, and closing brackets through `ets.delimiter = '?'` has been removed. Instead, pass the delimiter to each render function or create a wrapper function.
