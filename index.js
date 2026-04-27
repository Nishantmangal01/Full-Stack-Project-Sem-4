const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';

const State = (() => {
  let _state = {
    currentUser: null,
    token: null,
    currentView: 'hero',
    currentQuestion: null,
    currentPage: 1,
    totalPages: 1,
    filters: { subject: '', course: '' },
  };

  try {
    const saved = localStorage.getItem('edusphere_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      _state.currentUser = parsed.user;
      _state.token = parsed.token;
    }
  } catch (e) {}

  return {
    get: (key) => _state[key],
    set: (key, val) => { _state[key] = val; },
    getUser: () => _state.currentUser,
    getToken: () => _state.token,
    setSession: (user, token) => {
      _state.currentUser = user;
      _state.token = token;
      try { localStorage.setItem('edusphere_session', JSON.stringify({ user, token })); } catch(e){}
    },
    clearSession: () => {
      _state.currentUser = null;
      _state.token = null;
      try { localStorage.removeItem('edusphere_session'); } catch(e){}
    },
    isLoggedIn: () => !!_state.token,
  };
})();


const Http = {
  async request(method, endpoint, body = null, auth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && State.getToken()) headers['Authorization'] = `Bearer ${State.getToken()}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const res = await fetch(`${API}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },

  get:    (ep, auth = false)      => Http.request('GET',    ep, null, auth),
  post:   (ep, body, auth = false) => Http.request('POST',   ep, body, auth),
  patch:  (ep, body, auth = false) => Http.request('PATCH',  ep, body, auth),
};


const Toast = (() => {
  const el = document.getElementById('toast');
  let timer;

  const config = {
    success: { icon: '\u2705', title: 'Success' },
    error:   { icon: '\u274c', title: 'Error' },
    info:    { icon: '\ud83d\udca1', title: 'Info' },
  };

  return {
    show(msg, type = 'info', duration = 3500) {
      clearTimeout(timer);
      el.classList.remove('hiding');

      const { icon, title } = config[type] || config.info;

      el.className = `toast ${type}`;
      el.innerHTML = `
        <div class="toast-inner">
          <div class="toast-icon">${icon}</div>
          <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${msg}</div>
          </div>
          <button class="toast-close" onclick="Toast.hide()">\u2715</button>
        </div>
        <div class="toast-progress"></div>
      `;
      el.classList.remove('hidden');
      timer = setTimeout(() => this.hide(), duration);
    },

    hide() {
      el.classList.add('hiding');
      setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('hiding');
      }, 350);
    },
  };
})();


const Router = {
  views: {
    hero: document.getElementById('view-hero'),
    feed: document.getElementById('view-feed'),
    trending: document.getElementById('view-trending'),
    ask: document.getElementById('view-ask'),
    detail: document.getElementById('view-detail'),
  },

  show(viewName) {
    Object.values(this.views).forEach(v => v && v.classList.add('hidden'));
    const view = this.views[viewName];
    if (view) {
      view.classList.remove('hidden');
      State.set('currentView', viewName);
    }
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === viewName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};


const Auth = {
  modal:       document.getElementById('auth-modal'),
  tabLogin:    document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),

  openLogin() {
    this.tabLogin.classList.remove('hidden');
    this.tabRegister.classList.add('hidden');
    this.modal.classList.remove('hidden');
  },
  openRegister() {
    this.tabRegister.classList.remove('hidden');
    this.tabLogin.classList.add('hidden');
    this.modal.classList.remove('hidden');
  },
  close() { this.modal.classList.add('hidden'); },

  async login(email, password) {
    const data = await Http.post('/auth/login', { email, password });
    State.setSession(data.user, data.token);
    this.close();
    UI.updateNavAuth();
    Toast.show(`Welcome back, ${data.user.name}!`, 'success');
    return data;
  },

  async register(name, email, password, role) {
    const data = await Http.post('/auth/register', { name, email, password, role });
    State.setSession(data.user, data.token);
    this.close();
    UI.updateNavAuth();
    Toast.show(`Welcome to EduSphere, ${data.user.name}!`, 'success');
    return data;
  },

  logout() {
    State.clearSession();
    UI.updateNavAuth();
    Router.show('feed');
    Toast.show('Logged out successfully.', 'info');
  },
};


