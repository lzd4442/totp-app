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

type View = 'list' | 'add' | 'edit';

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
let currentEditId: string | null = null;
let selectedTemplate: Template = TEMPLATES[2]; // 默认自定义

// ===================== TOTP =====================
function generateTOTP(account: Account): string {
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
    return '------';
  }
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
  else if (currentView === 'edit') renderEdit(app);
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
      const code = generateTOTP(acc);
      const formatted = code.replace(/(.{3})/g, '$1 ').trim();
      html += `
        <div class="card" data-id="${acc.id}">
          <div class="card-body">
            <div class="card-left">
              <div class="issuer">${escapeHtml(acc.issuer)}</div>
              <div class="label">${escapeHtml(acc.label)}</div>
            </div>
            <div class="code-block">
              <div class="code" id="code-${acc.id}">${formatted}</div>
              <div class="copy-hint" id="hint-${acc.id}">点击复制</div>
            </div>
          </div>
          <div class="card-edit" id="edit-${acc.id}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
        </div>
      `;
    }
  }

  html += `</div>`;

  if (accounts.length > 0) {
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

  document.getElementById('addbtn')!.onclick = () => { currentView = 'add'; selectedTemplate = TEMPLATES[2]; render(); };

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
      document.querySelector(`[data-id="${acc.id}"]`)!.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.card-edit')) {
          openEdit(acc.id);
        } else {
          copyCode(acc.id);
        }
      });
    }
  }
}

function copyCode(id: string) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  const code = generateTOTP(acc);
  navigator.clipboard.writeText(code).then(() => {
    showToast('已复制');
    const hint = document.getElementById(`hint-${id}`);
    if (hint) { hint.textContent = '✓ 已复制'; setTimeout(() => { if (hint) hint.textContent = '点击复制'; }, 1500); }
  });
}

function openEdit(id: string) {
  currentEditId = id;
  currentView = 'edit';
  render();
}

// ===================== 视图：添加账号 =====================
function renderAdd(app: HTMLElement) {
  const isCustom = selectedTemplate.id === 'custom';
  const tplName = selectedTemplate.name;

  const templateButtons = TEMPLATES.map(t => `
    <button class="tpl-pill ${selectedTemplate.id === t.id ? 'active' : ''}" data-tpl="${t.id}">
      <span class="tpl-pill-icon">${t.iconSvg}</span>
      ${t.name}
    </button>
  `).join('');

  const advancedSettings = isCustom ? `
    <div class="form-group">
      <label>位数</label>
      <select id="f-digits">
        <option value="6" selected>6 位</option>
        <option value="8">8 位</option>
      </select>
    </div>
    <div class="form-group">
      <label>周期</label>
      <select id="f-period">
        <option value="30" selected>30 秒</option>
        <option value="60">60 秒</option>
      </select>
    </div>
    <div class="form-group">
      <label>算法</label>
      <select id="f-algo">
        <option value="SHA1" selected>SHA1</option>
        <option value="SHA256">SHA256</option>
        <option value="SHA512">SHA512</option>
      </select>
    </div>
  ` : '';

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
        <label>粘贴 otpauth:// 密钥链接</label>
        <textarea id="f-uri" rows="2" placeholder="从设置页面复制，如&#10;otpauth://totp/${selectedTemplate.issuer}:username?secret=***"></textarea>
      </div>
      <div class="form-divider"><span>或手动填写</span></div>
      <div class="form-group">
        <label>名称</label>
        <input id="f-label" type="text" placeholder="${selectedTemplate.labelHint}" />
      </div>
      <div class="form-group">
        <label>密钥</label>
        <input id="f-secret" type="text" placeholder="Base32 密钥，如 JBSWY3DPEHPK3PXP" />
      </div>
      ${advancedSettings}
      <button class="save-btn" id="savebtn">保存</button>
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

  const uriInput = document.getElementById('f-uri') as HTMLTextAreaElement;
  const labelInput = document.getElementById('f-label') as HTMLInputElement;
  const secretInput = document.getElementById('f-secret') as HTMLInputElement;

  // URI 自动解析
  uriInput.addEventListener('input', () => {
    const uri = uriInput.value.trim();
    if (!uri.startsWith('otpauth://')) return;
    try {
      const t = OTP.URI.parse(uri) as OTP.TOTP;
      const label = t.label.includes(':') ? t.label.split(':')[1].trim() : t.label;
      labelInput.value = label;
      secretInput.value = t.secret.base32;
      showToast('已解析 ✓');
    } catch {
      showToast('解析失败');
    }
  });

  document.getElementById('savebtn')!.onclick = () => {
    const label = labelInput.value.trim();
    const secret = secretInput.value.trim().toUpperCase().replace(/[^A-Z2-7=]/g, '');

    if (!label || !secret) { showToast('请填写名称和密钥'); return; }

    const tpl = selectedTemplate;
    const issuer = tpl.id === 'custom' ? label : tpl.issuer;

    let digits = tpl.digits, period = tpl.period, algorithm = tpl.algorithm;
    if (tpl.id === 'custom') {
      digits = parseInt((document.getElementById('f-digits') as HTMLSelectElement).value);
      period = parseInt((document.getElementById('f-period') as HTMLSelectElement).value);
      algorithm = (document.getElementById('f-algo') as HTMLSelectElement).value;
    }

    const account: Account = {
      id: Date.now().toString(),
      label,
      issuer,
      secret,
      digits,
      period,
      algorithm,
    };

    accounts.push(account);
    saveAccounts(accounts).then(() => {
      currentView = 'list';
      render();
    });
  };
}

