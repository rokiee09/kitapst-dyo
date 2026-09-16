export function PlaceholderView({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[#0d1524] p-8">
      <div className="max-w-md rounded-lg border border-[#1c2a44] bg-[#070b14] p-6">
        <h1 className="mb-2 text-lg font-semibold">{title}</h1>
        <p className="text-sm text-[#8aa0bd]">{body}</p>
      </div>
    </div>
  );
}
