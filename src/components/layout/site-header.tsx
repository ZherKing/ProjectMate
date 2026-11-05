import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { hasAdminRole } from "@/lib/auth/permissions";
import { ScrollHeader } from "./scroll-header";
import { SiteNav } from "./site-nav";
import styles from "./site-header.module.css";
import { getSiteSetting } from "@/lib/site-settings";
import { NavigationProgress } from "./navigation-progress";

const nav = [["比赛中心", "/competitions"], ["组队大厅", "/teams"], ["项目空间", "/projects"]] as const;

export async function SiteHeader() {
  const user = (await auth())?.user;
  const isAdmin = !!user?.id && hasAdminRole(user.id);
  const siteName = getSiteSetting("site.name") || "ProjectMate";
  const siteIcon = getSiteSetting("site.icon") || "/assets/logo.svg";
  return <><ScrollHeader className={styles.header}>
    <div className={styles.inner}>
      <div className={styles.left}>
        <Link href="/" aria-label={`${siteName} 首页`} className={styles.brand}><img src={siteIcon} alt="" width={32} height={32} /><span>{siteName}</span></Link>
        <SiteNav items={nav} className={styles.nav} />
      </div>
      <div className={styles.actions}>
        {user ? <>
          <Link href="/teams?create=1" className={`${styles.primary} ${styles.publish}`}><Plus size={16} aria-hidden="true" />发布项目</Link>
          <details className="pm-user-menu">
            <summary className={styles.user}>
              <span className={styles.avatar}>{user.image ? <img src={user.image} alt="个人头像" width={32} height={32} /> : (user.name || "我").slice(0, 1)}</span>
              <strong className={styles.name}>{user.name || "项目成员"}</strong>
            </summary>
            <div className="pm-user-menu-panel"><Link href="/settings">个人设置</Link>{isAdmin && <Link href="/admin">管理员后台</Link>}<a href="/api/auth/signout?callbackUrl=/">退出登录</a></div>
          </details>
        </> : <><Link href="/login" className={styles.login}>登录</Link><Link href="/register" className={styles.primary}>免费注册</Link></>}
      </div>
    </div>
  </ScrollHeader><NavigationProgress /></>;
}