// ===================== 视图：编辑/删除 =====================
function renderEdit(app: HTMLElement) {
  const acc = accounts.find(a => a.id === currentEditId);
  if (!acc) { currentView = 'list'; render(); return; }

  app.innerHTML = `
    <div class="header">
      <h1>编辑账号</h1>
      <button class="back-btn" id="backbtn">返回</button>
    </div>
    <div class="form">
      <div class="form-group">
        <label>名称</label>
        <input id="f-label" type="text" value="${escapeHtml(acc.label)}" />
      </div>
      <div class="form-group">
        <label>颁发者</label>
        <input id="f-issuer" type="text" value="${escapeHtml(acc.issuer)}" />
      </div>
      <div class="form-group">
        <label>密钥</label>
        <input id="f-secret" type="text" value="${escapeHtml(acc.secret)}" />
      </div>
      <button class="delete-btn-full" id="deletebtn">删除此账号</button>
      <button class="save-btn" id="savebtn">保存</button>
    </div>
  `;

  document.getElementById('backbtn')!.onclick = () => { currentView = 'list'; render(); };

  document.getElementById('deletebtn')!.onclick = () => {
    if (confirm(`确定删除「${acc.label}」？`)) {
      accounts = accounts.filter(a => a.id !== currentEditId);
      saveAccounts(accounts).then(() => {
        currentView = 'list';
        currentEditId = null;
        render();
      });
    }
  };

  document.getElementById('savebtn')!.onclick = () => {
    const labelInput = document.getElementById('f-label') as HTMLInputElement;
    const issuerInput = document.getElementById('f-issuer') as HTMLInputElement;
    const secretInput = document.getElementById('f-secret') as HTMLInputElement;

    const label = labelInput.value.trim();
    const secret = secretInput.value.trim().toUpperCase().replace(/[^A-Z2-7=]/g, '');
    if (!label || !secret) { showToast('名称和密钥不能为空'); return; }

    const idx = accounts.findIndex(a => a.id === currentEditId);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], label, issuer: issuerInput.value.trim() || label, secret };
    }
    saveAccounts(accounts).then(() => {
      currentView = 'list';
      currentEditId = null;
      render();
    });
  };
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
    const codeEl = document.getElementById(`code-${acc.id}`);
    if (codeEl) codeEl.textContent = generateTOTP(acc).replace(/(.{3})/g, '$1 ').trim();
  }
}

main();
