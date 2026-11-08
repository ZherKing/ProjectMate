import { DesignPage } from "@/components/design/design-page";
export const metadata={title:"文档产出"};
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{project?:string}>}) {const {project}=await searchParams;return <DesignPage name="projects" query={{tab:"files",project}}/>;}
