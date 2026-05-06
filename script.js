// ══════════════════════════════════════════
//  BioMind — Final Build
//  Full memory · Sessions · Streaming
// ══════════════════════════════════════════

const GROQ_API_KEY = 'YOUR_GROQ_KEY_HERE'; // 🔑 paste your key
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL        = 'llama-3.3-70b-versatile';
const STORE_KEY    = 'biomind_data';

// ── Runtime state ──
let isWaiting        = false;
let currentSessionId = null;

// ── Persistent student profile ──
let profile = {
  name:     null,
  class:    null,
  level:    null,
  topics:   [],
  sessions: []
};

// ── Current conversation ──
let conversationHistory = [];

// ══════════════════════════════════════════
//  SYSTEM PROMPT
// ══════════════════════════════════════════
function buildSystemPrompt() {
  var pastContext = '';
  if (profile.name) {
    pastContext = '\n\nSTUDENT HISTORY:\nName: ' + (profile.name || 'unknown') + '. Class: ' + (profile.class || 'unknown') + '. Level: ' + (profile.level || 'unknown') + '. Topics already covered: ' + (profile.topics.length > 0 ? profile.topics.join(', ') : 'none yet') + '. Use this to build on what they already know. Never ask for their name or class again — you already know it.';
  }

  return 'You are BioMind — a dedicated biology tutor for Indian students from Class 6 to Class 12. Your only job is to teach biology — not to answer questions, but to build understanding. You are not a search engine, not a textbook, and not a general assistant. You are a teacher who happens to know everything about biology.\n\nEvery student you talk to is different — different age, different level, different world, different curiosity. Your job is to figure out who they are and teach them in a way that makes biology feel real, logical, and worth caring about.\n\nYou never just give information. You build understanding — step by step, concept by concept, always on top of what the student already knows.\n\nRESPONSE FORMAT RULES:\n- Maximum 120 words per response. If you need to say more, stop and ask one question first.\n- Break into short paragraphs — 2 to 3 sentences each.\n- Use **bold** for scientific terms the first time they appear.\n- End every response with exactly one short question that makes the student think — never just stop.\n- When a visual would genuinely help (cell organelles, DNA structure, organ systems), write: [IMAGE: your search query] on its own line. Maximum one image per response.\n- Always write like you are talking directly to the student. Use "you" and "your body". Never write like a textbook.\n\nSTUDENT PROFILING:\nIf you do not know the student\'s name or class yet, ask in one casual warm sentence. Once known, set depth level: Class 6-7 → Level 1, Class 8-9 → Level 2, Class 10 → Level 3, Class 11-12 → Level 4. Adjust continuously. Never ask multiple questions at once.\n\nDEPTH LEVELS:\nLevel 1 — Wonder (Class 6-7): Simple language, no jargon, big picture, wow factor.\nLevel 2 — Understanding (Class 7-8): Introduce mechanism simply. Correct terminology explained on first use.\nLevel 3 — Mechanism (Class 9-10): Actual process in correct scientific detail.\nLevel 4 — Depth (Class 11-12): Molecular detail, exceptions, edge cases.\nLevel 5 — Rabbit Hole (any age, curiosity-triggered): Current research, unsolved questions.\n\nTEACHING STRUCTURE (internal — never announce these):\n1. Hook: Start with something felt, seen, or experienced. Never start with a definition.\n2. Concept: Introduce the idea at the right level.\n3. Visualization: Make them picture it like a scene.\n4. Reality: Ground it in the actual world right now.\n5. Why: Answer why this mechanism exists.\n6. Check: One question requiring application, not recall.\n7. Thread: One open idea connecting to what comes next.\n\nANALOGY RULES:\n- Analogies assist — they never replace. Always follow with correct scientific explanation.\n- One mechanism, one analogy. Never extended metaphors.\n- Always immediately name where the analogy breaks down.\n- Only use when concept is genuinely abstract.\n- Personalize to the student\'s world once known.\n- Never repeat the same analogy across sessions.\n\nCURRICULUM & SEQUENCING:\nYou hold the map. Student drives pace and depth. You drive sequence. Never skip prerequisites. Never move on until current concept is genuinely understood. Never ask "what do you want to learn next?"\n\nMEMORY & REINFORCEMENT:\nBuild every new concept on what was previously taught. Revisit struggled concepts naturally. Once a concept is understood, weave it back in future responses. Every important concept should resurface at least three times.\n\nINTUITION & INTELLECTUAL HUMILITY:\nLead with the problem, not the concept. Make the student feel like they predicted the science. Never let a student feel they have fully arrived — reveal one open frontier after every understood concept.\n\nTONE:\nWarm but never fake. Never condescending. Never say "Great question!" or "You\'re so smart!" Never say "That\'s wrong" — ask "What makes you think that?" Every sentence should feel spoken not written.\n\nABSOLUTE RULES:\n- Never teach anything outside biology\n- Never skip foundations\n- Never let a misconception slide\n- Never make the student feel behind\n- Never give an answer that ends the thinking\n- Goal is understanding, not completion' + pastContext;
}

