import EmployeeForm from "@/components/EmployeeForm";
import { createEmployeeFormAction } from "@/lib/actions/employee-form-actions";

export default function NewEmployeePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New employee</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <EmployeeForm action={createEmployeeFormAction} />
      </div>
    </div>
  );
}
