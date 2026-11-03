import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/dust.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

// 확장자별 Content-Type 매핑
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

// HTTP 서버 생성
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // Vercel 서버리스 함수 라우트 (/api/dust)
  if (parsedUrl.pathname === '/api/dust') {
    const query = Object.fromEntries(parsedUrl.searchParams.entries());
    const mockReq = {
      method: req.method,
      query: query,
      headers: req.headers
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.writeHead(this.statusCode, this.headers);
        res.end(JSON.stringify(data));
      }
    };
    return handler(mockReq, mockRes);
  }

  // 정적 파일 서빙
  const safePath = parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname.replace(/^\//, '');
  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

// 서버 실행
server.listen(PORT, () => {
  console.log(`로컬 서버가 실행되었습니다: http://localhost:${PORT}`);
});

