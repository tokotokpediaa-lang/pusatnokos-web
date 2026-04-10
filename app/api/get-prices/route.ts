import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // 1. Ambil nama produk dari URL (misal: /api/get-prices?product=telegram)
    // Jika tidak ada nama yang dikirim, defaultnya mencari 'whatsapp'
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product') || 'whatsapp';

    // 2. Tembak API Guest 5SIM (Aman tanpa API Key)
    const res = await fetch(`https://5sim.net/v1/guest/prices?product=${product}`, {
      next: { revalidate: 300 } // Cache 5 menit (300 detik) agar web tidak lemot
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, message: 'Gagal menghubungi 5SIM' });
    }

    const data = await res.json();

    // 3. Pastikan data produk ada di server 5SIM
    if (!data || !data[product]) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 4. Ambil SEMUA negara yang tersedia untuk produk tersebut secara dinamis
    const availableCountries = Object.keys(data[product]);
    
    const processed = availableCountries.map(c => ({
      country: c,
      price: data[product][c]?.['any']?.cost || 0,
      stock: data[product][c]?.['any']?.count || 0
    }))
    // Opsional: Sembunyikan negara yang stoknya 0 agar web terlihat bersih
    .filter(item => item.stock > 0); 

    return NextResponse.json({ success: true, data: processed });
  } catch (error) {
    console.error("Get Prices API Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}