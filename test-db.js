const { Pool } = require('pg');

// 비밀번호의 특수문자를 URL 인코딩
// ! -> %21
const connectionString = 'postgresql://postgres.fahwwnidgidacrywwmvf:qorudgus12%21@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('데이터베이스 연결 시도 중...');
    
    // 연결 테스트
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공!');
    
    // 사용자 조회
    const result = await client.query('SELECT * FROM users');
    console.log('\n📊 Users 테이블 데이터:');
    console.table(result.rows);
    
    // admin 로그인 테스트
    const loginTest = await client.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      ['admin', 'admin']
    );
    
    if (loginTest.rows.length > 0) {
      console.log('\n✅ Admin 로그인 테스트 성공!');
      console.log('User:', loginTest.rows[0]);
    } else {
      console.log('\n❌ Admin 로그인 테스트 실패!');
    }
    
    client.release();
    pool.end();
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    console.error('상세:', error);
  }
}

testConnection();
