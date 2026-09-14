import { users } from "@/lib/data";
import { login } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">
        Log in to Billboard Exchange
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Pick a demo account. Every seeded account uses the same password:{" "}
        <span className="font-semibold text-slate-700">demo1234</span>.
      </p>
      <form action={login} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Account
          </label>
          <select
            name="userId"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
            defaultValue={users[0].id}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Password
          </label>
          <input
            type="password"
            name="password"
            defaultValue="demo1234"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