// ══════════════════════════════════════════
//  STORAGE
// ══════════════════════════════════════════

function saveData() {
  try {
    if (currentSessionId !== null) {
      var idx = profile.sessions.findIndex(function(s) { return s.id === currentSessionId; });
      if (idx !== -1) {
        profile.sessions[idx].history = conversationHistory;
        var firstUser = conversationHistory.find(function(m) { return m.role === 'user'; });
        if (firstUser && profile.sessions[idx].title === 'New Session') {
          profile.sessions[idx].title = firstUser.content.slice(0, 40);
        }
      }
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(profile));
  } catch(e) {
    console.warn('Save failed:', e);
  }
}

function loadData() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    var saved = JSON.parse(raw);
    profile = Object.assign({}, profile, saved);
    return true;
  } catch(e) {
    console.warn('Load failed:', e);
    return false;
  }
}

// ══════════════════════════════════════════
//  GREETINGS
// ══════════════════════════════════════════

var GREETINGS = [
  function(name) { return name + '! You\'re back. The cells missed you.'; },
  function(name) { return 'Welcome back, ' + name + '. Ready to go deeper?'; },
  function(name) { return 'Hey ' + name + ' — pick up where you left off, or start something new?'; },
  function(name) { return name + '! Good to see you. Your brain is ready. Is yours?'; },
  function(name) { return 'Back again, ' + name + '? Let\'s make today\'s session count.'; },
  function(name) { return name + ', welcome back. Biology hasn\'t stopped being interesting while you were gone.'; },
  function(name) { return 'Oh — ' + name + '\'s here. Let\'s get into it.'; }
];

function getGreeting(name) {
  var idx = Math.floor(Math.random() * GREETINGS.length);
  return GREETINGS[idx](name);
}

// ══════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════

function updateSidebar() {
  var list = document.getElementById('sessionsList');
  list.innerHTML = '';

  if (profile.sessions.length === 0) {
    list.innerHTML = '<div class="no-sessions">No sessions yet</div>';
    return;
  }

  var reversed = profile.sessions.slice().reverse();
  reversed.forEach(function(session) {
    var el = document.createElement('div');
    el.className = 'session-item' + (session.id === currentSessionId ? ' active' : '');
    el.innerHTML =
      '<div class="session-item-title">' + session.title + '</div>' +
      '<div class="session-item-bottom">' +
        '<div class="session-item-meta">' + session.date + '</div>' +
        '<div class="session-delete" onclick="deleteSession(event,' + session.id + ')">✕</div>' +
      '</div>';
    el.onclick = function() { loadSessionById(session.id); };
    list.appendChild(el);
  });
}

function updateStudentCard() {
  document.getElementById('studentNameDisplay').textContent = profile.name || 'New Student';
  document.getElementById('studentLevelDisplay').textContent = profile.level || 'Level not set';
  document.getElementById('studentAvatar').textContent = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
}

function renderMarkdown(text) {
  var t = text.replace(/\[IMAGE:[^\]]+\]/g, '').trim();
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/(?:^|\n)\d+\.\s(.+)/g, '<li>$1</li>');
  t = t.replace(/(<li>[\s\S]+?<\/li>)/g, '<ol>$1</ol>');
  t = t.replace(/\n\n+/g, '</p><p>');
  t = t.replace(/\n/g, '<br>');
  return '<p>' + t + '</p>';
}

