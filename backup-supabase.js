const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const now = new Date();
const timestamp = now.toISOString().replace(/:/g, '-').split('.')[0];
const backupFile = path.join(backupDir, `backup_${timestamp}.json`);

console.log('📦 Supabase 백업 시작...');
console.log('백업 파일:', backupFile);

// Check for DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('\n❌ 오류: DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  console.error('\n사용법:');
  console.error('  DATABASE_URL="postgresql://..." node backup-supabase.js');
  console.error('\n또는 .env 파일에 DATABASE_URL을 추가하세요.');
  process.exit(1);
}

console.log('데이터베이스:', databaseUrl.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

const backup = {
  timestamp: now.toISOString(),
  version: '1.0',
  source: 'supabase',
  data: {}
};

const tables = ['users', 'shifts', 'cleaning_tasks', 'daily_cleanings', 'weekly_cleanings'];

async function backupDatabase() {
  try {
    console.log('✅ 데이터베이스 연결 성공\n');
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        backup.data[table] = result.rows;
        console.log(`✅ ${table}: ${result.rows.length}개 레코드 백업`);
      } catch (err) {
        console.log(`⚠️  ${table} 테이블 백업 실패 (테이블이 없을 수 있음):`, err.message);
        backup.data[table] = [];
      }
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
    
    console.log('\n🎉 백업 완료!');
    console.log('파일:', backupFile);
    console.log('\n📊 백업 요약:');
    Object.keys(backup.data).forEach(table => {
      console.log(`  - ${table}: ${backup.data[table].length}개`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 백업 실패:', error.message);
    await pool.end();
    process.exit(1);
  }
}

backupDatabase();
