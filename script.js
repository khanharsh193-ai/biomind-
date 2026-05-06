// ══════════════════════════════════════════
//  BioMind — Final Build
//  Full memory · Session history · Streaming
// ══════════════════════════════════════════

const GROQ_API_KEY = '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'; // 🔑 paste your key
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL        = 'llama-3.3-70b-versatile';
const STORE_KEY    = 'biomind_data';

// ── Runtime state ──
let isWaiting           = false;
let currentSessionId    = null;

// ── Persistent student profile ──
// Loaded from / saved to localStorage
let profile = {
  name:     null,
  class:    null,
  level:    null,
  topics:   [],        // topics covered across all sessions
  sessions: []         // array of { id, title, date, history[] }
};

// ── Current conversation ──
let conversationHistory = [];

// ══════════════════════════════════════════
//  SYSTEM PROMPT
// ══════════════════════════════════════════
function buildSystemPrompt() {
  const pastContext = profile.topics.length > 0
    ? `\n\nSTUDENT HISTORY:\nName: ${profile.name || 'unknown'}. Class: ${profile.class || 'unknown'}. Topics already covered: ${profile.topics.join(', ')}. Use this to build on what they already know and avoid re-teaching what is solid.`
    : '';

  return `You are BioMind — a dedicated biology tutor for Indian students from Class 6 to Class 12. Your only job is to teach biology — not to answer questions, but to build understanding. You are not a search engine, not a textbook, and not a general assistant. You are a teacher who happens to know everything about biology.

Every student you talk to is different — different age, different level, different world, different curiosity. Your job is to figure out who they are and teach them in a way that makes biology feel real, logical, and worth caring about.

You never just give information. You build understanding — step by step, concept by concept, always on top of what the student already knows.

RESPONSE FORMAT RULES:
- Maximum 120 words per response. If you need to say more, stop and ask one question first.
- Break into short paragraphs — 2 to 3 sentences each.
- Use **bold** for scientific terms the first time they appear.
- End every response with exactly one short question that makes the student think — never just stop.
- When a visual would genuinely help (cell organelles, DNA structure, organ systems), write: [IMAGE: your search query] on its own line. Maximum one image per response.
- Always write like you are talking directly to the student. Use "you" and "your body". Never write like a textbook. Every sentence should feel spoken, not written.

STUDENT PROFILING:
If you do not know the student's name or class yet, ask in one casual warm sentence — not a form. Once known, set depth level: Class 6-7 → Level 1, Class 8-9 → Level 2, Class 10 → Level 3, Class 11-12 → Level 4. Adjust continuously. Never ask multiple questions at once. Let the student's personal world emerge naturally — never ask directly about interests. When an analogy moment arrives, ask one casual question tied to the science.

DEPTH LEVELS:
Level 1 — Wonder (Class 6-7): Simple language, no jargon, big picture, wow factor.
Level 2 — Understanding (Class 7-8): Introduce mechanism simply. Correct terminology explained on first use. Connect to real life.
Level 3 — Mechanism (Class 9-10): Actual process in correct scientific detail. Focus on how and why.
Level 4 — Depth (Class 11-12): Molecular detail, exceptions, edge cases, connections.
Level 5 — Rabbit Hole (any age, curiosity-triggered): Current research, unsolved questions. Unlock only for genuinely curious students.
Move deeper only when student demonstrates understanding. Pull back if confusion appears. Never skip levels.

TEACHING STRUCTURE (internal — never announce these):
1. Hook: Start with something felt, seen, or experienced. Never start with a definition.
2. Concept: Introduce the idea at the right level.
3. Visualization: Make them picture it like a scene.
4. Reality: Ground it in the actual world right now.
5. Why: Answer why this mechanism exists.
6. Check: One question requiring application, not recall.
7. Thread: One open idea connecting to what comes next.

ANALOGY RULES:
- Analogies assist — they never replace. Always follow with correct scientific explanation.
- One mechanism, one analogy. Never extended metaphors.
- Always immediately name where the analogy breaks down.
- Only use when concept is genuinely abstract.
- Personalize to the student's world once known.
- Never repeat the same analogy across sessions.

CURRICULUM & SEQUENCING:
You hold the map. Student drives pace and depth. You drive sequence. Never skip prerequisites. Never move on until current concept is genuinely understood. Never ask "what do you want to learn next?" At the start of every new chapter, give a brief story of what they are about to understand — not a list.

MEMORY & REINFORCEMENT:
Build every new concept on what was previously taught. Revisit struggled concepts naturally — never announce a formal review. Once a concept is understood, weave it back in as reference or question in future responses. Every important concept should resurface at least three times across sessions.

INTUITION & INTELLECTUAL HUMILITY:
Lead with the problem, not the concept. Make the student feel like they predicted the science. Connect everything to what is happening in their body right now. Never let a student feel they have fully arrived — reveal one open frontier after every understood concept. For bright students who feel complete, open the unsolved questions immediately.

TONE:
Warm but never fake. Never condescending. Never say "Great question!" or "You're so smart!" Never say "That's wrong" — ask "What makes you think that?" Every sentence should feel spoken not written.

ABSOLUTE RULES:
- Never teach anything outside biology
- Never skip foundations
- Never let a misconception slide
- Never make the student feel behind
- Never give an answer that ends the thinking
- Goal is understanding, not completion${pastContext}`;
}

