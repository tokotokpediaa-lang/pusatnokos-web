'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock, Copy, Loader2, X, XCircle, CheckCircle, Check,
  CheckCircle2, RefreshCw, AlertCircle, History,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { secureApiCall } from '@/lib/apiClient';
import { Button, Card } from './ui';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
let auth: any = null;
let db: any   = null;
if (typeof window !== 'undefined') {
  try {
    const _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(_app); db = getFirestore(_app);
  } catch {}
}

const formatRupiah = (v: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(isNaN(v)?0:v);
const FormatRupiah = ({ value }: { value: number }) => <>{formatRupiah(value)}</>;

const copyToClipboardHelper = (text: string, fn?: (m:string,t:string)=>void) => {
  const fb = (t:string) => { const ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;top:0;left:0'; document.body.appendChild(ta); ta.focus(); ta.select(); try{document.execCommand('copy');}catch{} document.body.removeChild(ta); };
  if (!navigator.clipboard||!window.isSecureContext) { fb(text); fn?.('Berhasil disalin!','success'); }
  else navigator.clipboard.writeText(text).then(()=>fn?.('Berhasil disalin!','success')).catch(()=>{fb(text);fn?.('Berhasil disalin!','success');});
};

const useCountdown = (expiresAt:any, isActive:boolean, onExpire:()=>void) => {
  const [seconds,setSeconds] = useState(0);
  const onExpireRef = useRef(onExpire); const hasExpired = useRef(false);
  useEffect(()=>{onExpireRef.current=onExpire;},[onExpire]);
  const expiresAtMs = useMemo(()=>{
    if(!expiresAt) return 0; if(typeof expiresAt==='number') return expiresAt;
    if(typeof expiresAt==='string') return new Date(expiresAt).getTime();
    if(typeof expiresAt?.toMillis==='function') return expiresAt.toMillis();
    if(expiresAt?.seconds) return expiresAt.seconds*1000+Math.floor((expiresAt.nanoseconds||0)/1e6);
    return 0;
  },[typeof expiresAt==='number'?expiresAt:typeof expiresAt==='string'?expiresAt:expiresAt?.seconds??0]);
  useEffect(()=>{
    if(!isActive||!expiresAtMs){setSeconds(0);hasExpired.current=false;return;}
    const tick=()=>{const r=Math.max(0,Math.floor((expiresAtMs-Date.now())/1000));setSeconds(r);if(r<=0&&!hasExpired.current){hasExpired.current=true;onExpireRef.current?.();}};
    hasExpired.current=false;tick();const t=setInterval(tick,1000);return()=>clearInterval(t);
  },[expiresAtMs,isActive]);
  const formatTime=()=>{const m=Math.floor(seconds/60),s=seconds%60;return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;};
  return {seconds,formatTime};
};

const SERVICES = [
  // Sosial Media & Chat
  { id: 'whatsapp', name: 'WhatsApp', image: 'https://api.iconify.design/logos:whatsapp-icon.svg', icon: '💬', color: 'bg-green-500/20 text-green-400', category: 'social' },
  { id: 'telegram', name: 'Telegram', image: 'https://api.iconify.design/logos:telegram.svg', icon: '✈️', color: 'bg-blue-500/20 text-blue-400', category: 'social' },
  { id: 'instagram', name: 'Instagram', image: 'https://api.iconify.design/skill-icons:instagram.svg', icon: '📸', color: 'bg-pink-500/20 text-pink-400', category: 'social' },
  { id: 'facebook', name: 'Facebook', image: 'https://api.iconify.design/logos:facebook.svg', icon: '📘', color: 'bg-blue-600/20 text-blue-500', category: 'social' },
  { id: 'tiktok', name: 'TikTok', image: 'https://api.iconify.design/logos:tiktok-icon.svg', icon: '🎵', color: 'bg-gray-800 text-white border border-gray-700', category: 'social' },
  { id: 'twitter', name: 'Twitter / X', image: 'https://api.iconify.design/simple-icons:x.svg?color=white', icon: '🐦', color: 'bg-blue-400/20 text-blue-400', category: 'social' },
  { id: 'discord', name: 'Discord', image: 'https://api.iconify.design/logos:discord-icon.svg', icon: '🎮', color: 'bg-indigo-500/20 text-indigo-400', category: 'social' },
  { id: 'line', name: 'LINE', image: 'https://api.iconify.design/logos:line.svg', icon: '💬', color: 'bg-green-500/20 text-green-500', category: 'social' },
  { id: 'wechat', name: 'WeChat', image: 'https://api.iconify.design/uiw:wechat.svg?color=%2307C160', icon: '💬', color: 'bg-green-500/20 text-green-500', category: 'social' },
  { id: 'viber', name: 'Viber', image: 'https://api.iconify.design/fa-brands:viber.svg?color=%23665CAC', icon: '📞', color: 'bg-purple-500/20 text-purple-500', category: 'social' },
  { id: 'kakaotalk', name: 'KakaoTalk', image: 'https://api.iconify.design/ri:kakao-talk-fill.svg?color=%23FEE500', icon: '💬', color: 'bg-yellow-500/20 text-yellow-500', category: 'social' },
  { id: 'snapchat', name: 'Snapchat', image: 'https://api.iconify.design/fa-brands:snapchat-ghost.svg?color=%23FFFC00', icon: '👻', color: 'bg-yellow-400/20 text-yellow-400', category: 'social' },
  { id: 'vkontakte', name: 'VKontakte (VK)', image: 'https://api.iconify.design/entypo-social:vk-with-circle.svg?color=%234C75A3', icon: 'V', color: 'bg-blue-500/20 text-blue-500', category: 'social' },
  { id: 'ok', name: 'Odnoklassniki (OK)', image: 'https://api.iconify.design/simple-icons:odnoklassniki.svg?color=%23EE8208', icon: '🟠', color: 'bg-orange-500/20 text-orange-500', category: 'social' },
  { id: 'linkedin', name: 'LinkedIn', image: 'https://api.iconify.design/logos:linkedin-icon.svg', icon: '💼', color: 'bg-blue-700/20 text-blue-600', category: 'social' },
  { id: 'pinterest', name: 'Pinterest', image: 'https://api.iconify.design/logos:pinterest.svg', icon: '📌', color: 'bg-red-600/20 text-red-600', category: 'social' },
  { id: 'reddit', name: 'Reddit', image: 'https://api.iconify.design/logos:reddit-icon.svg', icon: '🤖', color: 'bg-orange-600/20 text-orange-500', category: 'social' },
  { id: 'tumblr', name: 'Tumblr', image: 'https://api.iconify.design/logos:tumblr-icon.svg', icon: 'T', color: 'bg-indigo-800/20 text-indigo-700', category: 'social' },
  { id: 'quora', name: 'Quora', image: 'https://api.iconify.design/simple-icons:quora.svg?color=%23B92B27', icon: 'Q', color: 'bg-red-800/20 text-red-700', category: 'social' },
  { id: 'twitch', name: 'Twitch', image: 'https://api.iconify.design/logos:twitch.svg', icon: '📺', color: 'bg-purple-600/20 text-purple-500', category: 'social' },
  { id: 'youtube', name: 'YouTube', image: 'https://api.iconify.design/logos:youtube-icon.svg', icon: '▶️', color: 'bg-red-600/20 text-red-500', category: 'social' },
  { id: 'bilibili', name: 'Bilibili', image: 'https://api.iconify.design/simple-icons:bilibili.svg?color=%2300A1D6', icon: '📺', color: 'bg-cyan-500/20 text-cyan-400', category: 'social' },
  { id: 'kwai', name: 'Kwai', image: 'https://api.iconify.design/simple-icons:kwai.svg?color=%23FFCC00', icon: '🎬', color: 'bg-yellow-500/20 text-yellow-400', category: 'social' },
  { id: 'douyin', name: 'Douyin (TikTok CN)', image: 'https://api.iconify.design/logos:tiktok-icon.svg', icon: '🎵', color: 'bg-gray-800 text-white border border-gray-700', category: 'social' },
  { id: 'xiaohongshu', name: 'Xiaohongshu (RED)', image: 'https://api.iconify.design/simple-icons:xiaohongshu.svg?color=%23FF2442', icon: '📕', color: 'bg-red-500/20 text-red-400', category: 'social' },
  { id: 'kuaishou', name: 'Kuaishou', image: 'https://api.iconify.design/simple-icons:kuaishou.svg?color=%23FF4906', icon: '🎥', color: 'bg-orange-500/20 text-orange-400', category: 'social' },
  
  // Tech & Akun Utama
  { id: 'google', name: 'Google / Gmail', image: 'https://api.iconify.design/logos:google-icon.svg', icon: '✉️', color: 'bg-red-500/20 text-red-400', category: 'tech' },
  { id: 'apple', name: 'Apple ID', image: 'https://api.iconify.design/mdi:apple.svg?color=white', icon: '🍎', color: 'bg-gray-500/20 text-gray-400', category: 'tech' },
  { id: 'microsoft', name: 'Microsoft / Outlook', image: 'https://api.iconify.design/logos:microsoft-icon.svg', icon: '🪟', color: 'bg-blue-500/20 text-blue-400', category: 'tech' },
  { id: 'yahoo', name: 'Yahoo', image: 'https://api.iconify.design/logos:yahoo.svg', icon: 'Y!', color: 'bg-purple-500/20 text-purple-500', category: 'tech' },
  { id: 'openai', name: 'ChatGPT / OpenAI', image: 'https://api.iconify.design/simple-icons:openai.svg?color=white', icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  { id: 'claude', name: 'Claude / Anthropic', image: 'https://api.iconify.design/simple-icons:anthropic.svg?color=%23D18B65', icon: '🧠', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  { id: 'github', name: 'GitHub', image: 'https://api.iconify.design/mdi:github.svg?color=white', icon: '💻', color: 'bg-gray-700/50 text-white', category: 'tech' },
  { id: 'amazon', name: 'Amazon Web Services', image: 'https://api.iconify.design/ri:amazon-fill.svg?color=%23FF9900', icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  { id: 'mailru', name: 'Mail.ru', image: 'https://api.iconify.design/simple-icons:maildotru.svg?color=%23168DE2', icon: '@', color: 'bg-blue-600/20 text-blue-500', category: 'tech' },
  { id: 'yandex', name: 'Yandex', image: 'https://api.iconify.design/logos:yandex-ru.svg', icon: 'Y', color: 'bg-red-600/20 text-red-500', category: 'tech' },
  { id: 'protonmail', name: 'ProtonMail', image: 'https://api.iconify.design/logos:protonmail.svg', icon: '🔒', color: 'bg-purple-700/20 text-purple-600', category: 'tech' },
  { id: 'naver', name: 'Naver', image: 'https://api.iconify.design/simple-icons:naver.svg?color=%2303C75A', icon: 'N', color: 'bg-green-600/20 text-green-500', category: 'tech' },
  { id: 'baidu', name: 'Baidu', image: 'https://api.iconify.design/simple-icons:baidu.svg?color=%232932E1', icon: '🔍', color: 'bg-blue-600/20 text-blue-500', category: 'tech' },
  { id: 'capcut', name: 'CapCut', image: 'https://api.iconify.design/simple-icons:capcut.svg?color=white', icon: '✂️', color: 'bg-gray-800 text-white', category: 'tech' },
  { id: 'aws', name: 'AWS (Amazon)', image: 'https://api.iconify.design/logos:aws.svg', icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  { id: 'azure', name: 'Microsoft Azure', image: 'https://api.iconify.design/logos:microsoft-azure.svg', icon: '☁️', color: 'bg-blue-500/20 text-blue-400', category: 'tech' },
  { id: 'linode', name: 'Linode / Akamai', image: 'https://api.iconify.design/logos:linode.svg', icon: '☁️', color: 'bg-green-500/20 text-green-400', category: 'tech' },
  { id: 'vultr', name: 'Vultr', image: 'https://api.iconify.design/simple-icons:vultr.svg?color=%23007BFC', icon: '☁️', color: 'bg-blue-600/20 text-blue-500', category: 'tech' },
  
  // E-Commerce & Transportasi
  { id: 'shopee', name: 'Shopee', image: 'https://api.iconify.design/simple-icons:shopee.svg?color=white', icon: '🛍️', color: 'bg-orange-500 text-white', category: 'ecommerce' },
  { id: 'alipay', name: 'Alipay / Alibaba / 1688', image: 'https://api.iconify.design/simple-icons:alipay.svg?color=%231677FF', icon: '💙', color: 'bg-blue-500/20 text-blue-400', category: 'ecommerce' },
  { id: 'bukalapak', name: 'Bukalapak', image: 'https://api.iconify.design/simple-icons:bukalapak.svg?color=%23E11F26', icon: '🛒', color: 'bg-red-500/20 text-red-400', category: 'ecommerce' },
  { id: 'alfagift', name: 'Alfagift', image: 'https://logo.clearbit.com/alfagift.id', icon: '🏪', color: 'bg-red-500/20 text-red-400', category: 'ecommerce' },
  { id: 'jd', name: 'JD.com', image: 'https://api.iconify.design/simple-icons:jd.svg?color=%23E1251B', icon: '📦', color: 'bg-red-500/20 text-red-400', category: 'ecommerce' },
  { id: 'pinduoduo', name: 'Pinduoduo / Temu', image: 'https://api.iconify.design/simple-icons:pinduoduo.svg?color=%23E02020', icon: '🛒', color: 'bg-red-600/20 text-red-500', category: 'ecommerce' },
  { id: 'meituan', name: 'Meituan', image: 'https://api.iconify.design/simple-icons:meituan.svg?color=%23FFD100', icon: '🚴', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  { id: 'gojek', name: 'Gojek', image: 'https://api.iconify.design/simple-icons:gojek.svg?color=white', icon: '🏍️', color: 'bg-green-600 text-white', category: 'ecommerce' },
  { id: 'grab', name: 'Grab', image: 'https://api.iconify.design/simple-icons:grab.svg?color=%2300B14F', icon: '🚗', color: 'bg-green-400/20 text-green-400', category: 'ecommerce' },
  { id: 'tokopedia', name: 'Tokopedia', image: 'https://api.iconify.design/tabler:shopping-bag.svg?color=%2342B549', icon: '🦉', color: 'bg-green-500/20 text-green-500', category: 'ecommerce' },
  { id: 'lazada', name: 'Lazada', image: 'https://api.iconify.design/simple-icons:lazada.svg?color=%23F53C80', icon: '🛍️', color: 'bg-indigo-500/20 text-indigo-400', category: 'ecommerce' },
  { id: 'alibaba', name: 'Alibaba / AliExpress', image: 'https://api.iconify.design/simple-icons:alibaba.svg?color=%23FF6A00', icon: '📦', color: 'bg-orange-600/20 text-orange-500', category: 'ecommerce' },
  { id: 'taobao', name: 'Taobao', image: 'https://api.iconify.design/simple-icons:taobao.svg?color=%23FF5000', icon: '🛒', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  { id: 'ebay', name: 'eBay', image: 'https://api.iconify.design/logos:ebay.svg', icon: '🛒', color: 'bg-blue-500/20 text-blue-500', category: 'ecommerce' },
  { id: 'uber', name: 'Uber', image: 'https://api.iconify.design/fa-brands:uber.svg?color=white', icon: '🚕', color: 'bg-gray-800 text-white', category: 'ecommerce' },
  { id: 'foodpanda', name: 'Foodpanda', image: 'https://api.iconify.design/simple-icons:foodpanda.svg?color=%23D70F64', icon: '🐼', color: 'bg-pink-600/20 text-pink-500', category: 'ecommerce' },
  { id: 'deliveroo', name: 'Deliveroo', image: 'https://api.iconify.design/simple-icons:deliveroo.svg?color=%2300CCBC', icon: '🚲', color: 'bg-teal-500/20 text-teal-400', category: 'ecommerce' },
  { id: 'doordash', name: 'DoorDash', image: 'https://api.iconify.design/simple-icons:doordash.svg?color=%23FF3008', icon: '🍔', color: 'bg-red-500/20 text-red-500', category: 'ecommerce' },
  { id: 'ubereats', name: 'Uber Eats', image: 'https://api.iconify.design/simple-icons:ubereats.svg?color=%2306C167', icon: '🍔', color: 'bg-green-500/20 text-green-500', category: 'ecommerce' },
  { id: 'grubhub', name: 'Grubhub', image: 'https://api.iconify.design/simple-icons:grubhub.svg?color=%23F63440', icon: '🍕', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  { id: 'shein', name: 'SHEIN', image: 'https://api.iconify.design/simple-icons:shein.svg?color=white', icon: '👗', color: 'bg-gray-800/50 text-white', category: 'ecommerce' },
  { id: 'ozon', name: 'Ozon', image: 'https://api.iconify.design/simple-icons:ozon.svg?color=%23005BFF', icon: '📦', color: 'bg-blue-500/20 text-blue-400', category: 'ecommerce' },
  { id: 'wildberries', name: 'Wildberries', image: 'https://api.iconify.design/simple-icons:wildberries.svg?color=%23CB11AB', icon: '🛍️', color: 'bg-purple-600/20 text-purple-500', category: 'ecommerce' },

  // Hiburan & Kencan
  { id: 'netflix', name: 'Netflix', image: 'https://api.iconify.design/logos:netflix-icon.svg', icon: '🎬', color: 'bg-red-600/20 text-red-500', category: 'game' },
  { id: 'spotify', name: 'Spotify', image: 'https://api.iconify.design/logos:spotify-icon.svg', icon: '🎧', color: 'bg-green-500/20 text-green-500', category: 'game' },
  { id: 'steam', name: 'Steam', image: 'https://api.iconify.design/mdi:steam.svg?color=white', icon: '🎮', color: 'bg-blue-800/50 text-white', category: 'game' },
  { id: 'blizzard', name: 'Battle.net / Blizzard', image: 'https://api.iconify.design/simple-icons:battledotnet.svg?color=%2300AEFF', icon: '⚔️', color: 'bg-blue-600/20 text-blue-400', category: 'game' },
  { id: 'playstation', name: 'PlayStation Network', image: 'https://api.iconify.design/logos:playstation.svg', icon: '🎮', color: 'bg-blue-700/20 text-blue-600', category: 'game' },
  { id: 'nintendo', name: 'Nintendo', image: 'https://api.iconify.design/simple-icons:nintendo.svg?color=%23E60012', icon: '🍄', color: 'bg-red-600/20 text-red-500', category: 'game' },
  { id: 'roblox', name: 'Roblox', image: 'https://api.iconify.design/simple-icons:roblox.svg?color=white', icon: '🧱', color: 'bg-gray-700/50 text-white', category: 'game' },
  { id: 'faceit', name: 'Faceit', image: 'https://api.iconify.design/simple-icons:faceit.svg?color=%23FF5500', icon: '🎯', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  { id: 'ea', name: 'EA / Origin', image: 'https://api.iconify.design/simple-icons:ea.svg?color=white', icon: '🎮', color: 'bg-gray-800/50 text-white', category: 'game' },
  { id: 'ubisoft', name: 'Ubisoft Connect', image: 'https://api.iconify.design/simple-icons:ubisoft.svg?color=white', icon: '🌀', color: 'bg-blue-500/20 text-blue-500', category: 'game' },
  { id: 'tinder', name: 'Tinder', image: 'https://api.iconify.design/logos:tinder-icon.svg', icon: '🔥', color: 'bg-rose-500/20 text-rose-400', category: 'dating' },
  { id: 'bumble', name: 'Bumble', image: 'https://api.iconify.design/simple-icons:bumble.svg?color=%23FFC629', icon: '🐝', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  { id: 'badoo', name: 'Badoo', image: 'https://api.iconify.design/simple-icons:badoo.svg?color=%23783BF9', icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'dating' },
  { id: 'pof', name: 'Plenty of Fish', image: 'https://api.iconify.design/simple-icons:plentyoffish.svg?color=%2300B2E2', icon: '🐟', color: 'bg-blue-500/20 text-blue-400', category: 'dating' },
  { id: 'grindr', name: 'Grindr', image: 'https://api.iconify.design/simple-icons:grindr.svg?color=%23F5D600', icon: '🎭', color: 'bg-yellow-600/20 text-yellow-500', category: 'dating' },
  { id: 'match', name: 'Match.com', image: 'https://api.iconify.design/simple-icons:matchdotcom.svg?color=%2300A5F1', icon: '❤️', color: 'bg-blue-600/20 text-blue-500', category: 'dating' },
  { id: 'okcupid', name: 'OkCupid', image: 'https://api.iconify.design/simple-icons:okcupid.svg?color=%2342B2FA', icon: '💘', color: 'bg-blue-400/20 text-blue-400', category: 'dating' },
  { id: 'hinge', name: 'Hinge', image: 'https://api.iconify.design/simple-icons:hinge.svg?color=white', icon: 'H', color: 'bg-black border border-white/20 text-white', category: 'dating' },

  // Keuangan & Crypto
  { id: 'paypal', name: 'PayPal', image: 'https://api.iconify.design/logos:paypal.svg', icon: '💳', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'binance', name: 'Binance', image: 'https://api.iconify.design/simple-icons:binance.svg?color=%23F3BA2F', icon: '🪙', color: 'bg-yellow-500/20 text-yellow-500', category: 'finance' },
  { id: 'coinbase', name: 'Coinbase', image: 'https://api.iconify.design/logos:coinbase.svg', icon: '🔵', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'kucoin', name: 'KuCoin', image: 'https://api.iconify.design/simple-icons:kucoin.svg?color=%2324AE8F', icon: '🟢', color: 'bg-green-500/20 text-green-500', category: 'finance' },
  { id: 'bybit', name: 'Bybit', image: 'https://api.iconify.design/simple-icons:bybit.svg?color=%23F7A600', icon: '📈', color: 'bg-yellow-600/20 text-yellow-500', category: 'finance' },
  { id: 'payoneer', name: 'Payoneer', image: 'https://api.iconify.design/logos:payoneer.svg', icon: '💳', color: 'bg-orange-500/20 text-orange-500', category: 'finance' },
  { id: 'revolut', name: 'Revolut', image: 'https://api.iconify.design/simple-icons:revolut.svg?color=white', icon: '💳', color: 'bg-gray-800 text-white', category: 'finance' },
  { id: 'monzo', name: 'Monzo', image: 'https://api.iconify.design/simple-icons:monzo.svg?color=%2314233C', icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  { id: 'transferwise', name: 'Wise (TransferWise)', image: 'https://api.iconify.design/logos:wise.svg', icon: '💸', color: 'bg-blue-500/20 text-blue-400', category: 'finance' },
  { id: 'skrill', name: 'Skrill', image: 'https://api.iconify.design/simple-icons:skrill.svg?color=%23821C4F', icon: '💳', color: 'bg-purple-800/20 text-purple-700', category: 'finance' },
  { id: 'neteller', name: 'Neteller', image: 'https://api.iconify.design/simple-icons:neteller.svg?color=%238BB031', icon: '💳', color: 'bg-green-600/20 text-green-500', category: 'finance' },
  { id: 'perfectmoney', name: 'PerfectMoney', image: 'https://logo.clearbit.com/perfectmoney.com', icon: 'PM', color: 'bg-red-600/20 text-red-500', category: 'finance' },
  { id: 'webmoney', name: 'WebMoney', image: 'https://api.iconify.design/simple-icons:webmoney.svg?color=%2300569C', icon: 'WM', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'payeer', name: 'Payeer', image: 'https://api.iconify.design/simple-icons:payeer.svg?color=%23008DE4', icon: 'P', color: 'bg-blue-400/20 text-blue-400', category: 'finance' },
  { id: 'advcash', name: 'AdvCash', image: 'https://logo.clearbit.com/advcash.com', icon: 'A', color: 'bg-green-500/20 text-green-500', category: 'finance' },
  { id: 'crypto', name: 'Crypto.com', image: 'https://api.iconify.design/logos:crypto-com.svg', icon: '🦁', color: 'bg-blue-800/50 text-blue-300', category: 'finance' },
  { id: 'kraken', name: 'Kraken', image: 'https://api.iconify.design/logos:kraken.svg', icon: '🦑', color: 'bg-purple-600/20 text-purple-500', category: 'finance' },
  { id: 'gemini', name: 'Gemini', image: 'https://api.iconify.design/logos:gemini.svg', icon: '♊', color: 'bg-blue-400/20 text-blue-400', category: 'finance' },
  { id: 'huobi', name: 'Huobi', image: 'https://api.iconify.design/simple-icons:huobi.svg?color=%23005A98', icon: 'H', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'okx', name: 'OKX', image: 'https://api.iconify.design/simple-icons:okx.svg?color=white', icon: 'O', color: 'bg-gray-800/50 text-white', category: 'finance' },
  { id: 'mexc', name: 'MEXC', image: 'https://api.iconify.design/simple-icons:mexc.svg?color=%2303B9EB', icon: 'M', color: 'bg-blue-500/20 text-blue-400', category: 'finance' },
  { id: 'gate', name: 'Gate.io', image: 'https://api.iconify.design/simple-icons:gateio.svg?color=%23E40C5B', icon: 'G', color: 'bg-red-500/20 text-red-400', category: 'finance' },
  { id: 'bitget', name: 'Bitget', image: 'https://api.iconify.design/simple-icons:bitget.svg?color=%2326A17B', icon: 'B', color: 'bg-teal-500/20 text-teal-400', category: 'finance' },
  { id: 'bingx', name: 'BingX', image: 'https://api.iconify.design/simple-icons:bingx.svg?color=%231DA2D8', icon: 'BX', color: 'bg-blue-600/20 text-blue-400', category: 'finance' },

  // Streaming & Hiburan Tambahan
  { id: 'disneyplus', name: 'Disney+', image: 'https://api.iconify.design/logos:disney.svg', icon: '🏰', color: 'bg-blue-900/50 text-blue-300', category: 'game' },
  { id: 'hbo', name: 'HBO Max', image: 'https://api.iconify.design/simple-icons:hbo.svg?color=%23A855F7', icon: '🎬', color: 'bg-purple-600/20 text-purple-400', category: 'game' },
  { id: 'hulu', name: 'Hulu', image: 'https://api.iconify.design/simple-icons:hulu.svg?color=%231CE783', icon: '📺', color: 'bg-green-500/20 text-green-400', category: 'game' },
  { id: 'paramount', name: 'Paramount+', image: 'https://api.iconify.design/simple-icons:paramount.svg?color=%230064FF', icon: '⭐', color: 'bg-blue-700/20 text-blue-400', category: 'game' },
  { id: 'amazon_video', name: 'Amazon Prime Video', image: 'https://api.iconify.design/logos:prime.svg', icon: '🎥', color: 'bg-sky-500/20 text-sky-400', category: 'game' },
  { id: 'deezer', name: 'Deezer', image: 'https://api.iconify.design/simple-icons:deezer.svg?color=%23FEAA2D', icon: '🎵', color: 'bg-yellow-500/20 text-yellow-400', category: 'game' },
  { id: 'crunchyroll', name: 'Crunchyroll', image: 'https://api.iconify.design/simple-icons:crunchyroll.svg?color=%23F47521', icon: '⛩️', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  { id: 'xbox', name: 'Xbox', image: 'https://api.iconify.design/logos:xbox.svg', icon: '🎮', color: 'bg-green-600/20 text-green-500', category: 'game' },
  { id: 'epicgames', name: 'Epic Games', image: 'https://api.iconify.design/simple-icons:epicgames.svg?color=white', icon: '🎮', color: 'bg-gray-700/50 text-white', category: 'game' },
  { id: 'supercell', name: 'Supercell (Clash)', image: 'https://logo.clearbit.com/supercell.com', icon: '⚔️', color: 'bg-red-500/20 text-red-400', category: 'game' },
  { id: 'garena', name: 'Garena / Free Fire', image: 'https://api.iconify.design/simple-icons:garena.svg?color=%23F11E24', icon: '🔥', color: 'bg-red-600/20 text-red-500', category: 'game' },

  // Produktivitas & Bisnis
  { id: 'zoom', name: 'Zoom', image: 'https://api.iconify.design/logos:zoom.svg', icon: '📹', color: 'bg-blue-500/20 text-blue-400', category: 'tech' },
  { id: 'slack', name: 'Slack', image: 'https://api.iconify.design/logos:slack-icon.svg', icon: '💬', color: 'bg-purple-500/20 text-purple-400', category: 'tech' },
  { id: 'dropbox', name: 'Dropbox', image: 'https://api.iconify.design/logos:dropbox.svg', icon: '📂', color: 'bg-blue-600/20 text-blue-400', category: 'tech' },
  { id: 'stripe', name: 'Stripe', image: 'https://api.iconify.design/logos:stripe.svg', icon: '💳', color: 'bg-indigo-600/20 text-indigo-400', category: 'finance' },
  { id: 'airbnb', name: 'Airbnb', image: 'https://api.iconify.design/logos:airbnb.svg', icon: '🏠', color: 'bg-pink-500/20 text-pink-400', category: 'ecommerce' },
  { id: 'lyft', name: 'Lyft', image: 'https://api.iconify.design/logos:lyft.svg', icon: '🚕', color: 'bg-pink-600/20 text-pink-400', category: 'ecommerce' },
  { id: 'bolt', name: 'Bolt', image: 'https://api.iconify.design/simple-icons:bolt.svg?color=%2334D186', icon: '⚡', color: 'bg-green-500/20 text-green-400', category: 'ecommerce' },

  // Service SA yang tidak ada di list sebelumnya
  { id: 'newzealand',  name: 'New Zealand',       icon: '🇳🇿', color: 'bg-blue-500/20 text-blue-400',   category: 'other' },
  { id: 'usnumber',    name: 'US Number',          icon: '🇺🇸', color: 'bg-red-500/20 text-red-400',     category: 'other' },
  { id: 'bandwidth',   name: 'Bandwidth',          icon: '📡',  color: 'bg-gray-500/20 text-gray-400',   category: 'other' },
  { id: 'momo',        name: 'MoMo',               image: 'https://api.iconify.design/mdi:wallet.svg?color=%23A50064',            icon: '🌸',  color: 'bg-pink-500/20 text-pink-400',   category: 'finance' },
  { id: 'zalo',        name: 'Zalo',               image: 'https://logo.clearbit.com/zalo.me',                                    icon: '💬',  color: 'bg-blue-400/20 text-blue-400',   category: 'social' },
  { id: 'linecorp',    name: 'Line Corp',          image: 'https://api.iconify.design/logos:line.svg',                            icon: '💬',  color: 'bg-green-500/20 text-green-500', category: 'social' },
  { id: 'movistar',    name: 'Movistar',           icon: '📱',  color: 'bg-blue-600/20 text-blue-500',   category: 'other' },
  { id: 'zara',        name: 'Zara',               image: 'https://logo.clearbit.com/zara.com',                                   icon: '👗',  color: 'bg-gray-700/50 text-white',      category: 'ecommerce' },
  { id: 'tokocrypto',  name: 'Tokocrypto',         image: 'https://logo.clearbit.com/tokocrypto.com',                             icon: '🪙',  color: 'bg-blue-500/20 text-blue-400',   category: 'finance' },
  { id: 'fazz',        name: 'Fazz',               image: 'https://logo.clearbit.com/fazz.com',                                   icon: '💰',  color: 'bg-green-500/20 text-green-400', category: 'finance' },
  { id: 'anyservice',  name: 'Any Service',        icon: '📱',  color: 'bg-gray-500/20 text-gray-400',   category: 'other' },
  { id: 'kakaot',      name: 'Kakao T',            image: 'https://logo.clearbit.com/kakaomobility.com',                          icon: '🚕',  color: 'bg-yellow-500/20 text-yellow-400', category: 'other' },
  // Fintech Lokal Asia
  { id: 'ovo', name: 'OVO', image: 'https://api.iconify.design/simple-icons:ovo.svg?color=%234C3494', icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  { id: 'gopay', name: 'GoPay', image: 'https://api.iconify.design/simple-icons:gojek.svg?color=%2300AA13', icon: '💚', color: 'bg-green-500/20 text-green-400', category: 'finance' },
  { id: 'dana_app', name: 'DANA', image: 'https://api.iconify.design/simple-icons:dana.svg?color=%231A8EE5', icon: '💙', color: 'bg-blue-500/20 text-blue-400', category: 'finance' },
  { id: 'linkaja', name: 'LinkAja', image: 'https://api.iconify.design/mdi:wallet.svg?color=%23E82529', icon: '❤️', color: 'bg-red-500/20 text-red-400', category: 'finance' },
  { id: 'truemoney', name: 'TrueMoney', image: 'https://api.iconify.design/mdi:wallet.svg?color=%23FF7200', icon: '💰', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  { id: 'gcash', name: 'GCash', image: 'https://api.iconify.design/simple-icons:gcash.svg?color=%230033A0', icon: '🔵', color: 'bg-blue-700/20 text-blue-400', category: 'finance' },
  { id: 'paymaya', name: 'Maya / PayMaya', image: 'https://api.iconify.design/mdi:wallet.svg?color=%2300A8E0', icon: '🟢', color: 'bg-green-600/20 text-green-400', category: 'finance' },
];

// ==========================================
// MASTER ICON MAP — covers 500+ layanan dari 5sim
// Key = nama service di 5sim (sudah di-mapServiceFrom5Sim)
// Jika tidak ada di SERVICES hardcoded, fallback ke sini
// ==========================================
const SERVICE_ICON_MAP: Record<string, { name: string; image: string; icon: string; color: string; category: string }> = {
  // Iconify CDN: gratis, 200k+ icon, tidak perlu install package
  'whatsapp':      { name: 'WhatsApp',           image: 'https://api.iconify.design/logos:whatsapp-icon.svg',                    icon: '💬', color: 'bg-green-500/20 text-green-400',   category: 'social' },
  'telegram':      { name: 'Telegram',            image: 'https://api.iconify.design/logos:telegram.svg',                         icon: '✈️', color: 'bg-blue-500/20 text-blue-400',    category: 'social' },
  'instagram':     { name: 'Instagram',           image: 'https://api.iconify.design/skill-icons:instagram.svg',                  icon: '📸', color: 'bg-pink-500/20 text-pink-400',    category: 'social' },
  'facebook':      { name: 'Facebook',            image: 'https://api.iconify.design/logos:facebook.svg',                         icon: '📘', color: 'bg-blue-600/20 text-blue-500',    category: 'social' },
  'tiktok':        { name: 'TikTok',              image: 'https://api.iconify.design/logos:tiktok-icon.svg',                      icon: '🎵', color: 'bg-gray-800 text-white',           category: 'social' },
  'twitterx':      { name: 'Twitter / X',         image: 'https://api.iconify.design/simple-icons:x.svg?color=white',             icon: '🐦', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'twitter':       { name: 'Twitter / X',         image: 'https://api.iconify.design/simple-icons:x.svg?color=white',             icon: '🐦', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'discord':       { name: 'Discord',             image: 'https://api.iconify.design/logos:discord-icon.svg',                     icon: '🎮', color: 'bg-indigo-500/20 text-indigo-400', category: 'social' },
  'snapchat':      { name: 'Snapchat',            image: 'https://api.iconify.design/fa-brands:snapchat-ghost.svg?color=%23FFFC00',icon: '👻', color: 'bg-yellow-400/20 text-yellow-400', category: 'social' },
  'viber':         { name: 'Viber',               image: 'https://api.iconify.design/fa-brands:viber.svg?color=%23665CAC',        icon: '📞', color: 'bg-purple-500/20 text-purple-500', category: 'social' },
  'wechat':        { name: 'WeChat',              image: 'https://api.iconify.design/uiw:wechat.svg?color=%2307C160',             icon: '💬', color: 'bg-green-500/20 text-green-500',   category: 'social' },
  'line':          { name: 'LINE',                image: 'https://api.iconify.design/logos:line.svg',                             icon: '💬', color: 'bg-green-500/20 text-green-500',   category: 'social' },
  'kakaotalk':     { name: 'KakaoTalk',           image: 'https://api.iconify.design/ri:kakao-talk-fill.svg?color=%23FEE500',     icon: '💬', color: 'bg-yellow-500/20 text-yellow-500', category: 'social' },
  'vk':            { name: 'VKontakte',           image: 'https://api.iconify.design/entypo-social:vk-with-circle.svg?color=%234C75A3', icon: 'V', color: 'bg-blue-500/20 text-blue-500', category: 'social' },
  'vkontakte':     { name: 'VKontakte',           image: 'https://api.iconify.design/entypo-social:vk-with-circle.svg?color=%234C75A3', icon: 'V', color: 'bg-blue-500/20 text-blue-500', category: 'social' },
  'odnoklassniki': { name: 'Odnoklassniki',       image: 'https://api.iconify.design/simple-icons:odnoklassniki.svg?color=%23EE8208', icon: '🟠', color: 'bg-orange-500/20 text-orange-500', category: 'social' },
  'ok':            { name: 'Odnoklassniki',       image: 'https://api.iconify.design/simple-icons:odnoklassniki.svg?color=%23EE8208', icon: '🟠', color: 'bg-orange-500/20 text-orange-500', category: 'social' },
  'linkedin':      { name: 'LinkedIn',            image: 'https://api.iconify.design/logos:linkedin-icon.svg',                    icon: '💼', color: 'bg-blue-700/20 text-blue-600',    category: 'social' },
  'pinterest':     { name: 'Pinterest',           image: 'https://api.iconify.design/logos:pinterest.svg',                        icon: '📌', color: 'bg-red-600/20 text-red-600',       category: 'social' },
  'reddit':        { name: 'Reddit',              image: 'https://api.iconify.design/logos:reddit-icon.svg',                      icon: '🤖', color: 'bg-orange-600/20 text-orange-500', category: 'social' },
  'tumblr':        { name: 'Tumblr',              image: 'https://api.iconify.design/logos:tumblr-icon.svg',                      icon: 'T',  color: 'bg-indigo-800/20 text-indigo-700', category: 'social' },
  'quora':         { name: 'Quora',               image: 'https://api.iconify.design/simple-icons:quora.svg?color=%23B92B27',     icon: 'Q',  color: 'bg-red-800/20 text-red-700',       category: 'social' },
  'twitch':        { name: 'Twitch',              image: 'https://api.iconify.design/logos:twitch.svg',                           icon: '📺', color: 'bg-purple-600/20 text-purple-500', category: 'social' },
  'threads':       { name: 'Threads',             image: 'https://api.iconify.design/simple-icons:threads.svg?color=white',       icon: '🧵', color: 'bg-gray-800/50 text-white',        category: 'social' },
  'signal':        { name: 'Signal',              image: 'https://api.iconify.design/simple-icons:signal.svg?color=%23316FF6',    icon: '🔒', color: 'bg-blue-500/20 text-blue-400',    category: 'social' },
  'skype':         { name: 'Skype',               image: 'https://api.iconify.design/logos:skype.svg',                            icon: '💬', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'zalo':          { name: 'Zalo',                image: 'https://api.iconify.design/simple-icons:zalo.svg?color=%230068FF',      icon: '💬', color: 'bg-blue-600/20 text-blue-500',    category: 'social' },
  'imo':           { name: 'IMO',                 image: 'https://api.iconify.design/mdi:message-video.svg?color=%2300A8FF',      icon: '📹', color: 'bg-blue-400/20 text-blue-300',    category: 'social' },
  'clubhouse':     { name: 'Clubhouse',           image: 'https://api.iconify.design/simple-icons:clubhouse.svg?color=white',     icon: '🎙️', color: 'bg-gray-700/50 text-white',      category: 'social' },
  'badoo':         { name: 'Badoo',               image: 'https://api.iconify.design/simple-icons:badoo.svg?color=%23FF4B7C',     icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'dating' },
  // Tech & Cloud
  'google':        { name: 'Google / Gmail',      image: 'https://api.iconify.design/logos:google-icon.svg',                     icon: '✉️', color: 'bg-red-500/20 text-red-400',      category: 'tech' },
  'apple':         { name: 'Apple ID',            image: 'https://api.iconify.design/mdi:apple.svg?color=white',                 icon: '🍎', color: 'bg-gray-500/20 text-gray-400',    category: 'tech' },
  'microsoft':     { name: 'Microsoft',           image: 'https://api.iconify.design/logos:microsoft-icon.svg',                   icon: '🪟', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'yahoo':         { name: 'Yahoo',               image: 'https://api.iconify.design/logos:yahoo.svg',                           icon: 'Y!', color: 'bg-purple-500/20 text-purple-500', category: 'tech' },
  'openai':        { name: 'ChatGPT / OpenAI',    image: 'https://api.iconify.design/simple-icons:openai.svg?color=white',       icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  'anthropic':     { name: 'Claude / Anthropic',  image: 'https://api.iconify.design/simple-icons:anthropic.svg?color=%23D18B65',icon: '🧠', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  'github':        { name: 'GitHub',              image: 'https://api.iconify.design/mdi:github.svg?color=white',                icon: '💻', color: 'bg-gray-700/50 text-white',       category: 'tech' },
  'amazon':        { name: 'Amazon / AWS',        image: 'https://api.iconify.design/ri:amazon-fill.svg?color=%23FF9900',        icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  'mailru':        { name: 'Mail.ru',             image: 'https://api.iconify.design/simple-icons:maildotru.svg?color=%23168DE2',icon: '@',  color: 'bg-blue-600/20 text-blue-500',    category: 'tech' },
  'yandex':        { name: 'Yandex',              image: 'https://api.iconify.design/logos:yandex-ru.svg',                       icon: 'Y',  color: 'bg-red-600/20 text-red-500',       category: 'tech' },
  'protonmail':    { name: 'ProtonMail',          image: 'https://api.iconify.design/logos:protonmail.svg',                       icon: '🔒', color: 'bg-purple-700/20 text-purple-600', category: 'tech' },
  'naver':         { name: 'Naver',               image: 'https://api.iconify.design/simple-icons:naver.svg?color=%2303C75A',    icon: 'N',  color: 'bg-green-600/20 text-green-500',   category: 'tech' },
  'azure':         { name: 'Microsoft Azure',     image: 'https://api.iconify.design/logos:microsoft-azure.svg',                 icon: '☁️', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'wise':          { name: 'Wise',                image: 'https://api.iconify.design/simple-icons:wise.svg?color=%2300B9FF',      icon: '💸', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'zoom':          { name: 'Zoom',                image: 'https://api.iconify.design/logos:zoom-icon.svg',                       icon: '📹', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'dropbox':       { name: 'Dropbox',             image: 'https://api.iconify.design/logos:dropbox.svg',                         icon: '📦', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'slack':         { name: 'Slack',               image: 'https://api.iconify.design/logos:slack-icon.svg',                      icon: '💬', color: 'bg-purple-500/20 text-purple-400', category: 'tech' },
  'notion':        { name: 'Notion',              image: 'https://api.iconify.design/simple-icons:notion.svg?color=white',       icon: '📝', color: 'bg-gray-700/50 text-white',       category: 'tech' },
  'figma':         { name: 'Figma',               image: 'https://api.iconify.design/logos:figma.svg',                           icon: '🎨', color: 'bg-pink-500/20 text-pink-400',    category: 'tech' },
  'adobe':         { name: 'Adobe',               image: 'https://api.iconify.design/logos:adobe.svg',                           icon: '🎨', color: 'bg-red-500/20 text-red-400',      category: 'tech' },
  'canva':         { name: 'Canva',               image: 'https://api.iconify.design/logos:canva.svg',                           icon: '🎨', color: 'bg-blue-400/20 text-blue-300',    category: 'tech' },
  'chatgpt':       { name: 'ChatGPT',             image: 'https://api.iconify.design/simple-icons:openai.svg?color=white',       icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  'gemini':        { name: 'Gemini / Google AI',  image: 'https://api.iconify.design/logos:google-icon.svg',                     icon: '✨', color: 'bg-blue-400/20 text-blue-300',    category: 'tech' },
  // E-Commerce
  'shopee':        { name: 'Shopee',              image: 'https://api.iconify.design/simple-icons:shopee.svg?color=white',       icon: '🛍️', color: 'bg-orange-500 text-white',        category: 'ecommerce' },
  'gojek':         { name: 'Gojek',               image: 'https://api.iconify.design/simple-icons:gojek.svg?color=white',        icon: '🏍️', color: 'bg-green-600 text-white',         category: 'ecommerce' },
  'grab':          { name: 'Grab',                image: 'https://api.iconify.design/simple-icons:grab.svg?color=%2300B14F',     icon: '🚗', color: 'bg-green-400/20 text-green-400',   category: 'ecommerce' },
  'tokopedia':     { name: 'Tokopedia',           image: 'https://api.iconify.design/tabler:shopping-bag.svg?color=%2342B549',   icon: '🦉', color: 'bg-green-500/20 text-green-500',   category: 'ecommerce' },
  'lazada':        { name: 'Lazada',              image: 'https://api.iconify.design/simple-icons:lazada.svg?color=%23F53C80',   icon: '🛍️', color: 'bg-indigo-500/20 text-indigo-400', category: 'ecommerce' },
  'alibaba':       { name: 'Alibaba / AliExpress',image: 'https://api.iconify.design/simple-icons:alibaba.svg?color=%23FF6A00', icon: '📦', color: 'bg-orange-600/20 text-orange-500', category: 'ecommerce' },
  'aliexpress':    { name: 'AliExpress',          image: 'https://api.iconify.design/simple-icons:aliexpress.svg?color=%23FF4747', icon: '📦', color: 'bg-red-500/20 text-red-400',   category: 'ecommerce' },
  'taobao':        { name: 'Taobao',              image: 'https://api.iconify.design/simple-icons:taobao.svg?color=%23FF5000',   icon: '🛒', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  'ebay':          { name: 'eBay',                image: 'https://api.iconify.design/logos:ebay.svg',                            icon: '🛒', color: 'bg-blue-500/20 text-blue-500',    category: 'ecommerce' },
  'uber':          { name: 'Uber',                image: 'https://api.iconify.design/fa-brands:uber.svg?color=white',            icon: '🚕', color: 'bg-gray-800 text-white',           category: 'ecommerce' },
  'airbnb':        { name: 'Airbnb',              image: 'https://api.iconify.design/logos:airbnb.svg',                          icon: '🏠', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'booking':       { name: 'Booking.com',         image: 'https://api.iconify.design/logos:booking-com.svg',                    icon: '🏨', color: 'bg-blue-600/20 text-blue-500',    category: 'ecommerce' },
  'shein':         { name: 'SHEIN',               image: 'https://api.iconify.design/simple-icons:shein.svg?color=white',        icon: '👗', color: 'bg-gray-800/50 text-white',       category: 'ecommerce' },
  'ozon':          { name: 'Ozon',                image: 'https://api.iconify.design/simple-icons:ozon.svg?color=%23005BFF',     icon: '📦', color: 'bg-blue-500/20 text-blue-400',    category: 'ecommerce' },
  'wildberries':   { name: 'Wildberries',         image: 'https://api.iconify.design/simple-icons:wildberries.svg?color=%23CB11AB', icon: '🛍️', color: 'bg-purple-600/20 text-purple-500', category: 'ecommerce' },
  'avito':         { name: 'Avito',               image: 'https://api.iconify.design/simple-icons:avito.svg?color=%2300AAFF',    icon: '📋', color: 'bg-blue-400/20 text-blue-300',    category: 'ecommerce' },
  'foodpanda':     { name: 'Foodpanda',           image: 'https://api.iconify.design/simple-icons:foodpanda.svg?color=%23D70F64',icon: '🐼', color: 'bg-pink-600/20 text-pink-500',    category: 'ecommerce' },
  'doordash':      { name: 'DoorDash',            image: 'https://api.iconify.design/simple-icons:doordash.svg?color=%23FF3008',  icon: '🍔', color: 'bg-red-500/20 text-red-500',     category: 'ecommerce' },
  'ubereats':      { name: 'Uber Eats',           image: 'https://api.iconify.design/simple-icons:ubereats.svg?color=%2306C167',  icon: '🍔', color: 'bg-green-500/20 text-green-500', category: 'ecommerce' },
  // Finance & Crypto
  'paypal':        { name: 'PayPal',              image: 'https://api.iconify.design/logos:paypal.svg',                          icon: '💳', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'binance':       { name: 'Binance',             image: 'https://api.iconify.design/logos:binance.svg',                         icon: '₿',  color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'coinbase':      { name: 'Coinbase',            image: 'https://api.iconify.design/logos:coinbase.svg',                        icon: '₿',  color: 'bg-blue-600/20 text-blue-500',    category: 'finance' },
  'bybit':         { name: 'Bybit',               image: 'https://api.iconify.design/simple-icons:bybit.svg?color=%23F7A600',    icon: '💰', color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'kucoin':        { name: 'KuCoin',              image: 'https://api.iconify.design/simple-icons:kucoin.svg?color=%2300A478',   icon: '💰', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'okx':           { name: 'OKX',                 image: 'https://api.iconify.design/simple-icons:okx.svg?color=white',          icon: '📈', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'kraken':        { name: 'Kraken',              image: 'https://api.iconify.design/simple-icons:kraken.svg?color=%235741D9',   icon: '🦑', color: 'bg-purple-600/20 text-purple-500', category: 'finance' },
  'mexc':          { name: 'MEXC',                image: 'https://api.iconify.design/simple-icons:mexc.svg?color=%2303B9EB',     icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'bitget':        { name: 'Bitget',              image: 'https://api.iconify.design/simple-icons:bitget.svg?color=%2300F0FF',   icon: '📊', color: 'bg-cyan-500/20 text-cyan-400',    category: 'finance' },
  'gate':          { name: 'Gate.io',             image: 'https://api.iconify.design/simple-icons:gateio.svg?color=%23E40C5B',   icon: '📊', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'huobi':         { name: 'HTX / Huobi',         image: 'https://api.iconify.design/simple-icons:huobi.svg?color=%232ED8A3',    icon: '📊', color: 'bg-teal-500/20 text-teal-400',    category: 'finance' },
  'bingx':         { name: 'BingX',               image: 'https://api.iconify.design/simple-icons:bingx.svg?color=%231DA2D8',    icon: '📊', color: 'bg-blue-400/20 text-blue-300',    category: 'finance' },
  'payoneer':      { name: 'Payoneer',            image: 'https://api.iconify.design/simple-icons:payoneer.svg?color=%23FF4800', icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'revolut':       { name: 'Revolut',             image: 'https://api.iconify.design/simple-icons:revolut.svg?color=white',      icon: '💳', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'skrill':        { name: 'Skrill',              image: 'https://api.iconify.design/simple-icons:skrill.svg?color=%23862165',   icon: '💸', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'crypto':        { name: 'Crypto.com',          image: 'https://api.iconify.design/simple-icons:cryptocom.svg?color=%2302317C',icon: '₿',  color: 'bg-blue-800/20 text-blue-700',    category: 'finance' },
  'stripe':        { name: 'Stripe',              image: 'https://api.iconify.design/logos:stripe.svg',                          icon: '💳', color: 'bg-indigo-500/20 text-indigo-400', category: 'finance' },
  'ovo':           { name: 'OVO',                 image: 'https://api.iconify.design/simple-icons:ovo.svg?color=%234C3494',      icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'dana':          { name: 'DANA',                image: 'https://api.iconify.design/simple-icons:dana.svg?color=%231A8EE5',     icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'gcash':         { name: 'GCash',               image: 'https://api.iconify.design/simple-icons:gcash.svg?color=%230078D0',    icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'truemoney':     { name: 'TrueMoney',           image: 'https://api.iconify.design/mdi:wallet.svg?color=%23FF7200',            icon: '💰', color: 'bg-orange-400/20 text-orange-400', category: 'finance' },
  'momo':          { name: 'MoMo',                image: 'https://api.iconify.design/mdi:wallet.svg?color=%23A50064',            icon: '🌸', color: 'bg-pink-500/20 text-pink-400',    category: 'finance' },
  'linkaja':       { name: 'LinkAja',             image: 'https://api.iconify.design/mdi:wallet.svg?color=%23E82529',            icon: '🔗', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'webmoney':      { name: 'WebMoney',            image: 'https://api.iconify.design/simple-icons:webmoney.svg?color=%230080FF', icon: '💰', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'qiwi':          { name: 'QIWI',                image: 'https://api.iconify.design/simple-icons:qiwi.svg?color=%23FF8C00',     icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'paymaya':       { name: 'Maya / PayMaya',      image: 'https://api.iconify.design/mdi:wallet.svg?color=%2300A8E0',            icon: '💙', color: 'bg-blue-400/20 text-blue-300',    category: 'finance' },
  // Streaming & Gaming
  'netflix':       { name: 'Netflix',             image: 'https://api.iconify.design/logos:netflix-icon.svg',                    icon: '🎬', color: 'bg-red-600/20 text-red-500',      category: 'game' },
  'spotify':       { name: 'Spotify',             image: 'https://api.iconify.design/logos:spotify-icon.svg',                    icon: '🎵', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'steam':         { name: 'Steam',               image: 'https://api.iconify.design/logos:steam.svg',                           icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'epicgames':     { name: 'Epic Games',          image: 'https://api.iconify.design/simple-icons:epicgames.svg?color=white',    icon: '🎮', color: 'bg-gray-800 text-white',           category: 'game' },
  'xbox':          { name: 'Xbox',                image: 'https://api.iconify.design/logos:xbox.svg',                            icon: '🎮', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'playstation':   { name: 'PlayStation',         image: 'https://api.iconify.design/logos:playstation.svg',                     icon: '🕹️', color: 'bg-blue-600/20 text-blue-500',   category: 'game' },
  'nintendo':      { name: 'Nintendo',            image: 'https://api.iconify.design/logos:nintendo.svg',                        icon: '🕹️', color: 'bg-red-500/20 text-red-400',     category: 'game' },
  'blizzard':      { name: 'Blizzard',            image: 'https://api.iconify.design/simple-icons:blizzard.svg?color=%0074D1FF', icon: '❄️', color: 'bg-blue-400/20 text-blue-300',    category: 'game' },
  'roblox':        { name: 'Roblox',              image: 'https://api.iconify.design/logos:roblox.svg',                          icon: '🧱', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'disneyplus':    { name: 'Disney+',             image: 'https://api.iconify.design/logos:disney-plus.svg',                     icon: '🏰', color: 'bg-blue-700/20 text-blue-600',    category: 'game' },
  'hulu':          { name: 'Hulu',                image: 'https://api.iconify.design/simple-icons:hulu.svg?color=%231CE783',     icon: '📺', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'hbo':           { name: 'HBO / Max',           image: 'https://api.iconify.design/simple-icons:hbo.svg?color=%23A020F0',      icon: '📺', color: 'bg-purple-600/20 text-purple-500', category: 'game' },
  'deezer':        { name: 'Deezer',              image: 'https://api.iconify.design/simple-icons:deezer.svg?color=%23EF5466',   icon: '🎵', color: 'bg-pink-500/20 text-pink-400',    category: 'game' },
  'crunchyroll':   { name: 'Crunchyroll',         image: 'https://api.iconify.design/simple-icons:crunchyroll.svg?color=%23F47521', icon: '⛩️', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  'tidal':         { name: 'Tidal',               image: 'https://api.iconify.design/simple-icons:tidal.svg?color=white',        icon: '🎵', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'garena':        { name: 'Garena / Free Fire',  image: 'https://api.iconify.design/simple-icons:garena.svg?color=%23EF2929',   icon: '🔥', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'supercell':     { name: 'Supercell',           image: 'https://api.iconify.design/mdi:gamepad-variant.svg?color=%2300B3F0',   icon: '🏆', color: 'bg-blue-400/20 text-blue-300',    category: 'game' },
  'ea':            { name: 'EA / Origin',         image: 'https://api.iconify.design/simple-icons:ea.svg?color=%23FF4747',       icon: '🎮', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'ubisoft':       { name: 'Ubisoft',             image: 'https://api.iconify.design/simple-icons:ubisoft.svg?color=white',      icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'faceit':        { name: 'FACEIT',              image: 'https://api.iconify.design/simple-icons:faceit.svg?color=%23FF5500',   icon: '🎮', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  // Dating
  'tinder':        { name: 'Tinder',              image: 'https://api.iconify.design/logos:tinder.svg',                          icon: '🔥', color: 'bg-red-500/20 text-red-400',      category: 'dating' },
  'bumble':        { name: 'Bumble',              image: 'https://api.iconify.design/simple-icons:bumble.svg?color=%23F1CB00',   icon: '🐝', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'hinge':         { name: 'Hinge',               image: 'https://api.iconify.design/simple-icons:hinge.svg?color=%23E8503A',    icon: '❤️', color: 'bg-red-500/20 text-red-400',     category: 'dating' },
  'match':         { name: 'Match.com',           image: 'https://api.iconify.design/mdi:heart.svg?color=%23E8503A',             icon: '💕', color: 'bg-red-400/20 text-red-400',      category: 'dating' },
  'okcupid':       { name: 'OkCupid',             image: 'https://api.iconify.design/mdi:heart-multiple.svg?color=%234BB3E8',    icon: '💙', color: 'bg-blue-400/20 text-blue-300',    category: 'dating' },
  'grindr':        { name: 'Grindr',              image: 'https://api.iconify.design/simple-icons:grindr.svg?color=%23F5821F',   icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'pof':           { name: 'POF',                 image: 'https://api.iconify.design/mdi:fish.svg?color=%231E88E5',              icon: '🐟', color: 'bg-blue-500/20 text-blue-400',    category: 'dating' },
  'meetic':        { name: 'Meetic',              image: 'https://api.iconify.design/mdi:heart.svg?color=%23E8253A',             icon: '💗', color: 'bg-red-500/20 text-red-400',      category: 'dating' },
  // Alibaba Group & China Platform
  'alipay':        { name: 'Alipay / Alibaba / 1688', image: 'https://api.iconify.design/simple-icons:alipay.svg?color=%231677FF', icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'ecommerce' },
  'baidu':         { name: 'Baidu',              image: 'https://api.iconify.design/simple-icons:baidu.svg?color=%232932E1',        icon: '🔍', color: 'bg-blue-600/20 text-blue-500',    category: 'tech' },
  'youtube':       { name: 'YouTube',            image: 'https://api.iconify.design/logos:youtube-icon.svg',                        icon: '▶️', color: 'bg-red-600/20 text-red-500',      category: 'social' },
  'bukalapak':     { name: 'Bukalapak',          image: 'https://api.iconify.design/simple-icons:bukalapak.svg?color=%23E11F26',    icon: '🛒', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'alfagift':      { name: 'Alfagift',           image: 'https://logo.clearbit.com/alfagift.id',                                        icon: '🏪', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  // Layanan SA Indonesia yang sering muncul di katalog
  'kfc':           { name: 'KFC',                 image: 'https://logo.clearbit.com/kfc.co.id',                                             icon: '🍗', color: 'bg-red-600/20 text-red-500',      category: 'ecommerce' },
  'starbucks':     { name: 'Starbucks',           image: 'https://logo.clearbit.com/starbucks.co.id',                                       icon: '☕', color: 'bg-green-700/20 text-green-500',   category: 'ecommerce' },
  'ukrnet':        { name: 'Ukrnet',              image: 'https://logo.clearbit.com/ukr.net',                                               icon: '📧', color: 'bg-blue-600/20 text-blue-400',    category: 'tech' },
  'bazos':         { name: 'Bazos',               image: 'https://logo.clearbit.com/bazos.cz',                                              icon: '🛒', color: 'bg-orange-500/20 text-orange-400', category: 'ecommerce' },
  'jd':            { name: 'JD.com',             image: 'https://api.iconify.design/simple-icons:jd.svg?color=%23E1251B',           icon: '📦', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'pinduoduo':     { name: 'Pinduoduo / Temu',   image: 'https://api.iconify.design/simple-icons:pinduoduo.svg?color=%23E02020',    icon: '🛒', color: 'bg-red-600/20 text-red-500',      category: 'ecommerce' },
  'meituan':       { name: 'Meituan',            image: 'https://api.iconify.design/simple-icons:meituan.svg?color=%23FFD100',      icon: '🚴', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'xiaohongshu':   { name: 'Xiaohongshu (RED)',  image: 'https://api.iconify.design/simple-icons:xiaohongshu.svg?color=%23FF2442',  icon: '📕', color: 'bg-red-500/20 text-red-400',      category: 'social' },
  'douyin':        { name: 'Douyin (TikTok CN)', image: 'https://api.iconify.design/logos:tiktok-icon.svg',                         icon: '🎵', color: 'bg-gray-800 text-white',           category: 'social' },
  'kwai':          { name: 'Kwai',               image: 'https://api.iconify.design/simple-icons:kwai.svg?color=%23FFCC00',         icon: '🎬', color: 'bg-yellow-500/20 text-yellow-400', category: 'social' },
  'kuaishou':      { name: 'Kuaishou',           image: 'https://api.iconify.design/simple-icons:kuaishou.svg?color=%23FF4906',     icon: '🎥', color: 'bg-orange-500/20 text-orange-400', category: 'social' },
  'bilibili':      { name: 'Bilibili',           image: 'https://api.iconify.design/simple-icons:bilibili.svg?color=%2300A1D6',     icon: '📺', color: 'bg-cyan-500/20 text-cyan-400',    category: 'social' },
  'capcut':        { name: 'CapCut',             image: 'https://api.iconify.design/simple-icons:capcut.svg?color=white',           icon: '✂️', color: 'bg-gray-800 text-white',           category: 'tech' },
  // Finance tambahan
  'neteller':      { name: 'Neteller',           image: 'https://api.iconify.design/simple-icons:neteller.svg?color=%238BB031',     icon: '💳', color: 'bg-green-600/20 text-green-500',   category: 'finance' },
  'perfectmoney':  { name: 'PerfectMoney',       image: 'https://logo.clearbit.com/perfectmoney.com', icon: 'PM', color: 'bg-red-600/20 text-red-500',                                                                                           category: 'finance' },
  'payeer':        { name: 'Payeer',             image: 'https://api.iconify.design/simple-icons:payeer.svg?color=%23008DE4',       icon: 'P',  color: 'bg-blue-400/20 text-blue-400',    category: 'finance' },
  // Transport & Ride-hailing
  'indriver':      { name: 'InDrive',            image: 'https://logo.clearbit.com/indrive.com',                                    icon: '🚗', color: 'bg-yellow-400/20 text-yellow-400', category: 'ecommerce' },
  'indrive':       { name: 'InDrive',            image: 'https://logo.clearbit.com/indrive.com',                                    icon: '🚗', color: 'bg-yellow-400/20 text-yellow-400', category: 'ecommerce' },
  // Trading
  'tradingview':   { name: 'TradingView',        image: 'https://logo.clearbit.com/tradingview.com',                                icon: '📈', color: 'bg-blue-500/20 text-blue-400',    category: 'finance'   },
  // AI
  'claudeai':      { name: 'Claude AI',          image: 'https://api.iconify.design/simple-icons:anthropic.svg?color=%23D18B65',    icon: '🧠', color: 'bg-orange-500/20 text-orange-400', category: 'tech'      },
  // Alias & entri tambahan untuk SA provider names
  'dana_app':      { name: 'DANA',              image: 'https://api.iconify.design/simple-icons:dana.svg?color=%231A8EE5',     icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'advcash':       { name: 'AdvCash',           image: 'https://logo.clearbit.com/advcash.com',                               icon: 'A',  color: 'bg-green-500/20 text-green-500',   category: 'finance' },
  'tokocrypto':    { name: 'Tokocrypto',        image: 'https://logo.clearbit.com/tokocrypto.com',                            icon: '🪙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'fazz':          { name: 'Fazz',             image: 'https://logo.clearbit.com/fazz.com',                                   icon: '💰', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'kakaot':        { name: 'Kakao T',           image: 'https://logo.clearbit.com/kakaomobility.com',                         icon: '🚕', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'zara':          { name: 'Zara',              image: 'https://logo.clearbit.com/zara.com',                                  icon: '👗', color: 'bg-gray-700/50 text-white',        category: 'ecommerce' },
  'zalo':          { name: 'Zalo',              image: 'https://logo.clearbit.com/zalo.me',                                   icon: '💬', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'gopay':         { name: 'GoPay',             image: 'https://api.iconify.design/simple-icons:gojek.svg?color=%2300AA13',   icon: '💚', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'maya':          { name: 'Maya / PayMaya',    image: 'https://api.iconify.design/mdi:wallet.svg?color=%2300A8E0',           icon: '🟢', color: 'bg-green-600/20 text-green-400',   category: 'finance' },
  'gate_io':       { name: 'Gate.io',           image: 'https://api.iconify.design/simple-icons:gateio.svg?color=%23E40C5B', icon: '📊', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  // ── Alias & entri baru untuk service yang sering muncul dari live API ──
  'cryptocom':     { name: 'Crypto.com',        image: 'https://logo.clearbit.com/crypto.com',                             icon: '🔵', color: 'bg-blue-600/20 text-blue-400',    category: 'finance' },
  'crypto.com':    { name: 'Crypto.com',        image: 'https://logo.clearbit.com/crypto.com',                             icon: '🔵', color: 'bg-blue-600/20 text-blue-400',    category: 'finance' },
  'subito':        { name: 'Subito.it',         image: 'https://logo.clearbit.com/subito.it',                              icon: '🛒', color: 'bg-orange-500/20 text-orange-400', category: 'ecommerce' },
  'swiggy':        { name: 'Swiggy',            image: 'https://logo.clearbit.com/swiggy.com',                             icon: '🍔', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  'papara':        { name: 'Papara',            image: 'https://logo.clearbit.com/papara.com',                             icon: '💜', color: 'bg-purple-600/20 text-purple-400', category: 'finance' },
  'mcdonalds':     { name: "McDonald's",        image: 'https://logo.clearbit.com/mcdonalds.com',                          icon: '🍟', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'mcdonald':      { name: "McDonald's",        image: 'https://logo.clearbit.com/mcdonalds.com',                          icon: '🍟', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'clubhouse':     { name: 'Clubhouse',         image: 'https://logo.clearbit.com/clubhouse.com',                          icon: '🎙️', color: 'bg-yellow-400/20 text-yellow-300', category: 'social' },
  'fiverr':        { name: 'Fiverr',            image: 'https://logo.clearbit.com/fiverr.com',                             icon: '💚', color: 'bg-green-500/20 text-green-400',   category: 'ecommerce' },
  'freelancer':    { name: 'Freelancer',        image: 'https://logo.clearbit.com/freelancer.com',                         icon: '💼', color: 'bg-blue-500/20 text-blue-400',    category: 'ecommerce' },
  'foodora':       { name: 'Foodora',           image: 'https://logo.clearbit.com/foodora.com',                            icon: '🍱', color: 'bg-pink-600/20 text-pink-400',    category: 'ecommerce' },
  'oldubil':       { name: 'Oldubil',           image: 'https://logo.clearbit.com/oldubil.com',                            icon: '📱', color: 'bg-blue-400/20 text-blue-300',    category: 'other' },
  'iqos':          { name: 'IQOS',             image: 'https://logo.clearbit.com/iqos.com',                               icon: '🔵', color: 'bg-teal-500/20 text-teal-400',    category: 'other' },
  'vfsglobal':     { name: 'VFS Global',        image: 'https://logo.clearbit.com/vfsglobal.com',                          icon: '🌍', color: 'bg-blue-700/20 text-blue-500',    category: 'other' },
  'vfs':           { name: 'VFS Global',        image: 'https://logo.clearbit.com/vfsglobal.com',                          icon: '🌍', color: 'bg-blue-700/20 text-blue-500',    category: 'other' },
  'protonmail':    { name: 'ProtonMail',        image: 'https://logo.clearbit.com/proton.me',                              icon: '🔒', color: 'bg-purple-700/20 text-purple-500', category: 'tech' },
  'steam':         { name: 'Steam',            image: 'https://logo.clearbit.com/steampowered.com',                       icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'netflix':       { name: 'Netflix',          image: 'https://logo.clearbit.com/netflix.com',                            icon: '🎬', color: 'bg-red-600/20 text-red-500',      category: 'game' },
  'spotify':       { name: 'Spotify',          image: 'https://logo.clearbit.com/spotify.com',                            icon: '🎵', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'blizzard':      { name: 'Blizzard',         image: 'https://logo.clearbit.com/blizzard.com',                           icon: '🎮', color: 'bg-blue-500/20 text-blue-400',    category: 'game' },
  'roblox':        { name: 'Roblox',           image: 'https://logo.clearbit.com/roblox.com',                             icon: '🧱', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'nintendo':      { name: 'Nintendo',         image: 'https://logo.clearbit.com/nintendo.com',                           icon: '🎮', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'playstation':   { name: 'PlayStation',      image: 'https://logo.clearbit.com/playstation.com',                        icon: '🎮', color: 'bg-blue-600/20 text-blue-500',    category: 'game' },
  'disneyplus':    { name: 'Disney+',          image: 'https://logo.clearbit.com/disneyplus.com',                         icon: '🏰', color: 'bg-blue-700/20 text-blue-500',    category: 'game' },
  'hbo':           { name: 'HBO / Max',        image: 'https://logo.clearbit.com/hbomax.com',                             icon: '🎬', color: 'bg-purple-700/20 text-purple-500', category: 'game' },
  'epicgames':     { name: 'Epic Games',       image: 'https://logo.clearbit.com/epicgames.com',                          icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'supercell':     { name: 'Supercell',        image: 'https://logo.clearbit.com/supercell.com',                          icon: '🎮', color: 'bg-blue-400/20 text-blue-300',    category: 'game' },
  'garena':        { name: 'Garena',           image: 'https://logo.clearbit.com/garena.com',                             icon: '🎮', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  'uber':          { name: 'Uber',             image: 'https://logo.clearbit.com/uber.com',                               icon: '🚕', color: 'bg-gray-800 text-white',           category: 'ecommerce' },
  'lyft':          { name: 'Lyft',             image: 'https://logo.clearbit.com/lyft.com',                               icon: '🚗', color: 'bg-pink-500/20 text-pink-400',    category: 'ecommerce' },
  'airbnb':        { name: 'Airbnb',           image: 'https://logo.clearbit.com/airbnb.com',                             icon: '🏠', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'booking':       { name: 'Booking.com',      image: 'https://logo.clearbit.com/booking.com',                            icon: '🏨', color: 'bg-blue-600/20 text-blue-500',    category: 'ecommerce' },
  'payoneer':      { name: 'Payoneer',         image: 'https://logo.clearbit.com/payoneer.com',                           icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'revolut':       { name: 'Revolut',          image: 'https://logo.clearbit.com/revolut.com',                            icon: '💳', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'wise':          { name: 'Wise',             image: 'https://logo.clearbit.com/wise.com',                               icon: '💸', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'stripe':        { name: 'Stripe',           image: 'https://logo.clearbit.com/stripe.com',                             icon: '💳', color: 'bg-indigo-500/20 text-indigo-400', category: 'finance' },
  'kraken':        { name: 'Kraken',           image: 'https://logo.clearbit.com/kraken.com',                             icon: '🐙', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'kucoin':        { name: 'KuCoin',           image: 'https://logo.clearbit.com/kucoin.com',                             icon: '💰', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'okx':           { name: 'OKX',              image: 'https://logo.clearbit.com/okx.com',                                icon: '📊', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'mexc':          { name: 'MEXC',             image: 'https://logo.clearbit.com/mexc.com',                               icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'bitget':        { name: 'Bitget',           image: 'https://logo.clearbit.com/bitget.com',                             icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'gate':          { name: 'Gate.io',          image: 'https://logo.clearbit.com/gate.io',                                icon: '📊', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'huobi':         { name: 'HTX (Huobi)',      image: 'https://logo.clearbit.com/htx.com',                                icon: '📊', color: 'bg-blue-400/20 text-blue-300',    category: 'finance' },
  'bingx':         { name: 'BingX',            image: 'https://logo.clearbit.com/bingx.com',                              icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'bybit':         { name: 'Bybit',            image: 'https://logo.clearbit.com/bybit.com',                              icon: '💰', color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'binance':       { name: 'Binance',          image: 'https://logo.clearbit.com/binance.com',                            icon: '₿',  color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'coinbase':      { name: 'Coinbase',         image: 'https://logo.clearbit.com/coinbase.com',                           icon: '₿',  color: 'bg-blue-600/20 text-blue-500',    category: 'finance' },
  'paypal':        { name: 'PayPal',           image: 'https://logo.clearbit.com/paypal.com',                             icon: '💳', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'dana':          { name: 'DANA',             image: 'https://logo.clearbit.com/dana.id',                                icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'ovo':           { name: 'OVO',              image: 'https://logo.clearbit.com/ovo.id',                                 icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'gcash':         { name: 'GCash',            image: 'https://logo.clearbit.com/gcash.com',                              icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'truemoney':     { name: 'TrueMoney',        image: 'https://logo.clearbit.com/truemoney.com',                          icon: '💰', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'momo':          { name: 'MoMo',             image: 'https://logo.clearbit.com/momo.vn',                                icon: '💜', color: 'bg-pink-500/20 text-pink-400',    category: 'finance' },
  'linkaja':       { name: 'LinkAja',          image: 'https://logo.clearbit.com/linkaja.com',                            icon: '❤️', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'tinder':        { name: 'Tinder',           image: 'https://logo.clearbit.com/tinder.com',                             icon: '🔥', color: 'bg-orange-500/20 text-orange-400', category: 'dating' },
  'bumble':        { name: 'Bumble',           image: 'https://logo.clearbit.com/bumble.com',                             icon: '🐝', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'hinge':         { name: 'Hinge',            image: 'https://logo.clearbit.com/hinge.co',                               icon: '💗', color: 'bg-rose-500/20 text-rose-400',    category: 'dating' },
  'badoo':         { name: 'Badoo',            image: 'https://logo.clearbit.com/badoo.com',                              icon: '🟣', color: 'bg-purple-500/20 text-purple-400', category: 'dating' },
  'okcupid':       { name: 'OkCupid',          image: 'https://logo.clearbit.com/okcupid.com',                            icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'dating' },
  'match':         { name: 'Match',            image: 'https://logo.clearbit.com/match.com',                              icon: '💗', color: 'bg-red-500/20 text-red-400',      category: 'dating' },
  'grindr':        { name: 'Grindr',           image: 'https://logo.clearbit.com/grindr.com',                             icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'pof':           { name: 'POF',              image: 'https://logo.clearbit.com/pof.com',                                icon: '🐟', color: 'bg-blue-500/20 text-blue-400',    category: 'dating' },
  'google':        { name: 'Google / Gmail',   image: 'https://logo.clearbit.com/google.com',                             icon: '✉️', color: 'bg-red-500/20 text-red-400',      category: 'tech' },
  'apple':         { name: 'Apple ID',         image: 'https://logo.clearbit.com/apple.com',                              icon: '🍎', color: 'bg-gray-500/20 text-gray-400',    category: 'tech' },
  'microsoft':     { name: 'Microsoft',        image: 'https://logo.clearbit.com/microsoft.com',                          icon: '🪟', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'openai':        { name: 'ChatGPT / OpenAI', image: 'https://logo.clearbit.com/openai.com',                             icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  'github':        { name: 'GitHub',           image: 'https://logo.clearbit.com/github.com',                             icon: '💻', color: 'bg-gray-700/50 text-white',       category: 'tech' },
  'amazon':        { name: 'Amazon',           image: 'https://logo.clearbit.com/amazon.com',                             icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  'shopee':        { name: 'Shopee',           image: 'https://logo.clearbit.com/shopee.co.id',                           icon: '🛍️', color: 'bg-orange-500 text-white',        category: 'ecommerce' },
  'gojek':         { name: 'Gojek',            image: 'https://logo.clearbit.com/gojek.com',                              icon: '🏍️', color: 'bg-green-600 text-white',         category: 'ecommerce' },
  'grab':          { name: 'Grab',             image: 'https://logo.clearbit.com/grab.com',                               icon: '🚗', color: 'bg-green-400/20 text-green-400',   category: 'ecommerce' },
  'tokopedia':     { name: 'Tokopedia',        image: 'https://logo.clearbit.com/tokopedia.com',                          icon: '🦉', color: 'bg-green-500/20 text-green-500',   category: 'ecommerce' },
  'lazada':        { name: 'Lazada',           image: 'https://logo.clearbit.com/lazada.com',                             icon: '🛍️', color: 'bg-indigo-500/20 text-indigo-400', category: 'ecommerce' },
  'whatsapp':      { name: 'WhatsApp',         image: 'https://logo.clearbit.com/whatsapp.com',                           icon: '💬', color: 'bg-green-500/20 text-green-400',   category: 'social' },
  'telegram':      { name: 'Telegram',         image: 'https://logo.clearbit.com/telegram.org',                           icon: '✈️', color: 'bg-blue-500/20 text-blue-400',    category: 'social' },
  'instagram':     { name: 'Instagram',        image: 'https://logo.clearbit.com/instagram.com',                          icon: '📸', color: 'bg-pink-500/20 text-pink-400',    category: 'social' },
  'facebook':      { name: 'Facebook',         image: 'https://logo.clearbit.com/facebook.com',                           icon: '📘', color: 'bg-blue-600/20 text-blue-500',    category: 'social' },
  'tiktok':        { name: 'TikTok',           image: 'https://logo.clearbit.com/tiktok.com',                             icon: '🎵', color: 'bg-gray-800 text-white',           category: 'social' },
  'twitter':       { name: 'Twitter / X',      image: 'https://logo.clearbit.com/x.com',                                  icon: '🐦', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'discord':       { name: 'Discord',          image: 'https://logo.clearbit.com/discord.com',                            icon: '🎮', color: 'bg-indigo-500/20 text-indigo-400', category: 'social' },
};

// ==========================================
// DOMAIN MAP — serviceId → domain website
// Dipakai untuk auto-fetch logo via Clearbit
// Tambah entry baru kapan saja tanpa ubah UI
// ==========================================
const SERVICE_DOMAIN_MAP: Record<string, string> = {
  // Social
  'whatsapp':'whatsapp.com','telegram':'telegram.org','instagram':'instagram.com',
  'facebook':'facebook.com','tiktok':'tiktok.com','twitterx':'x.com','twitter':'x.com',
  'discord':'discord.com','snapchat':'snapchat.com','viber':'viber.com','wechat':'wechat.com',
  'line':'line.me','kakaotalk':'kakao.com','vk':'vk.com','vkontakte':'vk.com',
  'odnoklassniki':'ok.ru','ok':'ok.ru','linkedin':'linkedin.com','pinterest':'pinterest.com',
  'reddit':'reddit.com','tumblr':'tumblr.com','quora':'quora.com','twitch':'twitch.tv',
  'threads':'threads.net','signal':'signal.org','skype':'skype.com','zalo':'zalo.me',
  'imo':'imo.im','clubhouse':'clubhouse.com','badoo':'badoo.com','meetme':'meetme.com',
  'tagged':'tagged.com','mamba':'mamba.ru','lovoo':'lovoo.com','happn':'happn.com',
  // Tech
  'google':'google.com','apple':'apple.com','microsoft':'microsoft.com','yahoo':'yahoo.com',
  'openai':'openai.com','anthropic':'anthropic.com','github':'github.com','amazon':'amazon.com',
  'mailru':'mail.ru','yandex':'yandex.ru','protonmail':'proton.me','naver':'naver.com',
  'azure':'azure.microsoft.com','zoom':'zoom.us','dropbox':'dropbox.com','slack':'slack.com',
  'notion':'notion.so','figma':'figma.com','adobe':'adobe.com','canva':'canva.com',
  'chatgpt':'chat.openai.com','gemini':'gemini.google.com','stripe':'stripe.com',
  'shopify':'shopify.com','wordpress':'wordpress.com','wix':'wix.com','squarespace':'squarespace.com',
  'godaddy':'godaddy.com','namecheap':'namecheap.com','cloudflare':'cloudflare.com',
  'digitalocean':'digitalocean.com','linode':'linode.com','vultr':'vultr.com',
  'twilio':'twilio.com','sendgrid':'sendgrid.com','mailchimp':'mailchimp.com',
  'hubspot':'hubspot.com','salesforce':'salesforce.com','zendesk':'zendesk.com',
  'intercom':'intercom.com','freshdesk':'freshdesk.com','jira':'atlassian.com',
  'trello':'trello.com','asana':'asana.com','monday':'monday.com',
  // E-Commerce
  'shopee':'shopee.co.id','gojek':'gojek.com','grab':'grab.com','tokopedia':'tokopedia.com',
  'lazada':'lazada.com','alibaba':'alibaba.com','aliexpress':'aliexpress.com',
  'taobao':'taobao.com','ebay':'ebay.com','uber':'uber.com','airbnb':'airbnb.com',
  'booking':'booking.com','shein':'shein.com','ozon':'ozon.ru','wildberries':'wildberries.ru',
  'avito':'avito.ru','foodpanda':'foodpanda.com','doordash':'doordash.com',
  'ubereats':'ubereats.com','grubhub':'grubhub.com','deliveroo':'deliveroo.com',
  'lyft':'lyft.com','bolt':'bolt.eu','rappi':'rappi.com','ifood':'ifood.com.br',
  'swiggy':'swiggy.com','zomato':'zomato.com','meituan':'meituan.com',
  'mercadolibre':'mercadolibre.com','flipkart':'flipkart.com','meesho':'meesho.com',
  'amazon_video':'primevideo.com','jd':'jd.com','pinduoduo':'pinduoduo.com',
  'alipay':'alipay.com','alfagift':'alfagift.id','bukalapak':'bukalapak.com','meituan':'meituan.com',
  'xiaohongshu':'xiaohongshu.com','douyin':'douyin.com','kwai':'kwai.com',
  'kuaishou':'kuaishou.com','bilibili':'bilibili.com','capcut':'capcut.com',
  'baidu':'baidu.com','youtube':'youtube.com','neteller':'neteller.com',
  'perfectmoney':'perfectmoney.com','payeer':'payeer.com',
  // Finance & Crypto  
  'paypal':'paypal.com','binance':'binance.com','coinbase':'coinbase.com',
  'bybit':'bybit.com','kucoin':'kucoin.com','okx':'okx.com','kraken':'kraken.com',
  'mexc':'mexc.com','bitget':'bitget.com','gate':'gate.io','huobi':'huobi.com',
  'bingx':'bingx.com','payoneer':'payoneer.com','revolut':'revolut.com',
  'skrill':'skrill.com','crypto':'crypto.com','wise':'wise.com',
  'transferwise':'wise.com','webmoney':'webmoney.ru','qiwi':'qiwi.com',
  'ovo':'ovo.id','dana':'dana.id','gcash':'gcash.com','truemoney':'truemoney.com',
  'momo':'momo.vn','linkaja':'linkaja.com','paymaya':'maya.ph','gopay':'gojek.com',
  'dana_app':'dana.id','neteller':'neteller.com','payeer':'payeer.com',
  'skrill':'skrill.com','perfectmoney':'perfectmoney.com','paxful':'paxful.com',
  'remitly':'remitly.com','moneygram':'moneygram.com','westernunion':'westernunion.com',
  'monzo':'monzo.com','n26':'n26.com','chime':'chime.com','cash_app':'cash.app',
  'venmo':'venmo.com','zelle':'zellepay.com','robinhood':'robinhood.com',
  'etoro':'etoro.com','trading212':'trading212.com','plus500':'plus500.com',
  // Streaming & Gaming
  'netflix':'netflix.com','spotify':'spotify.com','steam':'store.steampowered.com',
  'epicgames':'epicgames.com','xbox':'xbox.com','playstation':'playstation.com',
  'nintendo':'nintendo.com','blizzard':'blizzard.com','roblox':'roblox.com',
  'disneyplus':'disneyplus.com','hulu':'hulu.com','hbo':'hbomax.com','deezer':'deezer.com',
  'crunchyroll':'crunchyroll.com','tidal':'tidal.com','garena':'garena.com',
  'supercell':'supercell.com','ea':'ea.com','ubisoft':'ubisoft.com','faceit':'faceit.com',
  'twitch':'twitch.tv','youtube':'youtube.com','vimeo':'vimeo.com',
  'soundcloud':'soundcloud.com','bandcamp':'bandcamp.com','apple_music':'music.apple.com',
  'amazon_music':'music.amazon.com','pandora':'pandora.com','iheart':'iheart.com',
  'paramount':'paramountplus.com','peacock':'peacocktv.com','discovery':'discoveryplus.com',
  'funimation':'funimation.com','vrv':'vrv.co','aniwatch':'aniwatch.to',
  'valorant':'playvalorant.com','leagueoflegends':'leagueoflegends.com',
  'dota2':'dota2.com','csgo':'store.steampowered.com','minecraft':'minecraft.net',
  'fortnite':'epicgames.com','pubg':'pubg.com','freefire':'ff.garena.com',
  'mobilelegends':'mobilelegends.com','genshin':'genshin.hoyoverse.com',
  'cococ':'coccoc.com','wattpad':'wattpad.com',
  // Dating
  'tinder':'tinder.com','bumble':'bumble.com','hinge':'hinge.co','match':'match.com',
  'okcupid':'okcupid.com','grindr':'grindr.com','pof':'pof.com','meetic':'meetic.com',
  'lovoo':'lovoo.com','happn':'happn.com','zoosk':'zoosk.com','eharmony':'eharmony.com',
  'meetme':'meetme.com','mamba':'mamba.ru',
  // Alias & tambahan baru
  'cryptocom':'crypto.com','crypto.com':'crypto.com',
  'subito':'subito.it','swiggy':'swiggy.com','papara':'papara.com',
  'mcdonalds':'mcdonalds.com','mcdonald':'mcdonalds.com',
  'clubhouse':'clubhouse.com','fiverr':'fiverr.com','freelancer':'freelancer.com',
  'foodora':'foodora.com','oldubil':'oldubil.com','iqos':'iqos.com',
  'vfsglobal':'vfsglobal.com','vfs':'vfsglobal.com',
  'bazos':'bazos.cz','indrive':'indrive.com','indriver':'indrive.com',
  'tradingview':'tradingview.com','zara':'zara.com','kakaot':'kakaomobility.com',
  'advcash':'advcash.com','tokocrypto':'tokocrypto.com','fazz':'fazz.com',
  'kfc':'kfc.com','starbucks':'starbucks.com','alfagift':'alfagift.id',
  'dana_app':'dana.id','gopay':'gojek.com','momo':'momo.vn',
  'ovo':'ovo.id','dana':'dana.id','gcash':'gcash.com','truemoney':'truemoney.com',
  'linkaja':'linkaja.com','paymaya':'maya.ph',
};

// ==========================================
// Helper: dapatkan URL logo terbaik untuk suatu service
// Urutan: Clearbit (kualitas tinggi) → Google Favicon (fallback)
// ==========================================
const getLogoUrl = (serviceId: string): string | null => {
  const domain = SERVICE_DOMAIN_MAP[serviceId];
  if (!domain) return null;
  // Clearbit Logo API: gratis, kualitas tinggi, cover ribuan brand
  return `https://logo.clearbit.com/${domain}`;
};

// Fungsi helper: ambil metadata layanan lengkap
const getServiceMeta = (serviceId: string) => {
  // 1. Coba dari SERVICES hardcoded (prioritas tertinggi)
  const known = SERVICES.find(s => s.id === serviceId);
  if (known) return known;
  // 2. Coba dari SERVICE_ICON_MAP
  const mapped = SERVICE_ICON_MAP[serviceId];
  if (mapped) return { id: serviceId, ...mapped };
  // 3. Auto-generate: nama cantik + logo dari domain map
  const logoUrl = getLogoUrl(serviceId);
  return {
    id: serviceId,
    name: serviceId.split('_').map((w:string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    icon: '📱',
    color: 'bg-gray-700/50 text-gray-300',
    category: 'other',
    image: logoUrl, // null jika domain tidak diketahui
  };
};

// Fungsi helper: ambil metadata layanan untuk produk Server 2 (SMS-Activate).
// Prioritaskan saName dari API untuk menghindari mismatch icon akibat pemetaan
// kode SA yang ambigu (mis: "hb" → "hbo" padahal nama aslinya Hepsiburada.com).
const getSAServiceMeta = (serviceId: string, saName?: string) => {
  if (!saName) return getServiceMeta(serviceId);

  const saNameLower = saName.toLowerCase();

  // 1. Exact name match di SERVICES
  const exactMatch = SERVICES.find(s => s.name.toLowerCase() === saNameLower);
  if (exactMatch) return { ...exactMatch, name: saName };

  // 2. Partial match: saName contains a known service name or vice-versa
  const partialMatch = SERVICES.find(s =>
    saNameLower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(saNameLower)
  );
  if (partialMatch) return { ...partialMatch, name: saName };

  // 3. Coba Clearbit dari domain yang ada di saName (mis: "Hepsiburada.com" → logo.clearbit.com/hepsiburada.com)
  const domainMatch = saName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
  const clearbitLogo = domainMatch
    ? `https://logo.clearbit.com/${domainMatch[1].toLowerCase()}`
    : null;

  // 4. Fallback ke baseMeta, ganti nama + logo jika ada domain di saName
  const baseMeta = getServiceMeta(serviceId);
  return {
    ...baseMeta,
    name: saName,
    image: clearbitLogo ?? baseMeta.image,
  };
};

const CATEGORIES = [
  { id: 'all', label: 'Semua' },
  { id: 'social', label: 'Sosial Media' },
  { id: 'tech', label: 'Tech & Akun' },
  { id: 'ecommerce', label: 'E-Commerce' },
  { id: 'game', label: 'Gaming & Hiburan' },
  { id: 'finance', label: 'Keuangan & Crypto' },
  { id: 'dating', label: 'Dating' },
  { id: 'other', label: 'Lainnya' }, // Layanan dari 5sim yang belum dikategorikan
];

const getIsTrending = (countryId, serviceId) => {
  const todayStr = new Date().toLocaleDateString('id-ID');
  let demandHash = 0;
  const demandStr = todayStr + "-" + serviceId + "-" + countryId;
  for (let i = 0; i < demandStr.length; i++) demandHash = demandStr.charCodeAt(i) + ((demandHash << 5) - demandHash);
  return Math.abs(demandHash) % 100 > 80;
};

// ==========================================
// ==========================================
// RUMUS HARGA JUAL - KOMPETITIF & MENGUNTUNGKAN
// ==========================================
//
// Sumber harga: API 5sim (real-time, dalam USD)
// Kurs:         USD_TO_IDR = 16.300 (safe buffer terhadap fluktuasi)
//
// STRATEGI MARGIN — menarik pembeli sekaligus tetap untung:
//   Modal < $0.20   → flat +Rp 1.000  (layanan sangat murah, cukup Rp 1.000)
//   Modal $0.20–0.5 → flat +Rp 1.500  (sweet spot paling laku)
//   Modal > $0.5    → flat +Rp 2.000  (layanan premium, masih kompetitif)
//
// Hasil: harga SELALU lebih murah dari kompetitor yang pakai margin 30–50%,
//        tapi admin tetap dapat untung bersih setiap transaksi.
//
// Contoh nyata:
//   WhatsApp Indo $0.20 → Rp 3.260 + Rp 1.500 = Rp 4.760 → dibulatkan Rp 4.800
//   Telegram US   $1.00 → Rp 16.300 + Rp 2.000 = Rp 18.300 → dibulatkan Rp 18.500

// ✅ SECURITY FIX #9: Kurs dikonfigurasi via env var.
// ⚠️ PERFORMA FIX: NEXT_PUBLIC_* di-embed saat BUILD TIME di Next.js — bukan runtime.
// Mengubah nilai di .env TETAP butuh rebuild/redeploy. Komentar lama menyesatkan.
// Jika ingin update kurs TANPA rebuild: buat endpoint /api/config yang membaca dari
// server-side env var (tanpa prefix NEXT_PUBLIC_) dan fetch nilainya saat app mount.
// Kurs per 06 Apr 2025 (Wise mid-market): $1 = Rp 16.990
const USD_TO_IDR = Number(process.env.NEXT_PUBLIC_USD_TO_IDR) || 16990;

const calcPriceFromUsd = (costUsd) => {
  const validCost = Math.max(0.05, costUsd || 0);   // Guard: minimum $0.05
  const costIdr   = validCost * USD_TO_IDR;

  // ✅ MINIMUM PROFIT GUARANTEE — tidak pernah rugi:
  //   $0.05 × 16300 = Rp 815  + Rp 1.000  = Rp 1.815  → dibulatkan Rp 1.900  (untung Rp 1.085)
  //   $0.20 × 16300 = Rp 3.260 + Rp 1.500  = Rp 4.760  → dibulatkan Rp 4.800  (untung Rp 1.540)
  //   $0.50 × 16300 = Rp 8.150 + Rp 1.500  = Rp 9.650  → dibulatkan Rp 9.700  (untung Rp 1.550)
  //   $1.00 × 16300 = Rp 16.300 + Rp 2.000 = Rp 18.300 → dibulatkan Rp 18.300 (untung Rp 2.000)
  //   WORST CASE (kurs naik 10% ke 18.000): $0.20 modal jadi Rp 3.600 → jual Rp 4.800 → untung Rp 1.200 ✅
  let margin;
  if (validCost < 0.20)       margin = 1000;  // Layanan murah: +Rp 1.000
  else if (validCost <= 0.50) margin = 1500;  // Sweet spot:    +Rp 1.500
  else                        margin = 2000;  // Premium:       +Rp 2.000

  // Bulatkan ke Rp 100 terdekat — harga terlihat lebih tajam vs kompetitor yang bulatkan ke Rp 500/1000
  return Math.ceil((costIdr + margin) / 100) * 100;
};

// ✅ SECURITY FIX: Alias calcPriceFromUsd dihapus — nama menyesatkan (input-nya USD bukan RUB).
// Semua pemanggil kini menggunakan calcPriceFromUsd secara eksplisit.

// TIER PRICING FALLBACK (digunakan saat 5sim tidak bisa diakses)
// Nilai dalam USD — sesuai harga pasar 5sim yang sesungguhnya
const getRealPrice = (countryId, serviceId, tier = 'reguler') => {
  // Harga dasar dalam USD per kategori layanan
  let baseModalUsd = 0.30; // default ~$0.30 USD

  // Layanan premium (demand tinggi)
  if (['whatsapp', 'telegram', 'apple', 'openai', 'paypal', 'binance', 'tinder', 'google'].includes(serviceId)) baseModalUsd = 0.50;
  // Layanan populer menengah
  else if (['instagram', 'facebook', 'twitter', 'tiktok', 'discord', 'gojek', 'shopee', 'grab', 'microsoft', 'github', 'amazon', 'netflix', 'spotify'].includes(serviceId)) baseModalUsd = 0.35;
  // Layanan crypto & finance
  else if (['bybit', 'kucoin', 'coinbase', 'kraken', 'okx', 'mexc', 'bitget', 'huobi', 'gate', 'bingx'].includes(serviceId)) baseModalUsd = 0.42;
  // Layanan dating
  else if (['bumble', 'hinge', 'match', 'okcupid', 'badoo', 'pof', 'grindr'].includes(serviceId)) baseModalUsd = 0.40;

  // Penyesuaian per negara (dalam USD)
  if (['usa', 'england', 'canada', 'germany', 'france', 'japan', 'south_korea', 'australia'].includes(countryId)) baseModalUsd += 0.30;
  else if (['russia', 'vietnam', 'philippines', 'india', 'nigeria', 'kenya'].includes(countryId)) baseModalUsd -= 0.04;
  else if (['indonesia', 'malaysia', 'thailand', 'cambodia', 'myanmar', 'laos'].includes(countryId)) baseModalUsd -= 0.05;

  baseModalUsd = Math.max(0.13, baseModalUsd); // Minimum $0.13 USD

  let finalUsd = baseModalUsd;
  if (tier === 'reguler') finalUsd = baseModalUsd * 1.05;
  if (tier === 'vip') finalUsd = baseModalUsd * 1.38;

  return calcPriceFromUsd(finalUsd);
};

// ==========================================
// 2. FUNGSI API CALL TERLINDUNGI
// ==========================================
// secureApiCall dan clearTokenCache diimpor dari @/lib/apiClient
// Fitur baru: Token Cache otomatis + Rate Limiting per endpoint

// ==========================================
// 3. KONFIGURASI UMUM & HELPER
// ==========================================
// ✅ FIX #3: ADMIN_EMAILS dihapus — tidak aman disimpan di NEXT_PUBLIC_ (terekspos di JS bundle).
// isAdmin sekarang ditentukan dari field `role: 'admin'` di dokumen Firestore user.
// Server API route tetap wajib verifikasi token secara independen.
//
// ⚠️  WAJIB DIPASANG — Firestore Security Rules:
// Tanpa rule ini, user bisa menulis role:'admin' ke dokumen mereka sendiri!
//
//   match /users/{userId} {
//     allow read: if request.auth != null && request.auth.uid == userId;
//     allow create: if request.auth != null && request.auth.uid == userId;
//     allow update: if request.auth != null && request.auth.uid == userId
//       && !request.resource.data.diff(resource.data)
//           .affectedKeys().hasAny(['role', 'balance', 'banned', 'pinHash']);
//   }
//
// Field sensitif (role, balance, banned, pinHash) hanya boleh diubah via
// server-side Admin SDK di dalam API route yang sudah verifikasi token.

const ServiceIcon = React.memo(function ServiceIcon({ service, className = "w-12 h-12 text-xl" }: { service: any; className?: string }) {
  // Tentukan sumber pertama: kalau ada domain di map, langsung pakai clearbit (lebih reliable)
  const getInitialSrc = (svc: any): string | null => {
    const domain = SERVICE_DOMAIN_MAP[svc?.id];
    if (domain) return `https://logo.clearbit.com/${domain}`;
    return svc?.image || null; // fallback ke iconify SVG jika tidak ada di domain map
  };

  const [imgSrc, setImgSrc] = useState<string | null>(() => getInitialSrc(service));
  const fallbackStage = useRef<number>(0);

  React.useEffect(() => {
    setImgSrc(getInitialSrc(service));
    fallbackStage.current = 0;
  }, [service?.id, service?.image]);

  const handleImgError = useCallback(() => {
    const domain = SERVICE_DOMAIN_MAP[service?.id];
    if (fallbackStage.current === 0 && service?.image) {
      // Stage 1: Coba iconify/image URL asli (sudah skip clearbit karena itu stage-0)
      fallbackStage.current = 1;
      setImgSrc(service.image);
      return;
    }
    if (fallbackStage.current <= 1 && domain) {
      // Stage 2: Google Favicon (selalu ada untuk domain valid)
      fallbackStage.current = 2;
      setImgSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      return;
    }
    // Stage 3: Tampilkan emoji icon
    fallbackStage.current = 3;
    setImgSrc(null);
  }, [service?.id, service?.image]);

  return (
    <div className={`${className} rounded-xl flex items-center justify-center border border-white/5 overflow-hidden ${service?.color || 'bg-gray-800'} p-2`}>
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={service?.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain filter drop-shadow-md"
          onError={handleImgError}
        />
      ) : (
        <span className="text-xl leading-none select-none">{service?.icon || '📱'}</span>
      )}
    </div>
  );
});


// ── Shimmer ──────────────────────────────────────────────────────────────────
const Shimmer: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div
    style={style}
    className={`relative overflow-hidden bg-white/[0.06] rounded-lg before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent ${className}`}
  />
);

const ShimmerStyle: React.FC = () => (
  <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
);

const CatalogSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
    <ShimmerStyle />
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="relative overflow-hidden rounded-2xl p-4 md:p-5 flex flex-col bg-white/[0.04] border border-white/[0.06]">
        <div className="flex justify-between items-start mb-3">
          <Shimmer className="w-11 h-11 rounded-xl" />
          <Shimmer className="w-6 h-6 rounded-md" />
        </div>
        <Shimmer className="h-4 w-3/4 mb-2 rounded-md" />
        <Shimmer className="h-3 w-1/2 mb-5 rounded-md" />
        <div className="border-t border-white/5 pt-3 mt-auto flex flex-col gap-2">
          <Shimmer className="h-3 w-1/3 rounded-md" />
          <Shimmer className="h-5 w-1/2 rounded-md" />
          <Shimmer className="h-9 w-full rounded-xl mt-1" />
        </div>
      </div>
    ))}
  </div>
);


// ── HistorySkeleton ──────────────────────────────────────────────────────────
const HistorySkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="grid gap-4">
    <ShimmerStyle />
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Shimmer className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Shimmer className="h-4 w-40 rounded-md" />
              <Shimmer className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <div className="text-right space-y-2 shrink-0">
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-3 w-16 rounded-md ml-auto" />
          </div>
        </div>
        <Shimmer className="h-12 w-full rounded-xl" />
        <div className="flex gap-2">
          <Shimmer className="h-9 flex-1 rounded-xl" />
          <Shimmer className="h-9 flex-1 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);


// ── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ value, showToast, size = 'sm', className = '' }: {
  value: string;
  showToast: (msg: string, type?: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleCopy = async () => {
    if (copied) return;
    // ✅ FIX: Guard jika value kosong/undefined (mis: order.number & order.phone keduanya null)
    if (!value) return showToast('Tidak ada teks untuk disalin.', 'error');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showToast('Disalin ke clipboard!', 'success');
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Gagal menyalin.', 'error');
    }
  };
  const iconClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  const padClass  = size === 'md' ? 'p-3' : 'p-2';
  return (
    <button
      onClick={handleCopy}
      className={`${padClass} rounded-lg transition-all duration-200 border shrink-0 ${
        copied
          ? 'bg-green-500/15 border-green-500/30 text-green-400'
          : 'bg-white/[0.04] hover:bg-white/10 border-white/[0.06] text-gray-500 hover:text-white'
      } ${className}`}
      title={copied ? 'Tersalin!' : 'Salin'}
    >
      {copied
        ? <Check className={`${iconClass} transition-all`} />
        : <Copy className={`${iconClass} transition-all`} />
      }
    </button>
  );
}

// ==========================================

export default memo(function OrderHistoryPage({ orders = [], isLoadingOrders = false, showToast }) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl md:text-4xl font-black text-white mb-2 uppercase tracking-tight">Riwayat <span className="text-red-500">Log</span></h2>
        <p className="text-gray-400 font-medium text-sm md:text-lg">Pantau semua aktivitas transaksi dan riwayat kode OTP Anda.</p>
      </div>

      {isLoadingOrders ? (
        <HistorySkeleton count={5} />
      ) : orders.length === 0 ? (
        <div className="text-center py-24 bg-[#0f0202] border border-dashed border-red-900/50 rounded-[2rem] mt-8">
          <Clock className="w-20 h-20 mx-auto mb-6 text-red-900/50" />
          <p className="text-xl font-bold text-gray-400 uppercase tracking-widest">Data Kosong</p>
          <p className="text-gray-500 mt-2">Belum ada aktivitas yang terekam di akun ini.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map(order => (
            <ActiveOrderItem key={order.id} order={order} showToast={showToast} />
          ))}
        </div>
      )}
    </div>
  );
}
);

function ActiveOrderItem({ order, compact = false, showToast }) {
  // ✅ State utama — sinkron dari Firestore (order prop), bukan override mandiri
  const [otpData, setOtpData] = useState<{
    status: string;
    otp: string | null;
    allSms?: any[];
  }>({
    status: order.status || 'active',
    otp: order.otp || null,
  });

  const [isCanceling, setIsCanceling] = useState(false);
  const esRef           = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Refs agar callback async tidak stale
  const statusRef = useRef(otpData.status);
  const otpRef    = useRef<string | null>(otpData.otp);

  useEffect(() => { statusRef.current = otpData.status; }, [otpData.status]);
  useEffect(() => { otpRef.current    = otpData.otp;    }, [otpData.otp]);

  // ✅ Sync saat order prop berubah dari Firestore real-time
  useEffect(() => {
    setOtpData(prev => {
      const newStatus = order.status || prev.status;
      const newOtp    = order.otp || prev.otp;
      // Jangan override status final — 'success' dan 'canceled' tidak boleh
      // ditimpa balik ke 'active' jika Firestore belum sync sempurna
      if (prev.status === 'success' && newStatus === 'active') return prev;
      if (prev.status === 'canceled' || prev.status === 'CANCELLED') return prev;
      return { ...prev, status: newStatus, otp: newOtp };
    });
  }, [order.status, order.otp]);

  // ──────────────────────────────────────────────────────────────────────────
  // Strategi dual-track:
  //  1. POLLING  — setInterval setiap 3 detik via ?mode=poll (reliable di semua platform)
  //  2. SSE      — EventSource sebagai bonus kecepatan (jika platform support)
  // Polling SELALU jalan dari awal. SSE hanya pelengkap.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // ✅ FIX BUG POLLING: Sertakan 'pending' agar order yang baru dibeli
    // (status awal dari backend bisa 'pending') tetap di-poll sampai OTP masuk.
    if (otpData.status !== 'active' && otpData.status !== 'pending') {
      if (esRef.current)           { esRef.current.close(); esRef.current = null; }
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      return;
    }

    let isMounted = true;

    // ── Helper: proses data dari poll atau SSE ────────────────────────────
    const handleData = (data: any) => {
      if (!isMounted || !data) return;

      // ✅ FIX BUG STATUS: Normalisasi status mentah dari provider sebelum disimpan.
      // 5SIM mengembalikan 'RECEIVED', SA mengembalikan 'STATUS_OK' — keduanya = sukses.
      // Tanpa normalisasi ini polling tidak pernah berhenti dan status tidak ter-update.
      const normalizeStatus = (s: string) => {
        if (s === 'RECEIVED' || s === 'STATUS_OK')    return 'success';
        if (s === 'TIMEOUT'  || s === 'STATUS_CANCEL') return 'canceled';
        if (s === 'BANNED')                            return 'canceled';
        return s;
      };

      const incomingStatus = normalizeStatus(data.status || 'active');

      if (data.otp && data.otp !== otpRef.current) {
        showToast(
          `OTP diterima untuk ${order.saName || order.serviceId?.toUpperCase()}: ${data.otp}`,
          'success'
        );
      }

      setOtpData(prev => ({
        status: incomingStatus === 'active' && prev.status === 'success'
          ? 'success'
          : incomingStatus,
        otp:    data.otp || prev.otp || null,
        allSms: data.allSms || prev.allSms || [],
      }));

      if (incomingStatus === 'success' || incomingStatus === 'canceled' || incomingStatus === 'CANCELLED' || incomingStatus === 'finished') {
        if (esRef.current)           { esRef.current.close(); esRef.current = null; }
        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      }
    };

    // ── TRACK 1: Polling via HTTP (selalu aktif, backbone utama) ──────────

    const runPoll = async () => {
      if (!isMounted || (statusRef.current !== 'active' && statusRef.current !== 'pending')) return;
      if (!auth || !auth.currentUser) return;
      try {
        const token    = await auth.currentUser.getIdToken();
        // ✅ SECURITY FIX: Token dipindah dari URL query string ke Authorization header.
        // Token di URL bocor ke server access log, CDN log, dan browser history.
        const endpoint = order.provider === 'smsactivate'
          ? `/api/smsactivate/otp-stream?orderId=${order.id}&mode=poll`
          : `/api/otp-stream?orderId=${order.id}&mode=poll`;
        const res   = await fetch(
          endpoint,
          {
            signal: AbortSignal.timeout(12000),
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        // ✅ FIX: Jangan silent ignore — log error agar bisa debug di DevTools
        if (!res.ok) {
          console.error(
            `[poll] Error ${res.status} untuk orderId=${order.id}.`,
            'Cek Vercel Function Logs untuk detail.',
          );
          // Jika 401 (token expired) — refresh token di poll berikutnya, jangan stop
          return;
        }
        const data = await res.json();
        // Uncomment baris di bawah saat debug, comment kembali di production:
        // console.log(`[poll] Response orderId=${order.id}:`, data);
        handleData(data);
      } catch (err: any) {
        // Hanya log jika bukan AbortError (timeout normal)
        if (err?.name !== 'AbortError') {
          console.warn(`[poll] Network error orderId=${order.id}:`, err?.message);
        }
      }
    };

    // Jalankan sekali langsung, lalu setiap 3 detik
    runPoll();
    pollIntervalRef.current = setInterval(runPoll, 3000);

    // ── TRACK 2: SSE (bonus kecepatan — tidak wajib berhasil) ─────────────
    const openSSE = async () => {
      if (!isMounted || !auth || !auth.currentUser) return;
      try {
        const token = await auth.currentUser.getIdToken();
        if (!isMounted) return;

        // ✅ FIX BUG SSE: Gunakan endpoint yang sesuai provider (bukan selalu 5sim)
        const sseEndpoint = order.provider === 'smsactivate'
          ? `/api/smsactivate/otp-stream?orderId=${order.id}&token=${encodeURIComponent(token)}`
          : `/api/otp-stream?orderId=${order.id}&token=${encodeURIComponent(token)}`;
        const es = new EventSource(sseEndpoint);
        esRef.current = es;

        es.onmessage = (event) => {
          try { handleData(JSON.parse(event.data)); } catch { /* abaikan parse error */ }
        };

        // SSE error/timeout — tutup saja, polling sudah handle sebagai backbone
        es.onerror = () => {
          es.close();
          esRef.current = null;
        };
      } catch { /* SSE tidak tersedia — polling sudah cukup */ }
    };

    // SSE dimatikan di production — Vercel timeout 5 menit menyebabkan error.
    // Polling via ?mode=poll sudah cukup dan reliable di semua platform.
    // ⚠️ SECURITY NOTE: Jika SSE diaktifkan kembali, token di URL (baris openSSE) harus
    // diganti ke header — EventSource tidak support custom header secara native,
    // solusinya: pakai @microsoft/fetch-event-source atau kirim token via cookie HttpOnly.
    // openSSE();

    return () => {
      isMounted = false;
      if (esRef.current)           { esRef.current.close(); esRef.current = null; }
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, otpData.status]);

  // ✅ FIX: onExpire sekarang update Firestore secara langsung agar order
  // hilang dari Status Live segera setelah waktu habis, tanpa tunggu polling.
  const onExpire = useCallback(async () => {
    if (statusRef.current !== 'active' && statusRef.current !== 'pending') return; // sudah di-cancel/sukses
    try {
      if (!auth?.currentUser) return;
      // Update status lokal dulu agar UI langsung responsif
      const expiredStatus = order.provider === 'smsactivate' ? 'CANCELLED' : 'canceled';
      setOtpData(prev => ({ ...prev, status: expiredStatus }));
      statusRef.current = expiredStatus;
      // Sync ke Firestore agar hilang dari activeOrders filter
      await updateDoc(
        doc(db, 'users', auth.currentUser.uid, 'orders', order.id),
        { status: expiredStatus }
      );
    } catch {
      // Jika Firestore gagal, UI sudah update — tidak perlu error toast
    }
  }, [order.id, order.provider]);

  // ✅ FIX: Jika order tidak punya expiresAt (umum pada Server 2/smsactivate),
  // gunakan timestamp order + 20 menit sebagai fallback standar SA.
  // Normalisasi timestamp dulu karena bisa berupa number, Firestore Timestamp,
  // atau plain object { seconds, nanoseconds } — ketiganya harus dikonversi ke ms.
  const orderTimestampMs = (() => {
    const t = order.timestamp;
    if (!t) return 0;
    if (typeof t === 'number') return t;
    if (typeof t?.toMillis === 'function') return t.toMillis();
    if (t?.seconds) return t.seconds * 1000;
    return 0;
  })();

  const effectiveExpiresAt = order.expiresAt
    ?? (orderTimestampMs ? orderTimestampMs + 20 * 60 * 1000 : null);

  const { formatTime, seconds } = useCountdown(
    effectiveExpiresAt,
    otpData.status === 'active',
    onExpire
  );

  const handleCancel = async () => {
    if (isCanceling) return;
    setIsCanceling(true);
    try {
      if (!auth || !auth.currentUser) throw new Error('Sesi tidak valid');
      const token = await auth.currentUser.getIdToken();

      if (order.provider === 'smsactivate') {
        // SMS-Activate: cancel via set-status endpoint
        // ✅ SECURITY FIX: Tambahkan pengecekan res.ok — sebelumnya error diabaikan diam-diam.
        const saRes = await fetch('/api/smsactivate/set-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ orderId: order.id, status: 8 }),
        });
        if (!saRes.ok) {
          const saData = await saRes.json().catch(() => ({}));
          throw new Error(saData.error || saData.message || `Gagal membatalkan pesanan (${saRes.status})`);
        }
      } else {
        // 5sim: cancel via cancel-order endpoint
        const res = await fetch('/api/cancel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ orderId: order.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Gagal membatalkan pesanan');
      }

      // ✅ FIX: Update Firestore langsung agar activeOrders filter di DashHome
      // ikut berubah via real-time listener. Tanpa ini, order tetap muncul di
      // "Status Live" karena Firestore masih menyimpan status 'active'.
      // Error permission di-silent karena status lokal sudah diupdate via setOtpData.
      if (db) {
        try {
          await updateDoc(
            doc(db, 'users', auth.currentUser.uid, 'orders', order.id),
            { status: order.provider === 'smsactivate' ? 'CANCELLED' : 'canceled' }
          );
        } catch (_) { /* silent — tidak ganggu user jika Firestore rules belum allow */ }
      }

      showToast('Pesanan dibatalkan. Saldo dikembalikan.', 'info');
      setOtpData(prev => ({ ...prev, status: order.provider === 'smsactivate' ? 'CANCELLED' : 'canceled', otp: null }));
    } catch (err: any) {
      showToast(err.message || 'Gagal membatalkan.', 'error');
    } finally {
      setIsCanceling(false);
    }
  };

  const displayStatus = otpData.status;
  const displayOtp = otpData.otp;
  const isActive = displayStatus === 'active';
  const isSuccess = displayStatus === 'success' || displayStatus === 'finished';
  const isCanceled = displayStatus === 'canceled' || displayStatus === 'CANCELLED';

  // ✅ FIX: Gunakan getSAServiceMeta untuk Server 2 (smsactivate) agar logo tampil benar.
  // Sebelumnya selalu pakai getServiceMeta() sehingga logo Server 2 tidak match.
  const service = order.saName
    ? getSAServiceMeta(order.serviceId, order.saName)
    : getServiceMeta(order.serviceId);
  const serviceName = order.saName || service?.name || order.serviceId?.toUpperCase();
  const urgentTime = seconds <= 120 && seconds > 0 && isActive;

  if (compact) {
    // ✅ Sembunyikan order yang sudah dibatalkan dari Status Live
    if (isCanceled) return null;
    // ✅ FIX: Sembunyikan juga order yang timer-nya sudah habis (expired) tapi
    // Firestore belum sync — tanpa ini order stuck 00:00 terus muncul.
    if (isActive && seconds === 0 && effectiveExpiresAt && Date.now() > effectiveExpiresAt) return null;

    return (
      <Card className={`p-4 flex items-center justify-between gap-4 ${
        isSuccess ? 'border-green-500/30 bg-green-500/5' :
        urgentTime ? 'border-orange-500/30 bg-orange-500/5 animate-pulse' :
        'border-red-500/20'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <ServiceIcon service={service} className="w-10 h-10 shrink-0" />
          <div className="min-w-0">
            <p className="font-black text-white uppercase text-sm truncate">{serviceName}</p>
            <p className="text-xs text-gray-500 font-mono truncate">{order.number || order.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isActive && (
            <span className={`text-sm font-black font-mono ${urgentTime ? 'text-orange-400' : 'text-gray-400'}`}>
              {formatTime()}
            </span>
          )}
          {isSuccess && displayOtp && (
            <span className="text-green-400 font-black text-lg font-mono tracking-widest">{displayOtp}</span>
          )}
          {isSuccess && !displayOtp && (
            <span className="text-xs text-green-400 font-bold uppercase">Sukses</span>
          )}
          {isCanceled && (
            <span className="text-xs text-red-400 font-bold uppercase">Dibatalkan</span>
          )}
          {isActive && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
              <span className="text-xs text-gray-500 font-bold">Menunggu OTP</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden p-0 transition-all ${
      isSuccess  ? 'border-green-500/30 bg-[#020f04]' :
      isCanceled ? 'border-white/[0.05] opacity-60' :
      urgentTime ? 'border-orange-500/40 bg-[#100600]' :
      'border-red-900/25 bg-[#0a0202]'
    }`}>
      {/* Timer progress bar (aktif only) */}
      {isActive && (
        <div className={`relative h-1.5 w-full overflow-hidden ${urgentTime ? 'bg-orange-900/40' : 'bg-red-900/20'}`}>
          <div
            className={`absolute left-0 top-0 h-full transition-all duration-1000 ${urgentTime ? 'bg-orange-500' : 'bg-red-600/70'}`}
            style={{ width: `${Math.max(0, Math.min(100, (seconds / 600) * 100))}%` }}
          />
        </div>
      )}

      <div className="p-5 md:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <ServiceIcon service={service} className="w-10 h-10 md:w-12 md:h-12 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">{serviceName}</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                {order.countryId?.toUpperCase()} · {order.operator?.toUpperCase()}
              </p>
            </div>
          </div>

          {isActive && (
            <div className={`shrink-0 text-right ${urgentTime ? 'text-orange-400' : 'text-gray-400'}`}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 opacity-70">Sisa Waktu</p>
              <p className={`text-2xl font-black font-mono tabular-nums leading-none ${urgentTime ? 'text-orange-400' : 'text-white'}`}>
                {formatTime()}
              </p>
              {urgentTime && <p className="text-[9px] text-orange-400/70 font-bold mt-0.5">Segera gunakan!</p>}
            </div>
          )}
          {isSuccess && (
            <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 px-3 py-1.5 rounded-xl shrink-0">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 font-bold text-xs hidden sm:block">OTP Diterima</span>
            </div>
          )}
          {isCanceled && (
            <div className="flex items-center gap-1.5 bg-red-500/8 border border-red-500/15 px-3 py-1.5 rounded-xl shrink-0">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 font-bold text-xs hidden sm:block">Dibatalkan</span>
            </div>
          )}
        </div>

        {/* Nomor Virtual */}
        <div className="bg-black/60 border border-white/[0.07] rounded-xl p-4 mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">Nomor Virtual</p>
            <p className="text-white font-black text-lg font-mono tracking-widest">{order.number || order.phone}</p>
          </div>
          <CopyButton value={order.number || order.phone || ''} showToast={showToast} size="sm" />
        </div>

        {/* OTP Display */}
        {isSuccess && displayOtp && (
          <div className="bg-green-950/40 border-2 border-green-500/40 rounded-xl p-5 mb-3 flex items-center justify-between gap-4 shadow-[0_0_30px_rgba(34,197,94,0.08)]">
            <div>
              <p className="text-[9px] text-green-400/60 font-bold uppercase tracking-widest mb-1">Kode OTP</p>
              <p className="text-green-400 font-black text-3xl font-mono tracking-[0.2em]">{displayOtp}</p>
            </div>
            <CopyButton value={displayOtp} showToast={showToast} size="md" className="bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/30" />
          </div>
        )}

        {/* Semua SMS */}
        {isSuccess && otpData.allSms && otpData.allSms.length > 1 && (
          <div className="space-y-2 mb-3">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Semua SMS Masuk</p>
            {otpData.allSms.map((sms, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-sm text-gray-300 font-mono">
                {sms.text || sms.code || '-'}
              </div>
            ))}
          </div>
        )}

        {/* Waiting state */}
        {isActive && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 mb-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Menunggu SMS OTP...</p>
              <p className="text-gray-500 text-xs mt-0.5">Masukkan nomor di atas ke layanan {service?.name} untuk menerima SMS</p>
            </div>
          </div>
        )}

        {/* Action buttons — dibedakan secara visual */}
        {isActive && (
          <div className="flex gap-3">
            {/* Salin Nomor — secondary, full width */}
            <button
              onClick={() => copyToClipboardHelper(order.number || order.phone || '', showToast)}
              className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all font-bold text-sm flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Salin Nomor
            </button>
            {/* Batalkan — danger outline, hanya ikon + label pendek */}
            <button
              onClick={handleCancel}
              disabled={isCanceling}
              className="px-4 py-3 rounded-xl border border-red-900/40 text-red-500/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/30 transition-all font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {isCanceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Batal</>}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}