import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function SuperAdminPage() {
  const supabase = await createClient();
  
  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/sa/login');
  }

  // 슈퍼 관리자 권한 확인
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!superAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600">슈퍼 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  // 매장 목록 조회
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">슈퍼 관리자 콘솔</h1>
          <p className="text-gray-600">전체 매장을 관리합니다</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">매장 목록</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              + 매장 추가
            </button>
          </div>

          {stores && stores.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">매장명</th>
                    <th className="text-left py-3 px-4">Slug</th>
                    <th className="text-left py-3 px-4">플랜</th>
                    <th className="text-left py-3 px-4">상태</th>
                    <th className="text-left py-3 px-4">생성일</th>
                    <th className="text-left py-3 px-4">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr key={store.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{store.name}</td>
                      <td className="py-3 px-4 text-gray-600">{store.slug}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          store.plan === 'PRO' ? 'bg-purple-100 text-purple-800' :
                          store.plan === 'TRIAL' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {store.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          store.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {store.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(store.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="py-3 px-4">
                        <a 
                          href={`/s/${store.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          열기
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              등록된 매장이 없습니다
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">총 매장 수</h3>
            <p className="text-3xl font-bold text-blue-600">{stores?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">활성 매장</h3>
            <p className="text-3xl font-bold text-green-600">
              {stores?.filter(s => s.status === 'ACTIVE').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">정지된 매장</h3>
            <p className="text-3xl font-bold text-red-600">
              {stores?.filter(s => s.status === 'SUSPENDED').length || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
