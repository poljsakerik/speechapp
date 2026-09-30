import base from "./base.js"
import reactHooks from "eslint-plugin-react-hooks"

export default [...base, reactHooks.configs.flat.recommended]