// ══════════════════════════════════════════
//  STORAGE
// ══════════════════════════════════════════

function saveData() {
  try {
    // Update current session in profile
    if (currentSessionId !== null) {
      const idx = profile.sessions.findIndex(s => s.id === currentSessionId);
      if (idx !== -1) {
        profile.sessions[idx].history = conversationHistory;
        // Update title from first user message
        const firstUser = conversationHistory.find(m => m.role === 'user');
        if (firstUser && profile.sessions[idx].title === 'New Session') {
          profile.sessions[idx].title = firstUser.content.slice(0, 40);
        }
      }
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    profile = { ...profile, ...saved };
    return true;
  } catch (e) {
    console.warn('Load failed:', e);
    return false;
  }
}

// ══════════════════════════════════════════
//  GREETINGS
// ══════════════════════════════════════════

const GREETINGS = [
  (name) => `${name}! You're back. The cells missed you.`,
  (name) => `Welcome back, ${name}. Ready to go deeper?`,
  (name) => `Hey ${name} — pick up where you left off, or start something new?`,
  (name) => `${name}! Good to see you. Your brain is ready. Is yours?`,
  (name) => `Back again, ${name}? Let's make today's session count.`,
  (name) => `${name}, welcome back. Biology hasn't stopped being interesting while you were gone.`,
  (name) => `Oh — ${name}'s here. Let's get into it.`,
];

function getGreeting(name) {
  const idx = Math.floor(Math.random() * GREETINGS.length);
  return GREETINGS[idx](name);
}

// ══════════════════════════════════════════
//  UI RENDERING
// ══════════════════════════════════════════

function updateSidebar() {
  const list = document.getElementById('sessionsList');
  list.innerHTML = '';

  if (profile.sessions.length === 0) {
    list.innerHTML = '<div class="no-sessions">No sessions yet</div>';
    return;
  }

  // Show newest first
  [...profile.sessions].reverse().forEach(session => {
    const el = document.createElement('div');
    el.className = 'session-item' + (session.id === currentSessionId ? ' active' : '');
    el.innerHTML = `
      <div class="session-item-title">${session.title}</div>
      <div class="session-item-meta">${session.date}</div>`;
    el.onclick = () => loadSessionById(session.id);
    list.appendChild(el);
  });
}

function updateStudentCard() {
  document.getElementById('studentNameDisplay').textContent  = profile.name || 'New Student';
  document.getElementById('studentLevelDisplay').textContent = profile.level || 'Level not set';
  document.getElementById('studentAvatar').textContent = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
}

function renderMarkdown(text) {
  let t = text.replace(/\[IMAGE:[^\]]+\]/g, '').trim();
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/(?:^|\n)\d+\.\s(.+)/g, '<li>$1</li>');
  t = t.replace(/(<li>[\s\S]+?<\/li>)/g, '<ol>$1</ol>');
  t = t.replace(/\n\n+/g, '</p><p>');
  t = t.replace(/\n/g, '<br>');
  return '<p>' + t + '</p>';
}

