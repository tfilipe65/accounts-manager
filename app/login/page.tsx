import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-dark p-6">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-semibold text-primary">Accounts Manager</h1>
        <p className="mb-6 text-sm text-neutral-600">Teia Firme Lda &mdash; sign in to continue.</p>
        <LoginForm />
      </div>
    </div>
  );
}
