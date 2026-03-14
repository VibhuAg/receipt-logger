// GitHub Gist storage for receipt data

const Storage = {
  TOKEN_KEY: 'receipt_logger_token',
  GIST_ID_KEY: 'receipt_logger_gist_id',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  getGistId() {
    return localStorage.getItem(this.GIST_ID_KEY);
  },

  setGistId(id) {
    localStorage.setItem(this.GIST_ID_KEY, id);
  },

  isConfigured() {
    return !!(this.getToken() && this.getGistId());
  },

  async _request(url, options = {}) {
    const token = this.getToken();
    if (!token) throw new Error('No GitHub token configured');

    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }

    return res.json();
  },

  async createGist() {
    const emptyData = { stores: [] };
    const gist = await this._request('https://api.github.com/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: 'ReceiptLogger Data',
        public: false,
        files: {
          'receipt-data.json': {
            content: JSON.stringify(emptyData, null, 2),
          },
        },
      }),
    });

    this.setGistId(gist.id);
    return emptyData;
  },

  async loadData() {
    const gistId = this.getGistId();
    if (!gistId) throw new Error('No Gist ID configured');

    const gist = await this._request(`https://api.github.com/gists/${gistId}`);
    const file = gist.files['receipt-data.json'];
    if (!file) throw new Error('receipt-data.json not found in gist');

    return JSON.parse(file.content);
  },

  async saveData(data) {
    const gistId = this.getGistId();
    if (!gistId) throw new Error('No Gist ID configured');

    await this._request(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        files: {
          'receipt-data.json': {
            content: JSON.stringify(data, null, 2),
          },
        },
      }),
    });
  },

  clearConfig() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.GIST_ID_KEY);
  },
};
