(function() {
    const CHATBOT_CONFIG = {
        apiUrl: 'https://portfolio-chat.makidevportfolio.workers.dev/chat',
        assistantName: 'MakiBot',
        ...(window.CHATBOT_CONFIG || {})
    };
    const getSiteBaseUrl = () => {
        if (!/^https?:$/i.test(window.location.protocol)) {
            return '';
        }

        const basePath = window.__SITE_BASE_PATH__ || '/';
        return new URL(basePath, window.location.origin).href;
    };
    const resolveKnowledgeUrl = () => {
        const siteBaseUrl = getSiteBaseUrl();
        return siteBaseUrl ? new URL('ai.txt', siteBaseUrl).href : '';
    };

    // --- Scroll Reveal Animation ---
    const sections = document.querySelectorAll('section');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15 });
    sections.forEach(section => observer.observe(section));

    // --- Mobile Drawer ---
    const body = document.body;
    const root = document.documentElement;
    const nav = document.querySelector('nav');
    const menuToggle = document.getElementById('menuToggle');
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    const drawerClose = document.getElementById('drawerClose');
    const chatbotPanel = document.getElementById('chatbotPanel');
    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotClose = document.getElementById('chatbotClose');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const chatbotForm = document.getElementById('chatbotForm');
    const chatbotInput = document.getElementById('chatbotInput');
    const chatbotSend = document.getElementById('chatbotSend');
    const anchorGap = 0;
    let chatbotHistory = [];
    let isChatRequestPending = false;

    const setDrawerState = (isOpen) => {
        body.classList.toggle('drawer-open', isOpen);
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
        }
        if (mobileDrawer) {
            mobileDrawer.setAttribute('aria-hidden', String(!isOpen));
        }
        if (drawerBackdrop) {
            drawerBackdrop.setAttribute('aria-hidden', String(!isOpen));
        }
    };

    const closeDrawer = () => setDrawerState(false);
    const syncNavOffset = () => {
        const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height) : 0;
        root.style.setProperty('--nav-offset', `${navHeight}px`);
        return navHeight;
    };
    const resolveScrollTarget = (targetEl) => {
        if (!targetEl) return null;
        if (targetEl.tagName !== 'SECTION') return targetEl;

        const directHeading = Array.from(targetEl.children).find((child) => /^H[1-6]$/.test(child.tagName));
        return directHeading || targetEl.firstElementChild || targetEl;
    };
    const scrollToSection = (targetEl, behavior = 'smooth') => {
        const resolvedTarget = resolveScrollTarget(targetEl);
        if (!resolvedTarget) return;
        const navHeight = syncNavOffset();
        const targetTop = resolvedTarget.getBoundingClientRect().top + window.scrollY - navHeight - anchorGap;
        window.scrollTo({
            top: Math.max(targetTop, 0),
            behavior
        });
    };

    syncNavOffset();

    const scrollChatToBottom = () => {
        if (!chatbotMessages) return;
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    };
    const CHAT_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|((?:https?:\/\/|www\.)[^\s<]+)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
    const splitTrailingLinkPunctuation = (value) => {
        let trailing = '';
        let cleanValue = value;

        while (/[),.!?;:]/.test(cleanValue.slice(-1))) {
            trailing = cleanValue.slice(-1) + trailing;
            cleanValue = cleanValue.slice(0, -1);
        }

        return { cleanValue, trailing };
    };
    const createChatLink = (href, label) => {
        const linkEl = document.createElement('a');
        linkEl.href = href;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.textContent = label;
        return linkEl;
    };
    const renderChatBubbleContent = (bubbleEl, text) => {
        if (!bubbleEl) return;

        bubbleEl.textContent = '';
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        text.replace(CHAT_LINK_PATTERN, (match, markdownLabel, markdownUrl, rawUrl, rawEmail, offset) => {
            if (offset > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
            }

            if (markdownLabel && markdownUrl) {
                fragment.appendChild(createChatLink(markdownUrl, markdownLabel));
            } else {
                const rawValue = rawUrl || rawEmail || '';
                const { cleanValue, trailing } = splitTrailingLinkPunctuation(rawValue);

                if (cleanValue) {
                    const href = rawEmail
                        ? `mailto:${cleanValue}`
                        : (cleanValue.startsWith('www.') ? `https://${cleanValue}` : cleanValue);
                    fragment.appendChild(createChatLink(href, cleanValue));
                }

                if (trailing) {
                    fragment.appendChild(document.createTextNode(trailing));
                }
            }

            lastIndex = offset + match.length;
            return match;
        });

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        bubbleEl.appendChild(fragment);
    };
    const appendChatMessage = (role, text, isPending = false) => {
        if (!chatbotMessages) return null;
        const messageEl = document.createElement('div');
        messageEl.className = `chatbot-message ${role}${isPending ? ' pending' : ''}`;

        const bubbleEl = document.createElement('div');
        bubbleEl.className = 'chatbot-bubble';
        renderChatBubbleContent(bubbleEl, text);

        messageEl.appendChild(bubbleEl);
        chatbotMessages.appendChild(messageEl);
        scrollChatToBottom();
        return messageEl;
    };
    const updateChatMessage = (messageEl, text, isPending = false) => {
        if (!messageEl) return;
        messageEl.classList.toggle('pending', isPending);
        const bubbleEl = messageEl.querySelector('.chatbot-bubble');
        if (bubbleEl) {
            renderChatBubbleContent(bubbleEl, text);
        }
        scrollChatToBottom();
    };
    const setChatControlsDisabled = (isDisabled) => {
        isChatRequestPending = isDisabled;
        if (chatbotInput) {
            chatbotInput.disabled = isDisabled;
        }
        if (chatbotSend) {
            chatbotSend.disabled = isDisabled;
        }
    };
    const setChatbotOpen = (isOpen) => {
        if (!chatbotPanel || !chatbotToggle) return;
        chatbotPanel.classList.toggle('open', isOpen);
        chatbotPanel.setAttribute('aria-hidden', String(!isOpen));
        chatbotToggle.setAttribute('aria-expanded', String(isOpen));
        chatbotToggle.setAttribute('aria-label', isOpen ? 'Close chatbot' : 'Open chatbot');
        if (isOpen && chatbotInput) {
            window.setTimeout(() => chatbotInput.focus(), 120);
        }
    };
    const isChatbotConfigured = () => Boolean(CHATBOT_CONFIG.apiUrl && /^https?:\/\//.test(CHATBOT_CONFIG.apiUrl));
    const getChatbotSetupReply = () => {
        return 'Chatbot UI is ready, but the Groq backend URL is not configured yet. Deploy the Cloudflare Worker, then set CHATBOT_CONFIG.apiUrl in index.html to your Worker /chat URL.';
    };
    const describeChatbotFetchError = (error) => {
        const apiUrl = CHATBOT_CONFIG.apiUrl || '';
        const isLocalWorkerUrl = /^http:\/\/127\.0\.0\.1:8787\/chat$/i.test(apiUrl) || /^http:\/\/localhost:8787\/chat$/i.test(apiUrl);

        if (error instanceof TypeError && isLocalWorkerUrl) {
            return 'Local worker is unreachable at http://127.0.0.1:8787/chat. Start it from /worker with `npx wrangler dev`, or override CHATBOT_CONFIG.apiUrl to your deployed /chat URL.';
        }

        if (error instanceof Error && error.message) {
            return error.message;
        }

        return 'Something went wrong while contacting the chatbot.';
    };
    const sendChatMessage = async (message) => {
        if (!isChatbotConfigured()) {
            return getChatbotSetupReply();
        }

        const response = await fetch(CHATBOT_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                history: chatbotHistory.slice(-10),
                knowledgeUrl: resolveKnowledgeUrl()
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Unable to reach the chatbot service right now.');
        }

        return typeof data.reply === 'string' && data.reply.trim()
            ? data.reply.trim()
            : 'I could not generate a reply just now.';
    };

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            setDrawerState(!body.classList.contains('drawer-open'));
        });
    }

    if (drawerBackdrop) {
        drawerBackdrop.addEventListener('click', closeDrawer);
    }

    if (drawerClose) {
        drawerClose.addEventListener('click', closeDrawer);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && body.classList.contains('drawer-open')) {
            closeDrawer();
        }
        if (event.key === 'Escape' && chatbotPanel && chatbotPanel.classList.contains('open')) {
            setChatbotOpen(false);
        }
    });

    window.addEventListener('resize', () => {
        syncNavOffset();
        if (window.innerWidth > 768 && body.classList.contains('drawer-open')) {
            closeDrawer();
        }
    });

    if (chatbotToggle) {
        chatbotToggle.addEventListener('click', () => {
            setChatbotOpen(!(chatbotPanel && chatbotPanel.classList.contains('open')));
        });
    }

    if (chatbotClose) {
        chatbotClose.addEventListener('click', () => {
            setChatbotOpen(false);
        });
    }

    if (chatbotInput) {
        chatbotInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (chatbotForm) {
                    chatbotForm.requestSubmit();
                }
            }
        });
    }

    if (chatbotForm) {
        chatbotForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!chatbotInput || isChatRequestPending) return;

            const message = chatbotInput.value.trim();
            if (!message) return;

            appendChatMessage('user', message);
            chatbotHistory.push({ role: 'user', content: message });
            chatbotInput.value = '';
            setChatControlsDisabled(true);

            const pendingMessage = appendChatMessage('assistant', `${CHATBOT_CONFIG.assistantName} is thinking...`, true);

            try {
                const reply = await sendChatMessage(message);
                updateChatMessage(pendingMessage, reply);
                chatbotHistory.push({ role: 'assistant', content: reply });
            } catch (error) {
                updateChatMessage(pendingMessage, describeChatbotFetchError(error));
            } finally {
                setChatControlsDisabled(false);
                if (chatbotInput) {
                    chatbotInput.focus();
                }
            }
        });
    }

    // --- Back to Top Button ---
    const backToTopBtn = document.getElementById('backToTop');
    window.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('show', window.scrollY > 400);
    });
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- Smooth Scroll for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === "#" || href === "") return;
            const targetEl = document.querySelector(href);
            if (targetEl) {
                e.preventDefault();
                closeDrawer();
                if (window.location.hash !== href) {
                    history.pushState(null, '', href);
                }
                scrollToSection(targetEl);
            }
        });
    });

    window.addEventListener('hashchange', () => {
        if (!window.location.hash) return;
        const hashTarget = document.querySelector(window.location.hash);
        if (hashTarget) {
            scrollToSection(hashTarget);
        }
    });

    window.addEventListener('load', () => {
        syncNavOffset();
        if (!window.location.hash) return;
        const hashTarget = document.querySelector(window.location.hash);
        if (hashTarget) {
            window.requestAnimationFrame(() => scrollToSection(hashTarget, 'auto'));
        }
    });

    // --- Build Orbiting Tech Stack ---
    const techItems = [
        { name: 'HTML5', icon: 'fab fa-html5' },
        { name: 'CSS3', icon: 'fab fa-css3-alt' },
        { name: 'JavaScript', icon: 'fab fa-js' },
        { name: 'Java', icon: 'fab fa-java' },
        { name: 'C#', icon: 'fab fa-microsoft' },
        { name: 'PHP', icon: 'fab fa-php' },
        { name: 'Laravel', icon: 'fab fa-laravel' },
        { name: '.NET', icon: 'fab fa-microsoft' },
        { name: 'MySQL', icon: 'fas fa-database' },
        { name: 'Supabase', icon: 'fas fa-database' },
    ];

    const orbitContainer = document.querySelector('.orbit-container');
    if (orbitContainer) {
        techItems.forEach((tech, index) => {
            const orbitItem = document.createElement('div');
            orbitItem.className = 'orbit-item';
            orbitItem.style.animationDelay = `-${(index * 20 / techItems.length).toFixed(1)}s`;
            
            orbitItem.innerHTML = `
                <div class="tech-badge" style="animation-duration: 20s; animation-delay: -${(index * 20 / techItems.length).toFixed(1)}s;">
                    <i class="${tech.icon}"></i>
                    <span>${tech.name}</span>
                </div>
            `;
            orbitContainer.appendChild(orbitItem);
        });
    }

    // --- Clone Projects for Seamless Infinite Scroll ---
    const projectSlider = document.getElementById('projectSlider');
    if (projectSlider) {
        const cards = Array.from(projectSlider.children);
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            projectSlider.appendChild(clone);
        });
    }
    
    // --- Clone Gallery for Seamless Infinite Scroll ---
    const gallerySlider = document.getElementById('gallerySlider');
    if (gallerySlider) {
        const cards = Array.from(gallerySlider.children);
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            gallerySlider.appendChild(clone);
        });
    }
    
})();
