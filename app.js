const express = require('express') //サーバー
const http = require('http') //httpサーバーの構築
const path = require('path') //ファイルパスからディレクトリ名の取得などパス関係
const socketio = require('socket.io') //サーバー・クライアント通信
const WavEncoder = require('wav-encoder') //wav保存
const fs = require('fs') //ファイルの新規作成などファイル関係
const app = express()

app.use('/', express.static(path.join(__dirname, 'public'))) //現ディレクトリ/publicで静的ファイルを使用

//serverを構築(引数にexpressのサーバーオブジェクトを指定)(listenまで一気に書いている)
server = http.createServer(app).listen(3000, function() {
    console.log('Example app listening on port 3000')
})

// WebSocket サーバを起動(httpサーバーにソケットを紐づけ。引数にhttpのサーバーオブジェクトを指定)
const io = socketio(server)

// クライアントが接続したときの処理(onメソッド：'connection'の時、第二引数の関数が動く)
io.on('connection', (socket) => {
    let sampleRate = 48000
    let buffer = []

    // 録音開始の合図を受け取ったときの処理
    socket.on('start', (data) => {
        buffer = [] //連続動作のためbufferを開放
        sampleRate = data.sampleRate
        console.log(`Sample Rate: ${sampleRate}`)
    })

    // PCM データを受信したときの処理(音声処理を行うときはここで)
    socket.on('send_pcm', (data) => {
        // data: { "1": 11, "2": 29, "3": 33, ... }のような形をしている => 配列の形に変えていく
        const itr = data.values()  //itr:iterator(イテレーター)、nextメソッドを持つ。配列関係のやつ
        const buf = new Array(data.length)  //dataの長さの配列を作る
        for (var i = 0; i < buf.length; i++) { 
            buf[i] = itr.next().value  //dataの値をbuf配列に入れる
        }
        buffer = buffer.concat(buf)  //buffer配列とbuf配列を結合
        //console.log(buffer)
    })

    // 録音停止の合図を受け取ったときの処理
    socket.on('stop', (data, ack) => {
        const f32array = toF32Array(buffer) //bufferをFloat32Arrayにする
        //console.log(f32array)
        const name = `${String(Date.now())}.wav`
        const filename = `public/wav/${name}` //保存するファイル名を決める
        exportWAV(f32array, sampleRate, filename) //wavファイルを作成(下に関数定義)
        ack({ filename: filename , name: name}) //ack:socket通信での確認応答？でデータを返す
    })
})

// WavEncoderへ渡すデータをFloat32Arrayへ変換
const toF32Array = (buf) => {
    const buffer = new ArrayBuffer(buf.length) //bufの長さで物理メモリでのバッファを確保(直接読み書き不可？)
    const view = new Uint8Array(buffer) //つくったバッファの場所にUint8Arrayのインスタンスを作る(直接読み書き可能) 
    for (var i = 0; i < buf.length; i++) {
        view[i] = buf[i]
    }
    return new Float32Array(buffer)  //書き込まれたバッファをf32Arrayで返す
}

//data: Float32Array,  sampleRate: number,  filename: string
//wavファイルにエンコード(符号化)？ 　
const exportWAV = (data, sampleRate, filename) => {
    const audioData = { //audioDataという配列を作る
        sampleRate: sampleRate,
        channelData: [data]
    }
    WavEncoder.encode(audioData).then((buffer) => {
        fs.writeFile(filename, Buffer.from(buffer), (e) => { //bufferの文字列をバッファに変換し、そのデータをファイルに保存
            if (e) {
                console.log(e) //エラーを表示
            } else {
                console.log(`Successfully saved ${filename}`)
            }
        })
    })
}