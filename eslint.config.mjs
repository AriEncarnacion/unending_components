import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noComments from "./lint/no-comments.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    plugins: { unending: noComments },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: { "unending/no-comments": "error" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/worktrees/**",
    ".generated/**",
    "design-systems/**",
    "components/ui/**",
    "hooks/use-mobile.ts",
    "hooks/use-highlighted-code.ts",
    "lib/highlighter.tsx",
  ]),
]);

export default eslintConfig;
