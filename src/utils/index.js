export * from "./random.js"
export * from "./hash.js"

import Random from "./random.js"
import hash from "./hash.js"

export {
  Random,
  hash
}

export default {
  Random,
  ...hash
}
