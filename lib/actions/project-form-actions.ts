"use server";

import { redirect } from "next/navigation";
import { createProject, updateProject, deleteProject, type ProjectInput } from "@/lib/actions/project-actions";

function str(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) || "").trim();
  return v || null;
}

function toInput(fd: FormData): ProjectInput {
  return {
    code: String(fd.get("code") || "").trim(),
    name: String(fd.get("name") || "").trim(),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    status: str(fd, "status"),
    free_code_1: str(fd, "free_code_1"),
  };
}

export async function createProjectFormAction(_prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.code) return { error: "Project code is required." };
  if (!input.name) return { error: "Project name is required." };
  try {
    await createProject(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the project." };
  }
  redirect("/projects");
}

export async function updateProjectFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.code) return { error: "Project code is required." };
  if (!input.name) return { error: "Project name is required." };
  try {
    await updateProject(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the project." };
  }
  redirect("/projects");
}

export async function deleteProjectAction(id: number) {
  await deleteProject(id);
}
