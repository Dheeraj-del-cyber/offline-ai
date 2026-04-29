document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const explainBtn = document.getElementById('explain-btn');
    const summarizeBtn = document.getElementById('summarize-btn');
    const historyList = document.getElementById('history-list');
    const toast = document.getElementById('toast');
    const imageUpload = document.getElementById('image-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const previewContainer = document.getElementById('preview-container');
    const docUpload = document.getElementById('doc-upload');
    const docBtn = document.getElementById('doc-btn');

    let selectedImages = [];
    let selectedDocs = [];

    function showToast(message) {
        toast.innerText = message;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    let isGenerating = false;
    let abortController = null;
    let currentSessionId = Date.now().toString();
    let currentChat = [];
    let chatSessions = JSON.parse(localStorage.getItem('astra_ai_sessions') || '[]');

    // --- Voice Logic ---
    let recognition = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            voiceInputBtn.classList.add('listening');
            document.querySelector('.input-wrapper').classList.add('recording-active');
            userInput.placeholder = "Listening... speak now";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            userInput.style.height = 'auto';
            userInput.style.height = userInput.scrollHeight + 'px';
            voiceInputBtn.classList.remove('listening');
        };

        recognition.onerror = () => {
            voiceInputBtn.classList.remove('listening');
        };

        recognition.onend = () => {
            voiceInputBtn.classList.remove('listening');
            document.querySelector('.input-wrapper').classList.remove('recording-active');
            userInput.placeholder = "Type your question here...";
        };
    } else {
        voiceInputBtn.style.display = 'none';
    }

    let currentUtterance = null;
    let activeSpeechBtn = null;

    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };

    function speakText(text, btn) {
        if (window.speechSynthesis.speaking && activeSpeechBtn === btn) {
            window.speechSynthesis.cancel();
            btn.classList.remove('active');
            activeSpeechBtn = null;
            return;
        }

        window.speechSynthesis.cancel();
        if (activeSpeechBtn) activeSpeechBtn.classList.remove('active');

        const cleanText = text.replace(/<[^>]*>/g, '').replace(/\*\*|\*|```|`/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
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

    function formatMessage(text) {
        if (!text) return "";
        let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        formatted = formatted.replace(/```(\w*)\s*([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        

        
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/==(.*?)==/g, '<span class="highlight">$1</span>');
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
        


        formatted = formatted.replace(/<pre><code class="language-(.*?)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
            const isPython = lang.toLowerCase() === 'python' || code.includes('import ') || code.includes('print(');
            const cleanCode = code.replace(/^python\s*\n/, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            return `
                <div class="code-block-container">
                    ${isPython ? `<button class="run-code-btn" onclick="runCode(this, \`${cleanCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">Run Code</button>` : ''}
                    <pre><code class="language-${lang}">${code}</code></pre>
                    <div class="code-output"></div>
                </div>
            `;
        });

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
            header.innerHTML = '<span>Astra AI</span>';
            const readBtn = document.createElement('button');
            readBtn.className = 'voice-read-btn';
            readBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
            
            const body = document.createElement('div');
            body.className = 'msg-body';
            body.innerHTML = formatMessage(text);

            const feedbackActions = document.createElement('div');
            feedbackActions.className = 'feedback-actions';
            const likeBtn = document.createElement('button');
            likeBtn.className = 'feedback-btn';
            likeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
            const dislikeBtn = document.createElement('button');
            dislikeBtn.className = 'feedback-btn';
            dislikeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>';

            const handleFeedback = (type) => {
                showToast("Thank you for your feedback!");
                likeBtn.classList.toggle('active', type === 'like');
                dislikeBtn.classList.toggle('active', type === 'dislike');
            };

            likeBtn.onclick = () => handleFeedback('like');
            dislikeBtn.onclick = () => handleFeedback('dislike');
            feedbackActions.appendChild(likeBtn);
            feedbackActions.appendChild(dislikeBtn);
            readBtn.onclick = () => speakText(body.innerText, readBtn);
            
            header.appendChild(readBtn);
            contentDiv.appendChild(header);
            contentDiv.appendChild(body);
            contentDiv.appendChild(feedbackActions);
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
            title: currentChat.length > 0 ? (currentChat[0].role === 'user' ? currentChat[0].content.substring(0, 30) : 'Astra Session') : 'New Session',
            messages: currentChat
        };
        if (index > -1) { chatSessions[index] = sessionData; } else { chatSessions.unshift(sessionData); }
        localStorage.setItem('astra_ai_sessions', JSON.stringify(chatSessions));
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
            deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSession(session.id); };
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
            chatContainer.innerHTML = '';
            currentChat.forEach(msg => addMessageUI(msg.content, msg.role, false));
        }
    }

    function deleteSession(id) {
        chatSessions = chatSessions.filter(s => s.id !== id);
        localStorage.setItem('astra_ai_sessions', JSON.stringify(chatSessions));
        if (currentSessionId === id) { window.location.reload(); } else { renderHistory(); }
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
            currentChat.push({ role: 'user', content: question, images: [...selectedImages] });
        }

        const aiMsgBody = addMessageUI('', 'ai');
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing';
        typingIndicator.innerText = 'Astra is thinking...';
        aiMsgBody.parentNode.insertBefore(typingIndicator, aiMsgBody);

        try {
            const contextText = (action && currentChat.length > 0) ? currentChat[currentChat.length - 1].content : question;
            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: contextText, action: action, images: selectedImages, documents: selectedDocs }),
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
                aiMsgBody.innerHTML = formatMessage(accumulatedText);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            currentChat.push({ role: 'ai', content: accumulatedText });
            saveSession();

        } catch (error) {
            if (error.name === 'AbortError') {
                typingIndicator.innerHTML = '<em>Stopped.</em>';
            } else { typingIndicator.innerText = 'Error: ' + error.message; }
        } finally {
            isGenerating = false;
            sendBtn.style.display = 'flex';
            stopBtn.style.display = 'none';
            abortController = null;
            selectedImages = [];
            selectedDocs = [];
            previewContainer.innerHTML = '';
        }
    }

    window.runCode = async (btn, code) => {
        const outputDiv = btn.parentNode.querySelector('.code-output');
        btn.innerText = 'Running...';
        btn.disabled = true;
        outputDiv.style.display = 'block';
        outputDiv.innerText = 'Calculating...';
        try {
            const response = await fetch('/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') })
            });
            const result = await response.json();
            outputDiv.innerText = result.output || result.error || 'Empty output';
        } catch (e) { outputDiv.innerText = 'Error: ' + e.message; } finally {
            btn.innerText = 'Run Again';
            btn.disabled = false;
        }
    };

    uploadBtn.onclick = () => imageUpload.click();
    docBtn.onclick = () => docUpload.click();
    
    docUpload.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result.split(',')[1];
                selectedDocs.push({ name: file.name, type: file.type || file.name.split('.').pop(), data: base64 });
                const item = document.createElement('div');
                item.className = 'preview-item doc-item';
                item.innerHTML = `<span>${file.name}</span><button class="preview-remove">&times;</button>`;
                item.querySelector('.preview-remove').onclick = () => {
                    selectedDocs = selectedDocs.filter(d => d.name !== file.name); item.remove();
                };
                previewContainer.appendChild(item);
            };
            reader.readAsDataURL(file);
        });
        docUpload.value = '';
    };

    imageUpload.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result.split(',')[1];
                selectedImages.push(base64);
                const item = document.createElement('div');
                item.className = 'preview-item';
                item.innerHTML = `<img src="${event.target.result}"><button class="preview-remove">&times;</button>`;
                item.querySelector('.preview-remove').onclick = () => {
                    const idx = selectedImages.indexOf(base64);
                    if (idx > -1) selectedImages.splice(idx, 1);
                    item.remove();
                };
                previewContainer.appendChild(item);
            };
            reader.readAsDataURL(file);
        });
        imageUpload.value = '';
    };

    sendBtn.onclick = () => askAI(userInput.value);
    stopBtn.onclick = () => { if (abortController) abortController.abort(); };
    voiceInputBtn.onclick = () => {
        if (voiceInputBtn.classList.contains('listening')) { recognition.stop(); } else { recognition.start(); }
    };

    userInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
    };

    explainBtn.onclick = () => askAI('', 'explain_simpler');
    summarizeBtn.onclick = () => askAI('', 'summarize');

    userInput.oninput = () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    };

    const upgradeModal = document.getElementById('subscription-modal');
    const openUpgradeBtn = document.getElementById('open-upgrade-modal');
    const closeUpgradeBtn = document.getElementById('close-modal');
    openUpgradeBtn.onclick = () => upgradeModal.classList.add('active');
    closeUpgradeBtn.onclick = () => upgradeModal.classList.remove('active');
    upgradeModal.onclick = (e) => { if (e.target === upgradeModal) { upgradeModal.classList.remove('active'); } };



    renderHistory();
});