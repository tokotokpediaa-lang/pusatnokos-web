'use client';

// ==========================================
// SHARED CONSTANTS & UI COMPONENTS
// Dipake bareng oleh LegalPage & ContactPage
// ==========================================

export const LAST_UPDATED = '6 April 2025';
export const BRAND        = 'Pusat Nokos';
export const DOMAIN       = 'pusatnokos.my.id';
export const EMAIL_CONTACT = 'pusatnokos@gmail.com';
export const WA_CONTACT   = '6287862306726';

export const CONTACT = {
  telegram: 'PusatNokosCS',
  whatsapp: '6287862306726',
};

export const THEME = {
  bg: 'bg-[#040000]',
  panel: 'bg-[#060000]/95',
  panelSolid: 'bg-[#060000]',
  border: 'border-red-500/20',
  text: 'text-gray-300',
  textMuted: 'text-red-100/40',
  heading: 'text-white',
  accentPrimary: 'text-red-500',
  accentSecondary: 'text-white',
  gradientPrimary: 'bg-gradient-to-r from-red-600 via-red-700 to-rose-900',
  gradientText: 'bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-orange-200 to-red-300',
  glass: 'bg-[#080000] backdrop-blur-xl border border-red-900/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
};

// ------------------------------------------
// BUTTON COMPONENT
// ------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'telegram' | 'ghost' | 'danger' | 'whatsapp';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  onClick,
  disabled,
  type = 'button',
}) => {
  const baseStyle =
    'inline-flex items-center justify-center rounded-2xl font-bold transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96] select-none text-sm';
  const variants: Record<ButtonVariant, string> = {
    primary: `${THEME.gradientPrimary} text-white shadow-[0_2px_20px_rgba(220,38,38,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_4px_30px_rgba(220,38,38,0.55)] hover:brightness-110 px-5 py-2.5 border border-red-400/20`,
    secondary: `bg-white/95 text-red-900 font-black hover:bg-white shadow-[0_2px_15px_rgba(255,255,255,0.08)] px-5 py-2.5`,
    outline: `border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 px-5 py-2.5 backdrop-blur-sm`,
    telegram: `border border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:border-blue-600 hover:text-white px-5 py-2.5 backdrop-blur-sm`,
    ghost: 'text-gray-400 hover:text-white hover:bg-white/[0.06] px-4 py-2 rounded-xl',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 px-4 py-2 rounded-xl',
    whatsapp:
      'bg-gradient-to-r from-[#25D366] to-[#1ab557] text-white shadow-[0_2px_20px_rgba(37,211,102,0.25)] hover:brightness-110 px-5 py-2.5 border border-[#25D366]/20',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// ------------------------------------------
// CARD COMPONENT
// ------------------------------------------
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hover = false }) => (
  <div
    className={`${THEME.glass} shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] ${
      hover
        ? 'hover:border-red-500/25 hover:shadow-[0_12px_48px_rgba(0,0,0,0.6),0_0_20px_rgba(220,38,38,0.06),inset_0_1px_0_rgba(255,255,255,0.07)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer'
        : ''
    } rounded-2xl p-5 md:p-6 ${className}`}
  >
    {children}
  </div>
);