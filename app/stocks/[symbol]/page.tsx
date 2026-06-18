'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function StockRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const symbol = params?.symbol as string;

  useEffect(() => {
    if (symbol) {
      router.replace(`/stocks/${symbol}/order`);
    } else {
      router.replace('/');
    }
  }, [symbol, router]);

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-black text-zinc-500 font-mono text-xs select-none">
      <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin mr-2" />
      <span>Redirecting...</span>
    </div>
  );
}
