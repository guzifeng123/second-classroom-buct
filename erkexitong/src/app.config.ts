export default defineAppConfig({
  pages: [
    "pages/login/index",
    "pages/evaluation/index",
    "pages/evaluation/preview/index",
    "pages/note/list/index",
    "pages/note/edit/index",
    "pages/note/snapshot/index",
    "pages/image/library/index",
    "pages/submission/result/index",
    "pages/submission/history/index",
    "pages/error/index"
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#1f3d32",
    navigationBarTitleText: "学生综合素质评定",
    navigationBarTextStyle: "white",
    backgroundColor: "#f3f7f4"
  }
});
