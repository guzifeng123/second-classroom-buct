import { defineConfig } from "@tarojs/cli";
import devConfig from "./dev";
import prodConfig from "./prod";

export default defineConfig(async (merge) => {
  const outputRootByTarget: Record<string, string> = {
    h5: "dist/h5",
    weapp: "dist/weapp",
    rn: "dist/rn/taro"
  };
  const baseConfig = {
    projectName: "erkexitong",
    date: "2026-06-07",
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2
    },
    sourceRoot: "src",
    outputRoot: outputRootByTarget[process.env.TARO_ENV ?? ""] ?? "dist",
    framework: "react",
    compiler: {
      type: "webpack5",
      prebundle: {
        enable: false
      }
    },
    cache: {
      enable: false
    },
    plugins: [],
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        url: {
          enable: true,
          config: {
            limit: 1024
          }
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]"
          }
        }
      }
    },
    h5: {
      publicPath: "/",
      staticDirectory: "static",
      output: {
        filename: "js/[name].[hash:8].js",
        chunkFilename: "js/[name].[chunkhash:8].js"
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: "css/[name].[hash].css",
        chunkFilename: "css/[name].[chunkhash].css"
      }
    },
    rn: {
      appName: "erkexitong",
      deviceType: "android",
      output: {
        android: "dist/rn/android/index.bundle",
        androidAssetsDest: "dist/rn/android/assets"
      }
    }
  };

  if (process.env.NODE_ENV === "development") {
    return merge({}, baseConfig, devConfig);
  }

  return merge({}, baseConfig, prodConfig);
});
