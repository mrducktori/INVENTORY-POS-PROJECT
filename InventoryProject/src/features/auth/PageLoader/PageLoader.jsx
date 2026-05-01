import React from 'react';
import './PageLoader.css';

const PageLoader = () => {
  return (
    <div className="page-loader-overlay">
      <div className="loader-content">
        <h1 className="loader-brand">COF/TEA CAFE</h1>
        <div className="modern-dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
