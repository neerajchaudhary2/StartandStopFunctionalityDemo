const {sdk} = require("@symblai/symbl-js");

const APP_ID = "<Add your Symbl APP Id here>";
const APP_SECRET = '<Add Your Symbl App Secret here>';
const USER_ID = 'Neeraj_Chauddhary';
const FULL_NAME = 'Neeraj chaudhary';

const uuid = require("uuid").v4;

const readline = require('readline');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

// For demo purposes, we're using mic to simply get audio from the microphone and pass it on to the WebSocket connection
const mic = require("mic");

const sampleRateHertz = 16000;

const micInstance = mic({
    "rate": sampleRateHertz,
    "channels": "1",
    "debug": false,
    "exitOnSilence": 6
});

let stopped = true;
let startStoppedProgress = false;
let terminationInProgress = false;

(async () => {

    try {

        // Initialize the SDK
        await sdk.init({
            "appId": APP_ID,
            "appSecret": APP_SECRET,
            "basePath": "https://api-labs.symbl.ai"
        });

        // Need unique Id
        const id = uuid();

        console.log(`Establishing new stream with Symbl -- Connection ID: ${id}`);
        // Start Real-time Streaming Request (Uses Streaming API behind the scenes)
        const stream = await sdk.createStream({
            id,
            "disconnectOnStopRequest": false,
            "disconnectOnStopRequestTimeout": 300,
            "noConnectionTimeout": 900,
            "insightTypes": [
                "action_item",
                "question"
            ],
            "config": {
                "meetingTitle": "My Test Meeting", // Set name for meeting
                "confidenceThreshold": 0.7,
                "timezoneOffset": 480, // Offset in minutes from UTC
                "languageCode": "en-US",
                sampleRateHertz
            },
            "speaker": {
                // Optional, if not specified, will simply not send an email in the end.
                "userId": USER_ID, // Update with valid email
                "name": FULL_NAME
            },
            "handlers": {
                // This will return live speech-to-text transcription of the call.
                "onSpeechDetected": (data) => {
                    if (data) {
                        const {punctuated} = data;
                        console.log(
                            "Live: ",
                            punctuated && punctuated.transcript
                        );
                        console.log("");
                    }
                },

                // When processed messages are available, this callback will be called.
                "onMessageResponse": (data) => {
                    console.log(
                        "onMessageResponse",
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    );
                },

                // When Symbl detects an insight, this callback will be called.
                "onInsightResponse": (data) => {
                    console.log(
                        "onInsightResponse",
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    );
                },

                // When Symbl detects a topic, this callback will be called.
                "onTopicResponse": (data) => {
                    console.log(
                        "onTopicResponse",
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    );
                }
            }
        });
        console.log("Successfully initialized stream with Symbl -- Connection ID: ", stream.connectionId);

        const micInputStream = micInstance.getAudioStream();

        // Raw audio stream
        micInputStream.on(
            "data",
            (data) => {
                // Push audio from Microphone to websocket stream
                stream.sendAudio(data);
            }
        );

        // Logging errors from  the mic instance
        micInputStream.on(
            "error",
            (err) => {
                console.log(`Error in Input Stream: ${err}`);
            }
        );

        // Logging when the mic instance connects and begins listening to microphone
        micInputStream.on(
            "startComplete",
            () => {
                console.log("Started listening to Microphone.");
            }
        );

        // Logging when the mic is only picking up silence.
        micInputStream.on(
            "silence",
            () => {
                console.log("Silence detected...");
            }
        );

        micInstance.start();

        console.log(`Mic initialization complete. You're stopped. Please press 's' to start and wait for the console log to start speaking...`);

        process.stdin.on('keypress', async (str, key) => {
            if (key.ctrl && key.name === 'c') {
                process.exit();
            } else if (key.name === 's') {
                if (!stopped && !startStoppedProgress) {
                    startStoppedProgress = true;
                    console.log('\r\nStopping...');
                    await stream.stop();
                    stopped = true;
                    console.log('stopped.');
                    startStoppedProgress = false;
                } else if (stopped && !startStoppedProgress) {
                    startStoppedProgress = true;
                    console.log('\r\nStarting');
                    let time =new Date();
                    console.log(time);
                    await stream.start();

                    stopped = false;
                    console.log('Started.');
                    console.log("time to start stream " + (new Date() -time));
                    startStoppedProgress = false;
                }
            } else if (key.name === 't' && !terminationInProgress) {
                terminationInProgress = true;
                console.log('Terminating stream');
                micInstance.stop();
                console.log("Stopped listening to Microphone.");

                try {
                    // Stop stream
                    await stream.stop();
                    console.log("Connection Stopped.");
                } catch (e) {
                    console.error(
                        "Error while stopping the stream.",
                        e
                    );
                }

                terminationInProgress = false;
            }
        });

        (async () => {
            const conversationId = await stream.conversationId;
            console.log(`Conversation ID: ${conversationId}`);
        })();

    } catch (e) {
        console.error(
            "Error: ",
            e
        );
    }

})();
