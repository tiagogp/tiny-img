import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/* ESLint 9+ only reads flat config, and `next lint` is gone as of Next 16, so
   the CLI is invoked directly (see the `lint` script). eslint-config-next ships
   flat config natively from v16, so no FlatCompat shim is needed. */
const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/vendor/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
