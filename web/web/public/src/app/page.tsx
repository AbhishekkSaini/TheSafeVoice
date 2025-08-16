export default function Home() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold mb-2">SafeVoice</h1>
      <p className="text-gray-600 mb-4">Community forum and safety resources.</p>
      <div className="flex gap-3">
        <a className="rounded bg-black text-white px-4 py-2" href="/forum">Open Forum</a>
        <a className="rounded border px-4 py-2" href="/login">Login</a>
        <a className="rounded border px-4 py-2" href="/signup">Sign up</a>
      </div>
    </div>
  );
}
