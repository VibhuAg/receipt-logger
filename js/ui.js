// DOM manipulation and view rendering

const UI = {
  get root() {
    return document.getElementById('app');
  },

  showLoading() {
    this.root.innerHTML = '<div class="loading">Loading...</div>';
  },

  showError(msg) {
    this.root.innerHTML = `<div class="error-msg">${this._esc(msg)}<br><button onclick="location.reload()">Retry</button></div>`;
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _formatPrice(price) {
    return '$' + (parseFloat(price) || 0).toFixed(2);
  },

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}/${y}`;
  },

  // --- Setup ---

  renderSetup() {
    this.root.innerHTML = `
      <div class="setup-view">
        <h1>Receipt Logger</h1>
        <p>Connect to GitHub to store your data.</p>

        <div class="setup-section">
          <label for="setup-token">GitHub Personal Access Token</label>
          <input type="password" id="setup-token" placeholder="ghp_..." autocomplete="off">
          <p class="hint">Create at GitHub → Settings → Developer settings → Personal access tokens. Needs <strong>gist</strong> scope only.</p>
        </div>

        <div class="setup-section">
          <label for="setup-gist-id">Existing Gist ID (optional)</label>
          <input type="text" id="setup-gist-id" placeholder="Leave blank to create new">
          <p class="hint">If you've used this app before, enter your Gist ID to reconnect.</p>
        </div>

        <button class="btn-primary" id="setup-btn">Connect</button>
      </div>
    `;

    document.getElementById('setup-btn').addEventListener('click', () => {
      const token = document.getElementById('setup-token').value.trim();
      const gistId = document.getElementById('setup-gist-id').value.trim();
      if (!token) { alert('Please enter a token'); return; }

      if (gistId) {
        App.connectExistingGist(token, gistId);
      } else {
        App.setupWithToken(token);
      }
    });
  },

  renderSettings() {
    const gistId = Storage.getGistId() || '';
    this.root.innerHTML = `
      <div class="view">
        <div class="nav-bar">
          <button class="back-btn" onclick="history.back()">← Back</button>
          <h2>Settings</h2>
          <div></div>
        </div>
        <div class="settings-content">
          <div class="setting-row">
            <label>Gist ID</label>
            <code>${this._esc(gistId)}</code>
            <p class="hint">Save this ID to reconnect from another browser.</p>
          </div>
          <button class="btn-danger" id="disconnect-btn">Disconnect & Clear Local Data</button>
        </div>
      </div>
    `;

    document.getElementById('disconnect-btn').addEventListener('click', () => {
      if (confirm('This will clear your local settings. Your data remains in the Gist. Continue?')) {
        Storage.clearConfig();
        location.reload();
      }
    });
  },

  // --- Store List ---

  renderStoreList(stores) {
    const storeItems = stores.length === 0
      ? '<div class="empty-state">No stores yet. Scan a receipt to get started!</div>'
      : stores.map(s => `
        <div class="list-item" onclick="window.location.hash='#/store/${s.id}'">
          <div class="list-item-content">
            <div class="list-item-title">${this._esc(s.name)}</div>
            <div class="list-item-sub">${s.receiptCount} receipt${s.receiptCount !== 1 ? 's' : ''} · ${s.itemCount} item${s.itemCount !== 1 ? 's' : ''}</div>
          </div>
          <span class="chevron">›</span>
        </div>
      `).join('');

    this.root.innerHTML = `
      <div class="view">
        <div class="nav-bar">
          <div></div>
          <h2>Stores</h2>
          <button class="icon-btn" onclick="window.location.hash='#/settings'" title="Settings">⚙</button>
        </div>
        <div class="tab-bar">
          <button class="tab active" onclick="window.location.hash='#/'">Stores</button>
          <button class="tab" onclick="window.location.hash='#/new'">Scan</button>
          <button class="tab" onclick="window.location.hash='#/search'">Search</button>
        </div>
        <div class="list">${storeItems}</div>
      </div>
    `;
  },

  // --- Store Detail ---

  renderStoreDetail(store, receipts) {
    const receiptItems = receipts.length === 0
      ? '<div class="empty-state">No receipts for this store.</div>'
      : receipts.map(r => {
        const total = r.items.reduce((s, i) => s + (i.price || 0), 0);
        return `
          <div class="list-item" onclick="window.location.hash='#/receipt/${store.id}/${r.id}'">
            <div class="list-item-content">
              <div class="list-item-title">${this._formatDate(r.date)}</div>
              <div class="list-item-sub">${r.items.length} item${r.items.length !== 1 ? 's' : ''} · ${this._formatPrice(total)}</div>
            </div>
            <div class="list-item-actions">
              <button class="delete-btn" onclick="event.stopPropagation(); UI._confirmDeleteReceipt('${store.id}', '${r.id}')" title="Delete">✕</button>
              <span class="chevron">›</span>
            </div>
          </div>
        `;
      }).join('');

    this.root.innerHTML = `
      <div class="view">
        <div class="nav-bar">
          <button class="back-btn" onclick="window.location.hash='#/'">← Stores</button>
          <h2 class="editable-title" id="store-name">${this._esc(store.name)}</h2>
          <button class="icon-btn" onclick="UI._editStoreName('${store.id}')" title="Edit name">✎</button>
        </div>
        <div class="list">${receiptItems}</div>
        <button class="btn-danger delete-store-btn" onclick="UI._confirmDeleteStore('${store.id}')">Delete Store</button>
      </div>
    `;
  },

  _editStoreName(storeId) {
    const el = document.getElementById('store-name');
    const current = el.textContent;
    const newName = prompt('Store name:', current);
    if (newName && newName.trim() && newName.trim() !== current) {
      el.textContent = newName.trim();
      App.updateStoreName(storeId, newName.trim());
    }
  },

  _confirmDeleteStore(storeId) {
    if (confirm('Delete this store and all its receipts?')) {
      App.deleteStore(storeId);
      window.location.hash = '#/';
    }
  },

  _confirmDeleteReceipt(storeId, receiptId) {
    if (confirm('Delete this receipt?')) {
      App.deleteReceipt(storeId, receiptId);
    }
  },

  // --- Receipt Detail ---

  renderReceiptDetail(store, receipt) {
    const items = receipt.items.map(item => `
      <div class="receipt-item" data-id="${item.id}">
        <div class="receipt-item-header">
          <button class="delete-btn" onclick="UI._deleteItem('${store.id}', '${receipt.id}', '${item.id}')" title="Delete item">✕</button>
        </div>
        <div class="field-group">
          <label>Receipt Name</label>
          <input type="text" value="${this._esc(item.receiptName)}"
            onchange="App.updateItem('${store.id}', '${receipt.id}', '${item.id}', 'receiptName', this.value)">
        </div>
        <div class="field-group">
          <label>Real Name</label>
          <input type="text" value="${this._esc(item.realName)}" placeholder="Enter real name..."
            onchange="App.updateItem('${store.id}', '${receipt.id}', '${item.id}', 'realName', this.value)">
        </div>
        <div class="field-group">
          <label>Price</label>
          <input type="number" step="0.01" value="${item.price.toFixed(2)}"
            onchange="App.updateItem('${store.id}', '${receipt.id}', '${item.id}', 'price', this.value)">
        </div>
      </div>
    `).join('');

    const total = receipt.items.reduce((s, i) => s + (i.price || 0), 0);

    this.root.innerHTML = `
      <div class="view">
        <div class="nav-bar">
          <button class="back-btn" onclick="window.location.hash='#/store/${store.id}'">← ${this._esc(store.name)}</button>
          <h2>Receipt</h2>
          <div></div>
        </div>
        <div class="receipt-meta">
          <div class="field-group">
            <label>Date</label>
            <input type="date" value="${receipt.date}"
              onchange="App.updateReceiptDate('${store.id}', '${receipt.id}', this.value)">
          </div>
          <div class="receipt-total">Total: ${this._formatPrice(total)}</div>
        </div>
        <div class="receipt-items">${items}</div>
        <button class="btn-secondary add-item-btn" onclick="UI._addItem('${store.id}', '${receipt.id}')">+ Add Item</button>
        <button class="btn-danger" onclick="UI._confirmDeleteReceipt('${store.id}', '${receipt.id}')">Delete Receipt</button>
      </div>
    `;
  },

  async _addItem(storeId, receiptId) {
    await App.addItemToReceipt(storeId, receiptId);
    App.showReceiptDetail(storeId, receiptId);
  },

  _deleteItem(storeId, receiptId, itemId) {
    if (confirm('Delete this item?')) {
      App.deleteItem(storeId, receiptId, itemId);
      App.showReceiptDetail(storeId, receiptId);
    }
  },

  // --- New Receipt ---

  renderNewReceipt(parsed, existingStores) {
    // Build autocomplete datalist
    const storeOptions = existingStores.map(s => `<option value="${this._esc(s)}">`).join('');

    const itemRows = parsed.items.length > 0
      ? parsed.items.map((item, i) => this._newReceiptItemRow(i, item)).join('')
      : this._newReceiptItemRow(0, { receiptName: '', price: '' });

    this.root.innerHTML = `
      <div class="view">
        <div class="nav-bar">
          <button class="back-btn" onclick="window.location.hash='#/'">← Cancel</button>
          <h2>New Receipt</h2>
          <div></div>
        </div>
        <div class="tab-bar">
          <button class="tab" onclick="window.location.hash='#/'">Stores</button>
          <button class="tab active" onclick="window.location.hash='#/new'">Scan</button>
          <button class="tab" onclick="window.location.hash='#/search'">Search</button>
        </div>

        <div class="new-receipt-form">
          <div class="form-section">
            <div class="field-group">
              <label>Store Name</label>
              <input type="text" id="new-store" value="${this._esc(parsed.storeName)}" list="store-list" placeholder="Store name...">
              <datalist id="store-list">${storeOptions}</datalist>
            </div>
            <div class="field-group">
              <label>Date</label>
              <input type="date" id="new-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>

          <div class="paste-section">
            <button class="btn-secondary" id="paste-btn">📋 Paste OCR Text from Clipboard</button>
          </div>

          <h3>Items</h3>
          <div id="new-items">${itemRows}</div>
          <button class="btn-secondary" id="add-row-btn">+ Add Item</button>

          <button class="btn-primary save-btn" id="save-receipt-btn">Save Receipt</button>
        </div>
      </div>
    `;

    this._newItemCounter = Math.max(parsed.items.length, 1);

    document.getElementById('add-row-btn').addEventListener('click', () => {
      const container = document.getElementById('new-items');
      container.insertAdjacentHTML('beforeend', this._newReceiptItemRow(this._newItemCounter++, { receiptName: '', price: '' }));
    });

    document.getElementById('paste-btn').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) { alert('Clipboard is empty'); return; }
        const parsed = Parser.parse(text);

        // Fill in store name if empty
        const storeInput = document.getElementById('new-store');
        if (!storeInput.value && parsed.storeName) {
          storeInput.value = parsed.storeName;
        }

        // Add parsed items
        if (parsed.items.length > 0) {
          const container = document.getElementById('new-items');
          container.innerHTML = '';
          this._newItemCounter = 0;
          parsed.items.forEach(item => {
            container.insertAdjacentHTML('beforeend', this._newReceiptItemRow(this._newItemCounter++, item));
          });
        }
      } catch (e) {
        alert('Could not read clipboard. Make sure you\'ve granted clipboard permission.');
      }
    });

    document.getElementById('save-receipt-btn').addEventListener('click', () => {
      const storeName = document.getElementById('new-store').value.trim();
      const date = document.getElementById('new-date').value;

      if (!storeName) { alert('Please enter a store name'); return; }
      if (!date) { alert('Please select a date'); return; }

      const rows = document.querySelectorAll('.new-item-row');
      const items = [];
      rows.forEach(row => {
        const name = row.querySelector('.new-item-name').value.trim();
        const price = row.querySelector('.new-item-price').value;
        if (name || price) {
          items.push({
            receiptName: name,
            realName: '',
            price: parseFloat(price) || 0,
          });
        }
      });

      if (items.length === 0) { alert('Please add at least one item'); return; }

      App.saveReceipt(storeName, date, items);
    });
  },

  _newReceiptItemRow(index, item) {
    return `
      <div class="new-item-row">
        <input type="text" class="new-item-name" value="${this._esc(item.receiptName || '')}" placeholder="Item name">
        <input type="number" class="new-item-price" step="0.01" value="${item.price || ''}" placeholder="0.00">
        <button class="delete-btn" onclick="this.parentElement.remove()" title="Remove">✕</button>
      </div>
    `;
  },

  // --- Search ---

  renderSearch(data) {
    this.root.innerHTML = `
      <div class="view">
        <div class="nav-bar">
          <div></div>
          <h2>Search</h2>
          <div></div>
        </div>
        <div class="tab-bar">
          <button class="tab" onclick="window.location.hash='#/'">Stores</button>
          <button class="tab" onclick="window.location.hash='#/new'">Scan</button>
          <button class="tab active" onclick="window.location.hash='#/search'">Search</button>
        </div>
        <div class="search-bar">
          <input type="text" id="search-input" placeholder="Search items..." autofocus>
        </div>
        <div id="search-results"></div>
      </div>
    `;

    const input = document.getElementById('search-input');
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        document.getElementById('search-results').innerHTML = '';
        return;
      }
      this._showSearchResults(data, query);
    });
  },

  _showSearchResults(data, query) {
    const results = [];
    for (const store of data.stores) {
      for (const receipt of store.receipts) {
        for (const item of receipt.items) {
          const matchReceipt = item.receiptName.toLowerCase().includes(query);
          const matchReal = item.realName && item.realName.toLowerCase().includes(query);
          if (matchReceipt || matchReal) {
            results.push({ item, store, receipt });
          }
        }
      }
    }

    if (results.length === 0) {
      document.getElementById('search-results').innerHTML = '<div class="empty-state">No matching items found.</div>';
      return;
    }

    const html = results.map(r => `
      <div class="list-item" onclick="window.location.hash='#/receipt/${r.store.id}/${r.receipt.id}'">
        <div class="list-item-content">
          <div class="list-item-title">${this._esc(r.item.realName || r.item.receiptName)}</div>
          <div class="list-item-sub">
            ${r.item.realName ? `<span class="receipt-name-tag">${this._esc(r.item.receiptName)}</span> · ` : ''}
            ${this._formatPrice(r.item.price)} · ${this._esc(r.store.name)} · ${this._formatDate(r.receipt.date)}
          </div>
        </div>
        <span class="chevron">›</span>
      </div>
    `).join('');

    document.getElementById('search-results').innerHTML = `<div class="list">${html}</div>`;
  },
};
