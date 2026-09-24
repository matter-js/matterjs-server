# Changelog for the OHF Matter(.js) Server

This page shows a detailed overview of the changes between versions without the need to look into code, especially to see relevant changes while interfaces and features are still in flux.

<!--
	Placeholder for the next version (at the beginning of the line):
	## **WORK IN PROGRESS**
-->

## **WORK IN PROGRESS**

- Enhancement: Adds Websocket commands `camera_get_capabilities`, `camera_start_stream`, `camera_stop_stream`, `camera_snapshot` and `camera_release_stream`. They move Matter camera stream setup into the server, which computes the `VideoStreamAllocate` envelope, matches or allocates streams and handles encoder exhaustion. Every consumer — dashboard, Home Assistant and others — no longer has to reimplement the same device traps on its own
- Enhancement: A WebRTC session is tracked per node, endpoint and session id and ended on a single path. A closing connection, a server shutdown, a peer-initiated end and a client's own `EndSession` on the raw path now all leave the device's `ReferenceCount` correct. That includes a connection that closes while the session is still being set up, which used to pin the stream permanently
- Enhancement: `camera_get_capabilities` reports only facts the device states: sensor size, rate/distortion trade-off points, codecs, snapshot capabilities, `MaxNetworkBandwidth` and the current allocations. It derives no resolution list, because a hardcoded or derived list can offer a resolution the camera does not support, which is what issue #1054 reported
- Enhancement: `camera_start_stream` reuses an already-allocated video or audio stream only when that stream is contained in the caller's requested range, not merely overlapping it. A request for 1080p can no longer be served by a stream that may only deliver 720p (issue #1056)
- Enhancement: Reuse also covers a stream this server allocated moments earlier that the camera's `AllocatedVideoStreams` report has not named yet. Two `camera_start_stream` calls in quick succession no longer leave a duplicate stream behind that occupies an encoder slot and that nothing releases
- Enhancement: Every bound a `camera_start_stream` or `camera_snapshot` caller states is hard, at every rung — freshly allocated, reused or handed out degraded. That covers the video codec list, the resolution, frame-rate and bit-rate bounds, the mandatory `stream_usage`, the audio codec list, `sample_rate`, `channel_count` and `bit_rate`, and a snapshot `max_resolution` ceiling. None of them is widened, lowered, clamped or swapped to make a request fit. When nothing satisfies them the request fails with error 102, instead of returning a stream in a codec the caller cannot decode, a stream below the quality it asked for, or a snapshot larger than it can display. A bound the server rules out before asking the device names itself in `bound: { field, requested, limit }`
- Enhancement: Stating any value under `audio` on `camera_start_stream` asks for audio. Such a caller is now told why it got none — no microphone, a codec narrowing that left nothing, a device that refused the allocation, or a device that accepted the allocation but returned no stream id — instead of receiving `audio: null`. A caller that stated no `audio` value still gets a video-only session
- Enhancement: A `camera_start_stream` call that leaves nothing for the offer to carry — `video: false` together with `audio: false`, or `video: false` with no audio stream resolved for a caller that left `audio` to the server — fails with error 102 (`reason: "capability"`) instead of sending an offer with neither track
- Enhancement: When the camera has no capacity left, `camera_start_stream` deallocates an unreferenced stream to make room — any of them, not only one this server allocated. `reference_count: 0` means allocated but with no listener, so freeing it costs nobody a live view, and a controller that refused to take an unused stream over would let one client pin every encoder on the camera with streams nobody is watching. The victim is the one furthest down the camera's own `StreamUsagePriorities`, so a stream whose usage that camera ranks higher is never taken while a lower-ranked one is free; which usage that is depends on the camera and can be changed with `SetStreamPriorities`. A usage the list does not carry is taken last, an `Internal` stream never, and between equally ranked candidates one of this server's own goes first. The controller that allocated the victim is left holding a stream id the camera no longer knows and has to allocate again. If nothing can be freed, the call can still succeed with a stream outside the range the server computed, reported as `degraded: true`, as long as that stream stays inside every bound the caller stated
- Enhancement: A `camera_start_stream` or `camera_snapshot` that fails deallocates the streams it allocated for the attempt. The caller never receives their ids, so it could not have released them itself
- Enhancement: `camera_snapshot` captures from a snapshot stream the camera already has, whoever allocated it, whenever one meets the request's own bounds and is no smaller than the capability the call would otherwise allocate. Allocating a stream per call is what the cluster asks controllers to avoid, and each allocate competes for the encoders the livestream needs. A stream the call allocates and then answers with is left in place for the next one; a call that fails gives back what it allocated. The exception is a capability that requires the hardware encoder: such a stream holds one of the camera's encoders for as long as it exists, so keeping it would make the next call on single-encoder hardware fail with error 103 and block video allocation, and that one is given back on every exit
- Enhancement: The `camera_snapshot` response carries `stream_id` exactly when the server left the stream that served the frame on the camera, and nothing when it gave that stream back first. The field's presence is therefore the statement that the stream exists and can be handed to `camera_release_stream`, which a caller cannot otherwise establish on a camera whose allocation report lags. It no longer carries `reused` or `allocated_by_server`: neither is anything the caller acts on, and `camera_get_capabilities` reports both
- Enhancement: `camera_snapshot` avoids the device's encoder when the camera has none free, clamping to a capability that does not require hardware encoding. Requesting a snapshot during an active livestream therefore no longer risks a `ResourceExhausted` device error. Free encoders are counted from the referenced video streams against the camera's own `MaxConcurrentEncoders`, so one viewer on a camera that states four no longer costs picture size. When the camera still refuses, the next capability down is tried, and a remaining refusal is reported as error 102 or 103 rather than a raw device error
- Enhancement: `camera_snapshot`'s `downgraded: true` now means only that the frame is smaller than the caller's own bounds would have allowed. A camera whose best capability needs no encoder, and a camera with more encoders than are in use, no longer report a downgrade that did not happen. A camera that states no snapshot capability at all fails with `reason: "capability"` instead of `"bounds"`, so a client can tell "ask for less" from "this device cannot do it"
- Enhancement: Introduces Websocket Schema version 14 (backward compatible). The five camera commands are detectable with `server_info.schema_version >= 14`. Every codec (`H264`, `H265`, `H266`, `AV1`, `OPUS`, `AAC`, `JPEG`, `HEIC`), every stream usage (`Internal`, `Recording`, `Analysis`, `LiveView`) and `two_way_talk_support` (`NotSupported`, `HalfDuplex`, `FullDuplex`) is a name rather than a number, in both directions
- Enhancement: A codec name `camera_get_capabilities` reports can be sent straight back as a `camera_start_stream` hint or a `camera_snapshot` codec. A stream usage can too, except `Internal`, which marks a stream the device keeps for itself and which `camera_start_stream` refuses. Reported keys are not always hint keys: `audio.channels` is the ceiling for the `audio.channel_count` hint, `audio.sample_rates` the set `audio.sample_rate` must name, and `audio.bit_depths` has no hint at all
- Enhancement: `camera_start_stream` refuses a key it does not take, as an argument of its own or under a hint object, and `camera_snapshot` refuses an argument it does not take, both with error 8, instead of ignoring it. An `audio: { "min_bit_rate": 128000 }` used to produce no error and no effect, which is the one thing these commands never do with a stated bound
- Fix: A `camera_start_stream` whose connection closes while the camera is still answering `ProvideOffer` gives back the video and audio streams it allocated. It used to end the session and leave them on the device where nothing could reach them, because the caller never received their ids
- Enhancement: When a `camera_start_stream` deallocates a stream to make room and then never uses that capacity — the request failed, or succeeded by handing out a stream that was already there — a stream with the same range, codec and stream usage is allocated in its place. This does not undo the eviction: the camera issues a new id and the controller that allocated the original holds one the camera has forgotten. What it restores is the camera's capacity to serve such a stream, which would otherwise be one poorer for a request that bought nothing
- Enhancement: Whether this server allocated a stream decides only one thing: what it may deallocate on its own initiative. It is never a condition for using a stream, which is decided by inspecting what the camera reports, and it is not persisted — after a restart the camera's own report is the record. `camera_release_stream` therefore deallocates any stream the camera allows, not only one this server allocated: the cluster refuses a deallocate for an unknown id, a non-zero reference count and the `Internal` stream usage, and checks neither the allocator nor the fabric. Error 105 (`CameraStreamNotOwned`) is gone with the restriction it reported. The five-minute lease expiry goes with it: a lease the camera never confirms now lives for the process run, so on a camera whose `AllocatedVideoStreams` reports never arrive the per-endpoint lease list grows one entry per allocation again, and a camera that starts reporting late can have a reissued stream id matched to an earlier allocation. Both were reasons to expire ownership while ownership decided what could be reused and released; neither can now reach further than `owned_by_server` reporting a stream as this server's when it is not
- Fix: A WebRTC session the camera reports it no longer has (`NotFound`) is dropped by both places the server tracks it in, on the camera commands and on the raw `device_command` path alike. The controller's own requestor used to keep its entry, which then named a session nothing could reach again and stayed for the lifetime of the server, and a raw `EndSession` answered with `NotFound` used to leave both records behind. All three routes that end a session now decide the same way: the records go when the device accepted the end and when it answered `NotFound`, and stay for any other failure so a later stop, disconnect or shutdown still reaches the session
- Fix: Local WebRTC session tracking is dropped only for the camera the session id was issued by. `WebRTCSessionID` is allocated per camera, so ending session 1 on one camera used to untrack session 1 on another, whose `Answer` and `ICECandidates` the controller then rejected with `NotFound`
- Fix: Every wait on a camera that has stopped answering — ending its sessions, giving its streams back — is bounded to 10 seconds. Such a camera used to block server shutdown with no limit and hold that endpoint's command lock for as long as the transport kept retrying, which queued every other camera command behind it. The bound also covers the `EndSession` sent for a session the provider created but the server cannot track, which was awaited with no limit at all; that one is a wait of its own, so a `camera_start_stream` that has to end such a session and then give its streams back can spend two of these budgets before the endpoint lock is free. The sessions of a release pass are ended concurrently, so one silent camera does not spend the budget the others need, and a session whose `EndSession` was abandoned stays tracked for the next pass
- Fix: A WebRTC callback carrying an endpoint id outside the valid range no longer aborts the shared event emit. Before this, the throw denied that signaling event to every other observer on the emit and failed the camera's own End invoke
- Fix: A command that reaches the controller before it finished starting fails with the SDK stack error code, as every other controller failure does, instead of a generic error carrying no code
- Fix: `camera_start_stream`'s `video` and `audio` arguments make three statements, not two: the key being present asks for the track — an empty object `{}` included — `false` declines it, and leaving it out leaves it to the server. Before this only `false` was read; an `audio` object was taken as asking for audio when it set a codec list, channel count, sample rate or bit rate, and a `video` object was never read as asking for anything. So an offer refusing a media section answered a caller that had asked for that track with a silent `null` for video, and told an audio caller only when it happened to have stated one of those four values. Both now fail with error 102, which carries `track: "video" | "audio"` so a caller can tell which of its two statements could not be met — that payload was otherwise identical to the one saying both tracks were left out
- Fix: An offered audio section that names no codec — one carrying only statically-mapped payload types, where the peer states nothing about what it decodes — no longer empties the camera's audio codec list. A caller that asked for audio against such an offer was refused with error 102 `reason: "codec"` and an empty `requested`, naming a mismatch the offer never stated. Video already treated that case as "nothing to narrow by"; audio now does too
- Fix: An `sdp` offer that carries no media section for a kind no longer allocates a stream for that kind. An answer carries exactly the m-lines of the offer it answers, in the same order (RFC 3264 §6), so a stream allocated for a section that is not there could never be attached to anything: it held one of the camera's encoders and a `ReferenceCount` for media that was never sent, which is the capacity the next request then fails for with error 103. A caller that asked for the track is told with error 102 (`reason: "capability"`, `track` naming it); a caller that left the track to the server gets `null` for it. A `camera_start_stream` without `sdp` is unaffected: the camera writes the offer's m-lines itself, so no kind is refused there
- Fix: A TURN `username` and `credential` under `camera_start_stream`'s `ice_servers` are masked in the server's and the client's debug log. Every request is written to the debug log in full, and the masking reached only `device_command` payload fields, so a TURN secret reached the log in plaintext on every call that carried one. The masking is by field name inside an object that also states `urls`, so the Door Lock `credential` struct, which is no secret, still reaches the log unchanged
- Fix: `camera_snapshot` no longer writes the captured frame into the server's debug log. The response carries the complete base64-encoded image, and the mechanism that keeps a large response out of the log did not name the command. The codec, resolution, byte count and `downgraded` flag are logged on their own line, so what the server chose is still there. The client library's own frame logging is unchanged and still writes whatever it receives
- Fix: An offer's `a=fmtp` limits bind the reuse and degraded rungs, not only the freshly computed envelope. A peer offering H.264 at `max-fs=3600` (about 960x540) could be handed an existing 2560x1440 stream flagged `degraded: true` — video it cannot decode. The limits state what the peer can decode, so no rung may trade them away the way it trades the envelope the server itself computed
- Fix: An `a=fmtp` limit in a `camera_start_stream` offer narrows only the codec that stated it. The limits of every video codec in the offer used to be folded into one, so an offer carrying H.264 at `max-fs=3600` beside H.265 at `max-fs=8160` clamped a selected H.265 stream to the H.264 ceiling — avoidable downscaling, or error 102 for a request the camera could have served. `max-fr` is read as a frame-rate ceiling for the codec that stated it. A codec that states its ceiling only through `profile-level-id`, `level-id` or `max-fps` still places no limit on the stream: those are not parsed, and another codec's `max-fs` was never a substitute for them
- Fix: A media section the offer rejects (`m=` line with port 0) no longer contributes codecs, limits or talkback intent, and no track of that kind is put in the answer. Such a section is the peer declining that media, and the server used to read it as if the peer had offered it: the rejected section's codecs decided which codec was requested, its `a=fmtp` limits clamped the stream, a rejected audio section could still be taken as asking for talkback, and a freshly allocated stream was attached to the offer for it — holding an encoder and a reference count for media that could never flow, which is what makes the next request fail for lack of capacity. A caller that asked for a track whose section the offer refuses is now told with error 102 (`reason: "capability"`, `track` naming the track) instead of receiving a stream, or — for video — a session with no video track and no error
- Fix: A media section the peer will not receive on — `a=sendonly` or `a=inactive` — is treated like a rejected one: it contributes no codecs and no `a=fmtp` limits, and no track of that kind is put in the answer. A nonzero port only says the section exists; the direction says whether anything sent into it reaches the peer. The server used to allocate a video or audio stream for such a section, which holds an encoder and a reference count on the camera for media nobody receives and is what makes the next request fail for lack of capacity. A section with no direction attribute is `sendrecv` (RFC 4566 §6), and a direction stated at session level applies to every section that does not restate it (RFC 4566 §5.13); both defaults are read for talkback too, so an audio section that states no direction offers to send and asks for it. An `a=sendonly` audio section still asks for talkback: it states that the peer wants to send audio and will not receive ours, and the two are now read apart. A caller that asked for a track whose section will not be received is told with error 102 (`reason: "capability"`, `track` naming the track), the same answer a rejected section gives it. The Matter spec states no rule for this and the reference camera never reads the offer's direction, so this is a decision about the camera's encoders rather than about protocol compliance
- Fix: `camera_get_capabilities` reports an allocated snapshot stream's `min_resolution` and `max_resolution` instead of a single `resolution`. A stream allocated for 640x480-1920x1080 was reported as 1920x1080 alone, which says the device delivers that size when it may deliver any size in the range; these commands report what the device stated, and the device states two bounds
- Fix: `camera_start_stream` and `camera_snapshot` reject a resolution's `width`/`height` outside the range the Matter field accepts, and `camera_start_stream` rejects the same for a video/audio hint's frame rate, bit rate, channel count or sample rate, with error 8. The range is read from the cluster's own element definitions — 1 to 65535 for a resolution dimension and a frame rate, 1 to 4294967295 for a bit rate or sample rate, 1 to 8 for a channel count — so a negative, zero, fractional, `NaN`, infinite or simply too large value is answered as the argument error it is. Such a value used to reach `VideoStreamAllocate`, `AudioStreamAllocate` or `SnapshotStreamAllocate` unchanged, turning malformed client input into a device or SDK failure instead of a typed argument error. The same fix applies to a malformed `node_id`: a fractional, `NaN`, or infinite value used to reach `NodeId()`'s `BigInt` conversion and throw an uncaught `RangeError` instead of error 8
- Enhancement: Adds error codes 102, 103, 104 and 106 (`CameraStreamIncompatible`, `CameraResourceExhausted`, `CameraStreamInUse`, `CameraNotSupported`) for the new camera commands, mirrored in the Websocket client constants and the Python client. Error 102's `bound.field` names the hint key as the wire spells it: `min_resolution`, `min_frame_rate`, `min_bit_rate`, `sample_rate` or `channel_count`. Error 103's `allocated` entries carry a `kind`, because the streams holding the capacity are not always the kind that was asked for — a refused snapshot reports the video streams, which are what hold the encoders, while a refused audio allocation reports the audio streams. Its message names no resource: `ResourceExhausted` is all the camera states, and an audio allocation it refuses says nothing about its video encoders. The `max_concurrent_encoders` and `max_encoded_pixel_rate` in the payload are the camera's own attributes, reported whatever kind was refused
- Fix: The server's debug log no longer writes a Wi-Fi passphrase (`set_wifi_credentials`'s `credentials`), a Thread operational dataset (`set_thread_dataset`'s `dataset`) or a setup code (`commission_with_code`'s `code`) in plaintext. Every request is written to the debug log before anything has looked at it, and the masking named only Door Lock payload fields, so all three reached the log unchanged. The same masking now also covers `commission_on_network`'s `setup_pin_code` and the credential material a `device_command` payload can carry: Thread datasets, Wi-Fi passphrases, PAKE verifiers, the identity protection key, ICD, Aliro, group and test-event keys, and Content Control and Account Login PINs. Names that only look alike are untouched — KeypadInput's `key_code`, the Door Lock `credential` struct and an OTA `update_token` still reach the log, because a request the log cannot show is a request nobody can debug
- Fix: The `open_commissioning_window` response is no longer written into the debug log. It carries the node's setup passcode and the manual and QR codes that encode it, so opening a commissioning window put a working pairing credential in the log file and in the dashboard's browser console. Nothing masks a response — the masking walks a request's arguments — so the command is now in the list of responses whose content is left out. Which command answered, and whether it succeeded, are still logged
- Enhancement: (lboue) Added a command panel for the ServiceArea cluster to the Dashboard
- Enhancement: Adds CLI flag `--thread-rest-probe-port` (env `THREAD_REST_PROBE_PORT`) to configure the OTBR REST API port probed on discovered Thread Border Routers (default 8081), and raises the per-request REST probe timeout from 1500 ms to 3000 ms for Border Routers with a slow `/diagnostics` endpoint (a Border Router that accepts the connection and then stalls now delays the first diagnostics batch by up to 9 seconds instead of 4.5)
- Enhancement: Adds CLI flag `--custom-cluster-poll-interval` (env `CUSTOM_CLUSTER_POLL_INTERVAL`) to configure the polling interval for custom cluster attributes without subscription support (legacy Eve Energy devices); defaults to the previous 60 seconds and accepts 60 to 86400 seconds
- Enhancement: (lboue) Dashboard Endpoints list and endpoint's Clusters panel show each endpoint's resolved label and Descriptor semantic tags (TagList) to simplify identification
- Enhancement: (lboue) Added a command panel for the DoorLock cluster to the Dashboard
- Enhancement: (lboue) Added Presets and Thermostat Suggestions panels to Dashboard
- Enhancement: (lboue) Added a command panel for the DeviceEnergyManagementMode cluster to the Dashboard
- Enhancement: (lboue) Added a Forecast panel for the DeviceEnergyManagement cluster to the Dashboard
- Enhancement: (lboue) Added a command panel for the MediaPlayback cluster to the Dashboard
- Enhancement: (lboue) Added a command panel for the ClosureDimension cluster to the Dashboard
- Enhancement: (lboue) Added a command panel for the DoorLock cluster to the Dashboard
- Enhancement: (lboue) Added a decode and control panel for the EnergyEvse cluster to the Dashboard, including a weekly charging schedule editor
- Enhancement: (lboue) Allows creating temporary/expiring PIN users (UserType=ExpiringUser) and configuring the lock's ExpiringUserTimeout to the Dashboard DoorLock cluster panel
- Enhancement: (lboue) Added Presets and Thermostat Suggestions (Thermostat cluster PRES/TSUGGEST features) panels to the Dashboard
- Fix: Door Lock PIN fields (`credentialData`, `pinCode`) are redacted from the debug logs
- Fix: BLE proxy connections are pinged every 15 seconds and terminated after 45 to 60 seconds of silence, so a proxy client that loses power is detected instead of staying registered indefinitely
- Fix: (colin-kiegel) Python client ignores a command result whose future is already done, so a result arriving after a disconnect no longer kills the read loop with `InvalidStateError`
- Fix: Python client removes the pending command future when the send itself fails or is cancelled, so the entry no longer leaks and a late result can no longer settle a future nobody awaits
- Fix: The Noble BLE proxy reference client implements `write_and_subscribe`, so commissioning over `--ble-proxy` no longer fails at the BTP handshake with `Unknown command: write_and_subscribe`
- Fix: The Noble BLE proxy reference client honours `start_scan`'s `service_uuids` and `allow_duplicates`, reconciles its scan state through a single serialized path so overlapping scan commands can no longer leave one unanswered or start a scan the server already ended, bounds each scan call so a wedged adapter cannot stall later commands, and drops malformed frames instead of terminating the process
- Fix: The Noble BLE proxy reference client counts connect scan pauses, so a connect that finishes while another is still interviewing no longer resumes scanning and reinstates the macOS characteristic-discovery hang
- Fix: A BLE proxy client that answers `already_scanning` stays tracked as scanning, so its later `scan_stopped` still reaches the Matter stack
- Fix: The Python BLE proxy client tracks subscriptions and the last written characteristic without requiring a prior `discover_services`, and re-arms a running scan when `start_scan` changes its parameters
- Fix: A connection is opted in to `webrtc_callback` before the command that makes the camera signal is dispatched, instead of after that command's response. The answer SDP and ICE candidates a camera sent while `send_webrtc_provider_command` or `camera_start_stream` was still running were dropped, leaving the client with a session it could not negotiate
- Adjustment: `camera_stop_stream` reports `ended: false` when the camera answers `NOT_FOUND` for the session, which is an id the camera could not resolve to one of its sessions. `ended: true` now means the camera confirmed the end, not only that this server still tracked the session
- Adjustment: `camera_stop_stream` reports an error when the `EndSession` it waited on was sent by a closing connection or by the server shutdown and failed, where it used to answer `ended: true`. One session gets one `EndSession` however many paths reach it, so a stop naming a session another path is already ending waits on that invoke and now reports its outcome. A stop that sends the `EndSession` itself reported the failure before and still does; the session stays tracked either way, so the stop can be retried
- Fix: `device_command` with `EndSession` on the WebRTC provider drops both local records for the session — this server's camera session registry and the requestor-side tracking — where it used to drop one and stop if the other failed. A failure to drop the requestor-side tracking is now logged instead of failing a command whose `EndSession` the camera already accepted
- Fix: `device_command` with `EndSession` recognizes the session id under any spelling the invoke itself accepted, so an id written as e.g. `WebRtcSessionId` no longer ends the session on the camera while leaving both local records naming it

