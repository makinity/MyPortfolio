import { createClient } from '@supabase/supabase-js';

const parseAllowedOrigins = (value = "") => {
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const getCorsHeaders = (requestOrigin, env) => {
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const allowNullOrigin = env.ALLOW_NULL_ORIGIN === "true";

    // Normalize origin (remove trailing slash)
    const normalizedOrigin = requestOrigin ? requestOrigin.replace(/\/$/, "") : "";

    let allowedOrigin = "";
    if (normalizedOrigin === "null" && allowNullOrigin) {
        allowedOrigin = "null";
    } else {
        // Check if normalized origin is in the list (also normalized)
        const isAllowed = allowedOrigins.some(o => o.replace(/\/$/, "").toLowerCase() === normalizedOrigin.toLowerCase());
        if (isAllowed) {
            allowedOrigin = requestOrigin;
        }
    }

    return allowedOrigin
        ? {
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Vary": "Origin",
        }
        : {};
};

const getSupabaseClient = (env) => {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        return null;
    }
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
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

    return {
        ok: true,
        id: responseData?.id || "",
    };
};

const getEmailStatus = async (env, emailId) => {
    if (!emailId || !env.RESEND_API_KEY) {
        return "";
    }

    try {
        const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
            headers: {
                "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            },
        });

        if (!response.ok) {
            return "";
        }

        const responseData = await response.json();
        return typeof responseData?.last_event === "string" ? responseData.last_event : "";
    } catch {
        return "";
    }
};

