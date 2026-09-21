/**
 * 家族ボード API（スプレッドシートにバインドされた Google Apps Script）
 *
 * フロント（GitHub Pages の index.html）から POST で呼ばれる JSON API です。
 * - すべてのリクエストに合言葉（passcode）が必要です。
 *   合言葉は「プロジェクトの設定 > スクリプト プロパティ」の FAMILY_PASSCODE に保存します。
 *   （公開リポジトリなので、合言葉をコードに書かないこと）
 * - 更新系の操作は、最新の全データ（bootstrap と同じ形）を返します。
 */

const TZ = 'Asia/Tokyo';
const PASSCODE_KEY = 'FAMILY_PASSCODE';
const DINNER_OPTIONS = ['いる', 'いらない', '未定'];

// textCols: 文字列のまま保存したい列（1始まり）。日付や時刻への自動変換を防ぐ。
const SHEETS = {
  members: { name: 'Members', headers: ['name', 'icon', 'trackHome'], textCols: [] },
  chores: { name: 'Chores', headers: ['id', 'name', 'icon', 'order', 'active'], textCols: [1] },
  choreLog: { name: 'ChoreLog', headers: ['date', 'choreId', 'done', 'by', 'updatedAt'], textCols: [1, 2] },
  errands: {
    name: 'Errands',
    headers: ['id', 'createdAt', 'title', 'itemsJson', 'budget', 'memo', 'requestedBy', 'status', 'spent', 'completedAt'],
    textCols: [1, 4],
  },
  home: { name: 'HomeStatus', headers: ['timestamp', 'member', 'status', 'eta', 'dinner', 'note'], textCols: [4] },
};

// 初回だけ入る見本データ。スプレッドシート上で自由に書き換えてOK。
// 公開リポジトリなので、家族の実名はここではなくスプレッドシートに書く。
const SEED = {
  Members: [
    ['兄', '🧑', true],
    ['弟', '👦', true],
    ['家族A', '👩', false],
    ['家族B', '👨', false],
  ],
  Chores: [
    ['c1', '朝ごはんの片付け', '🍳', 1, true],
    ['c2', '洗濯', '👕', 2, true],
    ['c3', '洗濯物をたたむ', '🧺', 3, true],
    ['c4', '掃除機', '🧹', 4, true],
    ['c5', 'お風呂掃除', '🛁', 5, true],
    ['c6', 'ゴミ出し', '🗑️', 6, true],
    ['c7', '夕飯の準備', '🍲', 7, true],
    ['c8', '夕飯の片付け', '🍽️', 8, true],
  ],
};

const ACTIONS = {
  bootstrap: function () { return bootstrap_(); },
  toggleChore: toggleChore_,
  addChore: addChore_,
  deleteChore: deleteChore_,
  addErrand: addErrand_,
  toggleErrandItem: toggleErrandItem_,
  completeErrand: completeErrand_,
  reopenErrand: reopenErrand_,
  deleteErrand: deleteErrand_,
  setHomeStatus: setHomeStatus_,
  setMemberTrackHome: setMemberTrackHome_,
  addMember: addMember_,
  deleteMember: deleteMember_,
};

