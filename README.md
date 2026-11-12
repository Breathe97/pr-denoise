# pr-denoise

基于 [GTCRN](https://github.com/Xiaobin-Rong/gtcrn) 的浏览器实时降噪引擎，供 [pr-audio-stream](https://www.npmjs.com/package/pr-audio-stream) 使用。

## 特点

- **体积小**：wasm 仅约 197KB（对比 RNNoise 的 3.6MB）
- **零运行时依赖**：wasm 与 worklet 在构建时内联进 `index.js`，不依赖 CDN、不发任何外部请求
- **16kHz / 48kHz 原生处理**：48kHz 下帧长 768 样本（16ms），16kHz 下 256 样本
- **多声道安全**：默认 `maxChannels: 2`，不会把立体声输入压成单声道

## 安装

```bash
npm i pr-denoise
```

## 使用

```ts
import { PrAudioStream } from 'pr-audio-stream'
import { prDenoise } from 'pr-denoise'

// GTCRN 只支持 16kHz / 48kHz，AudioContext 采样率必须在其支持范围内
const audioContext = new AudioContext({ sampleRate: 48000 })
const prAudio = new PrAudioStream(audioContext, stream)

// 注入降噪引擎
prAudio.use({ denoise: prDenoise })

// 开启降噪（采样率不支持时只告警不开启）
await prAudio.setDenoise(true)

// 关闭降噪
await prAudio.setDenoise(false)
```

## API

`DenoiseWorklet` 由 `PrAudioStream.use()` 内部实例化，正常情况下不需要直接调用。

| 成员 | 说明 |
|---|---|
| `new DenoiseWorklet(audioContext)` | 构造，只缓存上下文，不加载资源 |
| `DenoiseWorklet.isSupported(audioContext)` | 当前采样率是否被支持（16k / 48k） |
| `createDenoiseWorkletNode()` | 加载模块与 wasm，返回 `AudioWorkletNode` |
| `destroy()` | 断开连接并通知 processor 释放资源 |

节点创建参数：

| 参数 | 值 |
|---|---|
| `processorOptions.maxChannels` | `2` |
| `processorOptions.wasmBinary` | 首次 `fetch` 后缓存复用 |

同一 `AudioContext` 只注册一次 processor，反复开关降噪不会重复加载。

## 目录结构

```
src/
├── gtcrn/
│   ├── gtcrn.wasm                     197 KB    GTCRN 模型
│   └── gtcrn-worklet-processor.js       8.9 KB  AudioWorklet 处理器
├── DenoiseWorklet.ts                  引擎封装
├── index.ts                           导出 prDenoise
└── vite-env.d.ts
```

构建产物只有 `dist/index.js`、`dist/index.umd.cjs` 和类型声明。`src/gtcrn/` 下的两个资源文件会被内联进产物（vite library 模式默认行为），不会额外输出文件。

## 限制

- **只支持 16kHz / 48kHz**：其它采样率下帧长与模型不匹配，worklet 会直接抛错
- **音色有损失**：GTCRN 是语音增强模型，会削掉部分高频细节，听感不如原声"厚"
- **响度衰减**：模型输出电平偏低，需要调用方自行做增益补偿
- **延迟**：16ms 帧长加上模型内部缓冲，总延迟比 RNNoise 高

## 许可

MIT。GTCRN 模型版权归 Copyright (c) 2024 Rong Xiaobin 所有，遵循 MIT License，声明保留在 `src/gtcrn/gtcrn-worklet-processor.js` 头部。

