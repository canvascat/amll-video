/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://www.remotion.dev/docs/config
 */

import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

const pixiStub = path.resolve(process.cwd(), "src/remotion/pixi-stub.ts");

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromeMode("headless-shell");
Config.setChromiumOpenGlRenderer("angle");
Config.overrideBundlerConfig((currentConfiguration) => {
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
});
