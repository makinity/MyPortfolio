# Portfolio Chat Worker

This Cloudflare Worker powers the MakiBot chat widget used by the GitHub Pages site.

GitHub Pages only deploys the static frontend. The chat backend must be deployed to Cloudflare separately.

The worker can also read site knowledge from `/ai.txt` on the same origin as the portfolio page. Edit that file to update the chatbot's factual context without changing worker code.

## Local development

1. Install Node.js.
2. In `worker/`, copy `.dev.vars.example` to `.dev.vars`.
3. Put your Groq key in `.dev.vars` as `GROQ_API_KEY=...`.
4. Run `npx wrangler dev`.
5. If you want the page to use the local worker, override `window.CHATBOT_CONFIG.apiUrl` to `http://127.0.0.1:8787/chat`.
6. Serve the portfolio over HTTP if you want local `ai.txt` loading. A `file://` page cannot give the worker a fetchable knowledge URL.

## Deploy to Cloudflare

1. Install Node.js.
2. From `worker/`, authenticate if needed with `npx wrangler login`.
3. Set the production secret with `npx wrangler secret put GROQ_API_KEY`.
4. Deploy with `npx wrangler deploy`.

## Notes

- Use a Groq API key here, not an OpenAI API key.
- Do not commit `.dev.vars`.
- If a real key was ever committed or pasted into a public repo, rotate it.
- Keep `ai.txt` concise and factual. The worker trims it before sending it upstream.
