import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';

// slug → store_id 매핑 (캐시)
const getStoreBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .single();

  if (error || !store) {
    return null;
  }

  if (store.status !== 'ACTIVE') {
    return null;
  }

  return store;
});

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);

  if (!store) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50" data-store-id={store.id}>
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">{store.name}</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