## 1.4.0 (2026-08-07)

- Enhancement: Introduces Websocket Schema version 13 (backward compatible)
    - (MindFreeze) Adds Websocket command `get_network_topology` and event `network_topology_updated` to expose the Thread and WiFi network details for external visualization
    - (lboue) Adds Websocket command `initiate_ota_upload` plus HTTP endpoint `POST /ota-upload/<upload_id>` and error code 101 (`OtaUploadError`) to store a local `.ota` firmware image in the server's OTA image store; new CLI flags `--ota-upload-max-in-flight` and `--ota-upload-max-size-mb`
- Enhancement: (lboue) Dashboard supports uploading a local `.ota` firmware file from a node's detail page
- Enhancement: (lboue) Python client gained `upload_ota_file()` for the new upload endpoint
- Enhancement: Adds support for manufacturer-specific attributes on standard clusters and defines the WAGO Home Blind Control travel time attributes for the Window Covering cluster
- Enhancement: (lboue) Dashboard endpoint view shows "Client Clusters" of an endpoint and their binding status when also a Binding cluster is available
- Enhancement: (lboue) Added a Schedule Configuration panel (Thermostat cluster MSCH feature) to Dashboard visualizing schedules
- Enhancement: (lboue) Added read-only panels for the CommodityTariff and MeterIdentification clusters to Dashboard
- Enhancement: Dashboard dev mode adds a second read button per attribute that reads across all fabrics and shows the result without caching it
- Fix: Dashboard endpoint view refreshes its cluster list when a cluster appears or disappears on the node, or the viewed endpoint changes
- Fix: Dashboard attribute reads are fabric-filtered like the subscription; only a read that needs to see other fabrics' data is non-fabric-filtered, and its result is not cached
- Fix: Improves Dashboard ACL and binding handling of edit error cases
- Fix: Dashboard writes (node label, ACL, bindings, Chime, dev-mode attribute write) report a device-side rejection instead of appearing to succeed
- Fix: Improves ICD UI handling when deactivating the LIT mode
- Fix: `WRITE_ATTRIBUTE` now also accepts struct members keyed by wire field name, not only by TLV tag
- Fix: (lboue) Python client `write_attribute()` now serializes struct/list-of-struct values keyed by TLV tag instead of field name as the server's `WRITE_ATTRIBUTE` handler expects
- Fix: Python client cluster definitions and Dashboard cluster descriptions no longer contain the global `EventList` attribute (0xFFFA), which was provisional and deprecated in the meantime
- Fix: Update matter.js to 0.17.9
    - BLE improvements and fixes
    - OTA/BDX improvements and fixes
    - State value access issue fixed

