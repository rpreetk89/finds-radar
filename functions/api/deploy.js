// Cloudflare Pages Function — POST /api/deploy
// Proxies a request to trigger the production Cloudflare Pages Deploy Hook.
// The real hook URL is a secret set in the Cloudflare Pages project's environment
// variables (Production scope) and is never sent to the browser.

export async function onRequestPost(context) {
  const hookUrl = context.env.CF_DEPLOY_HOOK_URL;

  if (!hookUrl) {
    return new Response(
      JSON.stringify({ok: false, error: 'CF_DEPLOY_HOOK_URL is not configured on this Pages project.'}),
      {status: 500, headers: {'content-type': 'application/json'}},
    );
  }

  try {
    const res = await fetch(hookUrl, {method: 'POST'});
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return new Response(
        JSON.stringify({ok: false, error: `Deploy hook responded ${res.status}: ${text.slice(0, 200)}`}),
        {status: 502, headers: {'content-type': 'application/json'}},
      );
    }
    return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'content-type': 'application/json'}});
  } catch (err) {
    return new Response(
      JSON.stringify({ok: false, error: err?.message || 'Unknown error calling deploy hook'}),
      {status: 502, headers: {'content-type': 'application/json'}},
    );
  }
}
