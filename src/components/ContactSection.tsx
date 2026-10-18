import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  SendHorizontal, 
  AlertCircle, 
  ShieldCheck, 
  Check, 
  Sparkles,
  AtSign,
  Mail,
  User as UserIcon,
  MessageSquare
} from 'lucide-react';
import { 
  DeviceTelemetry, 
  checkSubmissionLock, 
  submitOneTimeMessage 
} from '../lib/telemetry';

interface ContactSectionProps {
  telemetry: DeviceTelemetry | null;
  onSubmitted?: () => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({ telemetry, onSubmitted }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [message, setMessage] = useState('');
  
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [justSent, setJustSent] = useState(false);

  // Check lock state whenever telemetry resolves
  useEffect(() => {
    if (!telemetry) return;

    let isMounted = true;
    checkSubmissionLock(telemetry.ip, telemetry.fingerprint)
      .then((res) => {
        if (!isMounted) return;
        if (res.isLocked) {
          setIsLocked(true);
        }
      })
      .catch((err) => {
        console.warn('Lock check error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [telemetry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার নাম দিন (Please enter your name).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('সঠিক ইমেইল ঠিকানা প্রদান করুন (Please enter a valid email).');
      return;
    }
    if (!message.trim() || message.trim().length < 3) {
      setErrorMsg('অনুগ্রহ করে আপনার মেসেজ লিখুন (Please enter your message).');
      return;
    }
    if (!telemetry) {
      setErrorMsg('সিস্টেম ভেরিফিকেশন চলমান, ১ সেকেন্ড পর পুনরায় চেষ্টা করুন।');
      return;
    }

    setSubmitting(true);
    try {
      let cleanTg = telegram.trim();
      if (cleanTg && !cleanTg.startsWith('@') && !cleanTg.startsWith('http')) {
        cleanTg = `@${cleanTg}`;
      }

      await submitOneTimeMessage({
        name,
        email,
        telegram: cleanTg,
        message,
        telemetry
      });

      setJustSent(true);
      setIsLocked(true);
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'মেসেজ পাঠাতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section 
      id="contact" 
      className="w-full max-w-xl mx-auto relative pt-4 transition-all duration-700 ease-out"
    >
      <div className="relative group">
        {/* Animated ambient gradient edge / border glow */}
        <div className="absolute -inset-[1px] bg-gradient-to-b from-white/20 via-white/5 to-white/0 rounded-2xl opacity-70 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        <div className="bg-[#0A0A0A]/90 border border-white/10 rounded-2xl p-7 sm:p-9 relative overflow-hidden backdrop-blur-xl shadow-2xl">
          {/* Shimmer light beam gliding across header */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer pointer-events-none" />

          {isLocked ? (
            /* Locked State View */
            <div className="py-6 text-center space-y-5 transition-all duration-500 animate-fadeIn">
              <div className="relative inline-flex">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-neutral-200 shadow-inner">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold shadow-md">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white font-display tracking-tight">
                  {justSent ? 'বার্তা সফলভাবে পাঠানো হয়েছে' : 'বার্তা ইতিমধ্যে পাঠানো হয়েছে'}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-sm mx-auto">
                  আপনার বার্তাটি ডাটাবেজে সংরক্ষিত রয়েছে। এই নির্দিষ্ট ডিভাইস থেকে ইতিমধ্যে একবার বার্তা পাঠানো হয়েছে।
                </p>
              </div>

              <div className="p-3 bg-[#111111]/80 border border-white/5 rounded-xl text-[11px] font-mono text-neutral-400 inline-flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-300" />
                <span>Single-Submission Protocol Active · Device Signature Locked</span>
              </div>
            </div>
          ) : (
            /* Minimal Sleek Contact Form */
            <form onSubmit={handleSubmit} className="space-y-4 transition-all duration-500">
              <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white font-display tracking-tight">
                    যোগাযোগ ফরম
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    এককালীন বার্তা পাঠান (শুধুমাত্র ১ বার পাঠানো যাবে)
                  </p>
                </div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-neutral-400">
                  Direct
                </span>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 transition-all duration-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Name Input */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                  আপনার নাম
                </label>
                <div className="relative group/input">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="নাম লিখুন"
                    maxLength={120}
                    className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Email and Telegram grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                    ইমেইল (Email)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    maxLength={150}
                    className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-mono flex items-center justify-between">
                    <span>টেলিগ্রাম ইউজারনেম</span>
                    <span className="text-[10px] text-neutral-500 lowercase font-normal">(ঐচ্ছিক)</span>
                  </label>
                  <input
                    type="text"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@username"
                    maxLength={100}
                    className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                  মেসেজ
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="আপনার বার্তা লিখুন..."
                  maxLength={2000}
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all resize-none leading-relaxed font-sans"
                />
                <div className="text-right text-[10px] text-neutral-500 font-mono mt-1 tabular-nums">
                  {message.length} / 2000
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-white text-black font-semibold text-xs tracking-wider uppercase py-3.5 rounded-xl hover:bg-neutral-200 active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-mono relative overflow-hidden group/btn"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    পাঠানো হচ্ছে...
                  </span>
                ) : (
                  <>
                    <SendHorizontal className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    <span>মেসেজ পাঠান (Send Message)</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
