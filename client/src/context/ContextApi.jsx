import { createContext, useContext, useState, useEffect, useRef } from "react";
import socketio from "socket.io-client";

const contextApi = createContext(null);

export const useContextApi = () => useContext(contextApi);

const getSocket = () => {
  return socketio("http://192.168.0.195:8180/", {
    secure: true,
    // rejectUnauthorized: false, // this allows self-signed certificates
  });
};

export default function ContextApiProvider({ children }) {
  const [userId, setUserId] = useState(null);
  // const [localStream, setLocalStream] = useState(null);
  // const [remoteStream, setRemoteStream] = useState(null);
  const [socket, setSocket] = useState(null);
  const [targetUserId, setTargetUserId] = useState(null);
  const [incomingOffers, setIncomingOffers] = useState([]);

  const didIOffer = useRef(false);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  const localStreamRef = useRef();
  const remoteStreamRef = useRef(new MediaStream());
  const peerConnectionRef = useRef();

  // function to fetch video and audio streams access
  const fetchUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // audio: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // mute the local video to prevent feedback
      }
      localStreamRef.current = stream;
    } catch (error) {
      console.log("Error while fetching userMedia " + error);
    }
  };

  // function to create peer connection
  const createPeerConnection = async (offerObj) => {
    if (!peerConnectionRef.current) {
      console.log("creating new RTCPeerConnection");
      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:stun1.l.google.com:19302",
            ],
          },
        ],
      });

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      peerConnectionRef.current.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          console.log("ICE candidate found:");
          socket.emit("sendIceCandidateToSignalingServer", {
            iceCandidate: event.candidate,
            iceUserId: userId,
            didIOffer,
          });
        }
      });

      peerConnectionRef.current.addEventListener("signalingstatechange", () => {
        console.log(
          "Signaling state change:",
          peerConnectionRef.current.signalingState
        );
      });

      peerConnectionRef.current.addEventListener(
        "iceconnectionstatechange",
        () => {
          console.log(
            "ICE connection state change:",
            peerConnectionRef.current.iceConnectionState
          );
        }
      );

      peerConnectionRef.current.addEventListener(
        "icegatheringstatechange",
        () => {
          console.log(
            "ICE gathering state change:",
            peerConnectionRef.current.iceGatheringState
          );
        }
      );

      peerConnectionRef.current.addEventListener(
        "connectionstatechange",
        () => {
          console.log(
            "Connection state change:",
            peerConnectionRef.current.connectionState
          );
        }
      );

      // event listener to listen for the track from the other peer
      peerConnectionRef.current.addEventListener("track", (event) => {
        console.log("got track from other peer !!!");
        console.log(event);
        event.streams[0].getTracks().forEach((track) => {
          remoteStreamRef.current.addTrack(track, remoteStreamRef.current);
        });
      });

      // Add tracks from local stream to peer connection
      if (localStreamRef.current) {
        console.log("adding track to peer connection from local stream");
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      }

      // if there is an offer object set it as an remote description
      if (offerObj) {
        await peerConnectionRef.current.setRemoteDescription(offerObj.offer);
      }
    }
  };

  // handle the call
  const handleCall = async () => {
    if (!targetUserId) return alert("please enter a userId to call");
    if (targetUserId.trim() === userId.trim())
      return alert("Enter a target userId not your Id");

    await fetchUserMedia();
    await createPeerConnection();
    try {
      const newOffer = await peerConnectionRef.current.createOffer();
      peerConnectionRef.current.setLocalDescription(newOffer);
      // set did i offer to true
      didIOffer.current = true;
      // emit the new offer to signalling server to pass it to the other peer
      socket.emit("newOffer", { newOffer, sendToUserId: targetUserId.trim() });
    } catch (error) {
      console.log("error while calling " + error);
    }
  };

  // handle answer offer
  const handleAnswerOffer = async (offerObj) => {
    await fetchUserMedia();
    await createPeerConnection(offerObj);

    const answerOffer = await peerConnectionRef.current.createAnswer({}); // create answer offer
    await peerConnectionRef.current.setLocalDescription(answerOffer); // set local description
    console.log("created an answer offer");
    offerObj.answer = answerOffer; // set answer offer to offerObj

    const offerIceCandidates = await socket.emitWithAck("newAnswer", offerObj);
    offerIceCandidates.forEach((c) => {
      peerConnectionRef.current.addIceCandidate(c);
      console.log("addedIceCandidate");
    });
  };

  const handleAddAnswer = async (offerObj) => {
    await peerConnectionRef.current.setRemoteDescription(offerObj.answer);
    console.log("client 1 set his remote description");
  };

  const handleAddIceCandidate = (iceCandidate) => {
    console.log("addedIceCandidate");
    peerConnectionRef.current.addIceCandidate(iceCandidate);
  };

  // handle the  incoming offers from other peers through singnalling server
  const handleIncomingOffer = async (offer) => {
    setIncomingOffers([...incomingOffers, offer]);
  };

  // methods to handle the socket events
  const handleAssignUserId = (userId) => {
    setUserId(userId);
  };

  // useEffect to enable socket connection when the component is rendered
  useEffect(() => {
    const socketInstance = getSocket();
    setSocket(socketInstance); // set the socket instance

    return () => {
      if (socketInstance) {
        socketInstance.disconnect(); // disconnect the current socket instance
      }
    };
  }, []);

  const handleHangup = () => {
    // Close the peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop all local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Clear remote stream
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = new MediaStream();
    }

    // Reset any other state variables if necessary
    setTargetUserId(null);
    didIOffer.current = false;

    alert("Call ended");
  };

  // Example of how to use it in your UI
  // <button onClick={handleHangup}>Hang Up</button>

  // listen for socket events
  useEffect(() => {
    if (socket) {
      socket.on("assignUserId", handleAssignUserId); //
      socket.on("newOfferAwaiting", handleIncomingOffer);
      socket.on("answerResponse", handleAddAnswer);
      socket.on("receivedIceCandidateFromServer", handleAddIceCandidate);
    }
    return () => {
      if (socket) {
        socket.off("assignUserId", handleAssignUserId); // clean up the listener when the component unmounts
        socket.off("newOfferAwaiting", handleIncomingOffer);
        socket.off("answerResponse", handleAddAnswer);
        socket.off("receivedIceCandidateFromServer", handleAddIceCandidate);
      }
    };
  }, [socket]);

  return (
    <contextApi.Provider
      value={{
        setTargetUserId,
        localVideoRef,
        remoteVideoRef,
        handleCall,
        handleHangup,
        userId,
        incomingOffers,
        handleAnswerOffer,
      }}
    >
      {children}
    </contextApi.Provider>
  );
}
