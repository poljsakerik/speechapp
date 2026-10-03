import reactHooks from "eslint-plugin-react-hooks";
import base from "./base.js";

export default [...base, reactHooks.configs.flat.recommended];
