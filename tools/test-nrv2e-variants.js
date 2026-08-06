'use strict';
/**
 * Referencja historyczna — eksperymenty z wariantami NRV2E dla Aztec DR.
 * Testuje 5 implementacji (A–E): MSB/LSB × off*2 / (off-1)*2 × czytanie bajtów.
 * Wariant E (LSB, off*2) okazał się poprawny dla polskich DR — wynik trafił
 * do dr-extractor.js jako nrv2eDecompress(). Plik zachowany jako dowód pracy.
 *
 * Wymaga: sharp, zxing-wasm  (npm install w katalogu projektu)
 * Narzędzie lokalne — nie uruchamiać na CI.
 *
 * Użycie:
 *   node tools/test-nrv2e-variants.js <obraz.png>
 *
 *   obraz.png — PNG lub JPG zawierający kod Aztec (np. proc-threshold128.png
 *               wygenerowany przez dr-extractor w trybie debug).
 */
const sharp = require('sharp');
const path = require('path');

const FILE = (() => {
  const p = process.argv[2];
  if (!p) {
    console.error('BŁĄD: Podaj ścieżkę do obrazu PNG/JPG z kodem Aztec.');
    console.error('Użycie: node tools/test-nrv2e-variants.js <obraz.png>');
    process.exit(1);
  }
  if (!require('fs').existsSync(p)) { console.error(`BŁĄD: Plik nie istnieje: ${p}`); process.exit(1); }
  return p;
})();

// Wariant A: oryginalny (MSB-first, readByte przez bity, (off-1)*2)
function decompA(input, outputLen) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  class BitReader {
    constructor(b) { this.buf=b; this.pos=0; this.bit=8; this.byte=0; }
    get ended() { return this.pos>=this.buf.length && this.bit>=8; }
    readBit() {
      if (this.bit>=8) { this.byte=this.buf[this.pos++]||0; this.bit=0; }
      return (this.byte>>(7-this.bit++))&1;
    }
    readByte() { let b=0; for(let i=7;i>=0;i--) b|=this.readBit()<<i; return b; }
  }
  const out=new Uint8Array(outputLen), r=new BitReader(buf);
  let p=0, lastOff=1;
  while(!r.ended && p<outputLen) {
    if(r.readBit()===1){out[p++]=r.readByte();continue;}
    let off=1,len=0;
    for(;;){off=off*2+r.readBit();if(r.readBit()===1)break;off=(off-1)*2+r.readBit();}
    if(off===2){off=lastOff;len=r.readBit();}
    else{off=(off-3)*0x100+r.readByte();if(off===0xffffffff)break;len=(off^0xffffffff)&1;off>>=1;lastOff=++off;}
    if(len){len=1+r.readBit();}else if(r.readBit()===1){len=3+r.readBit();}
    else{len++;do{len=len*2+r.readBit();}while(r.readBit()===0);len+=3;}
    if(off>0x500)len++;
    let src=p-off; if(src<0)throw new Error('off invalid src='+src+' p='+p+' off='+off);
    for(let i=0;i<=len&&p<outputLen;i++)out[p++]=out[src++];
  }
  return out.slice(0,p);
}

// Wariant B: MSB-first, readByte bezpośrednio, (off-1)*2 (NRV2B?)
function decompB(input, outputLen) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let pos=0, bitBuf=0, bitCnt=0;
  function getBit() {
    if(bitCnt===0){bitBuf=buf[pos++]||0;bitCnt=8;}
    return (bitBuf>>(--bitCnt))&1;  // MSB first
  }
  function getByte() { return buf[pos++]||0; }
  const out=new Uint8Array(outputLen);
  let p=0, lastOff=1;
  while(pos<buf.length && p<outputLen) {
    if(getBit()===1){out[p++]=getByte();continue;}
    let off=1,len=0;
    for(;;){off=off*2+getBit();if(getBit()===1)break;off=(off-1)*2+getBit();}
    if(off===2){off=lastOff;len=getBit();}
    else{off=(off-3)*0x100+getByte();if(off===0xffffffff)break;len=(off^0xffffffff)&1;off>>=1;lastOff=++off;}
    if(len){len=1+getBit();}else if(getBit()===1){len=3+getBit();}
    else{len++;do{len=len*2+getBit();}while(getBit()===0);len+=3;}
    if(off>0x500)len++;
    let src=p-off; if(src<0)throw new Error('off invalid src='+src+' p='+p+' off='+off);
    for(let i=0;i<=len&&p<outputLen;i++)out[p++]=out[src++];
  }
  return out.slice(0,p);
}

// Wariant C: MSB-first, readByte bezpośrednio, off*2 (NRV2E MSB)
function decompC(input, outputLen) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let pos=0, bitBuf=0, bitCnt=0;
  function getBit() {
    if(bitCnt===0){bitBuf=buf[pos++]||0;bitCnt=8;}
    return (bitBuf>>(--bitCnt))&1;
  }
  function getByte() { return buf[pos++]||0; }
  const out=new Uint8Array(outputLen);
  let p=0, lastOff=1;
  while(pos<buf.length && p<outputLen) {
    if(getBit()===1){out[p++]=getByte();continue;}
    let off=1,len=0;
    for(;;){off=off*2+getBit();if(getBit()===1)break;off=off*2+getBit();}  // NRV2E: off*2+bit
    if(off===2){off=lastOff;len=getBit();}
    else{off=(off-3)*0x100+getByte();if(off===0xffffffff)break;len=(off^0xffffffff)&1;off>>=1;lastOff=++off;}
    if(len){len=1+getBit();}else if(getBit()===1){len=3+getBit();}
    else{len++;do{len=len*2+getBit();}while(getBit()===0);len+=3;}
    if(off>0x500)len++;
    let src=p-off; if(src<0)throw new Error('off invalid src='+src+' p='+p+' off='+off);
    for(let i=0;i<=len&&p<outputLen;i++)out[p++]=out[src++];
  }
  return out.slice(0,p);
}

