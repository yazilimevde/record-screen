"use strict";

const constraints = { video: true, audio: true };

const shareBtn = document.querySelector("button#shareScreen");
const recBtn = document.querySelector("button#rec");
const stopBtn = document.querySelector("button#stop");
const downloadBtn = document.getElementById("downloadVideo");

const videoElement = document.querySelector("video");
let blobVideo = '';

videoElement.controls = false;

let mediaRecorder;
let chunks = [];
let localStream = null;
let soundMeter = null;
let micNumber = 0;
const dateObject = new Date();
const constraintsDate = {
  weekday: 'short', // long, short, narrow
  day: 'numeric', // numeric, 2-digit
  year: 'numeric', // numeric, 2-digit
  month: 'long', // numeric, 2-digit, long, short, narrow
  hour: 'numeric', // numeric, 2-digit
  minute: 'numeric', // numeric, 2-digit
  second: 'numeric', // numeric, 2-digit
};
const date = dateObject.toLocaleString('tr', constraintsDate);

function onShareScreen() {
  if (!navigator.mediaDevices.getDisplayMedia) {
    alert(
      "navigator.mediaDevices.getDisplayMedia tarayıcınız tarafından desteklenmiyor, Firefox veya Chrome'un en son sürümünü kullanın"
    );
  } else {
    if (window.MediaRecorder == undefined) {
      alert(
        "MediaRecorder tarayıcınızda desteklenmiyor, Firefox veya Chrome'un en son sürümünü kullanın"
      );
    } else {
      navigator.mediaDevices.getDisplayMedia(constraints).then(function(screenStream) {
          //check for microphone
          navigator.mediaDevices.enumerateDevices().then(function(devices) {
              devices.forEach(function(device) {
                if (device.kind == "audioinput") {
                  micNumber++;
                }
              });

              if (micNumber == 0) {
                getStreamSuccess(screenStream);
              } else {
                navigator.mediaDevices.getUserMedia({audio: true}).then(function(micStream) {
                    var composedStream = new MediaStream();

                    //added the video stream from the screen
                    screenStream.getVideoTracks().forEach(function(videoTrack) {
                      composedStream.addTrack(videoTrack);
                    });

                    //if system audio has been shared
                    if (screenStream.getAudioTracks().length > 0) {
                      //merge the system audio with the mic audio
                      var context = new AudioContext();
                      var audioDestination = context.createMediaStreamDestination();

                      const systemSource = context.createMediaStreamSource(screenStream);
                      const systemGain = context.createGain();
                      systemGain.gain.value = 1.0;
                      systemSource.connect(systemGain).connect(audioDestination);
                      console.log("added system audio");

                      if (micStream && micStream.getAudioTracks().length > 0) {
                        const micSource = context.createMediaStreamSource(micStream);
                        const micGain = context.createGain();
                        micGain.gain.value = 1.0;
                        micSource.connect(micGain).connect(audioDestination);
                        console.log("added mic audio");
                      }

                      audioDestination.stream.getAudioTracks().forEach(function(audioTrack) {
                          composedStream.addTrack(audioTrack);
                        });
                    } else {
                      //add just the mic audio
                      micStream.getAudioTracks().forEach(function(micTrack) {
                        composedStream.addTrack(micTrack);
                      });
                    }
                    
                  getStreamSuccess(composedStream);
                  alert('Başlatmak istediğinizde Kayıt butonuna basınız.');
                  })
                  .catch(function(err) {
                    log("navigator.getUserMedia error: " + err);
                  });
              }
            })
            .catch(function(err) {
              log(err.name + ": " + err.message);
            });
        })
        .catch(function(err) {
          log("navigator.getDisplayMedia error: " + err);
        });
    }
  }
}

function getStreamSuccess(stream) {
  localStream = stream;
  localStream.getTracks().forEach(function(track) {
    if (track.kind == "audio") {
      track.onended = function(event) {
        log("audio track.onended Audio track.readyState=" + track.readyState + ", track.muted=" + track.muted);
      };
    }
    if (track.kind == "video") {
      track.onended = function(event) {
        log("video track.onended Audio track.readyState=" + track.readyState + ", track.muted=" + track.muted);
      };
    }
  });

/*   videoElement.srcObject = localStream;
  videoElement.play();
  videoElement.muted = true; */
  recBtn.disabled = false;
  shareBtn.disabled = true;

  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    window.audioContext = new AudioContext();
  } catch (e) {
    log("Web Audio API not supported.");
  }

  soundMeter = window.soundMeter = new SoundMeter(window.audioContext);
  soundMeter.connectToSource(localStream, function(e) {
    if (e) {
      log(e);
      return;
    }
  });
}

