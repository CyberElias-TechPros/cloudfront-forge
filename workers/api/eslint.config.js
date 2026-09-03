import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  files: ["src/**/*.ts", "tests/**/*.ts"],
  languageOptions: {
    parserOptions: {
      sourceType: "module",
    },
    globals: {
      console: "readonly",
      process: "readonly",
      Buffer: "readonly",
      __dirname: "readonly",
      __filename: "readonly",
    },
  },
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "off",
    "no-undef": "off",
    quotes: ["warn", "double"],
    semi: ["warn", "always"],
  },
});

