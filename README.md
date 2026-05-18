<h1 align="center">
  <img src="https://img.shields.io/badge/ASTRA%20AI-Offline%20Intelligence-blueviolet?style=for-the-badge&logo=robot&logoColor=white" alt="Astra AI Banner"/>
</h1>

<p align="center">
  <strong>A fully offline, privacy-first AI assistant powered by local LLMs via Ollama.</strong><br/>
  Chat intelligently, analyze images, read documents — all without sending a single byte to the cloud.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Flask-2.0+-black?style=flat-square&logo=flask&logoColor=white"/>
  <img src="https://img.shields.io/badge/Ollama-Local%20LLM-orange?style=flat-square"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square"/>
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square"/>
</p>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Running the App](#-running-the-app)
- [How It Works](#-how-it-works)
- [API Endpoints](#-api-endpoints)
- [Feedback & Learning](#-feedback--learning)
- [Author](#-author)

---

## 🧠 About the Project

**Astra AI** is a locally-hosted, fully offline AI chat assistant built for the privacy-conscious user. Unlike cloud-based AI tools, Astra AI runs entirely on your own machine — your data never leaves your device.

It is built on top of **Ollama**, a local model runner, and uses **Llama 3** for general conversation and **Moondream** for multimodal (image) understanding. The clean, ChatGPT-inspired web interface is served via a lightweight **Flask** backend.

Built by **ASTRAians** at a hackathon, this project demonstrates that powerful AI doesn't require an internet connection.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔒 **100% Offline** | All AI inference runs locally via Ollama. No internet needed after setup. |
| 💬 **LLM Chat** | Conversational AI using **Llama 3** with real-time streaming responses. |
| 🖼️ **Image Analysis** | Upload images for visual Q&A powered by the **Moondream** vision model. |
| 📄 **Document RAG** | Attach **PDF** or **TXT** files; the AI reads and answers questions about them. |
| 🧮 **Math Solver** | Intercepts arithmetic and percentage questions for instant, accurate answers. |
| 🎤 **Voice Input** | Ask questions hands-free using the browser's Speech Recognition API. |
| 🌗 **Light/Dark Mode** | Persistent theme preference saved to `localStorage`. |
| 🔁 **Simplify & Summarize** | One-click actions to reformat any AI response for easier reading. |
| 💻 **Code Execution** | Run Python code snippets directly in the browser (sandboxed subprocess). |
| 👍 **Feedback Learning** | Rate responses with like/dislike; feedback is logged for future improvement. |
| 🕓 **Session History** | Chat history is maintained for the current session in the sidebar. |

---

## 🛠️ Tech Stack

**Backend**
- [Python 3.10+](https://www.python.org/)
- [Flask](https://flask.palletsprojects.com/) — Lightweight web framework
- [Ollama](https://ollama.com/) — Local LLM runtime (`llama3`, `moondream`)
- [PyPDF2](https://pypdf2.readthedocs.io/) / [pdfplumber](https://github.com/jsvine/pdfplumber) — PDF text extraction

**Frontend**
- Vanilla HTML5, CSS3, JavaScript (no framework)
- Browser Speech Recognition API (voice input)
- Fetch API with streaming (`ReadableStream`)

---

## 📂 Project Structure

```
offline-ai-main/
│
├── app.py                  # Flask backend — routes, LLM proxy, file parsing
├── requirements.txt        # Python dependencies
├── feedback_learning.json  # Logged user feedback (like/dislike + conversation)
│
├── templates/
│   └── index.html          # Main chat UI (Jinja2 template)
│
└── static/
    ├── style.css           # Full UI styling (dark/light mode, animations)
    └── script.js           # Frontend logic (streaming, voice, file uploads)
```

---

## ✅ Prerequisites

Before running Astra AI, make sure you have the following installed:

1. **Python 3.10+** → [Download](https://www.python.org/downloads/)
2. **Ollama** → [Download & Install](https://ollama.com/download)
3. **Required Ollama models** — pull them once:

```bash
ollama pull llama3
ollama pull moondream
```

> ⚠️ Ollama must be running in the background on `http://localhost:11434` before starting the Flask app.

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/offline-ai.git
cd offline-ai
```

### 2. Create a Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 🚀 Running the App

### Step 1 — Start Ollama

Make sure the Ollama service is running:

```bash
ollama serve
```

### Step 2 — Start the Flask Server

```bash
python app.py
```

### Step 3 — Open in Browser

Navigate to:

```
http://127.0.0.1:5000
```

---

## ⚙️ How It Works

```
User (Browser)
    │
    │  HTTP POST /ask  (question + optional images/docs)
    ▼
Flask Backend (app.py)
    │
    ├─ Math? → Instant local calculation (no LLM needed)
    │
    ├─ Has images? → Route to Ollama → moondream model
    │
    └─ General Q / Document RAG → Route to Ollama → llama3 model
                                            │
                                   Streamed response
                                            │
                                    ◄───────┘
                               Browser renders in real-time
```

**Document RAG (Retrieval-Augmented Generation):**
- User uploads a PDF or TXT file.
- The frontend base64-encodes the file and sends it with the question.
- Flask extracts the plain text and prepends it to the LLM prompt as context.
- The model answers based on the document content.

---

## 🔌 API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Serves the main chat interface |
| `POST` | `/ask` | Sends a prompt to the local LLM; supports images & documents. Returns a streaming plain-text response. |
| `POST` | `/execute` | Executes a Python code snippet in a sandboxed subprocess and returns stdout/stderr. |
| `POST` | `/feedback` | Logs a like/dislike rating with the associated conversation to `feedback_learning.json`. |

### `/ask` Request Body (JSON)

```json
{
  "question": "Explain quantum entanglement simply.",
  "action": "explain_simpler",
  "images": ["<base64_string>"],
  "documents": [
    { "name": "research.pdf", "data": "<base64_string>" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `question` | `string` | The user's input text |
| `action` | `string` | Optional: `explain_simpler` or `summarize` to use a specialized prompt |
| `images` | `array` | Optional: Base64-encoded image strings (triggers `moondream` model) |
| `documents` | `array` | Optional: Array of `{name, data}` objects for document context |

---

## 📊 Feedback & Learning

Every time a user clicks 👍 or 👎 on a response, the feedback is appended to **`feedback_learning.json`**:

```json
{"question": "write a python code to add 2 numbers", "response": "...", "type": "like"}
```

This data can be used in future iterations to:
- Fine-tune system prompts for better responses.
- Identify which types of questions the model struggles with.
- Build a preference dataset for RLHF (Reinforcement Learning from Human Feedback).

---

## 👨‍💻 Author

Built with ❤️ by **ASTRAians** — Dheeraj & Team

> *"Powerful AI should be accessible to everyone, even without the cloud."*

---

<p align="center">
  <sub>⭐ Star this repo if you find it useful!</sub>
</p>
