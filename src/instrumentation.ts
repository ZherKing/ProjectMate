export async function register() {
  // Keep Node-only imports inside the positive runtime branch so Next can
  // eliminate them when compiling the instrumentation entry for Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Build workers must never seed a deployment database.
    if (process.env.NEXT_PHASE !== "phase-production-build" && /^(true|1)$/i.test(process.env.DEMO_DATA_ENABLED || "")) {
      try {
        const { importReviewDemo } = await import("@/lib/db/review-demo");
        const result = importReviewDemo();
        if (result.created) console.info("[演示数据] 已初始化评审账号及示例内容，不包含实时AI结果。");
      } catch (error) {
        console.error("[演示数据] 初始化未完成：", error instanceof Error ? error.message : "请检查配置与存储权限。");
      }
    }
    if (process.env.NOTIFICATION_DISABLE_WORKER !== "true") {
      const { startNotificationWorker } = await import("@/lib/notifications/dispatch");
      startNotificationWorker();
    }
  }
}
