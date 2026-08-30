/**
 * ZXing-C++ WebAssembly fallback. Ładowany po głównej kaskadzie JavaScript ZXing.
 */
(function () {
  let ready;

  async function load() {
    if (ready) return ready;
    if (!window.ZXingWASM) throw new Error('ZXing-C++ WASM nie został załadowany');
    ready = window.ZXingWASM.prepareZXingModule({
      overrides: {
        locateFile: () => '/vendor/zxing/zxing_reader.wasm',
      },
    });
    await ready;
    return window.ZXingWASM;
  }

  async function decode(canvas) {
    const zxing = await load();
    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const results = await zxing.readBarcodes(imageData, {
      formats: ['Aztec'],
      tryHarder: true,
      maxNumberOfSymbols: 1,
    });
    return results[0]?.text || null;
  }

  window.TaxOrderZxingCpp = { decode };
})();
