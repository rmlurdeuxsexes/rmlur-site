import { upload } from 'https://esm.sh/@vercel/blob@0.27.0/client';

const loginForm = document.getElementById('login-form');
const uploadForm = document.getElementById('upload-form');
const loginStatus = document.getElementById('login-status');
const uploadStatus = document.getElementById('upload-status');

document.getElementById('login-btn').addEventListener('click', async () => {
  const password = document.getElementById('password').value;
  loginStatus.textContent = '';
  loginStatus.classList.remove('ok');

  const res = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include',
  });

  if (res.ok) {
    loginForm.style.display = 'none';
    uploadForm.style.display = 'block';
    document.getElementById('prices-panel').style.display = 'block';
    document.getElementById('post-panel').style.display = 'block';
    loadMyPosts();
  } else {
    const data = await res.json().catch(() => ({}));
    loginStatus.textContent = data.error || 'login failed';
  }
});

async function uploadFileIfPresent(inputId) {
  const input = document.getElementById(inputId);
  const file = input.files[0];
  if (!file) return null;
  const blob = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/blob-upload-token',
  });
  return blob.url;
}

const CONTACT = 'jayrewindbeatz@gmail.com';
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const idInput = document.getElementById('id');
const titleInput = document.getElementById('title');
// the slug follows the title until you edit it by hand
titleInput.addEventListener('input', () => { if (!idInput.dataset.touched) idInput.value = slug(titleInput.value); });
idInput.addEventListener('input', () => { idInput.dataset.touched = '1'; });

// Paid files go straight from the browser to the private R2 bucket via a presigned PUT.
async function putPrivate(id, kind, file) {
  const r = await fetch('/api/admin-r2-presign', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, kind, filename: file.name }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `could not start ${kind} upload`);
  const put = await fetch(j.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  if (!put.ok) throw new Error(`${kind} upload to storage failed (${put.status})`);
  return j.ref;
}

