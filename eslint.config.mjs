import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Dropping a prop by destructuring it next to `...rest` is intentional.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Stock shadcn files, owned upstream and refreshed with `shadcn add --overwrite`.
    "components/ui/**",
    "hooks/use-mobile.ts",
    "hooks/use-highlighted-code.ts",
    "lib/highlighter.tsx",
    "public/r/**",
    // The registry Worker has its own TypeScript setup and tests (worker/).
    "worker/**",
  ]),
]);

export default eslintConfig;
