"use client"
import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import {
  ArrowRight, Loader2, Upload, Send, Image as ImageIcon,
  CheckCircle, Clock, XCircle, MessageSquare, FileText,
  Trash2, User, Phone, MapPin, StickyNote, Package, Truck, DollarSign,
} from "lucide-react"
import { formatCurrency, formatDateTime, getStatusColor, getStatusText } from "@/lib/utils"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import ConfirmDialog from "@/components/ConfirmDialog"

export default function OrderDetailPage() {
  const { id } = useParams()
  const { data: session } = useSession()
  const perms = usePermissions()
  const can = perms.can
  const canAny = perms.canAny
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"details" | "items" | "comments" | "images">("details")
  const [commentText, setCommentText] = useState("")
  const [postingComment, setPostingComment] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const commentEndRef = useRef<HTMLDivElement>(null)
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)

  const fetchOrder = () => {
    fetch(`/api/admin/orders/${id}`)
      .then(r => r.json())
      .then(d => { setOrder(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchOrder() }, [id])

  useEffect(() => {
    fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link: `/admin/orders/${id}` }),
    }).catch(() => {})
  }, [id])

  const updateOrder = async (data: any) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setOrder(updated)
      }
    } catch {}
    setSaving(false)
  }

  const updateStatus = async (status: string) => {
    await updateOrder({ status })
  }

  const updatePaymentStatus = async (paymentStatus: string) => {
    await updateOrder({ paymentStatus })
  }

  const saveFieldEdits = async () => {
    const data: any = {}
    for (const [key, val] of Object.entries(editValues)) {
      data[key] = val
    }
    await updateOrder(data)
    setEditingField(null)
    setEditValues({})
  }

  const addComment = async () => {
    if (!commentText.trim()) return
    setPostingComment(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: commentText }),
      })
      if (res.ok) {
        const comment = await res.json()
        setOrder((prev: any) => ({ ...prev, comments: [comment, ...(prev.comments || [])] }))
        setCommentText("")
      }
    } catch {}
    setPostingComment(false)
  }

  const deleteComment = async (commentId: string) => {
    await fetch(`/api/admin/orders/${id}/comments?commentId=${commentId}`, { method: "DELETE" })
    setOrder((prev: any) => ({ ...prev, comments: prev.comments.filter((c: any) => c.id !== commentId) }))
    setDeleteCommentId(null)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "orders")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (res.ok) {
        const { url } = await res.json()
        await fetch(`/api/admin/orders/${id}/images`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
        })
      }
    }
    fetchOrder()
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const deleteImage = async (imageId: string) => {
    await fetch(`/api/admin/orders/${id}/images?imageId=${imageId}`, { method: "DELETE" })
    setOrder((prev: any) => ({ ...prev, images: prev.images.filter((i: any) => i.id !== imageId) }))
  }

  const updateItemPrice = async (itemId: string, unitPrice: string, quantity?: number) => {
    await updateOrder({ items: [{ id: itemId, unitPrice, quantity }] })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 rounded-xl animate-spin" style={{ border: "3px solid #e2e8f0", borderTopColor: "#3b82f6" }} />
    </div>
  )

  if (!order) return <div className="text-center py-16 text-slate-500">الطلب غير موجود</div>

  const statusSteps = ["PENDING", "UNDER_REVIEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COLLECTED"]

  return (
    <RequirePerms perm="orders.view">
    <div className="space-y-5 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="p-2 rounded-xl hover:bg-white transition-colors text-slate-600">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{order.orderNumber}</h1>
            <p className="text-[12px] text-slate-500">{formatDateTime(order.createdAt)}</p>
          </div>
          <span className={`badge ${getStatusColor(order.status)}`}>{getStatusText(order.status)}</span>
          <span className={`badge ${getStatusColor(order.paymentStatus)}`}>{getStatusText(order.paymentStatus)}</span>
        </div>
        {saving && <Loader2 size={18} className="animate-spin text-blue-500" />}
      </div>

      {/* Status Timeline */}
      <div className="card-premium p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">تتبع الحالة</h3>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {statusSteps.map((step, i) => {
            const currentIdx = statusSteps.indexOf(order.status)
            const isDone = i <= currentIdx
            const isCurrent = i === currentIdx
            const allowed = step === "CONFIRMED" ? canAny(["orders.update", "confirmation.confirm"]) : can("orders.update")
            return (
              <div key={step} className="flex items-center flex-1 min-w-[100px]">
                {allowed && (
                <button
                  onClick={() => updateStatus(step)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all w-full
                    ${isCurrent ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : isDone ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                >
                  {isDone ? <CheckCircle size={15} /> : <Clock size={15} />}
                  <span>{getStatusText(step)}</span>
                </button>
                )}
                {i < statusSteps.length - 1 && <div className={`w-6 h-0.5 mx-1 flex-shrink-0 ${i < currentIdx ? "bg-emerald-300" : "bg-slate-200"}`} />}
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 mt-3">
          {can("orders.update") && (
            <button
              onClick={() => updateStatus("CANCELLED")}
              className={`px-4 py-2 rounded-xl text-[12px] font-semibold transition-all ${order.status === "CANCELLED" ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
            >
              <XCircle size={14} className="inline ml-1" /> إلغاء الطلب
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200/60">
        {[
          { key: "details", label: "البيانات", icon: FileText },
          { key: "items", label: "المنتجات", icon: Package },
          { key: "comments", label: `التعليقات (${order.comments?.length || 0})`, icon: MessageSquare },
          { key: "images", label: `الصور (${order.images?.length || 0})`, icon: ImageIcon },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all flex-1 justify-center
              ${activeTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Details Tab */}
          {activeTab === "details" && (
            <>
              {/* Customer Info */}
              <div className="card-premium p-5">
                <h3 className="text-[13px] font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <User size={15} /> بيانات العميل
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "الاسم", key: "customerName", icon: User, value: order.customerName },
                    { label: "الهاتف", key: "customerPhone", icon: Phone, value: order.customerPhone, ltr: true },
                    { label: "المدينة", key: "customerCity", icon: MapPin, value: order.customerCity },
                    { label: "العنوان", key: "customerAddress", icon: MapPin, value: order.customerAddress },
                  ].map(field => (
                    <div key={field.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <field.icon size={14} className="text-slate-400" />
                        <div>
                          <p className="text-[11px] text-slate-500">{field.label}</p>
                          {editingField === field.key ? (
                            <input
                              defaultValue={field.value || ""}
                              dir={field.ltr ? "ltr" : "rtl"}
                              className="text-[13px] font-semibold text-slate-800 bg-transparent border-b-2 border-blue-500 outline-none w-full"
                              onBlur={(e) => { setEditValues({ ...editValues, [field.key]: e.target.value }); setEditingField(null) }}
                              onKeyDown={(e) => { if (e.key === "Enter") { setEditValues({ ...editValues, [field.key]: (e.target as HTMLInputElement).value }); setEditingField(null) } }}
                              autoFocus
                            />
                          ) : (
                            <p className={`text-[13px] font-semibold text-slate-800 cursor-pointer hover:text-blue-600`} dir={field.ltr ? "ltr" : "rtl"} onClick={() => setEditingField(field.key)}>{field.value || "-"}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(editValues).length > 0 && (
                  <button onClick={saveFieldEdits} className="mt-3 btn-primary text-[12px] px-4 py-2">
                    حفظ التعديلات
                  </button>
                )}
              </div>

              {/* Notes */}
              <div className="card-premium p-5">
                <h3 className="text-[13px] font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <StickyNote size={15} /> ملاحظات
                </h3>
                <textarea
                  defaultValue={order.notes || ""}
                  placeholder="ملاحظات العميل..."
                  rows={2}
                  className="input-premium text-[13px]"
                  onBlur={(e) => updateOrder({ notes: e.target.value })}
                />
                <textarea
                  defaultValue={order.internalNotes || ""}
                  placeholder="ملاحظات داخلية (لا يراها المسوق)..."
                  rows={2}
                  className="input-premium text-[13px] mt-2"
                  onBlur={(e) => updateOrder({ internalNotes: e.target.value })}
                />
              </div>

              {/* Tracking */}
              <div className="card-premium p-5">
                <h3 className="text-[13px] font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Truck size={15} /> رقم التتبع
                </h3>
                <input
                  defaultValue={order.trackingNumber || ""}
                  placeholder="أدخل رقم التتبع..."
                  className="input-premium text-[13px]"
                  dir="ltr"
                  onBlur={(e) => updateOrder({ trackingNumber: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Items Tab */}
          {activeTab === "items" && (
            <div className="card-premium p-5">
              <h3 className="text-[13px] font-bold text-slate-500 mb-4 uppercase tracking-wider">المنتجات</h3>
              <div className="space-y-3">
                {order.items?.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    {item.product?.image ? (
                      <img src={item.product.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center"><Package size={20} className="text-slate-400" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{item.product?.nameAr}</p>
                      <p className="text-[11px] text-slate-500">{item.product?.name}</p>
                      {item.note && <p className="text-[11px] text-blue-600 mt-1">{item.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-[11px] text-slate-500">الكمية</p>
                        <p className="text-[13px] font-bold text-slate-800">{item.quantity}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-slate-500">السعر</p>
                        <input
                          type="number"
                          defaultValue={item.unitPrice}
                          className="w-24 text-center text-[13px] font-bold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-blue-300 focus:border-blue-500 outline-none transition-colors py-1"
                          dir="ltr"
                          onBlur={(e) => updateItemPrice(item.id, e.target.value)}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-slate-500">الإجمالي</p>
                        <p className="text-[13px] font-extrabold text-blue-600">{formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === "comments" && (
            <div className="card-premium p-5">
              <h3 className="text-[13px] font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare size={15} /> التعليقات
              </h3>
              {/* Add Comment */}
              <div className="flex gap-2 mb-5">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addComment() }}
                  placeholder="اكتب تعليق..."
                  className="input-premium flex-1 text-[13px]"
                />
                {can("orders.comments") && (
                <button onClick={addComment} disabled={postingComment || !commentText.trim()} className="btn-primary px-4 flex items-center gap-2 text-[13px]">
                  {postingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  إرسال
                </button>
                )}
              </div>
              {/* Comments List */}
              <div className="space-y-3">
                {order.comments?.length === 0 && <p className="text-center text-slate-400 text-[13px] py-6">لا توجد تعليقات بعد</p>}
                {order.comments?.map((comment: any) => (
                  <div key={comment.id} className={`p-4 rounded-xl ${comment.user?.role === "ADMIN" ? "bg-blue-50 border border-blue-100" : "bg-slate-50 border border-slate-100"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white ${comment.user?.role === "ADMIN" ? "bg-blue-600" : "bg-slate-500"}`}>
                          {comment.user?.name?.charAt(0)}
                        </span>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-800">{comment.user?.name}</p>
                          <p className="text-[10px] text-slate-400">{formatDateTime(comment.createdAt)}</p>
                        </div>
                      </div>
                      {(session?.user as any)?.id === comment.userId && can("orders.comments") && (
                        <button onClick={() => setDeleteCommentId(comment.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-700 leading-relaxed">{comment.content}</p>
                  </div>
                ))}
                <div ref={commentEndRef} />
              </div>
            </div>
          )}

          {/* Images Tab */}
          {activeTab === "images" && (
            <div className="card-premium p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon size={15} /> صور الطلب
                </h3>
                {can("orders.images") && (
                <label className="btn-primary text-[12px] px-4 py-2 flex items-center gap-2 cursor-pointer">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  رفع صور
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
                )}
              </div>
              {order.images?.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                  <ImageIcon size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 text-[13px]">لا توجد صور بعد</p>
                  <p className="text-slate-300 text-[11px]">ارفع صور من جهازك</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {order.images?.map((img: any) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden">
                      <img src={img.url} alt={img.alt || ""} className="w-full aspect-square object-cover" />
                      {can("orders.images") && (
                        <button onClick={() => deleteImage(img.id)} className="absolute top-2 left-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={12} />
                        </button>
                      )}
                      <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-1">{formatDateTime(img.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Order Summary */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-4 uppercase tracking-wider">ملخص الطلب</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">المجموع الفرعي</span>
                <input
                  type="number"
                  defaultValue={order.subtotal}
                  className="w-28 text-left text-[13px] font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none py-0.5"
                  dir="ltr"
                  onBlur={(e) => updateOrder({ subtotal: e.target.value })}
                />
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">الشحن</span>
                <input
                  type="number"
                  defaultValue={order.shippingCost}
                  className="w-28 text-left text-[13px] font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none py-0.5"
                  dir="ltr"
                  onBlur={(e) => updateOrder({ shippingCost: e.target.value })}
                />
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">الخصم</span>
                <input
                  type="number"
                  defaultValue={order.discount}
                  className="w-28 text-left text-[13px] font-semibold text-red-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none py-0.5"
                  dir="ltr"
                  onBlur={(e) => updateOrder({ discount: e.target.value })}
                />
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="text-[15px] font-extrabold text-slate-900">الإجمالي</span>
                <input
                  type="number"
                  defaultValue={order.total}
                  className="w-28 text-left text-[15px] font-extrabold text-blue-600 bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none py-0.5"
                  dir="ltr"
                  onBlur={(e) => updateOrder({ total: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
              <DollarSign size={15} /> حالة الدفع
            </h3>
            <div className="flex flex-wrap gap-2">
              {["PENDING", "PAID", "FAILED", "REFUNDED"].map(st => (
                can("orders.update") && (
                <button
                  key={st}
                  onClick={() => updatePaymentStatus(st)}
                  className={`px-3 py-2 rounded-xl text-[12px] font-semibold transition-all ${order.paymentStatus === st ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  {getStatusText(st)}
                </button>
                )
              ))}
            </div>
          </div>

          {/* Affiliate */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
              <User size={15} /> المسوق
            </h3>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                {order.affiliate?.name?.charAt(0)}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800">{order.affiliate?.name}</p>
                <p className="text-[11px] text-slate-500">{order.affiliate?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteCommentId}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={() => { if (deleteCommentId) deleteComment(deleteCommentId) }}
        title="حذف التعليق"
        message="هل أنت متأكد من حذف هذا التعليق؟"
        confirmText="حذف"
      />
    </div>
    </RequirePerms>
  )
}
