import { Preferences } from '@capacitor/preferences';
import './style.css';
import * as OTP from 'otpauth';

// ===================== 类型 =====================
interface Account {
  id: string;
  label: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: string;
}

interface Template {
  id: string;
  name: string;
  iconSvg: string;
  issuer: string;
  labelHint: string;
  digits: number;
  period: number;
  algorithm: string;
}

type View = 'list' | 'add' | 'detail';

// ===================== 内置 SVG 图标 =====================
const ICON_GITHUB = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#24292f"/><path d="M16 6C10.477 6 6 10.477 6 16c0 4.418 2.865 8.166 6.84 9.49.5.09.68-.217.68-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0116 10.5c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .268.18.578.688.48C23.137 24.164 26 20.416 26 16c0-5.523-4.477-10-10-10z" fill="#fff"/></svg>`;

const ICON_GITLAB = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#FC6D26"/><path d="M16 7L5 13.5l11 6.5 11-6.5L16 7z" fill="#fff"/><path d="M5 13.5v8l11 6.5v-8" fill="#fff"/><path d="M27 13.5v8l-11 6.5v-8" fill="#fff"/><path d="M5 21.5l11 6.5 11-6.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ICON_CUSTOM = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#e7e7e7"/><path d="M16 10v12M10 16h12" stroke="#79747e" stroke-width="2.5" stroke-linecap="round"/></svg>`;

// ===================== 内置模板 =====================
const TEMPLATES: Template[] = [
  {
    id: 'github',
    name: 'GitHub',
    iconSvg: ICON_GITHUB,
    issuer: 'GitHub',
    labelHint: 'username',
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    iconSvg: ICON_GITLAB,
    issuer: 'GitLab',
    labelHint: 'username',
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  },
  {
    id: 'custom',
    name: '自定义',
    iconSvg: ICON_CUSTOM,
    issuer: '',
    labelHint: '名称',
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  },
];

// ===================== 存储 =====================
const STORE_KEY = '***';