## 1.3.3 (2026-07-28)

- Enhancement: (pkese) Dashboard network graphs space nodes by signal quality (Thread LQI, Wi-Fi RSSI) instead of using one fixed edge length
- Fix: Update BLE library

## 1.3.2 (2026-07-28)

- Feature: (lboue) Dashboard cluster view shows a "Semantic Tags (TagList)" panel on the Descriptor cluster
- Enhancement: Thread nodes' neighbor and route tables are re-read a few minutes after startup and every 24h afterward; disabled together with the rest of the Thread diagnostics via `--disable-thread-diagnostics`
- Enhancement: Optimized the Dashboard "Update Connection Data" dialog for sleepy ICD LIT devices
- Enhancement: Optimized periodic node work (time synchronization, energy polling, Thread topology refresh) for sleepy ICD LIT devices
- Fix: Fixes and enhances the DST determination, and sends a second TimeZone entry when the host zone has an upcoming permanent offset change, plus a closing DST entry when the device has room for one
- Fix: A node reporting that it has no usable time is now resynced right away instead of being held off for up to a day, while reconnect-driven syncs keep their longer spacing
- Fix: Command responses and events now expose acronym field names in the Python Matter Server casing (e.g. `videoStreamID`, `groupID`, `PAKEPasscodeVerifier`), matching the generated Python client and Home Assistant; the previous lowercased-acronym keys are still emitted alongside for compatibility
- Fix: Update matter.js to 0.17.7
    - Fixes and Optimizations

