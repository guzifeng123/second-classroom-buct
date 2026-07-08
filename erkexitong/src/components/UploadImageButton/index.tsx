import { PropsWithChildren, useState } from "react";
import Taro from "@tarojs/taro";
import { Button } from "@tarojs/components";
import { getErrorMessage } from "../../services/api";
import { rememberUploadedImage } from "../../services/imageLibraryService";
import { chooseAndUpload, chooseLocalImages, uploadedToProofImage } from "../../services/upload";
import type { ProofImage } from "../../types/evaluation";
import "./index.scss";

interface UploadImageButtonProps {
  onUploaded: (images: ProofImage[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  remaining?: number;
  strategy?: "local" | "upload";
  variant?: "default" | "toolbar" | "compact";
  className?: string;
}

export default function UploadImageButton({
  onUploaded,
  multiple = true,
  disabled = false,
  remaining = 3,
  strategy = "local",
  variant = "default",
  className,
  children
}: PropsWithChildren<UploadImageButtonProps>) {
  const [loading, setLoading] = useState(false);
  const buttonClassName = [
    "upload-image-button",
    `upload-image-button--${variant}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  const handleChoose = async () => {
    if (disabled || loading || remaining <= 0) {
      return;
    }

    setLoading(true);
    try {
      const count = multiple ? remaining : 1;
      const uploaded = strategy === "upload" ? await chooseAndUpload({ count }) : [];
      const images = strategy === "upload" ? uploaded.map(uploadedToProofImage) : await chooseLocalImages({ count });

      if (uploaded.length > 0) {
        await Promise.all(uploaded.map((image) => rememberUploadedImage(image)));
      }

      onUploaded(images);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("cancel")) {
        await Taro.showToast({
          title: getErrorMessage(error, strategy === "upload" ? "图片上传失败" : "图片选择失败"),
          icon: "none"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className={buttonClassName}
      disabled={disabled || loading || remaining <= 0}
      loading={loading}
      onClick={handleChoose}
    >
      {children ?? (remaining > 0 ? `图片 ${remaining}` : "图片已满")}
    </Button>
  );
}
