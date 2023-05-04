var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
System.register("main", ["uuid-tool"], function (exports_1, context_1) {
    "use strict";
    var uuid_tool_1, Channel, RTCPacketType, channels, parsedUrl, localUuid, MCSocket, RTCSocket, localStream;
    var __moduleName = context_1 && context_1.id;
    function handleRTC(audioProcessingData) {
        // initate connections not in channels
        for (var uuid in audioProcessingData) {
            if (uuid in channels)
                continue;
            initChannel(uuid);
        }
        // close connections not in audioProcessingData
        for (var uuid in channels) {
            if (uuid in audioProcessingData)
                continue;
            endChannel(uuid);
        }
    }
    function initChannel(uuid) {
        var channel = new Channel();
        var config = { iceServers: [{ urls: 'stun:stun2.1.google.com:19302' }] };
        channel.connection = new RTCPeerConnection(config);
        // add local track to connection
        channel.connection.addTrack(localStream.getAudioTracks()[0]);
        //manage audio nodes and element
        channel.connection.ontrack = function (ev) { return initAudioFromTrack(uuid, ev.track); };
        //send ICE candidate whenever we receive one
        channel.connection.onicecandidate = function (ev) { return send(RTCPacketType.CANDIDATE, uuid, ev.candidate); };
        //initiate offer only if prioritized
        if (localUuid > uuid) {
            channel.connection.createOffer()
                .then(function (offer) {
                send(RTCPacketType.CANDIDATE, uuid, offer);
                channel.connection.setLocalDescription(offer);
            });
        }
        channels[uuid] = channel;
    }
    function endChannel(uuid) {
        $("#".concat(uuid)).remove();
        channels[uuid].connection.close();
        delete channels[uuid];
    }
    function handleOffer(data) {
        var conn = channels[data.from].connection;
        conn.setRemoteDescription(new RTCSessionDescription(data.body));
        //create an answer to an offer and send it to
        conn.createAnswer()
            .then(function (answer) { return send(RTCPacketType.ANSWER, data.from, answer); });
    }
    function handleAnswer(data) {
        var conn = channels[data.from].connection;
        conn.setRemoteDescription(new RTCSessionDescription(data.body));
    }
    //when we got an ice candidate from a remote user
    function handleCandidate(data) {
        var conn = channels[data.from].connection;
        conn.addIceCandidate(new RTCIceCandidate(data.body));
    }
    function initAudioFromTrack(uuid, track) {
        var stream = new MediaStream();
        stream.addTrack(track);
        var channel = channels[uuid];
        //create GainNode and StereoPannerNode for given uuid and create audio element
        channel.context = new AudioContext();
        var source = channel.context.createMediaStreamSource(stream);
        channel.gain = channel.context.createGain();
        channel.pan = channel.context.createStereoPanner();
        source.connect(channel.gain);
        source.connect(channel.pan);
        channel.gain.connect(channel.context.destination);
        channel.pan.connect(channel.context.destination);
        //create audio elements
        $('#audios').append($('<audio/>', { srcObject: stream, id: uuid }));
    }
    function handleAudio(audioProcessingData) {
        for (var _i = 0, _a = Object.entries(channels); _i < _a.length; _i++) {
            var _b = _a[_i], uuid = _b[0], channel = _b[1];
            if (!channel.context)
                return;
            channel.gain.gain.setValueAtTime(audioProcessingData[uuid].gain, channel.context.currentTime);
            channel.pan.pan.setValueAtTime(audioProcessingData[uuid].pan, channel.context.currentTime);
        }
    }
    // UTIL
    //send data
    function send(type, to, body) {
        RTCSocket.send(JSON.stringify({
            type: type,
            from: localUuid,
            to: to,
            body: body
        }));
    }
    //AudioProcessingData.tobytes() but in reverse
    function fromBytes(data) {
        var reader = new FileReader();
        reader.readAsArrayBuffer(data);
        return new Promise(function (resolve) { return reader.onloadend = function () {
            var out = {};
            var BYTES = 24;
            var parsedData = new Uint8Array(reader.result);
            for (var i = 0; i < parsedData.length; i += BYTES) { //for each chunk of bytes encoding (UUID, AudioProcessingData.ChannelProcessingData)
                var uuid = new uuid_tool_1.Uuid();
                // UUID from first 16 bytes of chunk
                uuid.fromBytes(Array.from(parsedData.slice(i, i + 16)));
                //AudioProcessingData.ChannelProcessingData.gain from the following 4 bytes of chunk
                var gain = toFloat((parsedData[i + 16] << 8 * 3) + (parsedData[i + 17] << 8 * 2) + (parsedData[i + 18] << 8 * 1) + (parsedData[i + 19] << 8 * 0));
                //AudioProcessingData.ChannelProcessingData.pan from the last 4 bytes of chunk
                var pan = toFloat((parsedData[i + 20] << 8 * 3) + (parsedData[i + 21] << 8 * 2) + (parsedData[i + 22] << 8 * 1) + (parsedData[i + 23] << 8 * 0));
                out[uuid.toString()] = {
                    gain: gain,
                    pan: pan
                };
            }
            resolve(out);
        }; });
    }
    //bytes of uint32 to float32
    function toFloat(n) {
        n = +n;
        var res;
        var mts = n & 0x007fffff;
        var sgn = (n & 0x80000000) ? -1 : 1;
        var exp = (n & 0x7f800000) >>> 23;
        function mantissa(mts) {
            var bit = 0x00400000;
            while (mts && bit) {
                mts /= 2;
                bit >>>= 1;
            }
            return mts;
        }
        if (exp === 0xff) {
            //NaN or +/- Infinity
            res = mts ? NaN : sgn * Infinity;
        }
        else if (exp) {
            //Normalized value
            res = sgn * ((1 + mantissa(mts)) * Math.pow(2, exp - 127));
        }
        else if (mts) {
            //Subnormal
            res = sgn * (mantissa(mts) * Math.pow(2, -126));
        }
        else {
            //zero, -zero
            res = (sgn > 0) ? 0 : -0;
        }
        return res;
    }
    return {
        setters: [
            function (uuid_tool_1_1) {
                uuid_tool_1 = uuid_tool_1_1;
            }
        ],
        execute: function () {
            Channel = /** @class */ (function () {
                function Channel() {
                }
                return Channel;
            }());
            (function (RTCPacketType) {
                RTCPacketType["OFFER"] = "offer";
                RTCPacketType["ANSWER"] = "answer";
                RTCPacketType["CANDIDATE"] = "candidate";
            })(RTCPacketType || (RTCPacketType = {}));
            channels = {};
            parsedUrl = new URL(window.location.href);
            if (!(parsedUrl.searchParams.get('u') && parsedUrl.searchParams.get('t'))) {
                throw Error('Missing parameters "u" or "t" in URL');
            }
            localUuid = parsedUrl.searchParams.get('u') || '';
            // MINECRAFT (MAIN)
            MCSocket = new WebSocket("ws://".concat(parsedUrl.host, "/ws/mc").concat(parsedUrl.search));
            MCSocket.onmessage = function (ev) { return __awaiter(void 0, void 0, void 0, function () {
                var audioProcessingData;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, fromBytes(ev.data)];
                        case 1:
                            audioProcessingData = _a.sent();
                            handleRTC(audioProcessingData);
                            handleAudio(audioProcessingData);
                            return [2 /*return*/];
                    }
                });
            }); };
            MCSocket.onclose = function () {
                throw Error('Incorrect login credentials');
            };
            // WEBRTC
            RTCSocket = new WebSocket("ws://".concat(parsedUrl.host, "/ws/rtc").concat(parsedUrl.search));
            RTCSocket.onmessage = function (ev) {
                var data = JSON.parse(ev.data);
                if (data.to != localUuid || !channels[data.from].connection)
                    return;
                switch (data.type) {
                    case RTCPacketType.OFFER:
                        handleOffer(data);
                        break;
                    case RTCPacketType.ANSWER:
                        handleAnswer(data);
                        break;
                    case RTCPacketType.CANDIDATE:
                        handleCandidate(data);
                        break;
                }
            };
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then(function (stream) { localStream = stream; });
            ////bytes of uint32 to float32
            //function toFloat($: number): number{var f,_=8388607&($=+$),r=2147483648&$?-1:1,n=(2139095040&$)>>>23;function o($){for(var f=4194304;$&&f;)$/=2,f>>>=1;return $}return 255===n?_?NaN:r*(1/0):n?r*((1+o(_))*Math.pow(2,n-127)):_?r*(11754943508222875e-54*o(_)):0}
        }
    };
});