function onBtnRecordClicked() {
  if (localStream == null) {
    alert("Could not get local stream from mic/camera");
  } else {
    recBtn.disabled = true;
    stopBtn.disabled = false;
    var x = document.getElementById("alert-p");
      x.style.display = "block";
    /* use the stream */
    log("Start recording...");
    if (typeof MediaRecorder.isTypeSupported == "function") {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        var options = { mimeType: "video/webm;codecs=vp9" };
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=h264")) {
        var options = { mimeType: "video/webm;codecs=h264" };
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        var options = { mimeType: "video/webm;codecs=vp8" };
      }
      log("Using " + options.mimeType);
      mediaRecorder = new MediaRecorder(localStream, options);
    } else {
      log("isTypeSupported is not supported, using default codecs for browser");
      mediaRecorder = new MediaRecorder(localStream);
    }

    mediaRecorder.ondataavailable = function(e) {
      chunks.push(e.data);
    };

    mediaRecorder.onerror = function(e) {
      log("mediaRecorder.onerror: " + e);
    };

    mediaRecorder.onstart = function() {
      log("mediaRecorder.onstart, mediaRecorder.state = " + mediaRecorder.state);

      localStream.getTracks().forEach(function(track) {
        if (track.kind == "audio") {
          log("onstart - Audio track.readyState=" + track.readyState + ", track.muted=" + track.muted);
        }
        if (track.kind == "video") {
          log("onstart - Video track.readyState=" + track.readyState + ", track.muted=" + track.muted);
        }
      });
    };

    mediaRecorder.onstop = function() {
      log("mediaRecorder.onstop, mediaRecorder.state = " + mediaRecorder.state);

      blobVideo = new Blob(chunks, { type: "video/webm" });
      chunks = [];

      var videoURL = window.URL.createObjectURL(blobVideo);

      // downloadVideo.href = videoURL;
      videoElement.src = videoURL;
      // downloadVideo.innerHTML = "Download video file";

      var rand = Math.floor(Math.random() * 10000000);
      var name = "video_" + rand + ".webm";

/*       downloadVideo.setAttribute("download", name);
      downloadVideo.setAttribute("name", name); */
    };

    mediaRecorder.onwarning = function(e) {
      log("mediaRecorder.onwarning: " + e);
    };

    mediaRecorder.start(10);

    localStream.getTracks().forEach(function(track) {
      log(track.kind + ":" + JSON.stringify(track.getSettings()));
      console.log(track.getSettings());
    });
  }
}

function onBtnDownloadVideo() {

  // Crear una URL o enlace para descargar
  const urlParaDescargar = URL.createObjectURL(blobVideo);
  // Crear un elemento <a> invisible para descargar el audio
  let a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = urlParaDescargar;
  a.download = `${date}.webm`;
  // Hacer click en el enlace
  a.click();
  // Y remover el objeto
  window.URL.revokeObjectURL(urlParaDescargar);
}

function onBtnStopClicked() {
  mediaRecorder.stop();
  videoElement.controls = true;
  recBtn.disabled = false;
  stopBtn.disabled = true;
  downloadBtn.disabled = false;
}

function onStateClicked() {
  if (mediaRecorder != null && localStream != null && soundMeter != null) {
    log("mediaRecorder.state=" + mediaRecorder.state);
    log("mediaRecorder.mimeType=" + mediaRecorder.mimeType);
    log("mediaRecorder.videoBitsPerSecond=" + mediaRecorder.videoBitsPerSecond);
    log("mediaRecorder.audioBitsPerSecond=" + mediaRecorder.audioBitsPerSecond);

    localStream.getTracks().forEach(function(track) {
      if (track.kind == "audio") {
        log("Audio: track.readyState=" + track.readyState + ", track.muted=" + track.muted);
      }
      if (track.kind == "video") {
        log("Video: track.readyState=" + track.readyState + ", track.muted=" + track.muted);
      }
    });

    log("Audio activity: " + Math.round(soundMeter.instant.toFixed(2) * 100));
  }
}

function log(message) {
  console.log(message);
}

// Meter class that generates a number correlated to audio volume.
// The meter class itself displays nothing, but it makes the
// instantaneous and time-decaying volumes available for inspection.
// It also reports on the fraction of samples that were at or near
// the top of the measurement range.
function SoundMeter(context) {
  this.context = context;
  this.instant = 0.0;
  this.slow = 0.0;
  this.clip = 0.0;
  this.script = context.createScriptProcessor(2048, 1, 1);
  var that = this;
  this.script.onaudioprocess = function(event) {
    var input = event.inputBuffer.getChannelData(0);
    var i;
    var sum = 0.0;
    var clipcount = 0;
    for (i = 0; i < input.length; ++i) {
      sum += input[i] * input[i];
      if (Math.abs(input[i]) > 0.99) {
        clipcount += 1;
      }
    }
    that.instant = Math.sqrt(sum / input.length);
    that.slow = 0.95 * that.slow + 0.05 * that.instant;
    that.clip = clipcount / input.length;
  };
}

SoundMeter.prototype.connectToSource = function(stream, callback) {
  console.log("SoundMeter connecting");
  try {
    this.mic = this.context.createMediaStreamSource(stream);
    this.mic.connect(this.script);
    // necessary to make sample run, but should not be.
    this.script.connect(this.context.destination);
    if (typeof callback !== "undefined") {
      callback(null);
    }
  } catch (e) {
    console.error(e);
    if (typeof callback !== "undefined") {
      callback(e);
    }
  }
};
SoundMeter.prototype.stop = function() {
  this.mic.disconnect();
  this.script.disconnect();
};