const handleContactRequest = async (payload, env, corsHeaders) => {
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const email = typeof payload?.email === "string" ? payload.email.trim() : "";
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    const referralCode = typeof payload?.referralCode === "string" ? payload.referralCode.trim() : "";
    const safeName = name.replace(/[\r\n]+/g, " ").trim();
    const safeMessageHtml = escapeHtml(message).replace(/\n/g, "<br>");

    // Basic honeypot field to reject simple bots.
    if (referralCode) {
        console.log("contact_honeypot_triggered", {
            email,
            origin: corsHeaders["Access-Control-Allow-Origin"] || "",
        });
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
            tags: [
                { name: "source", value: "portfolio-contact" },
                { name: "recipient", value: "owner" },
            ],
        });
    } catch {
        return json(
            { error: "Failed to contact email service" },
            { status: 502, headers: corsHeaders }
        );
    }

    if (!emailResult.ok) {
        console.log("contact_email_failed", {
            email,
            error: emailResult.error,
        });
        return json(
            { error: emailResult.error },
            { status: emailResult.status, headers: corsHeaders }
        );
    }

    console.log("EMAIL_SENT_SUCCESS", { id: emailResult.id });

    // Save to Supabase
    const supabase = getSupabaseClient(env);
    if (supabase) {
        const { error: dbError } = await supabase.from('contact_messages').insert({
            name: safeName,
            email: email,
            subject: `Portfolio Contact: ${safeName}`,
            message: message
        });
        
        if (dbError) {
            console.error("SUPABASE_INSERT_ERROR:", dbError.message, dbError.details);
        } else {
            console.log("SUPABASE_INSERT_SUCCESS");
        }
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
        ...(payload?.isAdmin ? [{
            role: "system",
            content: "You are currently chatting with MakiDev (Marky Vencent), the owner of this portfolio. You are in his private admin dashboard. Acknowledge him as 'Boss', 'Maki', or 'Sir' and be extra helpful with dashboard tasks."
        }] : []),
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

const handlePortfolioDataRequest = async (env, corsHeaders) => {
    const supabase = getSupabaseClient(env);
    if (!supabase) {
        return json(
            { error: "Supabase client not configured" },
            { status: 500, headers: corsHeaders }
        );
    }

    try {
        const fetchActiveResume = async () => {
            try {
                const { data, error } = await supabase
                    .from('resumes')
                    .select('id, title, summary, file_url, file_name, updated_at, preview_image_url')
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error("RESUME_FETCH_ERROR:", error.message);
                    return null;
                }

                if (!data?.file_url) {
                    return null;
                }

                return data;
            } catch (error) {
                console.error("RESUME_FETCH_ERROR:", error?.message || String(error));
                return null;
            }
        };

        const [profile, projects, gallery, tech_stack, social_links, quick_facts, side_skills, specialty, resume] = await Promise.all([
            supabase.from('profile').select('*').limit(1).single(),
            supabase.from('projects').select('*').order('sort_order'),
            supabase.from('gallery').select('*').order('created_at', { ascending: false }),
            supabase.from('tech_stack').select('*').order('sort_order'),
            supabase.from('social_links').select('*').order('sort_order'),
            supabase.from('quick_facts').select('*').order('sort_order'),
            supabase.from('side_skills').select('*').order('sort_order'),
            supabase.from('specialty_banner').select('*').limit(1).single(),
            fetchActiveResume()
        ]);

        return json(
            {
                profile: profile.data,
                projects: projects.data,
                gallery: gallery.data,
                tech_stack: tech_stack.data,
                social_links: social_links.data,
                quick_facts: quick_facts.data,
                side_skills: side_skills.data,
                specialty: specialty.data ? {
                    ...specialty.data,
                    main_icon: specialty.data.icon_main,
                    small_icon: specialty.data.icon_header
                } : null,
                resume
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        return json(
            { error: "Failed to fetch portfolio data" },
            { status: 500, headers: corsHeaders }
        );
    }
};

const handleGoogleAuth = (env, corsHeaders) => {
    const scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';
    const redirectUri = `https://portfolio-chat.makidevportfolio.workers.dev/auth/google/callback`;
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    
    return Response.redirect(url, 302);
};

const handleGoogleCallback = async (url, env, corsHeaders) => {
    const code = url.searchParams.get('code');
    const redirectUri = `https://portfolio-chat.makidevportfolio.workers.dev/auth/google/callback`;

    if (!code) return json({ error: "Missing code" }, { status: 400, headers: corsHeaders });

    // Exchange code for tokens
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        })
    });

    const tokens = await res.json();
    if (tokens.error) return json(tokens, { status: 400, headers: corsHeaders });

    // Get user email
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const user = await userRes.json();

    // Save refresh token to Supabase
    const supabase = getSupabaseClient(env);
    if (!supabase) {
        console.error("SUPABASE_CLIENT_MISSING_IN_CALLBACK");
        return new Response("Database configuration missing", { status: 500 });
    }

    // Get the first profile ID
    const { data: profileData, error: profileFetchError } = await supabase.from('profile').select('id').limit(1).single();
    
    if (profileFetchError || !profileData) {
        console.error("PROFILE_FETCH_ERROR_IN_CALLBACK:", profileFetchError?.message);
        return new Response("Could not find your profile in database", { status: 500 });
    }

    console.log("UPDATING_PROFILE_WITH_GMAIL:", user.email);

    const { error: updateError } = await supabase
        .from('profile')
        .update({ 
            gmail_refresh_token: tokens.refresh_token,
            gmail_email: user.email,
            gmail_enabled: !!tokens.refresh_token 
        })
        .eq('id', profileData.id);

    if (updateError) {
        console.error("PROFILE_UPDATE_ERROR_IN_CALLBACK:", updateError.message);
        return new Response("Failed to save Gmail connection to database", { status: 500 });
    }

    console.log("GMAIL_CONNECTED_SUCCESSFULLY");

    // Redirect back to admin
    return Response.redirect(`https://makinity.github.io/MyPortfolio/admin/index.html?gmail=success`, 302);
};

const getGmailAccessToken = async (env, refreshToken) => {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    });
    const data = await res.json();
    return data.access_token;
};

const handleGmailList = async (env, corsHeaders) => {
    const supabase = getSupabaseClient(env);
    const { data: profile } = await supabase.from('profile').select('gmail_refresh_token').single();
    
    if (!profile?.gmail_refresh_token) return json({ error: "Gmail not connected" }, { status: 400, headers: corsHeaders });

    const accessToken = await getGmailAccessToken(env, profile.gmail_refresh_token);
    
    // Fetch last 50 messages related to portfolio
    const query = encodeURIComponent('subject:("Portfolio Contact" OR "New portfolio contact form submission")');
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const { messages } = await res.json();
    
    if (!messages) return json([], { headers: corsHeaders });

    const fullMessages = await Promise.all(messages.map(async (m) => {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const detail = await detailRes.json();
        
        const headers = detail.payload.headers;
        return {
            id: detail.id,
            threadId: detail.threadId,
            snippet: detail.snippet,
            from: headers.find(h => h.name === 'From')?.value,
            subject: headers.find(h => h.name === 'Subject')?.value,
            date: headers.find(h => h.name === 'Date')?.value,
            isGmail: true
        };
    }));

    return json(fullMessages, { headers: corsHeaders });
};

