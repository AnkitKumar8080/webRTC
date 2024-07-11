import fs from "fs";
// import https from "https";
import http from "http";
import express from "express";
import { Server as CreateSocketServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";

// We need a key and cert to run HTTPS
// We generated them with mkcert
// $ mkcert create-ca
// $ mkcert create-cert

// const key = fs.readFileSync("cert.key");
// const cert = fs.readFileSync("cert.crt");

// Change our express setup so we can use HTTPS
// Pass the key and cert to createServer on HTTPS

// const app = express();
// const expressServer = https.createServer({ key, cert }, app);

const expressServer = http.createServer(express());

// Create our Socket.io server... it will listen to our express port
const io = new CreateSocketServer(expressServer, {
  cors: {
    // origin: [
    //   "https://127.0.0.1:5173",
    //   "https://192.168.0.195:5173", // if using a phone or another computer
    // ],
    origin: "http://localhost:5173", // Corrected origin format
    methods: ["GET", "POST"],
  },
});

// Listen to our express server
expressServer.listen(8180, () => {
  console.log("🛰️ Signaling server listening on port 8180");
});

// Offers will contain
const offers = [
  // offererUserId
  // offer
  // offerIceCandidates
  // answererUserId
  // answer
  // answererIceCandidates
];
// const connectedSockets = [
//   // userId, socketId
// ];

const connectedSockets = new Map();

io.on("connection", (socket) => {
  // Get a userId from client or generate own Generate a unique user ID for each connection
  const receivedUserId = socket.handshake.auth.userId;
  let userId;

  if (!receivedUserId) {
    userId = uuidv4();
  } else {
    userId = receivedUserId;
  }

  console.log(`\nUser: ${userId} connected\nsocketId: ${socket.id}`);

  // Send the user ID back to the client
  socket.emit("assignUserId", userId);

  // Push the socket details into connectedSocket array

  connectedSockets.set(userId, { userId, socketId: socket.id });

  // Listen for new offers
  socket.on("newOffer", ({ newOffer, sendToUserId }) => {
    const newOfferObj = {
      offererUserId: userId,
      offer: newOffer,
      offerIceCandidates: [],
      answererUserId: null,
      answer: null,
      answerIceCandidates: [],
    };

    // console.log("received offer: " + JSON.stringify(newOfferObj));

    offers.push(newOfferObj);

    // Get the socket id to whom the offer to be sent
    const sendToSocket = connectedSockets.get(sendToUserId);

    if (!sendToSocket) {
      console.log("No matching user socket found");
      return;
    }

    // Emit the offer to the client2
    console.log(newOfferObj);
    socket.to(sendToSocket.socketId).emit("newOfferAwaiting", newOfferObj);
  });

  // Listen for new answers
  socket.on("newAnswer", (offerObj, ackFunction) => {
    // Emit the answer offer back to client1, so first search for client1 socket
    const socketToAnswer = connectedSockets.get(offerObj.offererUserId);

    if (!socketToAnswer) {
      console.log("No matching offerer object found");
      return;
    }

    // Get the socket id of client1(offerer)
    const socketIdToAnswer = socketToAnswer.socketId;

    // Now get the offer object of the client1(offerer) and update the object
    const offerToUpdate = offers.find(
      (offer) => offer.offererUserId === offerObj.offererUserId
    );

    if (!offerToUpdate) {
      console.log("No offer object found to update");
      return;
    }

    // Send the ICE candidate of offerer(client1) back to answerer
    ackFunction(offerToUpdate.offerIceCandidates);

    // Update the offer object with the new answer
    offerToUpdate.answer = offerObj.answer;
    offerToUpdate.answererUserId = userId;

    // Send the updated offer with answer back to client1(offerer)
    socket.to(socketIdToAnswer).emit("answerResponse", offerToUpdate);
  });

  // Listen for new ICE candidates
  socket.on("sendIceCandidateToSignalingServer", (iceCandidateObj) => {
    console.log("recieved ice candidate from client");
    const { didIOffer, iceUserId, iceCandidate } = iceCandidateObj; // Destructuring the object

    console.log(didIOffer, iceUserId);

    // If the ICE candidate was sent by the offerer
    if (didIOffer) {
      // Find the offer object in offers to update the ICE candidates with
      const offerToUpdate = offers.find(
        (offer) => offer.offererUserId === iceUserId
      );

      if (offerToUpdate) {
        offerToUpdate.offerIceCandidates.push(iceCandidate);
      }

      // temp
      // console.log(
      //   "updated the iceCandidate of userId: " +
      //     iceUserId +
      //     "\niceCandidate: " +
      //     JSON.stringify(iceCandidate)
      // );
      console.log("updated offer: " + JSON.stringify(offerToUpdate, null, 2));

      // Now what if the answerer ICE candidates already exist before the offerer,
      // so in this case send all the answerer ICE candidates to the answerer
      if (offerToUpdate && offerToUpdate.answererUserId) {
        const socketToSendTo = connectedSockets.get(
          offerToUpdate.answererUserId
        );

        // If the socket info is found then we emit ICE candidates to the answerer
        if (socketToSendTo) {
          socket
            .to(socketToSendTo.socketId)
            .emit("receivedIceCandidateFromServer", iceCandidate);
        } else {
          console.log("ICE candidates received but couldn't find the answerer");
        }
      }
    } else {
      // If didIOffer was false, i.e., the ICE candidates were from the answerer

      // Find the offer object in offers
      const offerToUpdate = offers.find(
        (offer) => offer.answererUserId === iceUserId
      );

      if (!offerToUpdate) {
        console.log("Couldn't find offer to update (didIOffer: false)");
        return;
      }

      // Find the offerer socketId
      const socketToSendTo = connectedSockets.get(offerToUpdate.offererUserId);

      // Emit the ICE candidate to the offerer
      if (socketToSendTo) {
        socket
          .to(socketToSendTo.socketId)
          .emit("receivedIceCandidateFromServer", iceCandidate);
      } else {
        console.log(
          "ICE candidate received but could not find offerer (didIOffer: false)"
        );
      }
    }
  });

  // hangup the call event
  socket.on("hangupCall", (sendToUserId) => {
    const sendToUser = connectedSockets.get(sendToUserId);

    if (sendToUser) {
      socket.to(sendToUser.socketId).emit("hangupCallReq", true);
    } else {
      console.log("No matching user socket found to hang up call");
    }
  });
});
