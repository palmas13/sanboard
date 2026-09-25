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
  Clock,
} from 'lucide-react';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils/format';
import { resolveMediaUrl } from '@/lib/media/url';

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'listings' | 'users' | 'payments' | 'reports' | 'dealers' | 'tickets' | 'settings'
  >('listings');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
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

  // Corporate management state (Section 12 & 23 & 24)
  const [corporateSubTab, setCorporateSubTab] = useState<'dealers' | 'applications'>('dealers');
  const [showDeletedStores, setShowDeletedStores] = useState(false);

  // Corporate application rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetApp, setRejectTargetApp] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('Fiziksel işletme bilgileri doğrulanamadığı için başvurunuz reddedildi.');

  // Corporate store management modal state
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [storeManageModalOpen, setStoreManageModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeReasonInput, setStoreReasonInput] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch('/api/admin');
      if (!res.ok) throw new Error('Yüklenemedi');
      const json = await res.json();
      setData(json);
      if (json.packagePrice) {
        setPackagePriceInput(String(json.packagePrice));
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/giris?redirect=/yonetim');
      return;
    }
    fetchData();
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center gap-3 text-xs text-[var(--text-muted)]">
        <div className="w-8 h-8 rounded-full border-2 border-[#FF8A1F] border-t-transparent animate-spin" />
        <span>Yönetim oturumu doğrulanıyor...</span>
      </div>
    );
  }

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

  // Application Review Handlers (Section 12 & 24)
  const handleApproveApplication = async (applicationId: string) => {
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approveApplication',
          payload: { applicationId },
        }),
      });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRejectApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetApp) return;
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rejectApplication',
          payload: {
            applicationId: rejectTargetApp.id,
            rejectionReason: rejectionReasonInput,
          },
        }),
      });
      setRejectModalOpen(false);
      setRejectTargetApp(null);
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  // Store Moderation Handlers (Section 13-16 & 23)
  const handleConfirmSuspendStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !storeReasonInput.trim()) return;
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspendStore',
          payload: {
            dealerId: selectedStore.id,
            reason: storeReasonInput.trim(),
          },
        }),
      });
      setSuspendModalOpen(false);
      setStoreManageModalOpen(false);
      setStoreReasonInput('');
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateStore = async (dealerId: string) => {
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reactivateStore',
          payload: { dealerId },
        }),
      });
      setStoreManageModalOpen(false);
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !storeReasonInput.trim()) return;
    setActionLoading(true);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteStore',
          payload: {
            dealerId: selectedStore.id,
            reason: storeReasonInput.trim(),
          },
        }),
      });
      setDeleteModalOpen(false);
      setStoreManageModalOpen(false);
      setStoreReasonInput('');
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

  const pendingAppsCount = (data?.applications || []).length;
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

      {/* Compact 4-KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Toplam Kullanıcı */}
        <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] hover:border-[#FF8A1F]/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-semibold">Toplam Kullanıcı</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-[var(--bg-surface-secondary)] animate-pulse rounded mt-2" />
          ) : fetchError ? (
            <span className="text-xs text-[var(--color-danger)] font-medium block mt-2">Yüklenemedi</span>
          ) : (
            <p className="text-2xl font-black text-[var(--text-main)] mt-2">{stats.totalUsers}</p>
          )}
        </div>

        {/* 2. Aktif İlan */}
        <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] hover:border-[var(--color-success)]/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-semibold">Aktif İlan</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center">
              <ListFilter className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-[var(--bg-surface-secondary)] animate-pulse rounded mt-2" />
          ) : fetchError ? (
            <span className="text-xs text-[var(--color-danger)] font-medium block mt-2">Yüklenemedi</span>
          ) : (
            <p className="text-2xl font-black text-[var(--color-success)] mt-2">{stats.activeListings}</p>
          )}
        </div>

        {/* 3. Bekleyen Destek */}
        <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] hover:border-[#FF8A1F]/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-semibold">Bekleyen Destek</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
              <LifeBuoy className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-[var(--bg-surface-secondary)] animate-pulse rounded mt-2" />
          ) : fetchError ? (
            <span className="text-xs text-[var(--color-danger)] font-medium block mt-2">Yüklenemedi</span>
          ) : (
            <p className="text-2xl font-black text-[#FF8A1F] mt-2">{openTicketsCount}</p>
          )}
        </div>

        {/* 4. Bekleyen Kurumsal Başvuru */}
        <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] hover:border-[#FF8A1F]/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-semibold">Kurumsal Başvuru</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-[var(--bg-surface-secondary)] animate-pulse rounded mt-2" />
          ) : fetchError ? (
            <span className="text-xs text-[var(--color-danger)] font-medium block mt-2">Yüklenemedi</span>
          ) : (
            <p className="text-2xl font-black text-[#FF8A1F] mt-2">{pendingAppsCount}</p>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--border-app)] gap-2 overflow-x-auto">
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
          <span>Kullanıcılar ({data?.users?.length || 0})</span>
        </button>

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
          <span>İlan Yönetimi ({data?.listings?.length || 0})</span>
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
          onClick={() => setActiveTab('dealers')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'dealers'
              ? 'border-[#FF8A1F] text-[#FF8A1F]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Kurumsal Yönetim {pendingAppsCount > 0 && `(${pendingAppsCount})`}</span>
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
            <div className="relative w-full sm:w-64 flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-[var(--text-dim)] pointer-events-none" />
              <input
                type="text"
                placeholder="İlan ara..."
                value={searchListingQuery}
                onChange={(e) => setSearchListingQuery(e.target.value)}
                className="form-input text-xs py-1.5 w-full"
                style={{ paddingLeft: '2.5rem' }}
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

      {/* TAB CONTENT 2: KURUMSAL YÖNETİM (DEALERS & APPLICATIONS) */}
      {activeTab === 'dealers' && (
        <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-app)]">
            <div>
              <h3 className="font-bold text-base text-[var(--text-main)] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#FF8A1F]" />
                <span>Kurumsal İşletmeler & Mağaza Yönetimi</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Başvuruları inceleyin ve onaylı kurumsal mağazaların moderasyon durumunu (aktif/askıda/silindi) yönetin.
              </p>
            </div>

            {/* Sub-tabs: ONAY BEKLEYENLER vs KURUMSAL SATICILAR (Section 12) */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] shrink-0">
              <button
                type="button"
                onClick={() => setCorporateSubTab('dealers')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  corporateSubTab === 'dealers'
                    ? 'bg-[#FF8A1F] text-black shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Kurumsal Satıcılar ({data?.dealers?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setCorporateSubTab('applications')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  corporateSubTab === 'applications'
                    ? 'bg-[#FF8A1F] text-black shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Onay Bekleyenler ({data?.applications?.length || 0})</span>
              </button>
            </div>
          </div>

          {/* SUB-VIEW A: ONAY BEKLEYENLER (Section 12A & 24) */}
          {corporateSubTab === 'applications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>İnceleme bekleyen <strong>{(data?.applications || []).length}</strong> başvuru bulunuyor.</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Talep Edilen Şirket</th>
                      <th className="py-3 px-4">Başvuran Karakter</th>
                      <th className="py-3 px-4">Faaliyet Amacı</th>
                      <th className="py-3 px-4">Başvuru Tarihi</th>
                      <th className="py-3 px-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-app)]">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
                            <span>Başvurular yükleniyor...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (data?.applications || []).length > 0 ? (
                      (data?.applications || []).map((app: any) => (
                        <tr key={app.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-[var(--text-main)]">
                            {app.company_name}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[var(--text-main)]">{app.applicant_name || 'Bilinmeyen'}</div>
                            <div className="font-mono text-[10px] text-[var(--text-dim)]">{app.applicant_profile_id}</div>
                          </td>
                          <td className="py-3 px-4 text-[var(--text-main)] max-w-sm">
                            <p className="line-clamp-2">{app.purpose}</p>
                          </td>
                          <td className="py-3 px-4 text-[var(--text-dim)] whitespace-nowrap">
                            {formatDateTime(app.created_at)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveApplication(app.id)}
                                disabled={actionLoading}
                                className="btn-primary text-[11px] py-1 px-3 flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-3 h-3" />
                                <span>Onayla</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectTargetApp(app);
                                  setRejectionReasonInput('Fiziksel işletme bilgileri doğrulanamadığı için başvurunuz reddedildi.');
                                  setRejectModalOpen(true);
                                }}
                                disabled={actionLoading}
                                className="btn-secondary text-[11px] py-1 px-3 text-red-400 hover:text-red-300"
                              >
                                Reddet
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          Onay bekleyen kurumsal başvuru bulunmamaktadır.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW B: KURUMSAL SATICILAR (Section 12B & 23) */}
          {corporateSubTab === 'dealers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>
                  Toplam <strong>{(data?.dealers || []).filter((d: any) => showDeletedStores || d.moderation_status !== 'DELETED').length}</strong> kurumsal mağaza listeleniyor.
                </span>
                <label className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-main)] font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={showDeletedStores}
                    onChange={(e) => setShowDeletedStores(e.target.checked)}
                    className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                  />
                  <span>Silinen Mağazaları Göster</span>
                </label>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Şirket / Galeri</th>
                      <th className="py-3 px-4">Sahip Karakter</th>
                      <th className="py-3 px-4">Moderasyon</th>
                      <th className="py-3 px-4">Abonelik</th>
                      <th className="py-3 px-4">Abonelik Bitiş</th>
                      <th className="py-3 px-4">Aktif İlan</th>
                      <th className="py-3 px-4">Takipçi</th>
                      <th className="py-3 px-4 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-app)]">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
                            <span>Kurumsal mağazalar yükleniyor...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (data?.dealers || []).filter((d: any) => showDeletedStores || d.moderation_status !== 'DELETED').length > 0 ? (
                      (data?.dealers || [])
                        .filter((d: any) => showDeletedStores || d.moderation_status !== 'DELETED')
                        .map((d: any) => {
                          const isSuspended = d.moderation_status === 'SUSPENDED';
                          const isDeleted = d.moderation_status === 'DELETED';
                          const isSubActive = d.subscription_status === 'ACTIVE';

                          return (
                            <tr key={d.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {d.logo_path || d.logo_url ? (
                                    <img
                                      src={resolveMediaUrl(d.logo_path || d.logo_url)}
                                      alt={d.company_name}
                                      className="w-9 h-9 rounded-lg object-cover border border-[var(--border-app)] shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-[var(--brand-orange-subtle)] border border-[#FF8A1F]/30 text-[#FF8A1F] flex items-center justify-center font-bold text-xs shrink-0">
                                      {d.company_name?.charAt(0) || 'K'}
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                                      <span>{d.company_name}</span>
                                      {isSubActive && <Crown className="w-3 h-3 text-[#FF8A1F] fill-current" />}
                                    </p>
                                    <p className="text-[10px] text-[var(--text-dim)] font-mono">{d.public_id ? `#${d.public_id}` : d.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[var(--text-main)]">{d.owner_character_name || 'Bilinmeyen'}</div>
                                <div className="font-mono text-[10px] text-[var(--text-dim)]">{d.owner_profile_id || d.profile_id}</div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold inline-block ${
                                    isDeleted
                                      ? 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)] border border-[var(--color-danger)]/30'
                                      : isSuspended
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border border-[var(--color-success)]/30'
                                  }`}
                                >
                                  {isDeleted ? 'SİLİNDİ' : isSuspended ? 'ASKIDA' : 'AKTİF'}
                                </span>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                                    isSubActive
                                      ? 'bg-[#FF8A1F]/15 text-[#FF8A1F] border border-[#FF8A1F]/30'
                                      : d.subscription_status === 'EXPIRED'
                                      ? 'bg-amber-500/15 text-amber-400'
                                      : 'bg-[var(--bg-surface-secondary)] text-[var(--text-muted)]'
                                  }`}
                                >
                                  {isSubActive ? 'AKTİF' : d.subscription_status === 'EXPIRED' ? 'DOLDU' : 'PASİF'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[var(--text-dim)] whitespace-nowrap">
                                {d.subscription_expires_at ? formatDate(d.subscription_expires_at) : '—'}
                              </td>
                              <td className="py-3 px-4 font-bold text-[var(--text-main)]">
                                {d.active_listing_count ?? 0}
                              </td>
                              <td className="py-3 px-4 text-[var(--text-main)]">
                                {d.follower_count ?? 0}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStore(d);
                                    setStoreManageModalOpen(true);
                                  }}
                                  className="btn-secondary text-[11px] py-1 px-3 font-bold hover:border-[#FF8A1F]/50 transition-colors"
                                >
                                  Yönet
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          Kayıtlı kurumsal mağaza bulunmamaktadır.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[var(--text-main)]">Kayıtlı Kullanıcılar</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Sistemde kayıtlı hesaplar, rolleri ve bağlı karakter profilleri</p>
            </div>
            <div className="text-xs text-[var(--text-muted)] font-medium">
              Toplam: <span className="font-bold text-[var(--text-main)]">{data?.users?.length || 0}</span> hesap
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Karakter / Hesap</th>
                  <th className="py-3.5 px-4">Yetki (Rol)</th>
                  <th className="py-3.5 px-4">Karakterler</th>
                  <th className="py-3.5 px-4">Kayıt Tarihi</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-app)]">
                {(data?.users || []).map((item: any) => {
                  const mainChar = item.characters && item.characters.length > 0 ? item.characters[0] : null;
                  const allChars = item.characters || [];
                  const isAdminRole = item.user.role === 'ADMIN';

                  return (
                    <tr key={item.user.id} className="hover:bg-[var(--bg-surface-secondary)]/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] flex items-center justify-center shrink-0 overflow-hidden text-[var(--text-muted)]">
                            {mainChar?.avatar_path ? (
                              <img
                                src={resolveMediaUrl(mainChar.avatar_path)}
                                alt={mainChar.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <UserIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-[var(--text-main)]">
                              {mainChar?.full_name || 'İsimsiz Profil'}
                            </div>
                            <div className="font-mono text-[10px] text-[var(--text-dim)]">
                              ID: {item.user.id.slice(0, 13)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isAdminRole ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#FF8A1F]/15 text-[#FF8A1F] border border-[#FF8A1F]/30">
                            <Shield className="w-3 h-3" />
                            ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--bg-surface-secondary)] text-[var(--text-muted)] border border-[var(--border-app)]">
                            USER
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[var(--text-main)]">
                            {item.profileCount} Karakter
                          </span>
                          {allChars.length > 0 && (
                            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[180px]">
                              {allChars.map((c: any) => c.full_name).join(', ')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">
                        {item.user.created_at ? formatDateTime(item.user.created_at) : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.user.status === 'ACTIVE'
                              ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                              : 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
                          }`}
                        >
                          {item.user.status === 'ACTIVE' ? 'Aktif' : 'Engelli'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleBan(item.user.id)}
                          className={`text-[11px] py-1 px-2.5 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
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
                  );
                })}
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

      {/* Corporate Application Rejection Modal (Section 12A) */}
      {rejectModalOpen && rejectTargetApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-sm text-[var(--text-main)]">Kurumsal Başvuruyu Reddet</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              <strong>{rejectTargetApp.company_name}</strong> adlı başvuruyu reddetmek üzeresiniz. Başvuru sahibine görüntülenecek ve bildirim olarak iletilecek reddedilme gerekçesini giriniz:
            </p>

            <form onSubmit={handleConfirmRejectApplication} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Reddedilme Gerekçesi</label>
                <textarea
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  required
                  placeholder="Örn: Fiziksel işletme bilgileri doğrulanamadığı için başvurunuz reddedildi."
                  className="form-input text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReasonInput.trim()}
                  className="btn-danger text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Reddet ve Bildir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Corporate Store Management Modal (Section 12B & 23) */}
      {storeManageModalOpen && selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="surface-card w-full max-w-lg rounded-2xl border border-[var(--border-app)] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[var(--brand-orange-subtle)] border border-[#FF8A1F]/30 text-[#FF8A1F] flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedStore.company_name?.charAt(0) || 'K'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-main)]">{selectedStore.company_name}</h3>
                  <p className="text-[10px] text-[var(--text-dim)] font-mono">{selectedStore.public_id ? `#${selectedStore.public_id}` : selectedStore.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStoreManageModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Store Information Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)]/50 border border-[var(--border-app)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Sahip Karakter</span>
                <p className="font-bold text-[var(--text-main)]">{selectedStore.owner_character_name || 'Bilinmeyen'}</p>
                <p className="text-[10px] font-mono text-[var(--text-dim)] truncate">{selectedStore.owner_profile_id || selectedStore.profile_id}</p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)]/50 border border-[var(--border-app)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Moderasyon Durumu</span>
                <div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold inline-block ${
                      selectedStore.moderation_status === 'DELETED'
                        ? 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
                        : selectedStore.moderation_status === 'SUSPENDED'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                    }`}
                  >
                    {selectedStore.moderation_status === 'DELETED' ? 'SİLİNDİ' : selectedStore.moderation_status === 'SUSPENDED' ? 'ASKIDA' : 'AKTİF'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)]/50 border border-[var(--border-app)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Abonelik Durumu</span>
                <p className="font-bold text-[var(--text-main)]">
                  {selectedStore.subscription_status === 'ACTIVE' ? 'Aktif Üye' : selectedStore.subscription_status === 'EXPIRED' ? 'Süresi Doldu' : 'Pasif'}
                </p>
                <p className="text-[10px] text-[var(--text-dim)]">
                  Bitiş: {selectedStore.subscription_expires_at ? formatDate(selectedStore.subscription_expires_at) : '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)]/50 border border-[var(--border-app)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Portföy & Haklar</span>
                <p className="font-bold text-[var(--text-main)]">{selectedStore.active_listing_count ?? 0} Aktif İlan</p>
                <p className="text-[10px] text-[var(--text-dim)]">{selectedStore.boost_credits ?? 0} Öne Çıkarma Hakkı</p>
              </div>
            </div>

            {/* Suspended Reason banner if store is currently suspended */}
            {selectedStore.moderation_status === 'SUSPENDED' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Mağaza Şu Anda Askıdadır</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  <strong>Neden:</strong> {selectedStore.suspension_reason || 'Belirtilmedi'}
                </p>
                {selectedStore.suspended_at && (
                  <p className="text-[10px] text-[var(--text-dim)]">
                    Tarih: {formatDateTime(selectedStore.suspended_at)}
                  </p>
                )}
              </div>
            )}

            {/* Deleted Reason banner if store is soft-deleted */}
            {selectedStore.moderation_status === 'DELETED' && (
              <div className="p-3.5 rounded-xl bg-[var(--color-danger-subtle)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Bu Mağaza Silinmiştir (Soft Delete)</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  <strong>Neden:</strong> {selectedStore.deletion_reason || 'Belirtilmedi'}
                </p>
                {selectedStore.deleted_at && (
                  <p className="text-[10px] text-[var(--text-dim)]">
                    Tarih: {formatDateTime(selectedStore.deleted_at)}
                  </p>
                )}
              </div>
            )}

            {/* Management Actions */}
            <div className="pt-2 border-t border-[var(--border-app)] flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/premium/${selectedStore.public_id || selectedStore.id}`}
                target="_blank"
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Vitrini Gör</span>
              </Link>

              <div className="flex items-center gap-2">
                {selectedStore.moderation_status === 'ACTIVE' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setStoreReasonInput('');
                        setSuspendModalOpen(true);
                      }}
                      className="btn-secondary text-xs py-2 px-3 text-amber-400 hover:text-amber-300"
                    >
                      Askıya Al
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStoreReasonInput('');
                        setDeleteModalOpen(true);
                      }}
                      className="btn-danger text-xs py-2 px-3"
                    >
                      Mağazayı Sil
                    </button>
                  </>
                )}

                {selectedStore.moderation_status === 'SUSPENDED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleReactivateStore(selectedStore.id)}
                      disabled={actionLoading}
                      className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
                      title="Askıdan çıkarır. Ödenmemiş aboneliği otomatik aktif etmez."
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Askıdan Çıkar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStoreReasonInput('');
                        setDeleteModalOpen(true);
                      }}
                      className="btn-danger text-xs py-2 px-3"
                    >
                      Mağazayı Sil
                    </button>
                  </>
                )}

                {selectedStore.moderation_status === 'DELETED' && (
                  <span className="text-[11px] text-[var(--text-dim)] italic">
                    Silinmiş kayıt (Salt Okunur)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Store Confirmation Modal (Section 14) */}
      {suspendModalOpen && selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-[var(--text-main)]">Kurumsal Mağazayı Askıya Al</h3>
              </div>
              <button
                type="button"
                onClick={() => setSuspendModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              <strong>{selectedStore.company_name}</strong> mağazasını askıya almak üzeresiniz. Askı süresince mağaza yeni ilan yayınlayamaz, vitrini ve aktif ilanları halka açık aramalarda gizlenir.
            </p>

            <form onSubmit={handleConfirmSuspendStore} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Askıya Alma Nedeni (Zorunlu)</label>
                <textarea
                  rows={3}
                  value={storeReasonInput}
                  onChange={(e) => setStoreReasonInput(e.target.value)}
                  required
                  placeholder="Örn: Topluluk kurallarına aykırı ilan girişi sebebiyle incelenmek üzere askıya alınmıştır."
                  className="form-input text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSuspendModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !storeReasonInput.trim()}
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-md"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Askıya Al ve Bildir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Store Confirmation Modal (Section 16) */}
      {deleteModalOpen && selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-sm text-[var(--text-main)]">Kurumsal Mağazayı Sil (Soft Delete)</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              <strong>{selectedStore.company_name}</strong> mağazasını silmek üzeresiniz. Mağazaya ait tüm aktif kurumsal ilanlar <strong>REMOVED</strong> durumuna alınır ve görsel medyaları güvenli temizlik döngüsüne iletilir. Denetim kaydı korunur.
            </p>

            <form onSubmit={handleConfirmDeleteStore} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Silme Gerekçesi (Zorunlu)</label>
                <textarea
                  rows={3}
                  value={storeReasonInput}
                  onChange={(e) => setStoreReasonInput(e.target.value)}
                  required
                  placeholder="Örn: İşletmenin faaliyetine son vermesi veya ağır kural ihlali sebebiyle mağaza kapatılmıştır."
                  className="form-input text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !storeReasonInput.trim()}
                  className="btn-danger text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Güvenli Sil ve Bildir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
