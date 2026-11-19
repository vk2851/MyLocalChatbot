
let conversationId = localStorage.getItem("conversationId");

if (!conversationId) {
    conversationId = crypto.randomUUID();
    localStorage.setItem("conversationId", conversationId);
}

const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
// Stop generation controls
const stopBtn = document.getElementById("stop-btn");

let currentChatController = null;
const messages = document.getElementById("messages");
const chatHistory = document.getElementById("chat-history");
const newChatBtn = document.getElementById("new-chat-btn");
const chatTitle = document.getElementById("chat-title");


// Display messages

// Convert Markdown into safe, formatted HTML
function renderMarkdown(element, text) {

    const html = marked.parse(text);

    const safeHtml = DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true }
    });

    element.classList.add("markdown-body");
    element.innerHTML = safeHtml;

    // Highlight code blocks
    element.querySelectorAll("pre code").forEach(codeBlock => {
        hljs.highlightElement(codeBlock);
    });
}


// Display messages
// Create a copy button for AI responses
function addCopyButton(container, text) {

    const copyBtn = document.createElement("button");

    copyBtn.textContent = "📋 Copy";
    copyBtn.className = "copy-btn";
    copyBtn.type = "button";

    copyBtn.addEventListener("click", async () => {

        try {
            await navigator.clipboard.writeText(text);

            copyBtn.textContent = "✅ Copied!";

            setTimeout(() => {
                copyBtn.textContent = "📋 Copy";
            }, 2000);

        } catch (error) {
            alert("Could not copy the response.");
            console.error(error);
        }
    });

    container.appendChild(copyBtn);
}


// Add Regenerate button to an AI response
function addRegenerateButton(container, conversationId) {

    const regenerateBtn = document.createElement("button");

    regenerateBtn.textContent = "🔄 Regenerate";
    regenerateBtn.className = "regenerate-btn";
    regenerateBtn.type = "button";

    regenerateBtn.addEventListener("click", async (event) => {

        event.stopPropagation();

        await regenerateResponse(conversationId, container);

    });

    container.appendChild(regenerateBtn);
}


