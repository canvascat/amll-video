/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://www.remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { bundlerOverride } from "./src/remotion/webpack-override";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromeMode("headless-shell");
Config.setChromiumOpenGlRenderer("angle");
Config.overrideBundlerConfig(bundlerOverride);
