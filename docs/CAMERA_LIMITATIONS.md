# Cameras: defaults, limits and known quirks

The server chooses most settings when a client starts a camera stream or takes a snapshot (`camera_start_stream`, `camera_snapshot`). This page lists the fixed values it uses and the limits that come from cameras and browsers. It also explains what you will notice because of them.

Every rule and argument is described in full in [the WebSocket API reference](websockets_api.md#camera_start_stream). This page gives the overview.

## Video

### Picture size: 1280x720 in a browser

- **What you see:** a live view in a browser is at most 1280x720, even on a 1080p camera.
- **Why:** every browser offers H.264 at level 3.1. That level decodes at most 1280x720 at 30 fps. The server never asks the camera for video the viewer cannot decode, because that gives no picture at all.
- **What to do:** a client that can decode more must offer a higher H.264 level. `max_resolution` can lower the size, but it cannot raise it above what the offer decodes.

### Frame rate: 30 fps by default

- **What you see:** video runs at 30 fps, even when the camera reports that it can do more.
- **Why:** cameras accept frame rates they cannot deliver. One tested camera reports 120 fps. It accepted 640x480 at 90 fps and then sent only black video. At 30 fps the same request works.
- **What to do:** ask for more with `max_frame_rate`. The server then goes up to the camera's maximum, as far as the viewer can decode it. A `min_frame_rate` above 30 also raises the rate.

### One frame rate per request

The server asks for one exact frame rate, for example 30 to 30, never a range such as 15 to 30. Tested cameras refuse ranges that reach below a frame rate they do not publish, such as 30 fps. One exact rate works on every camera tested so far.

There is one exception: the certification request described under [First start can take a moment](#first-start-can-take-a-moment).

### Bit rate and key frames

- The bit rate starts at 8 Mbit/s. If the camera refuses it, the server halves it until the camera accepts, down to the camera's own lowest bit rate. Cameras can have a bit rate limit that none of their attributes state, such as 2 Mbit/s.
- The key frame interval is always 4000 ms. Tested cameras refused every other value.

### First start can take a moment

Cameras do not publish all their limits. The server therefore asks, and gives up quality step by step when the camera says no:

1. lower bit rate;
2. lower frame rate;
3. smaller picture.

Picture size is kept longest. Each step is one request to the camera, and a start makes at most 32 of them.

If the camera refused every one, the last request is the one the Matter certification tests use, which a certified camera must accept. This request is a frame rate range from 30 up to the camera's maximum, so the camera picks the rate itself.

### TURN over TLS needs the camera's clock

A camera refuses an offer with a `turns:` or `stuns:` ICE server while its UTC time is not set, which is common right after a reboot. When the camera refuses such an offer, the server pushes its time to the camera and sends the offer once more. If that push fails, or the camera refuses the offer again, the camera's refusal reaches the client.

## Camera capacity and other users

A camera has a limited number of encoders and a limited encoding capacity. When the camera is full, the server does this, in order:

1. It reuses a stream the camera already has, when that stream fits the request, whatever purpose it was set up for.
2. It asks for a smaller stream.
3. It frees a stream that nothing uses at the moment, in this order: its own snapshot streams, its own video streams, then snapshot streams of another controller, then video streams of another controller. Its own idle streams go first because freeing them costs no other controller anything. Among its own video streams, those it could hand out as they are go last. Among another controller's streams, snapshot streams go first: a live view is more important than a still frame.

Things to know:

- **Another controller can lose a stream.** If Home Assistant, another hub or an app keeps a stream allocated but idle, the server may free it. That controller must allocate it again. The server sends a `camera_stream_evicted` event for every stream it frees.
- **A stream's purpose does not limit who uses it.** A live view can run on a recording stream another controller set up, when that stream fits the request. The server picks such a stream itself, but prefers one set up for the same purpose. It does not free another controller's stream it could hand out instead. It can free such a stream of its own. If no new stream can then be set up and no other existing stream fits, it sets the freed stream up again under a new id and uses it; if that fails too, the start fails. The session still states the purpose the client asked for, and the camera's privacy switches act on that. How well this works on a given camera is still being tested.
- **The camera can pick an existing stream itself.** When the server asks for a new stream, the camera may answer with a stream that already exists and is close enough, whatever its purpose. When a video stream breaks a limit the client set, such as `max_resolution`, the server looks for another existing stream within the limits first, and fails with error 102 only when there is none. For a snapshot, the size of the picture the camera returns decides. The server never frees such a stream, because it existed before the request.
- **No freeing:** `allow_eviction: false` on `camera_start_stream` stops the server from freeing streams. The request can then fail with error 103 when the camera is full.
- **After a server restart,** the server no longer knows which streams it allocated itself. It treats the streams it allocated before the restart as another controller's. They are freed later, and one the server could hand out as it is is not freed at all.
- **Sessions left from before a crash** are ended by the server once the camera's first report arrives, so they stop holding streams. Sessions another controller holds are not touched.
- **A camera restart ends its sessions without telling the server.** The camera sends no `End`; the server learns it from the camera's `StartUp` event and its emptied session list, or when the camera hands an old session id to a new session. The client gets `camera_session_ended` with `cause: "camera_restarted"`. A camera that drops a session from its list without either is reported as `camera_dropped`.

## Snapshots

- **Size:** the largest snapshot size the camera offers, unless `max_resolution` limits it. With `resolution`, the smallest offered size that is at least as large as the one asked for (the largest allowed one when none is). The server asks the camera to scale the picture to the asked size, and the camera may refuse to scale and send the full offered size.
- **Quality:** the server asks for image quality 90 (of 100).
- **The snapshot stream stays.** A snapshot allocates a snapshot stream on the camera and leaves it there, so the next snapshot is fast. A later live view may free it to make room. The next snapshot then allocates it again.
- **Snapshots can be worse while video runs.** When all of the camera's encoders are busy, for example with a live view, the server picks a snapshot size that needs no encoder of its own. The camera can then take the picture from the running video stream. The image can be smaller, and it can show the video's watermark or date banner even when the snapshot asked for none. The response says `degraded: true` when the picture is smaller than the best size the request allowed. When the request asked for a `resolution`, the picture is not degraded as long as it reaches that size, and encoder-free sizes still come first while the encoders are busy.

## Audio

- The server asks for the first microphone codec the viewer can play, normally Opus, at 64 kbit/s. The channel count, sample rate and bit depth are the highest the camera states.
- A camera that states 8 channels therefore gets 8 channels, although a browser plays at most 2. Whether the server should ask for fewer channels is an open question to the Matter camera experts.
- When the camera cannot serve audio, the live view still starts, without sound.
- **Talkback needs an audio stream.** The response's `talkback` is `true` only when `camera_start_stream` gets `talkback: true` and the session carries an audio stream, because the Matter SDK example camera (with its audio playback option on) plays the client's audio only while that stream runs.

## Overlays

The server asks for no watermark and no date/time banner unless the client asks for one with `watermark_enabled` or `osd_enabled`. Asking for an overlay the camera does not support fails with error 102.

## Known camera bugs

Seen on tested cameras. The server works around them where it can.

- **Accepting a frame rate the camera cannot deliver.** A camera accepted 640x480 at 90 fps and then sent black video. This is the reason for the 30 fps default.
- **Wrong stream ids in `CurrentSessions`.** A camera reported random stream ids for each WebRTC session, not the streams the session uses. The server relies on the stream ids it sent itself, not on this list.
- **An answer direction the offer does not allow.** A camera answered `a=sendrecv` to a section offered `a=recvonly`, and browsers reject such an answer. The server narrows the direction of each media section of the camera's answer to what its offer allows (RFC 3264 §6.1) before it sends the `answer` event, also for a section whose direction comes from a session-level line or from the `sendrecv` default. With talkback off, the client's audio section is then `recvonly` as well, so the client cannot send.
- **Hidden limits.** Cameras refuse frame rate ranges below a floor, bit rates above a ceiling, or key frame intervals other than 4000 ms, without stating any of these in their attributes.
