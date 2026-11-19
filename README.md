# My Local AI Chatbot 🤖

A fully local AI chatbot powered by **Qwen3 8B**, Ollama, and FastAPI. Chat with your AI assistant, manage conversations, and access your chatbot through your PC or mobile browser.

## ✨ Features

- **Local AI:** Uses Qwen3 8B through Ollama.
- **FastAPI Backend:** Handles chat requests and AI responses.
- **SQLite Storage:** Saves conversation history locally.
- **Streaming Responses:** Displays AI responses as they are generated.
- **Stop Generation:** Stop an AI response while it is generating.
- **Regenerate Response:** Generate a fresh answer to a previous question.
- **Conversation Management:** Create, rename, delete, and restore conversations.
- **Conversation Search:** Search conversation titles and message content.
- **Export Conversations:** Download conversations as text files.
- **Markdown Support:** Supports headings, lists, tables, and formatted text.
- **Code Highlighting:** Displays code with syntax highlighting.
- **Copy Responses:** Copy AI-generated answers.
- **Dark and Light Mode:** Switch between themes.
- **Responsive Design:** Use the chatbot on desktop and mobile browsers.
- **Offline Frontend Libraries:** Uses locally stored JavaScript and CSS libraries.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| FastAPI | API development |
| Ollama | Local AI model runtime |
| Qwen3 8B | AI language model |
| SQLite | Conversation storage |
| HTML | Frontend structure |
| CSS | Frontend styling |
| JavaScript | Frontend functionality |
| Marked.js | Markdown rendering |
| Highlight.js | Code syntax highlighting |
| DOMPurify | HTML sanitization |

## 📁 Project Structure

```text
MyLocalChatbot/
│
├── main.py
├── requirements.txt
├── .gitignore
├── README.md
│
├── templates/
│   └── index.html
│
└── static/
    ├── app.js
    ├── style.css
    │
    └── libs/
        ├── marked.min.js
        ├── highlight.min.js
        ├── purify.min.js
        ├── github-markdown-dark.min.css
        └── github-dark.min.css
```

## ⚙️ Requirements

- Python 3.10 or newer
- Ollama installed
- Qwen3 8B model downloaded
- Git

## 🚀 Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/vk2851/MyLocalChatbot.git
cd MyLocalChatbot
```

### 2. Create a virtual environment

Windows:

```bash
python -m venv venv
```

Activate it:

```bash
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Download the AI model

Install Ollama, then run:

```bash
ollama pull qwen3:8b
```

### 5. Start the chatbot

Run:

```bash
uvicorn main:app --reload
```

Open your browser:

```text
http://127.0.0.1:8000
```

## 📱 Access from Mobile

You can access the chatbot from your phone when both your phone and PC are connected to the same Wi-Fi network.

Start FastAPI with:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Find your PC's local IP address using:

```bash
ipconfig
```

Open this address on your phone:

```text
http://YOUR_PC_IP:8000
```

Keep your PC and Ollama running while using the chatbot.

## 🔒 Privacy

- AI inference runs locally through Ollama.
- Conversations are stored in a local SQLite database.
- The SQLite database and virtual environment are excluded from Git using `.gitignore`.

## 📌 Future Improvements

- Edit previous messages
- User authentication
- Improved conversation management
- Additional AI models
- Enhanced mobile experience

## 👨‍💻 Author

Developed as a personal project to explore local AI, Python, FastAPI, frontend development, and LLM integration.