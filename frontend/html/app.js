var video = null;
var streaming = false;
var canvas = null;
var width = 320;
var height = 0;

var preview = null;
var loader = null;
var responseui = null;
var inference = null;


function sendRequest() {
  var context = canvas.getContext('2d');
  if (width && height) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    var data = canvas.toDataURL('image/jpeg');
    preview.setAttribute('src', data);
    preview.style.display = 'block';
  }

  showWebcamSendContainer(false);
  loader.style.display = 'block';
  responseui.value = '';
  responseui.style.display = 'none';
  let imageSrc = preview.src;
  if (imageSrc == null | imageSrc.length == 0) {
    resetUpload();
    alert('could not get image');
    return;
  }

  let index = imageSrc.indexOf(';base64,');
  if (index == -1) {
    resetUpload();
    alert('could not decode image');
    return;
  }
  index += ';base64,'.length;
  imageSrc = imageSrc.substring(index);
  let payload = {
    inputs: [{
      name: "dummy",
      shape: [-1],
      datatype: "BYTES",
      data: [imageSrc]
    }]
  }

  fetch(
    '/v2/models/yolo/infer',
    {
      method: 'POST',
      referrer: '',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      showWebcamSendContainer(true);
      loader.style.display = 'none';
      responseui.value = '';
      responseui.style.display = 'block';
      return response.json();
    })
    .then(data => {
      if (data.outputs == null || data.outputs.length < 1 || data.outputs[0].data == null || data.outputs[0].data.length < 1) {
        responseui.value += '\ndid not get expected output';
        return;
      }
      const output = data.outputs[0].data[0];
      if (output.image != null) {
        preview.setAttribute('src', 'data:image/jpeg;charset=utf-8;base64,' + output.image);
      }
      if (output.inference == null) {
        inference.innerText = 'unknown';
      } else {
        inference.innerText = output.inference + ' ms';
      }
      if (output.detected != null) {
        responseui.value += JSON.stringify(output.detected);
      }
    })
    .catch(error => {
      responseui.value += '\nerror fetching stream: ' + error;
      loader.style.display = 'none';
      showWebcamSendContainer(true);
    });
}

function showWebcamSendContainer(show) {
  let container = document.getElementById('webcam-send-container');
  if (container == null) return;
  container.style.display = (show?'flex':'none');
}

function initializeVideo() {
  preview = document.getElementById('preview');
  loader = document.getElementById('loader');
  responseui = document.getElementById('response');
  inference = document.getElementById('inference');
  video = document.getElementById('video');
  video.onloadeddata = () => {
    width = video.videoWidth;
    height = video.videoHeight;

    preview.setAttribute('width', width);
    preview.setAttribute('height', height);
    preview.style.width = width;
    preview.style.height = height;
  }

  navigator.mediaDevices.getUserMedia({video: true, audio: false})
    .then(function(stream) {
      video.srcObject = stream;

      // for iOS - https://stackoverflow.com/a/47460448
      var promise = video.play();
      if (promise !== undefined) {
        promise.catch(error => {
          // auto-play prevented
          video.controls = true;
        }).then(() => {
          // auto-play ok
        });
      }
    })
    .catch(function(err) {
      console.log("An error occurred: " + err);
    });

    video.addEventListener('canplay', function(ev){
      if (!streaming) {
        height = video.videoHeight / (video.videoWidth/width);
      
        // Firefox currently has a bug where the height can't be read from
        // the video, so we will make assumptions if this happens.
      
        if (isNaN(height)) {
          height = width / (4/3);
        }

        streaming = true;

        // required for iOS - https://stackoverflow.com/a/69472600
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
      }
    }, false);

    canvas = document.getElementById('canvas');
}
