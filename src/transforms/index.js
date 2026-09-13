import {
  Renamer,
  createRenamer,
  renameSource,
  buildRenameMap,
  replaceIdentifiers,
  generateName
} from "./rename.js"

import {
  ControlFlowObfuscator,
  createControlFlowObfuscator,
  controlFlowObfuscate,
  transformBlock,
  splitStatements,
  injectJunk,
  flattenStatements,
  opaqueTrue,
  opaqueFalse
} from "./control-flow.js"

import {
  OpaquePredicate,
  createOpaquePredicate,
  obfuscateOpaque,
  generateOpaqueTrue,
  generateOpaqueFalse,
  buildOpaqueExpression,
  buildOpaqueFalseExpression,
  injectOpaqueBranch,
  injectOpaqueAssignment
} from "./opaque.js"

import {
  DeadCodeInjector,
  createDeadCodeInjector,
  injectDeadCode,
  generateDeadBlock,
  generateDeadLoop,
  generateDeadFunction,
  generateDeadTable,
  generateJunkStatement
} from "./dead-code.js"

import {
  ConstantHider,
  createConstantHider,
  hideConstants,
  encodeNumber,
  encodeBoolean,
  encodeString
} from "./constant-hider.js"

import {
  Minifier,
  createMinifier,
  minify,
  aggressiveMinify,
  collapseWhitespace,
  removeAroundOperators
} from "./minify.js"

import {
  StringEncryptor,
  createStringEncryptor,
  encodeString as encodeProtectedString,
  encodeShortString,
  processString,
  processSource
} from "./strings.js"

export {
  Renamer,
  createRenamer,
  renameSource,
  buildRenameMap,
  replaceIdentifiers,
  generateName,

  ControlFlowObfuscator,
  createControlFlowObfuscator,
  controlFlowObfuscate,
  transformBlock,
  splitStatements,
  injectJunk,
  flattenStatements,
  opaqueTrue,
  opaqueFalse,

  OpaquePredicate,
  createOpaquePredicate,
  obfuscateOpaque,
  generateOpaqueTrue,
  generateOpaqueFalse,
  buildOpaqueExpression,
  buildOpaqueFalseExpression,
  injectOpaqueBranch,
  injectOpaqueAssignment,

  DeadCodeInjector,
  createDeadCodeInjector,
  injectDeadCode,
  generateDeadBlock,
  generateDeadLoop,
  generateDeadFunction,
  generateDeadTable,
  generateJunkStatement,

  ConstantHider,
  createConstantHider,
  hideConstants,
  encodeNumber,
  encodeBoolean,
  encodeString,

  Minifier,
  createMinifier,
  minify,
  aggressiveMinify,
  collapseWhitespace,
  removeAroundOperators,

  StringEncryptor,
  createStringEncryptor,
  encodeProtectedString,
  encodeShortString,
  processString,
  processSource
}

export default {
  Renamer,
  ControlFlowObfuscator,
  OpaquePredicate,
  DeadCodeInjector,
  ConstantHider,
  Minifier,
  StringEncryptor
}