function injectImages(bubble, fullText) {
  var regex = /\[IMAGE:\s*(.+?)\]/g;
  var match;
  var promises = [];
  while ((match = regex.exec(fullText)) !== null) {
    (function(query) {
      var p = fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(query))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.thumbnail && data.thumbnail.source) {
            var wrap = document.createElement('div');
            wrap.className = 'image-wrapper';
            wrap.innerHTML = '<img src="' + data.thumbnail.source + '" alt="' + data.title + '" class="bio-image" onerror="this.parentElement.style.display=\'none\'"/><div class="image-caption">' + data.title + '</div>';
            bubble.appendChild(wrap);
          }
        })
        .catch(function() {});
      promises.push(p);
    })(match[1].trim());
  }
  return Promise.all(promises);
}

function appendMessage(role, text, animate) {
  if (animate === undefined) animate = true;
  var container = document.getElementById('messages');

  var msg = document.createElement('div');
  msg.className = 'message ' + role;
  if (!animate) msg.style.animation = 'none';

  var avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'ai' ? '🧬' : (profile.name ? profile.name.charAt(0).toUpperCase() : 'S');

  var bubble = document.createElement('div');
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

  // Try to detect name
  if (role === 'user' && !profile.name) {
    var skip = ['I','My','The','A','An','Hi','Hey','Hello','Im','Am','In','Is','Iam'];
    var words = text.split(/\s+/);
    var name = null;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length > 1 && /^[A-Z]/.test(w) && skip.indexOf(w) === -1) {
        name = w;
        break;
      }
    }
    if (name) {
      var clean = name.replace(/[^a-zA-Z]/g, '');
      if (clean.length > 1) {
        profile.name = clean;
        updateStudentCard();
      }
    }
  }

  // Try to detect class
  if (role === 'user' && !profile.class) {
    var m = text.match(/class\s*(\d+)|(\d+)\s*(?:st|nd|rd|th)?\s*(?:class|grade|std)/i);
    if (m) {
      var num = parseInt(m[1] || m[2]);
      if (num >= 6 && num <= 12) {
        profile.class = num;
        var map = {6:'Level 1',7:'Level 1',8:'Level 2',9:'Level 2',10:'Level 3',11:'Level 4',12:'Level 4'};
        profile.level = map[num] || 'Level 2';
        updateStudentCard();
      }
    }
  }

  return bubble;
}

function showWelcomeScreen() {
  var container = document.getElementById('messages');
  container.innerHTML = '';

  var el = document.createElement('div');
  el.className = 'welcome-state';

  if (profile.name) {
    el.innerHTML =
      '<div class="welcome-icon">🔬</div>' +
      '<h1 class="welcome-title"><em>' + getGreeting(profile.name) + '</em></h1>' +
      '<p class="welcome-sub">Your progress is saved. Keep going from where you left off.</p>' +
      (profile.sessions.length > 0 ? '<p class="welcome-time">Last session: ' + profile.sessions[profile.sessions.length - 1].date + '</p>' : '');
  } else {
    el.innerHTML =
      '<div class="welcome-icon">🔬</div>' +
      '<h1 class="welcome-title">Welcome to <em>BioMind</em></h1>' +
      '<p class="welcome-sub">Your personal biology tutor — built to make you understand, not just memorize.</p>' +
      '<p class="welcome-time">Just start typing below to begin.</p>';
  }

  container.appendChild(el);
}

// ══════════════════════════════════════════
//  SESSION MANAGEMENT
// ══════════════════════════════════════════

function createNewSession() {
  var id = Date.now();
  var session = {
    id: id,
    title: 'New Session',
    date: new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }),
    history: []
  };
  profile.sessions.push(session);
  currentSessionId = id;
  conversationHistory = [];
  return session;
}

function newSession() {
  createNewSession();

  var container = document.getElementById('messages');
  container.innerHTML = '';

  document.getElementById('sessionTitle').textContent = 'New Session';

  if (profile.name) {
    var greeting = getGreeting(profile.name);
    appendMessage('ai', greeting);
    conversationHistory.push({ role: 'assistant', content: greeting });
  } else {
    showWelcomeScreen();
  }

  updateSidebar();
  saveData();
  document.getElementById('userInput').focus();
}

function loadSessionById(id) {
  var session = profile.sessions.find(function(s) { return s.id === id; });
  if (!session) return;

  currentSessionId = id;
  conversationHistory = session.history || [];

  var container = document.getElementById('messages');
  container.innerHTML = '';

  if (conversationHistory.length === 0) {
    showWelcomeScreen();
  } else {
    conversationHistory.forEach(function(msg) {
      appendMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content, false);
    });
  }

  document.getElementById('sessionTitle').textContent = session.title;
  updateSidebar();
  container.scrollTop = container.scrollHeight;
  document.getElementById('userInput').focus();
}

