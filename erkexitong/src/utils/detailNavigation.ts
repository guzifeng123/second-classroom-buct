import Taro from "@tarojs/taro";

const H5_DETAIL_ROUTES = new Set([
  "/pages/evaluation/preview/index",
  "/pages/note/list/index",
  "/pages/note/edit/index",
  "/pages/note/snapshot/index",
  "/pages/image/library/index",
  "/pages/submission/result/index",
  "/pages/submission/history/index"
]);

let pendingDetailRouteKey = "";

function splitRoute(routePath: string): { path: string; query: string } {
  const withoutHashPrefix = routePath.startsWith("#/") ? routePath.slice(1) : routePath;
  const [withoutHash] = withoutHashPrefix.split("#");
  const queryStart = withoutHash.indexOf("?");

  if (queryStart < 0) {
    return {
      path: withoutHash,
      query: ""
    };
  }

  return {
    path: withoutHash.slice(0, queryStart),
    query: withoutHash.slice(queryStart + 1)
  };
}

export function normalizeRoutePath(routePath: string): string {
  const { path } = splitRoute(routePath);
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;

  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

function normalizeRouteKey(routePath: string): string {
  const { query } = splitRoute(routePath);
  const normalizedPath = normalizeRoutePath(routePath);

  if (!query) {
    return normalizedPath;
  }

  const params = Array.from(new URLSearchParams(query).entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    `${leftKey}=${leftValue}`.localeCompare(`${rightKey}=${rightValue}`)
  );
  const normalizedQuery = new URLSearchParams(params).toString();

  return normalizedQuery ? `${normalizedPath}?${normalizedQuery}` : normalizedPath;
}

function getCurrentRoutePath(): string {
  if (process.env.TARO_ENV === "h5" && typeof window !== "undefined") {
    const hashRoute = window.location.hash.startsWith("#/")
      ? window.location.hash.slice(1)
      : "";

    return hashRoute || `${window.location.pathname}${window.location.search}`;
  }

  const pages = Taro.getCurrentPages?.() ?? [];
  return pages[pages.length - 1]?.route ?? "";
}

export function isH5DetailRoutePath(routePath: string): boolean {
  return H5_DETAIL_ROUTES.has(normalizeRoutePath(routePath));
}

function releasePendingRoute(routeKey: string): void {
  setTimeout(() => {
    if (pendingDetailRouteKey === routeKey) {
      pendingDetailRouteKey = "";
    }
  }, 800);
}

export async function openDetailRouteOnce(url: string): Promise<void> {
  const currentRouteKey = normalizeRouteKey(getCurrentRoutePath());
  const targetRouteKey = normalizeRouteKey(url);

  if (currentRouteKey === targetRouteKey || pendingDetailRouteKey === targetRouteKey) {
    return;
  }

  if (process.env.TARO_ENV === "h5" && isH5DetailRoutePath(url)) {
    pendingDetailRouteKey = targetRouteKey;

    try {
      await Taro.redirectTo({ url });
    } finally {
      releasePendingRoute(targetRouteKey);
    }
    return;
  }

  await Taro.navigateTo({ url });
}
