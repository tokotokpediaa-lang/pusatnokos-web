'use client';

import React, { useState } from 'react';
import { BRAND, DOMAIN, EMAIL_CONTACT, WA_CONTACT, LAST_UPDATED } from './ui';

// ==========================================
// LEGAL CONTENT
// ==========================================
const TERMS_ID = `
## 1. Penerimaan Syarat
Dengan mengakses atau menggunakan layanan ${BRAND} ("Layanan") di ${DOMAIN}, Anda menyatakan telah membaca, memahami, dan menyetujui Syarat & Ketentuan ini. Jika Anda tidak setuju, harap hentikan penggunaan Layanan.

## 2. Deskripsi Layanan
${BRAND} adalah platform penyedia nomor virtual sementara (OTP/SMS) untuk keperluan verifikasi akun di berbagai platform digital. Layanan kami bersumber dari penyedia pihak ketiga (5sim.net) dan bersifat sekali pakai.

## 3. Kelayakan Pengguna
- Anda harus berusia minimal 17 tahun untuk menggunakan Layanan.
- Anda bertanggung jawab atas keamanan akun dan kata sandi Anda.
- Satu orang hanya diperbolehkan memiliki satu akun.
- Anda wajib memverifikasi email sebelum dapat melakukan pembelian.

## 4. Penggunaan yang Diizinkan
Layanan hanya boleh digunakan untuk:
- Verifikasi akun pribadi yang sah pada platform digital.
- Keperluan pengujian teknis yang legal.

## 5. Penggunaan yang Dilarang
Anda dilarang menggunakan Layanan untuk:
- Membuat akun palsu, penipuan, atau spam dalam skala besar.
- Melanggar syarat dan ketentuan platform pihak ketiga.
- Aktivitas ilegal atau yang merugikan pihak lain.
- Menjual kembali nomor yang diperoleh tanpa izin tertulis dari ${BRAND}.

Pelanggaran dapat mengakibatkan penangguhan atau penghapusan akun tanpa pengembalian saldo.

## 6. Saldo dan Pembayaran
- Saldo yang telah ditopup tidak dapat ditarik kembali (non-refundable) kecuali terjadi kesalahan teknis dari pihak kami.
- Harga layanan dapat berubah sewaktu-waktu mengikuti harga penyedia dan nilai tukar mata uang.
- ${BRAND} tidak bertanggung jawab atas kerugian akibat fluktuasi kurs.

## 7. Ketersediaan Nomor dan OTP
- ${BRAND} tidak menjamin bahwa nomor yang dibeli akan selalu menerima OTP, karena bergantung pada ketersediaan penyedia pihak ketiga.
- Nomor yang telah dibeli dan tidak menerima OTP dalam waktu 20 menit akan kedaluwarsa. Saldo yang terpotong tidak dikembalikan kecuali terjadi kegagalan teknis dari pihak kami.
- ${BRAND} tidak bertanggung jawab atas penolakan OTP oleh platform tujuan.

## 8. Penghentian Layanan
${BRAND} berhak menangguhkan atau menghentikan akun Anda tanpa pemberitahuan jika:
- Terdapat indikasi pelanggaran Syarat & Ketentuan ini.
- Terdapat aktivitas yang mencurigakan atau merugikan platform.

## 9. Batasan Tanggung Jawab
${BRAND} tidak bertanggung jawab atas kerugian tidak langsung, insidental, atau konsekuensial yang timbul dari penggunaan atau ketidakmampuan menggunakan Layanan.

## 10. Perubahan Syarat
${BRAND} berhak mengubah Syarat & Ketentuan ini sewaktu-waktu. Perubahan akan diberitahukan melalui email atau pengumuman di platform. Penggunaan berkelanjutan setelah perubahan dianggap sebagai persetujuan.

## 11. Hukum yang Berlaku
Syarat & Ketentuan ini tunduk pada hukum Republik Indonesia.

## 12. Kontak
Pertanyaan mengenai Syarat & Ketentuan dapat disampaikan melalui:
- Email: ${EMAIL_CONTACT}
- WhatsApp: +${WA_CONTACT}
`;