const money = id => {
  const v = parseFloat(document.getElementById(id).value);
  return Number.isFinite(v) ? v : null;
};
const mailto = (title, label) => `mailto:${CONTACT}?subject=${encodeURIComponent(`Buy "${title}" — ${label}`)}`;

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  uploadStatus.classList.remove('ok');
  const submitBtn = uploadForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const type = document.getElementById('type').value;
    const title = titleInput.value.trim();
    const id = idInput.value.trim() || slug(title);
    const wavFile = document.getElementById('wav').files[0];
    const mp3File = document.getElementById('mp3').files[0];
    const stemsFile = document.getElementById('stems').files[0];
    if (!wavFile) throw new Error('add the WAV master — it is the file buyers download');

    uploadStatus.textContent = 'uploading WAV… (big files take a minute, keep this tab open)';
    const wav = await putPrivate(id, 'wav', wavFile);
    let mp3 = null, stems = null;
    if (mp3File) { uploadStatus.textContent = 'uploading MP3…'; mp3 = await putPrivate(id, 'mp3', mp3File); }
    if (stemsFile) { uploadStatus.textContent = 'uploading stems…'; stems = await putPrivate(id, 'stems', stemsFile); }

    uploadStatus.textContent = 'uploading cover/preview…';
    const [cover, preview] = await Promise.all([uploadFileIfPresent('cover'), uploadFileIfPresent('preview')]);

    const tiers = [];
    const add = (tid, label, priceId, ref) => {
      const price = money(priceId);
      if (ref && price != null) tiers.push({ id: tid, label, price, stripeLink: mailto(title, label), deliverableUrl: ref });
    };
    add('mp3', 'MP3', 'price-mp3', mp3);
    add('wav', 'WAV', 'price-wav', wav);
    add('stems', 'STEMS', 'price-stems', stems);
    const exPrice = money('price-exclusive');
    const exclusive = exPrice != null
      ? { price: exPrice, stripeLink: mailto(title, 'EXCLUSIVE'), deliverableUrl: stems || wav }
      : null;

    const payload = {
      id, type, title,
      genre: document.getElementById('genre').value.trim(),
      subtitle: null,
      bpm: parseInt(document.getElementById('bpm').value, 10) || null,
      key: document.getElementById('key').value.trim() || null,
      info: document.getElementById('info').value.trim(),
      cover, preview, deliverable: wav,
      tiers, exclusive,
    };

    uploadStatus.textContent = 'saving…';
    const res = await fetch('/api/admin-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (res.ok) {
      uploadStatus.textContent = 'Published — live in the store now.';
      uploadStatus.classList.add('ok');
      uploadForm.reset();
      delete idInput.dataset.touched;
    } else {
      const data = await res.json().catch(() => ({}));
      uploadStatus.textContent = data.error || 'save failed';
    }
  } catch (err) {
    uploadStatus.textContent = 'Error: ' + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

// Apply the standard price list to every beat, then show which beats can't deliver yet.
document.getElementById('reprice-btn').addEventListener('click', async (event) => {
  const btn = event.currentTarget;
  const status = document.getElementById('reprice-status');
  const report = document.getElementById('reprice-report');
  if (!confirm('Set every beat to the standard prices?')) return;
  btn.disabled = true;
  status.classList.remove('ok');
  status.textContent = 'updating…';
  report.textContent = '';
  try {
    const res = await fetch('/api/admin-reprice', { method: 'POST', credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `failed (${res.status})`);
    const missing = data.beats.filter(b => !b.tiers.some(t => t.buyable));
    status.textContent = `Updated ${data.updated} beats. ${missing.length ? `${missing.length} ${missing.length === 1 ? 'has' : 'have'} no download file yet (listed in red).` : 'All of them have a download file.'}`;
    status.classList.add('ok');
    for (const b of data.beats) {
      const li = document.createElement('li');
      const ok = b.tiers.some(t => t.buyable);
      li.className = ok ? '' : 'nofile';
      li.textContent = `${b.title} — ${b.tiers.map(t => `${t.id} $${t.price}${t.buyable ? '' : ' (no file)'}`).join(' · ')}`;
      report.appendChild(li);
    }
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});

// ── Post box: blog rants + gallery art, Twitter-style ──
const postBody = document.getElementById('post-body');
const postCount = document.getElementById('post-count');
const postStatus = document.getElementById('post-status');
const postList = document.getElementById('post-list');
postBody.addEventListener('input', () => { postCount.textContent = `${postBody.value.length} / 5000`; });

async function loadMyPosts() {
  postList.textContent = '';
  for (const kind of ['rant', 'art']) {
    const res = await fetch(`/api/posts?kind=${kind}`).catch(() => null);
    const posts = res && res.ok ? await res.json() : [];
    for (const p of posts.slice(0, 20)) {
      const li = document.createElement('li');
      if (p.image) { const im = document.createElement('img'); im.src = p.image; im.alt = ''; li.appendChild(im); }
      const span = document.createElement('span');
      span.textContent = `[${kind === 'art' ? 'gallery' : 'blog'}] ${new Date(p.createdAt).toLocaleString()} — ${p.title ? p.title + ': ' : ''}${(p.body || '').slice(0, 140)}`;
      li.appendChild(span);
      const del = document.createElement('button');
      del.type = 'button'; del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        if (!confirm('Delete this post?')) return;
        const r = await fetch(`/api/posts?id=${p.id}`, { method: 'DELETE', credentials: 'include' });
        if (r.ok) li.remove(); else alert('could not delete');
      });
      li.appendChild(del);
      postList.appendChild(li);
    }
  }
}

document.getElementById('post-btn').addEventListener('click', async (event) => {
  const btn = event.currentTarget;
  btn.disabled = true;
  postStatus.classList.remove('ok');
  try {
    const kind = document.querySelector('input[name="post-kind"]:checked').value;
    postStatus.textContent = 'posting…';
    const image = await uploadFileIfPresent('post-image');
    const res = await fetch('/api/posts', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind, image,
        body: postBody.value,
        title: document.getElementById('post-title').value,
        category: document.getElementById('post-category').value || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `failed (${res.status})`);
    postStatus.textContent = kind === 'art' ? 'Posted to the gallery.' : 'Posted to the blog.';
    postStatus.classList.add('ok');
    postBody.value = ''; postCount.textContent = '0 / 5000';
    document.getElementById('post-title').value = '';
    document.getElementById('post-image').value = '';
    loadMyPosts();
  } catch (err) {
    postStatus.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});
