import ProjectForm from "@/components/ProjectForm";
import { createProjectFormAction } from "@/lib/actions/project-form-actions";

export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New project</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <ProjectForm action={createProjectFormAction} />
      </div>
    </div>
  );
}
