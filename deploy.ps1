# 家族ボード：▶ボタン用のデプロイスクリプト
#
# 次の4つを一度に行う。
#   1. clasp push -f   … ローカルの gas/ を Apps Script に置く
#   2. clasp deploy -i … 公開中のデプロイを更新する（/exec のURLは変わらない）
#   3. git commit      … 変更をコミットする
#   4. git push        … GitHub に反映する（GitHub Pages が自動更新）
#
# 使い方:
#   .\deploy.ps1 "変更メモ"
#
# デプロイIDは deploy.local.json に書く（.gitignore 済みなのでGitには入らない）。

param(
  [string]$Message = ''
)

Set-Location -Path $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = '更新 ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
}

# --- デプロイIDを読む ---
$confPath = Join-Path $PSScriptRoot 'deploy.local.json'
if (-not (Test-Path $confPath)) {
  Write-Host 'deploy.local.json が見つかりません。' -ForegroundColor Red
  Write-Host 'デプロイIDを書いたファイルが必要です（アプリURL.txt に控えてあります）。' -ForegroundColor Red
  exit 1
}
$conf = ConvertFrom-Json ((Get-Content $confPath -Raw -Encoding UTF8))
$deploymentId = $conf.deploymentId
if ([string]::IsNullOrWhiteSpace($deploymentId)) {
  Write-Host 'deploy.local.json の deploymentId が空です。' -ForegroundColor Red
  exit 1
}

# --- 1. コードをサーバーに置く ---
Write-Host ''
Write-Host '[1/4] clasp push … コードを Apps Script に置きます' -ForegroundColor Cyan
clasp push -f
if ($LASTEXITCODE -ne 0) {
  Write-Host 'push に失敗しました。ここで中止します（公開中のアプリは変わっていません）。' -ForegroundColor Red
  exit 1
}

# --- 2. 公開中のデプロイを更新する（URLは変わらない） ---
Write-Host ''
Write-Host '[2/4] clasp deploy … 公開中のURLの中身を差し替えます' -ForegroundColor Cyan
clasp deploy -i $deploymentId -d $Message
if ($LASTEXITCODE -ne 0) {
  Write-Host 'deploy に失敗しました。コードは置かれましたが、公開はまだ古いままです。' -ForegroundColor Red
  exit 1
}

# --- 3. gitコミット ---
Write-Host ''
Write-Host '[3/4] git commit … 変更を記録します' -ForegroundColor Cyan
git add -A
if ([string]::IsNullOrWhiteSpace((git status --porcelain))) {
  Write-Host '変更がなかったので、コミットはしていません。'
} else {
  git commit -m $Message
}

# --- 4. GitHubへ反映 ---
Write-Host ''
Write-Host '[4/4] git push … GitHub（GitHub Pages）に反映します' -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
  Write-Host 'GitHub への push に失敗しました。ネットワーク状態などを確認してください。' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '完了しました。ブラウザは Ctrl + F5 で強制リロードして確認してください。' -ForegroundColor Green
