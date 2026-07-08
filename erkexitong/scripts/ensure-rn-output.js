const fs = require("fs");
const path = require("path");

fs.mkdirSync(path.join(process.cwd(), "dist", "rn", "android", "assets"), {
  recursive: true
});
