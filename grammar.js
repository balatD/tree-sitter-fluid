/**
 * @file TYPO3 Fluid grammar for tree-sitter
 * @license MIT
 *
 * Extends the tree-sitter HTML grammar (Brunsfeld/Qureshi, MIT) with Fluid
 * constructs: {expressions}, inline ViewHelpers, pipelines, casts, arrays and
 * {namespace ...} declarations. ViewHelper *tags* (<f:if>, <f:format.raw>) are
 * ordinary HTML elements whose tag name carries a ':' — distinguished in
 * highlights.scm, not here. The scanner is patched to allow '.'/'_' in tag
 * names so <f:format.raw> tokenizes as one tag.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'fluid',

  word: $ => $.identifier,

  extras: $ => [
    $.comment,
    /\s+/,
  ],

  externals: $ => [
    $._start_tag_name,
    $._script_start_tag_name,
    $._style_start_tag_name,
    $._end_tag_name,
    $.erroneous_end_tag_name,
    '/>',
    $._implicit_end_tag,
    $.raw_text,
    $.comment,
  ],

  rules: {
    document: $ => repeat($._node),

    doctype: $ => seq('<!', alias($._doctype, 'doctype'), /[^>]+/, '>'),
    _doctype: _ => /[Dd][Oo][Cc][Tt][Yy][Pp][Ee]/,

    _node: $ => choice(
      $.doctype,
      $.cdata,
      $.entity,
      $.expression,
      $.text,
      $.element,
      $.script_element,
      $.style_element,
      $.erroneous_end_tag,
    ),

    // <![CDATA[ ... ]]> — opaque in this version (content not tokenized).
    cdata: _ => token(seq(
      '<![CDATA[',
      repeat(choice(/[^\]]/, /\][^\]]/, /\]\][^>]/)),
      ']]>',
    )),

    element: $ => choice(
      seq($.start_tag, repeat($._node), choice($.end_tag, $._implicit_end_tag)),
      // Fluid dynamic tag names: <{headline}>...</{headline}>, <{f:if(...)}>
      seq($.dynamic_start_tag, repeat($._node), $.dynamic_end_tag),
      $.self_closing_tag,
    ),

    dynamic_start_tag: $ => seq('<', $.expression, repeat($._tag_part), '>'),
    dynamic_end_tag: $ => seq('</', $.expression, '>'),

    script_element: $ => seq(alias($.script_start_tag, $.start_tag), optional($.raw_text), $.end_tag),
    style_element: $ => seq(alias($.style_start_tag, $.start_tag), optional($.raw_text), $.end_tag),

    start_tag: $ => seq('<', alias($._start_tag_name, $.tag_name), repeat($._tag_part), '>'),
    script_start_tag: $ => seq('<', alias($._script_start_tag_name, $.tag_name), repeat($._tag_part), '>'),
    style_start_tag: $ => seq('<', alias($._style_start_tag_name, $.tag_name), repeat($._tag_part), '>'),
    self_closing_tag: $ => seq('<', alias($._start_tag_name, $.tag_name), repeat($._tag_part), '/>'),

    // A tag may contain attributes and/or bare Fluid expressions, e.g.
    // <a {f:if(condition: x, then: 'title="t"')} {_all}>.
    _tag_part: $ => choice($.attribute, $.expression),

    end_tag: $ => seq('</', alias($._end_tag_name, $.tag_name), '>'),
    erroneous_end_tag: $ => seq('</', $.erroneous_end_tag_name, '>'),

    attribute: $ => seq(
      $.attribute_name,
      optional(seq('=', choice($.attribute_value, $.quoted_attribute_value))),
    ),

    attribute_name: _ => /[^<>"'/=\s{}]+/,
    attribute_value: _ => /[^<>"'=\s{}]+/,

    entity: _ => /&(#([xX][0-9a-fA-F]{1,6}|[0-9]{1,5})|[A-Za-z]{1,30});?/,

    // Quoted attribute values interleave literal text and {expressions},
    // e.g. class="media {f:if(...)} {class}".
    // Allow backslash escapes (Fluid attribute values may contain \" / \') and
    // interleaved {expressions}.
    quoted_attribute_value: $ => choice(
      seq("'", repeat(choice($.expression, alias(token(/([^'{\\]|\\.)+/), $.attribute_value))), "'"),
      seq('"', repeat(choice($.expression, alias(token(/([^"{\\]|\\.)+/), $.attribute_value))), '"'),
    ),

    text: _ => token(prec(-1, /[^<>&{}\s]([^<>&{}]*[^<>&{}\s])?/)),

    // ─────────────────────────── Fluid ────────────────────────────────────
    expression: $ => seq('{', optional($._expr_inner), '}'),

    _expr_inner: $ => choice(
      $.namespace_definition,
      $.array,
      $._compound,
    ),

    // {namespace foo=Vendor\Pkg\ViewHelpers}
    namespace_definition: $ => seq(
      'namespace',
      $.namespace,
      optional(seq('=', $.php_class)),
    ),
    namespace: _ => /[A-Za-z_*][A-Za-z0-9_.*]*/,
    php_class: _ => /[A-Za-z0-9_]+(\\[A-Za-z0-9_]+)+/,

    // {0: foo, 'key': 'val', sub: {1: a}}
    array: $ => seq($.pair, repeat(seq(',', $.pair)), optional(',')),
    pair: $ => seq(field('key', $._key), ':', field('value', $._value)),
    _key: $ => choice(alias($.identifier, $.array_key), $.string, $.number),

    // A value-bearing expression: a value plus operators / pipes / casts.
    _compound: $ => prec.right(seq(
      $._value,
      repeat(choice($._operation, $.pipe, $.ternary, $.cast)),
    )),

    _operation: $ => seq($.operator, $._value),
    pipe: $ => seq('->', $.inline_viewhelper),
    ternary: $ => choice(
      seq('?', $._value, ':', $._value),
      seq('?:', $._value),
    ),
    cast: $ => seq('as', alias($.identifier, $.type)),

    _value: $ => choice(
      $.unary,
      $.inline_viewhelper,
      $.boolean,
      $.null,
      $.special_variable,
      $.number,
      $.string,
      $.expression,
      $.variable,
    ),

    unary: $ => prec(3, seq($.operator, $._value)),

    // f:format.raw(value: x)   v:page.menu(...)
    inline_viewhelper: $ => seq(
      field('name', $.viewhelper_name),
      '(',
      optional($.arguments),
      ')',
    ),
    viewhelper_name: _ => token(/[A-Za-z_][A-Za-z0-9_]*:[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/),
    arguments: $ => seq($.argument, repeat(seq(',', $.argument)), optional(',')),
    argument: $ => seq(field('name', alias($.identifier, $.argument_name)), ':', field('value', $._value)),

    boolean: _ => choice('true', 'false'),
    null: _ => 'null',
    special_variable: _ => '_all', // Fluid's {_all} (all template variables)
    number: _ => token(/-?\d+(\.\d+)?/),
    // Numeric path/array indices ({arr.0}) are exposed as `number` nodes.
    variable: $ => prec.left(seq($.identifier, repeat(seq('.', choice($.identifier, alias(token(/\d+/), $.number)))))),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    // Strings are single tokens (robust); interpolation inside them is not
    // separately tokenized in this version.
    string: _ => token(choice(
      seq("'", repeat(choice(/\\./, /[^'\\]/)), "'"),
      seq('"', repeat(choice(/\\./, /[^"\\]/)), '"'),
    )),

    operator: _ => token(choice(
      '+', '-', '*', '/', '%', '^', '!',
      '==', '===', '!=', '!==', '>=', '<=', '>', '<',
      '&&', '||',
    )),
  },
});