## 1.3.1 (2026-07-23)

- Feature: (lboue) Dashboard cluster view shows an "Active Features" panel listing the cluster's supported features by name, decoded from the FeatureMap attribute
- Fix: (lboue) Dashboard now considers the audio/video features a Camera/Audio device advertises
- Fix: Update matter.js to the latest 0.17.7 alpha
    - Enhance workarounds in commissioning for devices that drop the BLE connection too early

## 1.3.0 (2026-07-22)

- Feature: (lboue) Dashboard adds a command panel for the ClosureControl cluster (Stop, Calibrate, MoveTo with position/latch/speed)
- Enhancement: (lboue) Dashboard node view shows the endpoint list as an indented parent/child tree
- Fix: (lboue) Detect camera Live View/Snapshot capabilities from the endpoint's clusters instead of hard-coding them by device type, so composed devices (e.g. Floodlight Camera) show the button only on the endpoint that actually supports streaming
- Fix: (lboue) Dashboard now re-negotiates the snapshot stream when the selected resolution, codec, frame rate, or watermark/OSD settings change, captures at the selected resolution even when reusing an existing stream, and serializes concurrent capture requests
- Fix: Update matter.js to the latest 0.17.7 alpha
    - Optimizations and fixes

## 1.2.8 (2026-07-20)

- Fix: WebRTC camera live view — `ProvideOffer` again selects the stream fields by the provider's cluster revision
- Fix: Ensures that updating Thread data from nodes in Thread visualization also updates the chart
- Fix: (lboue) Dashboard no longer offers live-view streaming controls for the Snapshot Camera device type, which doesn't support WebRTC — only Snapshot capture is offered
- Fix: Update matter.js to the latest 0.17.7 alpha
    - Optimizes Fallback address handling on connections
    - Ensures correct failsafe timer handling for long sleepy devices

## 1.2.7 (2026-07-16)

- Fix: WebRTC camera live view — Use `ProvideOffer` format that all cluster versions support, skip rev2 for now
- Fix: Debounce the full `node_updated` refresh into a single delayed event per node after basic-information changes
- Enhancement: Update matter.js to the latest 0.17.7 alpha
    - Optimizes Cluster data initialization when the node structure changes

## 1.2.6 (2026-07-15)

- Fix: Dashboard now shows the camera Live View/Snapshot button for the Floodlight Camera and Snapshot Camera device types, not just Camera and Video Doorbell
- Fix: Dashboard `ProvideOffer` requests now include `videoStreams`/`audioStreams` alongside deprecated singular stream IDs for WebRTC provider compatibility across cluster revisions
- Enhancement: Update matter.js to the latest 0.17.6 alpha
    - Optimizes OTA software updates
    - Prevents blocking on stop when a BLE discovery is still in progress

