import Taro from "@tarojs/taro";
import { create } from "zustand";
import type { AuthMode, UserRole } from "../types/auth";
import { DEFAULT_USER_ROLE, normalizeUserRole } from "../utils/authPermissions";

const SESSION_KEY = "erkexitong-session";

interface SessionSnapshot {
  token: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  authMode: AuthMode;
  role: UserRole;
}

interface UserState extends SessionSnapshot {
  isLoggedIn: boolean;
  login: (userId: string, token: string, authMode?: AuthMode, role?: UserRole) => void;
  setDeviceInfo: (deviceId: string, deviceName: string) => void;
  hydrateSession: () => void;
  logout: () => void;
}

const emptySession: SessionSnapshot = {
  token: "",
  userId: "",
  deviceId: "",
  deviceName: "",
  authMode: "offline",
  role: DEFAULT_USER_ROLE
};

function persistSession(snapshot: SessionSnapshot): void {
  try {
    Taro.setStorageSync(SESSION_KEY, snapshot);
  } catch {
    // Local persistence is best-effort across H5, Mini Program, and RN.
  }
}

export const useUserStore = create<UserState>((set, get) => ({
  ...emptySession,
  isLoggedIn: false,
  login: (userId, token, authMode = "remote", role = DEFAULT_USER_ROLE) => {
    const next = {
      token,
      userId,
      deviceId: get().deviceId,
      deviceName: get().deviceName,
      authMode,
      role: normalizeUserRole(role)
    };
    persistSession(next);
    set({ ...next, isLoggedIn: true });
  },
  setDeviceInfo: (deviceId, deviceName) => {
    const next = {
      token: get().token,
      userId: get().userId,
      deviceId,
      deviceName,
      authMode: get().authMode,
      role: get().role
    };
    if (next.token || next.userId) {
      persistSession(next);
    }
    set({ deviceId, deviceName });
  },
  hydrateSession: () => {
    try {
      const snapshot = Taro.getStorageSync<SessionSnapshot>(SESSION_KEY);
      if (snapshot?.token && snapshot.userId) {
        set({
          ...snapshot,
          authMode: snapshot.authMode ?? "offline",
          role: normalizeUserRole(snapshot.role),
          isLoggedIn: true
        });
      }
    } catch {
      set({ ...emptySession, isLoggedIn: false });
    }
  },
  logout: () => {
    try {
      Taro.removeStorageSync(SESSION_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    set({ ...emptySession, isLoggedIn: false });
  }
}));
