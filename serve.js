// ローカル確認用の簡易サーバー（Node だけで動く。インストール不要）
//
//   node serve.js
//   → http://localhost:5500 をブラウザで開く
//
// GitHub Pages と同じく「フォルダをそのまま配る」だけのサーバー。
// 止めるときはターミナルで Ctrl + C。

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 5500;
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);

    // ROOT の外は見せない
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('403');
      return;
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('見つかりません: ' + rel);
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        // 直したのに変わらない、を防ぐ
        'Cache-Control': 'no-store',
      });
      res.end(body);
    });
  })
  .listen(PORT, () => {
    console.log('家族ボードをローカルで開けます → http://localhost:' + PORT);
    console.log('止めるときは Ctrl + C');
  });