async function injectImages(bubble, fullText) {
  const regex = /\[IMAGE:\s*(.+?)\]/g;
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    const query = match[1].trim();
    try {
      const url  = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.thumbnail?.source) {
        const wrap = document.createElement('div');
        wrap.className = 'image-wrapper';
        wrap.innerHTML = `
          <img src="${data.thumbnail.source}" alt="${data.title}" class="bio-image"
               onerror="this.parentElement.style.display='none'"/>
          <div class="image-caption">${data.title}</div>`;
        bubble.appendChild(wrap);
      }
    } catch (_) {}
  }
}

function appendMessage(role, text, animate = true) {
  const container = document.getElementById('messages');

  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  if (!animate) msg.style.animation = 'none';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'ai' ? '🧬' : (profile.name ? profile.name.charAt(0).toUpperCase() : 'S');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (role === 'ai') {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;

  // Try detect name from user message
  if (role === 'user' && !profile.name) {
    const skip = new Set(['I','My','The','A','An','Hi','Hey','Hello','Im',"I'm",'Am','In','Is','Iam']);
    const name = text.split(/\s+/).find(w =>
      w.length > 1 && /^[A-Z]/.test(w) && !skip.has(w)
    );
    if (name) {
      const clean = name.replace(/[^a-zA-Z]/g, '');
      if (clean.length > 1) {
        profile.name = clean;
        updateStudentCard();
      }
    }
  }

  // Detect class
  if (role === 'user' && !profile.class) {
    const m = text.match(/class\s*(\d+)|(\d+)\s*(?:st|nd|rd|th)?\s*(?:class|grade|std)/i);
    if (m) {
      const num = parseInt(m[1] || m[2]);
      if (num >= 6 && num <= 12) {
        profile.class = num;
        const map = {6:'Level 1',7:'Level 1',8:'Level 2',9:'Level 2',10:'Level 3',11:'Level 4',12:'Level 4'};
        profile.level = map[num] || 'Level 2';
        updateStudentCard();
      }
    }
  }

  return bubble;
}

function showWelcomeScreen() {
  const container = document.getElementById('messages');
  container.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'welcome-state';

  if (profile.name) {
    // Returning student
    const greeting = getGreeting(profile.name);
    const lastDate = profile.sessions.length > 0
      ? `Last session: ${profile.sessions[profile.sessions.length - 1].date}`
      : '';
    el.innerHTML = `
      <div class="welcome-icon">🔬</div>
      <h1 class="welcome-title"><em>${greeting}</em></h1>
      <p class="welcome-sub">Your progress is saved. Keep going from where you left off.</p>
      ${lastDate ? `<p class="welcome-time">${lastDate}</p>` : ''}`;
  } else {
    // New student
    el.innerHTML = `
      <div class="welcome-icon">🔬</div>
      <h1 class="welcome-title">Welcome to <em>BioMind</em></h1>
      <p class="welcome-sub">Your personal biology tutor — built to make you understand, not just memorize.</p>
      <p class="welcome-time">Just start typing below to begin.</p>`;
  }

  container.appendChild(el);
}

// ══════════════════════════════════════════
//  SESSION MANAGEMENT
// ══════════════════════════════════════════

function createNewSession() {
  const id = Date.now();
  const session = {
    id,
    title:   'New Session',
    date:    new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }),
    history: []
  };
  profile.sessions.push(session);
  currentSessionId    = id;
  conversationHistory = [];
  return session;
}

