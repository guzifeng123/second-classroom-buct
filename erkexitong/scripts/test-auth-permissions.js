const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

const {
  DEFAULT_USER_ROLE,
  canAccessAdminMode,
  getUserRoleLabel,
  inferOfflineUserRole,
  normalizeUserRole
} = loadTsModule(path.join(projectRoot, "src", "utils", "authPermissions.ts"));

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${expected}，实际 ${actual}`);
  }
}

assertEqual(DEFAULT_USER_ROLE, "student", "默认角色应为学生");
assertEqual(normalizeUserRole("student"), "student", "学生角色应可归一化");
assertEqual(normalizeUserRole("class_committee"), "class_committee", "班委角色应可归一化");
assertEqual(normalizeUserRole("counselor"), "counselor", "辅导员角色应可归一化");
assertEqual(normalizeUserRole("admin"), "admin", "管理员角色应可归一化");
assertEqual(normalizeUserRole("teacher"), "student", "未知后端角色应回退为学生");
assertEqual(normalizeUserRole(), "student", "缺省后端角色应回退为学生");

assertEqual(inferOfflineUserRole("admin"), "admin", "离线 admin 用户应推断为管理员");
assertEqual(inferOfflineUserRole("admin-001"), "admin", "离线 admin 前缀应推断为管理员");
assertEqual(inferOfflineUserRole("counselor-001"), "counselor", "离线 counselor 前缀应推断为辅导员");
assertEqual(inferOfflineUserRole("teacher-001"), "counselor", "离线 teacher 前缀应推断为辅导员");
assertEqual(inferOfflineUserRole("monitor-001"), "class_committee", "离线 monitor 前缀应推断为班委");
assertEqual(inferOfflineUserRole("student-001"), "student", "普通离线用户应推断为学生");

assertEqual(canAccessAdminMode("student"), false, "学生不应进入后台模式");
assertEqual(canAccessAdminMode("class_committee"), true, "班委应可进入后台模式");
assertEqual(canAccessAdminMode("counselor"), true, "辅导员应可进入后台模式");
assertEqual(canAccessAdminMode("admin"), true, "管理员应可进入后台模式");

assertEqual(getUserRoleLabel("student"), "学生", "学生角色文案应正确");
assertEqual(getUserRoleLabel("class_committee"), "班委", "班委角色文案应正确");
assertEqual(getUserRoleLabel("counselor"), "辅导员", "辅导员角色文案应正确");
assertEqual(getUserRoleLabel("admin"), "管理员", "管理员角色文案应正确");

console.log("登录角色权限测试通过。");
