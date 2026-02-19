
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ViewState, Product, Category, CartItem, Language, LocalizedString, UserAccount, Order, UserRole, PaymentInfo, TelegramConfig } from './types';
import { MOCK_PRODUCTS, UI_STRINGS } from './constants';
import { searchProductsSmartly, generateCookingSuggestion, getSmartSuggestions } from './services/gemini';

const LKR_TO_VND_RATE = 88;

const DEFAULT_SHELF_CATEGORIES: Category[] = [
  { id: 'cat-personal', name: { vi: 'Chăm Sóc Cá Nhân', en: 'Personal Care', zh: '个人护理' }, icon: 'https://i.ibb.co/yBWjLMMh/1.png', color: 'from-[#2d3a30] to-[#1c2c24]' },
  { id: 'cat-cleaning', name: { vi: 'Tẩy sạch – Vệ sinh', en: 'Cleaning & Hygiene', zh: '清洁卫生' }, icon: 'https://i.ibb.co/zHVpF8Zy/2.png', color: 'from-[#436151] to-[#2d3a30]' },
  { id: 'cat-dryfood', name: { vi: 'Thực Phẩm Khô', en: 'Dry Food', zh: '干货食品' }, icon: 'https://i.ibb.co/ZRY35yFk/3.png', color: 'from-[#c48b36] to-[#a6722a]' },
  { id: 'cat-beverages', name: { vi: 'Đồ uống', en: 'Beverages', zh: '饮料' }, icon: 'https://i.ibb.co/1YRB2dQD/4.png', color: 'from-[#4a4e4d] to-[#1c2c24]' },
  { id: 'cat-snacks', name: { vi: 'Bánh Kẹo – Ăn Vặt', en: 'Snacks & Sweets', zh: '零食点心' }, icon: 'https://i.ibb.co/spnCZ0zb/5.png', color: 'from-[#8b4513] to-[#5d2e0c]' },
];