const handleGmailReply = async (payload, env, corsHeaders) => {
    const supabase = getSupabaseClient(env);
    const { data: profile } = await supabase.from('profile').select('gmail_refresh_token, gmail_email').single();
    
    if (!profile?.gmail_refresh_token) return json({ error: "Gmail not connected" }, { status: 400, headers: corsHeaders });

    const accessToken = await getGmailAccessToken(env, profile.gmail_refresh_token);
    
    const { to, subject, message, threadId } = payload;

    // Construct headers conditionally
    const headers = [
        `To: ${to}`,
        `Subject: Re: ${subject}`,
        `From: ${profile.gmail_email}`,
    ];

    if (threadId) {
        headers.push(`In-Reply-To: ${threadId}`);
        headers.push(`References: ${threadId}`);
    }

    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('');
    headers.push(message);

    const email = headers.join('\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            raw: encodedEmail, 
            ...(threadId ? { threadId } : {}) 
        })
    });

    const result = await res.json();
    return json(result, { headers: corsHeaders });
};

const handleResumeTailorRequest = async (payload, env, corsHeaders) => {
    const resumeText = typeof payload?.resumeText === "string" ? payload.resumeText.trim() : "";
    const jobDescription = typeof payload?.jobDescription === "string" ? payload.jobDescription.trim() : "";

    if (!resumeText || !jobDescription) {
        return json(
            { error: "Resume text and job description are required" },
            { status: 400, headers: corsHeaders }
        );
    }

    if (!env.GROQ_API_KEY) {
        return json(
            { error: "AI service is not configured" },
            { status: 500, headers: corsHeaders }
        );
    }

    const messages = [
        {
            role: "system",
            content: `You are an expert Career Coach and Resume Optimizer. Your goal is to provide a REFINED version of the user's resume that aligns honestly with the provided Job Description.
            
            Output Structure:
            1. Brief Analysis: A 1-2 sentence summary of the "match" between the user and the JD.
            2. REFINED RESUME: The complete, tailored version of the resume. 
               - Re-phrase existing bullet points to use JD keywords (ATS optimization).
               - Optimize the Professional Summary for impact.
               - Keep it extremely professional and ready to copy.
            
            Strict Guidelines:
            1. HONESTY: Do not invent experiences, roles, or skills. Only re-phrase and re-prioritize what is already there.
            2. DIRECTNESS: Do NOT explain the changes (e.g., do not say "I changed X to Y"). Just provide the refined text.
            3. FORMAT: Use clean Markdown.`
        },
        {
            role: "user",
            content: `ORIGINAL RESUME TEXT:\n${resumeText}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}\n\nPlease provide the refined version.`
        }
    ];

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 2000,
                messages,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || "AI request failed");
        }

        return json(
            { reply: data.choices[0].message.content },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        console.error("AI_TAILOR_ERROR:", error.message);
        return json(
            { error: error.message },
            { status: 500, headers: corsHeaders }
        );
    }
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const requestOrigin = request.headers.get("Origin") || "";
        const corsHeaders = getCorsHeaders(requestOrigin, env);

        if (request.method === "OPTIONS") {
            if (!Object.keys(corsHeaders).length) {
                console.error("CORS_REJECTED:", requestOrigin);
                return json(
                    { error: "Origin not allowed", origin: requestOrigin },
                    { status: 403 }
                );
            }

            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        // New Endpoints
        if (url.pathname === "/auth/google") return handleGoogleAuth(env, corsHeaders);
        if (url.pathname === "/auth/google/callback") return handleGoogleCallback(url, env, corsHeaders);
        if (url.pathname === "/gmail/list") return handleGmailList(env, corsHeaders);

        if (request.method === "POST" && url.pathname === "/gmail/reply") {
            const payload = await request.json();
            return handleGmailReply(payload, env, corsHeaders);
        }

        if (request.method === "POST" && url.pathname === "/ai/tailor-resume") {
            const payload = await request.json();
            return handleResumeTailorRequest(payload, env, corsHeaders);
        }

        if (!["/", "/chat", "/contact", "/portfolio", "/ai/tailor-resume", "/gmail/reply"].includes(url.pathname)) {
            return json(
                { error: "Not found" },
                { status: 404, headers: corsHeaders }
            );
        }

        if (request.method === "GET") {
            if (url.pathname === "/") {
                return json(
                    {
                        status: "ok",
                        service: "portfolio-worker",
                        message: "Worker is running."
                    },
                    { status: 200, headers: corsHeaders }
                );
            }
            
            if (url.pathname === "/portfolio") {
                return handlePortfolioDataRequest(env, corsHeaders);
            }
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