/* ========== 入口 ========== */

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'リクエストの形式が正しくありません' });
  }
  try {
    checkPasscode_(req.passcode);
    ensureSheets_();
    const handler = ACTIONS[req.action];
    if (!handler) throw new Error('不明な操作です: ' + req.action);
    return json_({ ok: true, data: handler(req) });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function doGet() {
  return json_({ ok: true, data: { message: '家族ボードAPIは動いています' } });
}

/**
 * 初回に Apps Script エディタから1回だけ実行する（権限の許可とシート作成）。
 */
function setup() {
  ensureSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['シート1', 'Sheet1'].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
  const hasPass = !!PropertiesService.getScriptProperties().getProperty(PASSCODE_KEY);
  Logger.log(hasPass
    ? '準備完了です。'
    : 'シートを用意しました。次に、スクリプト プロパティに ' + PASSCODE_KEY + '（家族の合言葉）を追加してください。');
}

/* ========== 各操作 ========== */

function bootstrap_() {
  ensureDefaultMembers_();
  const today = today_();
  const members = readRows_(SHEETS.members)
    .filter(function (r) { return String(r.name).trim(); })
    .map(function (r) {
      return { name: String(r.name).trim(), icon: String(r.icon || ''), trackHome: bool_(r.trackHome) };
    });
  return {
    today: today,
    members: members,
    chores: choresFor_(today),
    errands: errands_(),
    home: homeFor_(members),
  };
}

function ensureDefaultMembers_() {
  const sh = sheet_(SHEETS.members);
  if (!sh) return;
  const rows = readRows_(SHEETS.members);
  
  const brother = rows.filter(function (r) { return String(r.name).trim() === '弟'; })[0];
  if (!brother) {
    withLock_(function () {
      sh.appendRow([cell_('弟'), cell_('👦'), true]);
    });
  } else {
    if (!brother.icon || brother.icon === '👤') {
      sh.getRange(brother._row, 2).setValue(cell_('👦'));
    }
    if (!bool_(brother.trackHome)) {
      sh.getRange(brother._row, 3).setValue(true);
    }
  }

  const brotherBig = rows.filter(function (r) { return String(r.name).trim() === '兄'; })[0];
  if (!brotherBig && rows.length === 0) {
    withLock_(function () {
      sh.appendRow([cell_('兄'), cell_('🧑'), true]);
    });
  }
}

function toggleChore_(req) {
  const choreId = text_(req.choreId, 40);
  if (!choreId) throw new Error('家事が指定されていません');
  const done = req.done === true;
  const by = member_(req.by);
  withLock_(function () {
    const today = today_();
    const hit = readRows_(SHEETS.choreLog).filter(function (r) {
      return dateKey_(r.date) === today && String(r.choreId) === choreId;
    })[0];
    const row = [today, choreId, done, done ? by : '', new Date()];
    const sh = sheet_(SHEETS.choreLog);
    if (hit) sh.getRange(hit._row, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
  });
  return bootstrap_();
}

function addChore_(req) {
  const name = text_(req.name, 40);
  if (!name) throw new Error('家事の名前を入力してください');
  const icon = text_(req.icon, 10);
  withLock_(function () {
    const rows = readRows_(SHEETS.chores);
    let maxOrder = 0;
    rows.forEach(function (r) {
      const ord = Number(r.order) || 0;
      if (ord > maxOrder) maxOrder = ord;
    });
    const id = 'c' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    sheet_(SHEETS.chores).appendRow([id, cell_(name), cell_(icon), maxOrder + 1, true]);
  });
  return bootstrap_();
}

function deleteChore_(req) {
  const choreId = text_(req.id || req.choreId, 40);
  if (!choreId) throw new Error('削除する家事が指定されていません');
  withLock_(function () {
    const hit = readRows_(SHEETS.chores).filter(function (r) { return String(r.id) === choreId; })[0];
    if (!hit) throw new Error('家事が見つかりませんでした');
    sheet_(SHEETS.chores).deleteRow(hit._row);
  });
  return bootstrap_();
}

function addErrand_(req) {
  const title = text_(req.title, 40);
  if (!title) throw new Error('何を頼むか入力してください');
  const items = (Array.isArray(req.items) ? req.items : [])
    .map(function (s) { return text_(s, 40); })
    .filter(Boolean)
    .slice(0, 50)
    .map(function (name) { return { name: name, done: false }; });
  const budget = num_(req.budget);
  withLock_(function () {
    sheet_(SHEETS.errands).appendRow([
      'e' + Utilities.getUuid().replace(/-/g, '').slice(0, 8),
      new Date(),
      cell_(title),
      JSON.stringify(items),
      budget === null ? '' : Math.max(0, Math.round(budget)),
      cell_(text_(req.memo, 100)),
      member_(req.by),
      'open',
      '',
      '',
    ]);
  });
  return bootstrap_();
}

function toggleErrandItem_(req) {
  withLock_(function () {
    const e = findErrand_(req.id);
    const items = items_(e.itemsJson);
    const i = Number(req.index);
    if (!items[i]) throw new Error('品目が見つかりません。画面を更新してください');
    items[i].done = !items[i].done;
    sheet_(SHEETS.errands).getRange(e._row, 4).setValue(JSON.stringify(items));
  });
  return bootstrap_();
}

function completeErrand_(req) {
  const spent = num_(req.spent);
  withLock_(function () {
    const e = findErrand_(req.id);
    sheet_(SHEETS.errands).getRange(e._row, 8, 1, 3)
      .setValues([['done', spent === null ? '' : Math.max(0, Math.round(spent)), new Date()]]);
  });
  return bootstrap_();
}

function reopenErrand_(req) {
  withLock_(function () {
    const e = findErrand_(req.id);
    sheet_(SHEETS.errands).getRange(e._row, 8, 1, 3).setValues([['open', e.spent, '']]);
  });
  return bootstrap_();
}

function deleteErrand_(req) {
  withLock_(function () {
    const e = findErrand_(req.id);
    sheet_(SHEETS.errands).deleteRow(e._row);
  });
  return bootstrap_();
}

function setHomeStatus_(req) {
  const member = member_(req.member);
  const tracked = readRows_(SHEETS.members).some(function (r) {
    return String(r.name).trim() === member && bool_(r.trackHome);
  });
  if (!member || !tracked) throw new Error('この人の帰宅状況は共有の対象になっていません');
  const status = text_(req.status, 20);
  if (!status) throw new Error('今の状況を選んでください');
  const eta = /^\d{1,2}:\d{2}$/.test(String(req.eta || '')) ? String(req.eta) : '';
  const dinner = DINNER_OPTIONS.indexOf(req.dinner) >= 0 ? req.dinner : '未定';
  withLock_(function () {
    sheet_(SHEETS.home).appendRow([new Date(), member, cell_(status), eta, dinner, cell_(text_(req.note, 60))]);
  });
  return bootstrap_();
}

function setMemberTrackHome_(req) {
  const memberName = text_(req.name, 20);
  if (!memberName) throw new Error('メンバー名が指定されていません');
  const track = req.trackHome === true;
  withLock_(function () {
    const hit = readRows_(SHEETS.members).filter(function (r) {
      return String(r.name).trim() === memberName;
    })[0];
    if (!hit) throw new Error('メンバーが見つかりませんでした');
    // Membersシートの列は name(1), icon(2), trackHome(3)
    sheet_(SHEETS.members).getRange(hit._row, 3).setValue(track);
  });
  return bootstrap_();
}

function addMember_(req) {
  const name = text_(req.name, 20);
  if (!name) throw new Error('名前を入力してください');
  const icon = text_(req.icon, 10) || '👤';
  const track = req.trackHome === true;
  withLock_(function () {
    const exists = readRows_(SHEETS.members).some(function (r) {
      return String(r.name).trim() === name;
    });
    if (exists) throw new Error('同じ名前の家族がすでに登録されています');
    sheet_(SHEETS.members).appendRow([cell_(name), cell_(icon), track]);
  });
  return bootstrap_();
}

function deleteMember_(req) {
  const name = text_(req.name, 20);
  if (!name) throw new Error('削除するメンバーを指定してください');
  withLock_(function () {
    const hit = readRows_(SHEETS.members).filter(function (r) {
      return String(r.name).trim() === name;
    })[0];
    if (!hit) throw new Error('メンバーが見つかりませんでした');
    sheet_(SHEETS.members).deleteRow(hit._row);
  });
  return bootstrap_();
}

/* ========== データの組み立て ========== */

function choresFor_(date) {
  const logs = {};
  readRows_(SHEETS.choreLog).forEach(function (r) {
    if (dateKey_(r.date) === date) logs[String(r.choreId)] = r;
  });
  return readRows_(SHEETS.chores)
    .filter(function (r) {
      const off = r.active === false || String(r.active).toUpperCase() === 'FALSE';
      return String(r.id).trim() && !off;
    })
    .sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999); })
    .map(function (r) {
      const log = logs[String(r.id)];
      const done = log ? bool_(log.done) : false;
      return {
        id: String(r.id),
        name: String(r.name),
        icon: String(r.icon || ''),
        done: done,
        by: done ? String(log.by || '') : '',
        updatedAt: done ? iso_(log.updatedAt) : null,
      };
    });
}

