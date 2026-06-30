// Protected owner landing page.
// The proxy already verified the session before this page renders.
// A request that reaches this handler is guaranteed to be authenticated.

export default function OwnerPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl text-ink mb-2 tracking-tight">
          Owner area
        </h1>
        <p className="text-gray-1 text-sm mb-10">Authenticated.</p>

        <form action="/api/owner/logout" method="POST">
          <button
            type="submit"
            className="text-sm text-gray-1 hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
