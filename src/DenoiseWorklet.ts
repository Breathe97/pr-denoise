import denoiseWorkletProcessorUrl from './gtcrn/gtcrn-worklet-processor.js?url'
import denoiseWasmUrl from './gtcrn/gtcrn.wasm?url'

// processor 注册名，必须与 src/gtcrn/gtcrn-worklet-processor.js 内 registerProcessor 一致
const PROCESSOR_NAME = '@sapphi-red/web-noise-suppressor/gtcrn'

// 默认支持的最大声道数，需要覆盖输入声道数，否则多通道会被丢掉、输出变单声道
const DEFAULT_MAX_CHANNELS = 2

// GTCRN 只吃 16k / 48k，其它采样率进 worklet 会直接抛错
const SUPPORTED_SAMPLE_RATES = [16000, 48000]

/**
 * GTCRN 降噪引擎
 * 48kHz 下帧长 768（16ms），48kHz / 16kHz 均支持，这里按 48kHz 使用
 * wasm 与 worklet 位于 src/gtcrn，构建时内联进产物，不依赖 CDN 或 npm 包运行时
 */
export class DenoiseWorklet {
  // 音频上下文实例
  audioContext: AudioContext

  // 降噪节点
  denoiseWorkletNode?: AudioWorkletNode

  // wasm 二进制缓存，避免重复下载
  denoiseWasmBinary?: ArrayBuffer

  // addModule 缓存，避免同一 context 重复注册 processor 报重名错
  private modulePromise?: Promise<void>

  private moduleAudioContext?: AudioContext

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  /**
   * 当前上下文的采样率是否被 GTCRN 支持（供 PrAudioStream.use() 做能力校验）
   */
  static isSupported = (audioContext: AudioContext) => {
    return SUPPORTED_SAMPLE_RATES.includes(audioContext.sampleRate)
  }

  /**
   * 创建降噪节点（PrAudioStream 通过 use() 注入后调用）
   */
  createDenoiseWorkletNode = async () => {
    this.destroy()

    // 同一 context 只注册一次 processor，反复开关降噪时复用
    if (!this.modulePromise || this.moduleAudioContext !== this.audioContext) {
      this.moduleAudioContext = this.audioContext
      this.modulePromise = this.audioContext.audioWorklet.addModule(denoiseWorkletProcessorUrl).catch((error) => {
        // 注册失败清缓存，允许下次重试
        this.modulePromise = undefined
        throw error
      })
    }
    await this.modulePromise

    // wasm 只拉一次，后续复用
    if (!this.denoiseWasmBinary) {
      const response = await fetch(denoiseWasmUrl)
      if (!response.ok) throw new Error(`GTCRN wasm 加载失败：${response.status} ${denoiseWasmUrl}`)
      this.denoiseWasmBinary = await response.arrayBuffer()
    }

    this.denoiseWorkletNode = new AudioWorkletNode(this.audioContext, PROCESSOR_NAME, {
      processorOptions: { maxChannels: DEFAULT_MAX_CHANNELS, wasmBinary: this.denoiseWasmBinary }
    })

    return this.denoiseWorkletNode
  }

  /**
   * 销毁节点并释放 processor 侧资源
   */
  destroy = () => {
    this.denoiseWorkletNode?.disconnect()
    // 与 worklet processor 约定：发字符串 'destroy' 让它自行释放
    this.denoiseWorkletNode?.port.postMessage('destroy')
    this.denoiseWorkletNode = undefined
  }
}
