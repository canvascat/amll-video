import path from "node:path";
import type { BundlerOverrideFn } from "@remotion/bundler";

const pixiStub = path.resolve(process.cwd(), "src/remotion/pixi-stub.ts");

export const bundlerOverride: BundlerOverrideFn = (currentConfiguration) => {
  return {
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        ...(currentConfiguration.resolve?.alias as Record<string, string> | undefined),
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