const PRIVACY_ID = `
## 1. Informasi yang Kami Kumpulkan
- **Data akun:** nama, alamat email, dan kata sandi terenkripsi.
- **Data transaksi:** riwayat pembelian, deposit, dan mutasi saldo.
- **Data teknis:** alamat IP, jenis perangkat, dan log aktivitas untuk keamanan.

## 2. Cara Kami Menggunakan Informasi
- Menyediakan dan meningkatkan Layanan.
- Memproses transaksi dan mengirimkan notifikasi terkait akun.
- Mencegah penipuan dan aktivitas berbahaya.
- Memenuhi kewajiban hukum yang berlaku.

## 3. Berbagi Informasi
Kami tidak menjual data pribadi Anda. Kami hanya berbagi data dengan:
- **Penyedia pihak ketiga** (5sim.net) sebatas data yang diperlukan untuk memproses pembelian nomor.
- **Otoritas hukum** jika diwajibkan oleh peraturan perundang-undangan.

## 4. Keamanan Data
Kami menerapkan langkah-langkah keamanan teknis meliputi enkripsi data, autentikasi token, dan pembatasan akses untuk melindungi data Anda.

## 5. Penyimpanan Data
Data akun disimpan selama akun Anda aktif. Data transaksi disimpan selama 5 tahun untuk keperluan audit.

## 6. Hak Pengguna
Anda berhak untuk:
- Mengakses data pribadi Anda.
- Meminta koreksi data yang tidak akurat.
- Meminta penghapusan akun dengan menghubungi kami.

## 7. Cookie
Kami menggunakan cookie sesi untuk autentikasi dan tidak menggunakan cookie pelacakan pihak ketiga untuk iklan.

## 8. Perubahan Kebijakan
Perubahan pada Kebijakan Privasi ini akan diberitahukan melalui email atau pengumuman di platform.

## 9. Kontak
Pertanyaan mengenai privasi dapat disampaikan melalui:
- Email: ${EMAIL_CONTACT}
- WhatsApp: +${WA_CONTACT}
`;

const TERMS_EN = `
## 1. Acceptance of Terms
By accessing or using the ${BRAND} service ("Service") at ${DOMAIN}, you confirm that you have read, understood, and agreed to these Terms & Conditions. If you do not agree, please discontinue use of the Service.

## 2. Service Description
${BRAND} is a virtual number provider platform for temporary OTP/SMS verification purposes across various digital platforms. Our service is sourced from a third-party provider (5sim.net) and is intended for single use.

## 3. User Eligibility
- You must be at least 17 years old to use the Service.
- You are responsible for the security of your account and password.
- Each person is only allowed one account.
- You must verify your email before making any purchases.

## 4. Permitted Use
The Service may only be used for:
- Legitimate personal account verification on digital platforms.
- Legal technical testing purposes.

## 5. Prohibited Use
You are prohibited from using the Service for:
- Creating fake accounts, fraud, or large-scale spam.
- Violating the terms and conditions of third-party platforms.
- Illegal activities or activities that harm others.
- Reselling obtained numbers without written permission from ${BRAND}.

Violations may result in account suspension or deletion without balance refund.

## 6. Balance and Payments
- Topped-up balances are non-refundable unless a technical error occurs on our part.
- Service prices may change at any time based on provider pricing and exchange rates.
- ${BRAND} is not responsible for losses due to currency fluctuations.

## 7. Number and OTP Availability
- ${BRAND} does not guarantee that purchased numbers will always receive OTP, as this depends on third-party provider availability.
- Numbers purchased that do not receive OTP within 20 minutes will expire. Deducted balance will not be refunded unless a technical failure occurs on our part.
- ${BRAND} is not responsible for OTP rejection by the target platform.

## 8. Service Termination
${BRAND} reserves the right to suspend or terminate your account without notice if:
- There is evidence of violation of these Terms & Conditions.
- Suspicious or harmful activity is detected on the platform.

## 9. Limitation of Liability
${BRAND} is not liable for indirect, incidental, or consequential damages arising from the use or inability to use the Service.

## 10. Changes to Terms
${BRAND} reserves the right to modify these Terms & Conditions at any time. Changes will be notified via email or platform announcement. Continued use after changes constitutes acceptance.

## 11. Governing Law
These Terms & Conditions are governed by the laws of the Republic of Indonesia.

## 12. Contact
Questions regarding these Terms & Conditions can be directed to:
- Email: ${EMAIL_CONTACT}
- WhatsApp: +${WA_CONTACT}
`;

