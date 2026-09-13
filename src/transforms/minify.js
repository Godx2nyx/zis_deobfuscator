const DEFAULT_OPTIONS = {
  preserveLines: false,
  preserveComments: false,
  collapseSpaces: true,
  removeSemicolons: false
}

function maskStrings(source) {
  const strings = []

  const code = source.replace(
    /(["'])(?:\\.|(?!\1)[\s\S])*?\1/g,
    match => {
      const id = strings.length
      strings.push(match)
      return `__ZIS_MIN_STRING_${id}__`
    }
  )

  return { code, strings }
}

function restoreStrings(source, strings) {
  return source.replace(
    /__ZIS_MIN_STRING_(\d+)__/g,
    (_, index) => strings[Number(index)] ?? _
  )
}

function maskLongStrings(source) {
  const strings = []

  const code = source.replace(
    /\[\[[\s\S]*?\]\]/g,
    match => {
      const id = strings.length
      strings.push(match)
      return `__ZIS_MIN_LONG_${id}__`
    }
  )

  return { code, strings }
}

function restoreLongStrings(source, strings) {
  return source.replace(
    /__ZIS_MIN_LONG_(\d+)__/g,
    (_, index) => strings[Number(index)] ?? _
  )
}

function maskComments(source, preserve) {
  const comments = []

  const regex = /--\[\[[\s\S]*?\]\]|--[^\n\r]*/g

  const code = source.replace(
    regex,
    match => {
      if (preserve) {
        const id = comments.length
        comments.push(match)
        return `__ZIS_MIN_COMMENT_${id}__`
      }

      return ""
    }
  )

  return { code, comments }
}

function restoreComments(source, comments) {
  return source.replace(
    /__ZIS_MIN_COMMENT_(\d+)__/g,
    (_, index) => comments[Number(index)] ?? _
  )
}

function protectTokens(source) {
  const strings = maskStrings(source)
  const longStrings = maskLongStrings(strings.code)

  return {
    code: longStrings.code,
    strings: strings.strings,
    longStrings: longStrings.strings
  }
}

function restoreTokens(source, state) {
  let result = source

  result = restoreLongStrings(
    result,
    state.longStrings
  )

  result = restoreStrings(
    result,
    state.strings
  )

  return result
}

function collapseWhitespace(source) {
  let result = source

  result = result.replace(
    /[ \t]+/g,
    " "
  )

  result = result.replace(
    /\r\n/g,
    "\n"
  )

  result = result.replace(
    /\n[ \t]+/g,
    "\n"
  )

  result = result.replace(
    /[ \t]+\n/g,
    "\n"
  )

  result = result.replace(
    /\n{2,}/g,
    "\n"
  )

  return result
}

function removeAroundOperators(source) {
  return source
    .replace(/\s*([=+\-*\/%^<>~])\s*/g, "$1")
    .replace(/\s*([(),{}\[\];:])\s*/g, "$1")
    .replace(/\s*\.\s*/g, ".")
}

function protectKeywordBoundaries(source) {
  const keywords = [
    "and",
    "or",
    "not",
    "local",
    "function",
    "return",
    "break",
    "continue",
    "if",
    "then",
    "elseif",
    "else",
    "end",
    "for",
    "in",
    "do",
    "while",
    "repeat",
    "until"
  ]

  let result = source

  for (const keyword of keywords) {
    result = result.replace(
      new RegExp(
        `\\b${keyword}\\s+`,
        "g"
      ),
      `${keyword} `
    )
  }

  return result
}

function removeRedundantSemicolons(source) {
  return source.replace(
    /;(?=\s*(?:\n|$))/g,
    ""
  )
}

function compactLines(source) {
  return source
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join("\n")
}

function minify(source, options = {}) {
  if (typeof source !== "string") {
    throw new TypeError(
      "source must be a string"
    )
  }

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const comments = maskComments(
    source,
    opts.preserveComments
  )

  const protectedState =
    protectTokens(comments.code)

  let result = protectedState.code

  if (opts.collapseSpaces) {
    result = collapseWhitespace(result)
  }

  result = protectKeywordBoundaries(result)
  result = removeAroundOperators(result)

  if (opts.removeSemicolons) {
    result = removeRedundantSemicolons(
      result
    )
  }

  if (!opts.preserveLines) {
    result = compactLines(result)
  }

  result = restoreTokens(
    result,
    protectedState
  )

  result = restoreComments(
    result,
    comments.comments
  )

  return result.trim()
}

function aggressiveMinify(source) {
  return minify(source, {
    preserveLines: false,
    preserveComments: false,
    collapseSpaces: true,
    removeSemicolons: true
  })
}

class Minifier {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    }
  }

  transform(source) {
    return minify(
      source,
      this.options
    )
  }

  minify(source) {
    return this.transform(source)
  }

  aggressive(source) {
    return aggressiveMinify(source)
  }
}

function createMinifier(options = {}) {
  return new Minifier(options)
}

export {
  Minifier,
  createMinifier,
  minify,
  aggressiveMinify,
  collapseWhitespace,
  removeAroundOperators
}

export default Minifier
