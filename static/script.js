document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const subjectSelect = document.getElementById('subject-select');
    const explainBtn = document.getElementById('explain-btn');
    const summarizeBtn = document.getElementById('summarize-btn');
    const historyList = document.getElementById('history-list');

    let isGenerating = false;
    let abortController = null;
    let currentSessionId = Date.now().toString();
    let currentChat = [];
    let chatSessions = JSON.parse(localStorage.getItem('academic_ai_sessions') || '[]');

    // --- Voice Logic ---
    let recognition = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            voiceInputBtn.classList.add('listening');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            userInput.style.height = 'auto';
            userInput.style.height = userInput.scrollHeight + 'px';
            voiceInputBtn.classList.remove('listening');
            // Auto-send if context allows
            // sendBtn.click();
        };

        recognition.onerror = () => {
            voiceInputBtn.classList.remove('listening');
        };

        recognition.onend = () => {
            voiceInputBtn.classList.remove('listening');
        };
    } else {
        voiceInputBtn.style.display = 'none';
    }

    let currentUtterance = null;
    let activeSpeechBtn = null;

    // Ensure voices are loaded
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };

    function speakText(text, btn) {
        // If clicking the SAME button that is already playing, toggle it off
        if (window.speechSynthesis.speaking && activeSpeechBtn === btn) {
            window.speechSynthesis.cancel();
            btn.classList.remove('active');
            activeSpeechBtn = null;
            return;
        }

        // Stop any current speech
        window.speechSynthesis.cancel();
        if (activeSpeechBtn) activeSpeechBtn.classList.remove('active');

        const cleanText = text.replace(/<[^>]*>/g, '').replace(/\*\*|\*|```|`/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Find a professional voice
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Microsoft David')) || voices[0];
        
        utterance.onstart = () => {
            btn.classList.add('active');
            activeSpeechBtn = btn;
        };

        utterance.onend = () => {
            btn.classList.remove('active');
            if (activeSpeechBtn === btn) activeSpeechBtn = null;
        };

        utterance.onerror = (e) => {
            console.error('TTS Error:', e);
            btn.classList.remove('active');
            activeSpeechBtn = null;
        };

        window.speechSynthesis.speak(utterance);
    }

    // --- Core Logic ---
    function formatMessage(text) {
        if (!text) return "";
        let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/==(.*?)==/g, '<span class="highlight">$1</span>');
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        formatted = formatted.replace(/^\*\s(.*)/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
        formatted = formatted.replace(/<\/ul><ul>/g, '');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    function addMessageUI(text, role, animate = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        if (!animate) messageDiv.style.animation = 'none';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'ai') {
            const header = document.createElement('div');
            header.className = 'msg-header';
            header.innerHTML = '<span>Tutor</span>';
            
            const readBtn = document.createElement('button');
            readBtn.className = 'voice-read-btn';
            readBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
            
            const body = document.createElement('div');
            body.className = 'msg-body';
            body.innerHTML = formatMessage(text);

            readBtn.onclick = () => speakText(body.innerText, readBtn);
            
            header.appendChild(readBtn);
            contentDiv.appendChild(header);
            contentDiv.appendChild(body);
        } else {
            const body = document.createElement('div');
            body.className = 'msg-body';
            body.innerHTML = formatMessage(text);
            contentDiv.appendChild(body);
        }
        
        messageDiv.appendChild(contentDiv);
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return contentDiv.querySelector('.msg-body');
    }

    function saveSession() {
        const index = chatSessions.findIndex(s => s.id === currentSessionId);
        const sessionData = {
            id: currentSessionId,
            timestamp: Date.now(),
            subject: subjectSelect.value,
            title: currentChat.length > 0 ? (currentChat[0].role === 'user' ? currentChat[0].content.substring(0, 30) : 'Academic Session') : 'New Session',
            messages: currentChat
        };

        if (index > -1) {
            chatSessions[index] = sessionData;
        } else {
            chatSessions.unshift(sessionData);
        }
        localStorage.setItem('academic_ai_sessions', JSON.stringify(chatSessions));
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        chatSessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const textSpan = document.createElement('span');
            textSpan.innerText = session.title;
            textSpan.style.flex = "1";
            textSpan.onclick = () => loadSession(session.id);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-history-btn';
            deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteSession(session.id);
            };

            item.appendChild(textSpan);
            item.appendChild(deleteBtn);
            historyList.appendChild(item);
        });
    }

    function loadSession(id) {
        if (isGenerating) return;
        const session = chatSessions.find(s => s.id === id);
        if (session) {
            currentSessionId = id;
            currentChat = session.messages;
            subjectSelect.value = session.subject;
            chatContainer.innerHTML = '';
            currentChat.forEach(msg => addMessageUI(msg.content, msg.role, false));
        }
    }

    function deleteSession(id) {
        chatSessions = chatSessions.filter(s => s.id !== id);
        localStorage.setItem('academic_ai_sessions', JSON.stringify(chatSessions));
        if (currentSessionId === id) {
            window.location.reload();
        } else {
            renderHistory();
        }
    }

    async function askAI(question, action = null) {
        if (isGenerating || (!question.trim() && !action)) return;

        isGenerating = true;
        abortController = new AbortController();
        
        sendBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        userInput.value = '';
        userInput.style.height = 'auto';

        if (!action) {
            addMessageUI(question, 'user');
            currentChat.push({ role: 'user', content: question });
        }

        const aiMsgBody = addMessageUI('', 'ai');
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing';
        typingIndicator.innerText = 'Tutor is thinking...';
        aiMsgBody.parentNode.insertBefore(typingIndicator, aiMsgBody);

        try {
            const contextText = (action && currentChat.length > 0) ? currentChat[currentChat.length - 1].content : question;

            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: contextText,
                    subject: subjectSelect.value,
                    action: action
                }),
                signal: abortController.signal
            });

            if (!response.ok) throw new Error(`Server Error: ${response.status}`);

            typingIndicator.remove();
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
                
                const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 50;
                aiMsgBody.innerHTML = formatMessage(accumulatedText);
                
                if (isScrolledToBottom) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
            
            currentChat.push({ role: 'ai', content: accumulatedText });
            saveSession();

        } catch (error) {
            if (error.name === 'AbortError') {
                typingIndicator.innerHTML = '<em>Generation stopped by user.</em>';
                currentChat.push({ role: 'ai', content: aiMsgBody.innerText + " [Stopped]" });
                saveSession();
            } else {
                console.error('Error:', error);
                typingIndicator.innerText = 'Error: ' + error.message;
            }
        } finally {
            isGenerating = false;
            sendBtn.style.display = 'flex';
            stopBtn.style.display = 'none';
            abortController = null;
        }
    }

    sendBtn.onclick = () => askAI(userInput.value);
    stopBtn.onclick = () => { if (abortController) abortController.abort(); };
    
    voiceInputBtn.onclick = () => {
        if (voiceInputBtn.classList.contains('listening')) {
            recognition.stop();
        } else {
            recognition.start();
        }
    };

    userInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    };

    explainBtn.onclick = () => askAI('', 'explain_simpler');
    summarizeBtn.onclick = () => askAI('', 'summarize');

    userInput.oninput = () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    };

    // --- Modal Logic ---
    const upgradeModal = document.getElementById('subscription-modal');
    const openUpgradeBtn = document.getElementById('open-upgrade-modal');
    const closeUpgradeBtn = document.getElementById('close-modal');

    openUpgradeBtn.onclick = () => upgradeModal.classList.add('active');
    closeUpgradeBtn.onclick = () => upgradeModal.classList.remove('active');
    
    // Close on click outside
    upgradeModal.onclick = (e) => {
        if (e.target === upgradeModal) {
            upgradeModal.classList.remove('active');
        }
    };

    renderHistory();
});