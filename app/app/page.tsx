export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4 text-gray-900">Worklog</h1>
        <p className="text-xl text-gray-600 mb-8">멀티테넌트 근태 관리 시스템</p>
        
        <div className="space-y-4">
          <a
            href="/sa"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-semibold transition"
          >
            슈퍼 관리자 콘솔
          </a>
          
          <div className="text-sm text-gray-500">
            <p>매장 접속: /s/[매장-slug]</p>
          </div>
        </div>
      </div>
    </div>
  );
}
