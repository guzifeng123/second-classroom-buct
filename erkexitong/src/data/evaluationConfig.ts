import type { EvaluationDimensionConfig, EvaluationItemConfig } from "../types/evaluation";

export const EVALUATION_RULE_VERSION = "2026.07.v1";

export const evaluationConfig: EvaluationDimensionConfig[] = [
  {
    key: "moral",
    title: "道德与思想素质",
    maxScore: 180,
    baseMax: 144,
    extensionMax: 36,
    sections: [
      {
        key: "base",
        title: "基础评定",
        maxScore: 144,
        items: [
          {
            id: "class-review",
            title: "班级民主评议",
            description: "按班级民主评议结果计分",
            maxScore: 35,
            scoreType: "select",
            mode: "single",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写评议结果、过程或佐证说明",
            options: [
              { label: "优秀", value: "excellent", score: 35 },
              { label: "合格", value: "qualified", score: 25 }
            ]
          },
          {
            id: "moral-activity",
            title: "参加德育活动",
            description: "每次 10 分，上限 50 分",
            maxScore: 50,
            scoreType: "count",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写活动名称、时间、参与情况",
            scorePerRecord: 10
          },
          {
            id: "youth-study",
            title: "青年大学习",
            description: "全勤 35 分",
            maxScore: 35,
            scoreType: "select",
            mode: "single",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写学习完成情况",
            options: [
              { label: "全勤", value: "full", score: 35 },
              { label: "基本完成", value: "partial", score: 25 },
              { label: "未完成", value: "none", score: 0 }
            ]
          },
          {
            id: "student-code",
            title: "践行学生行为准则",
            description: "基础 40 分，违规按审核扣减",
            maxScore: 40,
            scoreType: "fixed",
            mode: "single",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写遵守行为准则的情况",
            fixedScore: 40
          }
        ]
      },
      {
        key: "extension",
        title: "拓展评定",
        maxScore: 36,
        items: [
          {
            id: "moral-honor",
            title: "德育类荣誉",
            description: "按荣誉级别计分，上限 30 分",
            maxScore: 30,
            scoreType: "select",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写荣誉名称、级别、授予单位",
            options: [
              { label: "国家级", value: "national", score: 30 },
              { label: "省部级", value: "province", score: 20 },
              { label: "校级", value: "school", score: 10 },
              { label: "院级", value: "college", score: 5 }
            ]
          },
          {
            id: "student-service",
            title: "学生组织履职",
            description: "优秀 20 分，称职 10 分",
            maxScore: 20,
            scoreType: "select",
            mode: "single",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写任职岗位、任期与考核情况",
            options: [
              { label: "优秀", value: "excellent", score: 20 },
              { label: "称职", value: "qualified", score: 10 },
              { label: "无", value: "none", score: 0 }
            ]
          }
        ]
      }
    ]
  },
  {
    key: "academic",
    title: "学术与科技创新",
    maxScore: 120,
    baseMax: 96,
    extensionMax: 24,
    sections: [
      {
        key: "base",
        title: "基础评定",
        maxScore: 96,
        items: [
          {
            id: "competition",
            title: "学科竞赛或大创项目",
            description: "按获奖或结题情况计分",
            maxScore: 50,
            scoreType: "select",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写项目/竞赛名称、级别、结果",
            options: [
              { label: "国家级", value: "national", score: 50 },
              { label: "省部级", value: "province", score: 35 },
              { label: "校级", value: "school", score: 20 }
            ]
          },
          {
            id: "science-activity",
            title: "科技活动",
            description: "每次 10 分，上限 30 分",
            maxScore: 30,
            scoreType: "count",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写活动名称、时间与参与情况",
            scorePerRecord: 10
          },
          {
            id: "academic-lecture",
            title: "学术讲座报告",
            description: "每次 5 分，上限 16 分",
            maxScore: 16,
            scoreType: "count",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写讲座主题、主讲人和收获",
            scorePerRecord: 5
          }
        ]
      },
      {
        key: "extension",
        title: "拓展评定",
        maxScore: 24,
        items: [
          {
            id: "paper-patent",
            title: "论文、专利或软件著作权",
            description: "按成果类型与级别计分",
            maxScore: 24,
            scoreType: "select",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写成果名称、本人贡献与证明编号",
            options: [
              { label: "高水平成果", value: "high", score: 24 },
              { label: "一般成果", value: "normal", score: 12 }
            ]
          }
        ]
      }
    ]
  },
  {
    key: "sports",
    title: "体育与身心健康",
    maxScore: 100,
    baseMax: 80,
    extensionMax: 20,
    sections: [
      {
        key: "base",
        title: "基础评定",
        maxScore: 80,
        items: [
          {
            id: "physical-test",
            title: "体质健康测试",
            description: "按测试等级计分",
            maxScore: 50,
            scoreType: "select",
            mode: "single",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写测试等级或成绩说明",
            options: [
              { label: "优秀", value: "excellent", score: 50 },
              { label: "良好", value: "good", score: 40 },
              { label: "合格", value: "pass", score: 30 }
            ]
          },
          {
            id: "sports-activity",
            title: "体育活动参与",
            description: "每次 10 分，上限 30 分",
            maxScore: 30,
            scoreType: "count",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写活动名称和参与情况",
            scorePerRecord: 10
          }
        ]
      },
      {
        key: "extension",
        title: "拓展评定",
        maxScore: 20,
        items: [
          {
            id: "sports-honor",
            title: "体育竞赛荣誉",
            description: "按竞赛级别计分",
            maxScore: 20,
            scoreType: "select",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写比赛名称、级别和名次",
            options: [
              { label: "国家级", value: "national", score: 20 },
              { label: "省部级", value: "province", score: 15 },
              { label: "校级", value: "school", score: 10 }
            ]
          }
        ]
      }
    ]
  },
  {
    key: "aesthetic",
    title: "美学与人文素养",
    maxScore: 100,
    baseMax: 80,
    extensionMax: 20,
    sections: [
      {
        key: "base",
        title: "基础评定",
        maxScore: 80,
        items: [
          {
            id: "art-course",
            title: "美育课程或活动",
            description: "每次 10 分，上限 40 分",
            maxScore: 40,
            scoreType: "count",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写课程/活动名称与完成情况",
            scorePerRecord: 10
          },
          {
            id: "humanity-reading",
            title: "人文阅读与分享",
            description: "每次 10 分，上限 40 分",
            maxScore: 40,
            scoreType: "count",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写阅读作品、分享形式与收获",
            scorePerRecord: 10
          }
        ]
      },
      {
        key: "extension",
        title: "拓展评定",
        maxScore: 20,
        items: [
          {
            id: "art-honor",
            title: "美育作品或荣誉",
            description: "按作品/荣誉级别计分",
            maxScore: 20,
            scoreType: "select",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写作品名称、展演或获奖情况",
            options: [
              { label: "省部级及以上", value: "province", score: 20 },
              { label: "校级", value: "school", score: 12 },
              { label: "院级", value: "college", score: 6 }
            ]
          }
        ]
      }
    ]
  },
  {
    key: "labor",
    title: "劳动与社会实践",
    maxScore: 100,
    baseMax: 80,
    extensionMax: 20,
    sections: [
      {
        key: "base",
        title: "基础评定",
        maxScore: 80,
        items: [
          {
            id: "labor-hours",
            title: "劳动教育时长",
            description: "每 2 小时 5 分，上限 40 分",
            maxScore: 40,
            scoreType: "number",
            mode: "single",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写劳动地点、内容和时长说明",
            scorePerUnit: 2.5,
            unitLabel: "小时"
          },
          {
            id: "volunteer-hours",
            title: "志愿服务时长",
            description: "每 2 小时 5 分，上限 40 分",
            maxScore: 40,
            scoreType: "number",
            mode: "single",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写服务组织、内容和时长说明",
            scorePerUnit: 2.5,
            unitLabel: "小时"
          }
        ]
      },
      {
        key: "extension",
        title: "拓展评定",
        maxScore: 20,
        items: [
          {
            id: "social-practice",
            title: "社会实践与劳动荣誉",
            description: "按实践成果或荣誉级别计分",
            maxScore: 20,
            scoreType: "select",
            mode: "multi",
            requiredText: true,
            imageLimit: 3,
            placeholder: "填写实践项目、成果或荣誉信息",
            options: [
              { label: "省部级及以上", value: "province", score: 20 },
              { label: "校级", value: "school", score: 12 },
              { label: "院级", value: "college", score: 6 }
            ]
          }
        ]
      }
    ]
  }
];

export function findEvaluationItem(itemId: string): EvaluationItemConfig | undefined {
  for (const dimension of evaluationConfig) {
    for (const section of dimension.sections) {
      const item = section.items.find((candidate) => candidate.id === itemId);
      if (item) {
        return item;
      }
    }
  }

  return undefined;
}