async function regenerateResponse(id, messageDiv) {

    // Prevent multiple simultaneous requests
    if (currentChatController) return;

    const controller = new AbortController();
    currentChatController = controller;

    sendBtn.disabled = true;
    stopBtn.hidden = false;
    stopBtn.disabled = false;
    stopBtn.textContent = "⏹ Stop";

    let answer = "";
    let firstChunk = true;

    // Show typing animation
    messageDiv.className = "bot-message";

    messageDiv.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    try {

        const response = await fetch(
            `/conversations/${encodeURIComponent(id)}/regenerate`,
            {
                method: "POST",
                signal: controller.signal
            }
        );

        if (!response.ok) {
            throw new Error("Regeneration failed: " + response.status);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Receive the new answer progressively
        while (true) {

            const { value, done } = await reader.read();

            if (done) break;

            if (firstChunk) {
                messageDiv.innerHTML = "";
                firstChunk = false;
            }

            answer += decoder.decode(value, { stream: true });

            renderMarkdown(messageDiv, answer);

            messages.scrollTop = messages.scrollHeight;
        }

        answer += decoder.decode();

        if (answer) {

            renderMarkdown(messageDiv, answer);

            addCopyButton(messageDiv, answer);
            addRegenerateButton(messageDiv, id);
            addMessageTimestamp(messageDiv);

        } else {
            messageDiv.textContent = "No response received.";
        }

    } catch (error) {

        if (error.name === "AbortError") {

            if (answer) {
                renderMarkdown(messageDiv, answer);
                addCopyButton(messageDiv, answer);
                addRegenerateButton(messageDiv, id);
                addMessageTimestamp(messageDiv);
            } else {
                messageDiv.textContent = "Generation stopped.";
            }

        } else {

            messageDiv.textContent =
                "Could not regenerate: " + error.message;

            console.error(error);

        }

    } finally {

        currentChatController = null;

        sendBtn.disabled = false;
        stopBtn.hidden = true;
        stopBtn.disabled = false;
        stopBtn.textContent = "⏹ Stop";

        await loadConversations();

        messages.scrollTop = messages.scrollHeight;
        userInput.focus();

    }
}


// Display messages

// Format message timestamp
function formatMessageTime(timestamp = null) {

    const date = timestamp
        ? new Date(timestamp.replace(" ", "T") + "Z")
        : new Date();

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

// Add timestamp to a message
function addMessageTimestamp(container, timestamp = null) {

    const timeElement = document.createElement("span");

    timeElement.className = "message-time";
    timeElement.textContent = formatMessageTime(timestamp);

    container.appendChild(timeElement);
}

// Display messages with timestamps
function addMessage(text, className, timestamp = null) {

    const messageDiv = document.createElement("div");

    messageDiv.className = className;

    if (className === "bot-message") {

        renderMarkdown(messageDiv, text);
        addCopyButton(messageDiv, text);

    } else {

        messageDiv.textContent = text;

    }

    // Add timestamp
    const timeElement = document.createElement("span");

    timeElement.className = "message-time";
    timeElement.textContent = formatMessageTime(timestamp);

    messageDiv.appendChild(timeElement);

    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

// Load saved conversations
async function loadConversations() {

    try {
        const response = await fetch("/conversations");

        if (!response.ok) {
            throw new Error("Could not load conversations");
        }

        const conversations = await response.json();

        chatHistory.innerHTML = "";

        conversations.forEach(chat => {

    const item = document.createElement("div");
    item.className = "history-item";
    item.dataset.conversationId = chat.conversation_id;

    // Highlight the currently active conversation
    if (chat.conversation_id === conversationId) {
    item.classList.add("active-chat");
    }

    const title = document.createElement("span");
    title.textContent = chat.title || "New Chat";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.className = "delete-chat-btn";
    deleteBtn.title = "Delete conversation";

    title.addEventListener("click", () => {
        openConversation(chat.conversation_id);
    });

    // Rename conversation
const renameBtn = document.createElement("button");

renameBtn.textContent = "✏️";
renameBtn.className = "rename-chat-btn";
renameBtn.title = "Rename conversation";

renameBtn.addEventListener("click", async (event) => {

    event.stopPropagation();

    const newTitle = prompt("Enter a new conversation title:");

    if (!newTitle || !newTitle.trim()) {
        return;
    }

    try {

        const response = await fetch(
            `/conversations/${encodeURIComponent(chat.conversation_id)}/rename`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: newTitle.trim()
                })
            }
        );

        if (!response.ok) {
            throw new Error("Rename failed");
        }

        await loadConversations();

    } catch (error) {
        alert("Could not rename conversation.");
        console.error(error);
    }
});
    deleteBtn.addEventListener("click", async (event) => {

        event.stopPropagation();

        const confirmed = confirm("Delete this conversation?");

        if (!confirmed) return;

        try {
            const response = await fetch(
                `/conversations/${encodeURIComponent(chat.conversation_id)}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                throw new Error("Delete failed");
            }

            if (conversationId === chat.conversation_id) {
                newChat();
            }

            await loadConversations();

        } catch (error) {
            alert("Could not delete conversation.");
            console.error(error);
        }
    });

    // Download conversation
const downloadBtn = document.createElement("button");

downloadBtn.textContent = "⬇️";
downloadBtn.className = "download-chat-btn";
downloadBtn.title = "Download conversation";

downloadBtn.addEventListener("click", async (event) => {

    event.stopPropagation();

    try {

        const response = await fetch(
            `/conversations/${encodeURIComponent(chat.conversation_id)}`
        );

        if (!response.ok) {
            throw new Error("Could not download conversation");
        }

        const data = await response.json();

        const conversationText = data.messages.map(message => {

            const role = message.role === "user" ? "You" : "AI";

            return `${role}:\n${message.content}`;

        }).join("\n\n");

        const blob = new Blob(
            [conversationText],
            { type: "text/plain;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = `${(chat.title || "conversation").replace(/[^\w-]+/g, "_")}.txt`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

    } catch (error) {

        alert("Could not download conversation.");
        console.error(error);

    }
});

    item.appendChild(title);
    item.appendChild(renameBtn);
    item.appendChild(downloadBtn);
    item.appendChild(deleteBtn);

    chatHistory.appendChild(item);
});

    } catch (error) {
        console.error(error);
    }
}


// Open an old conversation

async function openConversation(id) {

    try {
        const response = await fetch(
            `/conversations/${encodeURIComponent(id)}`
        );

        if (!response.ok) {
            throw new Error("Could not open conversation");
        }

        const data = await response.json();

        conversationId = id;

        localStorage.setItem("conversationId", id);

        await loadConversations();

        messages.innerHTML = "";

        chatTitle.textContent = "Previous Chat";

        data.messages.forEach(message => {

            const className =
                message.role === "user"
                    ? "user-message"
                    : "bot-message";

            addMessage(message.content, className, message.created_at);

        });

        // Add Regenerate only to the latest AI response
        const lastMessage =
            data.messages[data.messages.length - 1];

        if (lastMessage && lastMessage.role === "assistant") {

            const botMessages =
                messages.querySelectorAll(".bot-message");

            const latestBotMessage =
                botMessages[botMessages.length - 1];

            if (latestBotMessage) {
                addRegenerateButton(latestBotMessage, id);
            }

        }

    } catch (error) {

        console.error(error);

        addMessage(
            "Could not load this conversation.",
            "bot-message"
        );

    }
}

// Start a new conversation
function newChat() {

    conversationId = crypto.randomUUID();

    localStorage.setItem("conversationId", conversationId);

    messages.innerHTML = "";

    chatTitle.textContent = "New Chat";

    addMessage(
        "Hello! 👋 I'm your local AI assistant. How can I help?",
        "bot-message"
    );

    userInput.value = "";
    userInput.focus();
}


// Send message to AI

async function sendMessage() {

    const message = userInput.value.trim();

    if (!message) return;

    addMessage(message, "user-message");

    userInput.value = "";
    userInput.style.height = "48px";

    sendBtn.disabled = true;
    stopBtn.hidden = false;
    stopBtn.disabled = false;
    stopBtn.textContent = "⏹ Stop";

    // Create a controller for stopping generation
    const controller = new AbortController();
    currentChatController = controller;

    let answer = "";

    const loadingMessage = document.createElement("div");
    loadingMessage.className = "typing-indicator";

    loadingMessage.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;

    messages.appendChild(loadingMessage);
    messages.scrollTop = messages.scrollHeight;

    try {

        const response = await fetch("/chat", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message,
                conversation_id: conversationId
            }),

            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error("Server error: " + response.status);
        }

        // Read the streamed AI response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        loadingMessage.className = "bot-message";
        loadingMessage.textContent = "";

        while (true) {

            const { value, done } = await reader.read();

            if (done) break;

            answer += decoder.decode(value, { stream: true });

            // Show the answer as it arrives
            renderMarkdown(loadingMessage, answer);

            messages.scrollTop = messages.scrollHeight;
        }

        // Process any remaining bytes
        answer += decoder.decode();

        renderMarkdown(loadingMessage, answer);

        if (answer) {
            addCopyButton(loadingMessage, answer);
            addRegenerateButton(loadingMessage, conversationId);
            addMessageTimestamp(loadingMessage);
        }

        if (chatTitle.textContent === "New Chat") {
            chatTitle.textContent = message.slice(0, 40);
        }

        await loadConversations();

    } catch (error) {

        if (error.name === "AbortError") {

            // Generation was stopped by the user
            if (answer) {
                renderMarkdown(loadingMessage, answer);
                addCopyButton(loadingMessage, answer);
                addRegenerateButton(loadingMessage, conversationId);
            } else {
                loadingMessage.textContent = "Generation stopped.";
            }

            console.log("AI generation stopped.");

        } else {

            loadingMessage.textContent =
                "Something went wrong: " + error.message;

            console.error(error);

        }

        await loadConversations();

    } finally {

        currentChatController = null;

        sendBtn.disabled = false;
        stopBtn.hidden = true;
        stopBtn.disabled = false;
        stopBtn.textContent = "⏹ Stop";

        userInput.focus();
        messages.scrollTop = messages.scrollHeight;

    }
}

// Stop AI generation when clicked
stopBtn.addEventListener("click", function() {

    if (currentChatController) {

        stopBtn.disabled = true;
        stopBtn.textContent = "Stopping...";

        currentChatController.abort();

    }

});

// Event listeners
sendBtn.addEventListener("click", sendMessage);

newChatBtn.addEventListener("click", newChat);

// Enter sends the message
// Shift + Enter creates a new line
userInput.addEventListener("keydown", function(event) {

    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }

});
// Automatically expand the input box
userInput.addEventListener("input", function() {

    userInput.style.height = "auto";

    userInput.style.height =
        Math.min(userInput.scrollHeight, 160) + "px";

});


// Restore last conversation when website opens

async function initializeChat() {

    // Load conversation history in sidebar
    await loadConversations();

    try {

        // Get the last saved conversation
        const response = await fetch(
            `/conversations/${encodeURIComponent(conversationId)}`
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        // Restore only if the conversation has messages
        if (data.messages && data.messages.length > 0) {

            await openConversation(conversationId);

        }

    } catch (error) {

        console.error("Could not restore conversation:", error);

    }
}

// Start the chatbot
initializeChat();

// Dark Mode and Light Mode

const themeToggle = document.getElementById("theme-toggle");

// Apply saved theme when website opens
function applyTheme(theme) {

    const isLight = theme === "light";

    document.body.classList.toggle("light-mode", isLight);

    themeToggle.textContent = isLight
        ? "🌙 Dark Mode"
        : "☀️ Light Mode";
}

// Load previously selected theme
const savedTheme = localStorage.getItem("chatbotTheme") || "dark";

applyTheme(savedTheme);

// Switch theme when button is clicked
themeToggle.addEventListener("click", function() {

    const newTheme = document.body.classList.contains("light-mode")
        ? "dark"
        : "light";

    localStorage.setItem("chatbotTheme", newTheme);

    applyTheme(newTheme);

});

// Search conversations in chat history

const chatSearch = document.getElementById("chat-search");


// Search conversations by title and message content

chatSearch.addEventListener("input", async function () {

    const searchTerm = chatSearch.value.trim();

    const historyItems =
        chatHistory.querySelectorAll(".history-item");

    // Show all conversations when search is empty
    if (!searchTerm) {

        historyItems.forEach(item => {
            item.style.display = "flex";
        });

        return;
    }

    try {

        const response = await fetch(
            `/search-conversations?q=${encodeURIComponent(searchTerm)}`
        );

        if (!response.ok) {
            throw new Error("Search failed");
        }

        const results = await response.json();

        // Store matching conversation IDs
        const matchingIds = new Set(
            results.map(chat => chat.conversation_id)
        );

        // Show only matching conversations
        historyItems.forEach(item => {

            const conversationId = item.dataset.conversationId;

            item.style.display = matchingIds.has(conversationId)
                ? "flex"
                : "none";

        });

    } catch (error) {

        console.error("Search error:", error);

    }

});

// Mobile sidebar controls

const mobileSidebar = document.getElementById("sidebar");
const mobileSidebarToggle = document.getElementById("sidebar-toggle");
const mobileSidebarOverlay = document.getElementById("sidebar-overlay");

// Open sidebar
// Toggle mobile sidebar
mobileSidebarToggle.addEventListener("click", function () {

    if (mobileSidebar.classList.contains("open")) {

        closeMobileSidebar();

    } else {

        mobileSidebar.classList.add("open");
        mobileSidebarOverlay.classList.add("active");

        mobileSidebarToggle.setAttribute("aria-expanded", "true");

    }

});

// Close sidebar
function closeMobileSidebar() {

    mobileSidebar.classList.remove("open");
    mobileSidebarOverlay.classList.remove("active");

    mobileSidebarToggle.setAttribute("aria-expanded", "false");

}

// Close when overlay is clicked
mobileSidebarOverlay.addEventListener("click", closeMobileSidebar);

// Close after selecting a conversation or New Chat
mobileSidebar.addEventListener("click", function (event) {

    if (
        event.target.closest(".history-item") ||
        event.target.closest("#new-chat-btn")
    ) {
        closeMobileSidebar();
    }

});

// Close using Escape key
document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
        closeMobileSidebar();
    }

});