import { create } from "zustand"

export interface CartItem {
  productId: string
  nameAr: string
  name: string
  price: number
  customPrice?: number
  image?: string
  quantity: number
  stock: number
  variantId?: string
  variantName?: string
  affiliateCostPrice?: number | null
  minPrice?: number | null
}

interface AppState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  adminSidebarOpen: boolean
  setAdminSidebarOpen: (open: boolean) => void
  toggleAdminSidebar: () => void
  notifications: any[]
  setNotifications: (notifications: any[]) => void
  unreadCount: number
  setUnreadCount: (count: number) => void
  cart: CartItem[]
  addToCart: (item: Omit<CartItem, "quantity">, qty?: number) => void
  removeFromCart: (productId: string, variantId?: string) => void
  updateCartQuantity: (productId: string, quantity: number, variantId?: string) => void
  updateCartPrice: (productId: string, customPrice: number, variantId?: string) => void
  clearCart: () => void
  cartSubtotal: () => number
  cartTotal: () => number
  cartCount: () => number
  getCartQty: (productId: string, variantId?: string) => number
  getAvailableStock: (productId: string, totalStock: number, variantId?: string, variantStock?: number) => number
}

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const saved = localStorage.getItem("cart")
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function saveCart(cart: CartItem[]) {
  if (typeof window === "undefined") return
  try { localStorage.setItem("cart", JSON.stringify(cart)) } catch {}
}

function cartKey(productId: string, variantId?: string) {
  return variantId ? `${productId}:${variantId}` : productId
}

function itemPrice(item: CartItem): number {
  return item.customPrice !== undefined && item.customPrice !== null ? item.customPrice : item.price
}

export const useAppStore = create<AppState>((set, get) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  adminSidebarOpen: false,
  setAdminSidebarOpen: (open) => set({ adminSidebarOpen: open }),
  toggleAdminSidebar: () => set((state) => ({ adminSidebarOpen: !state.adminSidebarOpen })),
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),

  cart: typeof window !== "undefined" ? loadCart() : [],

  addToCart: (item, qty = 1) => set((state) => {
    const key = cartKey(item.productId, item.variantId)
    const existing = state.cart.find((i) => cartKey(i.productId, i.variantId) === key)
    let newCart: CartItem[]
    if (existing) {
      const newQty = existing.quantity + qty
      if (newQty > item.stock) return state
      newCart = state.cart.map((i) =>
        cartKey(i.productId, i.variantId) === key ? { ...i, quantity: newQty } : i
      )
    } else {
      if (qty > item.stock) return state
      newCart = [...state.cart, { ...item, quantity: qty }]
    }
    saveCart(newCart)
    return { cart: newCart }
  }),

  removeFromCart: (productId, variantId) => set((state) => {
    const key = cartKey(productId, variantId)
    const newCart = state.cart.filter((i) => cartKey(i.productId, i.variantId) !== key)
    saveCart(newCart)
    return { cart: newCart }
  }),

  updateCartQuantity: (productId, quantity, variantId) => set((state) => {
    const key = cartKey(productId, variantId)
    if (quantity <= 0) {
      const newCart = state.cart.filter((i) => cartKey(i.productId, i.variantId) !== key)
      saveCart(newCart)
      return { cart: newCart }
    }
    const newCart = state.cart.map((i) =>
      cartKey(i.productId, i.variantId) === key ? { ...i, quantity: Math.min(quantity, i.stock) } : i
    )
    saveCart(newCart)
    return { cart: newCart }
  }),

  updateCartPrice: (productId, customPrice, variantId) => set((state) => {
    const key = cartKey(productId, variantId)
    const newCart = state.cart.map((i) =>
      cartKey(i.productId, i.variantId) === key ? { ...i, customPrice } : i
    )
    saveCart(newCart)
    return { cart: newCart }
  }),

  clearCart: () => {
    saveCart([])
    set({ cart: [] })
  },

  cartSubtotal: () => get().cart.reduce((sum, i) => sum + itemPrice(i) * i.quantity, 0),
  cartTotal: () => get().cart.reduce((sum, i) => sum + itemPrice(i) * i.quantity, 0),
  cartCount: () => get().cart.reduce((sum, i) => sum + i.quantity, 0),

  getCartQty: (productId, variantId) => {
    const key = cartKey(productId, variantId)
    const item = get().cart.find((i) => cartKey(i.productId, i.variantId) === key)
    return item?.quantity || 0
  },

  getAvailableStock: (productId, totalStock, variantId, variantStock) => {
    const baseStock = variantStock !== undefined ? variantStock : totalStock
    const key = cartKey(productId, variantId)
    const cartItem = get().cart.find((i) => cartKey(i.productId, i.variantId) === key)
    const reserved = cartItem?.quantity || 0
    return Math.max(0, baseStock - reserved)
  },
}))
