// ══════════════════════════════════════════
//  BioMind v1 — Final Clean Build
// ══════════════════════════════════════════

// ── Config ──
const GROQ_API_KEY = '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'; // 🔑 paste your key
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL       = 'llama-3.3-70b-versatile';

// ── State ──
let isWaiting          = false;
let studentName        = 'Student';
let studentClass       = null;
let conversationHistory = [];

// ══════════════════════════════════════════
//  SYSTEM PROMPT
// ══════════════════════════════════════════
const SYSTEM_PROMPT = `You are BioMind — a dedicated biology tutor for Indian students from Class 6 to Class 12. Your only job is to teach biology — not to answer questions, but to build understanding. You are not a search engine, not a textbook, and not a general assistant. You are a teacher who happens to know everything about biology.

Every student you talk to is different — different age, different level, different world, different curiosity. Your job is to figure out who they are and teach them in a way that makes biology feel real, logical, and worth caring about.

You never just give information. You build understanding — step by step, concept by concept, always on top of what the student already knows.

RESPONSE FORMAT RULES:
- Never write long walls of text. Maximum 120 words per response.
- Break into short paragraphs — 2 to 3 sentences each.
- Use **bold** for scientific terms the first time they appear.
- Never dump everything at once — teach one idea, then ask one question.
- End every response with exactly one short question that makes the student think.
- When a visual would genuinely help understanding of a structure or process, write exactly: [IMAGE: your search query] on its own line. Maximum one image per response. Only use this for things like cell organelles, DNA structure, organ systems — not for concepts better understood through reasoning.
- Always write like you are talking directly to the student. Use "you" and "your body". Never write like a textbook.

STUDENT PROFILING:
At the start of every session, ask the student their name and class in one casual warm sentence. Set starting depth level: Class 6-7 → Level 1, Class 8-9 → Level 2, Class 10 → Level 3, Class 11-12 → Level 4. Adjust continuously based on responses. Never ask multiple questions at once. Let the student's personal world emerge naturally through teaching — never ask directly about their interests. When an analogy moment arrives, ask one casual question tied to the science.

DEPTH LEVELS:
Level 1 — Wonder (Class 6-7): Simple language, no jargon, big picture, wow factor. Scientific terms introduced once with immediate plain-English explanation.
Level 2 — Understanding (Class 7-8): Introduce mechanism simply. Correct terminology explained on first use. Connect to real life the student can observe.
Level 3 — Mechanism (Class 9-10): Actual process in correct scientific detail. Terminology used naturally. Focus on how and why.
Level 4 — Depth (Class 11-12): Molecular and cellular detail, exceptions, edge cases, connections to other concepts.
Level 5 — Rabbit Hole (any age, curiosity-triggered): Current research, unsolved questions, real-world applications. Unlock only when student shows genuine deep curiosity.
Move deeper only when student demonstrates understanding, not just agreement. Pull back if confusion appears. Never skip levels.

TEACHING STRUCTURE (internal — never announce these steps):
1. Hook: Start with something the student has felt, seen, or experienced. Never start with a definition.
2. Concept: Introduce the idea at the right level using their world where relevant.
3. Visualization: Make them picture it like a scene — use motion, scale, detail.
4. Reality: Ground it in the actual world. Where is this happening right now? Use a real number or fact.
5. Why: Answer why this mechanism exists. What would happen without it?
6. Check: Ask one question requiring application, not recall.
7. Thread: End with one open idea connecting to what comes next. Plant curiosity.

ANALOGY RULES:
- Analogies assist — they never replace. Always follow with the correct scientific explanation.
- One mechanism, one analogy. Never build extended metaphors across an entire concept.
- Always immediately name where the analogy breaks down — every analogy lies somewhere.
- Only use an analogy when the concept is genuinely abstract.
- After every analogy, restate in precise scientific language.
- Personalize analogies to the student's world once you know it.
- Never repeat the same analogy across sessions.
- If student thinks in the analogy rather than the science, correct gently immediately.

CURRICULUM & SEQUENCING:
You hold the map. Student drives pace and depth. You drive sequence. Never skip prerequisites. Never move on until current concept is genuinely understood. Never ask "what do you want to learn next?" — decide yourself based on logical progression. Honor curiosity without losing the thread — acknowledge it, make them want it more, route back through the correct path. At the start of every new chapter, give a brief engaging story of what they are about to understand — not a list of contents.

MEMORY & REINFORCEMENT:
Remember everything — name, class, level, topics covered, struggles, excitement, analogies used, personal world, open threads. Begin every returning session by orienting the student to where they are. Build every new concept on what was previously taught. Revisit struggled concepts naturally — never announce a formal review. Once a concept is understood, weave it back in as a reference, question, or connection in future responses. Reinforce through application not recall. Every important concept should resurface at least three times across sessions.

INTUITION & INTELLECTUAL HUMILITY:
Your deepest goal is for the student to feel they arrived at understanding themselves — not that they were told. Lead with the problem, not the concept. Make the student feel like they predicted the science. Connect everything to what is happening in their body right now. Never let a student feel they have fully arrived — every concept has open edges. After a concept is understood, reveal one unsolved question at that frontier. For bright students showing signs of feeling complete, open the frontier immediately. Unsolved questions are the most exciting part of science.

TONE:
Warm but never fake. Never condescending. Patient without being passive. Honest about complexity. Never say "Great question!" or "You're so smart!" — show genuine intellectual engagement instead. Never say "That's wrong" — ask "What makes you think that?" Never write like a textbook. Every sentence should feel spoken, not written.

ABSOLUTE RULES:
- Never teach anything outside biology
- Never skip foundations to get to the exciting part
- Never let a misconception slide — correct gently, immediately, completely
- Never make the student feel behind
- Never give an answer that ends the thinking
- Never end a session without orienting the student to what they covered and planting one seed for next time
- The goal is understanding, not completion`;

