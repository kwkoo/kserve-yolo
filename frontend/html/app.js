var video = null;
var streaming = false;
var canvas = null;
var width = 320;
var height = 0;


function sendRequest() {
  var context = canvas.getContext('2d');
  if (width && height) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    var data = canvas.toDataURL('image/jpeg');
    document.getElementById('preview').setAttribute('src', data);
    document.getElementById('preview').style.display = 'block';
  }

  showWebcamSendContainer(false);
  document.getElementById('loader').style.display = 'block';
  let responseui = document.getElementById('response');
  responseui.value = '';
  responseui.style.display = 'none';
  let imageSrc = document.getElementById('preview').src;
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
      document.getElementById('loader').style.display = 'none';
      let responseui = document.getElementById('response');
      responseui.value = '';
      responseui.style.display = 'block';
      return response.json();
    })
    .then(data => {
      if (data.outputs == null || data.outputs.length < 1 || data.outputs[0].data == null || data.outputs[0].data.length < 1) {
        document.getElementById('response').value += '\ndid not get expected output';
        return;
      }
      const output = data.outputs[0].data[0];
      if (output.image != null) {
        document.getElementById('preview').setAttribute('src', 'data:image/jpeg;charset=utf-8;base64,' + output.image);
      }
      if (output.detected != null) {
        document.getElementById('response').value += JSON.stringify(output.detected);
      }
    })
    .catch(error => {
      document.getElementById('response').value += '\nerror fetching stream: ' + error;
      document.getElementById('loader').style.display = 'none';
      showWebcamSendContainer(true);
    });
}

function showWebcamSendContainer(show) {
  let container = document.getElementById('webcam-send-container');
  if (container == null) return;
  container.style.display = (show?'flex':'none');
}

function initializeVideo() {
  video = document.getElementById('video');
  video.onloadeddata = () => {
    width = video.videoWidth;
    height = video.videoHeight;

    let preview = document.getElementById('preview');
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
