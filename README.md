# tree-sitter-fluid

A [tree-sitter](https://tree-sitter.github.io) grammar for the **TYPO3 Fluid**
templating language. Extends tree-sitter-html with Fluid `{expressions}`, inline
ViewHelpers, pipelines (`->`), casts (`as`), arrays, `{namespace ...}` and
dynamic tag names (`<{var}>`). ViewHelper *tags* (`<f:if>`, `<f:format.raw>`) are
regular elements whose tag name carries a `:`.

Used by the [TYPO3 Fluid Zed extension](https://github.com/balatD/zed-typo3-fluid).

## Known limitations
- Interior of single-quoted strings is not separately tokenized.
- Same-quote nesting inside an attribute value (`value='{ ... 'x': ... }'`) and
  some deeply escaped attribute values may produce localized parse errors.
