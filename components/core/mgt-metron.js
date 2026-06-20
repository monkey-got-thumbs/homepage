/**
 * <mgt-metron> — Model management Web Component.
 * Displays model type slots, model cards, and load/unload controls.
 * Communicates with airgap server at :3001 (proxy to metron :8787).
 */

const API_BASE = 'http://127.0.0.1:3001';

const TYPE_COLORS = {
  general: '#A6FF4D',
  code: '#60A5FA',
  image: '#C084FC',
  speech: '#FB923C',
};

const TYPE_LABELS = {
  general: 'General Purpose',
  code: 'Code',
  image: 'Image',
  speech: 'Speech',
};

class MGTMetron extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.models = [];
    this.types = [];
    this.error = null;
    this.loading = true;
  }

  connectedCallback() {
    // The live manager talks to a local Metron instance at :3001. The marketing
    // site uses plain <mgt-metron> and shows a static preview; only the real app
    // opts in with <mgt-metron live> to poll the local API.
    this.offline = !this.hasAttribute('live');
    if (this.offline) {
      this.types = ['general', 'code', 'image', 'speech'].map((t) => ({ type: t, loaded: false, active: null }));
      this.models = [];
      this.loading = false;
      this.render();
      return;
    }
    this.render();
    this.fetchData();
    // Poll every 10s for status changes
    this._interval = setInterval(() => this.fetchData(), 10000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  async fetchData() {
    try {
      const [modelsResp, typesResp] = await Promise.all([
        fetch(`${API_BASE}/api/models`),
        fetch(`${API_BASE}/api/models/types`),
      ]);

      if (!modelsResp.ok || !typesResp.ok) throw new Error('API error');

      const modelsData = await modelsResp.json();
      this.models = modelsData.data || [];
      this.types = await typesResp.json();
      this.error = null;
    } catch (err) {
      this.error = 'Cannot connect to metron. Make sure both metron and airgap serve are running.';
    }
    this.loading = false;
    this.render();
  }

  async loadModel(id, type) {
    const card = this.shadowRoot.querySelector(`[data-model-id="${id}"]`);
    if (card) card.classList.add('loading');

    try {
      const resp = await fetch(`${API_BASE}/api/models/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Load failed');
      await this.fetchData();
    } catch (err) {
      this.error = `Failed to load model: ${err.message}`;
      this.render();
    }
  }

  async unloadModel(type) {
    try {
      const resp = await fetch(`${API_BASE}/api/models/unload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Unload failed');
      await this.fetchData();
    } catch (err) {
      this.error = `Failed to unload model: ${err.message}`;
      this.render();
    }
  }

  async downloadModel(id) {
    try {
      const resp = await fetch(`${API_BASE}/api/models/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Download failed');
      await this.fetchData();
    } catch (err) {
      this.error = `Failed to download: ${err.message}`;
      this.render();
    }
  }

  renderTypeSlot(typeInfo) {
    const color = TYPE_COLORS[typeInfo.type] || '#888';
    const label = TYPE_LABELS[typeInfo.type] || typeInfo.type;
    const isLoaded = typeInfo.loaded;
    const activeModel = typeInfo.active;
    const isGeneral = typeInfo.type === 'general';

    // Get models of this type
    const typeModels = this.models.filter(m => m.type === typeInfo.type);

    const modelCards = typeModels.map(m => {
      const isActive = m.status === 'active';
      const statusClass = m.status;
      const canLoad = m.status === 'available' || m.status === 'catalog';
      const canUnload = isActive && !isGeneral;

      return `
        <div class="model-card ${statusClass}" data-model-id="${m.id}">
          <div class="model-card-header">
            <span class="model-name">${m.name}</span>
            ${isActive ? '<span class="active-dot"></span>' : ''}
          </div>
          <div class="model-id">${m.id}</div>
          <div class="model-meta">
            ${m.size_gb ? `<span class="meta-item">${m.size_gb} GB</span>` : ''}
            ${m.context_window ? `<span class="meta-item">${(m.context_window / 1000).toFixed(0)}K ctx</span>` : ''}
            <span class="status-badge ${statusClass}">${m.status}</span>
          </div>
          <div class="model-actions">
            ${canLoad ? `<button class="btn-load" data-action="load" data-id="${m.id}" data-type="${typeInfo.type}">
              ${m.status === 'catalog' ? 'Download & Load' : 'Load'}
            </button>` : ''}
            ${canUnload ? `<button class="btn-unload" data-action="unload" data-type="${typeInfo.type}">Unload</button>` : ''}
            ${isActive && isGeneral ? `<button class="btn-unload" disabled title="Cannot unload — at least one GP model required">Unload</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="type-slot">
        <div class="type-header">
          <span class="type-dot" style="background: ${color}"></span>
          <h2 class="type-label">${label}</h2>
          ${isLoaded ? `<span class="loaded-badge">Loaded</span>` : `<span class="empty-badge">Empty</span>`}
          ${isGeneral ? '<span class="required-badge">Required</span>' : '<span class="optional-badge">Optional</span>'}
        </div>
        ${activeModel ? `<div class="active-model">Active: <strong>${activeModel}</strong></div>` : ''}
        <div class="model-cards">
          ${typeModels.length > 0 ? modelCards : '<p class="no-models">No models registered for this type.</p>'}
        </div>
      </div>
    `;
  }

  render() {
    const typeSlots = this.types.map(t => this.renderTypeSlot(t)).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-sans, 'Montserrat', sans-serif);
          color: var(--color-fg, #EDECF6);
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 24px;
          font-size: 14px;
          color: #FCA5A5;
        }

        .loading-state {
          text-align: center;
          padding: 48px;
          color: #B9B5D3;
          font-size: 14px;
        }

        .preview-banner {
          background: rgba(96, 165, 250, 0.12);
          border: 1px solid rgba(96, 165, 250, 0.3);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 24px;
          font-size: 14px;
          color: #BFD8FF;
        }
        .preview-banner strong { color: #EDECF6; }

        .type-slot {
          background: #17122B;
          border: 1px solid rgba(80, 62, 148, 0.3);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .type-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .type-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .type-label {
          font-family: var(--font-display, 'Bangers', cursive);
          font-size: 20px;
          margin: 0;
          letter-spacing: 0.5px;
        }

        .loaded-badge, .empty-badge, .required-badge, .optional-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .loaded-badge {
          background: rgba(74, 222, 128, 0.15);
          color: #4ADE80;
          border: 1px solid rgba(74, 222, 128, 0.3);
        }

        .empty-badge {
          background: rgba(185, 181, 211, 0.1);
          color: #B9B5D3;
          border: 1px solid rgba(185, 181, 211, 0.2);
        }

        .required-badge {
          background: rgba(166, 255, 77, 0.1);
          color: #A6FF4D;
          border: 1px solid rgba(166, 255, 77, 0.2);
        }

        .optional-badge {
          background: rgba(185, 181, 211, 0.05);
          color: #B9B5D3;
          border: 1px solid rgba(185, 181, 211, 0.1);
        }

        .active-model {
          font-size: 13px;
          color: #B9B5D3;
          margin-bottom: 16px;
          padding-left: 24px;
        }

        .active-model strong {
          color: #EDECF6;
          word-break: break-all;
        }

        .model-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .model-card {
          background: #0E0B1A;
          border: 1px solid rgba(80, 62, 148, 0.2);
          border-radius: 8px;
          padding: 16px;
          transition: border-color 0.2s;
        }

        .model-card:hover {
          border-color: rgba(80, 62, 148, 0.5);
        }

        .model-card.active {
          border-color: rgba(166, 255, 77, 0.4);
        }

        .model-card.loading {
          opacity: 0.6;
          pointer-events: none;
        }

        .model-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .model-name {
          font-weight: 600;
          font-size: 15px;
        }

        .active-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #A6FF4D;
          box-shadow: 0 0 6px rgba(166, 255, 77, 0.5);
        }

        .model-id {
          font-size: 12px;
          color: #B9B5D3;
          margin-bottom: 12px;
          word-break: break-all;
        }

        .model-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .meta-item {
          font-size: 12px;
          color: #B9B5D3;
          background: rgba(185, 181, 211, 0.1);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .status-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.active {
          background: rgba(166, 255, 77, 0.15);
          color: #A6FF4D;
        }

        .status-badge.available {
          background: rgba(96, 165, 250, 0.15);
          color: #60A5FA;
        }

        .status-badge.downloading {
          background: rgba(251, 191, 36, 0.15);
          color: #FBBF24;
        }

        .status-badge.catalog {
          background: rgba(185, 181, 211, 0.1);
          color: #B9B5D3;
        }

        .model-actions {
          display: flex;
          gap: 8px;
        }

        .btn-load, .btn-unload {
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
        }

        .btn-load:hover, .btn-unload:hover {
          opacity: 0.85;
        }

        .btn-load:active, .btn-unload:active {
          transform: scale(0.97);
        }

        .btn-load {
          background: linear-gradient(135deg, #503E94, #6A55C0);
          color: #EDECF6;
        }

        .btn-unload {
          background: rgba(185, 181, 211, 0.1);
          color: #B9B5D3;
          border: 1px solid rgba(185, 181, 211, 0.2);
        }

        .btn-unload:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .no-models {
          color: #B9B5D3;
          font-size: 13px;
          font-style: italic;
        }

        @media (max-width: 640px) {
          .model-cards {
            grid-template-columns: 1fr;
          }

          .type-header {
            flex-wrap: wrap;
          }
        }
      </style>

      ${this.offline
        ? '<div class="preview-banner">A preview of the Metron model manager. The live version runs on <strong>your own hardware</strong> and connects to a local Metron instance — no cloud, your models stay yours. <strong>In development.</strong></div>'
        : (this.error ? `<div class="error-banner">${this.error}</div>` : '')}
      ${this.loading ? '<div class="loading-state">Connecting to metron...</div>' : typeSlots}
    `;

    // Bind click events
    this.shadowRoot.querySelectorAll('[data-action="load"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        this.loadModel(id, type);
      });
    });

    this.shadowRoot.querySelectorAll('[data-action="unload"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        this.unloadModel(type);
      });
    });
  }
}

customElements.define('mgt-metron', MGTMetron);
