const parseAllowedOrigins = (value = "") => {
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const getCorsHeaders = (requestOrigin, env) => {
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const allowNullOrigin = env.ALLOW_NULL_ORIGIN === "true";

    let allowedOrigin = "";
    if (requestOrigin === "null" && allowNullOrigin) {
        allowedOrigin = "null";
    } else if (allowedOrigins.includes(requestOrigin)) {
        allowedOrigin = requestOrigin;
    }

    return allowedOrigin
        ? {
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Vary": "Origin",
        }
        : {};
};

const json = (payload, init = {}) => {
    const headers = new Headers(init.headers || {});
    headers.set("Content-Type", "application/json");

    return new Response(JSON.stringify(payload), {
        ...init,
        headers,
    });
};

const normalizeHistory = (history) => {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .slice(-10)
        .map((entry) => ({
            role: entry?.role,
            content: typeof entry?.content === "string" ? entry.content.trim() : "",
        }))
        .filter((entry) => ["system", "user", "assistant"].includes(entry.role) && entry.content);
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const requestOrigin = request.headers.get("Origin") || "";
        const corsHeaders = getCorsHeaders(requestOrigin, env);

        if (request.method === "OPTIONS") {
            if (!Object.keys(corsHeaders).length) {
                return new Response(null, { status: 403 });
            }

            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        if (url.pathname !== "/chat") {
            return json(
                { error: "Not found" },
                { status: 404, headers: corsHeaders }
            );
        }

        if (request.method === "GET") {
            return json(
                {
                    status: "ok",
                    service: "portfolio-chat",
                    message: "MakiBot worker is running. Send a POST request to /chat with JSON { message, history }."
                },
                { status: 200, headers: corsHeaders }
            );
        }

        if (request.method !== "POST") {
            return json(
                { error: "Method not allowed" },
                {
                    status: 405,
                    headers: {
                        ...corsHeaders,
                        "Allow": "GET, POST, OPTIONS"
                    }
                }
            );
        }

        if (requestOrigin && !Object.keys(corsHeaders).length) {
            return json(
                { error: "Origin not allowed" },
                { status: 403, headers: corsHeaders }
            );
        }

        let payload;
        try {
            payload = await request.json();
        } catch {
            return json(
                { error: "Invalid JSON body" },
                { status: 400, headers: corsHeaders }
            );
        }

        const message = typeof payload?.message === "string" ? payload.message.trim() : "";
        if (!message) {
            return json(
                { error: "Message is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        if (message.length > 2000) {
            return json(
                { error: "Message is too long" },
                { status: 400, headers: corsHeaders }
            );
        }

        if (!env.GROQ_API_KEY) {
            return json(
                { error: "Groq API key is not configured" },
                { status: 500, headers: corsHeaders }
            );
        }

        const messages = [
            {
                role: "system",
                content: env.SYSTEM_PROMPT || "You are a helpful portfolio assistant."
            },
            ...normalizeHistory(payload?.history),
            {
                role: "user",
                content: message
            }
        ];

        let groqResponse;
        try {
            groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: env.GROQ_MODEL || "llama-3.1-8b-instant",
                    temperature: 0.4,
                    max_tokens: 400,
                    messages,
                }),
            });
        } catch {
            return json(
                { error: "Failed to contact Groq" },
                { status: 502, headers: corsHeaders }
            );
        }

        const responseText = await groqResponse.text();
        let responseData = {};

        try {
            responseData = responseText ? JSON.parse(responseText) : {};
        } catch {
            responseData = {};
        }

        if (!groqResponse.ok) {
            return json(
                {
                    error: responseData?.error?.message || "Groq request failed",
                },
                { status: groqResponse.status, headers: corsHeaders }
            );
        }

        const reply = responseData?.choices?.[0]?.message?.content?.trim();
        if (!reply) {
            return json(
                { error: "Empty response from Groq" },
                { status: 502, headers: corsHeaders }
            );
        }

        return json(
            { reply },
            { status: 200, headers: corsHeaders }
        );
    }
};
