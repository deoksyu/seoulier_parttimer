import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function StorePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const supabase = await createClient();
  
  // 세션 확인
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/s/${storeSlug}/login`);
  }

  // JWT에서 role 확인
  const role = user.app_metadata?.role;
  const staffId = user.app_metadata?.staff_id;

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">
          안녕하세요! {role === 'staff' ? '직원' : '관리자'}님
        </h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded">
            <p className="text-sm text-gray-600">현재 시간</p>
            <p className="text-2xl font-bold">
              {new Date().toLocaleTimeString('ko-KR', { 
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          {role === 'staff' && (
            <div className="grid grid-cols-2 gap-4">
              <button className="bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 font-semibold">
                🟢 출근하기
              </button>
              <button className="bg-red-600 text-white py-4 rounded-lg hover:bg-red-700 font-semibold">
                🔴 퇴근하기
              </button>
            </div>
          )}

          {role === 'admin' && (
            <div className="space-y-2">
              <a 
                href={`/s/${storeSlug}/admin`}
                className="block bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 text-center font-semibold"
              >
                관리자 대시보드
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">이번 달 근무 현황</h3>
        <p className="text-gray-500">데이터를 불러오는 중...</p>
      </div>
    </div>
  );
}
