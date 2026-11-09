export function accountAvatarSrc(name: string | null | undefined, image: string | null | undefined) {
  if (image) return image;
  const initial = Array.from(name?.trim() || "我")[0];
  const escaped = initial.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" }[c]!));
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#3525cd"/><text x="80" y="82" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial,PingFang SC,Microsoft YaHei,sans-serif" font-size="68">${escaped}</text></svg>`);
}