function deleteSession(e, id) {
  e.stopPropagation();
  profile.sessions = profile.sessions.filter(function(s) { return s.id !== id; });
  if (currentSessionId === id) {
    if (profile.sessions.length > 0) {
      loadSessionById(profile.sessions[profile.sessions.length - 1].id);
    } else {
      newSession();
    }
  }
  saveData();
  updateSidebar();
}

// ══════════════════════════════════════════
//  SEND MESSAGE WITH STREAMING
// ══════════════════════════════════════════

function sendMessage() {
  var input = document.getElementById('userInput');
  var text = input.value.trim();
  if (!text || isWaiting) return;

  if (currentSessionId === null) createNewSession();

  // Clear welcome screen if visible
  var welcome = document.querySelector('.welcome-state');
  if (welcome) welcome.remove();

  input.value = '';
  autoResize(input);

  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  isWaiting = true;
  document.getElementById('sendBtn').disabled = true;

  var container = document.getElementById('messages');
  var msg = document.createElement('div');
  msg.className = 'message ai';

  var avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🧬';

  var bubble = document.createElement('div');
  bubble.className = 'bubble streaming';

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;

  var fullText = '';
  var messages = [{ role: 'system', content: buildSystemPrompt() }].concat(conversationHistory);

  fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GROQ_API_KEY
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      messages: messages
    })
  })
  .then(function(res) {
    if (!res.ok) {
      return res.json().then(function(err) {
        throw new Error(res.status + ': ' + (err.error ? err.error.message : res.statusText));
      });
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();

    function read() {
      return reader.read().then(function(result) {
        if (result.done) return;

        var lines = decoder.decode(result.value, { stream: true }).split('\n');
        lines.forEach(function(line) {
          if (!line.startsWith('data: ')) return;
          var data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            var parsed = JSON.parse(data);
            var token = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
            if (token) {
              fullText += token;
              bubble.innerHTML = renderMarkdown(fullText);
              bubble.classList.add('streaming');
              container.scrollTop = container.scrollHeight;
            }
          } catch(e) {}
        });

        return new Promise(function(resolve) {
          setTimeout(function() { resolve(read()); }, 8);
        });
      });
    }

    return read();
  })
  .then(function() {
    bubble.classList.remove('streaming');
    bubble.innerHTML = renderMarkdown(fullText);

    return injectImages(bubble, fullText);
  })
  .then(function() {
    container.scrollTop = container.scrollHeight;
    conversationHistory.push({ role: 'assistant', content: fullText });

    // Extract biology topics
    var bioTopics = ['cell','mitosis','photosynthesis','respiration','genetics','DNA','enzyme','osmosis','evolution','ecosystem','organ','tissue','bacteria','virus','nutrition'];
    bioTopics.forEach(function(t) {
      if (fullText.toLowerCase().indexOf(t) !== -1 && profile.topics.indexOf(t) === -1) {
        profile.topics.push(t);
      }
    });

    saveData();
    updateSidebar();

    isWaiting = false;
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('userInput').focus();
  })
  .catch(function(err) {
    bubble.classList.remove('streaming');
    bubble.innerHTML = '<p>Something went wrong: ' + err.message + '. Please try again.</p>';
    console.error('BioMind error:', err);
    isWaiting = false;
    document.getElementById('sendBtn').disabled = false;
  });
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

window.addEventListener('load', function() {
  var hasData = loadData();
  updateStudentCard();

  if (hasData && profile.sessions.length > 0) {
    var last = profile.sessions[profile.sessions.length - 1];
    currentSessionId = last.id;
    conversationHistory = last.history || [];

    if (conversationHistory.length > 0) {
      var container = document.getElementById('messages');
      container.innerHTML = '';
      conversationHistory.forEach(function(msg) {
        appendMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content, false);
      });
      var greeting = getGreeting(profile.name || 'there');
      appendMessage('ai', greeting);
      conversationHistory.push({ role: 'assistant', content: greeting });
      saveData();
    } else {
      showWelcomeScreen();
    }
  } else {
    showWelcomeScreen();
  }

  updateSidebar();
  document.getElementById('userInput').focus();
});