## 1.2.5 (2026-07-13)

- Enhancement: Update matter.js to 0.17.5
- Enhancement: Add a QR code when using the dashboard to share a device
- Enhancement: Clarify Thread node role and unknown/external device descriptions in the network visualization (e.g. what a REED is, why a device shows as unknown/external) and link the OpenThread role primer

## 1.2.4 (2026-07-12)

- Enhancement: Update Docker base images to Debian trixie with the current Node 24 version
- Fix: Some more camera fixes in the dashboard
- Fix: Dashboard resets scroll position on navigation and focuses cluster command panels (ICD, ACL, Binding)
- Fix: Update matter.js to the latest 0.17.5 nightly
    - Tolerate non-compliant peers omitting mandatory Descriptor lists

## 1.2.3 (2026-07-11)

- Enhancement: Thread diagnostics fetch a Border Router's dataset via REST when no credentials are stored, enabling the faster MeshCoP (CoAP) transport instead of the slower REST collection
- Fix: Update WebRTC and Camera-related logic to respect available Pixelrate and Encoders of the camera device
- Fix: Optimize startup behavior

## 1.2.2 (2026-07-10)

- Fix: Ensure that WebSocket backpressure keeps the send-window full instead of draining one frame at a time, avoiding initial-sync stalls behind a high-latency proxy (e.g. Home Assistant ingress) that could drop the dashboard connection
- Fix: Optimize TBR address and data handling
- Fix: Update WebRTC and Camera-related logic and respect separate Audio/Video streams in Dashboard
- Fix: Update matter.js to the latest 0.17.5 nightly
    - Limit OTA/BDX block size to UDP max payload size

## 1.2.1 (2026-07-09)

- Fix: Optimize WebSocket backpressure calculation so a single large payload no longer trips congestion mode on a healthy client

## 1.2.0 (2026-07-09)

- Feature: Enhanced Thread Network diagnostics — collect and visualize per-Thread-network diagnostics also from Border Routers over MeshCoP (CoAP/DTLS) or the OTBR REST API (auto-selected, cached)
- Feature: Adds WiFi and Thread credential management and allows to store multiple entries. Commissioning can pick which stored network to use
- Feature: Adds ICD (Intermittently Connected Device) management including a "Power & Sleep (ICD)" dashboard panel. Requires devices with Matter 1.4+ for LIT management.
- Feature: Allows defining the default fabric label to use as CLI/ENV-option which then blocks changing via the WebSocket API
- Feature: Adds automatic time synchronization for devices that support it, pushing host time (UTC and time zone / DST). Enable it with the `--enable-time-sync` CLI option (env `ENABLE_TIME_SYNC`) when the host has a reliable, synced time source. Runs first 30-60 minutes after start, then every 24h.
- Enhancement: When one WebSocket connection defines a fabric label then other connections are blocked from changing that as long as the defining connection is still active
- Enhancement: Introduced WS schema 12 which supports the above features — see [WebSocket API schema changelog](docs/websocket-api-schema-changelog.md).
- Enhancement: New `--disable-thread-diagnostics` CLI flag (env `DISABLE_THREAD_DIAGNOSTICS`) turns off the entire Thread Border Router subsystem (discovery, probing, diagnostics) for plain Matter-controller deployments. Matter-over-Thread commissioning is unaffected
- Enhancement: WebSocket sends now apply per-connection backpressure — a slow or stalled client coalesces attribute/node updates and drops stale events instead of buffering without limit, preventing unbounded memory growth (OOM) under high event volume
- Enhancement: Update matter.js to the latest 0.17.5 nightly
    - Adds support for Matter 1.6.0
    - Adds support for ICD (SIT and LIT) devices
    - Fixes an invoke-issue where parallel multi-endpoint invokes were working but errors returned on WebSocket
    - Optimizes subscription reporting intervals
    - Ensures changed node structures are sent via WebSocket directly after re-subscribe and not delayed
- Adjustment: `webrtc_callback` events are now delivered only to the connection that issued the `send_webrtc_provider_command` for that camera session, instead of being broadcast to every connected client
- Fix: Ensures that the Python-Client does not crash anymore on unknown events from newer Server versions

## 1.1.7 (2026-07-01)

- Speed up attribute data conversion for migration and websocket communication
- Enhancement: Update matter.js to 0.17.4

## 1.1.6 (2026-06-30)

- Ensure that rebuilding of node structures after updates does not block the event loop for big bridges
- Skip rebuilding node structures when the device just resubscribed

## 1.1.5 (2026-06-30)

- Speed up Bitmap Conversion for WebSocket messaging and data migration
- Enhancement: Update matter.js to the latest 0.17.4-alpha
    - Speed up DataReport decoding even more

## 1.1.4 (2026-06-29)

- Enhancement: Update matter.js to the latest 0.17.4-alpha
    - Speed up subscription DataReport handling

## 1.1.3 (2026-06-28)

- Enhancement: Update matter.js to the latest 0.17.4-alpha
    - Added more optimizations for data of non-compliant devices (keep non-declared clusters, accept int/uint mismatches in reported data)
    - Optimize MDNS scanner to drop irrelevant messages before decoding (optimizes CPU usage in MDNS-spammy networks)

## 1.1.2 (2026-06-25)

- Fix: Respect matter.js DCL config also for Certificate and Vendor service initialization
- Enhancement: Update matter.js to the latest 0.17.4-alpha
    - Improves data migration for non-compliant device data (e.g. Tasmota 14.x empty attribute lists)
    - Allows attribute writes with invalid enum or bitmap values and lets the device decide, but logs a warning
    - Reduces data duplication in RAM in some places
    - Allows connections even for "at-the-edge-of-spec" devices with >1 hour of idle interval
    - Optimizes peer probing when mDNS addresses change
    - Hides GitHub rate limit errors when fetching certificates when some are already in storage

## 1.1.1 (2026-06-23)

- Adjustment: Adjust the default Docker Healthcheck durations a bit to better allow migrations
- Enhancement: Do not send node_updated event when only NodeLabel changes
- Enhancement: Detect Self-Bindings (Node-to-same-Node-Binding) and prevent ACL creation for these cases and show in UI

## 1.1.0 (2026-06-17)

- Enhancement: Revamped the experimental Binding overview and editor in Dashboard
- Enhancement: Added ACL overview and limited management options to Access Control cluster view (Root endpoint)
- Enhancement: Update matter.js to 0.17.3 with many fixes and optimizations, especially:
    - Fixes attestation certificate validation error for Nuki SmartLocks
    - Ensures to use the increased thread message retransmission timings also for commands
- Adjustment: Ensure that Matter-Server CLI options do not interfere with matter.js

## 1.0.0 (2026-06-09)

- Enhancement: Update matter.js to 0.17.2 with many fixes and optimizations
- Enhancement: Dashboard Wi-Fi graph shows the full BSSID in access point labels, so APs differing only in leading octets are distinguishable
- Fix: Ensures that multiple parallel commissioning tries do not allocate the same Node-ID, and recovers automatically when the stored Node-ID counter drifts out of sync with the fabric by skipping/retrying with the next free id

## 0.8.0 (2026-06-02)

