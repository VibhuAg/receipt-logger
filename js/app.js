// Main app logic, routing, state management

const App = {
  data: null,
  currentView: null,

  async init() {
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
    let parsed = { storeName: '', items: [], date: '' };
    if (this._pendingParsed) {
      parsed = this._pendingParsed;
      this._pendingParsed = null;
    }
    const existingStores = this.data.stores.map(s => s.name);
    UI.renderNewReceipt(parsed, existingStores);
  },

  showSearch() {
    UI.renderSearch(this.data);
  },

  // --- OCR ---

  async ocrFromImage(imageFile) {
    const worker = await Tesseract.createWorker('eng');
    // PSM 4 = single column of text (receipt layout)
    await worker.setParameters({ tessedit_pageseg_mode: '4' });
    const { data } = await worker.recognize(imageFile);
    await worker.terminate();
    return data.text;
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
