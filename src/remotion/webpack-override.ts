import path from "node:path";
import type { BundlerOverrideFn } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";

const pixiStub = path.resolve(process.cwd(), "src/remotion/pixi-stub.ts");

export const bundlerOverride: BundlerOverrideFn = (currentConfiguration) => {
  const withTailwind = enableTailwind(currentConfiguration);
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...(withTailwind.resolve?.alias as Record<string, string> | undefined),
        "@pixi/app": pixiStub,
        "@pixi/core": pixiStub,
        "@pixi/display": pixiStub,
        "@pixi/filter-blur": pixiStub,
        "@pixi/filter-bulge-pinch": pixiStub,
        "@pixi/filter-color-matrix": pixiStub,
        "@pixi/sprite": pixiStub,
      },
    },
  };
};
