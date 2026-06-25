const { URL } = require('url');
const dns = require('dns').promises;
const net = require('net');

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254'
]);

function isPrivateIpv4(ip) {
  const parts = String(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 0) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = String(ip).toLowerCase();
  return normalized === '::1'
    || normalized.startsWith('fe80:')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd');
}

function isBlockedIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

function assertSafeOutboundUrl(rawUrl, { allowHttp = false } = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http(s) URLs are allowed.');
  }
  if (parsed.protocol === 'http:' && !allowHttp) {
    throw new Error('HTTPS is required for outbound requests.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('Blocked hostname.');
  }
  if (hostname === '127.0.0.1' || hostname === '::1' || hostname.startsWith('127.')) {
    throw new Error('Loopback addresses are not allowed.');
  }

  if (net.isIP(hostname) && isBlockedIp(hostname)) {
    throw new Error('Private or internal IP addresses are not allowed.');
  }

  return parsed;
}

async function assertSafeOutboundUrlResolved(rawUrl, options = {}) {
  const parsed = assertSafeOutboundUrl(rawUrl, options);
  if (net.isIP(parsed.hostname)) return parsed;

  const records = await dns.lookup(parsed.hostname, { all: true });
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new Error('URL resolves to a private or internal IP address.');
    }
  }
  return parsed;
}

module.exports = {
  assertSafeOutboundUrl,
  assertSafeOutboundUrlResolved,
  isBlockedIp,
  isPrivateIpv4
};