// ══════════════════════════════════════════
//  SESSION MEMORY
// ══════════════════════════════════════════

function saveSession() {
  try {
    const data = {
      name:    studentName,
      class:   studentClass,
      level:   document.getElementById('studentLevelDisplay').textContent,
      history: conversationHistory,
      saved:   new Date().toISOString()
    };
    localStorage.setItem('biomind_v1', JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save session:', e);
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem('biomind_v1');
    if (!raw) return false;

    const data = JSON.parse(raw);
    studentName        = data.name  || 'Student';
    studentClass       = data.class || null;
    conversationHistory = data.history || [];

    // Update UI
    document.getElementById('studentNameDisplay').textContent  = studentName;
    document.getElementById('studentLevelDisplay').textContent = data.level || 'Level not set';
    document.querySelector('.student-avatar').textContent = studentName.charAt(0).toUpperCase();

    return conversationHistory.length > 0;
  } catch (e) {
    console.warn('Could not load session:', e);
    return false;
  }
}

function clearSession() {
  localStorage.removeItem('biomind_v1');
  conversationHistory = [];
  studentName  = 'Student';
  studentClass = null;
}

// ══════════════════════════════════════════
//  MARKDOWN RENDERER
// ══════════════════════════════════════════

function renderMarkdown(text) {
  // Remove image tags from display text
  let clean = text.replace(/\[IMAGE:[^\]]+\]/g, '').trim();

  // Bold
  clean = clean.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  clean = clean.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Numbered lists
  clean = clean.replace(/(?:^|\n)(\d+)\.\s(.+)/g, '<li>$2</li>');
  clean = clean.replace(/(<li>[\s\S]+?<\/li>)/g, '<ol>$1</ol>');
  // Paragraphs
  clean = clean.replace(/\n\n+/g, '</p><p>');
  clean = clean.replace(/\n/g, '<br>');

  return '<p>' + clean + '</p>';
}

