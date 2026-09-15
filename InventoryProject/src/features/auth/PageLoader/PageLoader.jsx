import React from 'react';

const PageLoader = () => {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          to { background-position: 200% center; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="fixed inset-0 w-screen h-screen bg-[#111111] text-white flex flex-col items-center justify-center z-[99999]">
        <div className="flex flex-col items-center gap-6">
          <h1
            className="text-[28px] font-extrabold tracking-[8px] m-0 bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #444 0%, #fff 50%, #444 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              animation: 'shimmer 2.5s linear infinite',
            }}
          >
            COF/TEA CAFE
          </h1>
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-white rounded-full" style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
            <div className="w-3 h-3 bg-white rounded-full" style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
            <div className="w-3 h-3 bg-white rounded-full" style={{ animation: 'bounce 1.4s infinite ease-in-out both' }} />
          </div>
        </div>
      </div>
    </>
  );
};

export default PageLoader;