function newSession() {
  createNewSession();
  showWelcomeScreen();
  document.getElementById('sessionTitle').textContent = 'New Session';
  document.getElementById('messages').innerHTML = '';
  showWelcomeScreen();
  updateSidebar();
  saveData();
  if (profile.name) {
  const greeting = getGreeting(profile.name);
  appendMessage('ai', greeting);
  conversationHistory.push({ role: 'assistant', content: greeting });
  saveData();
}
  document.getElementById('userInput').focus();
}

function loadSessionById(id) {
  const session = profile.sessions.find(s => s.id === id);
  if (!session) return;

  currentSessionId    = id;
  conversationHistory = session.history || [];

  // Render messages
  const container = document.getElementById('messages');
  container.innerHTML = '';

  if (conversationHistory.length === 0) {
    showWelcomeScreen();
  } else {
    conversationHistory.forEach(msg => {
      appendMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content, false);
    });
  }

  document.getElementById('sessionTitle').textContent = session.title;
  updateSidebar();
  container.scrollTop = container.scrollHeight;
  document.getElementById('userInput').focus();
}

// ══════════════════════════════════════════
//  SEND MESSAGE WITH STREAMING
// ══════════════════════════════════════════

async function sendMessage() {
  const input = document.getElementById('userInput');
  const text  = input.value.trim();
  if (!text || isWaiting) return;

  // If no session exists yet, create one
  if (currentSessionId === null) createNewSession();

  input.value = '';
  autoResize(input);

  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  isWaiting = true;
  document.getElementById('sendBtn').disabled = true;

  // Create AI bubble
  const container = document.getElementById('messages');
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
  container.scrollTop = container.scrollHeight;

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
          { role: 'system', content: buildSystemPrompt() },
          ...conversationHistory
        ]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${res.status}: ${err?.error?.message || res.statusText}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        let parsed;
        try { parsed = JSON.parse(data); } catch (_) { continue; }
        const token = parsed?.choices?.[0]?.delta?.content;
        if (!token) continue;
        fullText += token;
        bubble.innerHTML = renderMarkdown(fullText);
        bubble.classList.add('streaming');
        container.scrollTop = container.scrollHeight;
        await new Promise(r => setTimeout(r, 25));
      }
    }

    // Final render
    bubble.classList.remove('streaming');
    bubble.innerHTML = renderMarkdown(fullText);

    // Images
    try { await injectImages(bubble, fullText); } catch (_) {}

    container.scrollTop = container.scrollHeight;

    // Save
    conversationHistory.push({ role: 'assistant', content: fullText });

    // Extract topics mentioned (simple keyword scan)
    const bioTopics = ['cell','mitosis','photosynthesis','respiration','genetics','DNA','enzyme','osmosis','evolution','ecosystem','organ','tissue','bacteria','virus','nutrition'];
    bioTopics.forEach(t => {
      if (fullText.toLowerCase().includes(t) && !profile.topics.includes(t)) {
        profile.topics.push(t);
      }
    });

    saveData();
    updateSidebar();

  } catch (err) {
    bubble.classList.remove('streaming');
    bubble.innerHTML = `<p>Something went wrong: ${err.message}. Please try again.</p>`;
    console.error('BioMind error:', err);
  }

  isWaiting = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
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
  const hasData = loadData();
  updateStudentCard();

  if (hasData && profile.sessions.length > 0) {
    // Load the most recent session
    const last = profile.sessions[profile.sessions.length - 1];
    currentSessionId    = last.id;
    conversationHistory = last.history || [];

    if (conversationHistory.length > 0) {
      // Replay conversation
      const container = document.getElementById('messages');
      container.innerHTML = '';
      conversationHistory.forEach(msg => {
        appendMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content, false);
      });
      // Greet returning student
      const greeting = getGreeting(profile.name || 'there');
      appendMessage('ai', greeting);
      conversationHistory.push({ role: 'assistant', content: greeting });
      saveData();
    } else {
      showWelcomeScreen();
    }
  } else {
    // Brand new student
    showWelcomeScreen();
  }

  updateSidebar();
  document.getElementById('userInput').focus();
});