const PRIVACY_EN = `
## 1. Information We Collect
- **Account data:** name, email address, and encrypted password.
- **Transaction data:** purchase history, deposits, and balance mutations.
- **Technical data:** IP address, device type, and activity logs for security purposes.

## 2. How We Use Information
- To provide and improve the Service.
- To process transactions and send account-related notifications.
- To prevent fraud and harmful activities.
- To comply with applicable legal obligations.

## 3. Information Sharing
We do not sell your personal data. We only share data with:
- **Third-party providers** (5sim.net) limited to data necessary to process number purchases.
- **Legal authorities** when required by applicable laws and regulations.

## 4. Data Security
We implement technical security measures including data encryption, token authentication, and access restrictions to protect your data.

## 5. Data Retention
Account data is retained for as long as your account is active. Transaction data is retained for 5 years for audit purposes.

## 6. User Rights
You have the right to:
- Access your personal data.
- Request correction of inaccurate data.
- Request account deletion by contacting us.

## 7. Cookies
We use session cookies for authentication and do not use third-party tracking cookies for advertising.

## 8. Policy Changes
Changes to this Privacy Policy will be notified via email or platform announcement.

## 9. Contact
Privacy-related questions can be directed to:
- Email: ${EMAIL_CONTACT}
- WhatsApp: +${WA_CONTACT}
`;

// ==========================================
// RENDER HELPER
// ==========================================
type LegalTab = 'terms-id' | 'terms-en' | 'privacy-id' | 'privacy-en';

function renderLegalMarkdown(text: string) {
  const lines = text.trim().split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-lg font-black text-white mt-8 mb-3 uppercase tracking-wide">
          {line.replace('## ', '')}
        </h2>
      );
    } else if (line.startsWith('- **')) {
      const match = line.match(/- \*\*(.+?)\*\*(.+)/);
      if (match) {
        elements.push(
          <li key={key++} className="text-gray-400 mb-1 ml-4">
            <span className="text-white font-bold">{match[1]}</span>{match[2]}
          </li>
        );
      }
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={key++} className="text-gray-400 mb-1 ml-4 list-disc">
          {line.replace('- ', '')}
        </li>
      );
    } else if (line.trim()) {
      elements.push(
        <p key={key++} className="text-gray-400 leading-relaxed mb-3">
          {line}
        </p>
      );
    }
  }
  return elements;
}

// ==========================================
// LEGAL PAGE COMPONENT
// ==========================================
export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<LegalTab>('terms-id');

  const tabs: { id: LegalTab; label: string }[] = [
    { id: 'terms-id', label: 'Syarat & Ketentuan' },
    { id: 'terms-en', label: 'Terms of Service' },
    { id: 'privacy-id', label: 'Kebijakan Privasi' },
    { id: 'privacy-en', label: 'Privacy Policy' },
  ];

  const content: Record<LegalTab, string> = {
    'terms-id': TERMS_ID,
    'terms-en': TERMS_EN,
    'privacy-id': PRIVACY_ID,
    'privacy-en': PRIVACY_EN,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl md:text-4xl font-black text-white mb-2 uppercase tracking-tight">
          Dokumen <span className="text-red-500">Legal</span>
        </h2>
        <p className="text-gray-400 font-medium text-sm md:text-base">
          Terakhir diperbarui: {LAST_UPDATED}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-label={`Tampilkan ${tab.label}`}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-[#0e0303]/90 border border-red-500/20 rounded-2xl p-6 md:p-10">
        <div className="prose prose-invert max-w-none">
          {renderLegalMarkdown(content[activeTab])}
        </div>
      </div>

      <p className="text-gray-600 text-sm text-center mt-6">
        {BRAND} · {DOMAIN} · {EMAIL_CONTACT}
      </p>
    </div>
  );
}