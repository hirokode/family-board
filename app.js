(() => {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const LS = { pass: 'familyBoard.passcode', me: 'familyBoard.me', tab: 'familyBoard.tab' };
  const TABS = [
    { key: 'chores', label: '家事', icon: '🧹' },
    { key: 'errands', label: 'おつかい', icon: '🛒' },
    { key: 'home', label: '帰宅', icon: '🏠' },
  ];
  // tone: 画面上の色分け（home=黄、coming=青、out=白）
  const HOME_STATUSES = [
    { key: '会社', emoji: '🏢', tone: 'out' },
    { key: '帰宅中', emoji: '🚃', tone: 'coming' },
    { key: '帰宅済み', emoji: '🏠', tone: 'home' },
    { key: '外出中', emoji: '🚶', tone: 'out' },
    { key: '遅くなる', emoji: '🌙', tone: 'out' },
  ];
  const DINNER = ['いる', 'いらない', '未定'];
  const POLL_MS = 60 * 1000;
  const EMPTY_ERRAND = { title: '', items: '', budget: '', memo: '' };

  const state = {
    passcode: load(LS.pass),
    me: load(LS.me),
    tab: TABS.some((t) => t.key === load(LS.tab)) ? load(LS.tab) : 'chores',
    data: null,
    error: '',
    errandFormOpen: false,
    errandDraft: { ...EMPTY_ERRAND },
    homeDraft: null,
    doneOpen: false,
  };

  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');

  /* ---------- 小さな道具 ---------- */

  function load(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }
  function save(key, value) {
    try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* 保存できない環境では無視 */ }
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function yen(n) {
    return n === null || n === undefined || n === '' || isNaN(n) ? '' : '¥' + Number(n).toLocaleString('ja-JP');
  }
  function fmtTime(iso) {
    return iso ? new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';
  }
  function ago(iso) {
    if (!iso) return '';
    const min = (Date.now() - new Date(iso).getTime()) / 60000;
    if (min < 1) return 'たった今';
    if (min < 60) return Math.floor(min) + '分前';
    if (min < 60 * 24) return Math.floor(min / 60) + '時間前';
    return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  }
  function dateLabel(ymd) {
    return new Date(ymd + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
  }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $toast.classList.remove('show'), 3200);
  }
  function isEditing() {
    const a = document.activeElement;
    return a && $app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  }
  function statusOf(key) {
    return HOME_STATUSES.find((s) => s.key === key);
  }

  /* ---------- 通信 ---------- */

  async function api(action, payload = {}) {
    if (!CFG.API_URL || CFG.API_URL.startsWith('PASTE_')) {
      throw new Error('config.js に API_URL が設定されていません');
    }
    let res;
    try {
      // Content-Type を付けない（text/plain）ことで、GAS でも CORS の事前確認が起きない
      res = await fetch(CFG.API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, passcode: state.passcode, ...payload }),
      });
    } catch {
      throw new Error('通信できませんでした。電波の状態を確認してください');
    }
    if (!res.ok) throw new Error('サーバーからの応答がありません（' + res.status + '）');
    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.error || 'エラーが発生しました');
      if (json.error === 'AUTH') err.name = 'AuthError';
      throw err;
    }
    return json.data;
  }

  function logout(msg) {
    state.passcode = '';
    state.data = null;
    save(LS.pass, '');
    if (msg) toast(msg);
    render();
  }

  async function login(pass) {
    state.passcode = pass;
    state.error = '';
    render();
    try {
      state.data = await api('bootstrap');
      save(LS.pass, pass);
      render();
    } catch (e) {
      state.passcode = '';
      state.data = null;
      render();
      toast(e.name === 'AuthError' ? '合言葉が違います' : e.message);
    }
  }

  async function refresh(silent) {
    if (!state.passcode) return;
    try {
      const data = await api('bootstrap');
      state.data = data;
      state.error = '';
      if (state.me && !data.members.some((m) => m.name === state.me)) {
        state.me = '';
        save(LS.me, '');
      }
      if (silent && isEditing()) return; // 入力中は画面を描き直さない
      render();
    } catch (e) {
      if (e.name === 'AuthError') return logout('合言葉が変わったようです。もう一度入力してください');
      if (!state.data) {
        state.error = e.message;
        render();
      } else if (!silent) {
        toast(e.message);
      }
    }
  }

  // 画面を先に変えて（楽観的更新）、サーバーの結果で上書きする。失敗したら元に戻す。
  async function mutate(action, payload, optimistic) {
    const before = structuredClone(state.data);
    if (optimistic) {
      optimistic(state.data);
      render();
    }
    try {
      state.data = await api(action, { by: state.me, ...payload });
      render();
      return true;
    } catch (e) {
      state.data = before;
      if (e.name === 'AuthError') {
        logout('合言葉を入力し直してください');
        return false;
      }
      render();
      toast(e.message);
      return false;
    }
  }

  /* ---------- 画面 ---------- */

  function render() {
    let html;
    if (!state.passcode) html = viewGate();
    else if (!state.data) html = state.error ? viewError() : viewLoading();
    else if (!state.me) html = viewWho();
    else html = viewMain();
    $app.innerHTML = html;
  }

  function viewGate() {
    return `
      <main class="gate">
        <h1 class="gate-title">家族ボード</h1>
        <p class="gate-lead">家族で決めた合言葉を入れてください。</p>
        <form id="login-form" class="gate-form">
          <label class="sr-only" for="pass">合言葉</label>
          <input id="pass" name="pass" type="password" autocomplete="current-password" placeholder="合言葉" required>
          <button type="submit" class="btn primary wide">はじめる</button>
        </form>
      </main>`;
  }

  function viewLoading() {
    return `<main class="gate"><p class="gate-lead">読み込んでいます…</p></main>`;
  }

  function viewError() {
    return `
      <main class="gate">
        <h1 class="gate-title">つながりません</h1>
        <p class="gate-lead">${esc(state.error)}</p>
        <button class="btn primary wide" data-act="retry">もう一度読み込む</button>
        <button class="link" data-act="logout">合言葉を入れ直す</button>
      </main>`;
  }

  function viewWho() {
    const members = state.data.members;
    return `
      <main class="gate">
        <h1 class="gate-title">あなたは誰？</h1>
        <p class="gate-lead">この端末を使う人を選んでください。あとから変えられます。</p>
        ${members.length ? `<div class="who-grid">${members.map((m) => `
          <button class="who" data-act="pick-me" data-name="${esc(m.name)}">
            <span class="who-icon" aria-hidden="true">${esc(m.icon)}</span>${esc(m.name)}
          </button>`).join('')}</div>`
        : '<p class="empty">家族が登録されていません。スプレッドシートの「Members」シートに追加してください。</p>'}
        <button class="link" data-act="logout">合言葉を入れ直す</button>
      </main>`;
  }

  function viewMain() {
    const d = state.data;
    const me = d.members.find((m) => m.name === state.me) || { name: state.me, icon: '' };
    const body = state.tab === 'errands' ? viewErrands() : state.tab === 'home' ? viewHome() : viewChores();
    return `
      <header class="top">
        <div class="top-row">
          <div>
            <p class="date">${esc(dateLabel(d.today))}</p>
            <h1 class="brand">家族ボード</h1>
          </div>
          <button class="me" data-act="switch-me" aria-label="使う人を切り替える（いま：${esc(me.name)}）">
            <span aria-hidden="true">${esc(me.icon)}</span> ${esc(me.name)}
          </button>
        </div>
        ${state.tab !== 'home' ? `<div class="magnet-board">${homeMagnets()}</div>` : ''}
      </header>
      <main class="panel">${body}</main>
      <nav class="tabs" aria-label="画面の切り替え">${TABS.map((t) => `
        <button class="tab" data-act="tab" data-tab="${t.key}" ${state.tab === t.key ? 'aria-current="page"' : ''}>
          <span class="tab-icon" aria-hidden="true">${t.icon}</span>${t.label}
        </button>`).join('')}
      </nav>`;
  }

  // 上部の「マグネット」：帰宅状況のひと目表示（タップで帰宅タブへ）
  function homeMagnets() {
    return state.data.home.map((h) => {
      if (!h.status) {
        return `
          <button class="home-magnet" data-tone="none" data-act="tab" data-tab="home">
            <span class="home-emoji" aria-hidden="true">❔</span>
            <span class="home-text"><span class="home-line">${esc(h.member)}の帰宅状況はまだありません</span></span>
          </button>`;
      }
      const st = statusOf(h.status);
      const sub = [h.eta && `${h.eta}ごろ着`, h.dinner && `夕飯${h.dinner}`, `${ago(h.timestamp)}に更新`]
        .filter(Boolean).join('、');
      return `
        <button class="home-magnet" data-tone="${st ? st.tone : 'out'}" data-act="tab" data-tab="home">
          <span class="home-emoji" aria-hidden="true">${st ? st.emoji : '📍'}</span>
          <span class="home-text">
            <span class="home-line">${esc(h.member)}は${esc(h.status)}</span>
            <span class="home-sub">${esc(sub)}</span>
          </span>
        </button>`;
    }).join('');
  }

  function viewChores() {
    const chores = state.data.chores;
    const done = chores.filter((c) => c.done).length;
    const pct = chores.length ? Math.round((done / chores.length) * 100) : 0;
    const allDone = chores.length > 0 && done === chores.length;
    return `
      <section aria-labelledby="h-chores">
        <div class="progress-head">
          <h2 id="h-chores">今日の家事</h2>
          <p class="count"><strong>${done}</strong> / ${chores.length}</p>
        </div>
        <div class="bar" role="progressbar" aria-label="今日の家事の進み具合"
          aria-valuemin="0" aria-valuemax="${chores.length}" aria-valuenow="${done}"><span style="width:${pct}%"></span></div>
        ${allDone ? '<p class="cheer">今日の家事はぜんぶ終わりました。おつかれさま！</p>' : ''}
        ${chores.length ? `<ul class="chores">${chores.map((c) => `
          <li>
            <button class="chore${c.done ? ' is-done' : ''}" data-act="toggle-chore" data-id="${esc(c.id)}" aria-pressed="${c.done}">
              <span class="chore-icon" aria-hidden="true">${esc(c.icon)}</span>
              <span class="chore-body">
                <span class="chore-name">${esc(c.name)}</span>
                ${c.done ? `<span class="chore-meta">${c.by ? esc(c.by) + 'が' : ''}${esc(fmtTime(c.updatedAt))}に完了</span>` : ''}
              </span>
              <span class="dot" aria-hidden="true"></span>
            </button>
          </li>`).join('')}</ul>`
        : '<p class="empty">家事の項目がありません。スプレッドシートの「Chores」シートに追加してください。</p>'}
        <p class="hint">家事の項目は、スプレッドシートの「Chores」シートで追加・変更できます。</p>
      </section>`;
  }

  function viewErrands() {
    const { open, done, monthSpent } = state.data.errands;
    const f = state.errandDraft;
    const form = state.errandFormOpen ? `
      <form class="note" id="errand-form" autocomplete="off">
        <h3 class="note-title">おつかいを頼む</h3>
        <label>何を頼む？<input name="title" required maxlength="40" value="${esc(f.title)}" placeholder="例：夕飯の買い出し"></label>
        <label>買うもの（1行に1つ）<textarea name="items" rows="4" placeholder="例：たまご&#10;牛乳&#10;玉ねぎ 2個">${esc(f.items)}</textarea></label>
        <label>予算（円・任意）<input name="budget" type="number" inputmode="numeric" min="0" value="${esc(f.budget)}" placeholder="例：2000"></label>
        <label>メモ（任意）<input name="memo" maxlength="100" value="${esc(f.memo)}" placeholder="例：18時までにお願い"></label>
        <div class="actions">
          <button type="button" class="btn" data-act="close-errand-form">やめる</button>
          <button type="submit" class="btn primary">頼む</button>
        </div>
      </form>`
      : '<button class="btn primary wide" data-act="open-errand-form">おつかいを頼む</button>';

    return `
      <section aria-labelledby="h-errands">
        <div class="progress-head">
          <h2 id="h-errands">おつかい</h2>
          <p class="count">今月の支出 <strong class="count-yen">${yen(monthSpent) || '¥0'}</strong></p>
        </div>
        ${form}
        ${open.length ? open.map(errandCard).join('') : '<p class="empty">頼まれているおつかいはありません。</p>'}
        ${done.length ? `
          <details class="done-list" ${state.doneOpen ? 'open' : ''}>
            <summary>完了したおつかい（最近の${done.length}件）</summary>
            <ul>${done.map((e) => `
              <li>
                <span class="done-title">${esc(e.title)}</span>
                <span class="done-meta">${e.spent !== null ? yen(e.spent) : '金額の記録なし'}${e.budget !== null ? `（予算 ${yen(e.budget)}）` : ''}、${esc(ago(e.completedAt))}</span>
                <button class="link" data-act="reopen-errand" data-id="${esc(e.id)}">未完了に戻す</button>
              </li>`).join('')}
            </ul>
          </details>` : ''}
      </section>`;
  }

  function errandCard(e) {
    const bought = e.items.filter((i) => i.done).length;
    return `
      <article class="note errand">
        <div class="errand-head">
          <h3 class="note-title">${esc(e.title)}</h3>
          ${e.budget !== null ? `<p class="budget">予算 ${yen(e.budget)}</p>` : ''}
        </div>
        <p class="errand-meta">${e.requestedBy ? esc(e.requestedBy) + 'から、' : ''}${esc(ago(e.createdAt))}</p>
        ${e.items.length ? `
          <p class="items-count">買ったもの ${bought} / ${e.items.length}</p>
          <ul class="items">${e.items.map((it, i) => `
            <li><button class="item${it.done ? ' is-done' : ''}" data-act="toggle-item" data-id="${esc(e.id)}" data-index="${i}" aria-pressed="${it.done}">${esc(it.name)}</button></li>`).join('')}
          </ul>` : ''}
        ${e.memo ? `<p class="memo">${esc(e.memo)}</p>` : ''}
        <form class="complete" data-id="${esc(e.id)}">
          <label>使った金額（円・任意）<input name="spent" type="number" inputmode="numeric" min="0" placeholder="例：1850"></label>
          <button type="submit" class="btn primary">完了にする</button>
        </form>
        <button class="link danger" data-act="delete-errand" data-id="${esc(e.id)}">このおつかいを取り消す</button>
      </article>`;
  }

  function viewHome() {
    const tracked = state.data.home;
    if (!tracked.length) {
      return `
        <section>
          <h2>帰宅状況</h2>
          <p class="empty">帰宅状況を共有する人が決まっていません。スプレッドシートの「Members」シートで、その人の trackHome を TRUE にしてください。</p>
        </section>`;
    }
    const mine = tracked.find((h) => h.member === state.me);
    if (mine && !state.homeDraft) {
      state.homeDraft = { status: mine.status || '', eta: mine.eta || '', dinner: mine.dinner || '未定', note: '' };
    }
    const f = state.homeDraft;
    return `
      <section aria-labelledby="h-home">
        <h2 id="h-home">帰宅状況</h2>
        ${tracked.map(statusCard).join('')}
        ${mine ? `
          <form id="home-form" class="note">
            <h3 class="note-title">今の状況を家族に伝える</h3>
            <div class="choices" role="group" aria-label="今の状況">${HOME_STATUSES.map((s) => `
              <button type="button" class="choice" data-act="home-status" data-value="${s.key}" aria-pressed="${f.status === s.key}">
                <span class="choice-emoji" aria-hidden="true">${s.emoji}</span>${s.key}
              </button>`).join('')}
            </div>
            <label>到着予定（任意）<input name="eta" type="time" value="${esc(f.eta)}"></label>
            <p class="field-label" id="dinner-label">夕飯</p>
            <div class="seg" role="group" aria-labelledby="dinner-label">${DINNER.map((v) => `
              <button type="button" class="choice" data-act="home-dinner" data-value="${v}" aria-pressed="${f.dinner === v}">${v}</button>`).join('')}
            </div>
            <label>ひとこと（任意）<input name="note" maxlength="60" value="${esc(f.note)}" placeholder="例：駅に着いたら連絡します"></label>
            <button type="submit" class="btn primary wide" ${f.status ? '' : 'disabled'}>家族に伝える</button>
          </form>`
        : `<p class="hint">帰宅状況は、${tracked.map((h) => esc(h.member)).join('、')}が自分の端末から更新します。</p>`}
      </section>`;
  }

  function statusCard(h) {
    const st = statusOf(h.status);
    return `
      <article class="status-card" data-tone="${h.status ? (st ? st.tone : 'out') : 'none'}">
        <p class="status-who">${esc(h.member)}</p>
        <p class="status-main"><span aria-hidden="true">${st ? st.emoji : '❔'}</span>${h.status ? esc(h.status) : 'まだ更新がありません'}</p>
        ${h.status ? `
          <dl class="status-list">
            <div><dt>到着予定</dt><dd>${h.eta ? esc(h.eta) + 'ごろ' : '未定'}</dd></div>
            <div><dt>夕飯</dt><dd>${esc(h.dinner || '未定')}</dd></div>
            ${h.note ? `<div><dt>ひとこと</dt><dd>${esc(h.note)}</dd></div>` : ''}
            <div><dt>更新</dt><dd>${esc(fmtTime(h.timestamp))}（${esc(ago(h.timestamp))}）</dd></div>
          </dl>` : ''}
      </article>`;
  }

  /* ---------- 操作 ---------- */

  $app.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const { act, id } = btn.dataset;

    switch (act) {
      case 'retry':
        state.error = '';
        render();
        refresh(false);
        break;
      case 'logout':
        logout();
        break;
      case 'pick-me':
        state.me = btn.dataset.name;
        state.homeDraft = null;
        save(LS.me, state.me);
        render();
        break;
      case 'switch-me':
        state.me = '';
        save(LS.me, '');
        render();
        break;
      case 'tab':
        state.tab = btn.dataset.tab;
        save(LS.tab, state.tab);
        render();
        window.scrollTo(0, 0);
        break;
      case 'toggle-chore': {
        const c = state.data.chores.find((x) => x.id === id);
        if (!c) return;
        const next = !c.done;
        mutate('toggleChore', { choreId: id, done: next }, (d) => {
          const t = d.chores.find((x) => x.id === id);
          t.done = next;
          t.by = next ? state.me : '';
          t.updatedAt = new Date().toISOString();
        });
        break;
      }
      case 'open-errand-form':
        state.errandFormOpen = true;
        render();
        document.querySelector('#errand-form input[name="title"]')?.focus();
        break;
      case 'close-errand-form':
        state.errandFormOpen = false;
        render();
        break;
      case 'toggle-item': {
        const index = Number(btn.dataset.index);
        mutate('toggleErrandItem', { id, index }, (d) => {
          const it = d.errands.open.find((x) => x.id === id)?.items[index];
          if (it) it.done = !it.done;
        });
        break;
      }
      case 'delete-errand':
        if (!confirm('このおつかいを取り消しますか？')) return;
        mutate('deleteErrand', { id }, (d) => {
          d.errands.open = d.errands.open.filter((x) => x.id !== id);
        });
        break;
      case 'reopen-errand':
        mutate('reopenErrand', { id });
        break;
      case 'home-status':
        state.homeDraft.status = btn.dataset.value;
        render();
        break;
      case 'home-dinner':
        state.homeDraft.dinner = btn.dataset.value;
        render();
        break;
    }
  });

  $app.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const submit = form.querySelector('[type="submit"]');
    const fd = new FormData(form);

    if (form.id === 'login-form') {
      const pass = String(fd.get('pass') || '').trim();
      if (pass) login(pass);
      return;
    }

    if (submit) submit.disabled = true;

    if (form.id === 'errand-form') {
      const title = String(fd.get('title') || '').trim();
      if (!title) {
        toast('何を頼むか入力してください');
        if (submit) submit.disabled = false;
        return;
      }
      const ok = await mutate('addErrand', {
        title,
        items: String(fd.get('items') || '').split('\n').map((s) => s.trim()).filter(Boolean),
        budget: fd.get('budget') === '' ? null : Number(fd.get('budget')),
        memo: String(fd.get('memo') || '').trim(),
      });
      if (ok) {
        state.errandDraft = { ...EMPTY_ERRAND };
        state.errandFormOpen = false;
        render();
        toast('おつかいを頼みました');
      }
      return;
    }

    if (form.classList.contains('complete')) {
      const id = form.dataset.id;
      const spent = fd.get('spent') === '' ? null : Number(fd.get('spent'));
      const ok = await mutate('completeErrand', { id, spent }, (d) => {
        const e = d.errands.open.find((x) => x.id === id);
        if (!e) return;
        d.errands.open = d.errands.open.filter((x) => x.id !== id);
        d.errands.done.unshift({ ...e, status: 'done', spent, completedAt: new Date().toISOString() });
      });
      if (ok) toast('おつかいを完了にしました');
      return;
    }

    if (form.id === 'home-form') {
      const f = state.homeDraft;
      const payload = { member: state.me, status: f.status, eta: f.eta, dinner: f.dinner, note: f.note.trim() };
      const ok = await mutate('setHomeStatus', payload, (d) => {
        const h = d.home.find((x) => x.member === state.me);
        if (h) Object.assign(h, payload, { timestamp: new Date().toISOString() });
      });
      if (ok) {
        state.homeDraft = null;
        render();
        toast('家族に伝えました');
      }
    }
  });

  // 入力中の内容を覚えておく（画面を描き直しても消えないように）
  $app.addEventListener('input', (ev) => {
    const el = ev.target;
    const form = el.form;
    if (!form || !el.name) return;
    if (form.id === 'errand-form') state.errandDraft[el.name] = el.value;
    if (form.id === 'home-form' && state.homeDraft) state.homeDraft[el.name] = el.value;
  });

  $app.addEventListener('toggle', (ev) => {
    if (ev.target.classList && ev.target.classList.contains('done-list')) state.doneOpen = ev.target.open;
  }, true);

  /* ---------- 自動更新 ---------- */

  setInterval(() => {
    if (document.visibilityState === 'visible' && state.passcode && state.data) refresh(true);
  }, POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.passcode && state.data) refresh(true);
  });

  render();
  if (state.passcode) refresh(false);
})();
