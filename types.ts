
export type Language = 'vi' | 'en' | 'zh';

export interface LocalizedString {
  vi: string;
  en: string;
  zh: string;
}

export type UserRole = 'admin' | 'vendor' | 'shipper' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
}

export interface Product {
  id: string;
  name: LocalizedString;
  price: number | LocalizedString; 
  description: LocalizedString;
  cookingSuggestion?: LocalizedString;
  image: string;
  category: LocalizedString; 
  rating: number;
  reviews: number;
  isShelfItem?: boolean;
  stock?: number;
  vendorId?: string;
}

export interface Order {
  id: string;
  userId?: string;
  customerName: string;
  contact: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  type: 'cart' | 'custom';
  address?: string;
  location?: { lat: number, lng: number };
  note?: string;
  shipperId?: string;
}

export interface Category {
  id: string;
  name: LocalizedString;
  icon?: string;
  color?: string;
}

export interface PaymentInfo {
  bankName: string;
  accountName: string;
  accountNumber: string;
  qrUrl?: string;
  instruction: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export type ViewState = 
  | 'home' 
  | 'search' 
  | 'cart' 
  | 'profile' 
  | 'currency-converter'
  | 'product-details' 
  | 'admin-dashboard' 
  | 'admin-product-form' 
  | 'admin-categories' 
  | 'admin-category-form'
  | 'admin-payment-config'
  | 'admin-telegram-config'
  | 'custom-delivery' 
  | 'shelf' 
  | 'admin-product-list' 
  | 'admin-user-list' 
  | 'login' 
  | 'register' 
  | 'admin-orders' 
  | 'shipper-dashboard' 
  | 'vendor-dashboard';
