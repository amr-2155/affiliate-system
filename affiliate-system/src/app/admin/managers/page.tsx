"use client"
import { useCallback, useEffect, useState } from "react"
import {
  UserCog,
  Users,
  Crown,
  CheckCircle2,
  ListChecks,
  Search,
  Loader2,
  MoreVertical,
  X,
  Plus,
  RotateCw,
  FilterX,
  Eye,
  Edit3,
  Lock,
  Ban,
  Unlock,
  Trash2,
  Clock,
  Calendar,
  UserPlus,
} from "lucide-react"
import { formatDate, formatDateTime } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import Pagination from "@/components/Pagination"
import Avatar from "@/components/admin/Avatar"
import Badge from "@/components/admin/Badge"
import StatCard from "@/components/admin/StatCard"
import DropdownMenu, { type DropdownItem } from "@/components/admin/DropdownMenu"
import {
  ManagerModal,
  ViewManagerModal,
  PermissionsModal,
  PasswordModal,
  DeleteManagerModal,
  ToggleStatusModal,
  timeAgo,
} from "@/components/admin/ManagerModals"

const PER_PAGE = 10

interface ManagerRow {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  status: string
  lastLogin: string | null
  createdAt: string
  isSuperAdmin: boolean
  permissions: string[]
  permissionsCount: number
}

const STATUS_FILTERS = [
  { key: "", label: "الكل" },
  { key: "ACTIVE", label: "نشط" },
  { key: "INACTIVE", label: "غير نشط" },
]

