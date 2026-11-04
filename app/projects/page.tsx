import Link from "next/link";
import { query } from "@/lib/db";
import { formatDate } from "@/lib/formatters";
import { deleteProjectAction } from "@/lib/actions/project-form-actions";

type Project = {
  id: number;
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
};

export default async function ProjectsPage() {
  const projects = await query<Project>("SELECT id, code, name, start_date, end_date, status FROM projects ORDER BY start_date");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Projects</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">{projects.length} projects</span>
          <Link href="/projects/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            + New project
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Start</th>
              <th className="px-4 py-2">End</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/projects/${p.id}`} className="text-primary hover:underline">
                    {p.code}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">{p.start_date ? formatDate(p.start_date) : ""}</td>
                <td className="px-4 py-2">{p.end_date ? formatDate(p.end_date) : ""}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/projects/${p.id}`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteProjectAction.bind(null, p.id)}>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
