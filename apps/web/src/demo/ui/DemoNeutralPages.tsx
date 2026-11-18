function NeutralDemoPage({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
      </div>
    </main>
  );
}

export function DemoLinkExpiredPage() {
  return (
    <NeutralDemoPage
      title="This demo link has expired"
      body="Ask the person who sent it for a new link. Nothing from a live communications center is available here."
    />
  );
}

export function DemoLinkInvalidPage() {
  return (
    <NeutralDemoPage
      title="This demo link is not valid"
      body="The link could not be verified. It was not opened, and no operational data was shown."
    />
  );
}

export function DemoLinkRevokedPage() {
  return (
    <NeutralDemoPage
      title="This demo link has been revoked"
      body="A sales administrator turned this link off. Ask them for a new one if you still need the walkthrough."
    />
  );
}