export default function AdminManagersPage() {
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [showAdd, setShowAdd] = useState(false)
  const [editRow, setEditRow] = useState<ManagerRow | null>(null)
  const [viewRow, setViewRow] = useState<ManagerRow | null>(null)
  const [permsRow, setPermsRow] = useState<ManagerRow | null>(null)
  const [passwordRow, setPasswordRow] = useState<ManagerRow | null>(null)
  const [toggleRow, setToggleRow] = useState<ManagerRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<ManagerRow | null>(null)

  const loadManagers = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)
    params.set("page", String(page))
    params.set("limit", String(PER_PAGE))
    try {
      const res = await fetch(`/api/admin/managers?${params}`)
      const data = await res.json()
      setManagers(data?.managers || [])
      setTotal(data?.total || 0)
      setTotalPages(Math.max(1, data?.pages || 1))
    } catch {
      toast("تعذر تحميل المديرين", "error")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page, toast])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/managers/stats")
      setStats(await res.json())
    } catch {
      /* stats غير حرجة */
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => loadManagers(), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [loadManagers, search])

  const refreshAll = async () => {
    setRefreshing(true)
    await Promise.all([loadManagers(), loadStats()])
    setRefreshing(false)
  }

  const reload = () => { loadManagers(); loadStats() }

  const hasFilters = !!(search || statusFilter)

  const buildActions = (m: ManagerRow): DropdownItem[] => {
    const isActive = m.status === "ACTIVE"
    const items: DropdownItem[] = []
    if (can("managers.view")) {
      items.push({ key: "view", label: "عرض", icon: <Eye size={14} style={{ color: "#0284c7" }} />, tint: "#0284c7", onClick: () => setViewRow(m) })
    }
    if (can("managers.update")) {
      items.push(
        { key: "edit", label: "تعديل", icon: <Edit3 size={14} style={{ color: "#2563eb" }} />, tint: "#2563eb", onClick: () => setEditRow(m) },
        { key: "password", label: "تغيير كلمة المرور", icon: <Lock size={14} style={{ color: "#d97706" }} />, tint: "#d97706", onClick: () => setPasswordRow(m) },
      )
    }
    if (can("managers.permissions")) {
      items.push({ key: "permissions", label: "الصلاحيات", icon: <ListChecks size={14} style={{ color: "#7c3aed" }} />, tint: "#7c3aed", onClick: () => setPermsRow(m) })
    }
    if (items.length) items.push({ key: "separator", label: "", separator: true })
    if (can("managers.update")) {
      items.push({
        key: "toggle",
        label: isActive ? "تعطيل الحساب" : "تفعيل الحساب",
        icon: isActive ? <Ban size={14} style={{ color: "#dc2626" }} /> : <Unlock size={14} style={{ color: "#059669" }} />,
        danger: isActive,
        onClick: () => setToggleRow(m),
      })
    }
    if (can("managers.delete")) {
      items.push({
        key: "delete",
        label: "حذف المدير",
        icon: <Trash2 size={14} style={{ color: "#dc2626" }} />,
        danger: true,
        disabled: m.isSuperAdmin,
        onClick: () => setDeleteRow(m),
      })
    }
    return items
  }

  const renderActions = (m: ManagerRow) => (
    <DropdownMenu
      trigger={<MoreVertical size={16} />}
      items={buildActions(m)}
      align="left"
      width="w-56"
      ariaLabel={`إجراءات ${m.name}`}
    />
  )

  return (
    <RequirePerms perm="managers.view">
      <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200" style={{ background: "linear-gradient(135deg, #312e81, #6366f1)" }}>
            <UserCog size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">إدارة المديرين</h1>
            <p className="text-[12px] text-slate-500">{total > 0 ? `${total.toLocaleString("ar-EG")} مدير في النظام` : "إدارة حسابات المديرين وصلاحياتهم"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshAll} disabled={refreshing} title="تحديث" className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-50">
            <RotateCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          {can("managers.create") && (
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-indigo-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
              <Plus size={15} /> إضافة مدير جديد
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي المديرين" value={stats ? stats.total.toLocaleString("ar-EG") : "—"} icon={Users} tint="#4f46e5" hint={stats?.recentLogin ? `آخر دخول ${timeAgo(stats.recentLogin.lastLogin)}` : undefined} />
        <StatCard label="النشطون" value={stats ? stats.active.toLocaleString("ar-EG") : "—"} icon={CheckCircle2} tint="#059669" />
        <StatCard label="المدراء العامون" value={stats ? stats.superAdmins.toLocaleString("ar-EG") : "—"} icon={Crown} tint="#7c3aed" />
        <StatCard label="بصلاحيات مخصصة" value={stats ? stats.withPermissions.toLocaleString("ar-EG") : "—"} icon={ListChecks} tint="#d97706" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="ابحث بالاسم، البريد الإلكتروني، أو رقم الهاتف..."
              className="w-full pr-10 pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                    statusFilter === f.key ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setStatusFilter(""); setPage(1) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-[12px] font-bold hover:bg-red-100 transition-colors"
              >
                <FilterX size={13} /> مسح
              </button>
            )}
            {!loading && total > 0 && (
              <span className="text-[11px] font-semibold text-slate-400 px-2">
                {total.toLocaleString("ar-EG")} نتيجة
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Skeleton />
      ) : managers.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={() => { setSearch(""); setStatusFilter(""); setPage(1) }} onAdd={() => setShowAdd(true)} canCreate={can("managers.create")} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-right px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المدير</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الدور</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الهاتف</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الصلاحيات</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">آخر تسجيل دخول</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">تاريخ الإنشاء</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحالة</th>
                    <th className="px-3 py-3.5 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {managers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name} isSuperAdmin={m.isSuperAdmin} size="md" status={m.status} showStatus />
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-800 truncate">{m.name}</p>
                            <p className="text-[11px] text-slate-400 truncate" dir="ltr">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {m.isSuperAdmin ? (
                          <Badge variant="violet" icon={<Crown size={11} />}>مدير عام</Badge>
                        ) : (
                          <Badge variant="indigo" icon={<UserCog size={11} />}>مدير</Badge>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        {m.phone ? <span className="text-[12px] text-slate-600 font-medium" dir="ltr">{m.phone}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold">
                          <ListChecks size={12} />
                          {m.permissionsCount} صلاحية
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {m.lastLogin ? (
                          <div>
                            <p className="text-[12px] font-semibold text-slate-700">{timeAgo(m.lastLogin)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><Clock size={9} /> {formatDateTime(m.lastLogin)}</p>
                          </div>
                        ) : (
                          <span className="text-[12px] text-slate-400">لم يسجل بعد</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <span className="flex items-center gap-1.5 text-[12px] text-slate-600">
                          <Calendar size={12} className="text-slate-400" />
                          {formatDate(m.createdAt)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={m.status === "ACTIVE" ? "success" : "neutral"} dot>
                          {m.status === "ACTIVE" ? "نشط" : "غير نشط"}
                        </Badge>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-end">
                          {renderActions(m)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tablet / Mobile Cards */}
          <div className="lg:hidden space-y-2.5">
            {managers.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={m.name} isSuperAdmin={m.isSuperAdmin} size="md" status={m.status} showStatus />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{m.name}</p>
                        {m.isSuperAdmin && <Crown size={12} className="text-violet-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate" dir="ltr">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={m.status === "ACTIVE" ? "success" : "neutral"} dot>{m.status === "ACTIVE" ? "نشط" : "غير نشط"}</Badge>
                    {renderActions(m)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50 text-[11px]">
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">الدور</p>
                    <p className="font-bold text-slate-700 mt-0.5 flex items-center gap-1">
                      {m.isSuperAdmin ? <Crown size={11} className="text-violet-500" /> : <UserCog size={11} className="text-indigo-500" />}
                      {m.isSuperAdmin ? "مدير عام" : "مدير"}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">الصلاحيات</p>
                    <p className="font-bold text-slate-700 mt-0.5">{m.permissionsCount} صلاحية</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">آخر دخول</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{m.lastLogin ? timeAgo(m.lastLogin) : "—"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">تاريخ الإنشاء</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{formatDate(m.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-slate-400">
              عرض {total > 0 ? ((page - 1) * PER_PAGE + 1).toLocaleString("ar-EG") : 0} - {Math.min(page * PER_PAGE, total).toLocaleString("ar-EG")} من {total.toLocaleString("ar-EG")}
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* Modals */}
      {showAdd && <ManagerModal row={null} onClose={() => setShowAdd(false)} onSaved={reload} />}
      {editRow && <ManagerModal row={editRow} onClose={() => setEditRow(null)} onSaved={reload} />}
      {viewRow && <ViewManagerModal row={viewRow} onClose={() => setViewRow(null)} />}
      {permsRow && <PermissionsModal row={permsRow} onClose={() => setPermsRow(null)} onSaved={reload} />}
      {passwordRow && <PasswordModal row={passwordRow} onClose={() => setPasswordRow(null)} onSaved={reload} />}
      {toggleRow && <ToggleStatusModal row={toggleRow} onClose={() => setToggleRow(null)} onDone={reload} />}
      {deleteRow && <DeleteManagerModal row={deleteRow} onClose={() => setDeleteRow(null)} onDeleted={reload} />}
      </div>
    </RequirePerms>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2.5">
      {/* Desktop skeleton */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="w-40 h-3 bg-slate-100 rounded-lg" />
              <div className="w-52 h-2 bg-slate-100 rounded-lg" />
            </div>
            <div className="w-20 h-6 bg-slate-100 rounded-full" />
            <div className="w-24 h-3 bg-slate-100 rounded-lg" />
            <div className="w-24 h-3 bg-slate-100 rounded-lg" />
            <div className="w-14 h-6 bg-slate-100 rounded-full" />
            <div className="w-8 h-8 bg-slate-100 rounded-lg" />
          </div>
        ))}
      </div>
      {/* Mobile skeleton */}
      <div className="lg:hidden space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="w-28 h-3 bg-slate-100 rounded-lg" />
                <div className="w-40 h-2 bg-slate-100 rounded-lg" />
              </div>
              <div className="w-14 h-6 bg-slate-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ hasFilters, onClear, onAdd, canCreate }: { hasFilters: boolean; onClear: () => void; onAdd: () => void; canCreate: boolean }) {
  return (
    <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center mx-auto mb-4">
        {hasFilters ? <Search size={30} className="text-slate-300" /> : <UserCog size={30} className="text-slate-300" />}
      </div>
      <p className="text-slate-900 font-bold text-[15px] mb-1">{hasFilters ? "لا توجد نتائج مطابقة" : "لا يوجد مديرين بعد"}</p>
      <p className="text-slate-400 text-[13px] mb-5">{hasFilters ? "جرّب تعديل معايير البحث أو مسح الفلاتر" : "ابدأ بإنشاء أول حساب مدير في النظام"}</p>
      {hasFilters ? (
        <button onClick={onClear} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold transition-colors">
          <FilterX size={14} /> مسح الفلاتر
        </button>
      ) : canCreate ? (
        <button onClick={onAdd} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-indigo-200 hover:shadow-md transition-all">
          <UserPlus size={14} /> إضافة أول مدير
        </button>
      ) : null}
    </div>
  )
}
