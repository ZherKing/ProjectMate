export type FileTreeNode = { name: string; path: string; fileId?: string; children: FileTreeNode[] };
export function buildFileTree(files: Array<{id:string;path:string}>) {
  const roots: FileTreeNode[]=[];
  for(const file of files){let nodes=roots;let path="";const parts=file.path.split("/");parts.forEach((name,index)=>{path=path?`${path}/${name}`:name;let node=nodes.find(n=>n.name===name);if(!node){node={name,path,children:[]};nodes.push(node);}if(index===parts.length-1)node.fileId=file.id;nodes=node.children;});}
  function sort(nodes:FileTreeNode[]){nodes.sort((a,b)=>Number(Boolean(a.fileId))-Number(Boolean(b.fileId))||a.name.localeCompare(b.name,"zh-CN"));nodes.forEach(n=>sort(n.children));}
  sort(roots);return roots;
}
