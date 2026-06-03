import { create } from 'zustand';

export interface CashRegister {
  id: number;
  userId: number;
  fechaApertura: string;
  fechaCierre: string | null;
  montoInicial: number;
  ventasEfectivo: number;
  ventasTarjeta: number;
  ventasTransf: number;
  ingresos: number;
  egresos: number;
  totalEsperado: number;
  totalContado: number | null;
  diferencia: number | null;
  estado: 'ABIERTA' | 'CERRADA';
}

interface CashState {
  activeRegister: CashRegister | null;
  isOpen: boolean;
  setRegister: (register: CashRegister | null) => void;
  clearRegister: () => void;
}

export const useCashStore = create<CashState>((set) => ({
  activeRegister: (() => {
    const saved = localStorage.getItem('active_cash_register');
    return saved ? JSON.parse(saved) : null;
  })(),
  isOpen: localStorage.getItem('active_cash_register') !== null,
  setRegister: (register) => {
    if (register) {
      localStorage.setItem('active_cash_register', JSON.stringify(register));
      set({ activeRegister: register, isOpen: true });
    } else {
      localStorage.removeItem('active_cash_register');
      set({ activeRegister: null, isOpen: false });
    }
  },
  clearRegister: () => {
    localStorage.removeItem('active_cash_register');
    set({ activeRegister: null, isOpen: false });
  }
}));
