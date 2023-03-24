const { google } = require('googleapis');

const { auth } = require('google-auth-library');
require('dotenv').config();

// const auth = new google.auth.GoogleAuth({
//     keyFile: 'stately-math-102912-b0f55da6547d.json',
//     scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/meet']
// });

// const meet = google.meet({
//     version: 'v1',
//     auth
// });
console.log('env', process.env.GOOGLE_APPLICATION_CREDENTIALS);
async function Authentication() {
  const authClient = await auth.getClient({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/meet',
    ],
  });
  return authClient;
}
let authClient;
Authentication().then((val) => {
  authClient = val;
  // console.log(`authClient ${JSON.stringify(authClient)}`);
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  // console.log(`calendar ${JSON.stringify(calendar)}`);
  calendar.events.list(
    {
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 1,
      singleEvents: true,
      orderBy: 'startTime',
    },
    (err, res) => {
      if (err) {
        console.log('Error fetching calendar events: ', err);
        return;
      }

      // Extract the Meet link from the event details
      const event = res.data.items[0];
      const meetLink = event.conferenceData.entryPoints.find(
        (entryPoint) => entryPoint.entryPointType === 'video'
      ).uri;

      console.log(`event ${event}`);
      // Use the Meet client to join the bot to the meeting
      const meet = google.meet({ version: 'v1', auth: authClient });

      // console.log(`meet ${meet}`);
      meet.events.watch(
        {
          requestBody: {
            id: event.id,
            resourceUri: meetLink,
          },
        },
        (err, res) => {
          if (err) {
            console.log('Error joining meeting: ', err);
            return;
          }

          console.log('Bot has joined the meeting!');
        }
      );
    }
  );
});

async function main() {
  console.log(`authClient${JSON.stringify(authClient)}`);
  console.log(google.meet);
  const meet = google.meet({
    version: 'v1',
    auth: authClient,
  });
  // Join the Google Meet call
  const { data } = await meet.conferences.join({
    requestBody: {
      conferenceSolutionKey: {
        type: 'hangoutsMeet',
      },
      requestId: 'my-request-id',
    },
    conferenceId: 'my-conference-id',
  });

  const {
    data: {
      conferenceData: {
        conferenceSolution: { key },
      },
      conferenceState,
    },
  } = data;
  const {
    data: { participantData },
  } = await meet.conferences.participants.list({
    conferenceId: conferenceState.conferenceSolution[key].conferenceId,
  });

  // First, let's check if there are any participants in the call
  if (participantData.length === 0) {
    console.log('No participants in the call.');
    return;
  }

  // Next, let's create a media recorder to record the audio and video streams of each participant
  const mediaRecorder = new MediaRecorder();

  // Let's define a function to handle the media stream from each participant
  const handleStream = (stream) => {
    // Add the stream to the media recorder
    mediaRecorder.addStream(stream);
  };

  // Let's loop through each participant and add their audio and video streams to the media recorder
  participantData.forEach((participant) => {
    const { participantId } = participant;
    meet.conferences.participants
      .get({
        conferenceId: conferenceState.conferenceSolution[key].conferenceId,
        participantId,
      })
      .then((response) => {
        const {
          data: { stream },
        } = response;
        handleStream(stream);
      })
      .catch((error) => {
        console.log(`Error getting participant stream: ${error}`);
      });
  });

  // Start recording the audio and video streams
  mediaRecorder.start();

  // Let's define a function to stop the recording and download the recorded media
  const stopRecording = () => {
    // Stop the media recorder
    mediaRecorder.stop();
    // Download the recorded media
    const recordedMedia = new Blob(mediaRecorder.getRecordedData());
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(recordedMedia);
    downloadLink.download = 'recorded_media.webm';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Let's stop the recording after 30 minutes
  setTimeout(() => {
    stopRecording();
  }, 1800000); // 30 minutes = 1800000 milliseconds
}

// main();
