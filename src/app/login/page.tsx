import { Scale } from "lucide-react";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-premium">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Scale className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Hukuk Finans</h1>
            <p className="text-sm text-slate-500">Tek kullanıcı girişi</p>
          </div>
        </div>

        <form action="/api/auth/login" method="post" className="space-y-4">
          <label className="block space-y-1">
            <span className="label">E-posta</span>
            <input
              className="field"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="label">Şifre</span>
            <input
              className="field"
              type="password"
              name="password"
              autoComplete="current-password"
              minLength={10}
              required
            />
          </label>

          {params.error ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              E-posta veya şifre hatalı.
            </p>
          ) : null}

          <button type="submit" className="primary-action w-full">
            Giriş yap
          </button>
        </form>
      </section>
    </main>
  );
}
