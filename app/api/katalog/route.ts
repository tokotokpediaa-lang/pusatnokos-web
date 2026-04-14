import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import '../../../lib/firebaseAdmin'; // Memicu inisialisasi agar tidak undefined
import { FieldValue } from 'firebase-admin/firestore';

// --- KONFIGURASI MARGIN (WAJIB SAMA DENGAN KATALOG) ---
const PROFIT_MARGIN_PERCENT = 0.35; // Ambil untung 35%
const FLAT_FEE_IDR = 1500; // Biaya admin
const KURS_PENGAMAN_RUB_TO_IDR = 175; // 1 RUB = 175 IDR

const mapCountryTo5Sim = (countryId: string) => {
  const map: Record<string, string> = {
    'id': 'indonesia', 'ru': 'russia', 'us': 'usa', 'uk': 'england',
    'my': 'malaysia', 'th': 'thailand', 'ph': 'philippines', 'vn': 'vietnam',
    'br': 'brazil', 'in': 'india', 'tr': 'turkey', 'ar': 'argentina',
    'cn': 'china', 'de': 'germany', 'fr': 'france', 'ca': 'canada',
    'jp': 'japan', 'kr': 'south_korea', 'za': 'south_africa', 'ng': 'nigeria'
  };
  return map[countryId] || countryId;
};

export async function POST(request: Request) {
  try {
    // Inisialisasi Firebase Admin
    const auth = admin.auth();
    const db = admin.firestore();

    // Validasi Sesi (Token)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Akses ditolak. Sesi tidak valid.' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { countryId, serviceId, tier } = await request.json();
    const simCountry = mapCountryTo5Sim(countryId);
    
    // Tentukan target operator di 5sim berdasarkan tier
    const targetOperator = tier === 'cheap' ? 'any' : (tier === 'vip' ? 'virtual' : 'any'); 

    // =================================================================
    // 1. CEK HARGA MODAL REAL-TIME KE 5SIM SEBELUM TRANSAKSI (SANGAT PENTING!)
    // =================================================================
    const checkPriceRes = await fetch(`https://5sim.net/v1/guest/prices?country=${simCountry}&product=${serviceId}`);
    const data5sim = await checkPriceRes.json();

    let modalRub = 10; // Fallback darurat
    try {
      // Cari harga modal asli dari 5sim untuk operator yang diminta
      modalRub = data5sim[simCountry][serviceId][targetOperator]?.cost 
                 || data5sim[simCountry][serviceId]['any']?.cost 
                 || 10;
    } catch (e) {
      return NextResponse.json({ message: "Layanan ini sedang tidak tersedia di server." }, { status: 400 });
    }

    // 2. HITUNG HARGA JUAL (Modal Live + Margin Anda)
    const modalRupiah = modalRub * KURS_PENGAMAN_RUB_TO_IDR;
    const hargaJualKasar = modalRupiah + (modalRupiah * PROFIT_MARGIN_PERCENT) + FLAT_FEE_IDR;
    const hargaReguler = Math.ceil(hargaJualKasar / 100) * 100; // Pembulatan reguler

    // Hitung harga final sesuai tier yang dipilih
    let hargaFinalServer = hargaReguler;
    if (tier === 'cheap') hargaFinalServer = Math.ceil((hargaReguler * 0.85) / 100) * 100;
    if (tier === 'vip') hargaFinalServer = Math.ceil((hargaReguler * 1.40) / 100) * 100;

    // =================================================================
    // 3. POTONG SALDO USER BERDASARKAN HARGA FINAL (TRANSAKSI AMAN)
    // =================================================================
    const userRef = db.collection('users').doc(userId);
    
    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new Error("Pengguna tidak ditemukan.");
      
      const currentBalance = userDoc.data()?.balance || 0;
      if (currentBalance < hargaFinalServer) {
        throw new Error(`Saldo tidak mencukupi. Butuh Rp ${hargaFinalServer.toLocaleString('id-ID')}`);
      }

      t.update(userRef, {
        balance: currentBalance - hargaFinalServer,
        totalSpent: (userDoc.data()?.totalSpent || 0) + hargaFinalServer
      });
    });

    // =================================================================
    // 4. REQUEST PEMBELIAN KE 5SIM
    // =================================================================
    const apiKey5Sim = process.env.FIVESIM_API_KEY;
    const fiveSimUrl = `https://5sim.net/v1/user/buy/activation/${simCountry}/${targetOperator}/${serviceId}`;
    
    let simData;
    try {
      const fiveSimRes = await fetch(fiveSimUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey5Sim}`,
          'Accept': 'application/json'
        }
      });

      const textRes = await fiveSimRes.text();
      try {
        simData = JSON.parse(textRes);
      } catch (e) {
        throw new Error(textRes); 
      }

      if (!fiveSimRes.ok || !simData.id) {
        throw new Error(simData.message || "Stok nomor sedang kosong.");
      }

    } catch (apiError: any) {
      // 5. JIKA 5SIM GAGAL (MISAL STOK HABIS), KEMBALIKAN SALDO PENGGUNA (REFUND)
      await userRef.update({
        balance: FieldValue.increment(hargaFinalServer),
        totalSpent: FieldValue.increment(-hargaFinalServer)
      });

      let errorMsg = apiError.message;
      if (errorMsg.includes("no free phones")) errorMsg = "Stok nomor untuk layanan ini sedang kosong di server pusat.";
      else if (errorMsg.includes("not enough user balance")) errorMsg = "Saldo pusat (5SIM) tidak mencukupi. Hubungi Admin.";
      else if (errorMsg.includes("bad api key")) errorMsg = "Konfigurasi Server bermasalah. Hubungi Admin.";

      throw new Error(errorMsg);
    }

    // =================================================================
    // 6. SUKSES! CATAT ORDER DAN TRANSAKSI
    // =================================================================
    const orderId = simData.id.toString();
    const batch = db.batch();

    // Catat riwayat saldo terpotong
    const txRef = db.collection('users').doc(userId).collection('transactions').doc(`${orderId}_purchase`);
    batch.set(txRef, {
      type: 'purchase', 
      amount: -hargaFinalServer, 
      desc: `Beli Nomor ${serviceId.toUpperCase()}`,
      status: 'success', 
      timestamp: new Date().getTime()
    });

    // Catat pesanan aktif
    const orderRef = db.collection('users').doc(userId).collection('orders').doc(orderId);
    batch.set(orderRef, {
      countryId, 
      serviceId, 
      price: hargaFinalServer,
      number: simData.phone,
      status: 'active', 
      otp: null, 
      timestamp: new Date().getTime(),
      expiresAt: new Date().getTime() + 15 * 60 * 1000 // Expired 15 menit
    });

    await batch.commit();
    
    // Kembalikan nomor ke Frontend
    return NextResponse.json({ id: orderId, phone: simData.phone });

  } catch (error: any) {
    console.error("Buy Number API Error:", error.message);
    return NextResponse.json({ message: error.message || "Terjadi kesalahan sistem" }, { status: 400 });
  }
}