import { useEffect, useRef } from "react";
import { promptApplyIncomingTransfer } from "../../../services/transferService";
import { useTransferStore } from "../../../stores/useTransferStore";

export function useEvaluationTransferPrompt() {
  const promptLockRef = useRef(false);
  const incomingTransfer = useTransferStore((state) => state.incomingTransfer);
  const clearIncoming = useTransferStore((state) => state.clearIncoming);

  useEffect(() => {
    if (!incomingTransfer || promptLockRef.current) {
      return;
    }

    promptLockRef.current = true;
    promptApplyIncomingTransfer(incomingTransfer)
      .catch(() => {
        clearIncoming();
      })
      .finally(() => {
        promptLockRef.current = false;
      });
  }, [incomingTransfer, clearIncoming]);
}
