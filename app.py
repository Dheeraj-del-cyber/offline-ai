from flask import Flask, request, render_template, Response, stream_with_context
import requests
import logging
import json

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json()
    question = data.get('question', '').strip()
    action = data.get('action')

    if action == 'explain_simpler':
        system_prompt = f"""You are Astra AI, a highly advanced and helpful AI assistant, similar to ChatGPT.
The user wants a simpler explanation of the following text. Rewrite it using extremely simple language, common analogies, and clear examples.
Break down complex ideas so a child could understand them, but maintain accuracy."""
    elif action == 'summarize':
        system_prompt = f"""You are Astra AI, an advanced AI assistant. 
Distill the following text into its most critical points. Provide a concise, high-level summary followed by 3-5 key takeaways in bullet points."""
    else:
        system_prompt = """You are Astra AI, a versatile assistant built by ==ASTRAians== and the master ==dheeraj==.
Highlight terms: ==term==."""

    import re
    # Helper to intercept and calculate basic math
    def solve_math(q):
        q = str(q).lower().strip()
        q = q.replace('what is', '').replace('calculate', '').replace('solve', '').strip()
        q = q.replace('?', '')
        
        # 1. Percentages: "20% of 500" or "20 percent of 500"
        m = re.search(r'([\d.]+)\s*(?:%|percent)\s*of\s*([\d.]+)', q)
        if m:
            return (float(m.group(1)) * float(m.group(2))) / 100.0
            
        # 2. Convert natural language words to symbols
        q = re.sub(r'add\s+([\d.]+)\s+(?:to|and)\s+([\d.]+)', r'\1 + \2', q)
        q = re.sub(r'subtract\s+([\d.]+)\s+from\s+([\d.]+)', r'\2 - \1', q)
        q = re.sub(r'multiply\s+([\d.]+)\s+(?:by|and)\s+([\d.]+)', r'\1 * \2', q)
        q = re.sub(r'divide\s+([\d.]+)\s+by\s+([\d.]+)', r'\1 / \2', q)
        
        q = q.replace('plus', '+').replace('minus', '-').replace('times', '*').replace('divided by', '/')
        
        # 3. If it looks like a clean math equation now, solve it
        if re.match(r'^[\d\.\s\+\-\*\/\(\)]+$', q):
            try:
                # Use restricted eval for math ONLY
                result = eval(q, {"__builtins__": None}, {})
                # Format to remove trailing zeros if it's a whole number
                return int(result) if result == int(result) else round(result, 4)
            except Exception:
                pass
        return None

    math_result = None
    if not action:
        math_result = solve_math(question)
    
    # Process Documents for RAG
    documents = data.get('documents', [])
    doc_context = ""
    for doc in documents:
        doc_text = extract_text_from_file(doc['data'], doc['name'])
        doc_context += f"--- Document: {doc['name']} ---\n{doc_text}\n\n"

    history = data.get('history', [])

    if action:
        # For actions (summarize/explain), just use the single question context
        if doc_context:
            question = f"{doc_context}\n\nText: {question}"
        prompt = f"{system_prompt}\n\nUser: {question}\n\nAssistant:"
    else:
        # For normal chat, build from history
        prompt = system_prompt + "\n\n"
        if doc_context:
            prompt += f"{doc_context}\n\n"
        
        if history:
            for msg in history:
                role_str = "User" if msg.get("role") == "user" else "Assistant"
                content = msg.get("content", "")
                prompt += f"{role_str}: {content}\n\n"
            
            # Ensure it ends with Assistant:
            if history[-1].get("role") != "ai":
                prompt += "Assistant:"
        else:
            prompt += f"User: {question}\n\nAssistant:"

    def generate():
        if math_result is not None:
            for char in f"Based on my precise calculation, the answer is: **{math_result}**":
                yield char
            return

        try:
            images = data.get('images', [])
            # Changed from moondream to llava for much higher image accuracy
            model = "llava" if images else "llama3:latest"
            
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": True
            }
            if images:
                payload["images"] = images

            resp = requests.post(
                "http://localhost:11434/api/generate",
                json=payload,
                timeout=120,
                stream=True
            )
            if resp.status_code != 200:
                yield f"Ollama Error ({resp.status_code}): {resp.text}"
                return

            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except ValueError:
                    continue
                
                if "error" in chunk:
                    yield f"\n\nOllama Error: {chunk['error']}"
                    break
                    
                text = chunk.get("response", "")
                if text:
                    for char in text:
                        yield char
        except Exception as exc:
            yield f"\n\nConnection Error: {str(exc)}"

    return Response(stream_with_context(generate()), mimetype="text/plain; charset=utf-8")

def extract_text_from_file(data_b64, filename):
    import base64, io
    file_bytes = base64.b64decode(data_b64)
    text = ""
    if filename.endswith('.pdf'):
        try:
            # Using pdfplumber for significantly better accuracy than PyPDF2
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text: 
                        text += page_text + "\n"
        except Exception as e:
            text = f"[Error reading PDF: {str(e)}]"
    elif filename.endswith('.txt'):
        text = file_bytes.decode('utf-8', errors='ignore')
    return text

@app.route('/execute', methods=['POST'])
def execute():
    import subprocess, sys
    code = request.get_json().get('code', '')
    if not code: return {"error": "No code provided"}, 400
    
    try:
        # Run in a separate process for basic isolation
        # Note: In a production web app, you'd use a Docker container or more strict sandbox
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=10
        )
        return {
            "output": result.stdout,
            "error": result.stderr
        }
    except subprocess.TimeoutExpired:
        return {"error": "Execution timed out (10s limit)"}
    except Exception as e:
        return {"error": str(e)}

@app.route('/feedback', methods=['POST'])
def feedback():
    data = request.get_json()
    try:
        with open('feedback_learning.json', 'a') as f:
            f.write(json.dumps(data) + '\n')
        return {"status": "success"}, 200
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

if __name__ == '__main__':
    import socket
    def get_local_ip():
        try:
            # Create a dummy socket to determine the local IP used for internet routing
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"
            
    local_ip = get_local_ip()
    port = 5000
    print("="*50)
    print(f"🚀 ASTRA AI is running!")
    print(f"📱 To access from your mobile phone, connect to the same Wi-Fi and open this URL:")
    print(f"👉 http://{local_ip}:{port}")
    print("="*50)
    
    app.run(host='0.0.0.0', port=port, debug=True)