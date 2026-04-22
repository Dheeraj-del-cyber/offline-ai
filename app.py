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
    subject = data.get('subject', 'General').strip()
    action = data.get('action')

    if action == 'explain_simpler':
        system_prompt = f"""You are a professional academic tutor specializing in {subject}.
The user will provide an explanation. Rewrite this explanation in much simpler language with everyday examples.
Use plain words. Avoid jargon. Make it easy for a beginner to understand."""
    elif action == 'summarize':
        system_prompt = f"""You are a professional academic tutor specializing in {subject}.
The user will provide a detailed explanation. Summarize it into 3-5 clear, concise bullet points."""
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
        system_prompt = f"""You are a professional academic tutor specializing in {subject}.
Only answer questions related to academic subjects like science, mathematics, engineering, or school/college topics.
If the question is not academic and not a math calculation, respond with: "I only answer academic-related questions."
Give clear, structured, and correct answers. Use simple explanations and bullet points for clarity.
Crucially, identify the most important keywords and core concepts in your response and wrap them in == (e.g., ==photosynthesis==) so they are highlighted for the student."""


    prompt = f"{system_prompt}\n\nUser: {question}\n\nAssistant:"

    def generate():
        if math_result is not None:
            for char in f"Based on my precise calculation, the answer is: **{math_result}**":
                yield char
            return

        try:
            resp = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3:latest",
                    "prompt": prompt,
                    "stream": True
                },
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

if __name__ == '__main__':
    app.run(debug=True)