function errands_() {
  const monthKey = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  const list = readRows_(SHEETS.errands)
    .filter(function (r) { return String(r.id).trim(); })
    .map(function (r) {
      return {
        id: String(r.id),
        createdAt: iso_(r.createdAt),
        title: String(r.title || ''),
        items: items_(r.itemsJson),
        budget: num_(r.budget),
        memo: String(r.memo || ''),
        requestedBy: String(r.requestedBy || ''),
        status: String(r.status || 'open'),
        spent: num_(r.spent),
        completedAt: iso_(r.completedAt),
      };
    });
  const newestFirst = function (key) {
    return function (a, b) { return String(b[key] || '').localeCompare(String(a[key] || '')); };
  };
  const done = list.filter(function (e) { return e.status === 'done'; });
  const monthSpent = done
    .filter(function (e) {
      return e.completedAt && Utilities.formatDate(new Date(e.completedAt), TZ, 'yyyy-MM') === monthKey;
    })
    .reduce(function (sum, e) { return sum + (e.spent || 0); }, 0);
  return {
    open: list.filter(function (e) { return e.status !== 'done'; }).sort(newestFirst('createdAt')),
    done: done.sort(newestFirst('completedAt')).slice(0, 10),
    monthSpent: monthSpent,
  };
}

function homeFor_(members) {
  const tracked = members.filter(function (m) { return m.trackHome; }).map(function (m) { return m.name; });
  if (!tracked.length) return [];
  const rows = readRows_(SHEETS.home);
  return tracked.map(function (name) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (String(r.member) === name) {
        return {
          member: name,
          status: String(r.status || ''),
          eta: timeText_(r.eta),
          dinner: String(r.dinner || ''),
          note: String(r.note || ''),
          timestamp: iso_(r.timestamp),
        };
      }
    }
    return { member: name, status: '', eta: '', dinner: '', note: '', timestamp: null };
  });
}

