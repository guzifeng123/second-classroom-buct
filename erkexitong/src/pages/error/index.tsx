import Taro, { useRouter } from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { FeedbackButton } from "../../components/ui";
import "./index.scss";

const messages: Record<string, { title: string; copy: string }> = {
  offline: {
    title: "当前是离线模式",
    copy: "未配置后端地址时，可以登录、填写和本地暂存；正式提交、远端图片和跨端同步需要连接后端。"
  },
  sync: {
    title: "同步暂时不可用",
    copy: "本地草稿仍然保留，稍后可重新保存或回到评定页继续编辑。"
  },
  notFound: {
    title: "页面未找到",
    copy: "这个入口还没有注册或地址已经变化。"
  }
};

export default function ErrorPage() {
  const router = useRouter();
  const type = router.params.type ?? "notFound";
  const message = messages[type] ?? messages.notFound;

  return (
    <View className="page-shell error-page">
      <View className="error-page__panel">
        <Text className="error-page__label">状态说明</Text>
        <Text className="error-page__title">{message.title}</Text>
        <Text className="error-page__copy">{message.copy}</Text>
        <View className="error-page__actions">
          <FeedbackButton
            className="error-page__primary"
            loadingText="返回中"
            onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}
          >
            回到评定页
          </FeedbackButton>
          <FeedbackButton
            className="error-page__ghost"
            loadingText="打开中"
            onClick={() => Taro.redirectTo({ url: "/pages/login/index" })}
          >
            登录页
          </FeedbackButton>
        </View>
      </View>
    </View>
  );
}
