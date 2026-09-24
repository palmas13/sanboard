'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Users,
  ListFilter,
  CreditCard,
  Flag,
  Settings,
  AlertTriangle,
  Trash2,
  Ban,
  CheckCircle,
  Save,
  Loader2,
  RefreshCw,
  Search,
  Building2,
  LifeBuoy,
  Crown,
  ExternalLink,
  MessageSquare,
  Send,
  X,
  Check,
  User as UserIcon,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'listings' | 'users' | 'payments' | 'reports' | 'dealers' | 'tickets' | 'settings'
  >('listings');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Settings form state
  const [packagePriceInput, setPackagePriceInput] = useState('2000');
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Search filter inside admin listings
  const [searchListingQuery, setSearchListingQuery] = useState('');

  // Ticket filter & detail modal state
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'ALL' | 'OPEN' | 'ANSWERED' | 'CLOSED'>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminReplyMessage, setAdminReplyMessage] = useState('');
  const [ticketReplying, setTicketReplying] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin');
      const json = await res.json();
      setData(json);
      if (json.packagePrice) {
        setPackagePriceInput(String(json.packagePrice));
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/giris?redirect=/yonetim');
      return;
    }
    fetchData();
  }, [isAuthenticated, router]);

  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="surface-card max-w-md w-full p-8 rounded-2xl border-2 border-[var(--color-danger)]/30 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-main)]">Yetkisiz Erişim (403)</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Bu yönetim alanına yalnızca Sanboard admin yetkisine sahip GTA World hesapları erişebilir.
          </p>
          <div className="pt-2">
            <Link href="/hesabim" className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5">
              <span>Panele Dön</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleDelist = async (listingId: string) => {
    if (!confirm('Bu ilanı yayından kaldırmak istediğinize emin misiniz?')) return;
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delist', payload: { listingId } }),
      });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBan = async (userId: string) => {
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleBan', payload: { userId } }),
      });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setSettingsSuccess(false);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePrice',
          payload: { newPrice: Number(packagePriceInput) },
        }),
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportAction = async (reportId: string, status: 'RESOLVED' | 'DISMISSED') => {
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateReport', payload: { reportId, status } }),
      });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDealerAction = async (dealerId: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateDealer', payload: { dealerId, status } }),
      });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const openTicketDetail = async (ticket: any) => {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`);
      if (res.ok) {
        const fullTicket = await res.json();
        setSelectedTicket(fullTicket);
      } else {
        setSelectedTicket(ticket);
      }
    } catch {
      setSelectedTicket(ticket);
    }
  };

  const handleTicketStatusAction = async (ticketId: string, status: 'OPEN' | 'ANSWERED' | 'CLOSED') => {
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateTicket', payload: { ticketId, status } }),
      });
      await fetchData();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev: any) => (prev ? { ...prev, status } : null));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !adminReplyMessage.trim()) return;

    setTicketReplying(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adminReplyTicket',
          payload: { ticketId: selectedTicket.id, message: adminReplyMessage.trim() },
        }),
      });
      setAdminReplyMessage('');
      const res = await fetch(`/api/tickets/${selectedTicket.id}`);
      if (res.ok) {
        const fullTicket = await res.json();
        setSelectedTicket(fullTicket);
      }
      await fetchData();
    } finally {
      setTicketReplying(false);
    }
  };

  const stats = data?.stats || {
    totalUsers: 0,
    activeListings: 0,
    expiredListings: 0,
    totalRevenue: 0,
    todayListings: 0,
    totalFavorites: 0,
  };

  const filteredListings = (data?.listings || []).filter((l: any) => {
    if (!searchListingQuery) return true;
    const q = searchListingQuery.toLowerCase();
    return (
      l.title?.toLowerCase().includes(q) ||
      l.listing_number?.toLowerCase().includes(q) ||
      l.location?.toLowerCase().includes(q)
    );
  });

  const pendingDealersCount = (data?.dealers || []).filter((d: any) => d.status === 'PENDING').length;
  const openTicketsCount = (data?.tickets || []).filter((t: any) => t.status === 'OPEN').length;

  const filteredTickets = (data?.tickets || []).filter((t: any) => {
    if (ticketStatusFilter === 'ALL') return true;
    return t.status === ticketStatusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="surface-card p-6 rounded-2xl border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-main)]">
              Sanboard Yönetim Paneli
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              İlanları denetle, kullanıcıları yönet, kurumsal başvuruları onayla ve destek taleplerini yanıtla.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading || actionLoading}
          className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      {/* Admin Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)]">
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">Toplam Kullanıcı</p>
          <p className="text-xl font-black text-[var(--text-main)] mt-1">{stats.totalUsers}</p>
        </div>

        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)]">
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">Aktif İlan</p>
          <p className="text-xl font-black text-[var(--color-success)] mt-1">{stats.activeListings}</p>
        </div>

        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)]">
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">Süresi Dolan</p>
          <p className="text-xl font-black text-[var(--color-danger)] mt-1">{stats.expiredListings}</p>
        </div>

        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)]">
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">Kurumsal Başvuru</p>
          <p className="text-xl font-black text-[#FF8A1F] mt-1">{pendingDealersCount}</p>
        </div>

        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)]">
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">Açık Destek</p>
          <p className="text-xl font-black text-[#FF8A1F] mt-1">{openTicketsCount}</p>
        </div>

        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)]">
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">Toplam Gelir</p>
          <p className="text-xl font-black text-[#FF8A1F] mt-1">{formatCurrency(stats.totalRevenue)}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--border-app)] gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('listings')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'listings'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>İlan Yönetimi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dealers')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'dealers'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Kurumsal Başvurular {pendingDealersCount > 0 && `(${pendingDealersCount})`}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'tickets'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Destek Talepleri {openTicketsCount > 0 && `(${openTicketsCount})`}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Kullanıcılar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'payments'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Ödemeler</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'reports'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>Raporlar ({data?.reports?.filter((r: any) => r.status === 'PENDING').length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'settings'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Ayarlar</span>
        </button>
      </div>

      {/* TAB CONTENT 1: İLAN YÖNETİMİ */}
      {activeTab === 'listings' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="font-bold text-base text-[var(--text-main)]">Tüm İlanlar</h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="İlan ara..."
                value={searchListingQuery}
                onChange={(e) => setSearchListingQuery(e.target.value)}
                className="form-input pl-9 text-xs py-1.5"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">İlan No</th>
                  <th className="py-3 px-4">Başlık</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Fiyat</th>
                  <th className="py-3 px-4">Konum</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-app)]">
                {filteredListings.map((l: any) => (
                  <tr key={l.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[var(--text-main)]">{l.listing_number}</td>
                    <td className="py-3 px-4 font-medium text-[var(--text-main)] max-w-xs truncate">{l.title}</td>
                    <td className="py-3 px-4">
                      <span className="badge-tag">{l.subcategory}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#FF8A1F]">{formatCurrency(l.price)}</td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">{l.location}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'ACTIVE'
                            ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                            : l.status === 'SOLD'
                            ? 'bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]'
                            : 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {l.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleDelist(l.id)}
                          className="btn-danger text-[11px] py-1 px-2.5 flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Kaldır</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: KURUMSAL BAŞVURULAR (DEALERS) */}
      {activeTab === 'dealers' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-[var(--text-main)] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#FF8A1F]" />
                <span>Kurumsal Satıcı Başvuruları & Galeriler</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Kullanıcıların kurumsal galeri/mağaza başvurularını inceleyin ve onaylayarak Premium Satıcı rozeti atayın.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Şirket / Galeri</th>
                  <th className="py-3 px-4">Profil ID</th>
                  <th className="py-3 px-4">Açma Amacı & Faaliyet</th>
                  <th className="py-3 px-4">İletişim</th>
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-app)]">
                {(data?.dealers || []).length > 0 ? (
                  (data?.dealers || []).map((d: any) => (
                    <tr key={d.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={d.logo_url || 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=100'}
                            alt={d.company_name}
                            className="w-9 h-9 rounded-lg object-cover border border-[var(--border-app)] shrink-0"
                          />
                          <div>
                            <p className="font-bold text-[var(--text-main)]">{d.company_name}</p>
                            <p className="text-[10px] text-[var(--text-dim)] font-mono">{d.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-dim)]">{d.profile_id}</td>
                      <td className="py-3 px-4 text-[var(--text-main)] max-w-xs">
                        <p className="line-clamp-2">{d.purpose || d.description}</p>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-dim)]">
                        <p className="font-mono text-[var(--text-main)]">{d.phone || '-'}</p>
                        <p className="truncate max-w-[140px]">{d.sanmail_email || '-'}</p>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-dim)] whitespace-nowrap">
                        {formatDateTime(d.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 ${
                            d.status === 'APPROVED'
                              ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30'
                              : d.status === 'PENDING'
                              ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
                              : 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
                          }`}
                        >
                          {d.status === 'APPROVED' && <Crown className="w-3 h-3 fill-current" />}
                          {d.status === 'APPROVED' ? 'PREMIUM SATICI' : d.status === 'PENDING' ? 'BEKLEMEDE' : 'REDDEDİLDİ'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {d.status === 'PENDING' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDealerAction(d.id, 'APPROVED')}
                                className="btn-primary text-[11px] py-1 px-2.5 flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-3 h-3" />
                                <span>Onayla (Premium Yap)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDealerAction(d.id, 'REJECTED')}
                                className="btn-secondary text-[11px] py-1 px-2.5"
                              >
                                Reddet
                              </button>
                            </>
                          ) : d.status === 'APPROVED' ? (
                            <>
                              <Link
                                href={`/magaza/${d.id}`}
                                target="_blank"
                                className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Vitrini Gör</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDealerAction(d.id, 'REJECTED')}
                                className="btn-danger text-[11px] py-1 px-2"
                                title="Kurumsal Üyeliği İptal Et"
                              >
                                Askıya Al
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDealerAction(d.id, 'APPROVED')}
                              className="btn-secondary text-[11px] py-1 px-2.5 text-[#FF8A1F]"
                            >
                              Yeniden Onayla
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      Henüz kurumsal başvuru bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: DESTEK TALEPLERİ (TICKETS) */}
      {activeTab === 'tickets' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-[var(--text-main)] flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-[#FF8A1F]" />
                <span>Destek Talepleri / Ticket Yönetimi</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Kullanıcıların ilettiği yardım ve destek taleplerini inceleyin, yanıtlayın ve durumlarını güncelleyin.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)]">
              {(['ALL', 'OPEN', 'ANSWERED', 'CLOSED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTicketStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    ticketStatusFilter === st
                      ? 'bg-[#FF8A1F] text-black shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Tümü'
                    : st === 'OPEN'
                    ? 'Açık'
                    : st === 'ANSWERED'
                    ? 'Yanıtlandı'
                    : 'Kapatıldı'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Ticket No</th>
                  <th className="py-3 px-4">Konu Başlığı</th>
                  <th className="py-3 px-4">Talep Eden</th>
                  <th className="py-3 px-4">Son Güncelleme</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-app)]">
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((t: any) => (
                    <tr key={t.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--text-main)]">{t.id}</td>
                      <td className="py-3 px-4 font-bold text-[var(--text-main)] max-w-sm truncate">{t.subject}</td>
                      <td className="py-3 px-4 text-[var(--text-dim)]">{t.creator_name || t.profile_id}</td>
                      <td className="py-3 px-4 text-[var(--text-dim)] whitespace-nowrap">
                        {formatDateTime(t.updated_at || t.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'ANSWERED'
                              ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                              : t.status === 'OPEN'
                              ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]'
                              : 'bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]'
                          }`}
                        >
                          {t.status === 'ANSWERED'
                            ? 'Yanıtlandı'
                            : t.status === 'OPEN'
                            ? 'Açık'
                            : 'Kapatıldı'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTicketDetail(t)}
                          className="btn-secondary text-[11px] py-1 px-3 inline-flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#FF8A1F]" />
                          <span>Görüntüle & Yanıtla</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      Kayıtlı destek talebi bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: KULLANICILAR */}
      {activeTab === 'users' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 space-y-4">
          <h3 className="font-bold text-base text-[var(--text-main)]">Kayıtlı Kullanıcılar</h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Karakter Sayısı</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-app)]">
                {(data?.users || []).map((item: any) => (
                  <tr key={item.user.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[var(--text-main)]">{item.user.id}</td>
                    <td className="py-3 px-4">
                      <span className="badge-tag">{item.user.role}</span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-main)] font-semibold">{item.profileCount}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.user.status === 'ACTIVE'
                            ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                            : 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
                        }`}
                      >
                        {item.user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleBan(item.user.id)}
                        className={`text-[11px] py-1 px-2.5 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          item.user.status === 'ACTIVE'
                            ? 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white'
                            : 'bg-[var(--color-success-subtle)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-white'
                        }`}
                      >
                        <Ban className="w-3 h-3" />
                        <span>{item.user.status === 'ACTIVE' ? 'Engelle (Ban)' : 'Engeli Kaldır'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: ÖDEMELER */}
      {activeTab === 'payments' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 space-y-4">
          <h3 className="font-bold text-base text-[var(--text-main)]">Fleeca İşlem Geçmişi</h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Sipariş No</th>
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4">Tutar</th>
                  <th className="py-3 px-4">Sağlayıcı</th>
                  <th className="py-3 px-4">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-app)]">
                {(data?.payments || []).map((pay: any) => (
                  <tr key={pay.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[var(--text-main)]">{pay.order_id}</td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">{formatDateTime(pay.created_at)}</td>
                    <td className="py-3 px-4 font-bold text-[#FF8A1F]">{formatCurrency(pay.amount)}</td>
                    <td className="py-3 px-4 text-[var(--text-dim)]">Fleeca Bank</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-success-subtle)] text-[var(--color-success)]">
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: RAPORLAR */}
      {activeTab === 'reports' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 space-y-4">
          <h3 className="font-bold text-base text-[var(--text-main)]">Kullanıcı Şikayetleri</h3>
          {(data?.reports || []).length > 0 ? (
            <div className="space-y-3">
              {(data?.reports || []).map((rep: any) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-xl bg-[var(--bg-surface-secondary)]/50 border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="badge-tag bg-[var(--color-danger-subtle)] text-[var(--color-danger)] font-bold text-[10px]">
                        {rep.reason}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--text-dim)]">
                        İlan: {rep.listing_id}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rep.status === 'PENDING'
                            ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]'
                            : 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-main)] font-medium">{rep.description}</p>
                    <p className="text-[10px] text-[var(--text-dim)]">{formatDateTime(rep.created_at)}</p>
                  </div>

                  {rep.status === 'PENDING' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReportAction(rep.id, 'RESOLVED')}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Çözüldü</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReportAction(rep.id, 'DISMISSED')}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Reddet
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">
              Bekleyen kullanıcı şikayeti bulunmuyor.
            </p>
          )}
        </div>
      )}

      {/* TAB CONTENT 7: AYARLAR (Paket Fiyatı) */}
      {activeTab === 'settings' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 sm:p-8 space-y-6 max-w-xl">
          <div>
            <h3 className="font-bold text-base text-[var(--text-main)]">Platform Ayarları</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              İlan paket fiyatlarını ve sistem parametrelerini merkezi olarak yapılandırın.
            </p>
          </div>

          {settingsSuccess && (
            <div className="p-3 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Paket fiyatı başarıyla güncellendi!</span>
            </div>
          )}

          <form onSubmit={handleUpdatePrice} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                7 Günlük Standart İlan Fiyatı ($)
              </label>
              <input
                type="number"
                value={packagePriceInput}
                onChange={(e) => setPackagePriceInput(e.target.value)}
                min="100"
                className="form-input text-sm"
              />
              <p className="text-[11px] text-[var(--text-dim)]">
                Varsayılan değer: $2.000. Değiştirildiğinde tüm checkout akışları bu fiyattan çalışır.
              </p>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-1.5"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Fiyatı Güncelle</span>
            </button>
          </form>
        </div>
      )}

      {/* TICKET DETAIL & REPLY MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-3xl rounded-2xl border border-[var(--border-app)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border-app)] flex items-center justify-between gap-4 bg-[var(--bg-surface)]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#FF8A1F]">{selectedTicket.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedTicket.status === 'ANSWERED'
                        ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                        : selectedTicket.status === 'OPEN'
                        ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]'
                        : 'bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]'
                    }`}
                  >
                    {selectedTicket.status === 'ANSWERED'
                      ? 'Yanıtlandı'
                      : selectedTicket.status === 'OPEN'
                      ? 'Açık'
                      : 'Kapatıldı'}
                  </span>
                </div>
                <h3 className="font-black text-lg text-[var(--text-main)] mt-0.5">{selectedTicket.subject}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Kullanıcı: <strong className="text-[var(--text-main)]">{selectedTicket.creator_name}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedTicket.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    onClick={() => handleTicketStatusAction(selectedTicket.id, 'CLOSED')}
                    className="btn-danger text-xs py-1.5 px-3"
                  >
                    Talebi Kapat
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTicketStatusAction(selectedTicket.id, 'OPEN')}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Yeniden Aç
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 rounded-lg border border-[var(--border-app)] hover:bg-[var(--bg-surface-secondary)] text-[var(--text-muted)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Message History */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-[var(--bg-app)]">
              {(selectedTicket.messages || []).map((msg: any) => {
                const isAdminMsg = msg.sender_role === 'ADMIN';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)] mb-1">
                      {isAdminMsg ? (
                        <>
                          <Shield className="w-3 h-3 text-[#FF8A1F]" />
                          <span className="font-bold text-[#FF8A1F]">{msg.sender_name} (Yönetim)</span>
                        </>
                      ) : (
                        <>
                          <UserIcon className="w-3 h-3 text-[var(--text-muted)]" />
                          <span className="font-semibold text-[var(--text-main)]">{msg.sender_name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDateTime(msg.created_at)}</span>
                    </div>

                    <div
                      className={`max-w-xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isAdminMsg
                          ? 'bg-[var(--brand-orange-subtle)] border border-[#FF8A1F]/30 text-[var(--text-main)] rounded-tr-none'
                          : 'bg-[var(--bg-surface)] border border-[var(--border-app)] text-[var(--text-main)] rounded-tl-none shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer: Admin Reply Form */}
            {selectedTicket.status !== 'CLOSED' ? (
              <form onSubmit={handleAdminReplyTicket} className="p-4 border-t border-[var(--border-app)] bg-[var(--bg-surface)] space-y-3">
                <textarea
                  rows={3}
                  value={adminReplyMessage}
                  onChange={(e) => setAdminReplyMessage(e.target.value)}
                  placeholder="Sanboard Yönetimi adına kullanıcıya resmi yanıt yazın..."
                  className="form-input text-xs sm:text-sm resize-none"
                  required
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-dim)]">
                    Yanıt gönderildiğinde talep durumu otomatik olarak <strong>"Yanıtlandı"</strong> olacaktır.
                  </span>
                  <button
                    type="submit"
                    disabled={ticketReplying || !adminReplyMessage.trim()}
                    className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-md"
                  >
                    {ticketReplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Yanıtı Gönder</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 border-t border-[var(--border-app)] bg-[var(--bg-surface-secondary)] text-center text-xs text-[var(--text-muted)]">
                Bu destek talebi kapatılmıştır. Yeni yanıt göndermek için yukarıdan talebi yeniden açabilirsiniz.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
