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

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  uploadStatus.textContent = 'uploading files…';
  uploadStatus.classList.remove('ok');

  try {
    const [cover, preview, deliverable] = await Promise.all([
      uploadFileIfPresent('cover'),
      uploadFileIfPresent('preview'),
      uploadFileIfPresent('deliverable'),
    ]);

    const price = parseFloat(document.getElementById('price').value);
    const stripeLink = document.getElementById('stripeLink').value;

    const payload = {
      id: document.getElementById('id').value.trim(),
      type: document.getElementById('type').value,
      title: document.getElementById('title').value.trim(),
      genre: document.getElementById('genre').value.trim(),
      info: document.getElementById('info').value.trim(),
      cover, preview, deliverable,
      tiers: Number.isFinite(price) ? [{ id: 'default', label: 'DEFAULT', price, stripeLink }] : [],
    };

    uploadStatus.textContent = 'saving…';

    const res = await fetch('/api/admin-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (res.ok) {
      uploadStatus.textContent = 'Uploaded — live in the shop now.';
      uploadStatus.classList.add('ok');
      uploadForm.reset();
    } else {
      const data = await res.json().catch(() => ({}));
      uploadStatus.textContent = data.error || 'upload failed';
    }
  } catch (err) {
    uploadStatus.textContent = 'Error: ' + err.message;
  }
});