const UI = {
  updateNavAuth() {
    const user = State.getUser();
    const navAuth = document.getElementById('nav-auth');
    const navUser = document.getElementById('nav-user');

    if (user) {
      navAuth.classList.add('hidden');
      navUser.classList.remove('hidden');
      document.getElementById('user-greeting').textContent = `Hi, ${user.name.split(' ')[0]}`;
      document.getElementById('user-rep-badge').textContent = `⭐ ${user.reputation || 0}`;
    } else {
      navAuth.classList.remove('hidden');
      navUser.classList.add('hidden');
    }
  },


  showMsg(id, msg, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `form-msg ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  },

  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  escape(str = '') {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};


const Questions = {

  renderCard(q) {
    const totalVotes = (q.answers || []).reduce((sum, a) => sum + (a.votes || 0), 0);
    const card = document.createElement('article');
    card.className = 'question-card';
    card.dataset.id = q._id;

    const authorRole = q.userId?.role === 'faculty' ? `<span class="tag tag-faculty">Faculty</span>` : '';

    card.innerHTML = `
      <div class="vote-col">
        <span class="vote-count">${q.answers?.length || 0}</span>
        <span class="vote-label">Ans</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${UI.escape(q.title)}</h3>
        <p class="card-desc">${UI.escape(q.description)}</p>
        <div class="card-meta">
          <span class="tag tag-subject">${UI.escape(q.subject)}</span>
          <span class="tag tag-course">${UI.escape(q.course)}</span>
          ${authorRole}
          <span class="meta-author">${UI.escape(q.userId?.name || 'Anonymous')} · ${UI.formatDate(q.createdAt)}</span>
        </div>
      </div>
    `;
    return card;
  },


  async loadFeed() {
    const list = document.getElementById('questions-list');
    list.innerHTML = '<div class="loading-state">Loading discussions…</div>';

    const page    = State.get('currentPage');
    const subject = State.get('filters').subject;
    const course  = State.get('filters').course;

    let ep = `/questions?page=${page}&limit=8`;
    if (subject) ep += `&subject=${encodeURIComponent(subject)}`;
    if (course)  ep += `&course=${encodeURIComponent(course)}`;

    try {
      const data = await Http.get(ep);
      State.set('totalPages', data.totalPages || 1);
      list.innerHTML = '';

      if (!data.questions?.length) {
        list.innerHTML = '<div class="empty-state"><h3>No questions yet</h3><p>Be the first to ask something!</p></div>';
        return;
      }

      data.questions.forEach(q => list.appendChild(this.renderCard(q)));
      this.renderPagination();
    } catch (err) {
      list.innerHTML = `<div class="empty-state"><h3>Couldn't load questions</h3><p>${err.message}</p></div>`;
    }
  },

  renderPagination() {
    const pg = document.getElementById('pagination');
    pg.innerHTML = '';
    const total = State.get('totalPages');
    const curr  = State.get('currentPage');
    if (total <= 1) return;

    for (let i = 1; i <= total; i++) {
      const btn = document.createElement('button');
      btn.className = `page-btn${i === curr ? ' active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        State.set('currentPage', i);
        Questions.loadFeed();
      });
      pg.appendChild(btn);
    }
  },

  async loadTrending() {
    const list = document.getElementById('trending-list');
    list.innerHTML = '<div class="loading-state">Calculating trends…</div>';

    try {
      const data = await Http.get('/questions/trending');
      list.innerHTML = '';

      if (!data.questions?.length) {
        list.innerHTML = '<div class="empty-state"><h3>No trending content</h3><p>Start engaging to see trends!</p></div>';
        return;
      }

      data.questions.forEach((q, i) => {
        const card = this.renderCard(q);
        const rankEl = document.createElement('div');
        rankEl.className = `trending-rank${i < 3 ? ' top' : ''}`;
        rankEl.textContent = `#${i + 1}`;
        card.style.position = 'relative';
        card.querySelector('.vote-col').prepend(rankEl);
        list.appendChild(card);
      });
    } catch (err) {
      list.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
    }
  },

  async openDetail(id) {
    Router.show('detail');
    const detailCard = document.getElementById('question-detail-card');
    const answersList = document.getElementById('answers-list');
    detailCard.innerHTML = '<div class="loading-state">Loading…</div>';
    answersList.innerHTML = '';

    try {
      const data = await Http.get(`/questions/${id}`);
      const q = data.question;
      State.set('currentQuestion', q);

      const authorRole = q.userId?.role === 'faculty' ? `<span class="tag tag-faculty">Faculty</span>` : '';
      const totalVotes = (q.answers || []).reduce((s, a) => s + (a.votes || 0), 0);

      detailCard.innerHTML = `
        <div class="detail-header">
          <h1 class="detail-title">${UI.escape(q.title)}</h1>
          <div class="detail-tags">
            <span class="tag tag-subject">${UI.escape(q.subject)}</span>
            <span class="tag tag-course">${UI.escape(q.course)}</span>
            ${authorRole}
          </div>
        </div>
        <p class="detail-body">${UI.escape(q.description)}</p>
        <div class="detail-footer">
          <span class="detail-author">Asked by ${UI.escape(q.userId?.name || 'Anonymous')} · ${UI.formatDate(q.createdAt)}</span>
        </div>
      `;

      document.getElementById('answers-heading').textContent = `${q.answers?.length || 0} Answer${q.answers?.length === 1 ? '' : 's'}`;
      answersList.innerHTML = '';

      if (q.answers?.length) {
        const sorted = [...q.answers].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        sorted.forEach((ans, idx) => {
          const card = document.createElement('div');
          card.className = `answer-card${idx === 0 && ans.votes > 0 ? ' top-answer' : ''}`;
          card.dataset.ansId = ans._id;
          card.innerHTML = `
            <div class="answer-vote-col">
              <button class="ans-vote-btn up" data-ans="${ans._id}" data-vote="1" title="Upvote">▲</button>
              <span class="answer-vote-count" id="av-${ans._id}">${ans.votes || 0}</span>
              <button class="ans-vote-btn down" data-ans="${ans._id}" data-vote="-1" title="Downvote">▼</button>
            </div>
            <div>
              <p class="answer-body">${UI.escape(ans.answer)}</p>
              <span class="answer-meta">
                ${UI.escape(ans.userId?.name || 'Anonymous')}
                ${ans.userId?.role === 'faculty' ? '<span class="tag tag-faculty" style="font-size:0.7rem;padding:1px 6px">Faculty</span>' : ''}
                · ${UI.formatDate(ans.createdAt)}
              </span>
            </div>
          `;
          answersList.appendChild(card);
        });
      } else {
        answersList.innerHTML = '<div class="empty-state"><p>No answers yet. Be the first!</p></div>';
      }

      const wrap = document.getElementById('answer-form-wrap');
      const loginPrompt = document.getElementById('login-prompt-answer');
      if (State.isLoggedIn()) {
        wrap.classList.remove('hidden');
        loginPrompt.classList.add('hidden');
      } else {
        wrap.classList.add('hidden');
        loginPrompt.classList.remove('hidden');
      }

    } catch (err) {
      detailCard.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
    }
  },

  async postQuestion(title, description, subject, course) {
    if (!State.isLoggedIn()) { Auth.openLogin(); throw new Error('Login required'); }
    const data = await Http.post('/questions', { title, description, subject, course }, true);
    return data;
  },

  async voteAnswer(questionId, answerId, vote) {
    if (!State.isLoggedIn()) { Auth.openLogin(); throw new Error('Login required'); }
    const data = await Http.patch(`/questions/${questionId}/answers/${answerId}/vote`, { vote }, true);
    return data;
  },

  async postAnswer(questionId, answer) {
    if (!State.isLoggedIn()) { Auth.openLogin(); throw new Error('Login required'); }
    const data = await Http.post(`/questions/${questionId}/answers`, { answer }, true);
    return data;
  },
};