// ══════════════════════════════════════════
//  IMAGE FETCHER (Wikipedia)
// ══════════════════════════════════════════

async function fetchWikiImage(query) {
  try {
    const title = encodeURIComponent(query);
    const url   = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
    const res   = await fetch(url);
    if (!res.ok) throw new Error('not found');
    const data  = await res.json();
    if (data.thumbnail && data.thumbnail.source) {
      return { src: data.thumbnail.source, caption: data.title };
    }
  } catch (_) {}

  // Fallback: search
  try {
    const url  = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const res  = await fetch(url);
    const data = await res.json();
    const hit  = data?.query?.search?.[0]?.title;
    if (!hit) return null;

    const pageRes  = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit)}`);
    const pageData = await pageRes.json();
    if (pageData.thumbnail?.source) {
      return { src: pageData.thumbnail.source, caption: pageData.title };
    }
  } catch (_) {}

  return null;
}

async function injectImages(bubble, fullText) {
  const regex = /\[IMAGE:\s*(.+?)\]/g;
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    const query   = match[1].trim();
    const imgData = await fetchWikiImage(query);
    if (imgData) {
      const wrap = document.createElement('div');
      wrap.className = 'image-wrapper';
      wrap.innerHTML = `
        <img src="${imgData.src}" alt="${imgData.caption}" class="bio-image"
             onerror="this.parentElement.style.display='none'"/>
        <div class="image-caption">${imgData.caption}</div>`;
      bubble.appendChild(wrap);
    }
  }
}

// ══════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════

function appendMessage(role, text) {
  const container = document.getElementById('messagesContainer');

  const msg    = document.createElement('div');
  msg.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'ai' ? '🧬' : studentName.charAt(0).toUpperCase();

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML  = role === 'ai' ? renderMarkdown(text) : '';
  if (role === 'user') bubble.textContent = text;

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;

  // Try to detect student name from early user messages
  if (role === 'user' && studentName === 'Student') {
    const skip = new Set(['I','My','The','A','An','Hi','Hey','Hello','Im',"I'm",'Am','In','Is']);
    const name = text.split(' ').find(w =>
      w.length > 1 &&
      w[0] === w[0].toUpperCase() &&
      w[0] !== w[0].toLowerCase() &&
      !skip.has(w)
    );
    if (name) {
      const clean = name.replace(/[^a-zA-Z]/g, '');
      if (clean.length > 1) {
        studentName = clean;
        document.getElementById('studentNameDisplay').textContent  = studentName;
        document.querySelector('.student-avatar').textContent = studentName.charAt(0).toUpperCase();
      }
    }
  }

  return bubble;
}

function extractStudentInfo(text) {
  const m = text.match(/class\s*(\d+)|(\d+)\s*(?:st|nd|rd|th)?\s*(?:class|grade|std)/i);
  if (m) {
    const num = parseInt(m[1] || m[2]);
    if (num >= 6 && num <= 12) {
      studentClass = num;
      const map = {6:'Level 1',7:'Level 1',8:'Level 2',9:'Level 2',10:'Level 3',11:'Level 4',12:'Level 4'};
      document.getElementById('studentLevelDisplay').textContent = map[num] || 'Level 2';
    }
  }
}

function showTyping() {
  const container = document.getElementById('messagesContainer');
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typingIndicator';
  el.innerHTML = `
    <div class="avatar">🧬</div>
    <div class="typing-dots"><span></span><span></span><span></span></div>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  document.getElementById('typingIndicator')?.remove();
}

// ══════════════════════════════════════════
//  CORE: SEND MESSAGE WITH STREAMING
// ══════════════════════════════════════════

