const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 데이터베이스 쿼리 헬퍼
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool
};
