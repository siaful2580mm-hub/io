import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs 
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { 
  Lock, 
  Unlock, 
  Mail, 
  User as UserIcon, 
  Globe, 
  Monitor, 
  Calendar, 
  Trash2, 
  CheckCircle, 
  Search, 
  RefreshCw, 
  ArrowLeft, 
  ShieldAlert, 
  Smartphone, 
  Eye, 
  Filter,
  CheckCheck
} from 'lucide-react';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  telegram?: string;
  message: string;
  ip: string;
  fingerprint: string;
  location?: string;
  deviceSummary?: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: string;
}

interface VisitorRecord {
  id: string;
  ip: string;
  country?: string;
  city?: string;
  region?: string;
  isp?: string;
  deviceType?: string;
  deviceName?: string;
  os?: string;
  browser?: string;
  screenResolution?: string;
  userAgent?: string;
  hasSubmittedMessage?: boolean;
  visitCount?: number;
  lastVisitedAt?: string;
  createdAt: string;
}

interface AdminPortalProps {
  onExit: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onExit }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('dkx_admin_session') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'visitors' | 'locks'>('messages');
  
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [locks, setLocks] = useState<Array<{ id: string; identifier: string; ip: string; messageId: string; createdAt: string }>>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && user.email === 'hello.digontosaheb@gmail.com') {
        setIsAuthenticated(true);
        sessionStorage.setItem('dkx_admin_session', 'true');
      }
    });
    return () => unsubscribe();
  }, []);

  const [serverError, setServerError] = useState<string | null>(null);

  // Manual direct fetch function
  const fetchDataDirectly = async () => {
    setLoading(true);
    setServerError(null);

    try {
      // 1. Fetch messages
      const msgsSnap = await getDocs(collection(db, 'messages'));
      const list: ContactMessage[] = [];
      msgsSnap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as any) });
      });

      // Merge any local backup messages
      try {
        const localMsgs = JSON.parse(localStorage.getItem('dkx_all_messages') || '[]');
        for (const localM of localMsgs) {
          if (!list.some(m => m.id === localM.id)) {
            list.push(localM);
          }
        }
      } catch {
        //
      }

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(list);
    } catch (err: any) {
      console.error('Direct messages fetch error:', err);
      setServerError(`মেসেজ লোড এরর: ${err.message || 'Permission denied'}`);
      // Fallback to local
      try {
        const localMsgs = JSON.parse(localStorage.getItem('dkx_all_messages') || '[]');
        if (localMsgs.length > 0) setMessages(localMsgs);
      } catch {
        //
      }
    }

    try {
      // 2. Fetch visitors
      const visSnap = await getDocs(collection(db, 'visitors'));
      const vList: VisitorRecord[] = [];
      visSnap.forEach((d) => {
        vList.push({ id: d.id, ...(d.data() as any) });
      });
      vList.sort((a, b) => new Date(b.lastVisitedAt || b.createdAt).getTime() - new Date(a.lastVisitedAt || a.createdAt).getTime());
      setVisitors(vList);
    } catch (err: any) {
      console.warn('Direct visitors fetch error:', err);
    }

    try {
      // 3. Fetch locks
      const lkSnap = await getDocs(collection(db, 'locks'));
      const lkList: any[] = [];
      lkSnap.forEach((d) => {
        lkList.push({ id: d.id, ...(d.data() as any) });
      });
      setLocks(lkList);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  // Fetch real-time messages & visitors once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchDataDirectly();

    // Messages real-time listener
    let unsubMessages = () => {};
    try {
      const q = query(collection(db, 'messages'));
      unsubMessages = onSnapshot(q, (snapshot) => {
        const list: ContactMessage[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });

        // Merge local backup
        try {
          const localMsgs = JSON.parse(localStorage.getItem('dkx_all_messages') || '[]');
          for (const localM of localMsgs) {
            if (!list.some(m => m.id === localM.id)) {
              list.push(localM);
            }
          }
        } catch {
          //
        }

        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMessages(list);
        setLoading(false);
      }, (err) => {
        console.warn('Messages snapshot listener warning:', err.message);
        setServerError(`রিয়েল-টাইম কানেকশন এরর: ${err.message}`);
        setLoading(false);
      });
    } catch (err: any) {
      setServerError(err.message);
      setLoading(false);
    }

    // Visitors real-time listener
    let unsubVisitors = () => {};
    try {
      const qVis = query(collection(db, 'visitors'));
      unsubVisitors = onSnapshot(qVis, (snapshot) => {
        const list: VisitorRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        list.sort((a, b) => new Date(b.lastVisitedAt || b.createdAt).getTime() - new Date(a.lastVisitedAt || a.createdAt).getTime());
        setVisitors(list);
      }, () => {});
    } catch {
      //
    }

    // Locks real-time listener
    let unsubLocks = () => {};
    try {
      const qLocks = query(collection(db, 'locks'));
      unsubLocks = onSnapshot(qLocks, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setLocks(list);
      }, () => {});
    } catch {
      //
    }

    return () => {
      unsubMessages();
      unsubVisitors();
      unsubLocks();
    };
  }, [isAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default master password or customized
    if (passwordInput === 'dkx@admin2026' || passwordInput === 'admin' || passwordInput === 'dkx2026') {
      setIsAuthenticated(true);
      sessionStorage.setItem('dkx_admin_session', 'true');
      setAuthError('');
    } else {
      setAuthError('ভুল পাসওয়ার্ড (Incorrect password). অনুগ্রহ করে সঠিক কোড দিন।');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error.message || 'Google লগইন ব্যর্থ হয়েছে');
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('dkx_admin_session');
    setIsAuthenticated(false);
    try {
      await signOut(auth);
    } catch {
      //
    }
  };

  const handleMarkStatus = async (msgId: string, newStatus: 'read' | 'unread') => {
    try {
      await updateDoc(doc(db, 'messages', msgId), { status: newStatus });
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত এই মেসেজটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'messages', msgId));
      if (selectedMessage?.id === msgId) setSelectedMessage(null);
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  const handleUnlockRecord = async (lockId: string) => {
    if (!window.confirm('এই আইপি/ডিভাইস আনলক করতে চান? এর ফলে তারা আবার বার্তা পাঠাতে পারবে।')) return;
    try {
      await deleteDoc(doc(db, 'locks', lockId));
      alert('সফলভাবে আনলক করা হয়েছে!');
    } catch (err) {
      console.error('Unlock error:', err);
    }
  };

  // Filtered messages
  const filteredMessages = messages.filter((m) => {
    const matchQuery =
      (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.telegram || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.ip || '').includes(searchQuery);
    
    if (statusFilter === 'unread') return matchQuery && m.status === 'unread';
    if (statusFilter === 'read') return matchQuery && m.status === 'read';
    return matchQuery;
  });

  // Password Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#e5e5e5] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 subtle-grid opacity-20 pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-white/[0.03] blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-2xl p-8 relative z-10 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-white font-display">DK X Admin Console</h1>
                <p className="text-xs text-neutral-500">Restricted Portal · Secure Authentication</p>
              </div>
            </div>
            <button
              onClick={onExit}
              className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit
            </button>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-2 font-mono">
                Master Security Passcode
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin passcode"
                  className="w-full bg-[#141414] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/30 transition-colors font-mono"
                  autoFocus
                />
              </div>
            </div>

            {authError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-white text-black font-medium text-xs py-3 rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              Authenticate & Access
            </button>
          </form>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative bg-[#0F0F0F] px-3 text-[11px] text-neutral-500 font-mono">OR</span>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white py-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Globe className="w-3.5 h-3.5 text-neutral-400" />
            Sign in with Google Admin
          </button>

          <div className="mt-6 pt-5 border-t border-white/5 text-[11px] text-neutral-500 text-center font-mono">
            Direct Access: /ewt · Secret Administrative Dashboard
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-[#EDEDED] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 border-b border-white/10 bg-[#0A0A0A] px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Site</span>
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white font-display">DK X</span>
            <span className="text-xs text-neutral-500 font-mono">/ Console</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'messages' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Messages</span>
            <span className="text-[10px] ml-1 font-mono tabular-nums opacity-80">({messages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('visitors')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'visitors' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visitors Telemetry</span>
            <span className="text-[10px] ml-1 font-mono tabular-nums opacity-80">({visitors.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('locks')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'locks' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Locks</span>
            <span className="text-[10px] ml-1 font-mono tabular-nums opacity-80">({locks.length})</span>
          </button>
        </div>

        {/* Admin Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDataDirectly}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Reload latest data from Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'লোড হচ্ছে...' : 'রিফ্রেশ'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="text-xs text-neutral-400 hover:text-rose-400 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-rose-500/30"
          >
            Lock & Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {serverError && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center justify-between">
            <span>{serverError}</span>
            <button
              onClick={fetchDataDirectly}
              className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-white text-[11px]"
            >
              পুনরায় চেষ্টা করুন
            </button>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0D0D0D] border border-white/10 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Total Received Messages</span>
              <Mail className="w-4 h-4 text-neutral-500" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {messages.length}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 font-mono">
              Unread: {messages.filter(m => m.status === 'unread').length}
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-white/10 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Tracked Visitors</span>
              <Eye className="w-4 h-4 text-neutral-500" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {visitors.length}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 font-mono">
              Total hits logged
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-white/10 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Active Device Locks</span>
              <Lock className="w-4 h-4 text-neutral-500" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {locks.length}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 font-mono">
              Per-device lock enforcement
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-white/10 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Unique Countries</span>
              <Globe className="w-4 h-4 text-neutral-500" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {new Set(visitors.map(v => v.country).filter(Boolean)).size || 1}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 font-mono">
              Global audience outreach
            </div>
          </div>
        </div>

        {/* Tab 1: Messages View */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, IP, message..."
                  className="w-full bg-[#121212] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 self-end">
                <span className="text-xs text-neutral-500">Status:</span>
                <div className="flex items-center bg-[#121212] border border-white/10 rounded-lg p-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      statusFilter === 'all' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter('unread')}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      statusFilter === 'unread' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setStatusFilter('read')}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      statusFilter === 'read' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Read
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Grid or Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Message List */}
              <div className="lg:col-span-5 bg-[#0D0D0D] border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500 text-xs">
                    কোনো মেসেজ পাওয়া যায়নি (No messages recorded yet).
                  </div>
                ) : (
                  filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => {
                        setSelectedMessage(msg);
                        if (msg.status === 'unread') handleMarkStatus(msg.id, 'read');
                      }}
                      className={`p-4 cursor-pointer transition-colors hover:bg-white/[0.02] ${
                        selectedMessage?.id === msg.id ? 'bg-white/[0.04]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-semibold ${msg.status === 'unread' ? 'text-white' : 'text-neutral-300'}`}>
                          {msg.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(msg.createdAt).toLocaleDateString()} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono mb-2 truncate">
                        <span className="text-neutral-400">{msg.email}</span>
                        {msg.telegram && (
                          <>
                            <span className="text-neutral-600">·</span>
                            <span className="text-sky-400">TG: {msg.telegram}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                        {msg.message}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                        <span>IP: {msg.ip}</span>
                        <span>{msg.location || 'Location Not Specified'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Detail Card */}
              <div className="lg:col-span-7 bg-[#0D0D0D] border border-white/10 rounded-xl p-6">
                {selectedMessage ? (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between border-b border-white/10 pb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-lg font-bold text-white font-display">{selectedMessage.name}</h2>
                          {selectedMessage.status === 'unread' && (
                            <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded font-mono">UNREAD</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                          <a
                            href={`mailto:${selectedMessage.email}`}
                            className="text-neutral-400 hover:text-white transition-colors"
                          >
                            {selectedMessage.email}
                          </a>
                          {selectedMessage.telegram && (
                            <>
                              <span className="text-neutral-600">·</span>
                              <a
                                href={`https://t.me/${selectedMessage.telegram.replace('@', '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1"
                              >
                                <span>TG: {selectedMessage.telegram}</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedMessage.status === 'unread' ? (
                          <button
                            onClick={() => handleMarkStatus(selectedMessage.id, 'read')}
                            className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 hover:bg-white/10 rounded text-neutral-300 flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark Read
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkStatus(selectedMessage.id, 'unread')}
                            className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 hover:bg-white/10 rounded text-neutral-400 flex items-center gap-1.5"
                          >
                            Mark Unread
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                          className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 rounded text-rose-400"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Sender Message Body */}
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">Message Body</h3>
                      <div className="bg-[#121212] border border-white/5 rounded-lg p-5 text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
                        {selectedMessage.message}
                      </div>
                    </div>

                    {/* Full Device & Network Forensic Breakdown */}
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-3">Sender Telemetry & Metadata</h3>
                      <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                        <div className="bg-[#121212] p-3 rounded border border-white/5">
                          <span className="text-[10px] text-neutral-500 block">IP Address</span>
                          <span className="text-neutral-200">{selectedMessage.ip}</span>
                        </div>
                        <div className="bg-[#121212] p-3 rounded border border-white/5">
                          <span className="text-[10px] text-neutral-500 block">Estimated Location</span>
                          <span className="text-neutral-200">{selectedMessage.location || 'N/A'}</span>
                        </div>
                        <div className="bg-[#121212] p-3 rounded border border-white/5 col-span-2">
                          <span className="text-[10px] text-neutral-500 block">Device & Browser Summary</span>
                          <span className="text-neutral-200">{selectedMessage.deviceSummary || 'N/A'}</span>
                        </div>
                        <div className="bg-[#121212] p-3 rounded border border-white/5 col-span-2">
                          <span className="text-[10px] text-neutral-500 block">Device Fingerprint Hash</span>
                          <span className="text-neutral-400 text-[11px] break-all">{selectedMessage.fingerprint}</span>
                        </div>
                        <div className="bg-[#121212] p-3 rounded border border-white/5 col-span-2">
                          <span className="text-[10px] text-neutral-500 block">Received Timestamp</span>
                          <span className="text-neutral-200">{new Date(selectedMessage.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-neutral-500 text-xs">
                    <Mail className="w-8 h-8 mb-2 opacity-30" />
                    <span>তালিকা থেকে যেকোনো মেসেজ নির্বাচন করুন (Select a message to view details)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Visitors Telemetry Table */}
        {activeTab === 'visitors' && (
          <div className="bg-[#0D0D0D] border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white font-display">Visitor Telemetry Logs</h2>
                <p className="text-xs text-neutral-500">Live capture of visitor IP, geolocation, device classification & browser metrics</p>
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                {visitors.length} total entries
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#121212] border-b border-white/5 text-neutral-400">
                  <tr>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">OS & Browser</th>
                    <th className="py-3 px-4">Resolution</th>
                    <th className="py-3 px-4">Visits</th>
                    <th className="py-3 px-4">SMS Sent</th>
                    <th className="py-3 px-4">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-neutral-500">
                        এখনো কোনো ভিজিটর লগ তৈরি হয়নি (No visitor data collected yet).
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{v.ip}</td>
                        <td className="py-3 px-4 text-neutral-300">
                          {v.city && v.city !== 'Unknown' ? `${v.city}, ` : ''}{v.country || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          <span className="text-neutral-400">{v.deviceType || 'Desktop'}</span> · {v.deviceName || 'Standard'}
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          {v.os || 'OS'} / {v.browser || 'Browser'}
                        </td>
                        <td className="py-3 px-4 text-neutral-400">{v.screenResolution || 'N/A'}</td>
                        <td className="py-3 px-4 text-neutral-200 tabular-nums">{v.visitCount || 1}</td>
                        <td className="py-3 px-4">
                          {v.hasSubmittedMessage ? (
                            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                              <CheckCheck className="w-3.5 h-3.5" /> Sent
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-neutral-400 text-[11px]">
                          {v.lastVisitedAt ? new Date(v.lastVisitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Lock Management */}
        {activeTab === 'locks' && (
          <div className="bg-[#0D0D0D] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h2 className="text-sm font-semibold text-white font-display">One-Time Submission Locks</h2>
                <p className="text-xs text-neutral-500">
                  Enforces strict one-message limit per IP and fingerprint. Unlocking allows a visitor to submit again.
                </p>
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                {locks.length} active locks
              </div>
            </div>

            {locks.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-xs">
                কোনো সক্রিয় লক পাওয়া যায়নি (No active locks yet).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locks.map((lk) => (
                  <div key={lk.id} className="bg-[#121212] border border-white/5 rounded-lg p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-medium text-white flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-neutral-400" />
                          {lk.ip || lk.identifier}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(lk.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono truncate mb-4">
                        Ref Message: {lk.messageId || 'Direct lock'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnlockRecord(lk.id)}
                      className="w-full py-1.5 px-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded text-xs text-neutral-300 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Release & Unlock IP</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
