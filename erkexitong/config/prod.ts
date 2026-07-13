const enableH5AnalyzeSourcemap = process.env.H5_ANALYZE_SOURCEMAP === "1";

type WebpackChain = {
  devtool(value: string): void;
};

export default {
  mini: {},
  h5: {
    publicPath: "/",
    webpackChain(chain: WebpackChain) {
      if (enableH5AnalyzeSourcemap) {
        chain.devtool("source-map");
      }
    }
  }
};
