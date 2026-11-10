import { DesignPage } from "@/components/design/design-page";
export const metadata = { title: "讨论空间" };
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{project?:string}>}) {
  const {project}=await searchParams;
  return <DesignPage name="projects" query={{tab:"discussion",project}}/>;
}
