const { findRnStyleIssues } = require("./utils/rn-style-validation");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

const validSource = `
.page-shell {
  font-weight: 700;
}

.page-shell__title {
  font-weight: bold;
}
`;
const invalidSource = `
View,
.card Text,
* {
  font-weight: 750;
}
`;
const validIssues = findRnStyleIssues(validSource);
const invalidIssues = findRnStyleIssues(invalidSource);

assertEqual(validIssues.length, 0, "类选择器和 Android 支持的字重不应报错");
assertEqual(
  invalidIssues.filter((issue) => issue.type === "unsupported-selector").length,
  3,
  "元素、后代元素和通配符选择器都应被识别"
);
assertEqual(
  invalidIssues.filter((issue) => issue.type === "unsupported-font-weight").length,
  1,
  "非整百字重应被识别"
);

console.log("RN 样式静态校验规则测试通过。");