/* ========== シート操作 ========== */

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    const def = SHEETS[key];
    if (ss.getSheetByName(def.name)) return;
    const sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    def.textCols.forEach(function (c) { sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); });
    const seed = SEED[def.name];
    if (seed) sh.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
  });
}

function sheet_(def) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.name);
}

function readRows_(def) {
  const values = sheet_(def).getDataRange().getValues();
  const headers = values.shift() || [];
  return values.map(function (row, i) {
    const obj = { _row: i + 2 };
    headers.forEach(function (h, j) { obj[h] = row[j]; });
    return obj;
  });
}

function findErrand_(id) {
  const hit = readRows_(SHEETS.errands).filter(function (r) { return String(r.id) === String(id); })[0];
  if (!hit) throw new Error('このおつかいは見つかりませんでした。画面を更新してください');
  return hit;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ========== 小さな道具 ========== */

function checkPasscode_(passcode) {
  const expected = PropertiesService.getScriptProperties().getProperty(PASSCODE_KEY);
  if (!expected) throw new Error('サーバー側で合言葉が設定されていません（スクリプト プロパティ ' + PASSCODE_KEY + '）');
  if (String(passcode || '') !== expected) throw new Error('AUTH');
}

function member_(name) {
  const n = text_(name, 20);
  const ok = readRows_(SHEETS.members).some(function (r) { return String(r.name).trim() === n; });
  return ok ? n : '';
}

function items_(json) {
  try {
    const arr = JSON.parse(String(json || '[]'));
    return Array.isArray(arr)
      ? arr.map(function (it) { return { name: String(it.name || ''), done: it.done === true }; })
      : [];
  } catch (err) {
    return [];
  }
}

function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function dateKey_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || ''); }
function timeText_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'HH:mm') : String(v || ''); }
function iso_(v) { return v instanceof Date ? v.toISOString() : (v ? String(v) : null); }
function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function num_(v) {
  return v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v);
}
function text_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 100);
}
// 「=」などで始まる文字がスプレッドシートの数式として解釈されないようにする
function cell_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