async function loadAccounts(): Promise<Account[]> {
  try {
    const result = await Preferences.get({ key: STORE_KEY });
    return result.value ? JSON.parse(result.value) : [];
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  await Preferences.set({ key: STORE_KEY, value: JSON.stringify(accounts) });
}

// ===================== UI 状态 =====================
let accounts: Account[] = [];
let currentView: View = 'list';
let currentDetailId: string | null = null;
let selectedTemplate: Template = TEMPLATES[2];

// ===================== TOTP =====================
function generateTOTP(account: Account): string {
  if (!account.secret) return '';
  try {
    const totp = new OTP.TOTP({
      issuer: account.issuer || 'Unknown',
      label: account.label,
      algorithm: (account.algorithm || 'SHA1') as 'SHA1' | 'SHA256' | 'SHA512',
      digits: account.digits || 6,
      period: account.period || 30,
      secret: OTP.Secret.fromBase32(account.secret),
    });
    return totp.generate();
  } catch {
    return '';
  }
}

function hasSecret(account: Account): boolean {
  return !!account.secret && account.secret.length >= 8;
}

function getTimeLeft(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===================== 渲染入口 =====================
function render() {
  const app = document.getElementById('app')!;
  if (currentView === 'list') renderList(app);
  else if (currentView === 'add') renderAdd(app);
  else if (currentView === 'detail') renderDetail(app);
}

// ===================== 视图：账号列表 =====================
function renderList(app: HTMLElement) {
  const timeLeft = getTimeLeft();
  const progress = timeLeft / 30;
  const ringColor = timeLeft <= 5 ? '#b3261e' : timeLeft <= 10 ? '#c78100' : '#2e7d32';

  let html = `
    <div class="header">
      <h1>TOTP</h1>
    </div>
    <div class="account-list">
  `;

  if (accounts.length === 0) {
    html += `
      <div class="empty">
        <div class="empty-icon">🔐</div>
        <div class="empty-title">还没有验证码</div>
        <div class="empty-sub">选择一个服务快速添加</div>
        <div class="template-grid">
          ${TEMPLATES.filter(t => t.id !== 'custom').map(t => `
            <button class="template-btn" data-template="${t.id}">
              <div class="tpl-icon">${t.iconSvg}</div>
              <span>${t.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    for (const acc of accounts) {
      const active = hasSecret(acc);
      const code = active ? generateTOTP(acc) : '';
      const formatted = active ? code.replace(/(.{3})/g, '$1 ').trim() : '';
      const statusClass = active ? 'card-active' : 'card-inactive';
      const codeDisplay = active
        ? `<div class="code" id="code-${acc.id}">${formatted}</div><div class="copy-hint" id="hint-${acc.id}">点击复制</div>`
        : `<div class="code-inactive">待填写密钥</div>`;

      html += `
        <div class="card ${statusClass}" data-id="${acc.id}">
          <div class="card-body">
            <div class="card-left">
              <div class="issuer">${escapeHtml(acc.issuer)}</div>
              <div class="label">${escapeHtml(acc.label)}</div>
            </div>
            <div class="code-block">${codeDisplay}</div>
          </div>
          <div class="card-arrow">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      `;
    }
  }

  html += `</div>`;

  if (accounts.length > 0 && accounts.some(a => hasSecret(a))) {
    html += `
      <div class="progress-bar-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="pbar" style="width:${(progress * 100).toFixed(1)}%;background:${ringColor}"></div>
        </div>
        <div class="time-left" id="timeleft" style="color:${ringColor}">${timeLeft}s</div>
      </div>
    `;
  }

  html += `<button class="add-btn" id="addbtn">+ 添加账号</button>`;

  app.innerHTML = html;

  document.getElementById('addbtn')!.onclick = () => {
    selectedTemplate = TEMPLATES[2];
    currentView = 'add';
    render();
  };

  if (accounts.length === 0) {
    for (const t of TEMPLATES.filter(t => t.id !== 'custom')) {
      document.querySelector(`[data-template="${t.id}"]`)!.addEventListener('click', () => {
        selectedTemplate = t;
        currentView = 'add';
        render();
      });
    }
  } else {
    for (const acc of accounts) {
      document.querySelector(`[data-id="${acc.id}"]`)!.addEventListener('click', () => {
        openDetail(acc.id);
      });
    }
  }
}

function openDetail(id: string) {
  currentDetailId = id;
  currentView = 'detail';
  render();
}

// ===================== 视图：添加账号 =====================
function renderAdd(app: HTMLElement) {
  const tplName = selectedTemplate.name;

  const templateButtons = TEMPLATES.map(t => `
    <button class="tpl-pill ${selectedTemplate.id === t.id ? 'active' : ''}" data-tpl="${t.id}">
      <span class="tpl-pill-icon">${t.iconSvg}</span>
      ${t.name}
    </button>
  `).join('');

  app.innerHTML = `
    <div class="header">
      <h1>添加 ${tplName}</h1>
      <button class="back-btn" id="backbtn">取消</button>
    </div>
    <div class="form">
      <div class="form-group">
        <label>选择服务</label>
        <div class="template-pills">${templateButtons}</div>
      </div>
      <div class="form-group">
        <label>名称</label>
        <input id="f-label" type="text" placeholder="${selectedTemplate.labelHint}" />
      </div>
      <div class="form-divider"><span>密钥在点卡片进去后填写</span></div>
      <button class="save-btn" id="savebtn">添加</button>
    </div>
  `;

  document.getElementById('backbtn')!.onclick = () => { currentView = 'list'; render(); };

  // 模板切换
  for (const t of TEMPLATES) {
    document.querySelector(`[data-tpl="${t.id}"]`)!.addEventListener('click', () => {
      selectedTemplate = t;
      currentView = 'add';
      render();
    });
  }

  document.getElementById('savebtn')!.onclick = () => {
    const labelInput = document.getElementById('f-label') as HTMLInputElement;
    const label = labelInput.value.trim();

    if (!label) { showToast('请填写名称'); return; }

    const issuer = selectedTemplate.id === 'custom' ? label : selectedTemplate.issuer;

    const account: Account = {
      id: Date.now().toString(),
      label,
      issuer,
      secret: '', // 密钥暂时为空，点卡片进去填
      digits: selectedTemplate.digits,
      period: selectedTemplate.period,
      algorithm: selectedTemplate.algorithm,
    };

    accounts.push(account);
    saveAccounts(accounts).then(() => {
      currentView = 'list';
      render();
    });
  };
}

// ===================== 视图：账号详情（填密钥 / 复制 / 编辑）=====================
function renderDetail(app: HTMLElement) {
  const acc = accounts.find(a => a.id === currentDetailId);
  if (!acc) { currentView = 'list'; render(); return; }

  const active = hasSecret(acc);
  const code = active ? generateTOTP(acc) : '';
  const formatted = active ? code.replace(/(.{3})/g, '$1 ').trim() : '';

  app.innerHTML = `
    <div class="header">
      <h1>${escapeHtml(acc.issuer)}</h1>
      <button class="back-btn" id="backbtn">返回</button>
    </div>
    <div class="detail-view">
      <div class="detail-name">${escapeHtml(acc.label)}</div>

      ${active ? `
        <div class="detail-code-wrap">
          <div class="detail-code" id="detail-code">${formatted}</div>
          <div class="detail-copy-btn" id="copybtn">复制</div>
        </div>
        <div class="detail-hint" id="detail-hint">点击复制</div>
      ` : `
        <div class="detail-code-inactive">待填写密钥</div>
      `}

      <div class="form" style="margin-top:32px">
        <div class="form-group">
          <label>粘贴 otpauth:// 密钥链接</label>
          <textarea id="f-uri" rows="2" placeholder="从设置页面复制，如&#10;otpauth://totp/${acc.issuer}:${acc.label}?secret=***"></textarea>
        </div>
        <div class="form-divider"><span>或手动填写密钥</span></div>
        <div class="form-group">
          <label>密钥</label>
          <input id="f-secret" type="text" value="${escapeHtml(acc.secret)}" placeholder="Base32 密钥，如 JBSWY3DPEHPK3PXP" />
        </div>
        <button class="save-btn" id="savebtn">${acc.secret ? '更新密钥' : '保存密钥'}</button>
        <button class="delete-btn-full" id="deletebtn">删除此账号</button>
      </div>
    </div>
  `;

  document.getElementById('backbtn')!.onclick = () => { currentView = 'list'; render(); };

  // 复制按钮
  if (active) {
    document.getElementById('copybtn')!.addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        const hint = document.getElementById('detail-hint')!;
        hint.textContent = '✓ 已复制';
        setTimeout(() => { hint.textContent = '点击复制'; }, 1500);
      });
    });
  }

  // URI 解析
  const uriInput = document.getElementById('f-uri') as HTMLTextAreaElement;
  const secretInput = document.getElementById('f-secret') as HTMLInputElement;

  uriInput.addEventListener('input', () => {
    const uri = uriInput.value.trim();
    if (!uri.startsWith('otpauth://')) return;
    try {
      const t = OTP.URI.parse(uri) as OTP.TOTP;
      secretInput.value = t.secret.base32;
      showToast('已解析 ✓');
    } catch {
      showToast('解析失败');
    }
  });

  document.getElementById('savebtn')!.onclick = () => {
    const secret = secretInput.value.trim().toUpperCase().replace(/[^A-Z2-7=]/g, '');
    if (!secret) { showToast('请填写密钥'); return; }

    const idx = accounts.findIndex(a => a.id === currentDetailId);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], secret };
    }
    saveAccounts(accounts).then(() => {
      showToast('已保存 ✓');
      render();
    });
  };

  document.getElementById('deletebtn')!.addEventListener('click', () => {
    if (confirm(`确定删除「${acc.label}」？`)) {
      accounts = accounts.filter(a => a.id !== currentDetailId);
      saveAccounts(accounts).then(() => {
        currentView = 'list';
        currentDetailId = null;
        render();
      });
    }
  });
}

// ===================== Toast =====================
function showToast(msg: string) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ===================== 启动 =====================
async function main() {
  accounts = await loadAccounts();
  render();

  setInterval(() => {
    const tl = getTimeLeft();
    const progress = tl / 30;
    const color = tl <= 5 ? '#b3261e' : tl <= 10 ? '#c78100' : '#2e7d32';
    const tlEl = document.getElementById('timeleft');
    const pbEl = document.getElementById('pbar');
    if (tlEl) { tlEl.style.color = color; tlEl.textContent = tl + 's'; }
    if (pbEl) { pbEl.style.width = (progress * 100) + '%'; pbEl.style.background = color; }
    if (tl === 30) refreshCodes();
  }, 1000);
}

function refreshCodes() {
  for (const acc of accounts) {
    if (!hasSecret(acc)) continue;
    const codeEl = document.getElementById(`code-${acc.id}`);
    if (codeEl) {
      const code = generateTOTP(acc).replace(/(.{3})/g, '$1 ').trim();
      codeEl.textContent = code;
    }
    const detailCode = document.getElementById('detail-code');
    if (detailCode) {
      detailCode.textContent = generateTOTP(acc).replace(/(.{3})/g, '$1 ').trim();
    }
  }
}

main();
