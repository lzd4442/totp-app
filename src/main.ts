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

// ===================== 存储 =====================
const STORE_KEY = 'totp_accounts';

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
let editingId: string | null = null;

// ===================== TOTP 生成 =====================
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

// ===================== 渲染：账号列表 =====================
function render() {
  const app = document.getElementById('app')!;
  const timeLeft = getTimeLeft();

  if (editingId !== null) {
    renderEdit(app);
    return;
  }

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
        <p>暂无账号</p>
        <p>点击下方添加按钮开始</p>
      </div>
    `;
  } else {
    for (const acc of accounts) {
      const code = generateTOTP(acc);
      const formatted = code.replace(/(.{3})/g, '$1 ').trim();
      html += `
        <div class="card" id="card-${acc.id}">
          <div class="card-left">
            <div class="issuer">${escapeHtml(acc.issuer || acc.label)}</div>
            <div class="label">${escapeHtml(acc.label)}</div>
          </div>
          <div class="code-block">
            <div class="code" id="code-${acc.id}">${formatted}</div>
            <div class="copy-hint">点击复制</div>
          </div>
          <button class="delete-btn" id="del-${acc.id}">✕</button>
        </div>
      `;
    }
  }

  html += `</div>`;

  // 有账号才显示进度条
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

  for (const acc of accounts) {
    document.getElementById(`card-${acc.id}`)!.onclick = () => copyCode(acc.id);
    document.getElementById(`del-${acc.id}`)!.onclick = (e) => {
      e.stopPropagation();
      deleteAccount(acc.id);
    };
  }
  document.getElementById('addbtn')!.onclick = () => {
    editingId = 'new';
    render();
  };
}

function copyCode(id: string) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  const code = generateTOTP(acc);
  navigator.clipboard.writeText(code).then(() => showToast('已复制'));
}

function deleteAccount(id: string) {
  if (confirm('确定删除这个账号？')) {
    accounts = accounts.filter(a => a.id !== id);
    saveAccounts(accounts);
    render();
  }
}

// ===================== 渲染：添加/编辑表单 =====================
function renderEdit(app: HTMLElement) {
  const isNew = editingId === 'new';
  const existing = isNew ? null : accounts.find(a => a.id === editingId);

  app.innerHTML = `
    <div class="header">
      <h1>${isNew ? '添加账号' : '编辑账号'}</h1>
      <button class="back-btn" id="backbtn">取消</button>
    </div>
    <div class="form">
      <div class="form-group">
        <label>粘贴 otpauth:// URI</label>
        <textarea id="f-uri" rows="3" placeholder="从网站粘贴密钥链接，如&#10;otpauth://totp/GitHub:zhangsan?secret=...&issuer=GitHub"></textarea>
      </div>
      <div class="form-divider">
        <span>或手动填写</span>
      </div>
      <div class="form-group">
        <label>名称</label>
        <input id="f-label" type="text" placeholder="如：GitHub" value="${escapeHtml(existing?.label || '')}" />
      </div>
      <div class="form-group">
        <label>密钥</label>
        <input id="f-secret" type="text" placeholder="Base32 密钥，如 JBSWY3DPEHPK3PXP" />
      </div>
      <button class="save-btn" id="savebtn">保存</button>
    </div>
  `;

  document.getElementById('backbtn')!.onclick = () => {
    editingId = null;
    render();
  };

  const uriInput = document.getElementById('f-uri') as HTMLTextAreaElement;
  const labelInput = document.getElementById('f-label') as HTMLInputElement;
  const secretInput = document.getElementById('f-secret') as HTMLInputElement;

  // otpauth URI 自动解析
  uriInput.addEventListener('input', () => {
    const uri = uriInput.value.trim();
    if (!uri.startsWith('otpauth://')) return;
    try {
      const t = OTP.URI.parse(uri) as OTP.TOTP;
      // 去掉 issuer: 前缀
      labelInput.value = t.label.includes(':')
        ? t.label.split(':')[1].trim()
        : t.label;
      secretInput.value = t.secret.base32;
      showToast('已解析完成，确认后保存');
    } catch (e) {
      showToast('URI 解析失败');
    }
  });

  document.getElementById('savebtn')!.onclick = () => {
    const label = labelInput.value.trim();
    const secret = secretInput.value.trim().toUpperCase().replace(/[^A-Z2-7=]/g, '');

    if (!label || !secret) {
      showToast('请填写名称和密钥');
      return;
    }

    const account: Account = {
      id: isNew ? Date.now().toString() : (editingId as string),
      label,
      issuer: label.split(':')[0] || label,
      secret,
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    };

    if (isNew) {
      accounts.push(account);
    } else {
      const idx = accounts.findIndex(a => a.id === editingId);
      if (idx >= 0) accounts[idx] = account;
    }

    saveAccounts(accounts).then(() => {
      editingId = null;
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
    if (codeEl) {
      codeEl.textContent = generateTOTP(acc).replace(/(.{3})/g, '$1 ').trim();
    }
  }
}

main();
