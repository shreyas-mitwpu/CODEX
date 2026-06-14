// Save all data to localStorage after each action
export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(`factorymind_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error("Error saving to localStorage", e);
  }
};

// Load data on app start
export const loadFromLocalStorage = (key, fallbackData) => {
  try {
    const item = localStorage.getItem(`factorymind_${key}`);
    return item ? JSON.parse(item) : fallbackData;
  } catch (e) {
    console.error("Error loading from localStorage", e);
    return fallbackData;
  }
};

// Data stores keys
export const DATA_STORES = {
  factories: 'factories',
  stock: 'stock_levels',
  orders: 'production_orders',
  suppliers: 'supplier_directory',
  maintenance: 'maintenance_log',
  workers: 'worker_shifts',
  settings: 'app_settings'
};
