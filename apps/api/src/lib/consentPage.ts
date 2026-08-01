/**
 * Owner-facing consent pages for camera-sharing links sent by SMS/email. Shared by the Ring and
 * Nest consent handlers so both render the same branded page instead of raw JSON.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function consentPage(title: string, body: string, actionsHtml = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; color: #111; }
    .brand { font-weight: 700; letter-spacing: 0.02em; margin-bottom: 1rem; }
    .card { max-width: 32rem; padding: 1.25rem; border: 1px solid #e5e7eb; border-radius: 8px; }
    .actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.25rem; }
    .actions form { margin: 0; }
    button { width: 100%; padding: 0.85rem 1rem; font-size: 1rem; font-weight: 600;
      border-radius: 8px; border: 1px solid transparent; cursor: pointer; }
    .allow { background: #0284c7; color: #fff; }
    .decline { background: #fff; color: #111; border-color: #d1d5db; }
    .stop { background: #b91c1c; color: #fff; }
    .fine { margin-top: 1rem; font-size: 0.8125rem; color: #4b5563; }
  </style>
</head>
<body>
  <div class="brand">Rapid Cortex</div>
  <div class="card"><p>${body}</p>${actionsHtml}</div>
</body>
</html>`;
}

/**
 * Consent actions are POST so an SMS app or carrier link preview cannot approve video sharing
 * by prefetching the URL.
 */
export function consentActionForm(args: {
  actionPath: string;
  label: string;
  variant: "allow" | "decline" | "stop";
}): string {
  return `<form method="post" action="${args.actionPath}"><button class="${args.variant}" type="submit">${escapeHtml(args.label)}</button></form>`;
}