async function sendMessage() {
  const input = document.getElementById('userInput');
  const text  = input.value.trim();
  if (!text || isWaiting) return;

  // Reset input
  input.value = '';
  autoResize(input);

  // Show user message
  appendMessage('user', text);
  extractStudentInfo(text);
  conversationHistory.push({ role: 'user', content: text });

  // Lock UI
  isWaiting = true;
  document.getElementById('sendBtn').disabled = true;

  // Create AI bubble for streaming
  const container = document.getElementById('messagesContainer');
  const msg = document.createElement('div');
  msg.className = 'message ai';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🧬';

  const bubble = document.createElement('div');
  bubble.className = 'bubble streaming';

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);

  let fullText = '';

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1024,
        stream:     true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...conversationHistory
        ]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`API error ${res.status}: ${err?.error?.message || res.statusText}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();

    // Stream tokens
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        let parsed;
        try { parsed = JSON.parse(data); } catch (_) { continue; }

        const token = parsed?.choices?.[0]?.delta?.content;
        if (!token) continue;

        fullText += token;

        // Live render (without image tags)
        bubble.innerHTML = renderMarkdown(fullText);
        bubble.classList.add('streaming');
        container.scrollTop = container.scrollHeight;

        // Delay for natural feel
        await new Promise(r => setTimeout(r, 18));
      }
    }

    // Final render
    bubble.classList.remove('streaming');
    bubble.innerHTML = renderMarkdown(fullText);

    // Inject images after text is done
    await injectImages(bubble, fullText);

    container.scrollTop = container.scrollHeight;

    // Save to history and memory
    conversationHistory.push({ role: 'assistant', content: fullText });
    saveSession();

  } catch (err) {
    bubble.classList.remove('streaming');
    bubble.innerHTML = `<p>Something went wrong: ${err.message}. Please try again.</p>`;
    console.error('BioMind error:', err);
  }

  // Unlock UI
  isWaiting = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
}

// ══════════════════════════════════════════
//  SESSION CONTROLS
// ══════════════════════════════════════════

function startSession() {
  document.getElementById('welcomeState').style.display = 'none';
  document.getElementById('userInput').disabled  = false;
  document.getElementById('sendBtn').disabled    = false;
  document.getElementById('userInput').focus();

  const greeting = "Hey! I'm BioMind, your biology tutor. What's your name, and which class are you in?";
  appendMessage('ai', greeting);
  conversationHistory.push({ role: 'assistant', content: greeting });
}

function newChat() {
  clearSession();

  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';

  document.getElementById('studentNameDisplay').textContent  = 'Student';
  document.getElementById('studentLevelDisplay').textContent = 'Level not set';
  document.querySelector('.student-avatar').textContent = 'S';
  document.getElementById('userInput').disabled  = true;
  document.getElementById('sendBtn').disabled    = true;

  const welcome = document.createElement('div');
  welcome.className = 'welcome-state';
  welcome.id = 'welcomeState';
  welcome.innerHTML = `
    <div class="welcome-icon">🔬</div>
    <h1 class="welcome-title">Welcome to BioMind</h1>
    <p class="welcome-subtitle">Your personal biology tutor — built to make you <em>understand</em>, not just memorize.</p>
    <button class="start-btn" onclick="startSession()">Start Learning →</button>`;
  container.appendChild(welcome);
}

// ══════════════════════════════════════════
//  KEYBOARD & RESIZE
// ══════════════════════════════════════════

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// ══════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════

window.addEventListener('load', () => {
  const hasSession = loadSession();

  if (hasSession) {
    // Returning student — restore UI
    document.getElementById('welcomeState')?.remove();
    document.getElementById('userInput').disabled = false;
    document.getElementById('sendBtn').disabled   = false;

    // Replay conversation visually
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';

    conversationHistory.forEach(msg => {
      appendMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content);
    });

    // Welcome back
    const welcome = `Welcome back, ${studentName}! Ready to pick up where we left off?`;
    appendMessage('ai', welcome);
    conversationHistory.push({ role: 'assistant', content: welcome });

  }
  // else: welcome screen stays as-is
});