async function loadStats() {
  try {
    const data = await Http.get('/stats');
    animateCounter('stat-q', data.questions || 0);
    animateCounter('stat-a', data.answers || 0);
    animateCounter('stat-u', data.users || 0);
  } catch (e) {  }
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 30);
}


document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const view = e.currentTarget.dataset.view;
    Router.show(view);
    if (view === 'feed') Questions.loadFeed();
    else if (view === 'trending') Questions.loadTrending();
  });
});

document.querySelector('.nav-brand').addEventListener('click', () => Router.show('hero'));

document.getElementById('hero-explore').addEventListener('click', () => {
  Router.show('feed'); Questions.loadFeed();
});
document.getElementById('hero-ask').addEventListener('click', () => {
  if (!State.isLoggedIn()) { Auth.openLogin(); return; }
  Router.show('ask');
});

document.getElementById('btn-login-nav').addEventListener('click', () => Auth.openLogin());
document.getElementById('btn-register-nav').addEventListener('click', () => Auth.openRegister());
document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

document.getElementById('modal-close').addEventListener('click', () => Auth.close());
document.getElementById('auth-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) Auth.close();
});

document.getElementById('go-register').addEventListener('click', () => Auth.openRegister());
document.getElementById('go-login').addEventListener('click', () => Auth.openLogin());

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { UI.showMsg('login-msg', 'All fields required.'); return; }
  try {
    await Auth.login(email, password);
  } catch (err) {
    UI.showMsg('login-msg', err.message || 'Login failed.');
  }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const role     = document.getElementById('reg-role').value;
  if (!name || !email || !password) { UI.showMsg('reg-msg', 'All fields required.'); return; }
  if (password.length < 6) { UI.showMsg('reg-msg', 'Password must be at least 6 characters.'); return; }
  try {
    await Auth.register(name, email, password, role);
  } catch (err) {
    UI.showMsg('reg-msg', err.message || 'Registration failed.');
  }
});

