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
    const contactForm = document.getElementById('contactForm');
    const contactSubmit = document.getElementById('contactSubmit');
    const contactFormStatus = document.getElementById('contactFormStatus');
    const anchorGap = 0;
    let chatbotHistory = [];
    let isChatRequestPending = false;
    let isContactRequestPending = false;

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
    const setContactFormStatus = (message, state = '') => {
        if (!contactFormStatus) return;
        contactFormStatus.textContent = message;
        contactFormStatus.classList.remove('is-success', 'is-error');
        if (state) {
            contactFormStatus.classList.add(state);
        }
    };
    const setContactFormDisabled = (isDisabled) => {
        isContactRequestPending = isDisabled;
        if (!contactForm) return;

        Array.from(contactForm.elements).forEach((element) => {
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLButtonElement) {
                element.disabled = isDisabled;
            }
        });

        if (contactSubmit) {
            contactSubmit.classList.toggle('is-loading', isDisabled);
        }
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
    const sendContactMessage = async (formData) => {
        const accessKey = String(formData.get('access_key') || '').trim();
        if (!accessKey || accessKey === 'YOUR_WEB3FORMS_ACCESS_KEY') {
            throw new Error('Set your Web3Forms access key in the hidden access_key field first.');
        }

        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(Object.fromEntries(formData))
        });

        const data = await response.json().catch(() => ({}));
        const responseMessage =
            (typeof data.message === 'string' && data.message.trim())
            || (typeof data?.body?.message === 'string' && data.body.message.trim())
            || '';

        if (!response.ok || data.success === false) {
            throw new Error(responseMessage || 'Unable to send your message right now.');
        }

        return responseMessage || 'Message sent successfully.';
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

    if (contactForm) {
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (isContactRequestPending) return;

            const formData = new FormData(contactForm);
            const name = String(formData.get('name') || '').trim();
            const email = String(formData.get('email') || '').trim();
            const message = String(formData.get('message') || '').trim();

            if (!name || !email || !message) {
                setContactFormStatus('Please complete all fields before sending.', 'is-error');
                return;
            }

            setContactFormStatus('');
            setContactFormDisabled(true);

            try {
                const result = await sendContactMessage(formData);
                contactForm.reset();
                setContactFormStatus(result, 'is-success');
            } catch (error) {
                setContactFormStatus(
                    error instanceof Error ? error.message : 'Unable to send your message right now.',
                    'is-error'
                );
            } finally {
                setContactFormDisabled(false);
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

    // --- Dynamic Portfolio Fetching ---
    const fetchAndRenderPortfolio = async () => {
        try {
            const apiUrl = getSiteBaseUrl() 
                ? new URL('portfolio', getSiteBaseUrl()).href 
                : 'https://portfolio-chat.makidevportfolio.workers.dev/portfolio';
                
            // If running locally or from file system, point to local worker
            const isLocal = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.protocol === 'file:';
                            
            const finalUrl = isLocal ? 'http://127.0.0.1:8787/portfolio' : apiUrl;

            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error('Failed to fetch data');
            
            const data = await response.json();
            
            // 1. Profile Data
            if (data.profile) {
                // Update Name Tags in Navbar/Drawer
                const nameTags = document.querySelectorAll('.name-tag');
                if (nameTags.length > 0) {
                    // Get the first two words of the full name for the nav bar (e.g., "Marky Vencent")
                    const shortName = data.profile.full_name.split(' ').slice(0, 2).join(' ');
                    nameTags.forEach(tag => tag.textContent = shortName);
                }

                const subhead = document.getElementById('heroSubhead');
                if (subhead) subhead.innerHTML = `${data.profile.full_name} &mdash; ${data.profile.role}`;
                
                const location = document.getElementById('heroLocation');
                if (location) location.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${data.profile.location}`;
                
                const aboutText = document.getElementById('aboutText');
                if (aboutText) aboutText.textContent = data.profile.about_text;
                
                // Advanced About Me fields (Optional, depending if they exist in DB)
                if (data.profile.about_text_secondary) {
                    const aboutTextSecondary = document.getElementById('aboutTextSecondary');
                    if (aboutTextSecondary) aboutTextSecondary.textContent = data.profile.about_text_secondary;
                }
                
                if (data.specialty) {
                    const specialtyBanner = document.getElementById('specialtyBanner');
                    if (specialtyBanner) {
                        const mainIcon = document.getElementById('specialtyMainIcon');
                        if (mainIcon) mainIcon.className = data.specialty.main_icon;
                        
                        const title = document.getElementById('specialtyTitle');
                        if (title) title.innerHTML = `<i id="specialtySmallIcon" class="${data.specialty.small_icon}" style="margin-right: 0.5rem;"></i>${data.specialty.title}`;
                        
                        const desc = document.getElementById('specialtyDesc');
                        if (desc) desc.textContent = data.specialty.description;
                    }
                }
                
                if (data.quick_facts && Array.isArray(data.quick_facts)) {
                    const quickFactsList = document.getElementById('quickFactsList');
                    if (quickFactsList) {
                        quickFactsList.innerHTML = data.quick_facts.map(fact => 
                            `<li><i class="${fact.icon}"></i> ${fact.text}</li>`
                        ).join('');
                    }
                }
                
                if (data.side_skills && Array.isArray(data.side_skills)) {
                    const sideSkillsList = document.getElementById('sideSkillsList');
                    if (sideSkillsList) {
                        sideSkillsList.innerHTML = data.side_skills.map(skill => 
                            `<li><i class="${skill.icon}"></i> ${skill.text}</li>`
                        ).join('');
                    }
                }
                
                // Update Hero Code Card
                const codeCard = document.getElementById('heroCodeCard');
                if (codeCard && data.tech_stack) {
                    const firstName = data.profile.full_name.split(' ')[0];
                    let stackRows = [];
                    const stackNames = data.tech_stack.map(t => `"${t.name}"`);
                    for (let i = 0; i < stackNames.length; i += 3) {
                        stackRows.push(stackNames.slice(i, i + 3).join(', '));
                    }
                    const stackStr = stackRows.join(',\n                    ');
                    
                    codeCard.innerHTML = `const dev = {\n            name: "${firstName}",\n            stack: [${stackStr}],\n            apis: ["Stripe","PayPal",\n                    "Google Maps",\n                    "Twilio","SendGrid"],\n            deployments: ["Hostinger","Vercel",\n                        "Netlify", "Railway"],\n            sideSkills: ["Data Entry",\n                        "PowerPoint",\n                        "Canva Design"]\n            };`;
                }
            }
            
            // 2. Social Links
            const socialContainer = document.getElementById('socialLinksContainer');
            if (socialContainer && data.social_links) {
                socialContainer.innerHTML = '';
                data.social_links.forEach(link => {
                    socialContainer.innerHTML += `<a href="${link.url}" target="_blank"><i class="${link.icon_class}"></i></a>`;
                });
            }
            
            // 3. Tech Stack
            const orbitContainer = document.querySelector('.orbit-container');
            if (orbitContainer && data.tech_stack) {
                const existingItems = orbitContainer.querySelectorAll('.orbit-item');
                existingItems.forEach(item => item.remove());
                
                data.tech_stack.forEach((tech, index) => {
                    const orbitItem = document.createElement('div');
                    orbitItem.className = 'orbit-item';
                    orbitItem.style.animationDelay = `-${(index * 20 / data.tech_stack.length).toFixed(1)}s`;
                    
                    orbitItem.innerHTML = `
                        <div class="tech-badge" style="animation-duration: 20s; animation-delay: -${(index * 20 / data.tech_stack.length).toFixed(1)}s;">
                            <i class="${tech.icon_url}"></i>
                            <span>${tech.name}</span>
                        </div>
                    `;
                    orbitContainer.appendChild(orbitItem);
                });
            }
            
            // 4. Projects
            const projectSlider = document.getElementById('projectSlider');
            if (projectSlider && data.projects) {
                projectSlider.innerHTML = '';
                data.projects.forEach(project => {
                    const tagsHtml = project.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
                    projectSlider.innerHTML += `
                        <div class="project-card">
                            <div class="project-image has-image">
                                <img src="${project.image_url}" alt="${project.title}" loading="lazy" decoding="async">
                            </div>
                            <h3>${project.title}</h3>
                            <p>${project.description}</p>
                            <div class="project-tags">${tagsHtml}</div>
                        </div>
                    `;
                });
                
                const cards = Array.from(projectSlider.children);
                cards.forEach(card => projectSlider.appendChild(card.cloneNode(true)));
            }
            
            // 5. Gallery
            const gallerySlider = document.getElementById('gallerySlider');
            if (gallerySlider && data.gallery) {
                gallerySlider.innerHTML = '';
                data.gallery.forEach(item => {
                    gallerySlider.innerHTML += `
                        <figure class="gallery-card">
                            <div class="gallery-image has-image">
                                <img src="${item.image_url}" alt="Gallery Image" loading="lazy" decoding="async">
                            </div>
                            <figcaption class="gallery-caption">${item.caption}</figcaption>
                        </figure>
                    `;
                });
                
                const cards = Array.from(gallerySlider.children);
                cards.forEach(card => gallerySlider.appendChild(card.cloneNode(true)));
            }
            
        } catch (error) {
            console.error('Error fetching portfolio data:', error);
        }
    };

    fetchAndRenderPortfolio();
})();
