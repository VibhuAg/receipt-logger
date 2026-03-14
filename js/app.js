// Main app logic, routing, state management

const App = {
  data: null,
  currentView: null,

  async init() {
    // Check for OCR text in URL params
    const params = new URLSearchParams(window.location.search);
    const ocrText = params.get('text');

    if (ocrText) {
      // Clear the URL param so refreshing doesn't re-trigger
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    if (!Storage.isConfigured()) {
      UI.renderSetup();
      return;
    }

    try {
      UI.showLoading();
      this.data = await Storage.loadData();
    } catch (e) {
      UI.showError('Failed to load data: ' + e.message);
      return;
    }

    if (ocrText) {
      window.location.hash = '#/new';
      // Store OCR text temporarily so the new receipt view can use it
      this._pendingOCRText = ocrText;
    }

    this.setupRouting();
    this.navigate();
  },

  setupRouting() {
    window.addEventListener('hashchange', () => this.navigate());
  },

  navigate() {
    const hash = window.location.hash || '#/';

    if (hash === '#/') {
      this.showStoreList();
    } else if (hash === '#/new') {
      this.showNewReceipt();
    } else if (hash === '#/search') {
      this.showSearch();
    } else if (hash.startsWith('#/store/')) {
      const id = hash.replace('#/store/', '');
      this.showStoreDetail(id);
    } else if (hash.startsWith('#/receipt/')) {
      const parts = hash.replace('#/receipt/', '').split('/');
      this.showReceiptDetail(parts[0], parts[1]);
    } else if (hash === '#/settings') {
      UI.renderSettings();
    } else {
      this.showStoreList();
    }
  },

  // --- Views ---

  showStoreList() {
    const stores = this.data.stores.map(s => ({
      ...s,
      receiptCount: s.receipts.length,
      itemCount: s.receipts.reduce((sum, r) => sum + r.items.length, 0),
    }));
    UI.renderStoreList(stores);
  },

  showStoreDetail(storeId) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) {
      window.location.hash = '#/';
      return;
    }
    // Sort receipts by date descending
    const sorted = [...store.receipts].sort((a, b) => b.date.localeCompare(a.date));
    UI.renderStoreDetail(store, sorted);
  },

  showReceiptDetail(storeId, receiptId) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) { window.location.hash = '#/'; return; }
    const receipt = store.receipts.find(r => r.id === receiptId);
    if (!receipt) { window.location.hash = `#/store/${storeId}`; return; }
    UI.renderReceiptDetail(store, receipt);
  },

  showNewReceipt() {
    let parsed = { storeName: '', items: [] };
    if (this._pendingOCRText) {
      parsed = Parser.parse(this._pendingOCRText);
      this._pendingOCRText = null;
    }
    const existingStores = this.data.stores.map(s => s.name);
    UI.renderNewReceipt(parsed, existingStores);
  },

  showSearch() {
    UI.renderSearch(this.data);
  },

  // --- Data mutations ---

  async saveReceipt(storeName, date, items) {
    let store = this.data.stores.find(
      s => s.name.toLowerCase() === storeName.toLowerCase()
    );

    if (!store) {
      store = { id: crypto.randomUUID(), name: storeName, receipts: [] };
      this.data.stores.push(store);
    }

    const receipt = {
      id: crypto.randomUUID(),
      date: date,
      items: items.map(item => ({
        id: item.id || crypto.randomUUID(),
        receiptName: item.receiptName,
        realName: item.realName || '',
        price: parseFloat(item.price) || 0,
      })),
    };

    store.receipts.push(receipt);
    await Storage.saveData(this.data);
    window.location.hash = `#/receipt/${store.id}/${receipt.id}`;
  },

  async updateStoreName(storeId, newName) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) return;
    store.name = newName;
    await Storage.saveData(this.data);
  },

  async updateReceiptDate(storeId, receiptId, newDate) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) return;
    const receipt = store.receipts.find(r => r.id === receiptId);
    if (!receipt) return;
    receipt.date = newDate;
    await Storage.saveData(this.data);
  },

  async updateItem(storeId, receiptId, itemId, field, value) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) return;
    const receipt = store.receipts.find(r => r.id === receiptId);
    if (!receipt) return;
    const item = receipt.items.find(i => i.id === itemId);
    if (!item) return;

    if (field === 'price') {
      item[field] = parseFloat(value) || 0;
    } else {
      item[field] = value;
    }
    await Storage.saveData(this.data);
  },

  async addItemToReceipt(storeId, receiptId) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) return;
    const receipt = store.receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const newItem = {
      id: crypto.randomUUID(),
      receiptName: '',
      realName: '',
      price: 0,
    };
    receipt.items.push(newItem);
    await Storage.saveData(this.data);
    return newItem;
  },

  async deleteItem(storeId, receiptId, itemId) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) return;
    const receipt = store.receipts.find(r => r.id === receiptId);
    if (!receipt) return;
    receipt.items = receipt.items.filter(i => i.id !== itemId);
    await Storage.saveData(this.data);
  },

  async deleteReceipt(storeId, receiptId) {
    const store = this.data.stores.find(s => s.id === storeId);
    if (!store) return;
    store.receipts = store.receipts.filter(r => r.id !== receiptId);
    // If store has no receipts, remove the store too
    if (store.receipts.length === 0) {
      this.data.stores = this.data.stores.filter(s => s.id !== storeId);
      await Storage.saveData(this.data);
      window.location.hash = '#/';
    } else {
      await Storage.saveData(this.data);
      window.location.hash = `#/store/${storeId}`;
    }
  },

  async deleteStore(storeId) {
    this.data.stores = this.data.stores.filter(s => s.id !== storeId);
    await Storage.saveData(this.data);
  },

  // --- Setup ---

  async setupWithToken(token) {
    Storage.setToken(token);
    try {
      UI.showLoading();
      this.data = await Storage.createGist();
      this.setupRouting();
      this.showStoreList();
    } catch (e) {
      Storage.clearConfig();
      UI.showError('Failed to create gist: ' + e.message);
    }
  },

  async connectExistingGist(token, gistId) {
    Storage.setToken(token);
    Storage.setGistId(gistId);
    try {
      UI.showLoading();
      this.data = await Storage.loadData();
      this.setupRouting();
      this.showStoreList();
    } catch (e) {
      Storage.clearConfig();
      UI.showError('Failed to load gist: ' + e.message);
    }
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