- Breaking: The server now requires at least Node.js 22.13.0 (LTS)
- (Dev)Breaking: (rspier) Change Dev-Docker-Container to use the same user like the production container – might require permission updates
- Enhancement: (rspier) Added inline NodeLabel editing to the Node detail view
- Enhancement: Dashboard network visualization fills the full window width on large/4K displays
- Enhancement: Dashboard Thread mesh icons reflect each node's Thread and Border Router roles
- Enhancement: Dashboard header shows a Home button in node/endpoint/cluster views for one-click return to the main dashboard
- Enhancement: Allows finding a node in the thread network chart by its node label in addition to the extended address and Node-ID
- Enhancement: Optimize the error message when commissioning a device with a test/dev certificate but without the "Test Net DCL" configuration enabled
- Enhancement: BLE proxy endpoint now accepts multiple parallel WebSocket clients (each peripheral handled by the proxy that first discovered it), so several BLE radios can extend coverage
- Enhancement: Update matter.js to the latest 0.17.1-nightly
    - Removed invalid FabricIndex field requirements for some command types and models
    - Standardized log levels and logged messages
    - Fix: Event reports are now decoded in wire (EventNumber) order
- Enhancement: Adds the dbus-next package to support BLE commissioning in D-Bus mode (see [docker](./docs/docker.md) and [os_requirements](./docs/os_requirements.md) for details)
- Adjustment: Standardized log levels and logged messages
- Fix: Ensure that we correctly process handshake messages when using the BLE proxy

## 0.7.1 (2026-05-21)

- Feature: Added (experimental) BLE proxy commissioning support (enabled with `--ble-proxy` CLI option)
- Enhancement: Dashboard shows Thread protocol version on Thread node details
- Enhancement: Dashboard always shows Thread/WiFi navigation tabs (removed small-screen gate)
- Maintenance: Update matter.js to the official 0.17.0
- Fix: Fix the Docker-Health-Checks when a custom Listen address was used
- Fix: Dashboard auto-focuses pairing-code field when commission-node dialog opens

## 0.7.0 (2026-05-18)

- IMPORTANT: The first start, when coming from any previous version, will take a bit because we migrate the storage to the new "WAL"-based storage format. This is a one-time migration that reduces disk usage and I/O.
- Breaking: Enables strict validation of Attestation and Certificates at commissioning like the Python server (Test-DCL Mode also checks the official test certificates)
- Feature: Updates the Matter version to be compatible with Matter 1.5.1
- Feature: Enables Matter TCP support when devices support it (likely very few devices)
- Feature: Updates the generated Python client classes to match Matter 1.5.1
- Feature: Seeds Certificates and Vendor Information to allow basic functionality also without internet access
- Feature: Enhances the Dashboard UI to allow to clear and change the Wifi/Thread credentials
- Feature: (iamadamreed) Adds TCL custom cluster
- Feature: (burmistrzak) Adds "window open mode" attribute for Eve custom cluster
- Feature: Adds experimental Camera Live View support — WebRTC streaming with snapshot capture, exposed via a Live View button on Camera and Video Doorbell device types.
- Feature: Adds experimental Dashboard UI for the Camera AV Settings User Level Management cluster (MPTZ controls, presets, DPTZ stream info) plus a compact PTZ strip in the live-view overlay.
- Feature: Adds experimental Dashboard UI for the Chime cluster (sound selection, play, last-played event readout).
- Fix: When creating bindings via Dashboard, use the correct permission levels ("Operate" instead of "Administer")
- Fix: Ensures that also official test certificates are initialized correctly when DCL-Testnet-flag is enabled
- Fix: Fixed some edge cases in the "Node available" logic to ensure it correctly reflects the node stats
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Fixes write encoding for some cases of nullable attributes
    - Make scanNetwork failures non-fatal for commissioning
    - Ensures re-subscriptions from the device to reset the device state to "Connected"
    - ... more optimizations and fixes

## 0.6.8 (2026-05-08)

- Fix: Fixes setting ACLs (really)

## 0.6.7 (2026-05-07)

- Fix: Fixes setting ACLs

## 0.6.6 (2026-05-07)

- Adjustment: Thread mesh visualization now uses LQI (instead of RSSI) for connection-line and neighbor-list colors.
- Fix: Only import BLE module when BLE was enabled for the server

## 0.6.5 (2026-05-04)

- Enhancement: Hide phantom Thread "External" routers/devices that only persist as stale neighbor-table entries (every observer offline, or single observer with other connections)
- Enhancement: Uses discovered BR hostnames also in connection and neighbor lists
- Fix: Enhance error messages when writes fail
- Fix: Update matter.js to the latest 0.17.0-nightly

## 0.6.4 (2026-04-30)

- Enhancement: Retain Thread Border Router registry entries for 24h after their last mDNS source goes off-air, so the dashboard can still show information even if stale
- Fix: Ensures the same event order as the Python Matter server when endpoints got added
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Fixes validation issues when writing values guarded by constraint checks

## 0.6.3 (2026-04-29)

- Feature: (AlixBa) Add a "Hide" menu on the Thread network visualization to hide offline nodes and specific connections
- Feature: Enhances the Thread network visualization with MDNS details of the border routers in the network
- Fix: Update matter.js to the latest 0.17.0-nightly
    - More optimizations around MDNS discovery
    - Optimize logging for informational and error cases

## 0.6.2 (2026-04-26)

- Feature: Add "Developer mode" to the Dashboard to allow reading, write and invoke operations on clusters directly from the UI for testing and debugging purposes
- Enhancement: Migrate read and write attribute commands to new matter.js API to prevent legacy state initialization
- Fix: Ignore link-local addresses for WebSocket commissioning requests
- Fix: Do not send a "Not offline" event via websocket when the server shuts down
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Handles BLE commissioning for misdeclared non-concurrent devices more resiliently
    - Removes stale test-mode OTA update files when test-DCL is disabled
    - Optimizes commissioning with mixed ULA + link-local IPv6 addresses
    - Optimizes MDNS server handling of unrelated queries
    - Optimizes Session handling on node decommissioning

## 0.6.1 (2026-04-16)

- Fix: Update matter.js to the latest 0.17.0-nightly
    - Wait up to 60 seconds for devices to connect to Thread/Wifi networks
    - Optimized PASE connections when multiple IPs were found

## 0.6.0 (2026-04-15)

- Change: Consider devices as offline 3 minutes in the reconnection state
- Adjustment: Streamlined some Dashboard UI topics to have a more streamlined UI and basis for enhancements
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Improves DNS-SD discovery reliability

## 0.5.15 (2026-04-10)

- No-Change-Re-Release because Python and Docker had publishing issues on GitHub for 0.5.14

## 0.5.14 (2026-04-10)

- Fix: Correctly reports Node availabilities via WS events to HA and other consumers (also consider a device offline after five mins in Reconnection state)
- Fix: Allows binding deletion via the dashboard when the target node no longer exists and other consistency checks
- Fix: Fixes shutdown hang when SIGINT arrives during the startup phase
- Fix: Adds global attributes to custom cluster Python classes
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Fixes and enhances multiple commissioning issues around Discovery, PASE, and BLE
    - More RAM optimizations
    - Fixes cache flush crash and data race after node deletion
    - Reintroduces Probe logging

## 0.5.13 (2026-04-02)

- Fix: Ignore directories in the OTA update directory
- Fix: (FuNK3Y) Enhances network interface name logic for Websocket binding
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Fixes some model and Tlv access errors from the latest version
    - Fixes a CASE establishment edge case when multiple IPs are tried

## 0.5.12 (2026-04-01)

- Feature: (FuNK3Y) Allows network interface name for Websocket binding
- Enhancement/Fix: Update matter.js to the latest 0.17.0-nightly
    - RAM usage optimization and other refactorings in the background
    - Fixes a BLE crash case
    - Optimizes commissioning edge and error cases
    - Buffer client cluster writes; persists only every 20 minutes

## 0.5.10 (2026-03-27)

