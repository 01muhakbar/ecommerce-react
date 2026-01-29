import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/axios.ts";

const fetchMe = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

const updateProfile = async (payload) => {
  const { data } = await api.put("/store/profile", payload);
  return data;
};

export default function AccountProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["account", "me"],
    queryFn: fetchMe,
  });
  const user = data?.data?.user;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      setStatus({ type: "success", message: "Profile updated." });
      await qc.invalidateQueries({ queryKey: ["account", "me"] });
    },
    onError: () => {
      setStatus({ type: "error", message: "Failed to update profile." });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus(null);
    mutation.mutate({ name, email });
  };

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading profile...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Your name"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="you@email.com"
        />
      </div>

      {status && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {status.message}
        </div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        {mutation.isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
