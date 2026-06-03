import { create } from 'zustand';

export interface CartItem {
  cartItemId: string; // Unificador: p-${productId} o s-${serviceId}
  productId?: number;
  serviceId?: number;
  nombre: string;
  precio: number;
  cantidad: number;
  descuento: number; // Descuento individual por unidad
  stock?: number;   // Existencias (solo productos)
  unidad: string;   // pza, servicio, copia, etc.
}

export interface Customer {
  id: number;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
}


interface CartState {
  items: CartItem[];
  customer: Customer | null;
  globalDiscount: number; // Descuento total final ($)
  addItem: (item: Omit<CartItem, 'cartItemId' | 'cantidad' | 'descuento'>, cantidad?: number) => boolean;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, cantidad: number) => boolean;
  updateDiscount: (cartItemId: string, descuento: number) => void;
  setGlobalDiscount: (discount: number) => void;
  setCustomer: (customer: Customer | null) => void;
  clearCart: () => void;
  getTotals: () => {
    subtotal: number;
    descuento: number;
    total: number;
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  globalDiscount: 0,

  addItem: (item, cantidad = 1) => {
    const isProduct = !!item.productId;
    const cartItemId = isProduct ? `p-${item.productId}` : `s-${item.serviceId}`;
    const currentItems = get().items;
    
    const existingIndex = currentItems.findIndex(i => i.cartItemId === cartItemId);

    if (existingIndex > -1) {
      const existingItem = currentItems[existingIndex];
      const newQty = existingItem.cantidad + cantidad;

      // Validar stock si es producto
      if (isProduct && existingItem.stock !== undefined && newQty > existingItem.stock) {
        return false; // No hay suficiente stock
      }

      const updatedItems = [...currentItems];
      updatedItems[existingIndex] = {
        ...existingItem,
        cantidad: newQty
      };
      set({ items: updatedItems });
      return true;
    } else {
      // Validar stock inicial si es producto
      if (isProduct && item.stock !== undefined && cantidad > item.stock) {
        return false; // Excede existencias
      }

      const newItem: CartItem = {
        ...item,
        cartItemId,
        cantidad,
        descuento: 0
      };
      set({ items: [...currentItems, newItem] });
      return true;
    }
  },

  removeItem: (cartItemId) => {
    set({ items: get().items.filter(i => i.cartItemId !== cartItemId) });
  },

  updateQuantity: (cartItemId, cantidad) => {
    if (cantidad <= 0) return false;
    
    const currentItems = get().items;
    const index = currentItems.findIndex(i => i.cartItemId === cartItemId);
    
    if (index === -1) return false;
    
    const item = currentItems[index];
    if (item.productId && item.stock !== undefined && cantidad > item.stock) {
      return false; // Stock insuficiente
    }

    const updatedItems = [...currentItems];
    updatedItems[index] = { ...item, cantidad };
    set({ items: updatedItems });
    return true;
  },

  updateDiscount: (cartItemId, descuento) => {
    if (descuento < 0) return;
    
    const currentItems = get().items;
    const index = currentItems.findIndex(i => i.cartItemId === cartItemId);
    
    if (index === -1) return;
    
    const item = currentItems[index];
    if (descuento > item.precio) return; // El descuento no puede exceder el precio

    const updatedItems = [...currentItems];
    updatedItems[index] = { ...item, descuento };
    set({ items: updatedItems });
  },

  setGlobalDiscount: (discount) => {
    if (discount < 0) return;
    set({ globalDiscount: discount });
  },

  setCustomer: (customer) => set({ customer }),

  clearCart: () => set({ items: [], customer: null, globalDiscount: 0 }),

  getTotals: () => {
    const items = get().items;
    const subtotal = items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    const itemDiscounts = items.reduce((acc, item) => acc + (item.descuento * item.cantidad), 0);
    const globalDiscount = get().globalDiscount;
    
    const totalDescuento = itemDiscounts + globalDiscount;
    const total = Math.max(0, subtotal - totalDescuento);

    return {
      subtotal,
      descuento: totalDescuento,
      total
    };
  }
}));
