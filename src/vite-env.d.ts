/// <reference types="vite/client" />

// The WebAssembly-only build of ONNX Runtime Web has the same API as the main entry point.
declare module 'onnxruntime-web/wasm' {
  export * from 'onnxruntime-web';
}
