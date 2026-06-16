import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../store/cartStore';
import { useSessionStore } from '../store/sessionStore';
import { useCashStore } from '../store/cashStore';
import { 
  Search, 
  Trash2, 
  Tag, 
  UserPlus, 
  FolderOpen, 
  X, 
  Check, 
  Calculator, 
  Printer, 
  CreditCard,
  Banknote,
  RefreshCcw,
  Sparkles,
  ShoppingBag
} from 'lucide-react';

interface Product {
  id: number;
  nombre: string;
  codigoBarras: string | null;
  sku: string | null;
  precioVenta: string;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  category: { name: string };
}

interface Service {
  id: number;
  nombre: string;
  precio: string;
  unidad: string;
  activo: boolean;
}

interface Customer {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
}

export default function POS() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore(state => state.user);
  const { activeRegister, isOpen: isCashOpen } = useCashStore();

  // Zustand Cart Store
  const { 
    items: cartItems, 
    customer: cartCustomer,
    globalDiscount,
    addItem: addItemToCart,
    removeItem: removeItemFromCart,
    updateQuantity: updateCartQty,
    setGlobalDiscount,
    setCustomer: setCartCustomer,
    clearCart,
    getTotals
  } = useCartStore();

  const { subtotal, descuento: totalDiscount, total } = getTotals();

  // Estados de control
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  
  // Modales adicionales
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [suspendedSalesList, setSuspendedSalesList] = useState<any[]>([]);

  // Estados de Pago
  const [formaPago, setFormaPago] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'MIXTO'>('EFECTIVO');
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoTarjeta, setMontoTarjeta] = useState('');
  const [montoTransf, setMontoTransf] = useState('');
  const [cambio, setCambio] = useState(0);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Referencias para atajos
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Consultar Productos
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-pos'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/products');
      if (!res.ok) throw new Error('Error al obtener productos');
      return res.json();
    }
  });

  // Consultar Servicios Activos
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services-pos'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/services');
      if (!res.ok) throw new Error('Error al obtener servicios');
      return res.json();
    }
  });

  // Consultar Clientes
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-pos'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/customers');
      if (!res.ok) throw new Error('Error al obtener clientes');
      return res.json();
    }
  });

  // Cargar Configuraciones del Negocio para el Ticket
  const { data: businessSettings } = useQuery({
    queryKey: ['business-settings-pos'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/settings');
      return res.json();
    }
  });

  // --- ATAJOS DE TECLADO ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleOpenCheckout();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleSuspendSale();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (confirm('¿Deseas vaciar el carrito?')) {
          clearCart();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems]);

  // Cargar Cotizaciones
  const loadSuspendedSales = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/sales/quotations');
      const data = await res.json();
      setSuspendedSalesList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSuspendedSales();
  }, []);

  // Calcular Cambio Efectivo en tiempo real
  useEffect(() => {
    if (formaPago === 'EFECTIVO') {
      const recibido = parseFloat(montoEfectivo || '0');
      setCambio(Math.max(0, recibido - total));
    } else {
      setCambio(0);
    }
  }, [montoEfectivo, total, formaPago]);

  const handleOpenCheckout = () => {
    if (!isCashOpen) {
      alert('Debes abrir caja para poder realizar cobros.');
      return;
    }
    setCheckoutError('');
    setCheckoutSuccess(false);
    setMontoEfectivo('');
    setMontoTarjeta('');
    setMontoTransf('');
    setFormaPago('EFECTIVO');
    setShowCheckout(true);
  };

  // Buscar Producto por Código de Barras (Escáner automático)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    // Buscar coincidencia exacta por código de barras o SKU
    const matched = products.find(p => 
      p.activo && (p.codigoBarras === searchQuery || p.sku === searchQuery)
    );

    if (matched) {
      const added = addItemToCart({
        productId: matched.id,
        nombre: matched.nombre,
        precio: parseFloat(matched.precioVenta),
        stock: matched.stock,
        unidad: 'pza'
      });
      if (!added) {
        alert('Stock insuficiente para este producto.');
      }
      setSearchQuery('');
    }
  };

  // Filtrado rápido de productos por buscador manual
  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchQuery = searchQuery === '' || 
      p.nombre.toLowerCase().includes(query) ||
      p.codigoBarras?.includes(query) ||
      p.sku?.toLowerCase().includes(query);
    
    const matchCat = selectedCategory === '' || p.category.name === selectedCategory;
    return p.activo && matchQuery && matchCat;
  });

  const handleAddProductClick = (p: Product) => {
    const added = addItemToCart({
      productId: p.id,
      nombre: p.nombre,
      precio: parseFloat(p.precioVenta),
      stock: p.stock,
      unidad: 'pza'
    });
    if (!added) {
      alert('Existencias agotadas o insuficientes en bodega.');
    }
  };

  const handleAddServiceClick = (s: Service) => {
    addItemToCart({
      serviceId: s.id,
      nombre: s.nombre,
      precio: parseFloat(s.precio),
      unidad: s.unidad
    });
  };

  // Abrir modal de cotización
  const handleSuspendSale = () => {
    confirmSuspendSale(); // Directamente cotiza sin pedir nombre (usa el cliente seleccionado)
  };

  // Confirmar cotización
  const confirmSuspendSale = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems,
          isQuotation: true,
          formaPago: 'COTIZACION',
          userId: currentUser?.id,
          customerId: cartCustomer?.id || null,
          descuento: totalDiscount
        })
      });
      if (res.ok) {
        clearCart();
        loadSuspendedSales();
      } else {
        alert('Error al generar la cotización');
      }
    } catch (err) {
      alert('Error de red al cotizar');
    }
  };

  // Recuperar Cotización
  const handleRecoverSale = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3001/api/sales/quotations/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // Encontrar la cotización en la lista local para cargar sus items
        const recovered = suspendedSalesList.find(s => s.id === id);
        if (recovered) {
          clearCart();
          if (recovered.customer) setCartCustomer(recovered.customer);
          const stockInsuficiente: string[] = [];
          recovered.items.forEach((item: any) => {
            const currentStock = item.productId
              ? (products.find(p => p.id === item.productId)?.stock ?? 0)
              : 99999; // servicios no tienen stock físico
            const added = addItemToCart({
              productId: item.productId,
              serviceId: item.serviceId,
              nombre: item.nombre,
              precio: item.precio,
              stock: currentStock,
              unidad: 'pza'
            }, item.cantidad);
            if (!added) stockInsuficiente.push(item.nombre);
          });
          if (stockInsuficiente.length > 0) {
            alert(`Stock insuficiente para: ${stockInsuficiente.join(', ')}. Se cargó la cotización con las cantidades disponibles.`);
          }
        }
        setShowSuspendedModal(false);
        loadSuspendedSales();
      }
    } catch (err) {
      alert('Error de red al cargar cotización');
    }
  };

  // Procesar Transacción de Cobro Final
  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    setCheckoutSuccess(false);

    if (formaPago === 'MIXTO') {
      const sumMixto = parseFloat(montoEfectivo || '0') + parseFloat(montoTarjeta || '0') + parseFloat(montoTransf || '0');
      if (sumMixto < total - 0.01) {
        setCheckoutError(`Los montos ingresados suman $${sumMixto.toFixed(2)}, faltan $${(total - sumMixto).toFixed(2)} para cubrir el total.`);
        return;
      }
    }

    const payload = {
      userId: currentUser?.id,
      customerId: cartCustomer?.id || null,
      items: cartItems,
      descuento: totalDiscount,
      formaPago,
      montoEfectivo: formaPago === 'EFECTIVO' ? total : (formaPago === 'MIXTO' ? parseFloat(montoEfectivo || '0') : 0),
      montoTarjeta: formaPago === 'TARJETA' ? total : (formaPago === 'MIXTO' ? parseFloat(montoTarjeta || '0') : 0),
      montoTransf: formaPago === 'TRANSFERENCIA' ? total : (formaPago === 'MIXTO' ? parseFloat(montoTransf || '0') : 0)
    };

    try {
      const response = await fetch('http://localhost:3001/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        setCheckoutError(result.error || 'Error al completar la venta.');
        return;
      }

      setCheckoutSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['products-pos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['cashRegisterStatus'] });
      queryClient.invalidateQueries({ queryKey: ['shiftSales'] });
      
      // --- IMPRESIÓN SILENCIOSA DEL TICKET EN ELECTRON ---
      if ((window as any).electronAPI) {
        const ticketHTML = generateTicketHTML(result);
        const printRes = await (window as any).electronAPI.printTicketSilent(ticketHTML);
        if (!printRes.success) {
          console.warn('La impresión silenciosa falló:', printRes.error);
        }
      }

      // Limpiar y salir
      setTimeout(() => {
        clearCart();
        setShowCheckout(false);
      }, 1500);

    } catch (err) {
      setCheckoutError('Error de conexión con la base de datos local al guardar.');
    }
  };

  // Generador de ticket térmico HTML de 80mm
  const generateTicketHTML = (saleData: any) => {
    const cleanItems = saleData.items.map((it: any) => `
      <tr>
        <td style="padding: 4px 0; text-align: left;">${it.nombre} x${it.cantidad}</td>
        <td style="padding: 4px 0; text-align: right;">$${(parseFloat(it.precio) * it.cantidad).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <html>
        <head>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 80mm;
              font-size: 12px;
              margin: 0;
              padding: 10px;
              color: #000;
              background: #fff;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .totals-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            .items-table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <span class="bold" style="font-size: 16px;">${businessSettings?.nombreNegocio || 'Punto Escolar'}</span><br/>
            ${businessSettings?.rfc ? `RFC: ${businessSettings.rfc}<br/>` : ''}
            ${businessSettings?.direccion ? `${businessSettings.direccion}<br/>` : ''}
            ${businessSettings?.telefono ? `Tel: ${businessSettings.telefono}<br/>` : ''}
          </div>
          <div class="divider"></div>
          <div>
            <b>Folio:</b> ${saleData.folio}<br/>
            <b>Fecha:</b> ${new Date(saleData.fecha).toLocaleString()}<br/>
            <b>Atendido por:</b> ${currentUser?.username}<br/>
            <b>Cliente:</b> ${cartCustomer?.nombre || 'Público General'}<br/>
          </div>
          <div class="divider"></div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left;">Articulo</th>
                <th style="text-align: right;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${cleanItems}
            </tbody>
          </table>
          <div class="divider"></div>
          <table class="totals-table">
            <tr>
              <td class="bold">Subtotal:</td>
              <td style="text-align: right;">$${parseFloat(saleData.subtotal).toFixed(2)}</td>
            </tr>
            ${parseFloat(saleData.descuento) > 0 ? `
            <tr>
              <td class="bold">Descuento:</td>
              <td style="text-align: right;">-$${parseFloat(saleData.descuento).toFixed(2)}</td>
            </tr>` : ''}
            <tr style="font-size: 14px;">
              <td class="bold">TOTAL:</td>
              <td class="bold" style="text-align: right;">$${parseFloat(saleData.total).toFixed(2)}</td>
            </tr>
          </table>
          <div class="divider"></div>
          <div class="text-center bold" style="margin-top: 15px;">
            ${businessSettings?.mensajeTicket || '¡Gracias por su compra!'}
          </div>
        </body>
      </html>
    `;
  };

  const categoriesSet = new Set(products.map(p => p.category.name));
  const uniqueCategories = Array.from(categoriesSet);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      
      {/* PANEL IZQUIERDO: BÚSQUEDA Y SERVICIOS */}
      <div className="w-[60%] p-4 flex flex-col h-full border-r space-y-4 overflow-hidden">
        {/* Buscador inteligente */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="F1: Escanear código o buscar por nombre..."
              className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Rubros</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </form>

        {/* Panel mixto: Resultados / Servicios */}
        <div className="flex-1 grid grid-rows-2 gap-4 overflow-hidden">
          
          {/* Fila 1: Lista de Productos en Grid */}
          <div className="border rounded-2xl p-4 bg-card flex flex-col overflow-hidden">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 shrink-0">
              <Sparkles size={14} className="text-blue-500" /> Productos Disponibles
              {filteredProducts.length > 0 && (
                <span className="ml-auto font-normal text-[10px] text-muted-foreground">
                  {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <div className="overflow-y-auto flex-1 grid grid-cols-3 gap-3 pr-1">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAddProductClick(p)}
                  className="p-3 text-left border rounded-xl bg-background hover:border-blue-500 hover:shadow-sm active:scale-[0.97] transition-all flex flex-col justify-between"
                >
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 line-clamp-2">{p.nombre}</span>
                  <div className="mt-2 flex justify-between items-end">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.stock <= p.stockMinimo ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-600'}`}>
                      Stock: {p.stock}
                    </span>
                    <span className="font-bold text-sm text-blue-600 dark:text-blue-400">${parseFloat(p.precioVenta).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Fila 2: Botonera Táctil de Servicios Rápidos */}
          <div className="border rounded-2xl p-4 bg-card flex flex-col overflow-hidden">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 shrink-0">
              <Calculator size={14} className="text-purple-500" /> Centros de Copiado y Servicios
            </h2>
            <div className="overflow-y-auto flex-1 grid grid-cols-4 gap-3 pr-1">
              {services.filter(s => s.activo).map(s => (
                <button
                  key={s.id}
                  onClick={() => handleAddServiceClick(s)}
                  className="p-3 border rounded-xl bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/15 hover:border-purple-500 text-left active:scale-[0.97] transition-all flex flex-col justify-between"
                >
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 leading-tight">{s.nombre}</span>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[10px] text-purple-600 font-bold uppercase">{s.unidad}</span>
                    <span className="font-bold text-sm text-purple-600 dark:text-purple-400">${parseFloat(s.precio).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Barra de atajos rápida */}
        <div className="flex gap-4 text-xs text-muted-foreground border-t pt-3 font-semibold shrink-0">
          <div className="flex items-center gap-1"><span className="border px-1.5 py-0.5 rounded bg-muted font-mono font-bold">F1</span> Buscar</div>
          <div className="flex items-center gap-1"><span className="border px-1.5 py-0.5 rounded bg-muted font-mono font-bold">F2</span> Cobrar</div>
          <div className="flex items-center gap-1"><span className="border px-1.5 py-0.5 rounded bg-muted font-mono font-bold">F3</span> Cotizar</div>
          <div className="flex items-center gap-1"><span className="border px-1.5 py-0.5 rounded bg-muted font-mono font-bold">F4</span> Vaciar</div>
        </div>
      </div>

      {/* PANEL DERECHO: CARRITO Y ACCIONES */}
      <div className="w-[40%] p-4 flex flex-col h-full bg-card border-l overflow-hidden">
        
        {/* Cliente / Recuperación */}
        <div className="flex gap-2 mb-3 items-center shrink-0">
          <div className="flex-1 flex items-center border rounded-xl px-3 py-2 bg-background justify-between">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-muted-foreground" />
              <span className="text-xs font-semibold truncate max-w-[150px]">
                {cartCustomer ? cartCustomer.nombre : 'Cliente Genérico'}
              </span>
            </div>
            {cartCustomer ? (
              <button onClick={() => setCartCustomer(null)} className="text-red-500 hover:bg-red-500/10 p-0.5 rounded">
                <X size={14} />
              </button>
            ) : (
              <button 
                onClick={() => setShowCustomerModal(true)} 
                className="text-xs text-blue-500 font-bold hover:underline"
              >
                Asignar
              </button>
            )}
          </div>

          <button
            onClick={() => setShowSuspendedModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-xl hover:bg-accent text-xs font-bold"
          >
            <FolderOpen size={14} />
            Cotizaciones ({suspendedSalesList.length})
          </button>
        </div>

        {/* Listado del Carrito */}
        <div className="flex-1 overflow-y-auto divide-y pr-1">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-10 space-y-2">
              <ShoppingBag size={40} className="stroke-[1.5]" />
              <p className="text-sm font-semibold">El carrito de compras está vacío</p>
            </div>
          ) : (
            cartItems.map(item => (
              <div key={item.cartItemId} className="py-3 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <span className="font-semibold text-xs leading-tight block">{item.nombre}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    P. Unitario: ${item.precio.toFixed(2)} | Uds: {item.unidad}
                  </span>
                </div>
                
                {/* Cantidad e importe */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                    <button 
                      onClick={() => updateCartQty(item.cartItemId, item.cantidad - 1)}
                      className="px-2 py-0.5 hover:bg-accent text-xs font-bold"
                    >-</button>
                    <span className="px-3 text-xs font-bold font-mono">{item.cantidad}</span>
                    <button 
                      onClick={() => {
                        const success = updateCartQty(item.cartItemId, item.cantidad + 1);
                        if (!success) alert('No hay más inventario disponible.');
                      }}
                      className="px-2 py-0.5 hover:bg-accent text-xs font-bold"
                    >+</button>
                  </div>
                  
                  <div className="w-16 text-right font-bold text-xs">
                    ${(item.precio * item.cantidad).toFixed(2)}
                  </div>

                  <button 
                    onClick={() => removeItemFromCart(item.cartItemId)}
                    className="text-red-500 hover:bg-red-500/10 p-1 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales y Checkout */}
        <div className="border-t pt-4 space-y-4 shrink-0 bg-card">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            
            {/* Descuento global */}
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Tag size={14} /> Descuento:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="$"
                  className="w-16 text-right px-1.5 py-0.5 border rounded text-xs font-semibold focus:outline-none"
                  value={globalDiscount || ''}
                  onChange={(e) => setGlobalDiscount(parseFloat(e.target.value || '0'))}
                />
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold pt-1.5 border-t">
              <span>TOTAL NETO:</span>
              <span className="text-xl text-blue-600 dark:text-blue-400 font-outfit">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSuspendSale}
              disabled={cartItems.length === 0}
              className="py-2.5 border rounded-xl hover:bg-accent text-xs font-bold transition-all disabled:opacity-50 text-blue-600 border-blue-600/30 bg-blue-600/5 hover:bg-blue-600/10"
            >
              F3: Cotización
            </button>
            <button
              onClick={handleOpenCheckout}
              disabled={cartItems.length === 0}
              className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/15 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Check size={14} /> F2: Cobrar Caja
            </button>
          </div>
        </div>

      </div>

      {/* MODAL CHECKOUT / COBRO */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <button 
              onClick={() => setShowCheckout(false)} 
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-bold font-outfit mb-2 flex items-center gap-2">
              <Calculator className="text-blue-500" />
              Procesar Cobro de Venta
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Folio secuencial automático | Caja abierta: #{activeRegister?.id}</p>

            {checkoutError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {checkoutError}
              </div>
            )}

            {checkoutSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold text-center flex items-center justify-center gap-2">
                <Printer className="animate-bounce" size={16} />
                ¡Venta procesada! Imprimiendo ticket...
              </div>
            )}

            <form onSubmit={handleProcessCheckout} className="space-y-4">
              {/* Selector de Método de Pago */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Forma de Pago</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'EFECTIVO', name: 'Efectivo', icon: Banknote },
                    { id: 'TARJETA', name: 'Tarjeta', icon: CreditCard },
                    { id: 'TRANSFERENCIA', name: 'Transf.', icon: RefreshCcw },
                    { id: 'MIXTO', name: 'Mixto', icon: Sparkles }
                  ].map(m => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setFormaPago(m.id as any);
                          setMontoEfectivo('');
                          setMontoTarjeta('');
                          setMontoTransf('');
                        }}
                        className={`py-3 px-2 border rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${formaPago === m.id ? 'border-blue-500 bg-blue-500/5 text-blue-600' : 'hover:bg-accent'}`}
                      >
                        <Icon size={18} />
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contenedor dinámico según forma de pago */}
              <div className="p-4 border rounded-2xl bg-muted/20 space-y-4">
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="font-semibold text-muted-foreground">Total a Cobrar:</span>
                  <span className="text-xl font-extrabold font-outfit text-blue-600 dark:text-blue-400">${total.toFixed(2)}</span>
                </div>

                {formaPago === 'EFECTIVO' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-500">Monto Recibido</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl border bg-background text-lg font-bold font-mono focus:ring-2 focus:ring-blue-500/50"
                      value={montoEfectivo}
                      onChange={(e) => setMontoEfectivo(e.target.value)}
                      required
                    />
                    
                    {/* Cambio */}
                    <div className="mt-4 flex justify-between items-center p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                      <span className="text-xs font-bold text-blue-600">Cambio a Entregar:</span>
                      <span className="text-2xl font-black font-outfit text-blue-600">${cambio.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {formaPago === 'TARJETA' && (
                  <p className="text-xs text-muted-foreground">Desliza o inserta la tarjeta en la terminal bancaria local y procesa el cobro por <b>${total.toFixed(2)}</b>.</p>
                )}

                {formaPago === 'TRANSFERENCIA' && (
                  <p className="text-xs text-muted-foreground">Confirma la transferencia electrónica interbancaria SPEI en tu banca por un valor total de <b>${total.toFixed(2)}</b>.</p>
                )}

                {formaPago === 'MIXTO' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-500">Monto Efectivo ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono font-bold"
                        value={montoEfectivo}
                        onChange={(e) => setMontoEfectivo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-500">Monto Tarjeta ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono font-bold"
                        value={montoTarjeta}
                        onChange={(e) => setMontoTarjeta(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-500">Monto Transferencia ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono font-bold"
                        value={montoTransf}
                        onChange={(e) => setMontoTransf(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="px-5 py-2.5 border rounded-xl hover:bg-accent text-sm font-semibold"
                >
                  Regresar
                </button>
                <button
                  type="submit"
                  disabled={checkoutSuccess}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/15"
                >
                  <Check size={16} /> Confirmar Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASIGNAR CLIENTE */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150 flex flex-col max-h-[400px]">
            <h2 className="text-xl font-bold font-outfit mb-3">Vincular Cliente</h2>
            <div className="overflow-y-auto flex-1 divide-y border rounded-xl bg-muted/10">
              {customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCartCustomer(c);
                    setShowCustomerModal(false);
                  }}
                  className="w-full p-3 text-left hover:bg-accent text-sm flex justify-between items-center"
                >
                  <div>
                    <span className="font-semibold block">{c.nombre}</span>
                    <span className="text-[10px] text-muted-foreground">{c.telefono || 'Sin teléfono'}</span>
                  </div>
                  <Check size={16} className="text-blue-500 opacity-0 hover:opacity-100" />
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => setShowCustomerModal(false)} className="px-4 py-2 border rounded-xl hover:bg-accent text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECUPERAR VENTAS SUSPENDIDAS */}
      {showSuspendedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150 flex flex-col max-h-[450px]">
            <h2 className="text-xl font-bold font-outfit mb-3">Ventas Suspendidas en Espera</h2>
            
            <div className="overflow-y-auto flex-1 border rounded-xl divide-y bg-muted/10">
              {suspendedSalesList.length === 0 ? (
                <p className="text-sm text-muted-foreground p-8 text-center">No hay carritos en espera.</p>
              ) : (
                suspendedSalesList.map(s => (
                  <div key={s.id} className="p-3 flex justify-between items-center text-sm">
                    <div>
                      <span className="font-semibold block">{s.clienteNombre}</span>
                      <span className="text-[10px] text-muted-foreground">Productos: {s.items.length} | {new Date(s.fecha).toLocaleTimeString()}</span>
                    </div>
                    <button
                      onClick={() => handleRecoverSale(s.id)}
                      className="px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Cargar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 shrink-0">
              <button onClick={() => setShowSuspendedModal(false)} className="px-4 py-2 border rounded-xl hover:bg-accent text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
