import { useContextApi } from "../context/ContextApi";

export default function HeroSection() {
  const {
    userId,
    handleCall,
    handleHangup,
    localVideoRef,
    remoteVideoRef,
    handleAnswerOffer,
    setTargetUserId,
    incomingOffers,
  } = useContextApi();

  return (
    <div className="flex flex-col text-white justify-center items-center">
      <div className="m-10">
        <span>Your UserId:</span>
        <span className="bg-gray-800 p-2 rounded-md">
          {" "}
          {userId ? userId : "Generating userId..."}
        </span>
        <span
          className="mx-2 text-2xl cursor-pointer"
          onClick={() => navigator.clipboard.writeText(userId)}
        >
          📋
        </span>
      </div>
      <div className="pt-6 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold">Enter other peer userId to call</h2>
        <input
          type="text"
          placeholder="User ID"
          onChange={(e) => setTargetUserId(e.target.value)}
          className="mt-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm outline-none border-none bg-gray-800"
        />
        <div className="flex gap-5">
          <button
            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 "
            onClick={() => handleCall()}
          >
            Call
          </button>
          <button
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded-md shadow-sm hover:bg-red-600 "
            onClick={() => handleHangup()}
          >
            Hang up
          </button>
        </div>
      </div>
      <div className="flex justify-center mt-6 gap-10">
        <video
          className="w-1/2 h-auto"
          ref={localVideoRef}
          // controls
          autoPlay
        ></video>
        <video
          className="w-1/2 h-auto"
          ref={remoteVideoRef}
          // controls
          autoPlay
        ></video>
      </div>
      <div className="incomingOffersList flex flex-col items-center justify-center w-full m-5"></div>
      {!!incomingOffers.length &&
        incomingOffers.map((offer, index) => (
          <button
            onClick={() => handleAnswerOffer(offer)}
            className="p-2 bg-green-600 text-xs rounded-md"
            key={index}
          >
            {offer.offererUserId}
            <br />
            <span className="text-sm text-black">Accept call</span>
          </button>
        ))}
    </div>
  );
}