- Fix: Ensures correct shutdown flow including releasing all locks

## 0.5.9 (2026-03-26)

- Fix: Always return response data for device commands (ignore "response_type")

## 0.5.8 (2026-03-26)

- Increase Legacy Eve device energy data polling to 60s (was 30s) to reduce traffic on thread network
- Enhancement/Fix: Update matter.js to the latest 0.17.0-nightly
    - Optimizes commissioning process and device connections during commissioning
    - RAM usage reductions and improvements
    - Optimizes reconnections and how fast we react to new detected IPs to speed up reconnections
    - Probes discovered addresses and potentially updates the session address when they change even when we have a valid working session
    - Ensures a proper BDX session teardown when non-bdx errors happened
    - Fixes crash cases during commissioning (BLE and when multiple IPs were found)

## 0.5.7 (2026-03-13)

- Fix: Corrects event payload encoding in websocket messages to match the Python server (and fixes bug from 0.5.6)
- Fix: Only stream attribute updates after start_listening like all other event-style websocket messages
- Fix: Try to optimize requested IP list for the node

## 0.5.6 (2026-03-12)

- Fix: Corrects event payload encoding in websocket messages to match the Python server
- Fix: When querying IPs always include the IP of the current session (if any) and/or the fallback IP
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Enhances session and OTA management when devices reboot surprisingly and push new sessions
    - Optimized OTA process for Ikea "multiple reboots" OTA updates
    - Ensures commands are never queued

## 0.5.5 (2026-03-11)

- Enhancement: Adds log file rotation (seven daily backups, rotated on startup and every 24 hours) when --log-file is specified
- Enhancement: Allows configuration of the DCL location and networking settings
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Sets subscription minimum interval to 0 for ICD devices
    - Only declare peer lost when an exchange received no response
    - Skip deletion of already-destroyed child endpoints during peer removal
    - Respect the 5 minute BDX timeout also for transfer problems
    - Properly expire commissionable device records when TTL runs out

## 0.5.4 (2026-03-08)

- Fix: Initializes the Fabric storage when migrating from Python server to prevent startup issues
- Fix: Update matter.js to the latest 0.17.0-nightly
    - Increase subscription timeout with 8-second bonus time
    - Re-introduce data version filter refresh after incomplete reads or subscriptions
    - Ensures delivery of all events to the ChangeNotificationService (and to WebSocket clients)
    - Restores processing of incoming data reports from the final message directly rather than after receiving the acknowledgement
    - Prepares configuration options for the network profiles (official support introduced in a later release)

## 0.5.3 (2026-03-07)

- Fix: Update matter.js to the latest 0.17.0-nightly
    - Fixes the broken storage initialization that rendered 0.5.2 unusable depending on how the storage path was provided in CLI

## 0.5.2 (2026-03-06) - REVERTED!!! DO NOT USE!

- Fix/Enhancement: Update matter.js to the latest 0.17.0-nightly
    - Fix hanging interactions (Read/Subscribe) and ensure proper timeouts when the device answered unexpectedly, or we aborted internally
    - Prevents removing clusters when devices contain them but not declaring them ("Schrödinger's clusters")

## 0.5.1 (2026-03-05)

- Fix: Revert one Eve change for pressure custom attribute
- Fix/Enhancement: Update matter.js to 0.17.0-nightly
    - Fix invoke batching
    - Fix uncommissioned peer startup issues

## 0.5.0 (2026-03-05)

- Feature: Allows searching for thread nodes in the network graph by extended address
- Adjustment: Also sorts neighbors in network graph details by quality
- Fix: Fixed datatype of some custom cluster attributes
- Fix: Only allows starting a node update when the node is connected/subscribed currently
- Fix/Enhancement: Update matter.js to 0.17.0-nightly
    - Rework and further optimize Discovery and connection logic
    - Fix cases where BLE disconnects could crash the server

## 0.4.3 (2026-02-25)

- Adjustment: Sort connection quality entries in network graph details by quality
- Fix: Fixed encoding of custom array-based data types
- Fix: Triggers a full node-update when a (Bridged Node) Basic Information cluster attribute changes
- Fix: Uses the same kind of signal icons for all signal levels
- Fix/Enhancement: Update matter.js to 0.16.11-nightly

## 0.4.2 (2026-02-22)

- Fix: Sanitize wifi/thread credentials in the log when setting them
- Fix: Update matter.js to 0.16.10

## 0.4.1 (2026-02-21)

- Feature: Added a new "Drop-in-replacement" matter-python-client as a replacement for the Matter Server package
- Fix: Fixes custom-cluster writable attributes
- Fix: Fixed datatype of a thirdreality custom cluster attribute
- Fix: Update matter.js to 0.16.10-nightly
    - Fixes waiting time calculation for peer responses
    - Ensure subscriptions are also properly handled queued

## 0.4.0 (2026-02-19)

- BREAKING: (schildbach) Only for Docker/Podman users: run server as an unprivileged user. Use `chown -R 1000:1000 /path-to-data-volume` once to migrate permissions!
  If you're using rootless Podman or Docker and user namespaces, UIDs and GIDs will be remapped to a different value and the previous command
  needs to be adapted accordingly. If you want to avoid that, use the `--userns=keep-id` option when running the container.
- Enhancement: (schildbach) Upgrade docker to use Debian Trixie as a base image, improve health checking
- Enhancement: De-duplicate commands to the same node, endpoint, cluster, and command
- Fix: (majd) Handle null values for optional command fields to restore Python Matter Server compatibility
- Fix/Enhancement: Update matter.js to 0.16.10-nightly
    - Optimize BLE handling
    - Ignore known addresses when current MDNS results do not include them anymore
    - OTA update files are now stored per software version, allowing different updates to be served to different nodes simultaneously. Former files are migrated.
    - Optimize MRP timings when sending retransmissions to address expected network congestion
    - Prevent multiple commands for the same path from being batched into one command
    - Optimize reconnection handling on OTA updates

## 0.3.8 (2026-02-16)

- Enhancement: (lboue) Add Eve childLock custom attributes
- Enhancement: Enhance mapping and naming of "Unknown" Nodes in the thread graph
- Enhancement: (lboue) Also show icons for endpoints in the dashboard
- Enhancement: Add clear warnings for test-net and local updates also in the dashboard
- Fix: Correct write_attribute handling for structs and arrays and correctly convert the values
- Fix: Restore compatibility to Python Matter Server in command requests and responses
- Fix: Fixes "unknown" datatype information in the dashboard for attributes
- Fix/Enhancement: Update matter.js to 0.16.9-nightly
    - Batch invoke-commands when received "at the same time" and node supports multiple commands at once
    - Optimizes OTA handling and prevents the OTA state engine being blocked on failed updates
    - Matter messaging optimizations

## 0.3.7 (2026-02-12)

- Fix: Improve the performance of startup and start_listening WebSocket command

## 0.3.6 (2026-02-11)

- Enhancement: Update Icons in Dashboard graphs and introduce in UI
- Adjustment: (Leo2442926161) Update the Heiman custom attributes
- Adjustment: Defined Inovelli attributes writable
- Enhancement: (lboue) Add Eve childLock custom attribute
- Fix: Add missing package dependencies to the docker container to enable BLE support
- Fix: Update matter.js to 0.16.9-nightly
    - Add Jitter to max ceiling for subscription when thread to spread datareports a bit better
    - Prevent duplicate or suppressed attribute changes
    - Ignore invalid VendorIds or DeviceTypeIds when processing MDNS data
    - Correctly initialize ReceptionCounter for CASE sessions

## 0.3.5 (2026-02-04)

