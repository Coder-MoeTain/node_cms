const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractApiKey, maskApiKey } = require('../middleware/apiAuth');

function mockReq({ headers = {}, query = {} } = {}) {
  return {
    get(name) {
      const key = String(name || '').toLowerCase();
      const normalized = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
      return normalized[key] || null;
    },
    query
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('apiAuth middleware', () => {
  function withApiKey(apiKey, run) {
    jest.isolateModules(() => {
      jest.doMock('../config/app', () => ({ apiKey }));
      const { apiAuth } = require('../middleware/apiAuth');
      run(apiAuth);
    });
  }

  test('allows requests when API_KEY is not configured', () => {
    withApiKey('', (apiAuth) => {
      const next = jest.fn();
      apiAuth(mockReq(), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  test('rejects requests without a valid key', () => {
    withApiKey('secret-key', (apiAuth) => {
      const next = jest.fn();
      const res = mockRes();
      apiAuth(mockReq(), res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  test('accepts key from X-API-Key header', () => {
    withApiKey('secret-key', (apiAuth) => {
      const next = jest.fn();
      apiAuth(mockReq({ headers: { 'x-api-key': 'secret-key' } }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  test('accepts key from Authorization Bearer header', () => {
    withApiKey('secret-key', (apiAuth) => {
      const next = jest.fn();
      apiAuth(mockReq({ headers: { authorization: 'Bearer secret-key' } }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  test('rejects API key in query string', () => {
    withApiKey('secret-key', (apiAuth) => {
      const next = jest.fn();
      const res = mockRes();
      apiAuth(mockReq({ query: { api_key: 'secret-key' } }), res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/query strings are not allowed/i)
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  test('masks API keys for logging', () => {
    expect(maskApiKey('secret-key-value')).toBe('secr...alue');
    expect(maskApiKey('short')).toBe('[FILTERED]');
  });

  test('extractApiKey prefers header over bearer parsing', () => {
    expect(extractApiKey(mockReq({ headers: { 'x-api-key': 'header-key', authorization: 'Bearer bearer-key' } }))).toBe('header-key');
    expect(extractApiKey(mockReq({ headers: { authorization: 'Bearer bearer-key' } }))).toBe('bearer-key');
    expect(extractApiKey(mockReq())).toBeNull();
  });
});

describe('upload security helpers', () => {
  const { validateMagicBytes, hasDoubleExtension } = require('../utils/uploadSecurity');

  test('rejects double extension filenames', () => {
    expect(hasDoubleExtension('photo.php.jpg')).toBe(true);
    expect(hasDoubleExtension('photo.jpg')).toBe(false);
  });

  test('validates real jpeg magic bytes', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-upload-'));
    const filePath = path.join(tempDir, 'valid.jpg');
    fs.writeFileSync(filePath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]));
    const result = await validateMagicBytes(filePath, 'image/jpeg', '.jpg');
    expect(result.valid).toBe(true);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('rejects fake jpeg with text content', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-upload-'));
    const filePath = path.join(tempDir, 'fake.jpg');
    fs.writeFileSync(filePath, 'not-an-image');
    const result = await validateMagicBytes(filePath, 'image/jpeg', '.jpg');
    expect(result.valid).toBe(false);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('rejects MIME and extension mismatches', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-upload-'));
    const filePath = path.join(tempDir, 'wrong.png');
    fs.writeFileSync(filePath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));
    const result = await validateMagicBytes(filePath, 'image/png', '.png');
    expect(result.valid).toBe(false);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('detects webp, mp4, and pdf headers', async () => {
    const {
      detectMimeFromMagic,
      validateMagicBytes,
      quarantineUploadPath,
      finalizeQuarantinedUpload
    } = require('../utils/uploadSecurity');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-upload-'));
    const webpPath = path.join(tempDir, 'sample.webp');
    fs.writeFileSync(webpPath, Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.alloc(4),
      Buffer.from('WEBP', 'ascii')
    ]));
    expect(detectMimeFromMagic(webpPath, '.webp')).toBe('image/webp');

    const mp4Path = path.join(tempDir, 'clip.mp4');
    fs.writeFileSync(mp4Path, Buffer.concat([
      Buffer.alloc(4),
      Buffer.from('ftyp', 'ascii'),
      Buffer.from('isom', 'ascii')
    ]));
    expect(detectMimeFromMagic(mp4Path, '.mp4')).toBe('video/mp4');

    const pdfPath = path.join(tempDir, 'doc.pdf');
    fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4\n'));
    const pdfResult = await validateMagicBytes(pdfPath, 'application/pdf', '.pdf');
    expect(pdfResult.valid).toBe(true);

    expect(quarantineUploadPath('test.bin')).toContain('tmp/quarantine');

    const jpegPath = path.join(tempDir, 'move.jpg');
    fs.writeFileSync(jpegPath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]));
    const moved = await finalizeQuarantinedUpload({
      path: jpegPath,
      originalname: 'move.jpg',
      mimetype: 'image/jpeg'
    });
    expect(moved.filename).toMatch(/\.jpg$/);
    expect(fs.existsSync(moved.path)).toBe(true);
    fs.unlinkSync(moved.path);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('finalizeQuarantinedUpload rejects double extensions', async () => {
    const { finalizeQuarantinedUpload } = require('../utils/uploadSecurity');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-upload-'));
    const filePath = path.join(tempDir, 'evil.php.jpg');
    fs.writeFileSync(filePath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));
    await expect(finalizeQuarantinedUpload({
      path: filePath,
      originalname: 'evil.php.jpg',
      mimetype: 'image/jpeg'
    })).rejects.toThrow(/Double extension/);
    expect(fs.existsSync(filePath)).toBe(false);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('package archive security', () => {
  const { isZipMagicBytes } = require('../utils/packageScan');
  const { isSafeEntryName } = require('../utils/packageArchive');

  test('detects zip magic bytes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-zip-'));
    const zipPath = path.join(tempDir, 'sample.zip');
    fs.writeFileSync(zipPath, Buffer.from([0x50, 0x4B, 0x03, 0x04]));
    expect(isZipMagicBytes(zipPath)).toBe(true);
    fs.writeFileSync(zipPath, 'not-a-zip');
    expect(isZipMagicBytes(zipPath)).toBe(false);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('rejects zip slip style entry names', () => {
    expect(isSafeEntryName('../evil.php')).toBe(false);
    expect(isSafeEntryName('plugin/plugin.json')).toBe(true);
  });
});

describe('SSRF guard', () => {
  const { assertSafeOutboundUrl } = require('../utils/ssrfGuard');

  test('rejects localhost and private targets', () => {
    expect(() => assertSafeOutboundUrl('http://127.0.0.1/update.json', { allowHttp: true })).toThrow(/Loopback/);
    expect(() => assertSafeOutboundUrl('http://localhost/update.json', { allowHttp: true })).toThrow(/Blocked hostname/);
    expect(() => assertSafeOutboundUrl('file:///etc/passwd')).toThrow(/Only http/);
  });

  test('allows public https URLs', () => {
    expect(assertSafeOutboundUrl('https://example.com/update.json').hostname).toBe('example.com');
  });

  test('allows loopback when explicitly enabled', () => {
    expect(assertSafeOutboundUrl('http://127.0.0.1:8001/health', { allowHttp: true, allowLoopback: true }).hostname).toBe('127.0.0.1');
    expect(assertSafeOutboundUrl('http://localhost:8001/health', { allowHttp: true, allowLoopback: true }).hostname).toBe('localhost');
  });

  test('isPrivateIpv4 detects RFC1918 and special ranges', () => {
    const { isPrivateIpv4 } = require('../utils/ssrfGuard');
    expect(isPrivateIpv4('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4('127.0.0.1')).toBe(true);
    expect(isPrivateIpv4('169.254.1.1')).toBe(true);
    expect(isPrivateIpv4('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4('192.168.1.1')).toBe(true);
    expect(isPrivateIpv4('0.0.0.0')).toBe(true);
    expect(isPrivateIpv4('8.8.8.8')).toBe(false);
    expect(isPrivateIpv4('not-an-ip')).toBe(false);
  });

  test('isBlockedIp handles IPv4, IPv6, and invalid input', () => {
    const { isBlockedIp } = require('../utils/ssrfGuard');
    expect(isBlockedIp('10.0.0.1')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
    expect(isBlockedIp('fc00::1')).toBe(true);
    expect(isBlockedIp('fd12::1')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('not-ip')).toBe(true);
  });

  test('rejects invalid URLs and plain HTTP without allowHttp', () => {
    expect(() => assertSafeOutboundUrl('not-a-url')).toThrow(/Invalid URL/);
    expect(() => assertSafeOutboundUrl('http://example.com/path')).toThrow(/HTTPS is required/);
  });

  test('rejects direct private IP addresses and .local hostnames', () => {
    expect(() => assertSafeOutboundUrl('https://10.0.0.1/internal')).toThrow(/Private or internal/);
    expect(() => assertSafeOutboundUrl('https://192.168.0.1/x')).toThrow(/Private or internal/);
    expect(() => assertSafeOutboundUrl('https://router.local/config')).toThrow(/Blocked hostname/);
  });

  test('assertSafeOutboundUrlResolved rejects DNS that resolves to private IP', async () => {
    const dns = require('dns').promises;
    const { assertSafeOutboundUrlResolved } = require('../utils/ssrfGuard');
    jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '10.0.0.1', family: 4 }]);
    await expect(assertSafeOutboundUrlResolved('https://evil.example.com/payload')).rejects.toThrow(/private or internal IP/);
    dns.lookup.mockRestore();
  });

  test('assertSafeOutboundUrlResolved accepts public DNS resolution', async () => {
    const dns = require('dns').promises;
    const { assertSafeOutboundUrlResolved } = require('../utils/ssrfGuard');
    jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const parsed = await assertSafeOutboundUrlResolved('https://example.com/data.json');
    expect(parsed.hostname).toBe('example.com');
    dns.lookup.mockRestore();
  });
});

describe('security headers', () => {
  const request = require('supertest');
  const { app } = require('../server');

  test('public pages include hardened headers', async () => {
    const response = await request(app).get('/');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBeTruthy();
    expect(response.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(response.headers['content-security-policy']).not.toMatch(/unsafe-eval/);
  });

  test('admin login CSP allows inline scripts but not unsafe-eval', async () => {
    const response = await request(app).get('/admin/login');
    expect(response.headers['content-security-policy']).toMatch(/unsafe-inline/);
    expect(response.headers['content-security-policy']).not.toMatch(/unsafe-eval/);
  });
});
