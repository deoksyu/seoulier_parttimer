'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage({
  params,
}: {
  params: { storeSlug: string };
}) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('PIN 4자리를 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Edge Function 호출 (나중에 구현)
      const { data, error: functionError } = await supabase.functions.invoke('pin-login', {
        body: { storeSlug: params.storeSlug, pin }
      });

      if (functionError) {
        throw functionError;
      }

      if (!data.success) {
        setError(data.error === 'INVALID_PIN' ? 'PIN이 올바르지 않습니다' :
                 data.error === 'ACCOUNT_LOCKED' ? '계정이 잠겼습니다. 10분 후 다시 시도해주세요' :
                 data.error === 'STORE_NOT_FOUND' ? '매장을 찾을 수 없습니다' :
                 '로그인에 실패했습니다');
        setPin('');
        return;
      }

      // 로그인 성공
      router.push(`/s/${params.storeSlug}`);
      router.refresh();
    } catch (err) {
      console.error('Login error:', err);
      setError('로그인 중 오류가 발생했습니다');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-8">PIN 로그인</h1>

        {/* PIN 표시 */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
                pin.length > i ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
              }`}
            >
              {pin.length > i ? '●' : ''}
            </div>
          ))}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* PIN 패드 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              onClick={() => handlePinInput(digit.toString())}
              disabled={loading || pin.length >= 4}
              className="h-16 text-2xl font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="h-16 text-lg font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ←
          </button>
          <button
            onClick={() => handlePinInput('0')}
            disabled={loading || pin.length >= 4}
            className="h-16 text-2xl font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || pin.length !== 4}
            className="h-16 text-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : '✓'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500">
          PIN 4자리를 입력해주세요
        </p>
      </div>
    </div>
  );
}
