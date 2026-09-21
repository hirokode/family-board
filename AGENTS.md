# 家族ボード（AGENTS.md：このアプリ専用のルール）

作業前に、共通ルール（ホームフォルダの ai-rules/CODING_RULES.md）も必ず読むこと。
このファイルには「このアプリにしか当てはまらないこと」だけを書く。

## アプリの概要

家族で使うスマホ向けWebアプリ。できることは3つ。

- 家事：その日の家事をタップで完了／未完了に切り替える（日付が変わると自動でリセット）
- おつかい：頼みたい買い物を、買うもの・予算・メモつきで登録。品目ごとに「買った」をチェック、完了時に使った金額を記録
- 帰宅：兄の帰宅状況（会社／帰宅中／帰宅済み など）、到着予定、夕飯の要否を家族に共有

## 構成

```
スマホのブラウザ ── GitHub Pages（index.html など：公開リポジトリ）
                      │ POST（合言葉つき）
                      ▼
               GAS Webアプリ（gas/Code.gs）
                      │
                      ▼
               スプレッドシート（データの保存先）
```

- 画面（フロント）は GitHub Pages で公開する。コードは誰でも見られる前提で書く。
- データはスプレッドシートにだけ置く。GAS は合言葉が一致したリクエストにだけ応答する。

## ファイル構成

| ファイル | 役割 |
|---|---|
| index.html | 画面の骨組み（中身は app.js が描画） |
| style.css | 見た目（冷蔵庫のマグネットボード風。ライト／ダーク対応） |
| app.js | 画面の描画、操作、GAS との通信、60秒ごとの自動更新 |
| config.js | GAS WebアプリのURL（API_URL）だけを書く |
| gas/Code.gs | API本体（シートの自動作成、各操作） |
| gas/appsscript.json | GASの設定（タイムゾーン、Webアプリの公開設定） |

## スプレッドシートの構成（初回アクセス時に自動作成）

| シート | 列 | メモ |
|---|---|---|
| Members | name, icon, trackHome | 家族の一覧。trackHome=TRUE の人の帰宅状況を共有する |
| Chores | id, name, icon, order, active | 毎日の家事の一覧。active=FALSE で非表示 |
| ChoreLog | date, choreId, done, by, updatedAt | 日付×家事ごとの完了記録 |
| Errands | id, createdAt, title, itemsJson, budget, memo, requestedBy, status, spent, completedAt | おつかい。status は open / done |
| HomeStatus | timestamp, member, status, eta, dinner, note | 帰宅状況の履歴（最新行が現在の状況） |

家族の実名や家事の中身は、スプレッドシート上で編集する（コードには見本名しか書かない）。

## API（gas/Code.gs）

すべて `POST`。本文は JSON 文字列で `{ action, passcode, ...}`。
フロントからは Content-Type を付けずに送る（CORS の事前確認を避けるため）。
更新系はすべて、最新の全データ（bootstrap と同じ形）を返す。

| action | 主な引数 | 内容 |
|---|---|---|
| bootstrap | なし | 今日の家事、おつかい、帰宅状況、家族一覧をまとめて返す |
| toggleChore | choreId, done, by | 今日の家事の完了を切り替える |
| addErrand | title, items[], budget, memo, by | おつかいを追加 |
| toggleErrandItem | id, index | 品目の「買った」を切り替える |
| completeErrand | id, spent | おつかいを完了にする |
| reopenErrand | id | 完了を取り消す |
| deleteErrand | id | おつかいを削除 |
| setHomeStatus | member, status, eta, dinner, note | 帰宅状況を更新（trackHome=TRUE の人のみ） |

合言葉が違うときは `{ ok: false, error: "AUTH" }` を返し、フロントは合言葉の入力画面に戻る。

## デプロイ

- GAS：`clasp push` のあと、既存のデプロイを更新する（URL を変えないこと。新規デプロイを作ると config.js の URL が変わってしまう）。
- 画面：GitHub に push すると GitHub Pages に反映される（GitHub 接続後に設定予定）。

### ▶ボタン（deploy.ps1）

`deploy.ps1` が「push →  既存デプロイの更新 → git コミット」をまとめて行う。
変更メモはそのままコミットメッセージとデプロイの説明になる。

```bash
cd "C:\Users\hiro2\OneDrive\04_Claude Code\家族\family-board"; .\deploy.ps1 "変更メモ"
```

中でやっていること。

| 順番 | コマンド | 内容 |
|---|---|---|
| 1 | `clasp push -f` | ローカルの `gas/` を Apps Script に置く |
| 2 | `clasp deploy -i <デプロイID> -d "<変更メモ>"` | 公開中のデプロイを更新する（`/exec` の URL は変わらない） |
| 3 | `git add -A` → `git commit` | 変更をコミットする（変更がなければ何もしない） |

- 途中で失敗したら、そこで止まる（push に失敗したら deploy はしない）。
- **デプロイIDは `deploy.local.json` に書く。** このファイルは `.gitignore` 済みでGitには入らない。
  中身は `{ "deploymentId": "<デプロイID>" }` の1行だけ。値は `アプリURL.txt` に控えてある。
- `clasp` は v2 系（2.4.2）を前提にしたコマンドの書き方。
- GitHub への push は、GitHub 接続後にこの仕組みへ追加する。
- 実行後はブラウザを `Ctrl + F5` で強制リロードして確認する。

## このアプリ固有のルール

- 合言葉（スクリプト プロパティ FAMILY_PASSCODE）は、コードにもコミットにも書かない。
- `.clasp.json`（スクリプトID）はコミットしない（.gitignore 済み）。
- スプレッドシート・スクリプト・デプロイのID／URLは `アプリURL.txt` と `deploy.local.json` にだけ書く（どちらも .gitignore 済み）。
- 家族の実名・生活パターンがわかる情報をコードやコミットメッセージに書かない（公開リポジトリのため）。
- シートの列を増やすときは、SHEETS の headers と、既存シートの見出し行の両方を更新する。
- 変更後は、家事の切り替え・おつかい登録・帰宅状況の更新が動くことをスマホ幅で確認する。