document.getElementById('question-form').addEventListener('submit', async e => {
  e.preventDefault();
  const title   = document.getElementById('q-title').value.trim();
  const subject = document.getElementById('q-subject').value;
  const course  = document.getElementById('q-course').value.trim();
  const desc    = document.getElementById('q-desc').value.trim();

  if (!title || !subject || !course || !desc) {
    UI.showMsg('ask-msg', 'Please fill all fields.'); return;
  }
  if (title.length < 10) {
    UI.showMsg('ask-msg', 'Title must be at least 10 characters.'); return;
  }

  try {
    await Questions.postQuestion(title, desc, subject, course);
    UI.showMsg('ask-msg', 'Question posted successfully!', 'success');
    document.getElementById('question-form').reset();
    setTimeout(() => { Router.show('feed'); Questions.loadFeed(); }, 1200);
  } catch (err) {
    UI.showMsg('ask-msg', err.message || 'Failed to post question.');
  }
});

document.getElementById('btn-apply-filter').addEventListener('click', () => {
  State.set('filters', {
    subject: document.getElementById('filter-subject').value,
    course:  document.getElementById('filter-course').value,
  });
  State.set('currentPage', 1);
  Questions.loadFeed();
});

document.getElementById('btn-back').addEventListener('click', () => {
  Router.show('feed'); Questions.loadFeed();
});

document.getElementById('answer-form').addEventListener('submit', async e => {
  e.preventDefault();
  const text = document.getElementById('ans-text').value.trim();
  if (!text) { UI.showMsg('ans-msg', 'Answer cannot be empty.'); return; }

  const q = State.get('currentQuestion');
  if (!q) return;

  try {
    await Questions.postAnswer(q._id, text);
    document.getElementById('ans-text').value = '';
    UI.showMsg('ans-msg', 'Answer posted!', 'success');
    setTimeout(() => Questions.openDetail(q._id), 800);
  } catch (err) {
    UI.showMsg('ans-msg', err.message || 'Failed to post answer.');
  }
});

document.getElementById('prompt-login-btn').addEventListener('click', () => Auth.openLogin());


function attachCardDelegation(listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.addEventListener('click', e => {
    const card = e.target.closest('.question-card');
    if (card && card.dataset.id) {
      Questions.openDetail(card.dataset.id);
    }
  });
}
attachCardDelegation('questions-list');
attachCardDelegation('trending-list');

document.getElementById('answers-list').addEventListener('click', async e => {
  const btn = e.target.closest('.ans-vote-btn');
  if (!btn) return;

  const answerId = btn.dataset.ans;
  const vote     = parseInt(btn.dataset.vote, 10);
  const q        = State.get('currentQuestion');
  if (!q || !answerId) return;

  try {
    const data = await Questions.voteAnswer(q._id, answerId, vote);
    const countEl = document.getElementById(`av-${answerId}`);
    if (countEl) countEl.textContent = data.votes ?? countEl.textContent;

    if (data.reputation !== undefined && State.getUser()) {
      const user = State.getUser();
      user.reputation = data.reputation;
      State.setSession(user, State.getToken());
      document.getElementById('user-rep-badge').textContent = `⭐ ${user.reputation}`;
    }

    Toast.show(vote > 0 ? 'Upvoted!' : 'Downvoted!', 'success');
  } catch (err) {
    Toast.show(err.message || 'Vote failed', 'error');
  }
});


(function init() {
  UI.updateNavAuth();
  loadStats();
  Router.show('hero');
})();