// Wariant D: LSB-first (UCL), readByte bezpośrednio, (off-1)*2 (NRV2B LSB)
function decompD(input, outputLen) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let pos=0, bits=1;
  function getBit() {
    if(bits===1){if(pos>=buf.length)return 0;bits=(buf[pos++]&0xFF)|0x100;}
    const b=bits&1; bits>>>=1; return b;
  }
  function getByte() { return buf[pos++]||0; }
  const out=new Uint8Array(outputLen);
  let p=0, lastOff=1;
  while(pos<buf.length && p<outputLen) {
    if(getBit()===1){out[p++]=getByte();continue;}
    let off=1,len=0;
    for(;;){off=off*2+getBit();if(getBit()===1)break;off=(off-1)*2+getBit();}
    if(off===2){off=lastOff;len=getBit();}
    else{off=(off-3)*0x100+getByte();if(off===0xffffffff)break;len=(off^0xffffffff)&1;off>>=1;lastOff=++off;}
    if(len){len=1+getBit();}else if(getBit()===1){len=3+getBit();}
    else{len++;do{len=len*2+getBit();}while(getBit()===0);len+=3;}
    if(off>0x500)len++;
    let src=p-off; if(src<0)throw new Error('off invalid src='+src+' p='+p+' off='+off);
    for(let i=0;i<=len&&p<outputLen;i++)out[p++]=out[src++];
  }
  return out.slice(0,p);
}

// Wariant E: LSB-first (UCL), readByte bezpośrednio, off*2 (NRV2E LSB — "prawdziwy")
function decompE(input, outputLen) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let pos=0, bits=1;
  function getBit() {
    if(bits===1){if(pos>=buf.length)return 0;bits=(buf[pos++]&0xFF)|0x100;}
    const b=bits&1; bits>>>=1; return b;
  }
  function getByte() { return buf[pos++]||0; }
  const out=new Uint8Array(outputLen);
  let p=0, lastOff=1;
  while(pos<buf.length && p<outputLen) {
    if(getBit()===1){out[p++]=getByte();continue;}
    let off=1,len=0;
    for(;;){off=off*2+getBit();if(getBit()===1)break;off=off*2+getBit();}
    if(off===2){off=lastOff;len=getBit();}
    else{off=(off-3)*0x100+getByte();if(off===0xffffffff)break;len=(off^0xffffffff)&1;off>>=1;lastOff=++off;}
    if(len){len=1+getBit();}else if(getBit()===1){len=3+getBit();}
    else{len++;do{len=len*2+getBit();}while(getBit()===0);len+=3;}
    if(off>0x500)len++;
    let src=p-off; if(src<0)throw new Error('off invalid src='+src+' p='+p+' off='+off);
    for(let i=0;i<=len&&p<outputLen;i++)out[p++]=out[src++];
  }
  return out.slice(0,p);
}

function tryDecomp(label, fn, compressed, outputLen) {
  try {
    const result = fn(compressed, outputLen);
    const text = Buffer.from(result).toString('utf16le');
    const fields = text.split(/[|\n]/);
    const hasVin = fields.some(f => /^[A-HJ-NPR-Z0-9]{17}$/i.test(f.trim()));
    const vinField = fields.find(f => /^[A-HJ-NPR-Z0-9]{17}$/i.test(f.trim()));
    console.log(`  ✓ ${label}: decomp=${result.length}B, fields=${fields.length}, VIN=${vinField || '?'}`);
    if (fields.length > 5) {
      const sample = fields.slice(0, 20).map((f,i)=>`[${i}]=${JSON.stringify(f.substring(0,15))}`).join(' ');
      console.log(`    Pola: ${sample}`);
    }
    return { ok: true, fields, text };
  } catch(e) {
    console.log(`  ✗ ${label}: ${e.message}`);
    return { ok: false };
  }
}

(async () => {
  const { data, info } = await sharp(FILE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const zxing = require('zxing-wasm');
  await zxing.prepareZXingModule();
  const results = await zxing.readBarcodesFromImageData(imgData, {
    formats: ['Aztec'], tryHarder: true, tryRotate: true, tryInvert: true,
  });

  const r = results[0];
  const rawText = r.text;

  // base64 decode
  const decoded = Buffer.from(rawText, 'base64');
  console.log(`base64: ${rawText.length} chars → ${decoded.length} bajtów`);

  const outputLen = decoded[0] | (decoded[1]<<8) | (decoded[2]<<16) | (decoded[3]*0x1000000);
  console.log(`outputLen = ${outputLen}`);

  const compressed = decoded.slice(4);
  console.log(`compressed = ${compressed.length} bajtów, hex[0:8]: ${compressed.slice(0,8).toString('hex')}\n`);

  console.log('Testowanie wariantów dekompresji:');
  tryDecomp('A: oryginalny (MSB, przez bity, (off-1)*2)', decompA, compressed, outputLen);
  tryDecomp('B: MSB-direct, (off-1)*2', decompB, compressed, outputLen);
  tryDecomp('C: MSB-direct, off*2 (NRV2E MSB)', decompC, compressed, outputLen);
  tryDecomp('D: LSB-direct, (off-1)*2 (NRV2B LSB)', decompD, compressed, outputLen);
  tryDecomp('E: LSB-direct, off*2 (NRV2E LSB)', decompE, compressed, outputLen);
})().catch(e => { console.error('BŁĄD:', e.stack); process.exit(1); });
