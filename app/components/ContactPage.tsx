'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { CONTACT, Button, Card } from './ui';

// ==========================================
// CONTACT PAGE COMPONENT
// ==========================================
export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <h2 className="text-lg md:text-4xl font-black text-white mb-1 uppercase tracking-tight">
          Hubungi <span className="text-red-500">Kami</span>
        </h2>
        <p className="text-gray-400 font-medium text-sm md:text-lg">
          Punya pertanyaan atau kendala teknis? Tim support kami siap membantu Anda 24/7.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Telegram */}
        <Card className="bg-gradient-to-br from-[#140505] to-black border-blue-900/30 p-10 flex flex-col items-center text-center hover:border-blue-500/50 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-10 rounded-bl-full blur-2xl" />
          <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 mb-6 group-hover:scale-110 transition-transform">
            <MessageCircle className="w-10 h-10 text-blue-500" aria-hidden="true" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-wide">
            Telegram Support
          </h3>
          <p className="text-gray-400 mb-8 font-medium">
            Respon lebih cepat. Hubungi CS kami melalui Telegram (@{CONTACT.telegram}).
          </p>
          <Button
            variant="outline"
            aria-label="Buka Telegram Support"
            className="w-full py-4 border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600"
            onClick={() =>
              window.open(`https://t.me/${CONTACT.telegram}`, '_blank', 'noopener,noreferrer')
            }
          >
            BUKA TELEGRAM
          </Button>
        </Card>

        {/* WhatsApp */}
        <Card className="bg-gradient-to-br from-[#140505] to-black border-green-900/30 p-10 flex flex-col items-center text-center hover:border-green-500/50 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 opacity-10 rounded-bl-full blur-2xl" />
          <div className="w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center border border-green-500/30 mb-6 group-hover:scale-110 transition-transform">
            <MessageCircle className="w-10 h-10 text-green-500" aria-hidden="true" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-wide">
            WhatsApp Support
          </h3>
          <p className="text-gray-400 mb-8 font-medium">
            Butuh bantuan manual? Chat admin via WA resmi kami.
          </p>
          <Button
            variant="whatsapp"
            aria-label="Buka WhatsApp Support"
            className="w-full py-4 text-sm tracking-widest"
            onClick={() =>
              window.open(`https://wa.me/${CONTACT.whatsapp}`, '_blank', 'noopener,noreferrer')
            }
          >
            BUKA WHATSAPP
          </Button>
        </Card>
      </div>
    </div>
  );
}