- Enhancement: Optimizes Thread/Wifi graph
- Enhancement: When configuring ACLs or bindings via the dashboard, show more detailed errors when relevant
- Enhancement: Add `--production-mode` CLI option and `PRODUCTION_MODE` env var to force dashboard production mode when running behind a reverse proxy
- Fix: Added missing BLE packages to the docker container to enable BLE
- Fix: Update matter.js to 0.16.9-nightly
    - Optimizes some edge cases around IP changes for devices
    - Fixes errors when a node is decommissioned by the admin of another fabric

## 0.3.4 (2026-02-01)

- Enhancement: Consistently show the hex variant of the node id in all dashboard views to allow easier log mapping
- Enhancement: Add Reload capabilities to Thread and Wi-Fi visualizations in the dashboard to update node data immediately
- Enhancement: Display node address in hex format (`@fabricindex:nodeId`) in node/endpoint/cluster views
- Enhancement: Incorporate Thread route table data for richer network visualization (bidirectional LQI, path cost, routable destinations count). See [Dashboard README](packages/dashboard/README.md) for details.
- Fix: Update matter.js to 0.16.9-nightly
    - Exposes message diagnostics for interactions to especially show retransmissions also on info loglevel

## 0.3.3 (2026-01-30)

- Feature: Allows setting the Node Label via BasicInformation cluster command in the dashboard
- Feature: Adds Thread and Wi-Fi visualizations with the diagnostic cluster data (if provided by the device) in the dashboard

## 0.3.2 (2026-01-30)

- Feature: Expose the Matter version of the device in Node details and the Dashboard (not integrated in HA yet because not returned by the Python server)
- Enhancement: Delay Unavailability information to websocket a bit when "just" re-establishing the subscription
- Enhancement: (ximex) Optimizations for Dashboard code
- Fix: Correctly set the basic Information cluster information for the Controller node
- Fix: Update matter.js to 0.16.8-nightly
    - Fixes cases where devices were not properly reconnecting as soon as a list of IPs (aka mdns discovery) was requested
    - Prevents collecting IPs to overwrite newer IPs when sessions close
    - Ignores File size mismatches for OTA files when checksum matches (unblocks Nanoleaf updates)

## 0.3.1 (2026-01-28)

- Adjustment: Adjust some logging messages

## 0.3.0 (2026-01-28)

- BREAKING: (Only relevant for users that do not use the HomeAssistant Add-On)
    - Now respects the provided FabricID and VendorID when starting the server and migrating data from a former storage!
      Before this version we always used the "first chip.json entry" and took FabricId/VendorId from there. Now the
      provided parameters are used, and if not matching to any chip.json entry, we startup with an empty storage.
    - Renames the storage directory from "server" to "server-<fabricId>-<vendorId>" to ensure proper separation of
      multiple servers in one storage
- Enhancement: Introduce /health endpoint to use for (docker) health checks. It returns the server version and number of nodes
- Enhancement: Correctly handles the start up of the server with multiple fabric-ids and vendor-ids in the same storage
- Adjustment: The server-id and storage directory inside the data directory will be renamed on next start to match the multi-fabric structure
- Adjustment: Adhere to the default nodeId 112233 for the controller itself as the Python Matter server did
- Adjustment: For fresh starts the next node id to be commissioned will be 1 as it was for the Python Matter Server
- Fix: Start up the server also when no nodes exist in the migrated json file. Logs a warning
- Fix: Tries to read the backup json-file when the normal json-file is not parseable or does not exist
- Fix: Optimize responsive layout of Dashboard
- Fix: Return errors more consistently to how the Python server was returning them
- Fix: Fixes datatypes for Neo Custom clusters to be decoded correctly
- Fix: Update matter.js to 0.16.8-nightly
    - Fixes many issues with reconnections to devices, especially when IPs change, e.g., in thread networks or such
    - Do not show updates that are available locally for unapplicable version ranges or already updated devices
    - Optimizes mDNS handling in general
    - Optimize re-using sessions pushed by devices instead of creating new ones

## 0.2.9 (2026-01-22)

- Fix: Fixes the datatype for the Eve pressure attribute
- Fix: Return mDNS-discovered IPs for a node when requesting them and also ping these
- Fix: Update matter.js to 0.16.7
    - Fix OTA update availability checks

## 0.2.8 (2026-01-22)

- Fix: Fixes the BLE commissioning capabilities

## 0.2.7 (2026-01-22)

- Enhancement: Optimizes initial migration with empty matter.js storage and inject peers directly
- Enhancement: Added an option to temporarily change the loglevel while the server runs
- Enhancement: Added Dark mode including selection of the theme via button and query parameter
- Enhancement: Streamlined the "No Websocket connection" page and allow reloading of the page
- Enhancement: Allow specifying timeouts for responses in the Websocket client and track them. Throws an error if the response times out
- Enhancement: Add the peer address in the dashboard after the node-id to allow mapping to logs more easily
- Adjustment: Optimize performance by migrating reading and invoking to use the new internal Node-API
- Fix: Refactor BigInt aware JSON parsing to avoid issues when importing nodes
- Fix: Show names in the dashboard in the same format as the Python server
- Fix: Fix some datatypes for custom eve cluster attributes
- Fix: Also respect the chip magic values when reading wildcard attributes
- Fix: Update matter.js to 0.16.6
    - Fixes and optimizations around mDNS discovery when starting the server the first time with many devices
    - Fixes some issues in high-traffic situations
    - Do not announce our node as update-provider to prevent issues if users switch back to the Python server
    - Correctly handle node decommissioning by other controllers and optimize decommissioning via ourselves
    - Extend error handling when persisting legacy node details
    - Optimize startup performance by initializing some internal structures lazy when needed
    - Logging enhancements

## 0.2.6 (2026-01-16)

- Enhancement: Show more details in the dashboard for software update states beside "Downloading"
- Fix: Initialize "next node id" correctly when starting the server
- Fix: Only execute custom attribute polling when the node is connected
- Fix: Streamlines Hex-Number displaying in the Dashboard (Cluster-/Attribute-IDs)

## 0.2.5 (2026-01-16)

- Enhancement: Uses a best effort approach to detect the used Fabric label from the Python server
- Fix: Ensures correct handling and storing of the desired FabricLabel

## 0.2.4 (2026-01-16)

- Enhancement: Re-adds the energy-polling for Eve devices that did not have an update to the Matter attributes
- Enhancement: Allows using Environment Variables to configure the Matter Server instead of using CLI parameters
- Enhancement: Displays the global cluster attributes always last in the cluster view of the dashboard
- Enhancement: Include custom cluster definitions in the generated dashboard data to show attributes and clusters with names
- Fix: Update matter.js to 0.16.5
    - Correctly handles already downloaded production OTA updates as production updates

## 0.2.3 (2026-01-15)

- Enhancement: Allows a LOG_LEVEL environment variable to control the log level of the Matter server when started via docker container
- Enhancement: Added some basic cluster commands (OnOff and LevelControl) to the dashboard for more simple testing.
- Fix: Prevents displaying of duplicate cluster details in the dashboard
- Fix: Update matter.js to 0.16.4
    - Also report attribute updates for bridges correctly (depending on endpoint-structure, they were partially missing)
    - Also accept invalid attribute-ids in the migrated and data from paired nodes
    - Exclude usage of the Thread interaction queue for command invokes, so you need to know yourself what you are doing

## 0.2.2 (2026-01-14)

- Fix: update matter.js to 0.16.2

## 0.2.1 (2026-01-13)

- Fix: remove a require-lookup which was not ESM

## 0.2.0 (2026-01-13)

- Initial release as Drop-In replacement for the [OHF Python-Matter-Server](https://github.com/matter-js/python-matter-server) v8.1.2. Please refer to the README.md for differences.
