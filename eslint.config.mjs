import next from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
  {
    // Declared explicitly: version detection in eslint-plugin-react relies on an
    // API that ESLint 10 removed.
    settings: { react: { version: "19.3" } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react/no-danger": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: "Read configuration through src/server/env.ts.",
        },
      ],
    },
  },
  {
    files: ["src/server/env.ts", "*.config.*", "tests/**", "scripts/**", "src/app/**/opengraph-image.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Media are served through short-lived signed URLs already optimised on upload;
    // next/image would cache expiring URLs.
    files: ["src/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
];

export default config;
