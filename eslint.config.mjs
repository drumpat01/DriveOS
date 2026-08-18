import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["server/**/*.ts"],
    languageOptions: { globals: { Buffer: "readonly", process: "readonly", console: "readonly", setTimeout: "readonly", clearTimeout: "readonly", fetch: "readonly", URL: "readonly", AbortSignal: "readonly" } },
    rules: { "@typescript-eslint/no-explicit-any": "off" }
  }
);
