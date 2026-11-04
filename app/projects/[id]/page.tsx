import { notFound } from "next/navigation";
import ProjectForm from "@/components/ProjectForm";
import { getProject } from "@/lib/actions/project-actions";
import { updateProjectFormAction } from "@/lib/actions/project-form-actions";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(Number(id));
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit project</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <ProjectForm initial={project} action={updateProjectFormAction.bind(null, project.id)} />
      </div>
    </div>
  );
}
