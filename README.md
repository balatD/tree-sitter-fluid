# tree-sitter-fluid

A [tree-sitter](https://tree-sitter.github.io) grammar for the **TYPO3 Fluid**
templating language. Extends tree-sitter-html with Fluid `{expressions}`, inline
ViewHelpers, pipelines (`->`), casts (`as`), arrays, `{namespace ...}` and
dynamic tag names (`<{var}>`). ViewHelper *tags* (`<f:if>`, `<f:format.raw>`) are
regular elements whose tag name carries a `:`.

Used by the [TYPO3 Fluid Zed extension](https://github.com/balatD/zed-typo3-fluid).

Scope: `text.html.fluid`. File types: `*.fluid.html`, `*.fluid`.

## Building

```sh
tree-sitter generate    # regenerate src/parser.c, grammar.json, node-types.json
tree-sitter test        # run test/corpus
tree-sitter parse FILE  # parse a file
```

Requires the tree-sitter CLI **0.26** (emits parser ABI 15).

> The generated `src/parser.c`, `src/grammar.json`, `src/node-types.json` and
> `src/tree_sitter/*` are **committed on purpose** — the Zed extension builds the
> grammar from a pinned commit, so they must not be git-ignored. `src/scanner.c`
> is a hand-maintained fork of tree-sitter-html's external scanner (tag names
> extended to allow `.`/`_`; external symbols renamed `html`→`fluid`); it is not
> produced by `tree-sitter generate`. After editing `grammar.js`, re-run
> `tree-sitter generate` and commit the regenerated files.

## Tests

`test/corpus/*.txt` holds `tree-sitter test` fixtures. Run `tree-sitter test`;
CI (`.github/workflows/ci.yml`) also checks that the committed generated sources
match a fresh `tree-sitter generate`.

## Known limitations

- The interior of quoted string literals is **opaque** — interpolated
  `{expressions}` inside a string are not tokenized (the `string` rule is a
  single lexer token; tokenizing it risks parser conflicts).
- CDATA content is opaque (a single `cdata` token).
- `<f:comment>` content is parsed like a normal element rather than treated as
  raw/opaque; its plain text is dimmed via the highlight query, but a malformed
  expression inside it can still produce an `ERROR` node. Fully opaque handling
  needs scanner-level raw-text support (like `<script>`/`<style>`).
- Dynamic tag pairs `<{expr}>…</{expr}>` are not name-matched (any dynamic start
  pairs with any dynamic end — the closing expression is arbitrary and not
  expressible as a context-free constraint).
