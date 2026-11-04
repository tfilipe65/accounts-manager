"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type ProjectInput = {
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  free_code_1: string | null;
};

export type Project = ProjectInput & { id: number };

export async function getProject(id: number): Promise<Project | null> {
  await requireSession();
  return queryOne<Project>("SELECT * FROM projects WHERE id = $1", [id]);
}

export async function createProject(input: ProjectInput): Promise<number> {
  await requireSession();
  const row = await queryOne<{ id: number }>(
    `INSERT INTO projects (code, name, start_date, end_date, status, free_code_1) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.code, input.name, input.start_date, input.end_date, input.status, input.free_code_1]
  );
  revalidatePath("/projects");
  return row!.id;
}

export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  await requireSession();
  await query(`UPDATE projects SET code=$2, name=$3, start_date=$4, end_date=$5, status=$6, free_code_1=$7 WHERE id=$1`, [
    id,
    input.code,
    input.name,
    input.start_date,
    input.end_date,
    input.status,
    input.free_code_1,
  ]);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: number): Promise<void> {
  await requireSession();
  await query("DELETE FROM projects WHERE id = $1", [id]);
  revalidatePath("/projects");
}
