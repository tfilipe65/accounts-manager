"use server";

import { redirect } from "next/navigation";
import { createEmployee, updateEmployee, deleteEmployee, type EmployeeInput } from "@/lib/actions/employee-actions";

function str(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) || "").trim();
  return v || null;
}

function toInput(fd: FormData): EmployeeInput {
  const salary = String(fd.get("monthly_salary") || "").trim();
  return {
    name: String(fd.get("name") || "").trim(),
    position: str(fd, "position"),
    vat_number: str(fd, "vat_number"),
    social_security_number: str(fd, "social_security_number"),
    address: str(fd, "address"),
    zip: str(fd, "zip"),
    city: str(fd, "city"),
    country: str(fd, "country"),
    telephone: str(fd, "telephone"),
    email: str(fd, "email"),
    iban: str(fd, "iban"),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    monthly_salary: salary === "" ? null : Number(salary),
    status: String(fd.get("status") || "Active") === "Inactive" ? "Inactive" : "Active",
    notes: str(fd, "notes"),
  };
}

export async function createEmployeeFormAction(_prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.name) return { error: "Name is required." };
  try {
    await createEmployee(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the employee." };
  }
  redirect("/employees");
}

export async function updateEmployeeFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.name) return { error: "Name is required." };
  try {
    await updateEmployee(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the employee." };
  }
  redirect("/employees");
}

export async function deleteEmployeeAction(id: number) {
  await deleteEmployee(id);
}
