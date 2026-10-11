#!/usr/bin/env python3
"""Replace a string in resources.arsc UTF-8 string pool (aapt varlen encoding)."""
import struct, sys

def read_varlen(buf, off):
    b = buf[off]
    if b & 0x80:
        return ((b & 0x7F) << 8) | buf[off + 1], off + 2
    return b, off + 1

def write_varlen(n):
    if n < 0x80:
        return bytes([n])
    return bytes([0x80 | (n >> 8), n & 0xFF])

def main(arsc_path, old, new, out_path):
    buf = bytearray(open(arsc_path, 'rb').read())
    assert struct.unpack_from('<H', buf, 0)[0] == 0x0002
    pos = 12
    found = False
    while pos < len(buf):
        ctype, hsize, csize = struct.unpack_from('<HHI', buf, pos)
        if ctype == 0x0001:  # string pool
            scount, stcount, flags, sstart, _ = struct.unpack_from('<IIIII', buf, pos + 8)
            assert stcount == 0, 'styled pool unsupported'
            assert flags & 0x100, 'only UTF-8 pool supported'
            offs = list(struct.unpack_from('<%dI' % scount, buf, pos + 28))
            strings = []
            for o in offs:
                p = pos + sstart + o
                nch, p = read_varlen(buf, p)
                nby, p = read_varlen(buf, p)
                s = bytes(buf[p:p + nby]).decode('utf-8')
                assert len(s) == nch
                strings.append(s)
            if old in strings:
                strings = [new if s == old else s for s in strings]
                data = b''
                new_offs = []
                for s in strings:
                    new_offs.append(len(data))
                    b = s.encode('utf-8')
                    data += write_varlen(len(s)) + write_varlen(len(b)) + b + b'\x00'
                while len(data) % 4:
                    data += b'\x00'
                new_chunk = struct.pack('<HHI', ctype, hsize, 0)
                new_chunk += struct.pack('<IIIII', scount, stcount, flags, sstart, 0)
                for o in new_offs:
                    new_chunk += struct.pack('<I', o)
                new_chunk += data
                new_chunk = bytearray(new_chunk)
                struct.pack_into('<I', new_chunk, 4, len(new_chunk))
                buf[pos:pos + csize] = new_chunk
                struct.pack_into('<I', buf, 4, len(buf))
                found = True
                pos += len(new_chunk)
                continue
        if csize <= 0:
            break
        pos += csize
    if not found:
        raise SystemExit('string not found: %r' % old)
    open(out_path, 'wb').write(bytes(buf))
    print('patched OK, new size %d' % len(buf))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
