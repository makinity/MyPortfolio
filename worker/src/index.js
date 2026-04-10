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

const resolveKnowledgeUrl = (requestOrigin, payload) => {
    const rawKnowledgeUrl = typeof payload?.knowledgeUrl === "string" ? payload.knowledgeUrl.trim() : "";
    if (!rawKnowledgeUrl || !requestOrigin) {
        return "";
    }

    try {
        const knowledgeUrl = new URL(rawKnowledgeUrl);
        if (!["http:", "https:"].includes(knowledgeUrl.protocol)) {
            return "";
        }

        if (knowledgeUrl.origin !== requestOrigin) {
            return "";
        }

        return knowledgeUrl.toString();
    } catch {
        return "";
    }
};

const loadKnowledge = async (knowledgeUrl) => {
    if (!knowledgeUrl) {
        return "";
    }

    try {
        const response = await fetch(knowledgeUrl, {
            headers: {
                "Accept": "text/plain",
            },
        });

        if (!response.ok) {
            return "";
        }

        const text = (await response.text()).trim();
        if (!text) {
            return "";
        }

        return text.slice(0, 12000);
    } catch {
        return "";
    }
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const escapeHtml = (value) => {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const sendContactEmail = async (env, payload) => {
    if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL || !env.CONTACT_FROM_EMAIL) {
        return {
            ok: false,
            status: 500,
            error: "Contact email service is not configured",
        };
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData = {};

    try {
        responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
        responseData = {};
    }

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            error: responseData?.message || responseData?.error?.message || "Failed to send email",
        };
    }

    return { ok: true };
};

const handleContactRequest = async (payload, env, corsHeaders) => {
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const email = typeof payload?.email === "string" ? payload.email.trim() : "";
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    const website = typeof payload?.website === "string" ? payload.website.trim() : "";
    const safeName = name.replace(/[\r\n]+/g, " ").trim();
    const safeMessageHtml = escapeHtml(message).replace(/\n/g, "<br>");

    // Basic honeypot field to reject simple bots.
    if (website) {
        return json(
            { message: "Message sent successfully." },
            { status: 200, headers: corsHeaders }
        );
    }

    if (!name || !email || !message) {
        return json(
            { error: "Name, email, and message are required" },
            { status: 400, headers: corsHeaders }
        );
    }

    if (!isValidEmail(email)) {
        return json(
            { error: "Please provide a valid email address" },
            { status: 400, headers: corsHeaders }
        );
    }

    if (name.length > 120 || email.length > 254 || message.length > 5000) {
        return json(
            { error: "Contact form input is too long" },
            { status: 400, headers: corsHeaders }
        );
    }

    let emailResult;
    try {
        emailResult = await sendContactEmail(env, {
            from: env.CONTACT_FROM_EMAIL,
            to: [env.CONTACT_TO_EMAIL],
            reply_to: email,
            subject: `Portfolio Contact: ${safeName}`,
            text: `New portfolio contact form submission\n\nName: ${safeName}\nEmail: ${email}\n\nMessage:\n${message}`,
            html: `<div><p><strong>New portfolio contact form submission</strong></p><p><strong>Name:</strong> ${escapeHtml(safeName)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Message:</strong></p><p>${safeMessageHtml}</p></div>`,
            headers: {
                "Reply-To": email,
            },
        });
    } catch {
        return json(
            { error: "Failed to contact email service" },
            { status: 502, headers: corsHeaders }
        );
    }

    if (!emailResult.ok) {
        return json(
            { error: emailResult.error },
            { status: emailResult.status, headers: corsHeaders }
        );
    }

    return json(
        { message: "Message sent. I will get back to you soon." },
        { status: 200, headers: corsHeaders }
    );
};

const handleChatRequest = async (payload, requestOrigin, env, corsHeaders) => {
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

    const knowledgeUrl = resolveKnowledgeUrl(requestOrigin, payload);
    const knowledge = await loadKnowledge(knowledgeUrl);

    const messages = [
        {
            role: "system",
            content: env.SYSTEM_PROMPT || "You are a helpful portfolio assistant."
        },
        ...(knowledge
            ? [{
                role: "system",
                content: `Use the following portfolio knowledge when answering. If the file conflicts with earlier chat context, prefer the file.\n\n${knowledge}`,
            }]
            : []),
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

        if (!["/chat", "/contact"].includes(url.pathname)) {
            return json(
                { error: "Not found" },
                { status: 404, headers: corsHeaders }
            );
        }

        if (request.method === "GET") {
            return json(
                {
                    status: "ok",
                    service: "portfolio-worker",
                    message: "Worker is running. Send POST requests to /chat or /contact."
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

        if (url.pathname === "/contact") {
            return handleContactRequest(payload, env, corsHeaders);
        }

        return handleChatRequest(payload, requestOrigin, env, corsHeaders);
    }
};
