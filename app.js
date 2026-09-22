(() => {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const LS = { pass: 'familyBoard.passcode', me: 'familyBoard.me', tab: 'familyBoard.tab' };

  // シンプルなラインSVGアイコン（絵文字の安っぽさを解消）
  const ICONS = {
    home: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    errands: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    returnHome: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    settings: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  };

  const TABS = [
    { key: 'chores', label: 'ホーム', iconSvg: ICONS.home },
    { key: 'errands', label: 'おつかい', iconSvg: ICONS.errands },
    { key: 'home', label: '帰宅', iconSvg: ICONS.returnHome },
    { key: 'settings', label: '設定', iconSvg: ICONS.settings },
  ];
  // tone: 画面上の色分け（home=黄、coming=青、out=白）
  const HOME_STATUSES = [
    { key: '会社', emoji: '🏢', tone: 'out' },
    { key: '帰宅中', emoji: '🚃', tone: 'coming' },
    { key: '帰宅済み', emoji: '🏠', tone: 'home' },
    { key: '外出中', emoji: '🚶', tone: 'out' },
    { key: '遅くなる', emoji: '🌙', tone: 'out' },
    { key: '帰らない', emoji: '🛌', tone: 'out' },
  ];
  const DINNER = ['いる', 'いらない', '未定'];
  const CHORE_ICONS = ['🧹', '🧺', '🍳', '👕', '🛁', '🗑️', '🍽️', '🛒', '🐕', '🪴', '📦', '🛏️', '🪟', '🧴', '🌸'];
  const MEMBER_ICONS = ['🧑', '👦', '👧', '👩', '👨', '👵', '🧓', '👶', '🐱', '🐶', '🐰', '🐻'];
  const POLL_MS = 60 * 1000;
  const EMPTY_ERRAND = { title: '', items: '', budget: '', memo: '' };
  const EMPTY_CHORE = { name: '', icon: '🧹' };
  const EMPTY_MEMBER = { name: '', icon: '👦', trackHome: true };
  const EMPTY_EDIT_ERRAND = { id: '', title: '', items: '', budget: '', memo: '' };

  const state = {
    passcode: load(LS.pass),
    me: load(LS.me),
    tab: 'chores', // 初期画面はホーム画面
    data: null,
    error: '',
    syncingCount: 0, // バックグラウンド同期中カウント
    errandFormOpen: false,
    errandDraft: { ...EMPTY_ERRAND },
    editingErrandId: null, // 編集中の依頼ID
    editErrandDraft: { ...EMPTY_EDIT_ERRAND },
    homeDraft: null,
    choreFormOpen: false,
    choreDraft: { ...EMPTY_CHORE },
    memberFormOpen: false,
    memberDraft: { ...EMPTY_MEMBER },
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
  function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const timeStr = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `${m}/${day} ${timeStr}`;
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
    if (!state.passcode || state.syncingCount > 0) return;
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

  // 画面を先に変えて即時反映（楽観的更新）。スプシの上書きはバックグラウンドでゆっくり追いつかせる。
  function mutate(action, payload, optimistic) {
    const before = structuredClone(state.data);
    if (optimistic && state.data) {
      optimistic(state.data);
      render();
    }
    state.syncingCount++;
    render();

    return api(action, { by: state.me, ...payload })
      .then((data) => {
        state.syncingCount = Math.max(0, state.syncingCount - 1);
        if (state.syncingCount === 0 && data) {
          state.data = data;
        }
        render();
        return true;
      })
      .catch((e) => {
        state.syncingCount = Math.max(0, state.syncingCount - 1);
        if (e.name === 'AuthError') {
          logout('合言葉を入力し直してください');
          return false;
        }
        state.data = before;
        render();
        toast(e.message || '保存に失敗しました');
        return false;
      });
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
            <span class="who-icon" aria-hidden="true">${esc(m.icon || '👤')}</span>${esc(m.name)}
          </button>`).join('')}</div>`
        : '<p class="empty">家族が登録されていません。スプレッドシートの「Members」シートに追加してください。</p>'}
        <button class="link" data-act="logout">合言葉を入れ直す</button>
      </main>`;
  }

  function viewMain() {
    const d = state.data;
    const me = d.members.find((m) => m.name === state.me) || { name: state.me, icon: '👤' };
    let body;
    if (state.tab === 'errands') body = viewErrands();
    else if (state.tab === 'home') body = viewHome();
    else if (state.tab === 'settings') body = viewSettings();
    else body = viewChores();
    return `
      <header class="top">
        <div class="top-row">
          <div>
            <div class="date-sync-row">
              <h1 class="date">${esc(dateLabel(d.today))}</h1>
              <div class="sync-indicator ${state.syncingCount > 0 ? 'is-syncing' : ''}" title="${state.syncingCount > 0 ? 'スプレッドシートと同期中' : '同期完了'}" aria-live="polite">
                <svg class="sync-spinner" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round"></path>
                </svg>
                <span class="sync-text">同期中</span>
              </div>
            </div>
            <p class="brand-sub">家族ボード</p>
          </div>
          <button class="me" data-act="switch-me" aria-label="使う人を切り替える（いま：${esc(me.name)}）">
            <span aria-hidden="true">${esc(me.icon)}</span> ${esc(me.name)}
          </button>
        </div>
        ${state.tab === 'chores' ? `<div class="magnet-board">${homeMagnets()}</div>` : ''}
      </header>
      <main class="panel">${body}</main>
      <nav class="tabs" aria-label="画面の切り替え">${TABS.map((t) => `
        <button class="tab" data-act="tab" data-tab="${t.key}" ${state.tab === t.key ? 'aria-current="page"' : ''}>
          <span class="tab-icon" aria-hidden="true">${t.iconSvg}</span>
          <span class="tab-label">${t.label}</span>
        </button>`).join('')}
      </nav>`;
  }

  // 上部の家族ボード：[名前ボックス] と [状態ボックス] の2分割構成（状態と夕飯を同列表示）
  function homeMagnets() {
    return state.data.home.map((h) => {
      const memberObj = state.data.members.find((m) => m.name === h.member);
      const memberIcon = (memberObj && memberObj.icon) || '👤';
      const st = statusOf(h.status);
      const sub = [h.eta && `${h.eta}着`, h.timestamp && fmtDateTime(h.timestamp)]
        .filter(Boolean).join('・');

      return `
        <div class="home-card-row" data-act="tab" data-tab="home" role="button" tabindex="0">
          <div class="member-box">
            <span class="member-box-icon">${esc(memberIcon)}</span>
            <span class="member-box-name">${esc(h.member)}</span>
          </div>
          <div class="status-box" data-tone="${h.status ? (st ? st.tone : 'out') : 'none'}">
            ${h.status ? `
              <div class="status-box-cols">
                <div class="status-col">
                  <span class="status-col-label">状況</span>
                  <span class="status-col-val"><span class="status-emoji" aria-hidden="true">${st ? st.emoji : '📍'}</span>${esc(h.status)}</span>
                </div>
                <div class="status-col">
                  <span class="status-col-label">夕飯</span>
                  <span class="status-col-val"><span class="status-emoji" aria-hidden="true">🍽️</span>${esc(h.dinner || '未定')}</span>
                </div>
              </div>
              ${sub ? `<div class="status-box-sub">${esc(sub)}</div>` : ''}
            ` : `
              <div class="status-box-empty">今日の状況はまだありません</div>
            `}
          </div>
        </div>`;
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
              ${c.icon ? `<span class="chore-icon" aria-hidden="true">${esc(c.icon)}</span>` : '<span class="chore-icon is-empty" aria-hidden="true"></span>'}
              <span class="chore-body">
                <span class="chore-name">${esc(c.name)}</span>
                ${c.done ? `<span class="chore-meta">${c.by ? esc(c.by) + 'が' : ''}${esc(fmtTime(c.updatedAt))}に完了</span>` : ''}
              </span>
              <span class="dot" aria-hidden="true">${c.done ? esc(c.by ? c.by.slice(0, 3) : '済') : ''}</span>
            </button>
          </li>`).join('')}</ul>`
        : '<p class="empty">家事の項目がありません。「設定」タブから家事を追加してください。</p>'}
        <p class="hint">家事の追加や削除は「設定」タブから行えます。</p>
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
      : '<button class="btn primary wide" data-act="open-errand-form">＋ おつかいを頼む</button>';

    return `
      <section aria-labelledby="h-errands">
        <div class="progress-head">
          <h2 id="h-errands">おつかい</h2>
          <p class="count">今月の支出 <strong class="count-yen">${yen(monthSpent) || '¥0'}</strong></p>
        </div>
        ${form}

        <div class="errands-group">
          <h3 class="errands-section-title">頼まれているおつかい（${open.length}件）</h3>
          ${open.length ? open.map(errandCard).join('') : '<p class="empty">頼まれているおつかいはありません。</p>'}
        </div>

        ${done.length ? `
          <details class="done-list" ${state.doneOpen ? 'open' : ''}>
            <summary>完了したおつかい（最近の${done.length}件）</summary>
            <ul>${done.map((e) => `
              <li>
                <span class="done-title">${esc(e.title)}</span>
                <span class="done-meta">${e.spent !== null ? yen(e.spent) : '金額の記録なし'}${e.budget !== null ? `（予算 ${yen(e.budget)}）` : ''}、${esc(fmtDateTime(e.completedAt))}完了</span>
                <button class="link" data-act="reopen-errand" data-id="${esc(e.id)}">未完了に戻す</button>
              </li>`).join('')}
            </ul>
          </details>` : ''}

        <!-- おつかいの下に家族ボードを配置 -->
        <div class="errands-family-section">
          <h3 class="errands-section-title">家族のいま</h3>
          <div class="magnet-board compact-board">${homeMagnets()}</div>
        </div>
      </section>`;
  }

  function errandCard(e) {
    if (state.editingErrandId === e.id) {
      const f = state.editErrandDraft;
      return `
        <form class="note errand-edit-form" id="errand-edit-form" data-id="${esc(e.id)}" autocomplete="off">
          <h4 class="note-title">おつかいの内容を編集</h4>
          <label>何を頼む？<input name="title" required maxlength="40" value="${esc(f.title)}" placeholder="例：夕飯の買い出し"></label>
          <label>買うもの（1行に1つ）<textarea name="items" rows="4" placeholder="例：たまご&#10;牛乳&#10;玉ねぎ 2個">${esc(f.items)}</textarea></label>
          <label>予算（円・任意）<input name="budget" type="number" inputmode="numeric" min="0" value="${esc(f.budget)}" placeholder="例：2000"></label>
          <label>メモ（任意）<input name="memo" maxlength="100" value="${esc(f.memo)}" placeholder="例：18時までにお願い"></label>
          <div class="actions">
            <button type="button" class="btn" data-act="close-errand-edit">キャンセル</button>
            <button type="submit" class="btn primary">保存する</button>
          </div>
        </form>`;
    }

    const bought = e.items.filter((i) => i.done).length;
    return `
      <article class="note errand">
        <div class="errand-head">
          <h4 class="note-title">${esc(e.title)}</h4>
          <div class="errand-head-right">
            ${e.budget !== null ? `<span class="budget">予算 ${yen(e.budget)}</span>` : ''}
            <button type="button" class="btn-edit" data-act="open-errand-edit" data-id="${esc(e.id)}" aria-label="このおつかいを編集">✏️ 編集</button>
          </div>
        </div>
        <p class="errand-meta">${e.requestedBy ? esc(e.requestedBy) + 'が' : ''}${esc(fmtDateTime(e.createdAt))}に起票</p>
        ${e.items.length ? `
          <p class="items-count">買ったもの ${bought} / ${e.items.length}</p>
          <ul class="items">${e.items.map((it, i) => `
            <li><button class="item${it.done ? ' is-done' : ''}" data-act="toggle-item" data-id="${esc(e.id)}" data-index="${i}" aria-pressed="${it.done}">${esc(it.name)}</button></li>`).join('')}
          </ul>` : ''}
        ${e.memo ? `
          <div class="memo-bubble">
            <span class="memo-bubble-icon" aria-hidden="true">💬</span>
            <div class="memo-bubble-body">
              <span class="memo-bubble-label">ひとことメモ</span>
              <p class="memo-bubble-text">${esc(e.memo)}</p>
            </div>
          </div>` : ''}
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
          <p class="empty">帰宅状況を共有する人が決まっていません。「設定」タブで、その人の帰宅カードを ON にしてください。</p>
        </section>`;
    }

    const mine = tracked.find((h) => h.member === state.me);
    if (mine && (!state.homeDraft || state.homeDraft._member !== state.me)) {
      state.homeDraft = {
        _member: state.me,
        status: mine.status || '',
        eta: mine.eta || '',
        dinner: mine.dinner || '未定',
        note: '',
      };
    }
    const f = state.homeDraft || { status: '', eta: '', dinner: '未定', note: '' };

    return `
      <section aria-labelledby="h-home">
        <h2 id="h-home">帰宅状況</h2>
        ${tracked.map(statusCard).join('')}

        ${mine ? `
          <form id="home-form" class="note">
            <h3 class="note-title">今の状況を更新する（${esc(state.me)}）</h3>

            <div class="choices" role="group" aria-label="今の状況">${HOME_STATUSES.map((s) => `
              <button type="button" class="choice" data-act="home-status" data-value="${s.key}" aria-pressed="${f.status === s.key}">
                <span class="choice-emoji" aria-hidden="true">${s.emoji}</span>${s.key}
              </button>`).join('')}
            </div>

            <label class="time-field-label">到着予定時刻（任意）
              <div class="time-input-wrap">
                <span class="time-icon" aria-hidden="true">🕒</span>
                <input name="eta" type="time" class="time-input" value="${esc(f.eta)}">
                <span class="time-hint ${f.eta ? 'is-hidden' : ''}">-- : --（タップして選択）</span>
              </div>
            </label>

            <p class="field-label" id="dinner-label">夕飯</p>
            <div class="seg" role="group" aria-labelledby="dinner-label">${DINNER.map((v) => `
              <button type="button" class="choice" data-act="home-dinner" data-value="${v}" aria-pressed="${f.dinner === v}">${v}</button>`).join('')}
            </div>
            <label>ひとこと（任意）<input name="note" maxlength="60" value="${esc(f.note)}" placeholder="例：駅に着いたら連絡します"></label>
            <button type="submit" class="btn primary wide" ${f.status ? '' : 'disabled'}>保存</button>
          </form>`
        : `<p class="hint">あなたの帰宅カードは現在「非表示」です。「設定」タブから帰宅カードを ON にすると状況を更新できます。</p>`}
      </section>`;
  }

  function viewSettings() {
    const chores = state.data.chores;
    const members = state.data.members;

    return `
      <section aria-labelledby="h-settings">
        <h2 id="h-settings">設定</h2>

        <!-- 家事の管理 -->
        <div class="setting-card">
          <div class="setting-head">
            <div>
              <h3 class="setting-title">毎日の家事</h3>
              <p class="setting-sub">毎日の家事リストに追加・削除できます</p>
            </div>
            ${state.choreFormOpen ? '' : '<button type="button" class="btn primary btn-sm" data-act="open-chore-form">＋ 追加</button>'}
          </div>

          ${state.choreFormOpen ? viewChoreForm() : ''}

          <ul class="setting-list">
            ${chores.map((c) => `
              <li class="setting-item">
                <span class="setting-icon">${esc(c.icon || '—')}</span>
                <span class="setting-name">${esc(c.name)}</span>
                <button type="button" class="btn-del" data-act="delete-chore" data-id="${esc(c.id)}" data-name="${esc(c.name)}" aria-label="${esc(c.name)}を削除">削除</button>
              </li>`).join('')}
          </ul>
        </div>

        <!-- 帰宅カード・家族の管理 -->
        <div class="setting-card">
          <div class="setting-head">
            <div>
              <h3 class="setting-title">帰宅カード・家族</h3>
              <p class="setting-sub">帰宅カードを ON にすると、帰宅タブや画面上に状況が表示されます</p>
            </div>
            ${state.memberFormOpen ? '' : '<button type="button" class="btn primary btn-sm" data-act="open-member-form">＋ 家族を追加</button>'}
          </div>

          ${state.memberFormOpen ? viewMemberForm() : ''}

          <ul class="setting-list">
            ${members.map((m) => `
              <li class="setting-item">
                <span class="setting-icon">${esc(m.icon || '👤')}</span>
                <span class="setting-name">${esc(m.name)}</span>
                <button type="button" class="btn btn-sm ${m.trackHome ? 'track-on' : 'track-off'}" data-act="toggle-track-home" data-name="${esc(m.name)}" data-track="${!m.trackHome}">
                  帰宅カード: ${m.trackHome ? 'ON' : 'OFF'}
                </button>
                <button type="button" class="btn-del" data-act="delete-member" data-name="${esc(m.name)}" aria-label="${esc(m.name)}を削除">削除</button>
              </li>`).join('')}
          </ul>
        </div>

        <!-- 端末・アカウント操作 -->
        <div class="setting-card">
          <h3 class="setting-title">端末・合言葉</h3>
          <p class="setting-sub">このスマホを使う人の切り替えや、合言葉の入れ直しができます</p>
          <div class="setting-ops">
            <button type="button" class="btn wide" data-act="switch-me">使う人を切り替える（いま：${esc(state.me)}）</button>
            <button type="button" class="link danger" data-act="logout">合言葉を入れ直す（ログアウト）</button>
          </div>
        </div>
      </section>`;
  }

  function viewChoreForm() {
    const f = state.choreDraft;
    return `
      <form id="chore-form" class="note chore-form-box" autocomplete="off">
        <h4 class="note-title">家事を新しく追加</h4>
        <label>家事の名前
          <input name="name" required maxlength="40" placeholder="例：お風呂掃除" value="${esc(f.name)}">
        </label>

        <div class="field-group">
          <p class="field-label">アイコン（絵文字・自由入力または「なし」）</p>
          <div class="icon-input-row">
            <div class="icon-preview">${f.icon ? esc(f.icon) : '<span class="icon-none">なし</span>'}</div>
            <button type="button" class="btn btn-sm ${!f.icon ? 'btn-selected' : ''}" data-act="clear-chore-icon">なしにする</button>
            <input type="text" class="icon-custom-input" id="chore-custom-icon" maxlength="4" placeholder="手入力" value="${esc(f.icon)}">
          </div>
          <div class="emoji-grid" role="group" aria-label="よく使う家事アイコン">
            ${CHORE_ICONS.map((emoji) => `
              <button type="button" class="emoji-btn ${f.icon === emoji ? 'is-selected' : ''}" data-act="pick-chore-icon" data-icon="${emoji}">${emoji}</button>`).join('')}
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn" data-act="close-chore-form">やめる</button>
          <button type="submit" class="btn primary">追加する</button>
        </div>
      </form>`;
  }

  function viewMemberForm() {
    const f = state.memberDraft;
    return `
      <form id="member-form" class="note member-form-box" autocomplete="off">
        <h4 class="note-title">家族を新しく追加</h4>
        <label>名前
          <input name="name" required maxlength="20" placeholder="例：弟" value="${esc(f.name)}">
        </label>

        <div class="field-group">
          <p class="field-label">アイコン（絵文字）</p>
          <div class="icon-input-row">
            <div class="icon-preview">${esc(f.icon || '👤')}</div>
            <input type="text" class="icon-custom-input" id="member-custom-icon" maxlength="4" placeholder="手入力" value="${esc(f.icon)}">
          </div>
          <div class="emoji-grid" role="group" aria-label="家族アイコン候補">
            ${MEMBER_ICONS.map((emoji) => `
              <button type="button" class="emoji-btn ${f.icon === emoji ? 'is-selected' : ''}" data-act="pick-member-icon" data-icon="${emoji}">${emoji}</button>`).join('')}
          </div>
        </div>

        <label class="check-box-label">
          <input type="checkbox" name="trackHome" ${f.trackHome ? 'checked' : ''}>
          <span>帰宅カードを表示する（帰宅状況を共有）</span>
        </label>

        <div class="actions">
          <button type="button" class="btn" data-act="close-member-form">やめる</button>
          <button type="submit" class="btn primary">追加する</button>
        </div>
      </form>`;
  }

  function statusCard(h) {
    const st = statusOf(h.status);
    const memberObj = state.data.members.find((m) => m.name === h.member);
    const memberIcon = (memberObj && memberObj.icon) || '👤';

    return `
      <article class="status-card" data-tone="${h.status ? (st ? st.tone : 'out') : 'none'}">
        <div class="status-card-header">
          <span class="status-card-icon" aria-hidden="true">${esc(memberIcon)}</span>
          <h3 class="status-who">${esc(h.member)}</h3>
        </div>
        ${h.status ? `
          <div class="status-card-grid">
            <div class="status-card-col">
              <span class="status-card-label">状況</span>
              <div class="status-card-val"><span aria-hidden="true">${st ? st.emoji : '📍'}</span> ${esc(h.status)}</div>
            </div>
            <div class="status-card-col">
              <span class="status-card-label">夕飯</span>
              <div class="status-card-val"><span aria-hidden="true">🍽️</span> ${esc(h.dinner || '未定')}</div>
            </div>
          </div>
          ${h.note ? `
            <div class="memo-bubble status-bubble">
              <span class="memo-bubble-icon" aria-hidden="true">💬</span>
              <div class="memo-bubble-body">
                <span class="memo-bubble-label">ひとこと</span>
                <p class="memo-bubble-text">${esc(h.note)}</p>
              </div>
            </div>` : ''}
          <dl class="status-list">
            <div><dt>到着予定</dt><dd>${h.eta ? esc(h.eta) + 'ごろ' : '未定'}</dd></div>
            <div><dt>更新日時</dt><dd>${esc(fmtDateTime(h.timestamp))}</dd></div>
          </dl>` : `
          <p class="status-empty-text">今日の状況はまだありません</p>
        `}
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
      case 'open-errand-edit': {
        const target = state.data.errands.open.find((x) => x.id === id);
        if (!target) return;
        state.editingErrandId = id;
        state.editErrandDraft = {
          id,
          title: target.title || '',
          items: (target.items || []).map((it) => it.name).join('\n'),
          budget: target.budget !== null && target.budget !== undefined ? target.budget : '',
          memo: target.memo || '',
        };
        render();
        document.querySelector('#errand-edit-form input[name="title"]')?.focus();
        break;
      }
      case 'close-errand-edit':
        state.editingErrandId = null;
        render();
        break;
      case 'reopen-errand':
        mutate('reopenErrand', { id }, (d) => {
          const target = d.errands.done.find((x) => x.id === id);
          if (target) {
            d.errands.done = d.errands.done.filter((x) => x.id !== id);
            d.errands.open.unshift({ ...target, status: 'open', spent: null, completedAt: '' });
          }
        });
        break;
      case 'pick-home-target':
        state.homeTargetMember = btn.dataset.member;
        state.homeDraft = null;
        render();
        break;
      case 'open-chore-form':
        state.choreFormOpen = true;
        render();
        document.querySelector('#chore-form input[name="name"]')?.focus();
        break;
      case 'close-chore-form':
        state.choreFormOpen = false;
        render();
        break;
      case 'pick-chore-icon':
        state.choreDraft.icon = btn.dataset.icon;
        render();
        break;
      case 'clear-chore-icon':
        state.choreDraft.icon = '';
        render();
        break;
      case 'delete-chore': {
        const choreName = btn.dataset.name || 'この家事';
        if (!confirm(choreName + ' を削除しますか？')) return;
        mutate('deleteChore', { id }, (d) => {
          d.chores = d.chores.filter((x) => x.id !== id);
        });
        break;
      }
      case 'open-member-form':
        state.memberFormOpen = true;
        render();
        document.querySelector('#member-form input[name="name"]')?.focus();
        break;
      case 'close-member-form':
        state.memberFormOpen = false;
        render();
        break;
      case 'pick-member-icon':
        state.memberDraft.icon = btn.dataset.icon;
        render();
        break;
      case 'toggle-track-home': {
        const name = btn.dataset.name;
        const trackHome = btn.dataset.track === 'true';
        mutate('setMemberTrackHome', { name, trackHome }, (d) => {
          const m = d.members.find((x) => x.name === name);
          if (m) m.trackHome = trackHome;
        });
        break;
      }
      case 'delete-member': {
        const name = btn.dataset.name;
        if (!confirm(name + ' を削除しますか？')) return;
        mutate('deleteMember', { name }, (d) => {
          d.members = d.members.filter((x) => x.name !== name);
        });
        break;
      }
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

    if (submit) submit.disabled = false;

    if (form.id === 'chore-form') {
      const name = String(fd.get('name') || '').trim();
      if (!name) {
        toast('家事の名前を入力してください');
        return;
      }
      const icon = state.choreDraft.icon || '';
      const tempId = 'temp_c_' + Date.now();
      mutate('addChore', { name, icon }, (d) => {
        d.chores.push({
          id: tempId,
          name,
          icon,
          order: d.chores.length + 1,
          done: false,
          by: '',
          updatedAt: '',
        });
      });
      state.choreDraft = { ...EMPTY_CHORE };
      state.choreFormOpen = false;
      render();
      toast('家事を追加しました');
      return;
    }

    if (form.id === 'member-form') {
      const name = String(fd.get('name') || '').trim();
      if (!name) {
        toast('名前を入力してください');
        return;
      }
      const icon = state.memberDraft.icon || '👤';
      const trackHome = fd.get('trackHome') === 'on';
      mutate('addMember', { name, icon, trackHome }, (d) => {
        d.members.push({ name, icon, trackHome });
      });
      state.memberDraft = { ...EMPTY_MEMBER };
      state.memberFormOpen = false;
      render();
      toast('家族を追加しました');
      return;
    }

    if (form.id === 'errand-form') {
      const title = String(fd.get('title') || '').trim();
      if (!title) {
        toast('何を頼むか入力してください');
        return;
      }
      const rawItems = String(fd.get('items') || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const budget = fd.get('budget') === '' ? null : Number(fd.get('budget'));
      const memo = String(fd.get('memo') || '').trim();
      const tempId = 'temp_e_' + Date.now();
      mutate('addErrand', { title, items: rawItems, budget, memo }, (d) => {
        d.errands.open.unshift({
          id: tempId,
          title,
          items: rawItems.map((name) => ({ name, done: false })),
          budget,
          memo,
          requestedBy: state.me,
          status: 'open',
          createdAt: new Date().toISOString(),
        });
      });
      state.errandDraft = { ...EMPTY_ERRAND };
      state.errandFormOpen = false;
      render();
      toast('おつかいを頼みました');
      return;
    }

    if (form.id === 'errand-edit-form') {
      const id = form.dataset.id;
      const title = String(fd.get('title') || '').trim();
      if (!title) {
        toast('何を頼むか入力してください');
        return;
      }
      const rawItems = String(fd.get('items') || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const budget = fd.get('budget') === '' ? null : Number(fd.get('budget'));
      const memo = String(fd.get('memo') || '').trim();
      mutate('updateErrand', { id, title, items: rawItems, budget, memo }, (d) => {
        const target = d.errands.open.find((x) => x.id === id);
        if (target) {
          const oldItems = target.items || [];
          target.title = title;
          target.items = rawItems.map((name) => {
            const match = oldItems.find((it) => it.name === name);
            return { name, done: match ? match.done : false };
          });
          target.budget = budget;
          target.memo = memo;
        }
      });
      state.editingErrandId = null;
      render();
      toast('おつかいを更新しました');
      return;
    }

    if (form.classList.contains('complete')) {
      const id = form.dataset.id;
      const spent = fd.get('spent') === '' ? null : Number(fd.get('spent'));
      mutate('completeErrand', { id, spent }, (d) => {
        const e = d.errands.open.find((x) => x.id === id);
        if (!e) return;
        d.errands.open = d.errands.open.filter((x) => x.id !== id);
        d.errands.done.unshift({ ...e, status: 'done', spent, completedAt: new Date().toISOString() });
      });
      toast('おつかいを完了にしました');
      return;
    }

    if (form.id === 'home-form') {
      const f = state.homeDraft;
      const targetMember = state.me;
      const payload = { member: targetMember, status: f.status, eta: f.eta, dinner: f.dinner, note: f.note.trim() };
      mutate('setHomeStatus', payload, (d) => {
        const h = d.home.find((x) => x.member === targetMember);
        if (h) Object.assign(h, payload, { timestamp: new Date().toISOString() });
      });
      state.homeDraft = null;
      render();
      toast('保存しました');
    }
  });

  // 入力中の内容を覚えておく（画面を描き直しても消えないように）
  $app.addEventListener('input', (ev) => {
    const el = ev.target;
    const form = el.form;
    if (!form) return;
    if (form.id === 'chore-form') {
      if (el.id === 'chore-custom-icon') state.choreDraft.icon = el.value;
      else if (el.name) state.choreDraft[el.name] = el.value;
    }
    if (form.id === 'member-form') {
      if (el.id === 'member-custom-icon') state.memberDraft.icon = el.value;
      else if (el.name) state.memberDraft[el.name] = el.value;
    }
    if (!el.name) return;
    if (form.id === 'errand-form') state.errandDraft[el.name] = el.value;
    if (form.id === 'errand-edit-form') state.editErrandDraft[el.name] = el.value;
    if (form.id === 'home-form' && state.homeDraft) {
      state.homeDraft[el.name] = el.value;
      if (el.name === 'eta') {
        const hint = form.querySelector('.time-hint');
        if (hint) hint.classList.toggle('is-hidden', !!el.value);
      }
    }
  });

  $app.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el && el.name === 'eta' && el.form && el.form.id === 'home-form') {
      if (state.homeDraft) state.homeDraft.eta = el.value;
      const hint = el.form.querySelector('.time-hint');
      if (hint) hint.classList.toggle('is-hidden', !!el.value);
    }
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
