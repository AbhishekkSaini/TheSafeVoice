"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone10, setPhone10] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const normalizePhoneIndia = (input: string) => {
    const digits = (input || "").replace(/\D/g, "");
    if (digits.length === 10) return "+91" + digits;
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const normalizedPhone = normalizePhoneIndia(phone10);
    if (!normalizedPhone) {
      setLoading(false);
      setError("Enter a valid Indian mobile number (10 digits)");
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setMessage("Check your email to verify your account.");
    if (data?.user?.id) {
      await supabase.rpc("upsert_profile_secure", {
        p_id: data.user.id,
        p_email: email,
        p_phone: normalizedPhone,
        p_display_name: `${firstName} ${lastName}`.trim(),
      });
    }
    setLoading(false);
    router.push("/login");
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <input
          className="w-full border rounded px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Phone (10 digits)"
          value={phone10}
          onChange={(e) => setPhone10(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        <button
          className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </div>
  );
}