const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md border border-rustic-border/50 ${className}`}>
    <img src="https://i.ibb.co/JwKPKb54/Chat-GPT-Image-11-17-56-15-thg-2-2026.png" alt="Logo" className="w-full h-full object-cover" />
  </div>
);

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
);

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [lang, setLang] = useState<Language>('vi'); 
  const [activeShelfCategory, setActiveShelfCategory] = useState<string | null>(null);
  
  // Database Persistence
  const [accounts, setAccounts] = useState<UserAccount[]>(() => JSON.parse(localStorage.getItem('sl_acc_v3') || '[]'));
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => JSON.parse(localStorage.getItem('sl_user_v3') || 'null'));
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('sl_prod_v3') || JSON.stringify(MOCK_PRODUCTS)));
  const [orders, setOrders] = useState<Order[]>(() => JSON.parse(localStorage.getItem('sl_orders_v3') || '[]'));
  const [shelfCategories, setShelfCategories] = useState<Category[]>(() => JSON.parse(localStorage.getItem('sl_cats_v3') || JSON.stringify(DEFAULT_SHELF_CATEGORIES)));
  const [paymentConfig, setPaymentConfig] = useState<PaymentInfo>(() => JSON.parse(localStorage.getItem('sl_pay_v3') || JSON.stringify({
    bankName: 'Vietcombank',
    accountName: 'NGUYEN VAN A',
    accountNumber: '123456789',
    instruction: 'Nội dung: Tên + SĐT đặt hàng'
  })));
  
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem('sl_tg_v3');
    if (saved) return JSON.parse(saved);
    return {
      botToken: '8367455068:AAG1y3IpnYqPi13eWOD-sDqMdnK3AXD3CFE',
      chatId: '8355403427',
      isEnabled: true
    };
  });

  useEffect(() => { localStorage.setItem('sl_acc_v3', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('sl_user_v3', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { localStorage.setItem('sl_prod_v3', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('sl_orders_v3', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('sl_cats_v3', JSON.stringify(shelfCategories)); }, [shelfCategories]);
  useEffect(() => { localStorage.setItem('sl_pay_v3', JSON.stringify(paymentConfig)); }, [paymentConfig]);
  useEffect(() => { localStorage.setItem('sl_tg_v3', JSON.stringify(telegramConfig)); }, [telegramConfig]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [smartMatches, setSmartMatches] = useState<string[]>([]);
  
  const [customReq, setCustomReq] = useState({ city: '', contact: '', needs: '' });
  const [isLocating, setIsLocating] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [authData, setAuthData] = useState({ username: '', password: '', fullName: '', phone: '' });
  const [authError, setAuthError] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // --- Currency Converter States ---
  const [convLkr, setConvLkr] = useState<string>('1');
  const [convVnd, setConvVnd] = useState<string>((1 * LKR_TO_VND_RATE).toString());

  const t = UI_STRINGS[lang];

  // --- Statistics for Admin ---
  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => o.status === 'delivered' ? sum + o.total : sum, 0);
    return {
      revenue: totalRevenue,
      orderCount: orders.length,
      userCount: accounts.length,
      productCount: products.length
    };
  }, [orders, accounts, products]);

  // --- Smart Search Logic ---
  const triggerSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSmartMatches([]); return; }
    setIsAiSearching(true);
    try { 
      const ids = await searchProductsSmartly(q, products, lang); 
      setSmartMatches(ids); 
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsAiSearching(false); 
    }
  }, [products, lang]);

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery) triggerSearch(searchQuery); }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, triggerSearch]);

  const filteredSearchProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const localMatches = products.filter(p => 
      p.name[lang].toLowerCase().includes(q) || 
      p.category[lang].toLowerCase().includes(q)
    );
    const aiResults = products.filter(p => smartMatches.includes(p.id));
    const combined = [...localMatches];
    aiResults.forEach(p => { if (!combined.find(m => m.id === p.id)) combined.push(p); });
    return combined;
  }, [searchQuery, products, lang, smartMatches]);

  const sendOrderToTelegram = async (order: Order) => {
    if (!telegramConfig.isEnabled || !telegramConfig.botToken || !telegramConfig.chatId) return;
    let message = `<b>🔔 CÓ ĐƠN HÀNG MỚI!</b>\n\n🆔 <b>Mã ĐH:</b> <code>${order.id}</code>\n👤 <b>Khách hàng:</b> ${order.customerName}\n📱 <b>Liên hệ:</b> ${order.contact}\n`;
    if (order.type === 'custom') {
      message += `🚩 <b>Loại:</b> GIAO HÀNG THEO YÊU CẦU\n📍 <b>Khu vực:</b> ${order.address || 'Không xác định'}\n💬 <b>Yêu cầu:</b> <i>${order.note}</i>\n`;
    } else {
      message += `🛒 <b>Loại:</b> ĐƠN GIỎ HÀNG\n📦 <b>Sản phẩm:</b>\n`;
      order.items.forEach((item, index) => { message += `${index + 1}. ${item.name.vi} (x${item.quantity})\n`; });
      const totalVnd = (order.total * LKR_TO_VND_RATE).toLocaleString('vi-VN');
      message += `💰 <b>Tổng:</b> <code>${order.total.toLocaleString()} LKR</code> (≈ ${totalVnd} VND)\n`;
    }
    if (order.location) message += `\n📍 <b>Vị trí GPS:</b> <a href="https://www.google.com/maps?q=${order.location.lat},${order.location.lng}">Mở Bản Đồ</a>\n`;
    message += `\n⏰ <i>Gửi lúc: ${new Date().toLocaleString('vi-VN')}</i>`;
    try {
      await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramConfig.chatId, text: message, parse_mode: 'HTML' })
      });
    } catch (e) { console.error('Telegram Error:', e); }
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      alert(t.locationError);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        alert(t.locationError);
        setIsLocating(false);
      }
    );
  };

  const createOrder = (type: 'cart' | 'custom') => {
    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      userId: currentUser?.id,
      customerName: type === 'cart' ? (contactInfo || currentUser?.fullName || 'Khách vãng lai') : (customReq.contact || 'Khách đặt riêng'),
      contact: type === 'cart' ? contactInfo : customReq.contact,
      items: type === 'cart' ? [...cart] : [],
      total: type === 'cart' ? totalPrice : 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      type: type,
      location: location || undefined,
      note: type === 'custom' ? customReq.needs : '',
      address: type === 'custom' ? customReq.city : ''
    };
    setOrders([newOrder, ...orders]);
    sendOrderToTelegram(newOrder);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (authData.username === 'admin' && authData.password === '590945') {
      const adminAcc: UserAccount = { id: 'admin', username: 'admin', fullName: 'QUẢN TRỊ VIÊN', role: 'admin', createdAt: new Date().toISOString() };
      setCurrentUser(adminAcc); setView('home'); setAuthData({ username: '', password: '', fullName: '', phone: '' });
      return;
    }
    const user = accounts.find(a => a.username === authData.username && a.password === authData.password);
    if (user) { setCurrentUser(user); setView('home'); }
    else setAuthError('Tài khoản hoặc mật khẩu không đúng');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      username: authData.username,
      password: authData.password,
      fullName: authData.fullName,
      phone: authData.phone,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    setAccounts([...accounts, newUser]);
    setCurrentUser(newUser);
    setView('home');
  };

  const updateAccountRole = (userId: string, role: UserRole) => {
    setAccounts(prev => prev.map(a => a.id === userId ? { ...a, role } : a));
    if (currentUser?.id === userId) setCurrentUser({ ...currentUser, role });
    alert(`Đã cập nhật vai trò ${role.toUpperCase()}!`);
  };

  const formatPrice = (price: number | LocalizedString, showVnd = true) => {
    if (typeof price === 'number') {
      const lkrStr = `${price.toLocaleString()} LKR`;
      if (showVnd) {
        const vndValue = price * LKR_TO_VND_RATE;
        return (
          <div className="flex flex-col">
            <span className="font-black text-rustic-accent">{lkrStr}</span>
            <span className="text-[9px] font-bold text-rustic-primary/40">≈ {vndValue.toLocaleString('vi-VN')} VND</span>
          </div>
        );
      }
      return <span className="font-black text-rustic-accent">{lkrStr}</span>;
    }
    return <span className="font-black text-rustic-accent">{price[lang]}</span>;
  };

  const totalPrice = useMemo(() => cart.reduce((acc, item) => {
    const p = typeof item.price === 'number' ? item.price : 0;
    return acc + (p * item.quantity);
  }, 0), [cart]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleLkrChange = (val: string) => {
    setConvLkr(val);
    const num = parseFloat(val);
    if (!isNaN(num)) setConvVnd((num * LKR_TO_VND_RATE).toLocaleString('vi-VN'));
    else setConvVnd('');
  };

  const handleVndChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, '');
    setConvVnd(cleanVal);
    const num = parseFloat(cleanVal);
    if (!isNaN(num)) setConvLkr((num / LKR_TO_VND_RATE).toFixed(2));
    else setConvLkr('');
  };

  const renderCurrencyConverter = () => (
    <div className="pb-32 animate-fade-in bg-white min-h-screen">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
        <button onClick={() => setView('home')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
        <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">{t.currencyConverter}</h2>
        <div className="w-10"></div>
      </header>
      
      <div className="px-6 mt-12 space-y-8 text-center">
        <div className="bg-rustic-bg/50 p-10 rounded-[3rem] border border-rustic-border shadow-inner">
           <div className="space-y-6">
             <div className="text-left">
               <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-3 px-2">Số tiền (Sri Lanka Rupee - LKR)</label>
               <div className="relative">
                 <input 
                  type="number" 
                  value={convLkr} 
                  onChange={e => handleLkrChange(e.target.value)}
                  className="w-full bg-white p-6 rounded-2xl border border-rustic-border text-lg font-black text-rustic-primary focus:outline-none focus:border-rustic-accent transition-all shadow-sm"
                 />
                 <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-rustic-accent">LKR</span>
               </div>
             </div>

             <div className="flex justify-center">
                <div className="w-12 h-12 bg-rustic-primary text-white rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                </div>
             </div>

             <div className="text-left">
               <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-3 px-2">Chuyển sang (Việt Nam Đồng - VND)</label>
               <div className="relative">
                 <input 
                  type="text" 
                  value={convVnd} 
                  onChange={e => handleVndChange(e.target.value)}
                  className="w-full bg-white p-6 rounded-2xl border border-rustic-border text-lg font-black text-rustic-accent focus:outline-none focus:border-rustic-primary transition-all shadow-sm"
                 />
                 <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-rustic-primary/40">VND</span>
               </div>
             </div>
           </div>
        </div>

        <div className="p-8 bg-rustic-primary text-white rounded-[2.5rem] shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">Tỷ giá hiện tại</p>
          <h4 className="text-xl font-serif font-black">1 LKR = {LKR_TO_VND_RATE} VND</h4>
          <p className="text-[9px] font-medium opacity-30 mt-4 leading-relaxed italic">Hệ thống siêu thị áp dụng tỷ giá cố định 88.000đ cho mỗi 1.000 LKR để hỗ trợ khách hàng thanh toán thuận tiện nhất.</p>
        </div>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="pb-32 animate-fade-in bg-white min-h-screen">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
        <button onClick={() => setView('profile')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
        <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Admin Dashboard</h2>
        <div className="w-10"></div>
      </header>
      
      <div className="px-6 space-y-8 mt-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-rustic-bg/50 p-6 rounded-[2rem] border border-rustic-border/50 shadow-sm">
             <p className="text-[9px] font-black uppercase text-rustic-primary/40 mb-1">Doanh thu (Đã giao)</p>
             <h4 className="text-lg font-black text-rustic-accent truncate">{stats.revenue.toLocaleString()} LKR</h4>
           </div>
           <div className="bg-rustic-bg/50 p-6 rounded-[2rem] border border-rustic-border/50 shadow-sm">
             <p className="text-[9px] font-black uppercase text-rustic-primary/40 mb-1">Tổng đơn hàng</p>
             <h4 className="text-lg font-black text-rustic-primary">{stats.orderCount}</h4>
           </div>
           <div className="bg-rustic-bg/50 p-6 rounded-[2rem] border border-rustic-border/50 shadow-sm">
             <p className="text-[9px] font-black uppercase text-rustic-primary/40 mb-1">Thành viên</p>
             <h4 className="text-lg font-black text-rustic-primary">{stats.userCount}</h4>
           </div>
           <div className="bg-rustic-bg/50 p-6 rounded-[2rem] border border-rustic-border/50 shadow-sm">
             <p className="text-[9px] font-black uppercase text-rustic-primary/40 mb-1">Sản phẩm</p>
             <h4 className="text-lg font-black text-rustic-primary">{stats.productCount}</h4>
           </div>
        </div>

        {/* Action Links */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-rustic-primary/30 px-2">QUẢN LÝ HỆ THỐNG</h4>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: '📦 Quản lý Đơn hàng', view: 'admin-orders', color: 'bg-white' },
              { label: '🛍️ Quản lý Sản phẩm', view: 'admin-product-list', color: 'bg-white' },
              { label: '📂 Quản lý Danh mục Kệ', view: 'admin-categories', color: 'bg-white' },
              { label: '💳 Cấu hình Thanh toán', view: 'admin-payment-config', color: 'bg-white' },
              { label: '🤖 Cấu hình Telegram Bot', view: 'admin-telegram-config', color: 'bg-white' },
              { label: '👥 Quản lý Người dùng / Phân quyền', view: 'admin-user-list', color: 'bg-white' },
            ].map((btn, idx) => (
              <button 
                key={idx} 
                onClick={() => setView(btn.view as ViewState)} 
                className={`w-full p-5 ${btn.color} border border-rustic-border text-rustic-primary rounded-[1.5rem] flex items-center justify-between shadow-sm active:scale-[0.98] transition-all`}
              >
                <span className="text-[11px] font-black uppercase tracking-wider">{btn.label}</span>
                <svg className="w-4 h-4 text-rustic-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#fcfaf7] relative shadow-2xl font-sans text-rustic-text overflow-hidden">
      <main className="animate-fade-in h-screen overflow-y-auto hide-scrollbar">
        {view === 'home' && (
          <div className="pb-32">
            <header className="px-6 pt-12 pb-6 sticky top-0 glass-header z-40 border-b border-rustic-border/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Logo />
                <div>
                  <h1 className="text-2xl font-serif font-black text-rustic-primary leading-none tracking-tight">SRILANKA</h1>
                  <span className="text-[10px] font-black text-rustic-accent uppercase tracking-[0.3em]">{t.market}</span>
                </div>
              </div>
              <div className="flex bg-white/60 backdrop-blur-lg p-1 rounded-2xl border border-rustic-border shadow-sm">
                {(['vi', 'en', 'zh'] as Language[]).map(l => (
                  <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${lang === l ? 'bg-rustic-primary text-white shadow-lg' : 'text-rustic-primary/40'}`}>
                    {l === 'vi' ? 'VN' : l === 'en' ? 'EN' : 'CN'}
                  </button>
                ))}
              </div>
            </header>

            <div className="px-6 mt-6">
              <div onClick={() => setView('search')} className="bg-white border border-rustic-border/60 p-4 rounded-3xl flex items-center gap-3 shadow-sm cursor-pointer">
                <svg className="w-5 h-5 text-rustic-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span className="text-xs font-bold text-rustic-primary/30">Tìm hải sản, đồ gia dụng...</span>
              </div>
            </div>
            
            <div className="px-6 mt-8">
              <div onClick={() => setView('custom-delivery')} className="relative h-44 rounded-[2.5rem] overflow-hidden shadow-2xl bg-rustic-primary border border-white/10 cursor-pointer group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] opacity-10"></div>
                <div className="relative h-full flex flex-col justify-center px-10 z-10">
                  <h2 className="text-2xl font-serif font-black text-white mb-1 uppercase tracking-tight">{t.customDelivery}</h2>
                  <p className="text-[10px] text-rustic-accent font-black uppercase tracking-[0.2em] mb-4">{t.fastAndCheap}</p>
                  <div className="w-max bg-rustic-accent text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl">ĐẶT NGAY</div>
                </div>
                <svg className="w-40 h-40 absolute -right-8 -bottom-8 text-white/10 rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-2v2h-2v-2H9v2H7v-2H5c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h14zM19 3c1.1 0 2 .9 2 2v6h-2V5H5v6H3V5c0-1.1.9-2 2-2h14z"/></svg>
              </div>
            </div>

            {/* Quick Currency Tool Access */}
            <div className="px-6 mt-6">
               <div onClick={() => setView('currency-converter')} className="bg-white p-6 rounded-[2rem] border border-rustic-border shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rustic-accent/10 text-rustic-accent rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-rustic-primary">{t.currencyConverter}</h4>
                      <p className="text-[9px] font-bold text-rustic-primary/40 uppercase">1 LKR = 88 VND</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-rustic-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-5 px-6 mt-10 mb-10">
              {products.filter(p => !p.isShelfItem).map(p => (
                <div key={p.id} className="bg-white p-3 rounded-[2rem] border border-rustic-border/50 card-shadow" onClick={() => { setSelectedProduct(p); setView('product-details'); }}>
                  <img src={p.image} className="w-full aspect-[4/5] object-cover mb-3 rounded-3xl" alt="" />
                  <div className="px-1">
                    <h3 className="text-[12px] font-bold text-rustic-primary truncate mb-1">{p.name[lang]}</h3>
                    {formatPrice(p.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'admin-dashboard' && renderAdminDashboard()}
        {view === 'currency-converter' && renderCurrencyConverter()}
        
        {view === 'admin-orders' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-dashboard')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Quản lý Đơn hàng</h2>
              <div className="w-10"></div>
            </header>
            <div className="px-6 space-y-5 mt-4">
              {orders.length === 0 ? (
                <div className="py-20 text-center opacity-20 uppercase font-black text-xs">Chưa có đơn hàng nào</div>
              ) : orders.map(order => (
                <div key={order.id} className="bg-rustic-bg/40 p-6 rounded-[2rem] border border-rustic-border/50 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex gap-2 items-center mb-1">
                        <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase text-white ${order.type === 'custom' ? 'bg-rustic-accent' : 'bg-rustic-primary'}`}>{order.type}</span>
                        <h4 className="text-[10px] font-black text-rustic-primary/40 uppercase tracking-tighter">{order.id}</h4>
                      </div>
                      <h4 className="font-black text-rustic-primary text-sm">{order.customerName}</h4>
                      <p className="text-[10px] font-bold text-rustic-accent">{order.contact}</p>
                    </div>
                    <select 
                      value={order.status} 
                      onChange={(e) => setOrders(orders.map(o => o.id === order.id ? {...o, status: e.target.value as Order['status']} : o))} 
                      className={`text-[8px] font-black p-2 rounded-xl border border-rustic-border focus:outline-none appearance-none bg-white shadow-sm ${order.status === 'delivered' ? 'text-emerald-600' : order.status === 'cancelled' ? 'text-rose-500' : 'text-rustic-accent'}`}
                    >
                      <option value="pending">PENDING</option>
                      <option value="processing">PROCESSING</option>
                      <option value="shipped">SHIPPED</option>
                      <option value="delivered">DELIVERED</option>
                      <option value="cancelled">CANCELLED</option>
                    </select>
                  </div>
                  <div className="border-t border-rustic-border/20 pt-4">
                    {order.type === 'cart' ? (
                      <div className="space-y-1 mb-3">
                         {order.items.map((item, idx) => (
                           <div key={idx} className="flex justify-between text-[10px] font-medium text-rustic-primary/60">
                             <span>{item.name.vi} x{item.quantity}</span>
                             <span>{((typeof item.price === 'number' ? item.price : 0) * item.quantity).toLocaleString()} LKR</span>
                           </div>
                         ))}
                      </div>
                    ) : (
                      <div className="mb-3">
                        <p className="text-[10px] font-medium text-rustic-primary/60"><b>Khu vực:</b> {order.address}</p>
                        <p className="text-[10px] font-medium text-rustic-primary/60"><b>Yêu cầu:</b> <i>{order.note}</i></p>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-rustic-primary/20 uppercase">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                      <div className="text-right">
                        <h4 className="text-sm font-black text-rustic-primary">{order.total.toLocaleString()} LKR</h4>
                        <p className="text-[9px] font-bold text-rustic-primary/40">≈ {(order.total * LKR_TO_VND_RATE).toLocaleString('vi-VN')} VND</p>
                      </div>
                    </div>
                  </div>
                  {order.location && (
                    <a href={`https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`} target="_blank" className="block text-center py-3 bg-white border border-rustic-border rounded-xl text-[9px] font-black uppercase text-indigo-600 shadow-sm">📍 Xem vị trí khách</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'admin-product-list' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-dashboard')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Quản lý Sản phẩm</h2>
              <button onClick={() => { setEditingProduct(null); setView('admin-product-form'); }} className="p-3 bg-rustic-accent text-white rounded-xl shadow-lg active:scale-90 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
            </header>
            <div className="px-6 space-y-4 mt-4">
              {products.map(p => (
                <div key={p.id} className="bg-rustic-bg/40 p-4 rounded-[1.5rem] border border-rustic-border/50 flex items-center gap-4">
                  <img src={p.image} className="w-14 h-14 rounded-2xl object-cover shadow-sm" alt="" />
                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-[12px] font-bold text-rustic-primary truncate">{p.name.vi}</h4>
                    <div className="flex items-center gap-2">
                      {formatPrice(p.price)}
                      <span className="text-[8px] font-bold text-rustic-primary/30 uppercase tracking-tighter ml-2">{p.category.vi}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingProduct(p); setView('admin-product-form'); }} className="p-2.5 bg-white border border-rustic-border rounded-xl text-indigo-600 shadow-sm"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.995.995 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button onClick={() => { if(window.confirm('Xóa sản phẩm này?')) setProducts(products.filter(i => i.id !== p.id)); }} className="p-2.5 bg-white border border-rustic-border rounded-xl text-rose-500 shadow-sm"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'admin-product-form' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-product-list')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">{editingProduct ? 'Sửa Sản Phẩm' : 'Thêm Sản Phẩm'}</h2>
              <div className="w-10"></div>
            </header>
            <form className="px-6 mt-6 space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const nameVi = fd.get('n') as string;
              const pData: Partial<Product> = {
                name: { vi: nameVi, en: nameVi, zh: nameVi },
                price: Number(fd.get('p')),
                image: (fd.get('i') as string) || 'https://via.placeholder.com/300',
                category: { vi: fd.get('c') as string, en: fd.get('c') as string, zh: fd.get('c') as string },
                isShelfItem: fd.get('s') === 'on'
              };
              if(editingProduct) setProducts(products.map(p => p.id === editingProduct.id ? {...p, ...pData} : p));
              else setProducts([{ id: `p-${Date.now()}`, ...pData, description: {vi:'',en:'',zh:''}, rating:5, reviews:0 } as Product, ...products]);
              setView('admin-product-list');
            }}>
              <div className="bg-rustic-bg/40 p-8 rounded-[2.5rem] border border-rustic-border space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Tên sản phẩm</label>
                  <input name="n" defaultValue={editingProduct?.name.vi} required className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Giá (LKR)</label>
                  <input name="p" type="number" defaultValue={typeof editingProduct?.price === 'number' ? editingProduct.price : 0} required className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Link Ảnh</label>
                  <input name="i" defaultValue={editingProduct?.image} className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-mono text-[10px]" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Danh mục (VD: Hải sản, Đồ uống...)</label>
                  <input name="c" defaultValue={editingProduct?.category.vi} required className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-bold" />
                </div>
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-rustic-border">
                  <input type="checkbox" name="s" defaultChecked={editingProduct?.isShelfItem} id="s_check" className="w-5 h-5 accent-rustic-primary" />
                  <label htmlFor="s_check" className="text-[11px] font-black uppercase text-rustic-primary">Đây là hàng tiêu dùng (Kệ hàng)</label>
                </div>
              </div>
              <button type="submit" className="w-full bg-rustic-primary text-white py-6 rounded-3xl font-black uppercase text-[12px] tracking-widest shadow-xl">LƯU SẢN PHẨM</button>
            </form>
          </div>
        )}

        {view === 'admin-categories' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-dashboard')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Danh mục Kệ</h2>
              <button onClick={() => { setEditingCategory(null); setView('admin-category-form'); }} className="p-3 bg-rustic-accent text-white rounded-xl shadow-lg active:scale-90 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
            </header>
            <div className="px-6 space-y-4 mt-4">
              {shelfCategories.map(cat => (
                <div key={cat.id} className="bg-rustic-bg/40 p-5 rounded-[2rem] border border-rustic-border/50 flex items-center gap-4 shadow-sm">
                  <div className={`w-14 h-14 bg-gradient-to-br ${cat.color || 'from-gray-100 to-gray-300'} rounded-2xl flex items-center justify-center p-3 shadow-sm`}>
                    <img src={cat.icon} className="w-full h-full object-contain" alt="" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-rustic-primary text-sm">{cat.name.vi}</h4>
                    <p className="text-[9px] font-bold text-rustic-primary/30 uppercase tracking-widest">{cat.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingCategory(cat); setView('admin-category-form'); }} className="p-2.5 bg-white border border-rustic-border rounded-xl text-indigo-600 shadow-sm"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.995.995 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button onClick={() => { if(window.confirm('Xóa danh mục này?')) setShelfCategories(shelfCategories.filter(c => c.id !== cat.id)); }} className="p-2.5 bg-white border border-rustic-border rounded-xl text-rose-500 shadow-sm"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'admin-category-form' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-categories')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">{editingCategory ? 'Sửa Danh Mục' : 'Thêm Danh Mục'}</h2>
              <div className="w-10"></div>
            </header>
            <form className="px-6 mt-6 space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const nameVi = fd.get('vi') as string;
              const cData: Category = {
                id: editingCategory?.id || `cat-${Date.now()}`,
                name: { vi: nameVi, en: nameVi, zh: nameVi },
                icon: (fd.get('icon') as string) || 'https://via.placeholder.com/100',
                color: (fd.get('color') as string) || 'from-gray-100 to-gray-300'
              };
              if(editingCategory) setShelfCategories(shelfCategories.map(c => c.id === editingCategory.id ? cData : c));
              else setShelfCategories([cData, ...shelfCategories]);
              setView('admin-categories');
            }}>
              <div className="bg-rustic-bg/40 p-8 rounded-[2.5rem] border border-rustic-border space-y-5">
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Tên danh mục</label>
                   <input name="vi" defaultValue={editingCategory?.name.vi} required className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-bold" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Link Icon (PNG)</label>
                   <input name="icon" defaultValue={editingCategory?.icon} className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-mono text-[10px]" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Màu Gradient (Tailwind CSS)</label>
                   <input name="color" defaultValue={editingCategory?.color} placeholder="from-blue-500 to-indigo-600" className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-mono text-[10px]" />
                 </div>
              </div>
              <button type="submit" className="w-full bg-rustic-primary text-white py-6 rounded-3xl font-black uppercase text-[12px] tracking-widest shadow-xl">LƯU DANH MỤC</button>
            </form>
          </div>
        )}

        {view === 'admin-payment-config' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-dashboard')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Cấu hình Thanh toán</h2>
              <div className="w-10"></div>
            </header>
            <form className="px-6 mt-6 space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setPaymentConfig({
                bankName: fd.get('bank') as string,
                accountName: fd.get('name') as string,
                accountNumber: fd.get('number') as string,
                instruction: fd.get('note') as string,
                qrUrl: fd.get('qr') as string
              });
              alert('Đã lưu cấu hình thanh toán!');
              setView('admin-dashboard');
            }}>
              <div className="bg-rustic-bg/40 p-8 rounded-[2.5rem] border border-rustic-border space-y-5">
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Ngân hàng</label>
                   <input name="bank" defaultValue={paymentConfig.bankName} required className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-bold" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Chủ tài khoản</label>
                   <input name="name" defaultValue={paymentConfig.accountName} required className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-bold" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Số tài khoản</label>
                   <input name="number" defaultValue={paymentConfig.accountNumber} required className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-bold font-mono" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Link QR Code (Tùy chọn)</label>
                   <input name="qr" defaultValue={paymentConfig.qrUrl} className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-mono text-[10px]" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Hướng dẫn</label>
                   <textarea name="note" defaultValue={paymentConfig.instruction} className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white text-[11px]" rows={3} />
                 </div>
              </div>
              <button type="submit" className="w-full bg-rustic-primary text-white py-6 rounded-3xl font-black uppercase text-[12px] tracking-widest shadow-xl">CẬP NHẬT CẤU HÌNH</button>
            </form>
          </div>
        )}

        {view === 'admin-telegram-config' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-dashboard')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Cấu hình Telegram Bot</h2>
              <div className="w-10"></div>
            </header>
            <div className="px-6 mt-6 space-y-6">
              <div className="bg-rustic-bg/40 p-8 rounded-[2.5rem] border border-rustic-border space-y-6 shadow-sm">
                 <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-rustic-border shadow-sm">
                    <span className="text-[11px] font-black uppercase text-rustic-primary">Thông báo đơn hàng</span>
                    <button 
                      onClick={() => setTelegramConfig({ ...telegramConfig, isEnabled: !telegramConfig.isEnabled })}
                      className={`w-14 h-8 rounded-full transition-all relative ${telegramConfig.isEnabled ? 'bg-emerald-500 shadow-emerald-200' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${telegramConfig.isEnabled ? 'left-7' : 'left-1'}`}></div>
                    </button>
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Bot Token</label>
                   <input 
                    type="text" 
                    value={telegramConfig.botToken} 
                    onChange={e => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })}
                    className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-mono text-[10px]" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-rustic-primary/40 block mb-2 px-2">Chat ID</label>
                   <input 
                    value={telegramConfig.chatId} 
                    onChange={e => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
                    className="w-full p-5 rounded-2xl border border-rustic-border focus:outline-none bg-white font-mono text-[11px]" 
                   />
                 </div>
              </div>
              <button onClick={() => { alert('Đã lưu cấu hình Bot!'); setView('admin-dashboard'); }} className="w-full bg-rustic-primary text-white py-6 rounded-3xl font-black uppercase text-[12px] tracking-widest shadow-xl">LƯU CẤU HÌNH</button>
            </div>
          </div>
        )}

        {view === 'admin-user-list' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => setView('admin-dashboard')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Thành viên & Phân quyền</h2>
              <div className="w-10"></div>
            </header>
            <div className="px-6 space-y-4 mt-4">
              {accounts.map(acc => (
                <div key={acc.id} className="bg-rustic-bg/40 p-5 rounded-[2.5rem] border border-rustic-border/50 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-rustic-primary text-sm">{acc.fullName}</h4>
                      <p className="text-[10px] font-bold text-rustic-primary/40 uppercase tracking-widest">@{acc.username} • {acc.phone || 'N/A'}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter ${acc.role === 'admin' ? 'bg-rose-500 text-white' : acc.role === 'vendor' ? 'bg-indigo-500 text-white' : acc.role === 'shipper' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{acc.role}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-rustic-border/20">
                    <button onClick={() => updateAccountRole(acc.id, 'vendor')} className={`py-2.5 rounded-xl text-[8px] font-black uppercase transition-all shadow-sm ${acc.role === 'vendor' ? 'bg-indigo-500 text-white' : 'bg-white border border-rustic-border text-indigo-600'}`}>Vendor</button>
                    <button onClick={() => updateAccountRole(acc.id, 'shipper')} className={`py-2.5 rounded-xl text-[8px] font-black uppercase transition-all shadow-sm ${acc.role === 'shipper' ? 'bg-emerald-500 text-white' : 'bg-white border border-rustic-border text-emerald-600'}`}>Shipper</button>
                    <button onClick={() => updateAccountRole(acc.id, 'user')} className={`py-2.5 rounded-xl text-[8px] font-black uppercase transition-all shadow-sm ${acc.role === 'user' ? 'bg-rustic-primary text-white' : 'bg-white border border-rustic-border text-rustic-primary/40'}`}>User</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'profile' && (
           <div className="pb-32 animate-fade-in min-h-screen bg-white p-8">
            <div className="flex flex-col items-center text-center mt-12 mb-12">
              <div className="w-24 h-24 bg-white rounded-[2.5rem] border-4 border-rustic-bg flex items-center justify-center p-5 shadow-2xl mb-6">
                <Logo className="w-full h-full border-none shadow-none" />
              </div>
              {currentUser ? (
                <>
                  <h2 className="text-2xl font-serif font-black text-rustic-primary uppercase tracking-tight mb-1">{currentUser.fullName}</h2>
                  <div className={`px-4 py-1 rounded-full mb-8 ${currentUser.role === 'admin' ? 'bg-rose-100 text-rose-600' : 'bg-rustic-accent/10 text-rustic-accent'}`}>
                     <p className="text-[9px] font-black uppercase tracking-widest">{currentUser.role} • @{currentUser.username}</p>
                  </div>
                  <div className="w-full max-w-xs space-y-3">
                    {currentUser.role === 'admin' && (
                      <button onClick={() => setView('admin-dashboard')} className="w-full p-5 bg-rustic-primary text-white rounded-[1.5rem] flex items-center justify-between shadow-xl active:scale-95 transition-all">
                        <span className="text-[11px] font-black uppercase tracking-widest">VÀO TRANG QUẢN TRỊ</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </button>
                    )}
                    <button onClick={() => setView('currency-converter')} className="w-full p-5 bg-white border border-rustic-border text-rustic-primary rounded-[1.5rem] flex items-center justify-between shadow-sm">
                      <span className="text-[11px] font-black uppercase tracking-widest">{t.currencyConverter}</span>
                      <svg className="w-5 h-5 text-rustic-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    <button onClick={() => { setCurrentUser(null); setView('home'); }} className="w-full py-5 border border-rose-500/20 text-rose-500 rounded-2xl text-[10px] font-black uppercase mt-10">Đăng xuất</button>
                  </div>
                </>
              ) : (
                <div className="w-full max-w-xs space-y-6">
                  <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Thành viên Srilanka</h2>
                  <div className="flex flex-col gap-4">
                    <button onClick={() => setView('login')} className="bg-rustic-primary text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">Đăng nhập</button>
                    <button onClick={() => setView('register')} className="bg-white border-2 border-rustic-border text-rustic-primary py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest">Tham gia ngay</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(view === 'login' || view === 'register') && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen flex flex-col items-center justify-center px-10">
            <Logo className="mb-10 scale-125 shadow-2xl" />
            <h2 className="text-3xl font-serif font-black text-rustic-primary mb-12 uppercase tracking-tight">{view === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h2>
            <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="w-full space-y-4">
              {view === 'register' && (
                <>
                  <input placeholder="Họ và tên..." required value={authData.fullName} onChange={e => setAuthData({...authData, fullName: e.target.value})} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border focus:outline-none" />
                  <input placeholder="Số điện thoại..." required value={authData.phone} onChange={e => setAuthData({...authData, phone: e.target.value})} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border focus:outline-none" />
                </>
              )}
              <input placeholder="Tên đăng nhập..." required value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border focus:outline-none" />
              <input type="password" placeholder="Mật khẩu..." required value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border focus:outline-none" />
              {authError && <p className="text-rose-500 text-[10px] font-bold text-center px-4">{authError}</p>}
              <button type="submit" className="w-full bg-rustic-primary text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl mt-4">{view === 'login' ? 'Vào Siêu Thị' : 'Tạo Tài Khoản'}</button>
              <button type="button" onClick={() => setView(view === 'login' ? 'register' : 'login')} className="w-full text-[10px] font-black uppercase text-rustic-accent tracking-widest mt-2">Chuyển sang {view === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button>
              <button type="button" onClick={() => setView('home')} className="w-full text-[10px] font-black uppercase text-gray-300 tracking-widest mt-8">← Quay về</button>
            </form>
          </div>
        )}

        {view === 'product-details' && selectedProduct && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
             <div className="relative aspect-square overflow-hidden bg-[#f7f5f2]"><img src={selectedProduct.image} className="w-full h-full object-contain" alt="" /><button onClick={() => setView('home')} className="absolute top-12 left-6 p-4 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl"><BackIcon /></button></div>
             <div className="px-8 -mt-10 relative z-10">
               <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-rustic-border/30">
                 <h1 className="text-3xl font-serif font-black text-rustic-primary leading-tight mb-4">{selectedProduct.name[lang]}</h1>
                 <div className="mb-6">{formatPrice(selectedProduct.price)}</div>
                 <p className="text-sm font-medium text-rustic-primary/70 leading-relaxed mb-8">{selectedProduct.description[lang]}</p>
                 <button onClick={() => { addToCart(selectedProduct); setView('cart'); }} className="w-full bg-rustic-primary text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">THÊM VÀO GIỎ</button>
               </div>
             </div>
          </div>
        )}

        {view === 'cart' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50"><button onClick={() => setView('home')} className="p-4 bg-white rounded-2xl shadow-md"><BackIcon /></button><h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Giỏ Hàng</h2><div className="w-10"></div></header>
            <div className="px-6 space-y-4">
              {cart.length === 0 ? <div className="py-20 text-center opacity-20"><Logo className="mx-auto mb-6 grayscale" /><p className="text-[10px] font-black uppercase tracking-widest">Giỏ hàng trống</p></div> : <>
                {cart.map(item => (
                  <div key={item.id} className="bg-rustic-bg/40 p-4 rounded-[1.5rem] border border-rustic-border/50 flex items-center gap-4">
                    <img src={item.image} className="w-16 h-16 rounded-xl object-cover" alt="" />
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-[13px] font-bold text-rustic-primary truncate">{item.name[lang]}</h4>
                      <div className="mt-1">{formatPrice(item.price)}</div>
                    </div>
                    <div className="flex items-center bg-white rounded-lg border border-rustic-border">
                      <button onClick={() => setCart(cart.map(p => p.id === item.id ? {...p, quantity: Math.max(0, p.quantity-1)} : p).filter(p => p.quantity > 0))} className="w-8 h-8 text-rustic-primary/50 font-bold">-</button>
                      <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                      <button onClick={() => setCart(cart.map(p => p.id === item.id ? {...p, quantity: p.quantity+1} : p))} className="w-8 h-8 text-rustic-primary/50 font-bold">+</button>
                    </div>
                  </div>
                ))}
                <div className="mt-8 bg-rustic-primary p-8 rounded-[2.5rem] text-center text-white">
                  <p className="text-3xl font-serif font-black">{totalPrice.toLocaleString()} LKR</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rustic-accent mb-6">≈ {(totalPrice * LKR_TO_VND_RATE).toLocaleString('vi-VN')} VND</p>
                  <button onClick={() => setIsCheckoutOpen(true)} className="w-full bg-rustic-accent text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest">THANH TOÁN</button>
                </div>
              </>}
            </div>
          </div>
        )}

        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[500] flex items-end justify-center">
            <div className="absolute inset-0 bg-rustic-primary/60 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)}></div>
            <div className="relative w-full bg-white rounded-t-[3rem] p-10 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-serif font-black text-rustic-primary mb-6 uppercase tracking-tight">Thanh toán</h3>
              <div className="bg-rustic-bg p-6 rounded-[2rem] border border-rustic-border/50 mb-6 space-y-3">
                <p className="text-[10px] font-black uppercase text-rustic-accent">Thông tin chuyển khoản</p>
                <div className="flex justify-between text-xs font-bold text-rustic-primary"><span>Ngân hàng:</span><span>{paymentConfig.bankName}</span></div>
                <div className="flex justify-between text-xs font-bold text-rustic-primary"><span>Tài khoản:</span><span>{paymentConfig.accountNumber}</span></div>
                <div className="flex justify-between text-xs font-bold text-rustic-primary"><span>Chủ TK:</span><span>{paymentConfig.accountName}</span></div>
              </div>
              <div className="mb-6 p-4 bg-rustic-bg rounded-2xl border border-rustic-border/50 flex flex-col items-center">
                 <p className="text-[10px] font-black uppercase text-rustic-primary/40 mb-1">Số tiền cần thanh toán</p>
                 <p className="text-xl font-serif font-black text-rustic-primary">{totalPrice.toLocaleString()} LKR</p>
                 <p className="text-sm font-black text-rustic-accent tracking-widest">≈ {(totalPrice * LKR_TO_VND_RATE).toLocaleString('vi-VN')} VND</p>
              </div>
              <input type="text" placeholder="Họ tên & SĐT liên hệ..." value={contactInfo} onChange={e => setContactInfo(e.target.value)} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border mb-6 focus:outline-none" />
              <button onClick={() => { setIsSubmitting(true); setTimeout(() => { setIsSubmitting(false); createOrder('cart'); alert('Đơn hàng đã được gửi!'); setCart([]); setIsCheckoutOpen(false); setView('home'); }, 1500); }} className="w-full bg-rustic-primary text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">HOÀN TẤT ĐẶT HÀNG</button>
            </div>
          </div>
        )}

        {view === 'shelf' && (
          <div className="min-h-screen animate-fade-in pb-32">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50">
              <button onClick={() => activeShelfCategory ? setActiveShelfCategory(null) : setView('home')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border active:scale-90"><BackIcon /></button>
              <h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">{activeShelfCategory || 'Kệ Hàng Tiêu Dùng'}</h2>
              <div className="w-10"></div>
            </header>
            <div className="px-6 mt-6">
              {!activeShelfCategory ? (
                <div className="space-y-4">
                  {shelfCategories.map(cat => (
                    <button key={cat.id} onClick={() => setActiveShelfCategory(cat.name.vi)} className={`relative overflow-hidden w-full p-6 rounded-[2rem] bg-gradient-to-br ${cat.color || 'from-gray-100 to-gray-300'} text-white flex items-center gap-5 shadow-xl`}>
                      <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl p-2"><img src={cat.icon} className="w-full h-full object-contain" alt="" /></div>
                      <h3 className="text-lg font-serif font-black uppercase tracking-tight">{cat.name.vi}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-5">
                  {products.filter(p => p.isShelfItem && p.category.vi === activeShelfCategory).map(p => (
                    <div key={p.id} className="bg-white p-3 rounded-[2rem] border border-rustic-border/50 card-shadow" onClick={() => { setSelectedProduct(p); setView('product-details'); }}>
                      <img src={p.image} className="w-full aspect-[4/5] object-contain mb-3" alt="" />
                      <h3 className="text-[11px] font-bold text-rustic-primary truncate mb-1">{p.name[lang]}</h3>
                      {formatPrice(p.price)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'custom-delivery' && (
          <div className="pb-32 animate-fade-in bg-rustic-bg min-h-screen">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 glass-header z-50"><button onClick={() => setView('home')} className="p-4 bg-white rounded-2xl shadow-md border border-rustic-border"><BackIcon /></button><h2 className="text-xl font-serif font-black text-rustic-primary uppercase tracking-tight">Giao Theo Yêu Cầu</h2><div className="w-10"></div></header>
            <div className="px-6 mt-6 h-screen overflow-y-auto pb-64">
              <button onClick={handleShareLocation} className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all mb-6 ${location ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rustic-primary text-white shadow-xl'}`}>{isLocating ? 'ĐANG ĐỊNH VỊ...' : location ? 'ĐÃ ĐỊNH VỊ XONG ✓' : '📍 CHIA SẺ VỊ TRÍ GPS'}</button>
              <div className="bg-white p-8 rounded-[2.5rem] border border-rustic-border shadow-2xl space-y-5">
                <input type="text" placeholder="Thành phố / Khu vực..." value={customReq.city} onChange={e => setCustomReq({...customReq, city: e.target.value})} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border focus:outline-none" />
                <input type="text" placeholder="Số điện thoại / Telegram..." value={customReq.contact} onChange={e => setCustomReq({...customReq, contact: e.target.value})} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border focus:outline-none" />
                <textarea rows={4} placeholder="Mô tả món đồ bạn cần mua..." value={customReq.needs} onChange={e => setCustomReq({...customReq, needs: e.target.value})} className="w-full bg-rustic-bg p-5 rounded-2xl text-sm font-bold border border-rustic-border focus:outline-none resize-none" />
                <button onClick={() => { setIsSubmitting(true); setTimeout(() => { setIsSubmitting(false); createOrder('custom'); alert('Yêu cầu đã được gửi!'); setView('home'); }, 2000); }} className="w-full bg-rustic-primary text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">GỬI YÊU CẦU</button>
              </div>
            </div>
          </div>
        )}

        {view === 'search' && (
          <div className="pb-32 animate-fade-in bg-white min-h-screen">
            <header className="px-6 pt-12 pb-6 sticky top-0 glass-header z-50 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <input type="text" autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm thông minh với FreshAI..." className={`w-full bg-rustic-bg border py-5 pl-14 pr-12 rounded-3xl text-sm font-bold shadow-inner focus:outline-none transition-all ${isAiSearching ? 'border-rustic-accent animate-pulse' : 'border-rustic-border/60'}`} />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2">
                    {isAiSearching ? (
                      <div className="w-5 h-5 border-2 border-rustic-accent border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-6 h-6 text-rustic-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    )}
                  </div>
                </div>
                <button onClick={() => setView('home')} className="text-[10px] font-black uppercase text-rustic-primary/30 tracking-widest">ĐÓNG</button>
              </div>
            </header>
            <div className="px-6 mt-4 grid grid-cols-2 gap-5 h-screen overflow-y-auto pb-64">
              {filteredSearchProducts.map(p => (
                <div key={p.id} className="bg-white p-3 rounded-[2rem] border border-rustic-border/50 card-shadow" onClick={() => { setSelectedProduct(p); setView('product-details'); }}>
                  <img src={p.image} className="w-full aspect-[4/5] object-cover mb-3 rounded-2xl" alt="" />
                  <h3 className="text-[12px] font-bold text-rustic-primary truncate mb-1">{p.name[lang]}</h3>
                  {formatPrice(p.price)}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Persistent Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 pb-8 pt-4 z-[400]">
        <div className="bg-white/90 backdrop-blur-2xl border border-rustic-border shadow-xl rounded-[2rem] px-8 py-4 flex justify-between items-center">
           {[ 
             { id: 'home', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' }, 
             { id: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }, 
             { id: 'currency-converter', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
             { id: 'cart', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' }, 
             { id: 'profile', icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' } 
           ].map(nav => (
             <button key={nav.id} onClick={() => setView(nav.id as ViewState)} className="relative p-2">
               <svg className={`w-6 h-6 ${view === nav.id ? 'text-rustic-accent active-nav-icon' : 'text-rustic-primary/20'}`} fill={['search', 'cart', 'currency-converter'].includes(nav.id) ? 'none' : 'currentColor'} stroke={['search', 'cart', 'currency-converter'].includes(nav.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={3}><path d={nav.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
             </button>
           ))}
        </div>
      </nav>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fade-in { animation: fadeIn 0.7s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
