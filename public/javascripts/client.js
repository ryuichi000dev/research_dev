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

window.addEventListener('load', () => {
  const f = document.getElementById('file1');
  f.addEventListener('change', evt => {
    let input = evt.target;
    if (input.files.length == 0) {
      return;
    }
    const file = input.files[0];
    if (!file.type.match('audio.*')) {
      alert("音声ファイルを選択してください。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      var saisinid = reader.result;
      var element = document.getElementById("saisin_id");
      element.setAttribute("src", saisinid);
    };
    reader.readAsDataURL(file);
  });
});


window.addEventListener('DOMContentLoaded', function(){

    const btn_play = document.getElementById("btn_play");
    const btn_pause = document.getElementById("btn_pause");
    const playback_position = document.getElementById("playback_position");
    const end_position = document.getElementById("end_position");
    // const slider_progress = document.getElementById("progress");
    const slider_progress = document.getElementById("seekbar");
    const audioElement = document.querySelector("audio");
    var repeat_count = document.getElementById("repeat_count");
  
    var playtimer = null;
    var start_time;
    var stop_time;
    var rec_time;
  
    // 再生開始したときに実行
    const startTimer = function(){
      start_time = audioElement.currentTime;
      console.log(start_time);
      playback_position.textContent = convertTime(audioElement.currentTime);
      console.log(playback_position);
      playtimer = setInterval(function(){ //500msごとに以下の処理を実行
        playback_position.textContent = convertTime(audioElement.currentTime); //テキストとしてcurrentTimeを保持（現在の再生位置を時刻として表示）
        slider_progress.value = Math.floor( (audioElement.currentTime / audioElement.duration) * audioElement.duration);
      }, 500); //プログレスバーとして視覚的な再生位置を表示

      return start_time;
    };

    
    
    const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );

    // 停止したときに実行
    const stopTimer = async function(){
      stop_time = audioElement.currentTime;
      console.log(stop_time);
      clearInterval(playtimer); //setIntervalメソッドによる定期的な処理を停止
      playback_position.textContent = convertTime(audioElement.currentTime);
      
      
      rec_time = stop_time - start_time;
      console.log(rec_time);
      var rec_time_ms = rec_time * 1000

      var rep_count = repeat_count.value;
      var through_count = 0;

      while(rep_count > 0){
        //教材音声再生
        
        if(through_count > 0){
          audioElement.currentTime = start_time;
          audioElement.play();
          await sleep(rec_time_ms);
          audioElement.pause();
        };

        //レコーディング&フィードバック
        startRecording();
        await sleep(rec_time_ms);
        stopRecording();
        await sleep(rec_time_ms);
        console.log("repeat!");
        console.log(rep_count);
        
        through_count ++;
        console.log(through_count);
        rep_count --;
      };
      
      //return stop_time;
    };
  
    // 再生時間の表記を「mm:ss」に整える
    const convertTime = function(time_position) {
      
      time_position = Math.floor(time_position);
      var res_time = null;
  
      if( 60 <= time_position ) {
        res_time = Math.floor(time_position / 60);
        res_time += ":" + Math.floor(time_position % 60).toString().padStart( 2, '0');
      } else {
        res_time = "0:" + Math.floor(time_position % 60).toString().padStart( 2, '0');
      }
  
      return res_time;
    };
  
    // 音声ファイルの再生準備が整ったときに実行
    audioElement.addEventListener('loadeddata', (e)=> {
      slider_progress.max = audioElement.duration;
  
      playback_position.textContent = convertTime(audioElement.currentTime);
      end_position.textContent = convertTime(audioElement.duration);
    });
  
    // 音声ファイルが最後まで再生されたときに実行
    audioElement.addEventListener("ended", e => {
      stopTimer();
    });
  
    // 再生ボタンが押されたときに実行
    btn_play.addEventListener("click", e => {
      audioElement.play();
      startTimer();
    });
  
    // 一時停止ボタンが押されたときに実行
    btn_pause.addEventListener("click", e => {
      audioElement.pause();
      stopTimer();
    });
  
    // プログレスバーが操作されたときに実行（メモリを動かしているとき）
    slider_progress.addEventListener("input", e => {
      stopTimer();
      audioElement.currentTime = slider_progress.value;
    });
  
    // プログレスバーが操作完了したときに実行
    slider_progress.addEventListener("change", e => {
      startTimer();
    });



    //繰り返し回数指定
    //var repeat_count = document.getElementById("repeat_count");
    console.log(repeat_count.value);

    repeat_count.addEventListener("change", e => {
      console.log(repeat_count.value)
    });
  
});


