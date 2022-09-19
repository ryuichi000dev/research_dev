const socket = io.connect() //クライアントからサーバーへ接続要求(サーバーでconnectionイベント発生)
let processor = null //音声処理用？のオブジェクト？（関数によって使い分け）
let localstream = null //音声データ用？のオブジェクト？

function startRecording() {
    console.log('start recording')
    context = new window.AudioContext() //AudioContext:オーディオに関するWebAPI？ IE未対応？
    socket.emit('start', { 'sampleRate': context.sampleRate })

    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => { //ブラウザからメディアデバイス（オーディオやビデオ）へアクセスするWebAPI
        localstream = stream
        const input = this.context.createMediaStreamSource(stream) //streamがグローバル変数であることを示す？this=windowとなってる。
                                                                   //入力点となるノードにMediaStreamAudioSourceNodeインスタンスを使用する。
        processor = context.createScriptProcessor(4096, 1, 1) //音声処理のためのインスタンス(ScriptProcessorNode)作成（バッファサイズ,入力チャンネル数,出力チャンネル数）

        input.connect(processor) //入力input(AudioDestinationNode)と音声処理processor(ScriptProcessorNode)を接続
        processor.connect(context.destination) //コンテキストのすべての音声の最終的な行き先を示すAudioDestinationNodeを戻す => connectでprocessorと出力AudioDestinationNode接続

        processor.onaudioprocess = (e) => { //onaudioprocessイベントの発生。ここのeはイベントのこと。
            const voice = e.inputBuffer.getChannelData(0) //getChannelDataメソッドによって, 入力ノードからFloat32Array型配列への参照を取得.
            //console.log(voice.buffer)
            socket.emit('send_pcm', voice.buffer) //voice.bufferのデータをサーバーに送り、send_pcmを発火
        }
    }).catch((e) => { //エラーをキャッチ
        // "DOMException: Rrequested device not found" will be caught if no mic is available
        console.log(e)
    })
}

function stopRecording() {
    console.log('stop recording')
    processor.disconnect() //onaudioprocessイベントの停止（processor.disconnect(0）
    processor.onaudioprocess = null //onaudioprocessイベントの停止（onaudioprocessイベントハンドラのクリア）
    processor = null //processorを初期化
    localstream.getTracks().forEach((track) => { //マイクをキャプチャ状態から解放
        track.stop()
    })
    socket.emit('stop', '', (res) => {
        console.log(`Audio data is saved as ${res.filename}`)
        console.log(`${res.name}`)
        //録音を再生
        this.sound = new Audio()
        this.sound.src = `../wav/${res.name}`
        this.sound.load()
        this.sound.play()
            .then(() => {
                // Audio is playing.
            })
            .catch(error => {
                console.log(error);
            });
    })
    
}
