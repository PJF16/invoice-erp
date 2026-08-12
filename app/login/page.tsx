import { LoginForm } from "@/components/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Lagerverwaltung</h1>
        <p className="mt-1 mb-6 text-sm text-gray-500">Bitte melde dich an.</p>
        <LoginForm />
        <div className="mt-6 border-t border-gray-100 pt-5 text-center">
          <Link href="/portal/login" className="text-sm font-medium text-blue-700 hover:text-blue-900">
            Zum Kundenportal
          </Link>
        </div>
      </div>
    </main>
  );
}
