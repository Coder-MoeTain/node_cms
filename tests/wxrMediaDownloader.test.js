const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, models } = require('../server');
const { login } = require('./helpers');
const {
  isRemoteMediaUrl,
  hydrateImportMedia,
  downloadRemoteMedia
} = require('../utils/wxrMediaDownloader');
const { importSite } = require('../utils/importer');

describe('WXR remote media downloader', () => {
  test('isRemoteMediaUrl detects http(s) URLs', () => {
    expect(isRemoteMediaUrl('https://example.com/a.jpg')).toBe(true);
    expect(isRemoteMediaUrl('/uploads/a.jpg')).toBe(false);
  });

  test('downloadRemoteMedia rejects private network URLs', async () => {
    await expect(downloadRemoteMedia('http://127.0.0.1/secret.jpg')).rejects.toThrow(/not allowed/i);
  });

  test('hydrateImportMedia downloads remote attachments with mocked fetch', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          if (name === 'content-type') return 'application/octet-stream';
          if (name === 'content-length') return '12';
          return null;
        }
      },
      arrayBuffer: async () => new Uint8Array(Buffer.from('mock-bytes-1')).buffer
    }));

    const rows = await hydrateImportMedia([
      {
        original_name: 'remote.bin',
        filename: 'remote.bin',
        file_path: 'https://cdn.example.com/files/remote.bin',
        source_url: 'https://cdn.example.com/files/remote.bin',
        mime_type: 'application/octet-stream',
        file_type: 'other',
        file_size: 0,
        external: true
      }
    ], { userId: 1, fetchImpl: mockFetch });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(rows[0].file_path).toMatch(/^\/uploads\/wxr-import\//);
    expect(fs.existsSync(path.join(process.cwd(), 'public', rows[0].file_path))).toBe(true);
    fs.unlinkSync(path.join(process.cwd(), 'public', rows[0].file_path));
  });

  test('importSite stores downloaded WXR media records', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          if (name === 'content-type') return 'application/octet-stream';
          if (name === 'content-length') return '8';
          return null;
        }
      },
      arrayBuffer: async () => Buffer.from('import-x')
    }));

    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const slug = `wxr-media-${Date.now()}`;
    const result = await importSite({
      version: '1.1',
      posts: [{
        title: 'Media Post',
        slug,
        content: '<p>media</p>',
        status: 'published',
        post_type: 'post'
      }],
      media: [{
        original_name: 'asset.bin',
        filename: 'asset.bin',
        file_path: 'https://files.example.com/asset.bin',
        source_url: 'https://files.example.com/asset.bin',
        mime_type: 'application/octet-stream',
        file_type: 'other',
        file_size: 0,
        external: true
      }]
    }, {
      dryRun: false,
      userId: admin.id,
      downloadRemoteMedia: true,
      fetchImpl: mockFetch
    });

    expect(result.logs.some((line) => /Downloaded 1 remote media/i.test(line))).toBe(true);
    const media = await models.Media.findOne({ where: { original_name: 'asset.bin' } });
    expect(media).toBeTruthy();
    expect(media.file_path).toMatch(/^\/uploads\/wxr-import\//);
    if (media?.file_path) {
      const disk = path.join(process.cwd(), 'public', media.file_path);
      if (fs.existsSync(disk)) fs.unlinkSync(disk);
    }
  });

  test('admin can download WordPress WXR export', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/tools/export/wxr?media=0');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toMatch(/wordpress\.org\/export\//);
  });
});
